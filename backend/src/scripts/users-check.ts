// Manual check of user registration against a running backend.
// Start the server first (npm run dev), then in another tab:
//   npx tsx src/scripts/users-check.ts
// Test users are deleted at the end so the sandbox identities stay free.
import "dotenv/config";
import mongoose from "mongoose";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { connectDatabase } from "../config/db.js";
import { ActivityModel } from "../models/Activity.js";
import { UserModel } from "../models/User.js";

const API = "http://localhost:4000";

// Logs in a fresh throwaway wallet and returns its address and session token.
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

async function register(token: string, role: string) {
  const res = await fetch(`${API}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

const a = await newSession();
const b = await newSession();
const c = await newSession();

try {
  const r1 = await register(a.token, "borrower");
  console.log("1) borrower:", r1.status, r1.data.identityState);

  const r2 = await register(a.token, "lender");
  console.log("2) same wallet again:", r2.status, r2.data.error);

  const r3 = await register(b.token, "borrower");
  console.log("3) identity reused:", r3.status, r3.data.error);

  const r4 = await register(c.token, "lender");
  console.log("4) lender:", r4.status, r4.data.neuroLegalId ?? "(no identity)");

  const r5 = await register(b.token, "admin");
  console.log("5) invalid role:", r5.status);

  const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${a.token}` } });
  console.log("6) /users/me:", me.status, (await me.json()).role);
} finally {
  // Clean up directly in the database, even if a step above failed.
  await connectDatabase(process.env.MONGODB_URI);
  const wallets = [a.wallet, b.wallet, c.wallet];
  const users = await UserModel.deleteMany({ walletAddress: { $in: wallets } });
  await ActivityModel.deleteMany({ wallet: { $in: wallets } });
  console.log("cleanup: removed", users.deletedCount, "test users");
  await mongoose.disconnect();
}
