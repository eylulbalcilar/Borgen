import { ActivityModel, type ActivityType } from "../models/Activity.js";
import { SyncStateModel } from "../models/SyncState.js";
import { UserModel } from "../models/User.js";
import { getBlockTime, getLatestBlock, getPoolLogs, type PoolLog } from "./chain.js";

/**
 * Background indexer: reads LendingPool events and stores them as Activity.
 * Progress is saved per batch of chunks, so a restart resumes where it stopped.
 * Each event has a unique eventId (txHash:logIndex), so reprocessing is harmless.
 */

const SYNC_KEY = "lending-pool";
// sepolia.base.org rejects getLogs ranges wider than 200 blocks.
const CHUNK_SIZE = 200n;
// Chunks fetched side by side while catching up. The public RPC starts
// answering 429 somewhere between 25 and 50 parallel requests, and the same
// allowance has to serve the relayer, so stay well below it.
const CATCH_UP_CONCURRENCY = 8;
const POLL_INTERVAL_MS = 15_000;

type ActivityInput = {
  type: ActivityType;
  wallet: string;
  txHash: string;
  eventId: string;
  tokenId?: string;
  metadata: Record<string, string>;
  occurredAt?: Date;
};

// Dates an event by its block, not by when it was read: after a long catch-up
// those can be months apart. The node sends the block time with every log.
// Asking for the block instead fails once the node has pruned it.
export async function eventTime(log: PoolLog): Promise<Date | undefined> {
  if (log.blockTimestamp != null) return new Date(Number(log.blockTimestamp) * 1000);

  // Older nodes leave the field out. If the block is gone as well, the record
  // is dated when it is written, which is better than stalling the indexer.
  return getBlockTime(log.blockNumber).catch(() => undefined);
}

// Maps a decoded event to the fields we store.
function toActivity(log: PoolLog, occurredAt: Date | undefined): ActivityInput {
  const base = {
    txHash: log.transactionHash,
    eventId: `${log.transactionHash}:${log.logIndex}`,
    // Left out when unknown so the schema default applies.
    ...(occurredAt && { occurredAt }),
  };
  const block = log.blockNumber.toString();

  switch (log.eventName) {
    case "Deposited":
    case "Withdrawn":
      return {
        ...base,
        type: log.eventName === "Deposited" ? "deposited" : "withdrawn",
        wallet: log.args.lender,
        metadata: { amount: log.args.amount.toString(), shares: log.args.shares.toString(), block },
      };
    case "Borrowed":
      return {
        ...base,
        type: "borrowed",
        wallet: log.args.borrower,
        tokenId: log.args.tokenId.toString(),
        metadata: { amount: log.args.amount.toString(), dueAt: log.args.dueAt.toString(), block },
      };
    case "Repaid":
      return {
        ...base,
        type: "repaid",
        wallet: log.args.borrower,
        tokenId: log.args.tokenId.toString(),
        metadata: { debt: log.args.debt.toString(), block },
      };
    case "Liquidated":
      return {
        ...base,
        type: "liquidated",
        wallet: log.args.liquidator,
        tokenId: log.args.tokenId.toString(),
        metadata: { debt: log.args.debt.toString(), block },
      };
  }
}

async function saveLogs(logs: PoolLog[]) {
  if (logs.length === 0) return;

  const activities = await Promise.all(
    logs.map(async (log) => toActivity(log, await eventTime(log))),
  );

  // Link events to registered users when the wallet is known.
  const wallets = [...new Set(activities.map((a) => a.wallet!.toLowerCase()))];
  const users = await UserModel.find({ walletAddress: { $in: wallets } }, { walletAddress: 1 });
  const userByWallet = new Map(users.map((u) => [u.walletAddress, u._id]));

  // Upsert by eventId: inserts new events, leaves existing ones untouched.
  await ActivityModel.bulkWrite(
    activities.map((a) => {
      const wallet = a.wallet!.toLowerCase();
      return {
        updateOne: {
          filter: { eventId: a.eventId },
          update: { $setOnInsert: { ...a, wallet, user: userByWallet.get(wallet) } },
          upsert: true,
        },
      };
    }),
  );
}

// Processes all new blocks once. Returns the number of events saved.
export async function syncOnce(): Promise<number> {
  const state = await SyncStateModel.findOne({ key: SYNC_KEY });
  const startBlock = BigInt(process.env.LENDING_POOL_START_BLOCK ?? "0");
  let from = state ? BigInt(state.lastBlock) + 1n : startBlock;

  const latest = await getLatestBlock();
  let saved = 0;

  while (from <= latest) {
    const ranges: [bigint, bigint][] = [];
    for (let start = from; start <= latest && ranges.length < CATCH_UP_CONCURRENCY; ) {
      const end = start + CHUNK_SIZE - 1n < latest ? start + CHUNK_SIZE - 1n : latest;
      ranges.push([start, end]);
      start = end + 1n;
    }

    // If any chunk fails the whole batch is retried on the next run, so
    // progress never moves past a range that was not read.
    const logs = (await Promise.all(ranges.map(([start, end]) => getPoolLogs(start, end)))).flat();
    await saveLogs(logs);
    saved += logs.length;

    // Save progress after every batch.
    const to = ranges[ranges.length - 1]![1];
    await SyncStateModel.updateOne(
      { key: SYNC_KEY },
      { $set: { lastBlock: Number(to) } },
      { upsert: true },
    );
    from = to + 1n;
  }

  return saved;
}

// Runs syncOnce repeatedly. A new run starts only after the previous one
// finishes, so two syncs never overlap.
export function startIndexer() {
  const tick = async () => {
    try {
      const saved = await syncOnce();
      if (saved > 0) console.log(`Indexer: saved ${saved} event(s)`);
    } catch (err) {
      // RPC errors are usually temporary; log and try again on the next tick.
      console.error("Indexer error:", err instanceof Error ? err.message : err);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  void tick();
}
