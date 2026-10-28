import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALENDAR, endOrdinal, eraForYear, eventOrdinals, eventSpan, formatEventDate, formatWorldDate, formatYear, ordinalYear,
  startOrdinal, validateDateOrder, type CalendarConfig,
} from "@/domain/chronology";

const cal: CalendarConfig = { ...DEFAULT_CALENDAR, eraSuffix: "AC", monthNames: ["Frostwane", "Thawmonth"], eras: [{ name: "Long Ember", startYear: 0 }, { name: "Concord Years", startYear: 842 }] };

describe("chronology", () => {
  it("orders dates by year, month and day", () => {
    expect(startOrdinal({ year: 851, month: 11, day: 3 })).toBe(851 * 1000 + 10 * 40 + 2);
    expect(startOrdinal({ year: 851 })).toBeLessThan(startOrdinal({ year: 851, month: 2 }));
    expect(startOrdinal({ year: 851, month: 2 })).toBeLessThan(startOrdinal({ year: 851, month: 2, day: 2 }));
    expect(startOrdinal({ year: -5 })).toBeLessThan(startOrdinal({ year: 0 }));
  });

  it("treats an end without month or day as the end of that period", () => {
    expect(endOrdinal({ year: 10 })).toBe(10_999);
    expect(endOrdinal({ year: 10, month: 3 })).toBe(10_000 + 2 * 40 + 39);
    expect(eventOrdinals({ startYear: 5 })).toEqual({ startOrdinal: 5000, endOrdinal: null });
    expect(eventSpan({ startYear: 5 })).toEqual([5000, 5999]);
  });

  it("recovers the year from an ordinal, including negative years", () => {
    expect(ordinalYear(startOrdinal({ year: 851, month: 12, day: 30 }))).toBe(851);
    expect(ordinalYear(startOrdinal({ year: -3, month: 5 }))).toBe(-3);
  });

  it("formats years, months and precisions with the universe calendar", () => {
    expect(formatYear(851, cal)).toBe("Year 851 AC");
    expect(formatYear(-12, cal)).toBe("Year 12 before reckoning");
    expect(formatWorldDate({ year: 851, month: 2, day: 9 }, "DAY", cal)).toBe("9 Thawmonth, Year 851 AC");
    expect(formatWorldDate({ year: 851, month: 7 }, "MONTH", cal)).toBe("Month 7, Year 851 AC");
    expect(formatWorldDate({ year: 3 }, "CIRCA", cal)).toBe("c. Year 3 AC");
    expect(formatWorldDate({ year: 857 }, "DECADE", cal)).toBe("the 850s AC");
    expect(formatWorldDate({ year: 851 }, "CENTURY", cal)).toBe("9th century AC");
    expect(formatWorldDate({ year: 850 }, "ERA", cal)).toBe("the Concord Years");
    expect(formatEventDate({ startYear: 836, startMonth: 1, endYear: 839, endMonth: 2, precision: "MONTH" }, cal)).toBe("Frostwane, Year 836 AC – Thawmonth, Year 839 AC");
    expect(formatEventDate({ startYear: 1, precision: "YEAR", displayDate: "Before memory" }, cal)).toBe("Before memory");
  });

  it("finds the era containing a year", () => {
    expect(eraForYear(100, cal)?.name).toBe("Long Ember");
    expect(eraForYear(842, cal)?.name).toBe("Concord Years");
    expect(eraForYear(-1, cal)).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(validateDateOrder({ startYear: 10, endYear: 9 })).toMatch(/ends before/);
    expect(validateDateOrder({ startYear: 10, startMonth: 5, endYear: 10, endMonth: 4 })).toMatch(/ends before/);
    expect(validateDateOrder({ startYear: 10, startMonth: 5, endYear: 10 })).toBeNull();
  });
});
