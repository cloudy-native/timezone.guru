import cities from "../data/cities.json";

/** Searchable city / location option (IANA zone + display names). */
export type ZoneOption = {
  id: string;
  city: string;
  country: string;
  region: string;
  label: string;
  /** Lowercase blob for substring search (longer queries). */
  search: string;
  /** Individual tokens for short queries (uk, usa, nyc, …). */
  searchTokens: string[];
  /** Approximate population (GeoNames); 0 when unknown / tzdb-only. */
  pop: number;
};

type CityRecord = {
  city: string;
  country: string;
  region: string;
  id: string;
  pop: number;
};

/**
 * Common country abbreviations and alternate names keyed by GeoNames country string.
 * Kept lowercase; multi-word aliases are stored as a single token with spaces removed
 * for short codes, and also as full phrases in `search`.
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  "United Kingdom": [
    "uk",
    "gb",
    "gbr",
    "britain",
    "great britain",
    "england",
    "scotland",
    "wales",
    "northern ireland",
    "u.k.",
  ],
  "United States": [
    "usa",
    "us",
    "u.s.",
    "u.s.a.",
    "america",
    "united states of america",
    "states",
  ],
  "United Arab Emirates": ["uae", "u.a.e.", "emirates"],
  "The Netherlands": ["netherlands", "holland", "nl", "nld"],
  Russia: ["russian federation", "ru", "rus"],
  "South Korea": ["korea", "rok", "kr", "kor", "republic of korea"],
  "North Korea": ["dprk", "kp", "prk"],
  "Czechia": ["czech republic", "czechia", "cz", "cze"],
  "Hong Kong": ["hk", "hkg", "hongkong"],
  Taiwan: ["tw", "twn", "roc", "republic of china"],
  Vietnam: ["vn", "vnm", "viet nam"],
  Iran: ["ir", "irn", "persia"],
  Syria: ["sy", "syr"],
  "South Africa": ["za", "zaf", "rsa"],
  "New Zealand": ["nz", "nzl", "aotearoa"],
  Australia: ["au", "aus", "oz"],
  Canada: ["ca", "can"],
  Mexico: ["mx", "mex"],
  Brazil: ["br", "bra"],
  Germany: ["de", "deu", "deutschland", "ger"],
  France: ["fr", "fra"],
  Spain: ["es", "esp", "espana"],
  Italy: ["it", "ita"],
  Japan: ["jp", "jpn"],
  China: ["cn", "chn", "prc"],
  India: ["in", "ind", "bharat"],
  Ireland: ["ie", "irl", "eire", "republic of ireland"],
  Switzerland: ["ch", "che", "swiss"],
  Sweden: ["se", "swe"],
  Norway: ["no", "nor"],
  Denmark: ["dk", "dnk"],
  Finland: ["fi", "fin"],
  Poland: ["pl", "pol"],
  Portugal: ["pt", "prt"],
  Greece: ["gr", "grc", "hellas"],
  Turkey: ["tr", "tur", "turkiye", "türkiye"],
  Israel: ["il", "isr"],
  "Saudi Arabia": ["sa", "sau", "ksa"],
  Singapore: ["sg", "sgp"],
  Malaysia: ["my", "mys"],
  Indonesia: ["id", "idn"],
  Thailand: ["th", "tha"],
  Philippines: ["ph", "phl"],
  Argentina: ["ar", "arg"],
  Chile: ["cl", "chl"],
  Colombia: ["co", "col"],
  Peru: ["pe", "per"],
  Egypt: ["eg", "egy"],
  Nigeria: ["ng", "nga"],
  Kenya: ["ke", "ken"],
  "Puerto Rico": ["pr", "pri"],
  "U.S. Virgin Islands": ["usvi", "american virgin islands"],
  "British Virgin Islands": ["bvi"],
  "Dominican Republic": ["dr", "dom"],
  "Democratic Republic of the Congo": ["drc", "congo-kinshasa", "zaire"],
  "Republic of the Congo": ["congo-brazzaville", "congo"],
  Myanmar: ["mm", "mmr", "burma"],
  "Ivory Coast": ["ci", "civ", "cote divoire", "côte d'ivoire"],
  "Macao": ["mo", "mac", "macau"],
  Palestine: ["ps", "pse", "palestinian territory", "west bank", "gaza"],
  "Palestinian Territory": ["ps", "pse", "palestine", "west bank", "gaza"],
  Vatican: ["va", "vat", "holy see", "vatican city"],
};

/** City nicknames / airport-style codes → GeoNames city name as stored. */
const CITY_ALIASES: Record<string, string[]> = {
  "New York City": ["nyc", "new york", "ny", "manhattan"],
  "Los Angeles": ["la", "l.a.", "lax"],
  "San Francisco": ["sf", "sfo", "san fran", "bay area"],
  "Washington, D.C.": ["dc", "d.c.", "washington dc", "washington d.c."],
  Washington: ["dc", "d.c.", "washington dc"],
  Chicago: ["chi", "ord"],
  Boston: ["bos"],
  Miami: ["mia"],
  Seattle: ["sea"],
  Atlanta: ["atl"],
  Denver: ["den"],
  Dallas: ["dfw"],
  Houston: ["hou", "iah"],
  Phoenix: ["phx"],
  Philadelphia: ["philly", "phl"],
  "Las Vegas": ["vegas"],
  London: ["ldn", "lon"],
  Paris: ["par", "cdg"],
  Tokyo: ["tyo", "hnd", "nrt"],
  Sydney: ["syd"],
  Melbourne: ["mel"],
  Singapore: ["sg", "sin"],
  Dubai: ["dxb"],
  "Hong Kong": ["hk", "hkg"],
  Mumbai: ["bombay", "bom"],
  Delhi: ["new delhi"],
  "New Delhi": ["delhi"],
  Beijing: ["peking", "pek", "bjs"],
  Shanghai: ["sha", "pvg"],
  Bangkok: ["bkk"],
  Toronto: ["yyz", "tor"],
  Vancouver: ["yvr"],
  Montreal: ["yul", "mtl"],
  Moscow: ["msk", "svo"],
  Berlin: ["ber"],
  Amsterdam: ["ams"],
  Zurich: ["zrh", "zürich"],
  "Zürich": ["zrh", "zurich"],
  Dublin: ["dub"],
  Edinburgh: ["edi"],
  Glasgow: ["gla"],
  Manchester: ["man"],
  Birmingham: ["bhx"],
  Bristol: ["brs"],
  Auckland: ["akl"],
  Johannesburg: ["jnb", "joburg", "jo'burg"],
  Cairo: ["cai"],
  Istanbul: ["ist", "constantinople"],
  "São Paulo": ["sao paulo", "gru"],
  "Sao Paulo": ["são paulo", "gru"],
  "Rio de Janeiro": ["rio", "gig"],
  "Mexico City": ["cdmx", "df", "mex"],
  "Ho Chi Minh City": ["saigon", "sgn", "hcmc"],
  Kolkata: ["calcutta", "ccu"],
  Chennai: ["madras", "maa"],
  Bengaluru: ["bangalore", "blr"],
  Bangalore: ["bengaluru", "blr"],
  Kyiv: ["kiev", "iev"],
  Kiev: ["kyiv"],
};

const REGION_ALIASES: Record<string, string[]> = {
  Europe: ["eu", "europe"],
  Asia: ["asia"],
  Africa: ["africa"],
  "North America": ["na", "north america", "americas"],
  "South America": ["sa", "south america", "latam", "latin america"],
  Oceania: ["oceania", "pacific", "anz"],
  Antarctica: ["antarctica"],
};

let cached: ZoneOption[] | null = null;

function legible(part: string): string {
  return part.replace(/_/g, " ");
}

/** Normalize for token compare: lowercase, strip most punctuation. */
function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9+/.-]+/g, " ")
    .trim();
}

function tokenize(...parts: string[]): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const n = normalizeToken(part);
    if (!n) continue;
    out.add(n);
    // also individual words
    for (const w of n.split(/\s+/)) {
      if (w) out.add(w);
    }
    // compact form without spaces (greatbritain, newyork)
    const compact = n.replace(/\s+/g, "");
    if (compact.length > 1) out.add(compact);
  }
  return [...out];
}

function aliasesForCountry(country: string): string[] {
  return COUNTRY_ALIASES[country] ?? [];
}

function aliasesForCity(city: string): string[] {
  return CITY_ALIASES[city] ?? [];
}

function aliasesForRegion(region: string): string[] {
  return REGION_ALIASES[region] ?? [];
}

/**
 * City list from GeoNames (build-time extract) merged with tzdb main cities.
 * Conversion still uses the browser’s IANA rules via Intl (DST-correct).
 *
 * Regenerate: `pnpm cities:extract` → src/data/cities.json
 */
export function listZones(): ZoneOption[] {
  if (cached) return cached;

  const options: ZoneOption[] = [];
  const seen = new Set<string>();

  for (const row of cities as CityRecord[]) {
    const city = row.city;
    const id = row.id;
    const key = `${city.toLowerCase()}|${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const country = row.country;
    const region = row.region;
    const label = `${city}, ${country}`;
    const zoneTail = legible(id.split("/").pop() ?? id);
    const zoneParts = id.split("/");

    const aliasBits = [
      ...aliasesForCountry(country),
      ...aliasesForCity(city),
      ...aliasesForRegion(region),
    ];

    const searchTokens = tokenize(
      city,
      country,
      region,
      id,
      zoneTail,
      ...zoneParts,
      ...aliasBits,
    );

    const search = [
      city,
      country,
      region,
      id,
      zoneTail,
      ...aliasBits,
      ...searchTokens,
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
      searchTokens,
      pop: row.pop ?? 0,
    });
  }

  cached = options.sort(
    (a, b) =>
      a.city.localeCompare(b.city) || a.country.localeCompare(b.country),
  );
  return cached;
}

/** Colloquial country queries that must not match IANA path prefixes. */
const COLLOQUIAL_COUNTRY: Record<string, string> = {
  // IANA uses America/* for the whole western hemisphere — users mean the USA
  america: "United States",
  american: "United States",
  americas: "United States",
  // Avoid matching every Europe/* zone when someone types a casual synonym
  britain: "United Kingdom",
  british: "United Kingdom",
};

function cityNameMatchesPrefix(city: string, q: string): boolean {
  const c = city.toLowerCase();
  if (c.startsWith(q)) return true;
  // Multi-word cities: "New York" matches "n" / "ne" / "yo"
  return c.split(/[\s/-]+/).some((w) => w.startsWith(q));
}

/**
 * Match a zone against a user query.
 * - 1 char: city name prefix only (b → Bangkok, Berlin, …)
 * - 2 chars: exact codes (uk, us) OR city prefix (br → Bristol)
 * - 3+ chars: aliases, city/country, zone ids
 */
export function zoneMatchesQuery(z: ZoneOption, rawQuery: string): boolean {
  const q = normalizeToken(rawQuery);
  if (!q) return false;

  const colloquialCountry = COLLOQUIAL_COUNTRY[q];
  if (colloquialCountry) {
    return z.country === colloquialCountry;
  }

  // Single letter: typeahead on city names (too broad for country/alias tokens)
  if (q.length === 1) {
    return cityNameMatchesPrefix(z.city, q);
  }

  if (q.length === 2) {
    // Country codes: uk, us, nz, de, …
    if (z.searchTokens.includes(q)) return true;
    return cityNameMatchesPrefix(z.city, q);
  }

  if (q.length === 3) {
    // Country/region codes that must not prefix-match unrelated cities (usa≠Usak)
    const exactOnlyCodes = new Set([
      "usa",
      "uae",
      "gbr",
      "can",
      "aus",
      "nzl",
      "deu",
      "fra",
      "jpn",
      "chn",
      "ind",
      "bra",
      "mex",
      "kor",
    ]);
    if (exactOnlyCodes.has(q)) {
      return z.searchTokens.includes(q);
    }
    // Exact alias (nyc) or city / zone-tail prefix (lon→London)
    if (z.searchTokens.includes(q)) return true;
    if (cityNameMatchesPrefix(z.city, q)) return true;
    const tail = legible(z.id.split("/").pop() ?? "").toLowerCase();
    return tail.startsWith(q) || tail.replace(/\s+/g, "").startsWith(q);
  }

  // Multi-word: every word must match somewhere
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    // "north america" / "south america" = regions, not USA
    return words.every(
      (w) =>
        z.search.includes(w) ||
        z.searchTokens.some((t) => t === w || t.startsWith(w) || t.includes(w)),
    );
  }

  // Single word: prefer real place fields over IANA path noise (America/*, Europe/*)
  if (
    z.searchTokens.some((t) => t === q || t.startsWith(q)) ||
    z.city.toLowerCase().includes(q) ||
    z.country.toLowerCase().includes(q) ||
    z.region.toLowerCase().includes(q)
  ) {
    return true;
  }

  // Explicit zone id query (e.g. america/new_york) — only when it looks like one
  if (q.includes("/") || q.includes("_")) {
    return z.id.toLowerCase().includes(q.replace(/\s+/g, "_"));
  }

  return false;
}

/**
 * Prefer the option whose city matches the IANA id tail (London for Europe/London),
 * else the most populous city in that zone, else the first match.
 */
export function preferredOptionForZoneId(
  allZones: ZoneOption[],
  ianaId: string,
): ZoneOption | undefined {
  const matches = allZones.filter((z) => z.id === ianaId);
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const tail = legible(ianaId.split("/").pop() ?? "").toLowerCase();
  const byTail = matches.find((z) => z.city.toLowerCase() === tail);
  if (byTail) return byTail;

  return matches.reduce((best, z) => (z.pop > best.pop ? z : best));
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
  const preferred = preferredOptionForZoneId(zones, id);
  if (preferred) return preferred;
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
