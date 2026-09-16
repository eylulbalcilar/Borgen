import { SignJWT, jwtVerify } from "jose";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { NonceModel } from "../models/Nonce.js";

/**
 * Sign-In with Ethereum (EIP-4361).
 * The wallet signs a message containing a single-use nonce;
 * the backend verifies it and issues a short-lived JWT.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// jose expects the HMAC secret as bytes.
function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnv("JWT_SECRET"));
}

export async function createNonce(): Promise<string> {
  const value = generateSiweNonce();
  await NonceModel.create({ value });
  return value;
}

export class AuthError extends Error {}

// Returns the verified wallet address, or throws AuthError.
export async function verifySiwe(message: string, signature: Hex): Promise<Address> {
  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce) {
    throw new AuthError("Malformed SIWE message");
  }

  // Domain check blocks messages signed on another site (phishing).
  // Also checks expirationTime / notBefore when present.
  const valid = validateSiweMessage({
    message: parsed,
    domain: requireEnv("SIWE_DOMAIN"),
  });
  if (!valid) throw new AuthError("Invalid SIWE message");

  if (parsed.chainId !== Number(requireEnv("CHAIN_ID"))) {
    throw new AuthError("Wrong chain");
  }

  // Recovers the signer from the signature and compares it to the address in the message.
  const signatureOk = await verifyMessage({ address: parsed.address, message, signature });
  if (!signatureOk) throw new AuthError("Invalid signature");

  // Consume the nonce atomically: find and delete in one operation,
  // so the same signed message can never be used twice.
  const nonce = await NonceModel.findOneAndDelete({ value: parsed.nonce });
  if (!nonce) throw new AuthError("Unknown or used nonce");

  return getAddress(parsed.address);
}

// Session token: the wallet address is stored as the JWT subject.
export async function issueToken(wallet: Address): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(wallet)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtSecret());
}

export async function verifyToken(token: string): Promise<Address> {
  try {
    // Restricting algorithms prevents tokens signed with an unexpected algorithm.
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (!payload.sub) throw new AuthError("Token has no subject");
    return getAddress(payload.sub);
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}
