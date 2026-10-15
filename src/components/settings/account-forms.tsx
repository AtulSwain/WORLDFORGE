"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction, signOutOtherSessionsAction, updatePreferencesAction, updateProfileAction } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SettingsTabs() {
  const pathname = usePathname();
  const tabs = [
    ["/settings/profile", "Profile"],
    ["/settings/account", "Account & preferences"],
  ] as const;
  return (
    <nav aria-label="Account settings" className="flex gap-1 border-b border-border">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", pathname === href ? "border-gold text-text" : "border-transparent text-text-2 hover:text-text")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ProfileForm({ initial, email }: { initial: { name: string; bio: string }; email: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="wf-panel flex max-w-2xl flex-col gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await updateProfileAction(v);
          if (!r.ok) return setError(r.error);
          toast.success("Profile saved");
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      <Field label="Display name" htmlFor="p-name" hint="Shown to collaborators and on activity."><Input id="p-name" value={v.name} maxLength={80} required onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Email" htmlFor="p-email" hint="Used to sign in and to match invitations."><Input id="p-email" value={email} disabled /></Field>
      <Field label="About you" htmlFor="p-bio"><Textarea id="p-bio" rows={4} maxLength={1000} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} placeholder="What do you build?" /></Field>
      <div className="flex justify-end"><Button variant="primary" type="submit" disabled={pending}><Save /> {pending ? "Saving…" : "Save profile"}</Button></div>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (next !== confirm) return setError("The new passwords do not match.");
        start(async () => {
          setError(null);
          setFieldErrors({});
          const r = await changePasswordAction({ current, next });
          if (!r.ok) {
            setError(r.error);
            setFieldErrors(r.fieldErrors ?? {});
            return;
          }
          toast.success(r.data.revoked ? `Password changed. Signed out ${r.data.revoked} other session(s).` : "Password changed");
          setCurrent(""); setNext(""); setConfirm("");
        });
      }}
    >
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password" htmlFor="pw-cur" error={fieldErrors.current?.[0]}><Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="New password" htmlFor="pw-new" hint="At least 10 characters."><Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} /></Field>
        <Field label="Confirm new password" htmlFor="pw-confirm"><Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={pending}><KeyRound /> {pending ? "Changing…" : "Change password"}</Button></div>
    </form>
  );
}

export function PreferencesForm({ initial }: { initial: { reducedMotion: boolean; directoryView: "grid" | "list" } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const save = (next: typeof v) => {
    setV(next);
    start(async () => {
      const r = await updatePreferencesAction(next);
      if (!r.ok) {
        toast.error(r.error);
        setV(v);
        return;
      }
      toast.success("Preferences saved");
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-2/50 p-3">
        <input type="checkbox" className="mt-1 accent-[#D6BD8D]" checked={v.reducedMotion} disabled={pending} onChange={(e) => save({ ...v, reducedMotion: e.target.checked })} />
        <span>
          <span className="block text-sm font-medium">Reduce motion</span>
          <span className="block text-xs text-text-2">Turns off animated transitions everywhere in the app, even if your system setting allows them.</span>
        </span>
      </label>
      <fieldset className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-2/50 p-3" disabled={pending}>
        <legend className="sr-only">Default directory layout</legend>
        <span className="text-sm font-medium">Directories open as</span>
        {(["grid", "list"] as const).map((x) => (
          <label key={x} className="flex items-center gap-1.5 text-sm text-text-2">
            <input type="radio" name="dir-view" className="accent-[#D6BD8D]" checked={v.directoryView === x} onChange={() => save({ ...v, directoryView: x })} />
            {x === "grid" ? "Cards" : "List"}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function SessionsPanel({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-2">You are signed in on {count} {count === 1 ? "device" : "devices"} (including this one).</p>
      <Button
        disabled={pending || count <= 1}
        onClick={() =>
          start(async () => {
            const r = await signOutOtherSessionsAction();
            if (!r.ok) return void toast.error(r.error);
            toast.success(`Signed out ${r.data.revoked} other session(s)`);
            router.refresh();
          })
        }
      >
        <LogOut /> Sign out other devices
      </Button>
    </div>
  );
}
