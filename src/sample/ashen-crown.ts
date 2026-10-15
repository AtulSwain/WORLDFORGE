/**
 * The Ashen Crown — WorldForge's original sample universe.
 *
 * Premise: three kingdoms compete for control of the Ember Road, an ancient trade route,
 * after the imperial Aurelian dynasty vanished on the Cinder Night. A disputed succession
 * in Veyr threatens to turn the fragile Concord of Greyford into open war.
 *
 * Pure data: records reference each other by stable keys, resolved to ids at instantiation.
 */

import type { CharacterAttributes, FactionAttributes, GenericAttributes, LocationAttributes, ArtifactAttributes } from "@/domain/schemas";

type Key = string;

export interface SampleEntity {
  key: Key;
  type: "CHARACTER" | "FACTION" | "LOCATION" | "ARTIFACT" | "MAGIC_SYSTEM" | "RELIGION" | "SPECIES" | "CULTURE";
  name: string;
  summary: string;
  description?: string;
  status: string;
  beginYear?: number;
  endYear?: number;
  attributes?: Partial<CharacterAttributes & FactionAttributes & LocationAttributes & ArtifactAttributes & GenericAttributes>;
  map?: [number, number];
}

export interface SampleEvent {
  key: Key;
  title: string;
  eventType: string;
  description: string;
  start: [number, number?, number?];
  end?: [number, number?, number?];
  precision: "DAY" | "MONTH" | "YEAR" | "CIRCA" | "DECADE" | "CENTURY" | "ERA";
  importance: number;
  location?: Key;
  participants?: [Key, string][];
}

export interface SampleRelationship {
  source: Key;
  type: string;
  target: Key;
  from?: number;
  to?: number;
  origin?: Key;
  end?: Key;
  description?: string;
}

export const CALENDAR = {
  yearLabel: "Year",
  eraSuffix: "AC",
  negativeEraSuffix: "BC",
  monthNames: [
    "Frostwane", "Thawmonth", "Seedfall", "Greening", "Highsun", "Emberlight",
    "Harvestide", "Goldleaf", "Mistmarch", "Duskfall", "Ashmonth", "Deepwinter",
  ],
  eras: [
    { name: "Age of the Sunken Throne", startYear: -400 },
    { name: "Long Ember", startYear: 0 },
    { name: "Concord Years", startYear: 842 },
    { name: "War of the Ashen Crown", startYear: 853 },
  ],
  currentYear: 858,
};

export const UNIVERSE = {
  name: "The Ashen Crown",
  description:
    "Eight centuries after the Aurelian emperors vanished in a single night of fire, three kingdoms contend for the Ember Road — the only safe passage across the Glass Wastes. A fragile treaty holds the peace, until a king is murdered and a forgotten bloodline returns to claim the crown that burns the unworthy.",
  genre: "HIGH_FANTASY" as const,
  tone: "Political, melancholic, grounded — magic is rare, costly and feared.",
  mainConflict: "Who inherits the Ember Road — and the Ashen Crown — when the Concord of Greyford collapses?",
  timePeriod: "Late Long Ember (Years 815–858 AC)",
  coreRules:
    "Cinderwork draws on cinderglass and always costs the wielder warmth and years.\nNo one has worn the Ashen Crown and lived since the Cinder Night.\nThe Ember Road is the only reliable crossing of the Glass Wastes.",
  currentEra: "War of the Ashen Crown",
};

export const ENTITIES: SampleEntity[] = [
  // ── Factions ──
  { key: "veyr", type: "FACTION", name: "Kingdom of Veyr", status: "ACTIVE", beginYear: 12,
    summary: "Highland kingdom of stone holds and cold rivers, ruled by House Caldris from Highmarch.",
    attributes: { kind: "Kingdom", emblem: "A silver stag beneath a broken crown", ideology: "Duty to the realm above blood; a king rules by the consent of the high lords.", government: "Hereditary monarchy with a council of high lords", resources: ["Iron", "Wool", "Thornwall Pass tolls"], militaryStrength: "Disciplined heavy infantry; few ships", reputation: "Stubborn, honourable, poor.", secretObjectives: "Secure an outlet to the sea through the western Ember Road.", internalDivisions: "The southern lords resent Highmarch's tolls." } },
  { key: "maren", type: "FACTION", name: "Kingdom of Maren", status: "ACTIVE", beginYear: 40,
    summary: "Wealthy maritime kingdom on the western coast, master of the Ember Road's sea terminus.",
    attributes: { kind: "Kingdom", emblem: "Three white gulls over a salt wave", ideology: "Trade is the true crown; every war is a ledger.", government: "Monarchy advised by the Admiralty and the salt houses", resources: ["Salt", "Shipping", "Customs of Port Ilvane"], militaryStrength: "The strongest fleet of the western sea", reputation: "Rich, pragmatic, untrustworthy.", secretObjectives: "Bind Veyr's throne to House Ivell through marriage." } },
  { key: "kesh", type: "FACTION", name: "Kesh Dominion", status: "ACTIVE", beginYear: 77,
    summary: "Desert dominion at the eastern end of the Ember Road, ruled by the Dominars of House Venn.",
    attributes: { kind: "Kingdom", emblem: "A black sun over a glass dune", ideology: "The Road was imperial; the empire's heirs are those who hold it.", government: "Dominarchy — an elected ruler chosen from House Venn by the caravan clans", resources: ["Cinderglass", "Caravans", "Horses"], militaryStrength: "Fast cavalry and glass-armoured outriders", reputation: "Proud, patient, dangerous.", secretObjectives: "Control the Glass Wastes crossing absolutely." } },
  { key: "compact", type: "FACTION", name: "Ember Road Compact", status: "ACTIVE", beginYear: 310,
    summary: "Guild of caravan houses and wayfort keepers that maintains the Ember Road.",
    attributes: { kind: "Guild", emblem: "A lantern on a milestone", ideology: "The Road belongs to those who keep it open.", government: "Council of caravan houses led by a Guildmistress", resources: ["Wayforts", "Credit", "Maps of the Wastes"], reputation: "Neutral, until paid otherwise." } },
  { key: "order", type: "FACTION", name: "Order of the Veiled Flame", status: "ACTIVE", beginYear: -120,
    summary: "Ancient order of cinderwrights sworn to keep imperial relics from those who would misuse them.",
    attributes: { kind: "Religious order", emblem: "A flame behind a grey veil", ideology: "Fire remembers. Power must be kept, never wielded.", government: "Grand Warden and the Conclave of Ash", resources: ["Cinderglass archives", "Kestrel Abbey"], secretObjectives: "Ensure the Ashen Crown is never worn again." } },
  { key: "hollow", type: "FACTION", name: "The Hollow Court", status: "ACTIVE", beginYear: 3,
    summary: "Secret society loyal to the vanished Aurelian dynasty, patient for eight centuries.",
    attributes: { kind: "Secret society", emblem: "An empty throne", ideology: "The empire never ended; it only waits.", government: "A hidden council of 'Chamberlains'", resources: ["Spies in every court", "Aurelian genealogies"], secretObjectives: "Crown an Aurelian heir with the Ashen Crown.", reputation: "Considered a legend by most." } },

  // ── Characters ──
  { key: "aldren", type: "CHARACTER", name: "Aldren Caldris", status: "DECEASED", beginYear: 818, endYear: 851,
    summary: "Prince who signed the Concord of Greyford, later King of Veyr; murdered in his sixth year on the throne.",
    attributes: { aliases: ["The Peacemaker", "King Aldren I"], species: "Human", gender: "Male", occupation: "King of Veyr", role: "Deuteragonist", personality: "Earnest, careful, slow to anger and slower to forgive himself.", motivations: ["End the cycle of border wars", "Earn his father's respect"], fears: ["Becoming the warlord his father was"], strengths: ["Diplomacy", "Patience"], flaws: ["Trusts the wrong counsellors", "Avoids confrontation"], values: ["Peace", "Honour"], backstory: "Second-born and unexpected heir after his elder brother drowned, Aldren was raised for scholarship, not war. He fought at Thornwall Pass and never spoke of it.", goals: "Turn the Concord into a lasting union of the western kingdoms.", secrets: "Suspected Corvin Ashvale's double loyalty months before his death.", turningPoints: ["Battle of Thornwall Pass", "Treaty of Greyford", "Coronation"] }, },
  { key: "ysolde", type: "CHARACTER", name: "Ysolde Caldris", status: "ALIVE", beginYear: 821,
    summary: "Aldren's younger sister, trained by the Order; seized the throne of Veyr during the succession crisis.",
    attributes: { aliases: ["Queen of Ash"], species: "Human", gender: "Female", occupation: "Queen of Veyr", role: "Protagonist", personality: "Sharp, impatient, fiercely loyal; hides grief behind decisiveness.", motivations: ["Avenge Aldren", "Keep the Crown from the Hollow Court"], fears: ["That the Order's teachings were right about her"], strengths: ["Strategy", "Will"], flaws: ["Ruthless when cornered"], beliefs: ["A crown is a burden, not a prize"], arc: "From reluctant heir to a queen who must decide whether to wear the Ashen Crown herself.", internalConflict: "Duty to Veyr vs. the Order's oath never to wield the Crown.", externalConflict: "Seren Vale's claim and the collapse of the Concord." } },
  { key: "oswin", type: "CHARACTER", name: "Oswin Caldris", status: "DECEASED", beginYear: 790, endYear: 846,
    summary: "King of Veyr for three decades; waged the Salt War and died of a winter fever.",
    attributes: { aliases: ["The Iron Stag"], species: "Human", gender: "Male", occupation: "King of Veyr", personality: "Hard, proud, quietly afraid of history's judgement." } },
  { key: "corvin", type: "CHARACTER", name: "Corvin Ashvale", status: "ALIVE", beginYear: 812,
    summary: "Spymaster of Veyr and secret Chamberlain of the Hollow Court; architect of Aldren's murder.",
    attributes: { aliases: ["The Grey Ledger"], species: "Human", gender: "Male", occupation: "Master of Whispers", role: "Antagonist", motivations: ["Restore the Aurelian empire"], secrets: "Has served the Hollow Court since boyhood.", flaws: ["Believes himself the only patient man alive"] } },
  { key: "maelis", type: "CHARACTER", name: "Maelis Ivell", status: "ALIVE", beginYear: 805,
    summary: "Queen of Maren, shrewd negotiator of the Concord and mother of Lirien and Teodric.",
    attributes: { species: "Human", gender: "Female", occupation: "Queen of Maren", motivations: ["Secure Maren's fortune for her children"], strengths: ["Negotiation", "Memory for debts"] } },
  { key: "lirien", type: "CHARACTER", name: "Lirien Ivell", status: "ALIVE", beginYear: 824,
    summary: "Princess of Maren and Aldren's wife; exiled from Veyr after his murder.",
    attributes: { species: "Human", gender: "Female", occupation: "Queen consort of Veyr (former)", motivations: ["Clear her name", "Protect her unborn child's claim"] } },
  { key: "teodric", type: "CHARACTER", name: "Teodric Ivell", status: "ALIVE", beginYear: 828,
    summary: "Crown prince of Maren; pushes his mother toward war after Lirien's exile.",
    attributes: { species: "Human", gender: "Male", occupation: "Crown Prince of Maren" } },
  { key: "saqqar", type: "CHARACTER", name: "Saqqar Venn", status: "DECEASED", beginYear: 800, endYear: 849,
    summary: "Dominar of Kesh who witnessed the Concord and kept Kesh neutral for a generation.",
    attributes: { species: "Human", gender: "Male", occupation: "Dominar of Kesh" } },
  { key: "rahel", type: "CHARACTER", name: "Rahel Venn", status: "ALIVE", beginYear: 826,
    summary: "Saqqar's son and successor; believes the Ember Road should be Kesh's alone.",
    attributes: { species: "Human", gender: "Male", occupation: "Dominar of Kesh", motivations: ["Undo his father's 'surrender' at Greyford"] } },
  { key: "edda", type: "CHARACTER", name: "Edda Thorne", status: "ALIVE", beginYear: 795,
    summary: "Grand Warden of the Order of the Veiled Flame; mentor to Ysolde and Calix.",
    attributes: { species: "Human", gender: "Female", occupation: "Grand Warden", beliefs: ["The Crown must never be worn"] } },
  { key: "calix", type: "CHARACTER", name: "Calix Morrow", status: "ALIVE", beginYear: 830,
    summary: "Young cinderwright who unearthed the Ashen Crown in the ruins of Solenne.",
    attributes: { species: "Human", gender: "Male", occupation: "Cinderwright of the Order", strengths: ["Cinderwork", "Curiosity"], flaws: ["Reckless with his own years"] } },
  { key: "hesper", type: "CHARACTER", name: "Hesper Quill", status: "DECEASED", beginYear: 808, endYear: 856,
    summary: "Guildmistress of the Ember Road Compact and guarantor of the Concord.",
    attributes: { species: "Human", gender: "Female", occupation: "Guildmistress", motivations: ["Keep the Road open, whoever rules it"] } },
  { key: "jorund", type: "CHARACTER", name: "Jorund Hale", status: "ALIVE", beginYear: 815,
    summary: "Veyr's marshal, victor of Thornwall Pass and Aldren's old sword-master.",
    attributes: { species: "Human", gender: "Male", occupation: "Lord Marshal of Veyr" } },
  { key: "seren", type: "CHARACTER", name: "Seren Vale", status: "ALIVE", beginYear: 834,
    summary: "Raised in the marshes of Cairn Hollow, revealed as the last heir of the Aurelian bloodline.",
    attributes: { aliases: ["The Last Aurelian"], species: "Human", gender: "Non-binary", occupation: "Pretender to the imperial throne", role: "Antagonist", internalConflict: "Unsure whether they are an heir or a puppet." } },
  { key: "nerys", type: "CHARACTER", name: "Nerys Ashvale", status: "ALIVE", beginYear: 829,
    summary: "Corvin's daughter and the blade that killed King Aldren.",
    attributes: { species: "Human", gender: "Female", occupation: "Assassin" } },
  { key: "bram", type: "CHARACTER", name: "Bram Ostrel", status: "ALIVE", beginYear: 819,
    summary: "Admiral of Maren's fleet; commanded the blockade of Port Ilvane.",
    attributes: { species: "Human", gender: "Male", occupation: "Admiral of Maren" } },
  { key: "aurel", type: "CHARACTER", name: "Emperor Aurel IX", status: "MISSING", beginYear: -42, endYear: 0,
    summary: "Last Aurelian emperor, who vanished with his court on the Cinder Night.",
    attributes: { species: "Human", gender: "Male", occupation: "Emperor of Solenne" } },

  // ── Locations ──
  { key: "highmarch", type: "LOCATION", name: "Highmarch", status: "INHABITED", beginYear: 12, map: [1080, 470],
    summary: "Granite capital of Veyr, built into the shoulder of the Greymantle.", attributes: { category: "Capital", climate: "Cold, wet", population: "c. 40,000" } },
  { key: "saltmere", type: "LOCATION", name: "Saltmere", status: "INHABITED", beginYear: 40, map: [455, 780],
    summary: "Maren's white-walled harbour capital and the busiest port of the western sea.", attributes: { category: "Capital", climate: "Mild, maritime", population: "c. 90,000" } },
  { key: "qirath", type: "LOCATION", name: "Qirath", status: "INHABITED", beginYear: 77, map: [1980, 680],
    summary: "Domed capital of the Kesh Dominion at the eastern gate of the Ember Road.", attributes: { category: "Capital", climate: "Arid", population: "c. 60,000" } },
  { key: "solenne", type: "LOCATION", name: "Solenne", status: "DESTROYED", beginYear: -400, endYear: 0, map: [1290, 1080],
    summary: "Ruined imperial capital, half-drowned in a lake of black glass since the Cinder Night.", attributes: { category: "Ruin", notableFeatures: ["The Sunken Throne", "Glass lake"] } },
  { key: "greyford", type: "LOCATION", name: "Greyford", status: "INHABITED", beginYear: 120, map: [930, 860],
    summary: "Neutral river-crossing town where the Concord was signed.", attributes: { category: "Town", notableFeatures: ["The Ford Hall", "Compact wayfort"] } },
  { key: "thornwall", type: "LOCATION", name: "Thornwall Pass", status: "INHABITED", map: [790, 600],
    summary: "Narrow mountain pass guarding Veyr's southwestern border.", attributes: { category: "Pass" } },
  { key: "ilvane", type: "LOCATION", name: "Port Ilvane", status: "INHABITED", map: [300, 1060],
    summary: "Deep-water port at the western terminus of the Ember Road, fought over in the Salt War.", attributes: { category: "Port" } },
  { key: "wastes", type: "LOCATION", name: "The Glass Wastes", status: "UNKNOWN", map: [1700, 1080],
    summary: "Desert of fused sand and cinderglass left by the fire that consumed the empire.", attributes: { category: "Desert", climate: "Lethal by day" } },
  { key: "ember_road", type: "LOCATION", name: "The Ember Road", status: "INHABITED", beginYear: -300, map: [1480, 930],
    summary: "Ancient imperial road from Port Ilvane to Qirath; the only safe crossing of the Glass Wastes.", attributes: { category: "Trade route" } },
  { key: "kestrel", type: "LOCATION", name: "Kestrel Abbey", status: "INHABITED", beginYear: -110, map: [1500, 320],
    summary: "Mountain seat of the Order of the Veiled Flame, where the Ashen Crown is kept.", attributes: { category: "Abbey" } },
  { key: "cairn", type: "LOCATION", name: "Cairn Hollow", status: "INHABITED", map: [640, 1280],
    summary: "Fog-bound marsh village hiding the Hollow Court's oldest sanctuary.", attributes: { category: "Village" } },
  { key: "duskmere", type: "LOCATION", name: "Duskmere", status: "ABANDONED", map: [1560, 1360],
    summary: "Drowned fortress south of the Wastes, used as a smugglers' haven.", attributes: { category: "Fortress" } },

  // ── Artifacts, systems, beliefs ──
  { key: "crown", type: "ARTIFACT", name: "The Ashen Crown", status: "INTACT", beginYear: -400,
    summary: "Crown of the Aurelian emperors. It is said to burn any wearer not of imperial blood.",
    attributes: { material: "Cinderglass and blackened gold", powers: "Grants dominion over cinderglass; legitimises any claim to the imperial throne.", origin: "Forged for the first Aurelian emperor in the Age of the Sunken Throne." } },
  { key: "seal", type: "ARTIFACT", name: "The Concord Seal", status: "INTACT", beginYear: 842,
    summary: "Three-part seal pressed onto the Treaty of Greyford; each kingdom holds one part.",
    attributes: { material: "Silver", origin: "Struck by the Compact for the Concord of Greyford." } },
  { key: "cinderwork", type: "MAGIC_SYSTEM", name: "Cinderwork", status: "WANING",
    summary: "Magic drawn from cinderglass; every working costs the wielder warmth and years of life.",
    attributes: { notes: "Practised openly only by the Order of the Veiled Flame. Hollow Court adepts practise it in secret.", properties: [{ key: "Source", value: "Cinderglass shards" }, { key: "Cost", value: "Body heat and lifespan" }] } },
  { key: "faith", type: "RELIGION", name: "Faith of the Veiled Flame", status: "ACTIVE", beginYear: -300,
    summary: "Belief that the fire of the Cinder Night was judgement, and that remembrance is a sacred duty.",
    attributes: { notes: "State faith of Veyr; tolerated in Maren; rejected in Kesh." } },
];

export const EVENTS: SampleEvent[] = [
  { key: "cinder_night", title: "The Cinder Night", eventType: "DISASTER", start: [0, 11, 30], precision: "DAY", importance: 5, location: "solenne",
    description: "In a single night, fire falls on Solenne. The Aurelian emperor and his court vanish; the imperial capital sinks into a lake of black glass.",
    participants: [["aurel", "VICTIM"], ["order", "WITNESS"]] },
  { key: "hollow_founding", title: "Founding of the Hollow Court", eventType: "FOUNDING", start: [3], precision: "CIRCA", importance: 3, location: "cairn",
    description: "Surviving chamberlains of the imperial household swear to preserve the Aurelian line in secret.", participants: [["hollow", "PROTAGONIST"]] },
  { key: "veyr_founding", title: "Founding of the Kingdom of Veyr", eventType: "FOUNDING", start: [12], precision: "YEAR", importance: 4, location: "highmarch",
    description: "Highland lords crown the first Caldris king in the hall of Highmarch.", participants: [["veyr", "PROTAGONIST"]] },
  { key: "maren_founding", title: "Founding of the Kingdom of Maren", eventType: "FOUNDING", start: [40], precision: "YEAR", importance: 4, location: "saltmere",
    description: "The salt houses of the coast unite under House Ivell.", participants: [["maren", "PROTAGONIST"]] },
  { key: "kesh_rise", title: "Rise of the Kesh Dominion", eventType: "FOUNDING", start: [77], precision: "CIRCA", importance: 4, location: "qirath",
    description: "Caravan clans elect the first Dominar to guard the eastern end of the Road.", participants: [["kesh", "PROTAGONIST"]] },
  { key: "compact_charter", title: "Charter of the Ember Road Compact", eventType: "FOUNDING", start: [310], precision: "YEAR", importance: 3, location: "greyford",
    description: "Caravan houses form a guild to maintain wayforts along the Ember Road.", participants: [["compact", "PROTAGONIST"]] },
  { key: "oswin_coronation", title: "Coronation of Oswin Caldris", eventType: "CORONATION", start: [815, 4, 2], precision: "DAY", importance: 3, location: "highmarch",
    description: "Oswin, the Iron Stag, is crowned King of Veyr.", participants: [["oswin", "PROTAGONIST"], ["veyr", "PARTICIPANT"]] },
  { key: "maelis_coronation", title: "Coronation of Maelis Ivell", eventType: "CORONATION", start: [830, 6], precision: "MONTH", importance: 3, location: "saltmere",
    description: "Maelis takes the gull crown of Maren after her father's abdication.", participants: [["maelis", "PROTAGONIST"], ["maren", "PARTICIPANT"]] },
  { key: "salt_war", title: "The Salt War", eventType: "WAR", start: [836, 3], end: [839, 10], precision: "MONTH", importance: 4, location: "ilvane",
    description: "Veyr and Maren fight over Port Ilvane and the western terminus of the Ember Road.",
    participants: [["veyr", "PARTICIPANT"], ["maren", "PARTICIPANT"], ["oswin", "COMMANDER"], ["maelis", "COMMANDER"], ["jorund", "COMMANDER"], ["bram", "COMMANDER"]] },
  { key: "thornwall_battle", title: "Battle of Thornwall Pass", eventType: "BATTLE", start: [838, 6, 14], precision: "DAY", importance: 3, location: "thornwall",
    description: "Jorund Hale and the young Prince Aldren hold the pass against a Maren landing force. Aldren's first and last battle.",
    participants: [["jorund", "COMMANDER"], ["aldren", "PARTICIPANT"], ["veyr", "PARTICIPANT"], ["maren", "ANTAGONIST"]] },
  { key: "treaty", title: "Treaty of Greyford", eventType: "TREATY", start: [842, 2, 9], precision: "DAY", importance: 5, location: "greyford",
    description: "Prince Aldren signs the Concord for Veyr with Queen Maelis of Maren, ending the Salt War. The Compact guarantees free passage on the Ember Road; Dominar Saqqar of Kesh witnesses.",
    participants: [["aldren", "SIGNATORY"], ["maelis", "SIGNATORY"], ["hesper", "SIGNATORY"], ["saqqar", "WITNESS"], ["veyr", "PARTICIPANT"], ["maren", "PARTICIPANT"], ["compact", "PARTICIPANT"]] },
  { key: "royal_wedding", title: "Marriage of Aldren and Lirien", eventType: "CEREMONY", start: [843, 5, 21], precision: "DAY", importance: 3, location: "saltmere",
    description: "The Concord is sealed in blood: Prince Aldren weds Princess Lirien of Maren.", participants: [["aldren", "PROTAGONIST"], ["lirien", "PROTAGONIST"], ["maelis", "WITNESS"]] },
  { key: "road_reopening", title: "Reopening of the Ember Road", eventType: "POLITICAL", start: [845], precision: "YEAR", importance: 4, location: "ember_road",
    description: "For the first time in a generation, caravans cross from Port Ilvane to Qirath without paying war tolls.", participants: [["compact", "PROTAGONIST"], ["hesper", "PROTAGONIST"]] },
  { key: "oswin_death", title: "Death of King Oswin", eventType: "DEATH", start: [846, 1, 17], precision: "DAY", importance: 4, location: "highmarch",
    description: "The Iron Stag dies of a winter fever.", participants: [["oswin", "VICTIM"]] },
  { key: "aldren_coronation", title: "Coronation of Aldren Caldris", eventType: "CORONATION", start: [846, 3, 3], precision: "DAY", importance: 4, location: "highmarch",
    description: "Aldren is crowned King of Veyr. Grand Warden Edda Thorne attends at Ysolde's request.", participants: [["aldren", "PROTAGONIST"], ["ysolde", "WITNESS"], ["edda", "OBSERVER"], ["corvin", "WITNESS"]] },
  { key: "crown_found", title: "Rediscovery of the Ashen Crown", eventType: "DISCOVERY", start: [847, 8], precision: "MONTH", importance: 5, location: "solenne",
    description: "Calix Morrow recovers the Ashen Crown from the Sunken Throne. The Order hides it at Kestrel Abbey — but word escapes.", participants: [["calix", "PROTAGONIST"], ["order", "PARTICIPANT"], ["crown", "PARTICIPANT"]] },
  { key: "saqqar_succession", title: "Succession of Dominar Rahel", eventType: "SUCCESSION", start: [849, 9], precision: "MONTH", importance: 3, location: "qirath",
    description: "Saqqar Venn dies; the caravan clans elect his son Rahel, who calls the Concord a surrender.", participants: [["saqqar", "VICTIM"], ["rahel", "PROTAGONIST"], ["kesh", "PARTICIPANT"]] },
  { key: "seren_revealed", title: "Seren Vale Revealed", eventType: "POLITICAL", start: [850, 10], precision: "MONTH", importance: 4, location: "cairn",
    description: "The Hollow Court reveals Seren Vale, last of the Aurelian line, to a gathering of disaffected lords.", participants: [["seren", "PROTAGONIST"], ["corvin", "INSTIGATOR"], ["hollow", "PARTICIPANT"]] },
  { key: "assassination", title: "Assassination of King Aldren", eventType: "ASSASSINATION", start: [851, 11, 3], precision: "DAY", importance: 5, location: "highmarch",
    description: "Aldren is stabbed in the chapel of Highmarch by Nerys Ashvale. Corvin Ashvale blames Queen Lirien and her Maren retinue.",
    participants: [["aldren", "VICTIM"], ["nerys", "ANTAGONIST"], ["corvin", "INSTIGATOR"], ["lirien", "WITNESS"]] },
  { key: "succession_crisis", title: "The Succession Crisis of Veyr", eventType: "SUCCESSION", start: [851, 11], end: [852, 4], precision: "MONTH", importance: 5, location: "highmarch",
    description: "Lirien is exiled; Ysolde claims the throne; the Hollow Court presses Seren Vale's imperial claim over Veyr's lords.",
    participants: [["ysolde", "PROTAGONIST"], ["seren", "ANTAGONIST"], ["lirien", "VICTIM"], ["corvin", "INSTIGATOR"], ["jorund", "ALLY"]] },
  { key: "ysolde_coronation", title: "Coronation of Queen Ysolde", eventType: "CORONATION", start: [852, 4, 12], precision: "DAY", importance: 4, location: "highmarch",
    description: "Ysolde is crowned Queen of Veyr with Jorund Hale's army at her back.", participants: [["ysolde", "PROTAGONIST"], ["jorund", "ALLY"], ["edda", "WITNESS"]] },
  { key: "concord_broken", title: "Breaking of the Concord", eventType: "BETRAYAL", start: [853, 2], precision: "MONTH", importance: 5, location: "saltmere",
    description: "Maren repudiates the Treaty of Greyford over Lirien's exile. Kesh closes the eastern Road.", participants: [["maelis", "INSTIGATOR"], ["teodric", "INSTIGATOR"], ["rahel", "ALLY"], ["maren", "PARTICIPANT"], ["kesh", "PARTICIPANT"]] },
  { key: "crown_war", title: "War of the Ashen Crown", eventType: "WAR", start: [853, 5], end: [858, 7], precision: "MONTH", importance: 5, location: "ember_road",
    description: "Veyr fights Maren and Kesh for the Ember Road while the Hollow Court hunts for the Crown.",
    participants: [["veyr", "PARTICIPANT"], ["maren", "PARTICIPANT"], ["kesh", "PARTICIPANT"], ["hollow", "INSTIGATOR"], ["ysolde", "COMMANDER"], ["rahel", "COMMANDER"], ["teodric", "COMMANDER"], ["jorund", "COMMANDER"]] },
  { key: "saltmere_siege", title: "Siege of Saltmere", eventType: "BATTLE", start: [855, 6], end: [855, 9], precision: "MONTH", importance: 4, location: "saltmere",
    description: "Veyr besieges Saltmere by land while Admiral Bram Ostrel holds the harbour.", participants: [["ysolde", "COMMANDER"], ["jorund", "COMMANDER"], ["bram", "COMMANDER"], ["teodric", "COMMANDER"]] },
  { key: "truce", title: "Truce of Kestrel Abbey", eventType: "TREATY", start: [858, 7, 1], precision: "DAY", importance: 5, location: "kestrel",
    description: "Exhausted, the three crowns agree a truce under the Order's protection. The fate of the Ashen Crown remains unresolved. (Archivist's note: Hesper Quill's signature appears on the truce despite her recorded death.)",
    participants: [["ysolde", "SIGNATORY"], ["maelis", "SIGNATORY"], ["rahel", "SIGNATORY"], ["edda", "WITNESS"], ["hesper", "SIGNATORY"]] },
];

/** source CAUSES / ENABLES / … target */
export const DEPENDENCIES: [Key, "CAUSES" | "ENABLES" | "PREVENTS" | "PRECEDES" | "CONTRIBUTES_TO", Key][] = [
  ["cinder_night", "CAUSES", "hollow_founding"],
  ["cinder_night", "ENABLES", "veyr_founding"],
  ["salt_war", "CAUSES", "treaty"],
  ["thornwall_battle", "CONTRIBUTES_TO", "treaty"],
  ["treaty", "ENABLES", "royal_wedding"],
  ["treaty", "CAUSES", "road_reopening"],
  ["oswin_death", "CAUSES", "aldren_coronation"],
  ["crown_found", "ENABLES", "seren_revealed"],
  ["seren_revealed", "CONTRIBUTES_TO", "assassination"],
  ["assassination", "CAUSES", "succession_crisis"],
  ["succession_crisis", "CAUSES", "ysolde_coronation"],
  ["succession_crisis", "CAUSES", "concord_broken"],
  ["concord_broken", "CAUSES", "crown_war"],
  ["crown_found", "CONTRIBUTES_TO", "crown_war"],
  ["saltmere_siege", "CONTRIBUTES_TO", "truce"],
  ["crown_war", "PRECEDES", "truce"],
  ["treaty", "PREVENTS", "crown_war"],
];

export const RELATIONSHIPS: SampleRelationship[] = [
  // Rule & succession
  { source: "oswin", type: "RULES", target: "veyr", from: 815, to: 846, origin: "oswin_coronation", end: "oswin_death" },
  { source: "aldren", type: "RULES", target: "veyr", from: 846, to: 851, origin: "aldren_coronation", end: "assassination" },
  { source: "ysolde", type: "RULES", target: "veyr", from: 852, origin: "ysolde_coronation" },
  { source: "aldren", type: "SUCCESSOR_OF", target: "oswin", from: 846 },
  { source: "ysolde", type: "SUCCESSOR_OF", target: "aldren", from: 852 },
  { source: "maelis", type: "RULES", target: "maren", from: 830, origin: "maelis_coronation" },
  { source: "saqqar", type: "RULES", target: "kesh", from: 819, to: 849, end: "saqqar_succession" },
  { source: "rahel", type: "RULES", target: "kesh", from: 849, origin: "saqqar_succession" },
  { source: "rahel", type: "SUCCESSOR_OF", target: "saqqar", from: 849 },
  { source: "hesper", type: "RULES", target: "compact", from: 829, to: 856 },
  { source: "edda", type: "RULES", target: "order", from: 820 },
  { source: "corvin", type: "RULES", target: "hollow", from: 840, description: "First Chamberlain" },
  // Family
  { source: "oswin", type: "PARENT_OF", target: "aldren" },
  { source: "oswin", type: "PARENT_OF", target: "ysolde" },
  { source: "aldren", type: "SIBLING_OF", target: "ysolde" },
  { source: "maelis", type: "PARENT_OF", target: "lirien" },
  { source: "maelis", type: "PARENT_OF", target: "teodric" },
  { source: "lirien", type: "SIBLING_OF", target: "teodric" },
  { source: "saqqar", type: "PARENT_OF", target: "rahel" },
  { source: "corvin", type: "PARENT_OF", target: "nerys" },
  { source: "aldren", type: "MARRIED_TO", target: "lirien", from: 843, to: 851, origin: "royal_wedding", end: "assassination" },
  { source: "seren", type: "RELATED_TO", target: "aurel", description: "Descendant through a hidden line" },
  // Mentorship & friendship
  { source: "edda", type: "MENTORS", target: "ysolde", from: 835 },
  { source: "edda", type: "MENTORS", target: "calix", from: 842 },
  { source: "jorund", type: "MENTORS", target: "aldren", from: 830, to: 838 },
  { source: "calix", type: "FRIEND_OF", target: "ysolde", from: 845 },
  { source: "bram", type: "RIVAL_OF", target: "jorund", from: 836 },
  { source: "seren", type: "RIVAL_OF", target: "ysolde", from: 850 },
  { source: "corvin", type: "BETRAYS", target: "aldren", from: 851, origin: "assassination" },
  // Membership
  { source: "corvin", type: "MEMBER_OF", target: "veyr", from: 834 },
  { source: "corvin", type: "MEMBER_OF", target: "hollow", from: 826 },
  { source: "nerys", type: "MEMBER_OF", target: "hollow", from: 845 },
  { source: "seren", type: "MEMBER_OF", target: "hollow", from: 850 },
  { source: "jorund", type: "MEMBER_OF", target: "veyr" },
  { source: "calix", type: "MEMBER_OF", target: "order", from: 842 },
  { source: "bram", type: "MEMBER_OF", target: "maren" },
  { source: "teodric", type: "MEMBER_OF", target: "maren" },
  { source: "lirien", type: "MEMBER_OF", target: "veyr", from: 843, to: 851 },
  // Politics
  { source: "veyr", type: "ENEMY_OF", target: "maren", from: 836, to: 842, end: "treaty" },
  { source: "veyr", type: "ALLY_OF", target: "maren", from: 842, to: 853, origin: "treaty", end: "concord_broken" },
  { source: "maren", type: "ENEMY_OF", target: "veyr", from: 853, origin: "concord_broken" },
  { source: "kesh", type: "RIVAL_OF", target: "veyr", from: 849 },
  { source: "kesh", type: "ALLY_OF", target: "maren", from: 853, origin: "concord_broken" },
  { source: "hollow", type: "ENEMY_OF", target: "order" },
  { source: "compact", type: "CONTROLS", target: "ember_road", from: 842, origin: "treaty" },
  // Territory
  { source: "veyr", type: "CONTROLS", target: "highmarch", from: 12 },
  { source: "veyr", type: "CONTROLS", target: "thornwall" },
  { source: "maren", type: "CONTROLS", target: "saltmere", from: 40 },
  { source: "maren", type: "CONTROLS", target: "ilvane", from: 839 },
  { source: "kesh", type: "CONTROLS", target: "qirath", from: 77 },
  { source: "kesh", type: "CONTROLS", target: "wastes" },
  { source: "order", type: "CONTROLS", target: "kestrel" },
  { source: "hollow", type: "CONTROLS", target: "cairn" },
  { source: "compact", type: "CONTROLS", target: "greyford", from: 310 },
  // Births
  { source: "aldren", type: "BORN_IN", target: "highmarch" },
  { source: "ysolde", type: "BORN_IN", target: "highmarch" },
  { source: "lirien", type: "BORN_IN", target: "saltmere" },
  { source: "rahel", type: "BORN_IN", target: "qirath" },
  { source: "seren", type: "BORN_IN", target: "cairn" },
  // Artifacts, magic, faith
  { source: "aurel", type: "OWNS", target: "crown", to: 0 },
  { source: "order", type: "OWNS", target: "crown", from: 847, origin: "crown_found" },
  { source: "crown", type: "LOCATED_IN", target: "kestrel", from: 847 },
  { source: "veyr", type: "OWNS", target: "seal", from: 842, origin: "treaty", description: "Holds one third of the seal" },
  { source: "calix", type: "PRACTICES", target: "cinderwork" },
  { source: "edda", type: "PRACTICES", target: "cinderwork" },
  { source: "seren", type: "PRACTICES", target: "cinderwork" },
  { source: "order", type: "PRACTICES", target: "cinderwork" },
  { source: "veyr", type: "WORSHIPS", target: "faith" },
  { source: "order", type: "WORSHIPS", target: "faith" },
];

export const LORE: { title: string; category: string; tags: string[]; body: string; entities: Key[]; events: Key[] }[] = [
  {
    title: "The Cinder Night",
    category: "HISTORY",
    tags: ["empire", "origin"],
    entities: ["aurel", "solenne", "crown"],
    events: ["cinder_night"],
    body: `# The Cinder Night

On the last night of Ashmonth in the Year 0, fire fell on **Solenne**. By dawn the imperial city had sunk beneath a lake of black glass, and Emperor Aurel IX — with his court, his heirs and his crown — was gone.

## What the chroniclers agree on

- The fire came *from above* and burned for a single night.
- No body of any Aurelian was ever recovered.
- The sand for forty leagues around fused into the **Glass Wastes**.

## What they do not

The Order of the Veiled Flame teaches that the fire was judgement. The Hollow Court teaches that it was a door — and that what went through it may return.

> "Fire remembers." — saying of the Veiled Flame`,
  },
  {
    title: "The Treaty of Greyford",
    category: "HISTORY",
    tags: ["concord", "treaty", "salt war"],
    entities: ["aldren", "maelis", "hesper", "veyr", "maren", "compact", "seal"],
    events: ["treaty", "salt_war"],
    body: `# The Treaty of Greyford (the Concord)

Signed on the 9th of Thawmonth, Year 842 AC, in the Ford Hall of Greyford.

**Signatories:** Prince Aldren Caldris for Veyr; Queen Maelis Ivell for Maren; Guildmistress Hesper Quill for the Ember Road Compact.
**Witness:** Dominar Saqqar Venn of Kesh.

## Terms

1. The Salt War ends; Port Ilvane remains with Maren.
2. Veyr's caravans pass the western Road toll-free.
3. The Compact keeps and polices the Ember Road for all three crowns.
4. Prince Aldren shall wed Princess Lirien of Maren.

The treaty was sealed with the three-part **Concord Seal**. Its collapse in 853 began the War of the Ashen Crown.`,
  },
  {
    title: "Cinderwork",
    category: "MAGIC_SYSTEMS",
    tags: ["magic", "cost"],
    entities: ["cinderwork", "order", "calix", "edda"],
    events: [],
    body: `# Cinderwork

Cinderwork is the art of drawing heat, light and binding force out of **cinderglass** — the fused residue of the Cinder Night.

## Rules

- Every working costs the cinderwright **warmth** immediately and **years** over time.
- Cinderglass shards are consumed by use; large works need large shards.
- No cinderwright has ever created cinderglass. Supply is finite.

## Practitioners

The Order of the Veiled Flame trains cinderwrights to *preserve*, never to conquer. The Hollow Court is rumoured to keep older, crueller techniques.`,
  },
  {
    title: "The Ashen Crown",
    category: "ARTIFACTS",
    tags: ["relic", "empire"],
    entities: ["crown", "order", "calix", "seren"],
    events: ["crown_found"],
    body: `# The Ashen Crown

Crown of the Aurelian emperors, forged of cinderglass and blackened gold.

It is said to **burn any wearer not of imperial blood**. Whether this is true, no one living knows: the Crown has not been worn since the Cinder Night.

Recovered from the Sunken Throne by Calix Morrow in Goldleaf, 847 AC, it is kept at Kestrel Abbey under the Order's guard.`,
  },
  {
    title: "Laws of Succession in Veyr",
    category: "LAWS",
    tags: ["succession", "law"],
    entities: ["veyr", "aldren", "ysolde", "lirien"],
    events: ["succession_crisis"],
    body: `# Laws of Succession in Veyr

The crown passes to the eldest living child of the monarch. If the monarch dies childless, it passes to their eldest sibling — **unless** a widowed consort is with child, in which case the high lords appoint a regency until the child is born.

This clause sat at the heart of the 851 crisis: Lirien Ivell claimed to be with child; Ysolde's supporters accused her of complicity in Aldren's murder and exiled her before the claim could be tested.`,
  },
  {
    title: "The Ember Road",
    category: "GEOGRAPHY",
    tags: ["trade", "road"],
    entities: ["ember_road", "compact", "wastes", "ilvane", "qirath", "greyford"],
    events: ["road_reopening", "compact_charter"],
    body: `# The Ember Road

The only safe crossing of the Glass Wastes: an imperial road of fitted basalt running from **Port Ilvane** on the western sea, through **Saltmere** and **Greyford**, past the drowned ruins of **Solenne**, to **Qirath**.

Wayforts every twenty miles are kept by the Ember Road Compact. Whoever holds the Road holds the trade of the continent.`,
  },
  {
    title: "Faith of the Veiled Flame",
    category: "RELIGION",
    tags: ["faith"],
    entities: ["faith", "order", "veyr"],
    events: [],
    body: `# Faith of the Veiled Flame

The faith holds that the Cinder Night was a judgement on imperial pride, and that remembering it is a sacred duty. Its priests veil their lamps so the flame is never seen directly.

State faith of Veyr; tolerated in Maren; rejected outright by the Kesh Dominion, which venerates the Road itself.`,
  },
];

/** Atlas: regions & routes in map pixel coordinates (map is 2400×1600). */
export const MAP = {
  title: "The Western Reaches",
  imageSource: "/maps/ashen-crown.svg",
  width: 2400,
  height: 1600,
  regions: [
    { name: "Kingdom of Veyr", faction: "veyr", color: "#9AA6B8", polygon: [[700, 260], [1000, 220], [1320, 300], [1360, 520], [1220, 680], [960, 720], [760, 680], [660, 480]] },
    { name: "Kingdom of Maren", faction: "maren", color: "#7FA3A0", polygon: [[230, 600], [520, 560], [700, 700], [760, 880], [620, 1000], [420, 1140], [250, 1120], [200, 860]] },
    { name: "Kesh Dominion", faction: "kesh", color: "#C29A6B", polygon: [[1720, 460], [2160, 420], [2240, 760], [2120, 1100], [1840, 1180], [1640, 960], [1660, 640]] },
  ],
  routes: [
    { name: "The Ember Road", kind: "TRADE", points: [[300, 1060], [455, 780], [700, 830], [930, 860], [1150, 990], [1290, 1080], [1480, 930], [1700, 1000], [1840, 820], [1980, 680]] },
    { name: "Thornwall Road", kind: "ROAD", points: [[930, 860], [790, 600], [1080, 470]] },
    { name: "Pilgrims' Way", kind: "ROAD", points: [[1080, 470], [1300, 380], [1500, 320]] },
  ],
};

export const BRANCH = {
  name: "The Red Thaw",
  description: "What if Aldren had been murdered as a boy-prince in Year 835 — before Thornwall, before Greyford? Ysolde rules as a child queen under Corvin Ashvale's regency.",
  branchEvent: "assassination",
};

export const PROPOSAL = {
  title: "Aldren is assassinated in Year 835",
  rationale: "Explore an early death for Aldren: does the Concord still happen without him?",
  event: "assassination",
  patch: { startYear: 835, startMonth: 3, startDay: 1 },
};
