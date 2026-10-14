"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { EntityTypeKey } from "@/domain/catalog";
import { ENTITY_ICON, ENTITY_TINT } from "@/components/world/entity-visual";
import { cn, initials } from "@/lib/utils";

export interface WfNodeData extends Record<string, unknown> {
  label: string;
  type: string;
  kind: "ENTITY" | "EVENT";
  portrait?: string | null;
  dimmed?: boolean;
  highlighted?: boolean;
  modified?: boolean;
  year?: number;
}

// Handles sit at the centre of the shape so straight edges run centre-to-centre.
const handleCls = "!size-3 !min-h-0 !min-w-0 !border-0 !bg-transparent !top-[22px] !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform";

/** Restrained per-type node shapes: portrait circles, shields, markers, gems and diamonds. */
export const WorldNode = memo(function WorldNode({ data, selected }: NodeProps & { data: WfNodeData }) {
  const ring = selected ? "#D6BD8D" : data.highlighted ? "#e4cfa6" : ENTITY_TINT[data.type as EntityTypeKey] ?? "#737581";
  const Icon = data.kind === "ENTITY" ? ENTITY_ICON[data.type as EntityTypeKey] : null;
  const body = (() => {
    if (data.kind === "EVENT") {
      return (
        <div className="flex size-9 rotate-45 items-center justify-center border-[1.5px] bg-surface" style={{ borderColor: ring }}>
          <span className="-rotate-45 text-[9px] font-semibold text-text-2">{data.year ?? ""}</span>
        </div>
      );
    }
    if (data.type === "CHARACTER") {
      return (
        <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border-[1.5px] bg-surface font-serif text-sm font-semibold text-gold" style={{ borderColor: ring }}>
          {data.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- small avatar from our own asset route
            <img src={data.portrait} alt="" className="size-full object-cover" />
          ) : (
            initials(data.label)
          )}
        </div>
      );
    }
    if (data.type === "FACTION") {
      return (
        <svg width="42" height="46" viewBox="0 0 42 46" aria-hidden="true">
          <path d="M3 3h36v15c0 14-10 21-18 25C13 39 3 32 3 18z" fill="#1C1D24" stroke={ring} strokeWidth="1.6" />
          {Icon ? null : null}
          <text x="21" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill="#D6BD8D" fontFamily="var(--font-cormorant)">{initials(data.label)}</text>
        </svg>
      );
    }
    if (data.type === "LOCATION") {
      return (
        <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
          <path d="M17 42C17 42 3 26 3 16a14 14 0 0 1 28 0c0 10-14 26-14 26z" fill="#1C1D24" stroke={ring} strokeWidth="1.6" />
          <circle cx="17" cy="16" r="5" fill={ring} opacity="0.8" />
        </svg>
      );
    }
    return (
      <div className="flex size-10 items-center justify-center rounded-lg border-[1.5px] bg-surface" style={{ borderColor: ring }}>
        {Icon ? <Icon className="size-4" style={{ color: ENTITY_TINT[data.type as EntityTypeKey] }} /> : null}
      </div>
    );
  })();
  return (
    <div className={cn("flex flex-col items-center gap-1 transition-opacity duration-200", data.dimmed && "opacity-25")}>
      <Handle type="target" position={Position.Top} className={handleCls} />
      <div className={cn("relative rounded-full", selected && "drop-shadow-[0_0_10px_rgba(214,189,141,0.45)]")}>
        {body}
        {data.modified ? <span className="absolute -right-1 -top-1 size-2.5 rounded-full border border-bg bg-violet" title="Changed in this branch" /> : null}
      </div>
      <div className={cn("max-w-32 truncate rounded px-1 text-center text-[11px] leading-tight", selected ? "text-gold" : "text-text-2")} style={{ background: "rgba(16,17,22,0.75)" }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className={handleCls} />
    </div>
  );
});

export const nodeTypes = { world: WorldNode };
