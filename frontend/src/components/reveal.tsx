"use client";

import { useEffect } from "react";

const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 5;

/*
  Releases [data-reveal] blocks as they enter the viewport. Mounted once in the
  layout: it re-scans on DOM changes so blocks added by a route change are covered.
  Does nothing under reduced motion, which also leaves the content visible because
  globals.css only hides while data-reveal-active is set.
*/
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    root.setAttribute("data-reveal-active", "");

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
      root.removeAttribute("data-reveal-active");
    };
  }, []);

  return null;
}
