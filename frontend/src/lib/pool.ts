"use client";

import { useAccount, useReadContracts } from "wagmi";
import { ADDRESSES, lendingPoolAbi, stablecoinAbi } from "./contracts";

const pool = { address: ADDRESSES.lendingPool, abi: lendingPoolAbi } as const;

// Reads pool state and the connected wallet's position in one batch.
export function usePoolData() {
  const { address } = useAccount();

  const query = useReadContracts({
    contracts: [
      { ...pool, functionName: "totalAssets" },
      { ...pool, functionName: "totalShares" },
      { ...pool, functionName: "totalBorrowed" },
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

  const [totalAssets, totalShares, totalBorrowed, shares, balance, allowance] = (
    query.data ?? []
  ).map((item) => (item.status === "success" ? (item.result as bigint) : undefined));

  // Value of the lender's shares in mUSD.
  const position =
    totalShares !== undefined && totalShares > 0n && shares !== undefined && totalAssets !== undefined
      ? (shares * totalAssets) / totalShares
      : 0n;

  const available =
    totalAssets !== undefined && totalBorrowed !== undefined ? totalAssets - totalBorrowed : undefined;

  return {
    ...query,
    totalAssets,
    totalShares,
    totalBorrowed,
    available,
    shares: shares ?? 0n,
    position,
    balance: balance ?? 0n,
    allowance: allowance ?? 0n,
  };
}
