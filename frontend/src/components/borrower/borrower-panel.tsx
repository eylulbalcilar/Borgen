"use client";

import { useAccount } from "wagmi";
import { ActivitySection } from "@/components/activity-section";
import { CollateralCard } from "@/components/borrower/collateral-card";
import { RequestForm } from "@/components/borrower/request-form";
import { RequestList } from "@/components/borrower/request-list";
import { Button } from "@/components/ui/button";
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
    <div className="flex w-full flex-col gap-10">
      <section aria-labelledby="collateral-heading" className="flex flex-col gap-4">
        <h2 id="collateral-heading" className="text-lg font-medium">
          Your collateral
        </h2>
        <p className="text-sm text-muted-foreground">
          Wallet balance: {formatAmount(pool.balance)} · Pool liquidity: {formatAmount(pool.available)}
        </p>

        {tokenIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collateral tokens yet. Accept a valuation to issue one.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {minted.map((item, index) => (
              <CollateralCard
                key={item._id}
                item={collateral.items[index]!}
                title={item.asset.title}
                allowance={pool.allowance}
                onSuccess={refresh}
              />
            ))}
          </ul>
        )}

        <div>
          <Button variant="outline" size="sm" onPress={getTestTokens} isPending={faucet.isBusy}>
            {faucet.isBusy ? "Minting…" : "Get test tokens"}
          </Button>
        </div>
        {faucet.error && (
          <p role="alert" className="text-sm text-destructive">
            {faucet.error}
          </p>
        )}
      </section>

      <RequestForm />

      <section aria-labelledby="requests-heading" className="flex flex-col gap-4">
        <h2 id="requests-heading" className="text-lg font-medium">
          Your requests
        </h2>
        <RequestList />
      </section>
      <ActivitySection />

    </div>
  );
}
