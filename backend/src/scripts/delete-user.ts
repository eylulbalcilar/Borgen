// Removes a registered user and their data, so the wallet and the Neuro
// identity become available again. Development use only.
// Usage: npx tsx src/scripts/delete-user.ts <walletAddress>
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { ActivityModel } from "../models/Activity.js";
import { AppraisalRequestModel } from "../models/AppraisalRequest.js";
import { UserModel } from "../models/User.js";

const wallet = process.argv[2]?.toLowerCase();
if (!wallet) throw new Error("Usage: delete-user.ts <walletAddress>");

await connectDatabase(process.env.MONGODB_URI);

const user = await UserModel.findOne({ walletAddress: wallet });
if (!user) {
  console.log("No user found for", wallet);
} else {
  await AppraisalRequestModel.deleteMany({ $or: [{ borrower: user._id }, { appraiser: user._id }] });
  await ActivityModel.deleteMany({ wallet });
  await UserModel.deleteOne({ _id: user._id });
  console.log("Deleted user", wallet, "with role", user.role);
}

await mongoose.disconnect();
