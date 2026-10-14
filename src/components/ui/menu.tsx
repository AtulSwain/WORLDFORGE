"use client";

import { DropdownMenu as M, Tooltip as T, Popover as P, Tabs as Tb } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSeparator = ({ className }: { className?: string }) => <M.Separator className={cn("my-1 h-px bg-border", className)} />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <M.Label className="px-2 py-1.5 text-2xs uppercase tracking-wider text-muted">{children}</M.Label>;

export function MenuContent({ className, ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={6}
        className={cn("z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-pop data-[state=open]:animate-fade-in", className)}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: M.DropdownMenuItemProps) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-text data-[disabled]:opacity-50 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text shadow-pop">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, ...props }: P.PopoverContentProps) {
  return (
    <P.Portal>
      <P.Content sideOffset={6} className={cn("z-50 rounded-lg border border-border bg-surface p-3 shadow-pop data-[state=open]:animate-fade-in", className)} {...props} />
    </P.Portal>
  );
}

export const Tabs = Tb.Root;
export function TabsList({ className, ...props }: Tb.TabsListProps) {
  return <Tb.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: Tb.TabsTriggerProps) {
  return (
    <Tb.Trigger
      className={cn(
        "relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-text-2 transition-colors hover:text-text data-[state=active]:border-gold data-[state=active]:text-text",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = Tb.Content;
