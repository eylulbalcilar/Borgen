// Health bar. Fill colour follows the loan: bone below 60%, gold to 80%,
// red past the 80% liquidation threshold.
export function Meter({
  value,
  label,
  note,
  thin = false,
}: {
  value: number;
  label: string;
  note?: string;
  thin?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const fill = clamped > 80 ? "bg-danger" : clamped >= 60 ? "bg-seal-text" : "bg-fill";

  return (
    <div className="grid gap-2.5">
      <div
        role="meter"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={`relative overflow-hidden rounded-pill bg-track ${thin ? "h-[5px]" : "h-1.5"}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-pill transition-[width] duration-700 ${fill}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-dim">
        <span>{label}</span>
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}
