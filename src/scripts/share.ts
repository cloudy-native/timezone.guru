import {
  defaultActivities,
  type Activity,
} from "./schedule";
import { preferredOptionForZoneId, type ZoneOption } from "./zones";

export type ShareableState = {
  zones: ZoneOption[];
  date: string;
  activities: Activity[];
};

export type ShareOptions = {
  /** Include `d=` date param. Default: true when date is not today. */
  includeDate: boolean;
  /** Include `a=` activity template. Default: false. */
  includeActivities: boolean;
};

export type ParseResult = {
  zones: ZoneOption[];
  date?: string;
  activities?: Activity[];
  unknown: string[];
};

const ACT_CHAR: Record<Activity, string> = {
  sleep: "s",
  work: "w",
  awake: "a",
};

/** Decode activity chars; `p` kept for older “play” share links. */
const CHAR_ACT: Record<string, Activity> = {
  s: "sleep",
  w: "work",
  a: "awake",
  p: "awake",
};

/**
 * Encode one city for the `z` param.
 * Always `City@IANA` so multi-city zones (e.g. Europe/London → London/Birmingham)
 * round-trip unambiguously.
 */
export function encodeZoneToken(z: Pick<ZoneOption, "city" | "id">): string {
  return `${z.city}@${z.id}`;
}

export function encodeActivities(activities: Activity[]): string {
  return activities.map((a) => ACT_CHAR[a] ?? "s").join("");
}

export function decodeActivities(raw: string): Activity[] | null {
  if (!/^[swap]{24}$/i.test(raw)) return null;
  return raw
    .toLowerCase()
    .split("")
    .map((c) => CHAR_ACT[c] ?? "sleep");
}

export function activitiesEqual(a: Activity[], b: Activity[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Build a share URL for the current comparison.
 * Params: z (required cities), d (optional date), a (optional activity string).
 */
export function buildShareUrl(
  state: ShareableState,
  options: ShareOptions,
): string {
  const params = new URLSearchParams();

  if (state.zones.length > 0) {
    params.set("z", state.zones.map(encodeZoneToken).join(","));
  }

  if (options.includeDate && state.date) {
    params.set("d", state.date);
  }

  if (options.includeActivities) {
    params.set("a", encodeActivities(state.activities));
  }

  const qs = params.toString();
  // Always share the site root so Help/About paths don't break the tool
  const root =
    typeof location !== "undefined" ? `${location.origin}/` : "https://timezone.guru/";

  return qs ? `${root}?${qs}` : root;
}

/**
 * Resolve a token like `Australia/Melbourne` or `Melbourne@Australia/Melbourne`
 * against the known zone list.
 */
export function resolveZoneToken(
  token: string,
  allZones: ZoneOption[],
): ZoneOption | undefined {
  const t = token.trim();
  if (!t) return undefined;

  if (t.includes("@")) {
    const [cityPart, idPart] = t.split("@");
    const city = (cityPart ?? "").trim();
    const id = (idPart ?? "").trim();
    if (!id) return undefined;
    const exact = allZones.find(
      (z) => z.id === id && z.city.toLowerCase() === city.toLowerCase(),
    );
    if (exact) return exact;
    // Prefer zone-tail / largest city when id matches; keep shared city label if given
    const preferred = preferredOptionForZoneId(allZones, id);
    if (preferred && city) {
      return { ...preferred, city, label: `${city}, ${preferred.country}` };
    }
    return preferred;
  }

  // Bare IANA id — never use first alphabetical city (Birmingham before London)
  const byId = preferredOptionForZoneId(allZones, t);
  if (byId) return byId;

  // City name only — prefer highest population when names collide
  const cityMatches = allZones.filter(
    (z) => z.city.toLowerCase() === t.toLowerCase(),
  );
  if (cityMatches.length === 0) return undefined;
  return cityMatches.reduce((best, z) => (z.pop > best.pop ? z : best));
}

/** Parse share params from a URLSearchParams / location.search. */
export function parseShareParams(
  params: URLSearchParams,
  allZones: ZoneOption[],
): ParseResult | null {
  const zRaw = params.get("z");
  if (!zRaw || !zRaw.trim()) return null;

  const tokens = zRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const zones: ZoneOption[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const z = resolveZoneToken(token, allZones);
    if (!z) {
      unknown.push(token);
      continue;
    }
    const key = `${z.city}|${z.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    zones.push(z);
  }

  const d = params.get("d");
  const date =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;

  const a = params.get("a");
  const activities = a ? decodeActivities(a) ?? undefined : undefined;

  return { zones, date, activities: activities ?? undefined, unknown };
}

export function defaultShareOptions(
  date: string,
  today: string,
  activities: Activity[],
): ShareOptions {
  return {
    includeDate: date !== today,
    includeActivities: !activitiesEqual(activities, defaultActivities()),
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
