"use client";

import { useAccount } from "wagmi";
import { DepositForm } from "@/components/lender/deposit-form";
import { WithdrawForm } from "@/components/lender/withdraw-form";
import { Button } from "@/components/ui/button";
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
    await faucet.send({
      address: ADDRESSES.stablecoin,
      abi: stablecoinAbi,
      functionName: "mint",
      args: [address, FAUCET_AMOUNT],
    });
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <section aria-labelledby="pool-heading" className="flex flex-col gap-3">
        <h2 id="pool-heading" className="text-lg font-medium">
          Pool
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Total assets</dt>
            <dd className="text-lg">{formatAmount(pool.totalAssets)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Borrowed</dt>
            <dd className="text-lg">{formatAmount(pool.totalBorrowed)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Available</dt>
            <dd className="text-lg">{formatAmount(pool.available)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="position-heading" className="flex flex-col gap-3">
        <h2 id="position-heading" className="text-lg font-medium">
          Your position
        </h2>
        <p className="text-lg">{formatAmount(pool.position)}</p>
        <p className="text-sm text-muted-foreground">
          Wallet balance: {formatAmount(pool.balance)}
        </p>
        <div>
          <Button variant="outline" size="sm" onPress={getTestTokens} isPending={faucet.isBusy}>
            {faucet.isBusy ? "Minting…" : "Get test tokens"}
          </Button>
        </div>        {faucet.error && (
          <p role="alert" className="text-sm text-destructive">
            {faucet.error}
          </p>
        )}
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <DepositForm balance={pool.balance} allowance={pool.allowance} onSuccess={refresh} />
        <WithdrawForm
          shares={pool.shares}
          position={pool.position}
          available={pool.available}
          onSuccess={refresh}
        />
      </div>
    </div>
  );
}
