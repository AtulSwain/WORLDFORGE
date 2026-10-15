"use client";

import Link from "next/link";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

export function UniverseSwitcher({ current, universes }: { current: { id: string; name: string } | null; universes: { id: string; name: string; role: string }[] }) {
  return (
    <Menu>
      <MenuTrigger className="flex max-w-[11rem] items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-text hover:bg-surface-2 sm:max-w-[15rem]">
        <span className="truncate">{current?.name ?? "All worlds"}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" />
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Switch universe</MenuLabel>
        {universes.map((u) => (
          <MenuItem key={u.id} asChild>
            <Link href={`/worlds/${u.id}`}>
              <span className="flex-1 truncate">{u.name}</span>
              {u.id === current?.id ? <Check className="text-gold" /> : <span className="text-2xs uppercase text-muted">{u.role.toLowerCase()}</span>}
            </Link>
          </MenuItem>
        ))}
        {universes.length === 0 ? <div className="px-2 py-1.5 text-sm text-muted">No universes yet</div> : null}
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/dashboard">All worlds</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/worlds/new">
            <Plus /> New universe
          </Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
