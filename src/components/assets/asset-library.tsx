"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Copy, FileText, ImagePlus, Link2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { humanize } from "@/domain/catalog";
import { linkAssetAction, removeAssetAction, unlinkAssetAction } from "@/server/actions/assets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";
import { cn } from "@/lib/utils";

export interface AssetRow {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string;
  hasThumb: boolean;
  links: { id: string; label: string; href: string }[];
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const KINDS = ["PORTRAIT", "EMBLEM", "MAP", "ILLUSTRATION", "ARTIFACT", "CONCEPT", "REFERENCE", "DOCUMENT"];

export function AssetLibrary({ worldId, assets, entities, canWrite, attachTo, maxMb }: { worldId: string; assets: AssetRow[]; entities: PickOption[]; canWrite: boolean; attachTo: string | null; maxMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("REFERENCE");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [linkFor, setLinkFor] = useState<AssetRow | null>(null);
  const [removeFor, setRemoveFor] = useState<AssetRow | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();

  const send = async (file: File, replace?: string) => {
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    fd.set("altText", alt);
    if (replace) fd.set("replace", replace);
    try {
      const res = await fetch(`/api/worlds/${worldId}/assets`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      toast.success(replace ? "File replaced" : `${file.name} uploaded`);
      setAlt("");
      router.refresh();
      if (!replace && attachTo) setLinkFor({ id: body.id, kind, filename: file.name, mimeType: file.type, sizeBytes: file.size, width: null, height: null, altText: alt, hasThumb: false, links: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const visible = assets.filter((a) => !filter || a.kind === filter);

  return (
    <div className="flex flex-col gap-6">
      {canWrite ? (
        <section
          className={cn("wf-panel flex flex-col gap-4 border-dashed p-5 transition-colors", drag && "border-gold bg-gold/5")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) void send(f);
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <h2 className="flex items-center gap-2 font-medium"><ImagePlus className="size-4 text-gold" /> Upload</h2>
              <p className="mt-0.5 text-xs text-muted">Drop a file here or choose one. PNG, JPEG, GIF, WebP, AVIF, PDF or text, up to {maxMb} MB. Types are verified from file contents.</p>
            </div>
            <Field label="Kind" htmlFor="a-kind">
              <NativeSelect id="a-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-40">
                {KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Alt text" htmlFor="a-alt"><Input id="a-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image" className="w-56" /></Field>
            <input ref={input} type="file" className="sr-only" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,application/pdf,text/plain,text/markdown" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ""; }} />
            <Button variant="primary" onClick={() => input.current?.click()} disabled={uploading}><Upload /> {uploading ? "Uploading…" : "Choose file"}</Button>
          </div>
          <FormError message={error} />
        </section>
      ) : null}
      <input ref={replaceInput} type="file" className="sr-only" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,application/pdf,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f && replaceFor) void send(f, replaceFor); e.target.value = ""; }} />

      <div className="flex flex-wrap gap-1">
        {["", ...KINDS].map((k) => (
          <button key={k || "all"} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", filter === k ? "border-gold/60 text-gold" : "border-border text-text-2")}>{k ? humanize(k) : "All"}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No assets yet. Portraits, emblems, maps and reference art you upload appear here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((a) => (
            <li key={a.id} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              <a href={`/api/assets/${a.id}`} target="_blank" rel="noreferrer" className="relative block aspect-square bg-bg-2">
                {a.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated asset route
                  <img src={`/api/assets/${a.id}?thumb=1`} alt={a.altText || a.filename} className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted"><FileText className="size-8" /></span>
                )}
                <span className="absolute left-2 top-2"><Badge>{humanize(a.kind)}</Badge></span>
              </a>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="truncate text-xs font-medium" title={a.filename}>{a.filename}</div>
                <div className="text-2xs text-muted">{formatBytes(a.sizeBytes)}{a.width ? ` · ${a.width}×${a.height}` : ""}</div>
                {a.links.length ? (
                  <ul className="flex flex-wrap gap-1">
                    {a.links.map((l) => (
                      <li key={l.id} className="inline-flex items-center gap-1 rounded bg-surface-2 py-0.5 pl-1.5 pr-0.5 text-2xs">
                        <a href={l.href} className="hover:text-gold">{l.label}</a>
                        {canWrite ? <button aria-label={`Unlink from ${l.label}`} className="text-muted hover:text-text" onClick={() => start(async () => { const r = await unlinkAssetAction(worldId, l.id); if (!r.ok) toast.error(r.error); else router.refresh(); })}><X className="size-3" /></button> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto flex gap-0.5 pt-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Copy link" onClick={() => { void navigator.clipboard?.writeText(`/api/assets/${a.id}`); toast.success("Link copied"); }}><Copy /></Button>
                  {canWrite ? (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label="Link to a record" onClick={() => setLinkFor(a)}><Link2 /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Replace file" onClick={() => { setReplaceFor(a.id); replaceInput.current?.click(); }}><RefreshCw /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Remove asset" onClick={() => setRemoveFor(a)}><Trash2 /></Button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LinkDialog worldId={worldId} asset={linkFor} entities={entities} defaultEntity={attachTo} onClose={() => setLinkFor(null)} />
      <ConfirmDialog
        open={!!removeFor}
        onOpenChange={(o) => !o && setRemoveFor(null)}
        title="Remove this asset?"
        description="The file is deleted from storage and unlinked from every record. Portraits using it are cleared."
        destructive
        confirmLabel="Remove"
        pending={pending}
        onConfirm={() => start(async () => { const r = await removeAssetAction(worldId, removeFor!.id); setRemoveFor(null); if (!r.ok) toast.error(r.error); else { toast.success("Asset removed"); router.refresh(); } })}
      />
    </div>
  );
}

function LinkDialog({ worldId, asset, entities, defaultEntity, onClose }: { worldId: string; asset: AssetRow | null; entities: PickOption[]; defaultEntity: string | null; onClose: () => void }) {
  const router = useRouter();
  const [entityId, setEntityId] = useState<string | null>(defaultEntity);
  const [portrait, setPortrait] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ent = entities.find((e) => e.id === entityId);
  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      {asset ? (
        <DialogContent size="sm" title="Link asset" description={asset.filename}>
          <div className="flex flex-col gap-3">
            <FormError message={error} />
            <Field label="Entity" htmlFor="l-ent"><RecordPicker id="l-ent" options={entities} value={entityId} onChange={setEntityId} /></Field>
            {ent && (ent.type === "CHARACTER" || ent.type === "FACTION") && asset.mimeType.startsWith("image/") ? (
              <label className="flex items-center gap-2 text-sm text-text-2"><input type="checkbox" className="accent-[#D6BD8D]" checked={portrait} onChange={(e) => setPortrait(e.target.checked)} /> Use as {ent.type === "CHARACTER" ? "portrait" : "emblem image"}</label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" disabled={pending || !entityId} onClick={() => start(async () => {
                const r = await linkAssetAction(worldId, asset.id, { entityId: entityId!, setPortrait: portrait });
                if (!r.ok) return setError(r.error);
                toast.success(`Linked to ${ent?.name}`);
                onClose();
                router.refresh();
              })}>Link</Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
