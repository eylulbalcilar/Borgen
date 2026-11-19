"use client";

import { useReadContracts } from "wagmi";
import { ADDRESSES, collateralNftAbi, loanAbi } from "./contracts";

// Field order of the loans() and auctions() getters on the pool.
type LoanTuple = readonly [string, bigint, bigint, bigint, bigint, number, number, bigint];
type AuctionTuple = readonly [string, bigint, number, bigint, bigint];

export type Collateral = {
  tokenId: bigint;
  valuation: bigint;
  maxBorrow: bigint;
  principal: bigint;
  debt: bigint;
  dueAt: number;
  hasLoan: boolean;
  // True once the collateral has been put up for sale.
  inAuction: boolean;
  // On-chain holder, and the borrower recorded on the loan once escrowed.
  // The wallet must match one of them or every action reverts.
  owner: string;
  loanBorrower: string;
  // True while the pool holds the token as collateral.
  isEscrowed: boolean;
  isApproved: boolean;
};

const READS_PER_TOKEN = 7;

// Reads valuation, loan and approval state for each token in one batch.
export function useCollateral(tokenIds: bigint[]) {
  const query = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getAppraisal", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "ownerOf", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getApproved", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "loans", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "debtOf", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "maxBorrow", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "auctions", args: [tokenId] },
    ] as const),
    blockTag: "latest",
    query: { enabled: tokenIds.length > 0, refetchInterval: 5000 },
  });

  const items: Collateral[] = tokenIds.map((tokenId, index) => {
    const slice = (query.data ?? []).slice(index * READS_PER_TOKEN, (index + 1) * READS_PER_TOKEN);
    const value = <T,>(position: number): T | undefined => {
      const item = slice[position];
      return item?.status === "success" ? (item.result as T) : undefined;
    };

    const appraisal = value<{ valuation: bigint }>(0);
    const owner = value<string>(1);
    const approved = value<string>(2);
    // debtOf reverts when there is no loan, so a failed read means "no debt".
    const loan = value<LoanTuple>(3);
    const debt = value<bigint>(4) ?? 0n;
    const auction = value<AuctionTuple>(6);

    const principal = loan?.[1] ?? 0n;

    return {
      tokenId,
      valuation: appraisal?.valuation ?? 0n,
      // The pool applies the terms of the asset's own class.
      maxBorrow: value<bigint>(5) ?? 0n,
      principal,
      debt,
      dueAt: Number(loan?.[3] ?? 0),
      hasLoan: principal > 0n,
      inAuction: (auction?.[1] ?? 0n) > 0n,
      owner: owner ?? "",
      loanBorrower: loan?.[0] ?? "",
      isEscrowed: owner?.toLowerCase() === ADDRESSES.lendingPool.toLowerCase(),
      isApproved: approved?.toLowerCase() === ADDRESSES.lendingPool.toLowerCase(),
    };
  });

  return { ...query, items };
}

const READS_PER_POSITION = 6;

// Scans the first N token ids for open loans.
// Enough for the MVP; a production version would index Borrowed events instead.
export function useLiquidatable(maxTokenId = 20) {
  const tokenIds = Array.from({ length: maxTokenId }, (_, index) => BigInt(index + 1));

  const query = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "loans", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "debtOf", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "isLiquidatable", args: [tokenId] },
      { address: ADDRESSES.collateralNft, abi: collateralNftAbi, functionName: "getAppraisal", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "auctions", args: [tokenId] },
      { address: ADDRESSES.lendingPool, abi: loanAbi, functionName: "auctionPrice", args: [tokenId] },
    ] as const),
    blockTag: "latest",
    query: { refetchInterval: 10_000 },
  });

  const positions = tokenIds
    .map((tokenId, index) => {
      const slice = (query.data ?? []).slice(index * READS_PER_POSITION, (index + 1) * READS_PER_POSITION);
      const value = <T,>(position: number): T | undefined => {
        const item = slice[position];
        return item?.status === "success" ? (item.result as T) : undefined;
      };

      const loan = value<LoanTuple>(0);
      const appraisal = value<{ valuation: bigint }>(3);
      const auction = value<AuctionTuple>(4);

      return {
        tokenId,
        borrower: loan?.[0] ?? "",
        principal: loan?.[1] ?? 0n,
        dueAt: Number(loan?.[3] ?? 0),
        debt: value<bigint>(1) ?? 0n,
        isLiquidatable: value<boolean>(2) ?? false,
        valuation: appraisal?.valuation ?? 0n,
        inAuction: (auction?.[1] ?? 0n) > 0n,
        // auctionPrice reverts when there is no sale, so a failed read means none.
        price: value<bigint>(5) ?? 0n,
        floorPrice: auction?.[4] ?? 0n,
      };
    })
    // Only positions with an active loan matter.
    .filter((item) => item.principal > 0n);

  return { ...query, positions };
}
