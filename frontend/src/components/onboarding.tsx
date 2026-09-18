"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRegister, USER_ROLES, type UserRole } from "@/lib/user";

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  borrower: "Request a valuation and borrow against your asset.",
  appraiser: "Verify assets and sign valuations.",
  lender: "Provide liquidity and earn interest.",
};

export function Onboarding() {
  const [role, setRole] = useState<UserRole>("borrower");
  const register = useRegister();

  return (
    <section className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Choose your role</h2>
        <p className="text-sm text-muted-foreground">
          Your role is linked to your wallet and cannot be changed later.
        </p>
      </div>

      <RadioGroup
        value={role}
        onChange={(value) => setRole(value as UserRole)}
        aria-label="Role"
        isDisabled={register.isPending}
      >
        {USER_ROLES.map((option) => (
          <RadioGroupItem
            key={option}
            value={option}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-4 aspect-auto size-auto rounded-lg data-checked:bg-transparent data-selected:bg-transparent"
          >
            <span className="flex flex-col gap-1 text-left">
              <span className="text-sm font-medium capitalize text-foreground">{option}</span>
              <span className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[option]}</span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>

      <Button onPress={() => register.mutate(role)} isPending={register.isPending}>
        {register.isPending ? "Checking your Neuro identity…" : "Continue"}
      </Button>

      {register.error && (
        <p role="alert" className="text-sm text-destructive">
          {register.error.message}
        </p>
      )}
    </section>
  );
}
