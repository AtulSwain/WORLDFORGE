"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";

/** Honours the OS reduced-motion preference for every Framer Motion animation. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * Applies the signed-in user's "reduce motion" preference on top of the OS setting:
 * disables Framer Motion transforms and (via a root data attribute) CSS animations.
 */
export function ReducedMotionPreference({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.dataset.reducedMotion = "true";
    else delete root.dataset.reducedMotion;
    return () => {
      delete root.dataset.reducedMotion;
    };
  }, [enabled]);
  return <MotionConfig reducedMotion={enabled ? "always" : "user"}>{children}</MotionConfig>;
}
