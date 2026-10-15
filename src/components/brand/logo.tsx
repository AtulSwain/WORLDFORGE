import Link from "next/link";
import { cn } from "@/lib/utils";

export function Sigil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.35" />
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeOpacity="0.6" />
      <path d="M16 3.5v25M3.5 16h25" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M16 8.5 21 16l-5 7.5L11 16z" fill="currentColor" />
      <circle cx="16" cy="16" r="1.6" fill="#101116" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 text-gold", className)} aria-label="WorldForge home">
      <Sigil className="transition-transform duration-500 group-hover:rotate-45" />
      <span className="font-serif text-xl font-semibold tracking-wide text-text">WorldForge</span>
    </Link>
  );
}
