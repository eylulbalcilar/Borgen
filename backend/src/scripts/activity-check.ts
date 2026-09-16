// Prints the latest indexed chain events and the indexer progress.
// Usage: npx tsx src/scripts/activity-check.ts
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { ActivityModel } from "../models/Activity.js";
import { SyncStateModel } from "../models/SyncState.js";

await connectDatabase(process.env.MONGODB_URI);

const state = await SyncStateModel.findOne({ key: "lending-pool" });
console.log("last indexed block:", state?.lastBlock);

const events = await ActivityModel.find({ eventId: { $exists: true } })
  .sort({ createdAt: -1 })
  .limit(5);

for (const e of events) {
  console.log(e.type, e.wallet, e.metadata);
}

await mongoose.disconnect();
