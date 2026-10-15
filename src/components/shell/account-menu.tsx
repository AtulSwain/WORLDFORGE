"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Avatar } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

export function AccountMenu({ name, email }: { name: string; email: string }) {
  return (
    <Menu>
      <MenuTrigger className="rounded-full" aria-label="Account menu">
        <Avatar name={name} size={30} />
      </MenuTrigger>
      <MenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted">{email}</div>
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings/profile"><User /> Profile</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings/account"><Settings /> Account & preferences</Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void logoutAction()}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
