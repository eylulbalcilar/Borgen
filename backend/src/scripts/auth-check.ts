// Manual check of the SIWE login flow against a running backend.
// Start the server first (npm run dev), then in another tab:
//   npx tsx src/scripts/auth-check.ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const API = "http://localhost:4000";

// A throwaway wallet, standing in for MetaMask.
const account = privateKeyToAccount(generatePrivateKey());

async function signedMessage(domain: string) {
  const { nonce } = await (await fetch(`${API}/auth/nonce`)).json();
  const message = createSiweMessage({
    domain,
    address: account.address,
    uri: `http://${domain}`,
    version: "1",
    chainId: 84532,
    nonce,
    statement: "Sign in to Borgen",
  });
  const signature = await account.signMessage({ message });
  return { message, signature };
}

async function verify(body: object) {
  const res = await fetch(`${API}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// 1) Valid login
const login = await signedMessage("localhost:3000");
const first = await verify(login);
console.log("1) valid login:", first.status);

const me = await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${first.data.token}` },
});
const meData = await me.json();
console.log("   /auth/me:", me.status, meData.wallet === account.address);

// 2) Replaying the same signed message
const replay = await verify(login);
console.log("2) replay:", replay.status, replay.data.error);

// 3) Message signed for another site
const phishing = await verify(await signedMessage("evil.example"));
console.log("3) wrong domain:", phishing.status, phishing.data.error);

// 4) No token
const anonymous = await fetch(`${API}/auth/me`);
console.log("4) no token:", anonymous.status);
