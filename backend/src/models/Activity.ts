import { Schema, model, type InferSchemaType } from "mongoose";

export const ACTIVITY_TYPES = [
  "user_registered",
  "appraisal_requested",
  "appraisal_approved",
  "appraisal_rejected",
  "appraisal_revalued",
  "nft_minted",
  "deposited",
  "withdrawn",
  "borrowed",
  "repaid",
  "liquidated",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const activitySchema = new Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    wallet: { type: String, lowercase: true, index: true },
    tokenId: { type: String },
    txHash: { type: String },
    metadata: { type: Schema.Types.Mixed },
    // "txHash:logIndex" for events read from the chain; prevents duplicates.
    eventId: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type Activity = InferSchemaType<typeof activitySchema>;
export const ActivityModel = model("Activity", activitySchema);
