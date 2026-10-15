/** Role → capability matrix. Enforced on the server for every protected operation. */

export type Role = "OWNER" | "EDITOR" | "VIEWER";

export const CAPABILITIES = [
  "universe:read",
  "content:write",
  "timeline:branch",
  "ai:use",
  "export",
  "universe:settings",
  "members:manage",
  "universe:delete",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  OWNER: new Set(CAPABILITIES),
  EDITOR: new Set<Capability>(["universe:read", "content:write", "timeline:branch", "ai:use", "export"]),
  VIEWER: new Set<Capability>(["universe:read"]),
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role].has(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};
