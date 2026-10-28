import { Logo } from "@/components/brand/logo";
import { HeroLandscape } from "@/components/marketing/hero-landscape";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-in">{children}</div>
        </main>
        <p className="text-xs text-muted">Every character. Every kingdom. Every event. One living universe.</p>
      </div>
      <div className="relative hidden overflow-hidden border-l border-border lg:block">
        <HeroLandscape />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <blockquote className="max-w-md font-serif text-2xl leading-snug text-text/90">
            “Fire remembers.”
            <footer className="mt-2 font-sans text-xs uppercase tracking-[0.2em] text-muted">Saying of the Veiled Flame — The Ashen Crown</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
