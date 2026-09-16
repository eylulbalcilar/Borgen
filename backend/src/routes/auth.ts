import { Router } from "express";
import { AuthError, createNonce, issueToken, verifySiwe } from "../services/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

// Step 1: the client asks for a fresh nonce to put in the SIWE message.
authRouter.get("/nonce", async (_req, res) => {
  res.json({ nonce: await createNonce() });
});

// Step 2: the client sends the signed message and receives a session token.
authRouter.post("/verify", async (req, res) => {
  const { message, signature } = req.body ?? {};
  if (typeof message !== "string" || typeof signature !== "string") {
    res.status(400).json({ error: "message and signature are required" });
    return;
  }

  try {
    const wallet = await verifySiwe(message, signature as `0x${string}`);
    res.json({ token: await issueToken(wallet), wallet });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Returns the wallet behind the current token.
authRouter.get("/me", requireAuth, (_req, res) => {
  res.json({ wallet: res.locals.wallet });
});
