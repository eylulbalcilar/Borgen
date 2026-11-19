// Fills occurredAt on activity records written before the field existed.
// Usage: npm run backfill:occurred-at
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { ActivityModel } from "../models/Activity.js";
import { getPoolLogs } from "../services/chain.js";
import { eventTime } from "../services/indexer.js";

await connectDatabase(process.env.MONGODB_URI);

// Read through the driver: the schema default would otherwise hand back the
// current time for every record that has no value stored.
const pending = await ActivityModel.collection.find({ occurredAt: { $exists: false } }).toArray();
console.log(`found ${pending.length} records without occurredAt`);

let fromChain = 0;
let fromRecord = 0;
let skipped = 0;

for (const record of pending) {
  const label = `${record.type} ${record._id.toString()}`;

  // Everything that is not a chain event was written the moment it happened,
  // so its creation time is already right.
  let occurredAt: Date | undefined = record.createdAt;

  if (record.eventId) {
    // Read the event again and take the time the node reports for it.
    const block = BigInt(record.metadata.block);
    const logs = await getPoolLogs(block, block);
    const log = logs.find((l) => `${l.transactionHash}:${l.logIndex}` === record.eventId);
    occurredAt = log ? await eventTime(log) : undefined;
  }

  if (!occurredAt) {
    console.log(`skip ${label}: no time available for its block`);
    skipped += 1;
    continue;
  }

  await ActivityModel.collection.updateOne({ _id: record._id }, { $set: { occurredAt } });

  if (record.eventId) fromChain += 1;
  else fromRecord += 1;
  console.log(`${label}: ${occurredAt.toISOString()}`);
}

console.log(`done: ${fromChain} dated from the chain, ${fromRecord} from the record, ${skipped} skipped`);
await mongoose.disconnect();
