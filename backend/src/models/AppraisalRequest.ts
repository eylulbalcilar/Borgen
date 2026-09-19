import { Schema, model, type InferSchemaType } from "mongoose";

export const APPRAISAL_STATUSES = ["pending", "approved", "rejected", "minted"] as const;

const appraisalRequestSchema = new Schema(
  {
    borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appraiser: { type: Schema.Types.ObjectId, ref: "User", index: true },
    asset: {
      title: { type: String, required: true, trim: true, maxlength: 120 },
      description: { type: String, trim: true, maxlength: 1000 },
      serialNumber: { type: String, trim: true, maxlength: 120 },
    },
    requestedValuation: { type: String, required: true },
    valuation: { type: String },
    status: { type: String, enum: APPRAISAL_STATUSES, default: "pending", index: true },
    neuroContractId: { type: String, unique: true, sparse: true },
    tokenId: { type: String },
    mintTxHash: { type: String },

    // Wallet the collateral token was minted to, copied from the signed Neuro
    // contract. Stored so ownership can be checked from the record alone,
    // without reading the chain or trusting the borrower link.
    mintedTo: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^0x[a-f0-9]{40}$/,
    },
  },
  { timestamps: true },
);

export type AppraisalRequest = InferSchemaType<typeof appraisalRequestSchema>;
export const AppraisalRequestModel = model("AppraisalRequest", appraisalRequestSchema);
