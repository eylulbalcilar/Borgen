"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { ADDRESSES, GENERAL_ASSET_CLASS, lendingPoolAbi, stablecoinAbi } from "./contracts";

const pool = { address: ADDRESSES.lendingPool, abi: lendingPoolAbi } as const;

// Reads pool state and the connected wallet's position in one batch.
export function usePoolData() {
  const { address } = useAccount();

  const query = useReadContracts({
    contracts: [
      { ...pool, functionName: "totalAssets" },
      { ...pool, functionName: "totalShares" },
      { ...pool, functionName: "totalBorrowed" },
      { ...pool, functionName: "cash" },
      { ...pool, functionName: "claimable", args: [address ?? "0x"] },
      { ...pool, functionName: "sharesOf", args: [address ?? "0x"] },
      {
        address: ADDRESSES.stablecoin,
        abi: stablecoinAbi,
        functionName: "balanceOf",
        args: [address ?? "0x"],
      },
      {
        address: ADDRESSES.stablecoin,
        abi: stablecoinAbi,
        functionName: "allowance",
        args: [address ?? "0x", ADDRESSES.lendingPool],
      },
    ],
    // Always read from the latest block, otherwise wagmi may reuse a cached
    // block number and show stale balances after a transaction.
    blockTag: "latest",
    query: {
      enabled: Boolean(address),
      refetchInterval: 5000,
    },
  });

  const [totalAssets, totalShares, totalBorrowed, cash, claimable, shares, balance, allowance] = (
    query.data ?? []
  ).map((item) => (item.status === "success" ? (item.result as bigint) : undefined));

  // Value of the lender's shares in mUSD. The +1 on each side mirrors the
  // pool's own share maths, so this is the amount a withdrawal pays out.
  const position =
    totalShares !== undefined && shares !== undefined && totalAssets !== undefined
      ? (shares * (totalAssets + 1n)) / (totalShares + 1n)
      : 0n;

  // Idle money in the pool. Total assets also count interest that has accrued
  // but not been paid, which cannot be lent or withdrawn yet.
  const available = cash;

  return {
    ...query,
    totalAssets,
    totalShares,
    totalBorrowed,
    available,
    shares: shares ?? 0n,
    // Sale surplus or fees waiting for this wallet to collect.
    claimable: claimable ?? 0n,
    position,
    balance: balance ?? 0n,
    allowance: allowance ?? 0n,
  };
}

// Public pool stats for the landing page. No wallet needed.
export function usePoolStats() {
  const query = useReadContracts({
    contracts: [
      { ...pool, functionName: "totalAssets" },
      { ...pool, functionName: "totalBorrowed" },
    ],
    blockTag: "latest",
    query: { refetchInterval: 30_000 },
  });

  const [totalAssets, totalBorrowed] = (query.data ?? []).map((item) =>
    item.status === "success" ? (item.result as bigint) : undefined,
  );

  return { ...query, totalAssets, totalBorrowed };
}

// Loan-to-value ratio the pool applies, in basis points. Undefined until read.
export function useLtvBps() {
  const query = useReadContract({
    ...pool,
    functionName: "assetClasses",
    args: [GENERAL_ASSET_CLASS],
  });

  return query.data === undefined ? undefined : BigInt(query.data[1]);
}
