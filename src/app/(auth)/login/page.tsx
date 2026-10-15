import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Welcome back, archivist</h1>
      <p className="mb-6 mt-1 text-sm text-text-2">Sign in to return to your worlds.</p>
      {sp.reset ? <p className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-[#a9cfa5]">Password updated. Sign in with your new password.</p> : null}
      <LoginForm next={next} />
      <p className="mt-6 text-sm text-text-2">
        New to WorldForge?{" "}
        <Link href="/signup" className="text-gold hover:underline">
          Create an account
        </Link>
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
          Local demo account: <span className="text-text-2">demo@worldforge.dev</span> / <span className="text-text-2">worldforge-demo</span>
        </p>
      ) : null}
    </>
  );
}
