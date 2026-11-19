import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { USER_ROLES, type UserRole } from "../models/User.js";
import { allowCollateralHolder } from "../services/chain.js";
import { findUser, registerUser, UserError } from "../services/users.js";

export const usersRouter = Router();

// The wallet comes from the verified session, never from the request body.
usersRouter.post("/", requireAuth, async (req, res) => {
  const role = req.body?.role;
  if (!USER_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${USER_ROLES.join(", ")}` });
    return;
  }

  try {
    const user = await registerUser(res.locals.wallet, role as UserRole);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

usersRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await findUser(res.locals.wallet);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }
  res.json(user);
});

// Approves the caller's wallet to hold collateral tokens, which a buyer in a
// liquidation needs before the token can be sent to them.
// MVP limitation: registering is the only check. A production version would
// approve a wallet only after its owner's identity has been verified.
usersRouter.post("/me/collateral-access", requireAuth, async (_req, res) => {
  const user = await findUser(res.locals.wallet);
  if (!user) {
    res.status(404).json({ error: "User not registered" });
    return;
  }

  await allowCollateralHolder(res.locals.wallet);
  res.json({ allowed: true });
});
