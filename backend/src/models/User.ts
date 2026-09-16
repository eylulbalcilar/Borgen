import { Schema, model, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["borrower", "appraiser", "lender"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    // Stored lowercase so the same wallet can never be registered twice
    // with different letter casing.
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^0x[a-f0-9]{40}$/,
    },
    role: { type: String, enum: USER_ROLES, required: true },

    // Neuro identity (borrower and appraiser only).
    // unique + sparse: each Neuro identity can be linked to one wallet,
    // while lenders without an identity do not conflict with each other.
    neuroLegalId: { type: String, unique: true, sparse: true },
    identityState: { type: String },
    identityValidTo: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
