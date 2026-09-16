import type { NextFunction, Request, Response } from "express";
import { AuthError, verifyToken } from "../services/auth.js";

// Protects a route: expects "Authorization: Bearer <token>".
// On success the verified wallet is available as res.locals.wallet.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    res.locals.wallet = await verifyToken(header.slice("Bearer ".length));
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    next(err);
  }
}
