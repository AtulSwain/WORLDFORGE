import { it } from "vitest";
import { analyzeImpact } from "@/domain/impact";
import { checkConsistency } from "@/domain/consistency";
import { parseSettings } from "@/domain/schemas";
import { CALENDAR } from "@/sample/ashen-crown";
import { sampleSnapshot } from "@/sample/snapshot";
it("probe", () => {
  const s = sampleSnapshot();
  const settings = parseSettings({ minTravelDays: 3 });
  console.log(checkConsistency(s, settings, CALENDAR as never).map(f => f.severity + " " + f.title));
  const r = analyzeImpact(s, "assassination", { startYear: 835, startMonth: 3, startDay: 1 }, { settings, calendar: CALENDAR as never });
  for (const i of r.items) console.log(i.category.padEnd(16), i.strength.padEnd(9), i.basis.padEnd(22), i.title, i.suggestedChange ? "=> " + JSON.stringify(i.suggestedChange.patch) : "");
  console.log(r.stats);
});
