export function BorgenMark({ size = 24, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" role="img" aria-label="Borgen" {...props}>
      <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth="2.4" />
      <rect x="1.6" y="1.6" width="5.6" height="5.6" fill="currentColor" />
      <rect x="16.8" y="1.6" width="5.6" height="5.6" fill="currentColor" />
      <rect x="1.6" y="16.8" width="5.6" height="5.6" fill="currentColor" />
      <rect x="16.8" y="16.8" width="5.6" height="5.6" fill="currentColor" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" />
    </svg>
  );
}
