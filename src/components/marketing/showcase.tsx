"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ShowcaseTab {
  id: string;
  label: string;
  title: string;
  body: string;
  preview: React.ReactNode;
}

/** Interactive feature showcase: tabs swap real product previews. */
export function Showcase({ tabs }: { tabs: ShowcaseTab[] }) {
  const [active, setActive] = useState(tabs[0]!.id);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]!;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
      <div role="tablist" aria-label="Feature showcase" className="flex flex-col gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              t.id === active ? "border-gold/50 bg-surface" : "border-transparent hover:border-border hover:bg-surface/60",
            )}
          >
            <div className={cn("text-sm font-medium", t.id === active ? "text-gold" : "text-text")}>{t.label}</div>
            <div className={cn("mt-1 text-sm text-text-2", t.id === active ? "block" : "hidden lg:block")}>{t.title}</div>
          </button>
        ))}
      </div>
      <div className="relative min-h-[360px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab.preview}
            <p className="mt-4 text-sm text-text-2">{tab.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
