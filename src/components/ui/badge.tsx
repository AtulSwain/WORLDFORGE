import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-border bg-surface-2 text-text-2",
      gold: "border-gold/40 bg-gold/10 text-gold",
      violet: "border-violet/40 bg-violet/10 text-[#b9afdc]",
      success: "border-success/40 bg-success/10 text-[#a9cfa5]",
      warning: "border-warning/40 bg-warning/10 text-[#e2c58c]",
      danger: "border-danger/40 bg-danger/10 text-[#e7a3a3]",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function CanonBadge({ status }: { status: string }) {
  if (status === "CANON") return null;
  const tone = status === "DISPUTED" ? "warning" : status === "DRAFT" ? "violet" : "danger";
  return <Badge tone={tone}>{status.replace("_", " ").toLowerCase()}</Badge>;
}
