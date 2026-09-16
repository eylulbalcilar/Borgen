import type { Address } from "viem";
import { ActivityModel } from "../models/Activity.js";
import { UserModel, type UserRole } from "../models/User.js";
import { credentials, getIdentities, type NeuroAccount } from "./neuro.js";

// Business rule violations that should reach the client as 4xx responses.
export class UserError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// MVP: each role that needs an identity maps to one sandbox Neuro account.
const NEURO_ACCOUNT_BY_ROLE: Partial<Record<UserRole, NeuroAccount>> = {
  borrower: "borrower",
  appraiser: "appraiser",
};

// Reads the identity live from Neuro and checks that it can be trusted today.
async function verifiedIdentity(account: NeuroAccount) {
  const legalId = credentials(account).legalId;
  const identities = await getIdentities(account);
  const identity = identities.find((i) => i.id === legalId);

  if (!identity) throw new UserError("Neuro identity not found", 422);
  if (identity.status.state !== "Approved") {
    throw new UserError(`Neuro identity is ${identity.status.state}`, 422);
  }

  const validTo = identity.status.to ? new Date(identity.status.to) : undefined;
  if (!validTo || validTo.getTime() <= Date.now()) {
    throw new UserError("Neuro identity has expired", 422);
  }

  return { legalId, state: identity.status.state, validTo };
}

export async function registerUser(wallet: Address, role: UserRole) {
  const walletAddress = wallet.toLowerCase();

  if (await UserModel.exists({ walletAddress })) {
    throw new UserError("Wallet is already registered", 409);
  }

  const account = NEURO_ACCOUNT_BY_ROLE[role];
  const identity = account ? await verifiedIdentity(account) : undefined;

  if (identity && (await UserModel.exists({ neuroLegalId: identity.legalId }))) {
    throw new UserError("Neuro identity is already linked to another wallet", 409);
  }

  const user = await UserModel.create({
    walletAddress,
    role,
    neuroLegalId: identity?.legalId,
    identityState: identity?.state,
    identityValidTo: identity?.validTo,
  });

  await ActivityModel.create({
    type: "user_registered",
    user: user._id,
    wallet: walletAddress,
    metadata: { role },
  });

  return user;
}

export async function findUser(wallet: string) {
  return UserModel.findOne({ walletAddress: wallet.toLowerCase() });
}
