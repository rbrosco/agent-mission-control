"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * Shared entrance stagger for card grids across the dashboard.
 *
 * Follows the ui-ux-pro-max "Stagger List (Standard)" preset: opacity+scale+y
 * from a slightly-below-final state, back.out(1.4) easing, ~0.06s stagger.
 * Respects prefers-reduced-motion (skips the tween, renders final state
 * immediately) and cleans up on unmount via useGSAP's built-in scope/revert
 * — no manual useEffect + tween.kill() bookkeeping needed.
 *
 * Usage: const ref = useStaggerReveal(); <div ref={ref}>...<div class="stagger-item">...
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  selector: string = ".stagger-item",
  deps: unknown[] = []
) {
  const scope = useRef<T>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const items = scope.current?.querySelectorAll(selector);
      if (!items || items.length === 0) return;

      if (reduced) {
        gsap.set(items, { opacity: 1, scale: 1, y: 0 });
        return;
      }

      gsap.from(items, {
        opacity: 0,
        scale: 0.92,
        y: 16,
        duration: 0.4,
        stagger: { each: 0.06, from: "start" },
        ease: "back.out(1.4)",
      });
    },
    { scope, dependencies: deps }
  );

  return scope;
}
