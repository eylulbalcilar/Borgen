// Fills mintedTo on collateral records that were minted before the field existed.
// Usage: npm run backfill:minted-to
import "dotenv/config";
import mongoose from "mongoose";
import type { Address, Hash } from "viem";
import { connectDatabase } from "../config/db.js";
import { AppraisalRequestModel } from "../models/AppraisalRequest.js";
import { mintRecipient, ownerOfCollateral } from "../services/chain.js";

const POOL = (process.env.LENDING_POOL_ADDRESS ?? "").toLowerCase();

await connectDatabase(process.env.MONGODB_URI);

// In MongoDB a null match also covers documents where the field is absent.
const pending = await AppraisalRequestModel.find({
  status: "minted",
  $or: [{ mintedTo: null }, { mintedTo: "" }],
});

console.log(`found ${pending.length} minted records without mintedTo`);

let filled = 0;
let skipped = 0;

for (const request of pending) {
  const label = `${request._id.toString()} (token ${request.tokenId ?? "none"})`;

  if (!request.tokenId) {
    console.log(`skip ${label}: record has no tokenId`);
    skipped += 1;
    continue;
  }

  try {
    let owner: Address | undefined = await ownerOfCollateral(BigInt(request.tokenId));

    // While a loan is open the pool holds the token, so the current holder is
    // not the wallet it was minted to. Read that from the mint transaction.
    if (owner.toLowerCase() === POOL) {
      owner = request.mintTxHash ? await mintRecipient(request.mintTxHash as Hash) : undefined;
      if (!owner) {
        console.log(`skip ${label}: held by the pool and no mint transaction to read`);
        skipped += 1;
        continue;
      }
    }

    // The schema lowercases the value on save.
    request.set({ mintedTo: owner });
    await request.save();
    filled += 1;
    console.log(`filled ${label}: ${owner.toLowerCase()}`);
  } catch (err) {
    // A burned or never minted token makes ownerOf revert; leave the record alone.
    const reason = err instanceof Error ? (err.message.split("\n")[0] ?? err.message) : String(err);
    console.log(`skip ${label}: ${reason}`);
    skipped += 1;
  }
}

console.log(`done: ${filled} updated, ${skipped} skipped`);
await mongoose.disconnect();
