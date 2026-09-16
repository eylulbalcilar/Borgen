import { Schema, model } from "mongoose";

// Single-use SIWE nonces.
// The TTL index makes MongoDB delete unused nonces 10 minutes after creation.
const nonceSchema = new Schema({
  value: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export const NonceModel = model("Nonce", nonceSchema);
