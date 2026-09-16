import { getAddress, isAddress } from "viem";
import { mintCollateral, type MintResult } from "./chain.js";
import { credentials, getContract, readParameters, readParts } from "./neuro.js";

/**
 * Moves a signed Neuro appraisal onto the chain.
 * All values are read from the signed Neuro contract, never from user input,
 * so the minted token always matches what both parties signed.
 */

export type RelayResult = MintResult & {
  owner: string;
  valuation: bigint;
};

export async function relayAppraisal(neuroContractId: string): Promise<RelayResult> {
  const contract = await getContract("appraiser", neuroContractId);

  // 1) Must be created from the Borgen appraisal template.
  const templateId = process.env.NEURO_APPRAISAL_TEMPLATE_ID;
  if (!templateId || contract.status.templateId !== templateId) {
    throw new Error("Contract was not created from the appraisal template");
  }

  // 2) Both roles must have signed.
  if (contract.status.state !== "Signed") {
    throw new Error(`Contract is ${contract.status.state}, expected Signed`);
  }

  // 3) The appraiser role must belong to an approved appraiser.
  // MVP allowlist: the single sandbox appraiser configured in env.
  const parts = readParts(contract);
  if (parts.Appraiser !== credentials("appraiser").legalId) {
    throw new Error("Appraiser is not on the allowlist");
  }

  // 4) Validate the signed parameters before they reach the chain.
  const params = readParameters(contract);

  if (params.Currency !== "mUSD") {
    throw new Error(`Unsupported currency: ${params.Currency}`);
  }
  if (!/^[1-9][0-9]*$/.test(params.Valuation ?? "")) {
    throw new Error(`Invalid valuation: ${params.Valuation}`);
  }
  if (!params.OwnerWallet || !isAddress(params.OwnerWallet)) {
    throw new Error(`Invalid owner wallet: ${params.OwnerWallet}`);
  }

  const owner = getAddress(params.OwnerWallet);
  const valuation = BigInt(params.Valuation);

  const minted = await mintCollateral(owner, neuroContractId, valuation);
  return { ...minted, owner, valuation };
}
