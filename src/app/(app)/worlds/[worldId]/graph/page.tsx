import { getWorldContext } from "@/server/page-context";
import { listRelationshipTypes } from "@/server/services/relationships";
import { GraphLoader } from "@/components/graph/graph-loader";

export const metadata = { title: "Relationship graph" };

export default async function GraphPage(props: PageProps<"/worlds/[worldId]/graph">) {
  const { worldId } = await props.params;
  const ctx = await getWorldContext(worldId);
  const customTypes = await listRelationshipTypes(ctx.user.id, worldId);
  return (
    <>
      <h1 className="sr-only">Relationship graph — {ctx.universe.name}</h1>
      <GraphLoader
        worldId={worldId}
        canWrite={ctx.can("content:write")}
        timelines={ctx.timelines.filter((t) => t.status === "ACTIVE").map((t) => ({ id: t.id, name: t.name, isMain: t.isMain }))}
        customTypes={customTypes.map((c) => ({ key: c.key, label: c.label, inverse: c.inverse }))}
      />
    </>
  );
}
