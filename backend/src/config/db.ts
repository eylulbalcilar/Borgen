import mongoose from "mongoose";

export async function connectDatabase(uri: string | undefined): Promise<void> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  // MONGODB_DB_NAME picks a database other than the one named in the URI.
  // The second contract version keeps its records apart from the first this
  // way, so the first can be brought back without untangling the two.
  const dbName = process.env.MONGODB_DB_NAME || undefined;
  await mongoose.connect(uri, { dbName });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
