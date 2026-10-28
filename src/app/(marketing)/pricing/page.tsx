import { PricingPlans } from "@/components/marketing/pricing-plans";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="wf-eyebrow text-gold-dim">Pricing & usage</p>
        <h1 className="mt-2 font-serif text-5xl font-semibold">Start free. Grow when your world does.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-text-2">
          WorldForge is in early access. The core workstation is free. AI features use a provider you configure and are subject to per-user daily usage limits.
        </p>
      </div>
      <div className="mt-14">
        <PricingPlans />
      </div>
      <div className="wf-panel mx-auto mt-14 max-w-3xl p-6 text-sm text-text-2">
        <h2 className="font-serif text-xl font-semibold text-text">How AI usage is counted</h2>
        <p className="mt-2">Each AI request records the input and output tokens reported by the provider. When a user exceeds the configured daily allowance, AI actions pause until the next day; everything else keeps working.</p>
      </div>
    </div>
  );
}
