// Lists registered users and their roles.
// Usage: npx tsx src/scripts/list-users.ts
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { UserModel } from "../models/User.js";

await connectDatabase(process.env.MONGODB_URI);

const users = await UserModel.find({}, { walletAddress: 1, role: 1 }).sort({ createdAt: 1 });
for (const user of users) {
  console.log(user.role.padEnd(10), user.walletAddress);
}

await mongoose.disconnect();
