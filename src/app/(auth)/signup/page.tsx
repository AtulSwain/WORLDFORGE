import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Begin your first world</h1>
      <p className="mb-6 mt-1 text-sm text-text-2">Free while you explore. No AI key required.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-text-2">
        Already have an account?{" "}
        <Link href="/login" className="text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
