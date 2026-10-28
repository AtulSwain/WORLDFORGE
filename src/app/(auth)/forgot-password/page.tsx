import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-text-2">We will send a single-use link to your email.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-text-2">
        <Link href="/login" className="text-gold hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
