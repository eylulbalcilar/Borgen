"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { Badge, type Tone } from "@/components/ui/status";
import { PillButton } from "@/components/ui/pill-button";
import { useAuth } from "@/lib/auth";
import { useCurrentUser, useRegister, USER_ROLES, type UserRole } from "@/lib/user";

const ROLE_COPY: Record<UserRole, { title: string; body: string }> = {
  borrower: {
    title: "Borrower",
    body: "Own the asset, hold the token, draw credit against it without giving up possession.",
  },
  appraiser: {
    title: "Appraiser",
    body: "Credentialed on Neuro. Counter-sign valuations and keep them current as markets move.",
  },
  lender: {
    title: "Lender",
    body: "Supply mUSD to the shared pool and earn the interest borrowers pay on real collateral.",
  },
};

type StepState = "locked" | "pending" | "done";

const STATE_LABEL: Record<StepState, string> = { locked: "Locked", pending: "Pending", done: "Done" };
const STATE_TONE: Record<StepState, Tone> = { locked: "neutral", pending: "seal", done: "verify" };

// Entry point: connect a wallet, which opens the session on its own, then pick
// a seat. There is no separate sign-in step for the visitor to perform.
export function AppShell() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { status, error, signIn } = useAuth();
  const user = useCurrentUser();
  const register = useRegister();

  const [role, setRole] = useState<UserRole | null>(null);

  const registeredRole = user.data?.role;
  const signedIn = status === "signed-in";

  // A registered address skips the seat choice and goes straight to its panel.
  useEffect(() => {
    if (registeredRole) router.replace(`/${registeredRole}`);
  }, [registeredRole, router]);

  const walletState: StepState = signedIn ? "done" : "pending";
  const roleState: StepState = registeredRole || role ? "done" : signedIn ? "pending" : "locked";

  const hint = !isConnected
    ? "Connect a wallet to continue"
    : !signedIn
      ? "Confirm the session message in your wallet"
      : role
        ? `Continuing as ${role}`
        : "Pick a role to continue";

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-26 pt-18">
      <div className="mx-auto max-w-[620px]">
        <p className="mb-[18px] font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          ( 0.2 ) Get started
        </p>
        <h1 className="mb-3.5 font-serif text-[40px] font-semibold leading-[1.12] tracking-[-0.012em] text-text">
          Connect a wallet, then pick a seat.
        </h1>
        <p className="mb-10 text-base leading-[1.7]">
          Borgen never takes custody of a key. Connecting asks your wallet for one plain message,
          with no transaction and no gas.
        </p>

        <ol className="glass overflow-hidden rounded-card">
          <Step
            num="01"
            title="Connect a wallet"
            state={walletState}
            stateLabel={signedIn ? "Connected" : isConnected ? "Confirm in wallet" : "Required"}
            body="RainbowKit opens the standard connector list. Borgen reads the address, then asks for one plain signature that opens the session. Revocable at any time by disconnecting."
          >
            {!isConnected && (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <PillButton isDisabled={!mounted} onPress={openConnectModal}>
                    Connect wallet
                  </PillButton>
                )}
              </ConnectButton.Custom>
            )}

            {isConnected && !signedIn && (
              <div className="grid gap-3">
                <PillButton
                  isDisabled={status === "signing-in"}
                  isPending={status === "signing-in"}
                  onPress={() => void signIn()}
                >
                  {status === "signing-in" ? "Check your wallet" : "Confirm wallet"}
                </PillButton>
                {error && (
                  <p role="alert" className="font-mono text-[11.5px] text-danger-text">
                    {error}
                  </p>
                )}
              </div>
            )}
          </Step>

          <Step
            num="02"
            title="Choose your role"
            state={roleState}
            stateLabel={role ? "Selected" : signedIn ? "Pending" : "Locked"}
            body="First-time addresses pick a seat. Registered addresses skip straight to their panel."
          >
            {signedIn && user.isSuccess && user.data === null && (
              <fieldset className="grid gap-px border-0 p-0">
                <legend className="sr-only">Role</legend>
                {USER_ROLES.map((option) => {
                  const selected = role === option;
                  return (
                    <label
                      key={option}
                      className={`grid cursor-pointer grid-cols-[20px_1fr] items-start gap-3.5 rounded-field p-4 transition-colors ${
                        selected ? "bg-surface-2" : "bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option}
                        checked={selected}
                        disabled={register.isPending}
                        onChange={() => setRole(option)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-[3px] flex size-[15px] items-center justify-center border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-seal ${
                          selected ? "border-seal" : "border-line-strong"
                        }`}
                      >
                        <span className={`block size-[7px] ${selected ? "bg-seal" : "bg-transparent"}`} />
                      </span>
                      <span className="grid gap-1.5">
                        <span className="text-[15px] font-semibold text-text">
                          {ROLE_COPY[option].title}
                        </span>
                        <span className="text-[13.5px] leading-[1.6] text-body">
                          {ROLE_COPY[option].body}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </Step>

          <li className="flex flex-wrap items-center justify-between gap-5 px-7 py-[22px]">
            <p className="font-mono text-[11.5px] text-dim">{hint}</p>
            <PillButton
              isDisabled={!role || register.isPending}
              isPending={register.isPending}
              onPress={() => role && register.mutate(role)}
            >
              {register.isPending ? "Checking your Neuro identity…" : "Continue to panel"}
            </PillButton>
          </li>
        </ol>

        {(register.error ?? user.error) && (
          <p role="alert" className="mt-5 rounded-field border border-danger px-4 py-3 text-[13.5px] text-danger-text">
            {(register.error ?? user.error)?.message}
          </p>
        )}

        <div className="mt-5 grid grid-cols-[auto_1fr] items-start gap-3 rounded-field border border-seal-border bg-seal-bg px-[18px] py-4">
          <span aria-hidden="true" className="mt-1.5 block size-[7px] bg-seal" />
          <p className="text-[13.5px] leading-[1.65] text-seal-text">
            Appraiser seats are credential-gated. Selecting Appraiser opens a verification queue.
            You can browse the protocol meanwhile, but you cannot sign valuations until the
            credential clears.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  num,
  title,
  state,
  stateLabel,
  body,
  children,
}: {
  num: string;
  title: string;
  state: StepState;
  stateLabel: string;
  body: string;
  children?: ReactNode;
}) {
  const locked = state === "locked";
  return (
    <li className="grid grid-cols-[44px_1fr] items-start gap-5 border-b border-glass-border px-7 py-[26px]">
      <span
        className={`pt-[3px] font-mono text-[11px] tracking-[0.08em] ${locked ? "text-dim" : "text-seal-text"}`}
      >
        {num}
      </span>
      <div className="grid gap-3.5">
        <div className="flex items-center justify-between gap-4">
          <h2 className={`text-base font-semibold ${locked ? "text-dim" : "text-text"}`}>{title}</h2>
          <Badge tone={STATE_TONE[state]}>
            <span className="sr-only">{STATE_LABEL[state]}: </span>
            {stateLabel}
          </Badge>
        </div>
        <p className="text-[14.5px] leading-[1.65]">{body}</p>
        {/* Wrapped so an inline-flex button keeps its natural width in the grid. */}
        {children && <div>{children}</div>}
      </div>
    </li>
  );
}
