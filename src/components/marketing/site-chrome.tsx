import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/#engine", label: "Living World Engine" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-text-2 transition-colors hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/dashboard">Open your worlds</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/signup">Start building</Link>
              </Button>
            </>
          )}
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-text-2">Build worlds that remember everything. A workstation for novelists, comic creators, screenwriters, game designers and game masters.</p>
        </div>
        <FooterCol title="Product" links={[["/features", "Features"], ["/#engine", "Living World Engine"], ["/pricing", "Pricing"], ["/signup", "Create an account"]]} />
        <FooterCol title="Company" links={[["/about", "About & mission"], ["/#faq", "FAQ"], ["/login", "Sign in"]]} />
        <FooterCol title="Legal" links={[["/privacy", "Privacy (draft)"], ["/terms", "Terms (draft)"]]} />
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted">
        WorldForge — an independent creative tool. Your worlds remain yours.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="wf-eyebrow mb-3">{title}</h3>
      <ul className="flex flex-col gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-text-2 hover:text-gold">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
