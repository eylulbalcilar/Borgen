"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";

export type AppraisalStatus = "pending" | "approved" | "rejected" | "minted";

export type Appraisal = {
  _id: string;
  asset: { title: string; description?: string; serialNumber: string };
  requestedValuation: string;
  valuation?: string;
  status: AppraisalStatus;
  neuroContractId?: string;
  tokenId?: string;
  mintTxHash?: string;
  createdAt: string;
  // Populated with the borrower's wallet address by the backend.
  borrower?: { _id: string; walletAddress: string };
};

const APPRAISALS_KEY = ["appraisals"] as const;

export function useAppraisals() {
  const { session, request } = useAuth();

  return useQuery({
    queryKey: APPRAISALS_KEY,
    enabled: Boolean(session),
    queryFn: () => request<Appraisal[]>("/appraisals"),
  });
}

export type NewAppraisalInput = {
  title: string;
  serialNumber: string;
  description?: string;
  requestedValuation: string;
};

export function useCreateAppraisal() {
  const { request } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewAppraisalInput) =>
      request<Appraisal>("/appraisals", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPRAISALS_KEY }),
  });
}

// Signs the contract as Owner and mints the collateral token.
// Slow: waits for the Neuro signature and the mint transaction.
export function useAcceptAppraisal() {
  const { request } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => request<Appraisal>(`/appraisals/${id}/accept`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPRAISALS_KEY }),
  });
}

// Creates the Neuro contract and signs it as Appraiser.
export function useApproveAppraisal() {
  const { request } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, valuation }: { id: string; valuation: string }) =>
      request<Appraisal>(`/appraisals/${id}/approve`, { method: "POST", body: { valuation } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPRAISALS_KEY }),
  });
}

export function useRejectAppraisal() {
  const { request } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => request<Appraisal>(`/appraisals/${id}/reject`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPRAISALS_KEY }),
  });
}
