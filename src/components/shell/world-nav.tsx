"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu as MenuIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { PRIMARY_NAV, RAIL_NAV, isActive } from "./nav-config";

export function PrimaryNav({ worldId }: { worldId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="World navigation" className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 md:flex">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(pathname, worldId, item);
        return (
          <Link
            key={item.label}
            href={item.href(worldId)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              active ? "text-gold" : "text-text-2 hover:bg-surface-2 hover:text-text",
            )}
          >
            {item.label}
            {active ? <motion.span layoutId="nav-underline" className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded bg-gold" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ToolRail({ worldId }: { worldId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="World tools" className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-2 py-3 md:flex">
      {RAIL_NAV.map((item, i) => {
        const active = isActive(pathname, worldId, item);
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn(i === RAIL_NAV.length - 1 && "mt-auto", i === 6 && "mt-2 border-t border-border pt-2")}>
            <Tooltip content={item.label} side="right">
              <Link
                href={item.href(worldId)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-gold/10 text-gold" : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon className="size-[18px]" />
              </Link>
            </Tooltip>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileWorldNav({ worldId }: { worldId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = [RAIL_NAV[0]!, ...PRIMARY_NAV, ...RAIL_NAV.slice(3)];
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon-sm" aria-label="Open world menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
      </Button>
      <AnimatePresence>
        {open ? (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.nav
              aria-label="World navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1 overflow-y-auto border-r border-border bg-bg-2 p-3"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="wf-eyebrow">Navigate</span>
                <Button variant="ghost" size="icon-sm" aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X />
                </Button>
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, worldId, item);
                return (
                  <Link
                    key={item.label}
                    href={item.href(worldId)}
                    onClick={() => setOpen(false)}
                    className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm", active ? "bg-gold/10 text-gold" : "text-text-2 hover:bg-surface-2")}
                  >
                    <Icon className="size-4" /> {item.label}
                  </Link>
                );
              })}
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
