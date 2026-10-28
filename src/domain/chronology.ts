/**
 * Chronology: a single internal ordinal for sorting/comparison, while preserving the
 * creator's chosen precision and display format.
 *
 * ordinal = year * YEAR_SCALE + (month - 1) * MONTH_SCALE + (day - 1)
 * Missing month/day resolve to the start of the period for start dates and the end of
 * the period for end dates, so "Year 842" spans the whole year.
 */

export const YEAR_SCALE = 1000;
export const MONTH_SCALE = 40;
export const MAX_MONTHS = 24;
export const MAX_DAYS = 40;

export const DATE_PRECISIONS = ["DAY", "MONTH", "YEAR", "CIRCA", "DECADE", "CENTURY", "ERA"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export interface WorldDate {
  year: number;
  month?: number | null;
  day?: number | null;
}

export interface CalendarConfig {
  yearLabel: string;
  eraSuffix: string;
  negativeEraSuffix: string;
  monthNames: string[];
  eras: { name: string; startYear: number }[];
  currentYear?: number | null;
}

export const DEFAULT_CALENDAR: CalendarConfig = {
  yearLabel: "Year",
  eraSuffix: "",
  negativeEraSuffix: "before reckoning",
  monthNames: [],
  eras: [],
  currentYear: null,
};

export function startOrdinal(date: WorldDate): number {
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  return date.year * YEAR_SCALE + (month - 1) * MONTH_SCALE + (day - 1);
}

export function endOrdinal(date: WorldDate): number {
  if (date.month == null) return date.year * YEAR_SCALE + (YEAR_SCALE - 1);
  if (date.day == null) return date.year * YEAR_SCALE + (date.month - 1) * MONTH_SCALE + (MONTH_SCALE - 1);
  return startOrdinal(date);
}

/** Year of an ordinal (floor division keeps negative years correct). */
export function ordinalYear(ordinal: number): number {
  return Math.floor(ordinal / YEAR_SCALE);
}

export interface EventDateFields {
  startYear: number;
  startMonth?: number | null;
  startDay?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
}

/** Computes both ordinals for an event. When no end is given, the event ends at the end of its start period. */
export function eventOrdinals(fields: EventDateFields): { startOrdinal: number; endOrdinal: number | null } {
  const s = startOrdinal({ year: fields.startYear, month: fields.startMonth, day: fields.startDay });
  const e =
    fields.endYear == null
      ? null
      : endOrdinal({ year: fields.endYear, month: fields.endMonth, day: fields.endDay });
  return { startOrdinal: s, endOrdinal: e };
}

/** Effective span used for overlap checks (an event without an end occupies its start period). */
export function eventSpan(fields: EventDateFields): [number, number] {
  const s = startOrdinal({ year: fields.startYear, month: fields.startMonth, day: fields.startDay });
  const e =
    fields.endYear == null
      ? endOrdinal({ year: fields.startYear, month: fields.startMonth, day: fields.startDay })
      : endOrdinal({ year: fields.endYear, month: fields.endMonth, day: fields.endDay });
  return [s, e];
}

export function formatYear(year: number, cal: CalendarConfig = DEFAULT_CALENDAR): string {
  if (year < 0) {
    return `${cal.yearLabel} ${Math.abs(year)}${cal.negativeEraSuffix ? ` ${cal.negativeEraSuffix}` : ""}`.trim();
  }
  return `${cal.yearLabel} ${year}${cal.eraSuffix ? ` ${cal.eraSuffix}` : ""}`.trim();
}

function monthName(month: number, cal: CalendarConfig): string {
  return cal.monthNames[month - 1] ?? `Month ${month}`;
}

function ordinalSuffix(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatWorldDate(
  date: WorldDate,
  precision: DatePrecision,
  cal: CalendarConfig = DEFAULT_CALENDAR,
): string {
  switch (precision) {
    case "DAY":
      if (date.month != null && date.day != null) {
        return `${date.day} ${monthName(date.month, cal)}, ${formatYear(date.year, cal)}`;
      }
      return formatYear(date.year, cal);
    case "MONTH":
      if (date.month != null) return `${monthName(date.month, cal)}, ${formatYear(date.year, cal)}`;
      return formatYear(date.year, cal);
    case "CIRCA":
      return `c. ${formatYear(date.year, cal)}`;
    case "DECADE": {
      const decade = Math.floor(date.year / 10) * 10;
      return `the ${decade}s${cal.eraSuffix ? ` ${cal.eraSuffix}` : ""}`;
    }
    case "CENTURY": {
      const century = Math.floor(date.year / 100) + 1;
      return `${ordinalSuffix(century)} century${cal.eraSuffix ? ` ${cal.eraSuffix}` : ""}`;
    }
    case "ERA": {
      const era = eraForYear(date.year, cal);
      return era ? `the ${era.name}` : `c. ${formatYear(date.year, cal)}`;
    }
    case "YEAR":
    default:
      return formatYear(date.year, cal);
  }
}

export function formatEventDate(
  ev: EventDateFields & { precision: DatePrecision; displayDate?: string | null },
  cal: CalendarConfig = DEFAULT_CALENDAR,
): string {
  if (ev.displayDate) return ev.displayDate;
  const start = formatWorldDate({ year: ev.startYear, month: ev.startMonth, day: ev.startDay }, ev.precision, cal);
  if (ev.endYear == null) return start;
  const sameYear = ev.endYear === ev.startYear;
  if (sameYear && ev.endMonth == null) return start;
  const end = formatWorldDate({ year: ev.endYear, month: ev.endMonth, day: ev.endDay }, ev.precision === "CIRCA" ? "YEAR" : ev.precision, cal);
  return `${start} – ${end}`;
}

export function eraForYear(year: number, cal: CalendarConfig): { name: string; startYear: number } | null {
  const sorted = [...cal.eras].sort((a, b) => a.startYear - b.startYear);
  let found: { name: string; startYear: number } | null = null;
  for (const era of sorted) {
    if (era.startYear <= year) found = era;
  }
  return found;
}

/** Validates an end date against a start date; returns an error message or null. */
export function validateDateOrder(fields: EventDateFields): string | null {
  if (fields.endYear == null) return null;
  const s = startOrdinal({ year: fields.startYear, month: fields.startMonth, day: fields.startDay });
  const e = endOrdinal({ year: fields.endYear, month: fields.endMonth, day: fields.endDay });
  if (e < s) return "The event ends before it starts.";
  return null;
}

export const TIME_SCALES = ["ERA", "CENTURY", "DECADE", "YEAR", "MONTH", "DAY"] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

/** Ordinal width of one tick for each zoom scale. */
export function scaleTickSize(scale: TimeScale): number {
  switch (scale) {
    case "ERA":
      return YEAR_SCALE * 250;
    case "CENTURY":
      return YEAR_SCALE * 100;
    case "DECADE":
      return YEAR_SCALE * 10;
    case "YEAR":
      return YEAR_SCALE;
    case "MONTH":
      return MONTH_SCALE;
    case "DAY":
      return 1;
  }
}
