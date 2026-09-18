"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";

export type ActivityType =
  | "user_registered"
  | "appraisal_requested"
  | "appraisal_approved"
  | "appraisal_rejected"
  | "nft_minted"
  | "deposited"
  | "withdrawn"
  | "borrowed"
  | "repaid"
  | "liquidated";

export type Activity = {
  _id: string;
  type: ActivityType;
  wallet?: string;
  tokenId?: string;
  txHash?: string;
  // Amounts are integer strings in the smallest unit; other keys vary by type.
  metadata?: Record<string, string>;
  createdAt: string;
};

export function useActivity() {
  const { session, request } = useAuth();

  return useQuery({
    queryKey: ["activity", session?.wallet],
    enabled: Boolean(session),
    queryFn: () => request<Activity[]>("/activity"),
    // Chain events are indexed in the background, so poll while the page is open.
    refetchInterval: 15_000,
  });
}
