"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { createMapAction } from "@/server/actions/maps";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function MapSwitcher({ worldId, maps, currentId, canWrite }: { worldId: string; maps: { id: string; title: string; isDefault: boolean }[]; currentId: string | null; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", imageSource: "/maps/parchment.svg", width: "2400", height: "1600" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary" size="sm"><MapIcon /> Maps</Button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuLabel>Maps</MenuLabel>
          {maps.map((m) => (
            <MenuItem key={m.id} onSelect={() => router.push(`/worlds/${worldId}/atlas?map=${m.id}`)}>
              <span className="flex-1">{m.title}</span> {m.id === currentId ? <Check className="text-gold" /> : null}
            </MenuItem>
          ))}
          {canWrite ? (
            <>
              <MenuSeparator />
              <MenuItem onSelect={() => setOpen(true)}><Plus /> New map</MenuItem>
            </>
          ) : null}
        </MenuContent>
      </Menu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New map" description="Use the blank survey sheet, or paste the link of an image uploaded to this universe's Assets library (/api/assets/…).">
          <div className="flex flex-col gap-3">
            <FormError message={error} />
            <Field label="Title" htmlFor="m-title"><Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Image" htmlFor="m-src" hint="Built-in: /maps/parchment.svg or /maps/ashen-crown.svg"><Input id="m-src" value={form.imageSource} onChange={(e) => setForm({ ...form, imageSource: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Width (px)" htmlFor="m-w"><Input id="m-w" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></Field>
              <Field label="Height (px)" htmlFor="m-h"><Input id="m-h" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await createMapAction(worldId, { title: form.title, imageSource: form.imageSource, width: Number(form.width), height: Number(form.height) });
                    if (!r.ok) return setError(r.error);
                    toast.success("Map created");
                    setOpen(false);
                    router.push(`/worlds/${worldId}/atlas?map=${r.data.id}`);
                  })
                }
              >
                Create map
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
