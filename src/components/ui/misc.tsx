import Link from "next/link";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-3 text-gold-dim [&_svg]:size-7">{icon}</div> : null}
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-text-2">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="wf-eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-text-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-serif font-semibold text-gold", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user assets are served from our own authenticated route
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function StatTile({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <div className="font-serif text-2xl font-semibold text-text">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-2">
      {inner}
    </Link>
  ) : (
    <div className="px-3 py-2">{inner}</div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-bg-2 px-1.5 py-0.5 font-mono text-2xs text-text-2">{children}</kbd>;
}
