import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <>
        <h1 className="font-serif text-3xl font-semibold">Link missing</h1>
        <p className="mt-2 text-sm text-text-2">
          This page needs a reset token. <Link href="/forgot-password" className="text-gold hover:underline">Request a new link</Link>.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-text-2">You will be signed out of other devices.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
