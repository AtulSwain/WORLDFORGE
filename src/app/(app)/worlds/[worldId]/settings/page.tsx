import { RULE_DESCRIPTIONS } from "@/domain/consistency";
import { getWorldContext, guard } from "@/server/page-context";
import { db } from "@/server/db";
import { listMembers } from "@/server/services/universes";
import { listRelationshipTypes } from "@/server/services/relationships";
import { PageHeader } from "@/components/ui/misc";
import {
  CalendarSettings,
  DangerZone,
  ExportPanel,
  GeneralSettings,
  MemberSettings,
  RelationshipTypeSettings,
  RuleSettings,
  SettingsSection,
} from "@/components/settings/universe-settings";

export const metadata = { title: "Universe settings" };

const NAV = [
  ["general", "Details"],
  ["calendar", "Calendar"],
  ["rules", "Consistency & AI"],
  ["relationships", "Relationship types"],
  ["members", "Members"],
  ["export", "Export"],
  ["danger", "Archive & delete"],
] as const;

export default async function UniverseSettingsPage(props: PageProps<"/worlds/[worldId]/settings">) {
  const { worldId } = await props.params;
  const ctx = await getWorldContext(worldId);
  const canEdit = ctx.can("universe:settings");
  const [u, { members, invitations }, types] = await Promise.all([
    db.universe.findUniqueOrThrow({ where: { id: worldId } }),
    guard(() => listMembers(ctx.user.id, worldId)),
    guard(() => listRelationshipTypes(ctx.user.id, worldId)),
  ]);
  const nav = NAV.filter(([id]) => (id === "export" ? ctx.can("export") : id === "danger" ? ctx.can("universe:delete") : true));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow={ctx.universe.name} title="Universe settings" description={canEdit ? "Shape the rules your world is checked against, who can work on it and how it is stored." : "Only the owner can change these settings. You can see how this universe is configured."} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {nav.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-sm text-text-2 hover:bg-surface-2 hover:text-text">{label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsSection id="general" title="Details" readOnly={!canEdit}>
            <GeneralSettings
              worldId={worldId}
              canEdit={canEdit}
              timelines={ctx.timelines}
              initial={{
                name: u.name, description: u.description, genre: u.genre, customGenre: u.customGenre ?? "", tone: u.tone ?? "",
                mainConflict: u.mainConflict ?? "", timePeriod: u.timePeriod ?? "", coreRules: u.coreRules ?? "", currentEra: u.currentEra ?? "",
                defaultTimelineId: u.defaultTimelineId ?? ctx.timelines.find((t) => t.isMain)?.id ?? "",
              }}
            />
          </SettingsSection>
          <SettingsSection id="calendar" title="Calendar" description="How dates are written everywhere in this universe. Changing names never moves events." readOnly={!canEdit}>
            <CalendarSettings worldId={worldId} canEdit={canEdit} initial={ctx.calendar} />
          </SettingsSection>
          <SettingsSection id="rules" title="Consistency & AI" description="Which contradictions the consistency checker and the Living World Engine report." readOnly={!canEdit}>
            <RuleSettings worldId={worldId} canEdit={canEdit} descriptions={RULE_DESCRIPTIONS} initial={{ rules: ctx.settings.rules, minTravelDays: ctx.settings.minTravelDays, aiEnabled: ctx.settings.aiEnabled }} />
          </SettingsSection>
          <SettingsSection id="relationships" title="Relationship types" description="Add relationship types specific to your world." readOnly={!canEdit}>
            <RelationshipTypeSettings worldId={worldId} canEdit={canEdit} types={types} />
          </SettingsSection>
          <SettingsSection id="members" title="Members" description="Owners manage everything. Editors write content, branch timelines and use AI. Viewers read.">
            <MemberSettings
              worldId={worldId}
              currentUserId={ctx.user.id}
              canManage={ctx.can("members:manage")}
              isOwner={ctx.role === "OWNER"}
              members={members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role }))}
              invitations={ctx.can("members:manage") ? invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() })) : []}
            />
          </SettingsSection>
          {ctx.can("export") ? (
            <SettingsSection id="export" title="Export" description="Your work is yours. Download everything at any time.">
              <ExportPanel worldId={worldId} />
            </SettingsSection>
          ) : null}
          {ctx.can("universe:delete") ? (
            <SettingsSection id="danger" title="Archive & delete">
              <DangerZone worldId={worldId} name={u.name} archived={!!u.archivedAt} isSample={u.isSample} />
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
