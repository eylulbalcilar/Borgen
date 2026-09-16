import { Schema, model, type InferSchemaType } from "mongoose";

export const ACTIVITY_TYPES = [
  "user_registered",
  "appraisal_requested",
  "appraisal_approved",
  "appraisal_rejected",
  "nft_minted",
  "deposited",
  "withdrawn",
  "borrowed",
  "repaid",
  "liquidated",
] as const;

const activitySchema = new Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    wallet: { type: String, lowercase: true, index: true },
    tokenId: { type: String },
    txHash: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type Activity = InferSchemaType<typeof activitySchema>;
export const ActivityModel = model("Activity", activitySchema);
