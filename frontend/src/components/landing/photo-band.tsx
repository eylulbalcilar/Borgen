"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef } from "react";

// How far the picture drifts across the band as it crosses the viewport.
const DRIFT_PERCENT = 7;

/*
  Full-bleed photographic interstitial between two landing sections. The picture
  is taller than the band so it can drift, the veil settles it into whichever
  theme is active, and the top and bottom fades remove the hard edges.
*/
export function PhotoBand({ image }: { image: StaticImageData }) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = mediaRef.current;
    const band = bandRef.current;
    if (!media || !band) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const tick = () => {
      const rect = band.getBoundingClientRect();
      // 0 while the band is entering from below, 1 once it has fully left the top.
      const span = window.innerHeight + rect.height;
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / span));
      const offset = (0.5 - progress) * DRIFT_PERCENT;
      media.style.transform = `translate3d(0,${offset.toFixed(2)}%,0)`;
      frame = requestAnimationFrame(tick);
    };

    // Only animate while the band is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (!frame) frame = requestAnimationFrame(tick);
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    observer.observe(band);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={bandRef}
      aria-hidden="true"
      className="relative z-1 h-[clamp(300px,44vh,540px)] w-full overflow-hidden"
    >
      <div ref={mediaRef} className="absolute inset-x-0 -inset-y-[8%] will-change-transform">
        <Image src={image} alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[var(--band-veil)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-bg to-transparent" />
    </div>
  );
}
