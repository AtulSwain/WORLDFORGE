import { AppShell } from "@/components/shell/app-shell";
import { getWorldContext } from "@/server/page-context";

export default async function WorldLayout(props: LayoutProps<"/worlds/[worldId]">) {
  const { worldId } = await props.params;
  const ctx = await getWorldContext(worldId);
  return (
    <AppShell world={{ id: worldId, name: ctx.universe.name, canWrite: ctx.can("content:write") }}>
      {ctx.universe.archivedAt ? (
        <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-[#e2c58c]">
          This universe is archived. It stays fully readable; restore it from Universe settings to show it on your dashboard again.
        </div>
      ) : null}
      {ctx.role === "VIEWER" ? (
        <div role="status" className="border-b border-violet/30 bg-violet/10 px-4 py-1.5 text-center text-xs text-[#b9afdc]">
          You are viewing this universe as a viewer — exploration only.
        </div>
      ) : null}
      {props.children}
    </AppShell>
  );
}
