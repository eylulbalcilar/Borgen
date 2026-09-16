// End-to-end check of the appraisal workflow against a running backend.
// Start the server first (npm run dev), then in another tab:
//   npx tsx src/scripts/appraisals-check.ts
// Note: step 6 mints a real token on Base Sepolia to a throwaway wallet.
// Test users, requests and activities are deleted at the end.
import "dotenv/config";
import mongoose from "mongoose";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { connectDatabase } from "../config/db.js";
import { ActivityModel } from "../models/Activity.js";
import { AppraisalRequestModel } from "../models/AppraisalRequest.js";
import { UserModel } from "../models/User.js";

const API = "http://localhost:4000";

async function newSession() {
  const account = privateKeyToAccount(generatePrivateKey());
  const { nonce } = await (await fetch(`${API}/auth/nonce`)).json();
  const message = createSiweMessage({
    domain: "localhost:3000",
    address: account.address,
    uri: "http://localhost:3000",
    version: "1",
    chainId: 84532,
    nonce,
  });
  const signature = await account.signMessage({ message });
  const res = await fetch(`${API}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const { token } = await res.json();
  return { wallet: account.address.toLowerCase(), token };
}

// Small authenticated fetch helper.
async function api(token: string, method: string, path: string, body?: object) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const borrower = await newSession();
const appraiser = await newSession();

try {
  await api(borrower.token, "POST", "/users", { role: "borrower" });
  await api(appraiser.token, "POST", "/users", { role: "appraiser" });

  const asset = { title: "Test chronograph watch", serialNumber: "E2E-0001", requestedValuation: "12000000000" };
  const first = await api(borrower.token, "POST", "/appraisals", asset);
  const second = await api(borrower.token, "POST", "/appraisals", { ...asset, serialNumber: "E2E-0002" });
  console.log("1) create:", first.status, second.status);

  const list = await api(borrower.token, "GET", "/appraisals");
  console.log("2) borrower list:", list.status, list.data.length);

  const selfApprove = await api(borrower.token, "POST", `/appraisals/${first.data._id}/approve`, {
    valuation: "10000000000",
  });
  console.log("3) borrower approves:", selfApprove.status, selfApprove.data.error);

  const approved = await api(appraiser.token, "POST", `/appraisals/${first.data._id}/approve`, {
    valuation: "10000000000",
  });
  console.log("4) approve:", approved.status, approved.data.status, approved.data.neuroContractId);

  const rejected = await api(appraiser.token, "POST", `/appraisals/${second.data._id}/reject`);
  console.log("5) reject:", rejected.status, rejected.data.status);

  console.log("6) accepting (signature + mint, please wait)...");
  const accepted = await api(borrower.token, "POST", `/appraisals/${first.data._id}/accept`);
  console.log("   accept:", accepted.status, accepted.data.status, "tokenId", accepted.data.tokenId);
  if (accepted.data.mintTxHash) {
    console.log("   tx:", `https://sepolia.basescan.org/tx/${accepted.data.mintTxHash}`);
  }

  const again = await api(borrower.token, "POST", `/appraisals/${first.data._id}/accept`);
  console.log("7) accept again:", again.status, again.data.error);
} finally {
  await connectDatabase(process.env.MONGODB_URI);
  const wallets = [borrower.wallet, appraiser.wallet];
  const users = await UserModel.find({ walletAddress: { $in: wallets } });
  const userIds = users.map((u) => u._id);
  await AppraisalRequestModel.deleteMany({ borrower: { $in: userIds } });
  await ActivityModel.deleteMany({ wallet: { $in: wallets } });
  const removed = await UserModel.deleteMany({ _id: { $in: userIds } });
  console.log("cleanup: removed", removed.deletedCount, "test users");
  await mongoose.disconnect();
}
