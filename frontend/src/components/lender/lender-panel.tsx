"use client";

import { useAccount } from "wagmi";
import { ActivityFeed } from "@/components/activity-feed";
import { DepositForm } from "@/components/lender/deposit-form";
import { WithdrawForm } from "@/components/lender/withdraw-form";
import { Meter } from "@/components/ui/meter";
import { HeaderStat, ScreenHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { TxStatus } from "@/components/ui/status";
import { ADDRESSES, stablecoinAbi } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { usePoolData } from "@/lib/pool";
import { useTx } from "@/lib/tx";

// Mock stablecoin: anyone can mint test tokens.
const FAUCET_AMOUNT = 10_000_000_000n; // 10,000 mUSD

export function LenderPanel() {
  const { address } = useAccount();
  const pool = usePoolData();

  const refresh = () => {
    void pool.refetch();
    // Some RPCs lag one block behind the receipt; read again shortly after.
    setTimeout(() => void pool.refetch(), 1500);
  };

  const faucet = useTx(refresh);

  async function getTestTokens() {
    if (!address) return;
    faucet.clear();
    await faucet.send({
      address: ADDRESSES.stablecoin,
      abi: stablecoinAbi,
      functionName: "mint",
      args: [address, FAUCET_AMOUNT],
    });
  }

  const utilisation =
    pool.totalAssets !== undefined && pool.totalAssets > 0n && pool.totalBorrowed !== undefined
      ? Number((pool.totalBorrowed * 10_000n) / pool.totalAssets) / 100
      : 0;

  // Share of the pool the connected wallet owns.
  const share =
    pool.totalAssets !== undefined && pool.totalAssets > 0n
      ? Number((pool.position * 10_000n) / pool.totalAssets) / 100
      : 0;

  const stats = [
    { k: "Total assets", v: formatAmount(pool.totalAssets, false), note: "Pool size" },
    {
      k: "Borrowed",
      v: formatAmount(pool.totalBorrowed, false),
      note: `${utilisation.toFixed(2)}% utilisation`,
    },
    { k: "Available", v: formatAmount(pool.available, false), note: "Redeemable now" },
    {
      k: "Your position",
      v: formatAmount(pool.position, false),
      note: `${share.toFixed(2)}% of pool`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-24 pt-11">
      <ScreenHeader
        eyebrow="( 0.5 ) Lender"
        title="Pool position"
        aside={
          <dl className="text-right">
            <HeaderStat label="Wallet balance" value={formatAmount(pool.balance, false)} />
          </dl>
        }
      />

      <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-px overflow-hidden rounded-[24px] border border-glass-border bg-glass-border">
        {stats.map((stat) => (
          <div key={stat.k} className="bg-glass p-[26px]">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{stat.k}</dt>
            <dd className="mt-3.5 font-mono text-[28px] text-text">{stat.v}</dd>
            <dd className="mt-2 font-mono text-[11px] text-dim">{stat.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <Meter value={utilisation} label="Utilisation" />
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-6">
        <DepositForm balance={pool.balance} allowance={pool.allowance} onSuccess={refresh} />
        <WithdrawForm
          shares={pool.shares}
          position={pool.position}
          available={pool.available}
          onSuccess={refresh}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <PillButton variant="outline" size="sm" onPress={getTestTokens} isPending={faucet.isBusy}>
          {faucet.isBusy ? "Minting…" : "Get test tokens"}
        </PillButton>
        <span className="font-mono text-[11px] text-dim">Base Sepolia testnet faucet</span>
      </div>
      <div className="mt-3 max-w-md">
        <TxStatus status={faucet.status} error={faucet.error} />
      </div>

      <div className="mt-12">
        <ActivityFeed />
      </div>
    </div>
  );
}
