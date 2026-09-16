import mongoose from "mongoose";

export async function connectDatabase(uri: string | undefined): Promise<void> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
