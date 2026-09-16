import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ActivityModel } from "../models/Activity.js";

export const activityRouter = Router();

// Activity history of the signed-in wallet, newest first.
activityRouter.get("/", requireAuth, async (_req, res) => {
  const wallet = String(res.locals.wallet).toLowerCase();
  const activities = await ActivityModel.find({ wallet }).sort({ createdAt: -1 }).limit(100);
  res.json(activities);
});
