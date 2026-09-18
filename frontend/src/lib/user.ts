"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { useAuth } from "./auth";

export const USER_ROLES = ["borrower", "appraiser", "lender"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = {
  _id: string;
  walletAddress: string;
  role: UserRole;
  neuroLegalId?: string;
  identityState?: string;
  identityValidTo?: string;
};

// The query key includes the wallet, so each account has its own cache entry.
function userKey(wallet: string | undefined) {
  return ["user", wallet?.toLowerCase()] as const;
}

// Returns the registered user, or null when the wallet is not registered yet.
export function useCurrentUser() {
  const { session, request } = useAuth();

  return useQuery({
    queryKey: userKey(session?.wallet),
    enabled: Boolean(session),
    queryFn: async () => {
      try {
        return await request<User>("/users/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useRegister() {
  const { session, request } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (role: UserRole) => request<User>("/users", { method: "POST", body: { role } }),
    // Put the new user straight into the cache; the UI switches to the panel.
    onSuccess: (user) => queryClient.setQueryData(userKey(session?.wallet), user),
  });
}
