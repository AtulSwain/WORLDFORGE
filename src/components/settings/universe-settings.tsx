"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Copy, Download, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { GENRES, humanize } from "@/domain/catalog";
import { CONSISTENCY_RULES, type ConsistencyRule } from "@/domain/schemas";
import { formatYear, type CalendarConfig } from "@/domain/chronology";
import {
  changeMemberRoleAction,
  createRelationshipTypeAction,
  deleteUniverseAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  setUniverseArchivedAction,
  transferOwnershipAction,
  updateCalendarAction,
  updateRulesAction,
  updateUniverseAction,
} from "@/server/actions/universe";
import type { ActionResult } from "@/server/action-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ListInput } from "@/components/ui/pickers";

export function SettingsSection({ id, title, description, children, readOnly }: { id: string; title: string; description?: string; children: React.ReactNode; readOnly?: boolean }) {
  return (
    <section id={id} className="wf-panel scroll-mt-20 p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-text-2">{description}</p> : null}
        </div>
        {readOnly ? <Badge>View only</Badge> : null}
      </header>
      {children}
    </section>
  );
}

/** Runs a server action, surfaces errors, toasts success and refreshes server data. */
function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const run = (fn: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) =>
    start(async () => {
      setError(null);
      setFieldErrors({});
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, error, fieldErrors, run };
}

export interface GeneralValues {
  name: string;
  description: string;
  genre: string;
  customGenre: string;
  tone: string;
  mainConflict: string;
  timePeriod: string;
  coreRules: string;
  currentEra: string;
  defaultTimelineId: string;
}

export function GeneralSettings({ worldId, initial, timelines, canEdit }: { worldId: string; initial: GeneralValues; timelines: { id: string; name: string; isMain: boolean }[]; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const { pending, error, fieldErrors, run } = useSave();
  const set = (k: keyof GeneralValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            updateUniverseAction(worldId, {
              name: v.name, description: v.description, genre: v.genre, customGenre: nul(v.customGenre), tone: nul(v.tone),
              mainConflict: nul(v.mainConflict), timePeriod: nul(v.timePeriod), coreRules: nul(v.coreRules), currentEra: nul(v.currentEra),
              defaultTimelineId: v.defaultTimelineId || null,
            }),
          "Universe details saved",
        );
      }}
    >
      <fieldset disabled={!canEdit || pending} className="contents">
        <div className="sm:col-span-2"><FormError message={error} /></div>
        <Field label="Name" htmlFor="s-name" error={fieldErrors.name?.[0]}><Input id="s-name" value={v.name} onChange={set("name")} required /></Field>
        <Field label="Genre" htmlFor="s-genre">
          <NativeSelect id="s-genre" value={v.genre} onChange={set("genre")}>
            {GENRES.map((g) => <option key={g} value={g}>{humanize(g)}</option>)}
          </NativeSelect>
        </Field>
        {v.genre === "CUSTOM" ? <Field label="Custom genre" htmlFor="s-cg"><Input id="s-cg" value={v.customGenre} onChange={set("customGenre")} /></Field> : null}
        <Field label="Tone" htmlFor="s-tone" hint="e.g. grim, hopeful, political"><Input id="s-tone" value={v.tone} onChange={set("tone")} /></Field>
        <Field label="Time period" htmlFor="s-period"><Input id="s-period" value={v.timePeriod} onChange={set("timePeriod")} /></Field>
        <Field label="Current era" htmlFor="s-era"><Input id="s-era" value={v.currentEra} onChange={set("currentEra")} /></Field>
        <Field label="Default timeline" htmlFor="s-tl" hint="Opened first in Chronos, the graph and the atlas.">
          <NativeSelect id="s-tl" value={v.defaultTimelineId} onChange={set("defaultTimelineId")}>
            {timelines.map((t) => <option key={t.id} value={t.id}>{t.isMain ? `${t.name} (canon)` : t.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Description" htmlFor="s-desc" className="sm:col-span-2"><Textarea id="s-desc" rows={3} value={v.description} onChange={set("description")} /></Field>
        <Field label="Main conflict" htmlFor="s-conf" className="sm:col-span-2"><Textarea id="s-conf" rows={2} value={v.mainConflict} onChange={set("mainConflict")} /></Field>
        <Field label="Core rules of the world" htmlFor="s-rules" className="sm:col-span-2" hint="How magic, technology or physics behave. Shown to collaborators and used as AI context when AI is enabled.">
          <Textarea id="s-rules" rows={3} value={v.coreRules} onChange={set("coreRules")} />
        </Field>
        {canEdit ? <div className="flex justify-end sm:col-span-2"><Button variant="primary" type="submit" disabled={pending}><Save /> {pending ? "Saving…" : "Save details"}</Button></div> : null}
      </fieldset>
    </form>
  );
}

export function CalendarSettings({ worldId, initial, canEdit }: { worldId: string; initial: CalendarConfig & { currentYear?: number | null }; canEdit: boolean }) {
  const [cal, setCal] = useState({ ...initial, currentYear: initial.currentYear ?? null });
  const { pending, error, run } = useSave();
  const preview = formatYear(cal.currentYear ?? 100, cal);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateCalendarAction(worldId, cal), "Calendar saved");
      }}
    >
      <fieldset disabled={!canEdit || pending} className="flex flex-col gap-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Year label" htmlFor="c-label"><Input id="c-label" value={cal.yearLabel} onChange={(e) => setCal({ ...cal, yearLabel: e.target.value })} /></Field>
          <Field label="Era suffix" htmlFor="c-suffix" hint="e.g. AC"><Input id="c-suffix" value={cal.eraSuffix} onChange={(e) => setCal({ ...cal, eraSuffix: e.target.value })} /></Field>
          <Field label="Before year 0" htmlFor="c-neg"><Input id="c-neg" value={cal.negativeEraSuffix} onChange={(e) => setCal({ ...cal, negativeEraSuffix: e.target.value })} /></Field>
          <Field label="Present year" htmlFor="c-now">
            <Input id="c-now" type="number" value={cal.currentYear ?? ""} onChange={(e) => setCal({ ...cal, currentYear: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Month names" htmlFor="c-months" hint={`Up to 24, in order. Leave empty to use numbered months. Preview: ${preview}`}>
          <ListInput id="c-months" value={cal.monthNames} onChange={(monthNames) => setCal({ ...cal, monthNames })} placeholder="Add a month and press Enter" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-text-2">Eras</span>
          {cal.eras.length === 0 ? <p className="text-sm text-muted">No named eras.</p> : null}
          {cal.eras.map((era, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input aria-label={`Era ${i + 1} name`} value={era.name} className="max-w-xs" onChange={(e) => setCal({ ...cal, eras: cal.eras.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Input aria-label={`Era ${i + 1} start year`} type="number" value={era.startYear} className="w-32" onChange={(e) => setCal({ ...cal, eras: cal.eras.map((x, j) => (j === i ? { ...x, startYear: Number(e.target.value) } : x)) })} />
              {canEdit ? <Button type="button" variant="ghost" size="icon" aria-label={`Remove era ${era.name || i + 1}`} onClick={() => setCal({ ...cal, eras: cal.eras.filter((_, j) => j !== i) })}><X /></Button> : null}
            </div>
          ))}
          {canEdit ? <div><Button type="button" size="sm" onClick={() => setCal({ ...cal, eras: [...cal.eras, { name: "", startYear: cal.eras.at(-1)?.startYear ?? 0 }] })}><Plus /> Add era</Button></div> : null}
        </div>
        {canEdit ? <div className="flex justify-end"><Button variant="primary" type="submit" disabled={pending}><Save /> {pending ? "Saving…" : "Save calendar"}</Button></div> : null}
      </fieldset>
    </form>
  );
}

export function RuleSettings({
  worldId,
  initial,
  descriptions,
  canEdit,
}: {
  worldId: string;
  initial: { rules: Partial<Record<ConsistencyRule, boolean>>; minTravelDays: number; aiEnabled: boolean };
  descriptions: Record<ConsistencyRule, { title: string; description: string }>;
  canEdit: boolean;
}) {
  const [s, setS] = useState(initial);
  const { pending, error, run } = useSave();
  const enabled = (r: ConsistencyRule) => s.rules[r] ?? true;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateRulesAction(worldId, s), "Rules saved");
      }}
    >
      <fieldset disabled={!canEdit || pending} className="flex flex-col gap-4">
        <FormError message={error} />
        <ul className="grid gap-2 md:grid-cols-2">
          {CONSISTENCY_RULES.map((r) => (
            <li key={r}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-2/50 p-3 hover:border-border-strong">
                <input type="checkbox" className="mt-1 accent-[#D6BD8D]" checked={enabled(r)} onChange={(e) => setS({ ...s, rules: { ...s.rules, [r]: e.target.checked } })} />
                <span>
                  <span className="block text-sm font-medium">{descriptions[r].title}</span>
                  <span className="block text-xs text-text-2">{descriptions[r].description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum travel time between locations (days)" htmlFor="r-travel" hint="Used by the travel-conflict rule. 0 only flags the same day in two places.">
            <Input id="r-travel" type="number" min={0} max={3650} value={s.minTravelDays} onChange={(e) => setS({ ...s, minTravelDays: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <label id="ai" className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-2/50 p-3">
            <input type="checkbox" className="mt-1 accent-[#8D80B8]" checked={s.aiEnabled} onChange={(e) => setS({ ...s, aiEnabled: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium">AI assistance in this universe</span>
              <span className="block text-xs text-text-2">When off, AI panels are hidden for everyone here. Deterministic analysis is unaffected. AI suggestions are always reviewed before they touch canon.</span>
            </span>
          </label>
        </div>
        {canEdit ? <div className="flex justify-end"><Button variant="primary" type="submit" disabled={pending}><Save /> {pending ? "Saving…" : "Save rules"}</Button></div> : null}
      </fieldset>
    </form>
  );
}

export function RelationshipTypeSettings({ worldId, types, canEdit }: { worldId: string; types: { key: string; label: string; inverse: string | null }[]; canEdit: boolean }) {
  const [label, setLabel] = useState("");
  const [inverse, setInverse] = useState("");
  const { pending, error, run } = useSave();
  return (
    <div className="flex flex-col gap-4">
      {types.length ? (
        <ul className="flex flex-wrap gap-2">
          {types.map((t) => (
            <li key={t.key} className="rounded-full border border-border px-3 py-1 text-sm">
              {t.label}{t.inverse ? <span className="text-muted"> ↔ {t.inverse}</span> : null} <code className="ml-1 text-2xs text-muted">{t.key}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No custom relationship types. The built-in set covers family, politics, loyalty, romance and more.</p>
      )}
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createRelationshipTypeAction(worldId, { key: label, label, inverse }), "Relationship type added", () => { setLabel(""); setInverse(""); });
          }}
        >
          <Field label="Label" htmlFor="rt-label"><Input id="rt-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sworn shield of" required /></Field>
          <Field label="Inverse label (optional)" htmlFor="rt-inv"><Input id="rt-inv" value={inverse} onChange={(e) => setInverse(e.target.value)} placeholder="Protected by" /></Field>
          <Button type="submit" disabled={pending || !label.trim()}><Plus /> Add type</Button>
          <div className="w-full"><FormError message={error} /></div>
        </form>
      ) : null}
    </div>
  );
}

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}

export function MemberSettings({
  worldId,
  members,
  invitations,
  currentUserId,
  canManage,
  isOwner,
}: {
  worldId: string;
  members: MemberRow[];
  invitations: { id: string; email: string; role: string; expiresAt: string }[];
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [link, setLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "transfer" | "leave"; member: MemberRow } | null>(null);
  const { pending, error, run } = useSave();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Invite link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error} />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.name}{m.userId === currentUserId ? <span className="text-muted"> (you)</span> : null}</div>
              <div className="truncate text-xs text-muted">{m.email}</div>
            </div>
            {canManage && m.role !== "OWNER" ? (
              <NativeSelect aria-label={`Role for ${m.name}`} value={m.role} className="w-32" disabled={pending} onChange={(e) => run(() => changeMemberRoleAction(worldId, m.userId, e.target.value as "EDITOR" | "VIEWER"), `${m.name} is now ${e.target.value.toLowerCase()}`)}>
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </NativeSelect>
            ) : (
              <Badge tone={m.role === "OWNER" ? "gold" : undefined}>{humanize(m.role)}</Badge>
            )}
            {isOwner && m.role !== "OWNER" ? <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "transfer", member: m })}>Make owner</Button> : null}
            {canManage && m.role !== "OWNER" ? (
              <Button size="icon" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => setConfirm({ kind: "remove", member: m })}><Trash2 /></Button>
            ) : null}
            {!canManage && m.userId === currentUserId && m.role !== "OWNER" ? <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "leave", member: m })}>Leave universe</Button> : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                async () => {
                  const r = await inviteMemberAction(worldId, { email, role });
                  if (r.ok) setLink(r.data.link);
                  return r;
                },
                "Invitation created",
                () => setEmail(""),
              );
            }}
          >
            <Field label="Invite by email" htmlFor="m-email"><Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collaborator@example.com" required className="w-72" /></Field>
            <Field label="Role" htmlFor="m-role">
              <NativeSelect id="m-role" value={role} onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")} className="w-32">
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </NativeSelect>
            </Field>
            <Button type="submit" variant="primary" disabled={pending}><UserPlus /> Create invite</Button>
          </form>
          {link ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/40 bg-gold/5 p-3 text-sm">
              <span className="text-text-2">Share this link with them (email delivery is not configured). It works once, for that email address, for 14 days:</span>
              <code className="min-w-0 flex-1 truncate rounded bg-bg-2 px-2 py-1 text-xs">{link}</code>
              <Button size="sm" onClick={() => copy(link)}><Copy /> Copy</Button>
            </div>
          ) : null}
          {invitations.length ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-text-2">Pending invitations</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <Badge>{humanize(i.role)}</Badge>
                    <span className="text-xs text-muted">expires {new Date(i.expiresAt).toLocaleDateString()}</span>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInvitationAction(worldId, i.id), "Invitation revoked")}>Revoke</Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind !== "transfer"}
        pending={pending}
        title={confirm?.kind === "transfer" ? `Make ${confirm.member.name} the owner?` : confirm?.kind === "leave" ? "Leave this universe?" : `Remove ${confirm?.member.name}?`}
        description={
          confirm?.kind === "transfer"
            ? "They gain full control, including deleting the universe. You become an editor."
            : confirm?.kind === "leave"
              ? "You will lose access until someone invites you again."
              : "They immediately lose access to this universe. Their past contributions stay."
        }
        confirmLabel={confirm?.kind === "transfer" ? "Transfer ownership" : confirm?.kind === "leave" ? "Leave" : "Remove"}
        onConfirm={() => {
          if (!confirm) return;
          const m = confirm.member;
          if (confirm.kind === "transfer") run(() => transferOwnershipAction(worldId, m.userId), "Ownership transferred", () => setConfirm(null));
          else if (confirm.kind === "leave") run(() => removeMemberAction(worldId, m.userId), "You left the universe", () => { setConfirm(null); router.push("/dashboard"); });
          else run(() => removeMemberAction(worldId, m.userId), `${m.name} removed`, () => setConfirm(null));
        }}
      />
    </div>
  );
}

export function ExportPanel({ worldId }: { worldId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-2">
        The zip bundle contains <code>universe.json</code> (the complete universe, including alternate timelines, re-importable into any WorldForge), lore as Markdown, character sheets, a timeline CSV/JSON, relationships CSV and an asset manifest. Revision history, proposals and uploaded file contents are not included.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary"><a href={`/api/worlds/${worldId}/export`} download><Download /> Download zip bundle</a></Button>
        <Button asChild><a href={`/api/worlds/${worldId}/export?format=json`} download><Download /> universe.json only</a></Button>
      </div>
    </div>
  );
}

export function DangerZone({ worldId, name, archived, isSample }: { worldId: string; name: string; archived: boolean; isSample: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { pending, error, run } = useSave();
  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div>
          <div className="text-sm font-medium">{archived ? "Restore universe" : "Archive universe"}</div>
          <p className="text-xs text-text-2">{archived ? "Bring it back to your dashboard." : "Hide it from your dashboard. Nothing is deleted and you can restore it any time."}</p>
        </div>
        <Button disabled={pending} onClick={() => run(() => setUniverseArchivedAction(worldId, !archived), archived ? "Universe restored" : "Universe archived")}>
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
        </Button>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-danger/40 p-4">
        <div>
          <div className="text-sm font-medium text-[#e7a3a3]">Delete universe permanently</div>
          <p className="text-xs text-text-2">
            Deletes every entity, event, timeline, lore document, map and asset record in “{name}”. This cannot be undone{isSample ? " — you can add a fresh copy of the sample from the dashboard" : " — export a backup first"}.
          </p>
        </div>
        {open ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => deleteUniverseAction(worldId, typed), "Universe deleted", () => router.push("/dashboard"));
            }}
          >
            <Field label={`Type “${name}” to confirm`} htmlFor="del-name"><Input id="del-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="w-72" /></Field>
            <Button type="submit" variant="danger" disabled={pending || typed !== name}><Trash2 /> Delete forever</Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</Button>
          </form>
        ) : (
          <div><Button variant="danger" onClick={() => setOpen(true)}><Trash2 /> Delete universe…</Button></div>
        )}
      </div>
    </div>
  );
}
