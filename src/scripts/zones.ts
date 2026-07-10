import { getTimeZones } from "@vvo/tzdb";

/** Searchable city / location option (IANA zone + display names). */
export type ZoneOption = {
  id: string;
  city: string;
  country: string;
  region: string;
  label: string;
  search: string;
};

function legible(part: string): string {
  return part.replace(/_/g, " ");
}

/**
 * Prefer a city-specific IANA id from the zone group when it matches
 * (e.g. Australia/Melbourne over the canonical Australia/Sydney).
 */
function zoneIdForCity(canonical: string, group: string[], city: string): string {
  const needle = city.replace(/\s+/g, "_").toLowerCase();
  const match = group.find((z) => {
    const tail = z.split("/").pop()?.toLowerCase() ?? "";
    return tail === needle || tail.replace(/_/g, "") === needle.replace(/_/g, "");
  });
  return match ?? canonical;
}

let cached: ZoneOption[] | null = null;

/**
 * City list from [@vvo/tzdb](https://github.com/vvo/tzdb) — simplified IANA
 * zones with major cities, country, and continent. Better labels than raw
 * `Intl.supportedValuesOf("timeZone")` (which only yields zone ids).
 *
 * Conversion still uses the browser’s IANA rules via Intl (DST-correct).
 */
export function listZones(): ZoneOption[] {
  if (cached) return cached;

  const options: ZoneOption[] = [];
  const seen = new Set<string>();

  for (const tz of getTimeZones()) {
    const cities =
      tz.mainCities.length > 0 ? tz.mainCities : [legible(tz.name.split("/").pop() ?? tz.name)];

    for (const city of cities) {
      const id = zoneIdForCity(tz.name, tz.group, city);
      // Unique per city+zone so Sydney and Melbourne both appear under AET
      const key = `${city.toLowerCase()}|${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const country = tz.countryName;
      const region = tz.continentName;
      const label = `${city}, ${country}`;
      const search = [
        city,
        country,
        region,
        id,
        tz.name,
        tz.alternativeName,
        tz.abbreviation,
        ...tz.group,
      ]
        .join(" ")
        .toLowerCase();

      options.push({
        id,
        city,
        country,
        region,
        label,
        search,
      });
    }
  }

  cached = options.sort((a, b) => a.city.localeCompare(b.city) || a.country.localeCompare(b.country));
  return cached;
}

/** Browser's current IANA zone, if available. */
export function localZoneId(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Best matching option for the browser's local zone. */
export function localZoneOption(): ZoneOption | undefined {
  const id = localZoneId();
  const zones = listZones();
  const exact = zones.find((z) => z.id === id);
  if (exact) return exact;
  // Fall back to same city name as zone tail
  const tail = legible(id.split("/").pop() ?? "");
  return zones.find((z) => z.city.toLowerCase() === tail.toLowerCase());
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Short offset / zone name (e.g. AEDT, GMT+11). */
  zoneName: string;
};

/**
 * Convert an absolute instant into wall-clock parts in a zone.
 * Uses Intl — correctly applies DST and historical offset rules.
 */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    zoneName: get("timeZoneName"),
  };
}

/**
 * Build a Date for a local (browser) calendar day + hour.
 * The resulting Date is an absolute instant; format it with zonedParts()
 * in any IANA zone to get DST-correct local times there.
 */
export function localInstant(isoDate: string, hour: number): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0, 0);
}

/** YYYY-MM-DD for the browser's local calendar today. */
export function todayIso(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatHour(hour: number, use24h: boolean): string {
  if (use24h) return String(hour).padStart(2, "0") + ":00";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h12}${suffix}`;
}

/** Day offset of a zoned wall date relative to the selected local YYYY-MM-DD. */
export function dayOffset(isoDate: string, z: ZonedParts): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = Date.UTC(y!, m! - 1, d!);
  const other = Date.UTC(z.year, z.month - 1, z.day);
  return Math.round((other - base) / 86_400_000);
}
