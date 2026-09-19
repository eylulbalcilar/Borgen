"use client";

import { useReadContracts } from "wagmi";
import { ADDRESSES, BPS, collateralNftAbi, loanAbi, LTV_BPS } from "./contracts";

export type Collateral = {
  tokenId: bigint;
  valuation: bigint;
  maxBorrow: bigint;
  principal: bigint;
  debt: bigint;
  dueAt: number;
  hasLoan: boolean;
  // On-chain holder, and the borrower recorded on the loan once escrowed.
  // The wallet must match one of them or every action reverts.
  owner: string;
  loanBorrower: string;
  // True while the pool holds the token as collateral.
  isEscrowed: boolean;
  isApproved: boolean;
};

// Reads valuation, loan and approval state for each token in one batch.
export function useCollateral(tokenIds: bigint[]) {
  const query = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getAppraisal", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "ownerOf", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getApproved", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "loans", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "debtOf", args: [tokenId] },
    ] as const),
    blockTag: "latest",
    query: { enabled: tokenIds.length > 0, refetchInterval: 5000 },
  });

  const items: Collateral[] = tokenIds.map((tokenId, index) => {
    const slice = (query.data ?? []).slice(index * 5, index * 5 + 5);
    const value = <T,>(position: number): T | undefined => {
      const item = slice[position];
      return item?.status === "success" ? (item.result as T) : undefined;
    };

    const appraisal = value<{ valuation: bigint }>(0);
    const owner = value<string>(1);
    const approved = value<string>(2);
    // debtOf reverts when there is no loan, so a failed read means "no debt".
    const loan = value<readonly [string, bigint, number, number]>(3);
    const debt = value<bigint>(4) ?? 0n;

    const valuation = appraisal?.valuation ?? 0n;
    const principal = loan?.[1] ?? 0n;

    return {
      tokenId,
      valuation,
      maxBorrow: (valuation * LTV_BPS) / BPS,
      principal,
      debt,
      dueAt: Number(loan?.[3] ?? 0),
      hasLoan: principal > 0n,
      owner: owner ?? "",
      loanBorrower: loan?.[0] ?? "",
      isEscrowed: owner?.toLowerCase() === ADDRESSES.lendingPool.toLowerCase(),
      isApproved: approved?.toLowerCase() === ADDRESSES.lendingPool.toLowerCase(),
    };
  });

  return { ...query, items };
}

// Scans the first N token ids for liquidatable loans.
// Enough for the MVP; a production version would index Borrowed events instead.
export function useLiquidatable(maxTokenId = 20) {
  const tokenIds = Array.from({ length: maxTokenId }, (_, index) => BigInt(index + 1));

  const query = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "loans", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "debtOf", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "isLiquidatable", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getAppraisal", args: [tokenId] },
    ] as const),
    blockTag: "latest",
    query: { refetchInterval: 10_000 },
  });

  const positions = tokenIds
    .map((tokenId, index) => {
      const slice = (query.data ?? []).slice(index * 4, index * 4 + 4);
      const value = <T,>(position: number): T | undefined => {
        const item = slice[position];
        return item?.status === "success" ? (item.result as T) : undefined;
      };

      const loan = value<readonly [string, bigint, number, number]>(0);
      const appraisal = value<{ valuation: bigint }>(3);

      return {
        tokenId,
        borrower: loan?.[0] ?? "",
        principal: loan?.[1] ?? 0n,
        dueAt: Number(loan?.[3] ?? 0),
        debt: value<bigint>(1) ?? 0n,
        isLiquidatable: value<boolean>(2) ?? false,
        valuation: appraisal?.valuation ?? 0n,
      };
    })
    // Only positions with an active loan matter.
    .filter((item) => item.principal > 0n);

  return { ...query, positions };
}
