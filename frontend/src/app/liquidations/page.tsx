import { LiquidationsPanel } from "@/components/liquidations/liquidations-panel";

export default function LiquidationsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold">Liquidations</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Anyone can repay an unhealthy loan and take over its collateral.
      </p>
      <LiquidationsPanel />
    </div>
  );
}
