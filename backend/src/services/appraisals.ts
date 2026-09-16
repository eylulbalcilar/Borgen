import { isValidObjectId } from "mongoose";
import type { Address } from "viem";
import { ActivityModel } from "../models/Activity.js";
import { AppraisalRequestModel } from "../models/AppraisalRequest.js";
import { UserModel, type UserRole } from "../models/User.js";
import { createContract, getContract, signContract, waitForState } from "./neuro.js";
import { relayAppraisal } from "./relayer.js";

/**
 * Appraisal workflow:
 *   pending --(appraiser approve)--> approved --(borrower accept)--> minted
 *   pending --(appraiser reject)---> rejected
 */

export class AppraisalError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Amounts are integers in the smallest unit (mUSD has 6 decimals).
// 78 digits is the maximum length of a uint256.
const AMOUNT_PATTERN = /^[1-9][0-9]{0,77}$/;

async function requireUser(wallet: Address, role: UserRole) {
  const user = await UserModel.findOne({ walletAddress: wallet.toLowerCase() });
  if (!user) throw new AppraisalError("User not registered", 403);
  if (user.role !== role) throw new AppraisalError(`This action requires the ${role} role`, 403);
  return user;
}

async function requireRequest(id: string) {
  // Invalid ids would make Mongoose throw a CastError; treat them as not found.
  const request = isValidObjectId(id) ? await AppraisalRequestModel.findById(id) : null;
  if (!request) throw new AppraisalError("Appraisal request not found", 404);
  return request;
}

function requireText(value: unknown, field: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > max) {
    throw new AppraisalError(`${field} must be 1-${max} characters`, 400);
  }
  return text;
}

function requireAmount(value: unknown, field: string): string {
  if (typeof value !== "string" || !AMOUNT_PATTERN.test(value)) {
    throw new AppraisalError(`${field} must be a positive integer string`, 400);
  }
  return value;
}

export type NewAppraisal = {
  title?: unknown;
  description?: unknown;
  serialNumber?: unknown;
  requestedValuation?: unknown;
};

export async function createAppraisal(wallet: Address, input: NewAppraisal) {
  const borrower = await requireUser(wallet, "borrower");

  // serialNumber is required because the Neuro template requires it.
  const title = requireText(input.title, "title", 120);
  const serialNumber = requireText(input.serialNumber, "serialNumber", 120);
  const description =
    input.description === undefined ? undefined : requireText(input.description, "description", 1000);
  const requestedValuation = requireAmount(input.requestedValuation, "requestedValuation");

  const request = await AppraisalRequestModel.create({
    borrower: borrower._id,
    asset: { title, description, serialNumber },
    requestedValuation,
  });

  await ActivityModel.create({
    type: "appraisal_requested",
    user: borrower._id,
    wallet: borrower.walletAddress,
    metadata: { requestId: request._id },
  });

  return request;
}

export async function listAppraisals(wallet: Address) {
  const user = await UserModel.findOne({ walletAddress: wallet.toLowerCase() });
  if (!user) throw new AppraisalError("User not registered", 403);
  if (user.role === "lender") throw new AppraisalError("Lenders have no appraisal requests", 403);

  // Borrowers see their own requests; appraisers see all of them.
  const filter = user.role === "borrower" ? { borrower: user._id } : {};

  return AppraisalRequestModel.find(filter)
    .sort({ createdAt: -1 })
    .populate("borrower", "walletAddress");
}

export async function approveAppraisal(wallet: Address, id: string, valuationInput: unknown) {
  const appraiser = await requireUser(wallet, "appraiser");
  const request = await requireRequest(id);
  if (request.status !== "pending") {
    throw new AppraisalError(`Request is already ${request.status}`, 409);
  }
  const valuation = requireAmount(valuationInput, "valuation");

  const borrower = await UserModel.findById(request.borrower);
  if (!borrower?.neuroLegalId || !appraiser.neuroLegalId) {
    throw new AppraisalError("Both parties need a Neuro identity", 422);
  }

  const templateId = process.env.NEURO_APPRAISAL_TEMPLATE_ID;
  if (!templateId) throw new Error("NEURO_APPRAISAL_TEMPLATE_ID is not set");

  // Everything the relayer will later trust goes into the signed contract,
  // including the wallet that receives the collateral token.
  const contract = await createContract(
    "appraiser",
    templateId,
    [
      { role: "Appraiser", legalId: appraiser.neuroLegalId },
      { role: "Owner", legalId: borrower.neuroLegalId },
    ],
    [
      { name: "AssetTitle", value: request.asset?.title ?? "" },
      { name: "SerialNumber", value: request.asset?.serialNumber ?? "" },
      { name: "Valuation", value: valuation },
      { name: "Currency", value: "mUSD" },
      { name: "OwnerWallet", value: borrower.walletAddress },
    ],
  );

  await signContract("appraiser", contract.id, "Appraiser");

  request.set({
    appraiser: appraiser._id,
    valuation,
    neuroContractId: contract.id,
    status: "approved",
  });
  await request.save();

  await ActivityModel.create({
    type: "appraisal_approved",
    user: appraiser._id,
    wallet: appraiser.walletAddress,
    metadata: { requestId: request._id, neuroContractId: contract.id, valuation },
  });

  return request;
}

export async function rejectAppraisal(wallet: Address, id: string) {
  const appraiser = await requireUser(wallet, "appraiser");
  const request = await requireRequest(id);
  if (request.status !== "pending") {
    throw new AppraisalError(`Request is already ${request.status}`, 409);
  }

  request.set({ appraiser: appraiser._id, status: "rejected" });
  await request.save();

  await ActivityModel.create({
    type: "appraisal_rejected",
    user: appraiser._id,
    wallet: appraiser.walletAddress,
    metadata: { requestId: request._id },
  });

  return request;
}

export async function acceptAppraisal(wallet: Address, id: string) {
  const borrower = await requireUser(wallet, "borrower");
  const request = await requireRequest(id);
  if (!request.borrower.equals(borrower._id)) {
    throw new AppraisalError("This request belongs to another borrower", 403);
  }
  if (request.status !== "approved" || !request.neuroContractId) {
    throw new AppraisalError(`Request is ${request.status}, expected approved`, 409);
  }

  const contractId = request.neuroContractId;

  // Sign as Owner unless the contract is already complete.
  // Retry-safe: if an earlier attempt signed but failed later,
  // Neuro rejects a second Owner signature and we continue.
  const contract = await getContract("borrower", contractId);
  if (contract.status.state !== "Signed") {
    try {
      await signContract("borrower", contractId, "Owner");
    } catch (err) {
      const alreadySigned = err instanceof Error && err.message.includes("No more signatures");
      if (!alreadySigned) throw err;
    }
  }

  // Signing is asynchronous, and the relayer only accepts fully signed contracts.
  await waitForState("borrower", contractId, ["Signed"]);

  const minted = await relayAppraisal(contractId);
  const tokenId = minted.tokenId.toString();

  request.set({ status: "minted", tokenId, mintTxHash: minted.txHash });
  await request.save();

  await ActivityModel.create({
    type: "nft_minted",
    user: borrower._id,
    wallet: borrower.walletAddress,
    tokenId,
    txHash: minted.txHash,
    metadata: { requestId: request._id, neuroContractId: contractId, valuation: minted.valuation.toString() },
  });

  return request;
}
