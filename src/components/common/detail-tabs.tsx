"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";

export interface DetailTab {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

/** Tabbed record layout; the active tab is reflected in the URL hash so links and reloads keep it. */
export function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]!.id);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === h)) setActive(h);
  }, [tabs]);
  return (
    <Tabs
      value={active}
      onValueChange={(v) => {
        setActive(v);
        history.replaceState(null, "", `#${v}`);
      }}
    >
      <TabsList aria-label="Record sections">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
            {t.count != null ? <span className="ml-1.5 rounded bg-surface-2 px-1 text-2xs text-muted">{t.count}</span> : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="pt-5 focus:outline-none">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
