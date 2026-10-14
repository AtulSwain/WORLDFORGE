"use client";

import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <div className="md:hidden">
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <MenuIcon />
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          {items.map((i) => (
            <MenuItem key={i.href} asChild>
              <Link href={i.href}>{i.label}</Link>
            </MenuItem>
          ))}
          <MenuItem asChild>
            <Link href="/login">Sign in</Link>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
