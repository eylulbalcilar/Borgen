"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import heroPhoto from "./hero.jpg";

// Rest state: the backdrop sits zoomed in and drifts out as the page scrolls.
const REST_TRANSFORM = "translate3d(0%,0%,0) scale(1.16)";

/*
  Scroll parallax for the hero backdrop, matching borgen-scene.js: the scroll
  position is eased towards, and a slow sine drift keeps the frame alive.
*/
export function HeroMedia() {
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target = 0;
    let eased = 0;
    let frame = 0;

    const step = (rate: number) => {
      eased += (target - eased) * rate;
      const time = Date.now() / 1000;
      const scale = 1.16 - eased * 0.14 + Math.sin(time * 0.18) * 0.005;
      const y = eased * 16 + Math.sin(time * 0.13) * 0.7;
      const x = Math.sin(time * 0.09) * 0.8;
      media.style.transform = `translate3d(${x.toFixed(3)}%,${y.toFixed(2)}%,0) scale(${scale.toFixed(4)})`;
    };

    const readScroll = () => {
      const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
      target = Math.min(1, Math.max(0, window.scrollY / max));
      // Scrolling catches up fast; the idle frame loop eases in more slowly.
      step(0.4);
    };

    const tick = () => {
      step(0.12);
      frame = requestAnimationFrame(tick);
    };

    readScroll();
    frame = requestAnimationFrame(tick);
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", readScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", readScroll);
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        ref={mediaRef}
        className="absolute inset-x-0 top-0 h-[140%] origin-[50%_40%] will-change-transform"
        style={{ transform: REST_TRANSFORM }}
      >
        <Image
          src={heroPhoto}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
