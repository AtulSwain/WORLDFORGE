import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { AcceptInvite } from "@/components/dashboard/accept-invite";
import { getInvitationByToken } from "@/server/services/universes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Invitation" };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const user = await requireUser();
  const inv = await getInvitationByToken(token);
  const valid = inv && inv.status === "PENDING" && inv.expiresAt > new Date();
  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="wf-panel p-6">
          {!valid ? (
            <>
              <h1 className="font-serif text-2xl font-semibold">This invitation is no longer valid</h1>
              <p className="mt-2 text-sm text-text-2">It may have expired, been revoked, or already been used. Ask the universe owner for a new link.</p>
              <Link href="/dashboard" className="mt-4 inline-block text-sm text-gold hover:underline">Go to your worlds</Link>
            </>
          ) : (
            <>
              <p className="wf-eyebrow">Invitation</p>
              <h1 className="mt-1 font-serif text-2xl font-semibold">Join {inv.universe.name}</h1>
              <p className="mt-2 text-sm text-text-2">
                {inv.invitedBy.name} invited <strong className="text-text">{inv.email}</strong> as {inv.role === "EDITOR" ? "an editor" : "a viewer"}.
              </p>
              {inv.email !== user.email ? (
                <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-[#e2c58c]">
                  You are signed in as {user.email}. Sign in with the invited address to accept.
                </p>
              ) : (
                <AcceptInvite token={token} />
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
