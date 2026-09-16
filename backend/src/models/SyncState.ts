import { Schema, model } from "mongoose";

// Stores how far each background job has processed the chain,
// so it can resume after a restart without missing or repeating blocks.
const syncStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    lastBlock: { type: Number, required: true },
  },
  { timestamps: true },
);

export const SyncStateModel = model("SyncState", syncStateSchema);
