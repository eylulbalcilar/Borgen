"use client";

import { useEffect } from "react";

const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 5;

/*
  Inlined in <head> so reveal blocks are hidden before the first paint. Setting
  the attribute after hydration instead would let content above the fold paint,
  then fade out and back in. It stays a script rather than server markup so that
  without JavaScript, where nothing would ever reveal them, the blocks are
  simply visible.
*/
export const revealScript = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.setAttribute("data-reveal-active","")}catch(e){}`;

/*
  Releases [data-reveal] blocks as they enter the viewport. Mounted once in the
  layout: it re-scans on DOM changes so blocks added by a route change are covered.
  Does nothing under reduced motion, where revealScript leaves the hiding
  attribute unset and the content is visible from the start.
*/
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -12% 0px" },
    );

    const tracked = new WeakSet<Element>();

    const scan = () => {
      let parent: Element | null = null;
      let index = 0;

      for (const node of document.querySelectorAll("[data-reveal]")) {
        // Siblings stagger; the count restarts in every new group.
        if (node.parentElement !== parent) {
          parent = node.parentElement;
          index = 0;
        }
        if (!tracked.has(node)) {
          tracked.add(node);
          const steps = Math.min(index, MAX_STAGGER_STEPS);
          (node as HTMLElement).style.transitionDelay = `${steps * STAGGER_MS}ms`;
          observer.observe(node);
        }
        index += 1;
      }
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
}
