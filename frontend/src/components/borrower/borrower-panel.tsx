"use client";

import { useAccount } from "wagmi";
import { ActivityFeed } from "@/components/activity-feed";
import { CollateralCard } from "@/components/borrower/collateral-card";
import { RequestForm } from "@/components/borrower/request-form";
import { RequestList } from "@/components/borrower/request-list";
import { EmptyState, HeaderStat, ScreenHeader } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { TxStatus } from "@/components/ui/status";
import { useAppraisals } from "@/lib/appraisals";
import { useCollateral } from "@/lib/collateral";
import { ADDRESSES, stablecoinAbi } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { usePoolData } from "@/lib/pool";
import { useTx } from "@/lib/tx";

const FAUCET_AMOUNT = 10_000_000_000n; // 10,000 mUSD

export function BorrowerPanel() {
  const { address } = useAccount();
  const appraisals = useAppraisals();
  const pool = usePoolData();

  // Minted requests are the borrower's collateral tokens.
  const minted = (appraisals.data ?? []).filter((item) => item.status === "minted" && item.tokenId);
  const tokenIds = minted.map((item) => BigInt(item.tokenId as string));
  const collateral = useCollateral(tokenIds);

  const totalDebt = collateral.items.reduce((sum, item) => sum + item.debt, 0n);

  const refresh = () => {
    void pool.refetch();
    void collateral.refetch();
    void appraisals.refetch();
    setTimeout(() => {
      void pool.refetch();
      void collateral.refetch();
    }, 1500);
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

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-24 pt-11">
      <ScreenHeader
        eyebrow="( 0.3 ) Borrower"
        title="Your collateral"
        aside={
          <dl className="flex flex-wrap gap-9">
            <HeaderStat label="Wallet balance" value={formatAmount(pool.balance, false)} />
            <HeaderStat label="Pool liquidity" value={formatAmount(pool.available, false)} />
            <HeaderStat label="Total debt" value={formatAmount(totalDebt, false)} />
          </dl>
        }
      />

      <section aria-labelledby="collateral-heading" className="mt-8">
        <h2 id="collateral-heading" className="sr-only">
          Collateral tokens
        </h2>

        {tokenIds.length === 0 ? (
          <EmptyState title="No collateral yet">
            A signed valuation becomes a collateral token. Submit an asset below and accept the
            appraiser&apos;s figure to issue one.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] gap-6">
            {minted.map((item, index) => (
              <CollateralCard
                key={item._id}
                item={collateral.items[index]!}
                title={item.asset.title}
                allowance={pool.allowance}
                wallet={address}
                onSuccess={refresh}
              />
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <PillButton variant="outline" size="sm" onPress={getTestTokens} isPending={faucet.isBusy}>
            {faucet.isBusy ? "Minting…" : "Get test tokens"}
          </PillButton>
          <span className="font-mono text-[11px] text-dim">Base Sepolia testnet faucet</span>
        </div>
        <div className="mt-3 max-w-md">
          <TxStatus status={faucet.status} error={faucet.error} />
        </div>
      </section>

      <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-start gap-6">
        <RequestForm />
        <RequestList />
      </div>

      <div className="mt-12">
        <ActivityFeed />
      </div>
    </div>
  );
}
