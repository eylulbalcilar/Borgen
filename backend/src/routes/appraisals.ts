import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  acceptAppraisal,
  AppraisalError,
  approveAppraisal,
  createAppraisal,
  listAppraisals,
  rejectAppraisal,
} from "../services/appraisals.js";

export const appraisalsRouter = Router();

// Every appraisal route requires a signed-in wallet.
appraisalsRouter.use(requireAuth);

// Turns AppraisalError into its HTTP status; other errors go to the 500 handler.
type Handler = (req: Request, res: Response) => Promise<void>;
const handle = (fn: Handler) => async (req: Request, res: Response) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof AppraisalError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
};

appraisalsRouter.get(
  "/",
  handle(async (_req, res) => {
    res.json(await listAppraisals(res.locals.wallet));
  }),
);

appraisalsRouter.post(
  "/",
  handle(async (req, res) => {
    res.status(201).json(await createAppraisal(res.locals.wallet, req.body ?? {}));
  }),
);

appraisalsRouter.post(
  "/:id/approve",
  handle(async (req, res) => {
    res.json(await approveAppraisal(res.locals.wallet, req.params.id as string, req.body?.valuation));
  }),
);

appraisalsRouter.post(
  "/:id/reject",
  handle(async (req, res) => {
    res.json(await rejectAppraisal(res.locals.wallet, req.params.id as string));
  }),
);

// Slow: waits for the Neuro signature and the mint transaction.
appraisalsRouter.post(
  "/:id/accept",
  handle(async (req, res) => {
    res.json(await acceptAppraisal(res.locals.wallet, req.params.id as string));
  }),
);
