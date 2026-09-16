
import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./config/db.js";

const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await connectDatabase(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
