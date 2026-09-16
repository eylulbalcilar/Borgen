import { Schema, model, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["borrower", "appraiser", "lender"] as const;

const userSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^0x[a-f0-9]{40}$/,
    },
    role: { type: String, enum: USER_ROLES, required: true },
    neuroLegalId: { type: String, required: true, unique: true },
    identityState: { type: String, required: true },
    identityValidTo: { type: Date, required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
