export type Activity = "sleep" | "work" | "awake";

export const ACTIVITIES: Activity[] = ["sleep", "work", "awake"];

export const ACTIVITY_LABEL: Record<Activity, string> = {
  sleep: "Sleep",
  work: "Work",
  awake: "Awake",
};

/** Compact marks for grid cells / legend (quiet emoji, not loud). */
export const ACTIVITY_SHORT: Record<Activity, string> = {
  sleep: "💤",
  work: "💼",
  awake: "☕",
};

/** How many people are awake (work or free-time) at a simultaneous moment. */
export type AvailabilityLevel = "none" | "low" | "mid" | "high" | "full";

export type Availability = {
  awake: number;
  total: number;
  level: AvailabilityLevel;
};

export function isAwake(activity: Activity): boolean {
  return activity !== "sleep";
}

/**
 * Score overlap for one row: how many selected locations are awake
 * at that shared instant (using each city’s local activity template).
 */
export function availabilityFor(activitiesHere: Activity[]): Availability {
  const total = activitiesHere.length;
  const awake = activitiesHere.filter(isAwake).length;
  if (total === 0 || awake === 0) {
    return { awake, total, level: "none" };
  }
  if (awake === total) return { awake, total, level: "full" };
  const ratio = awake / total;
  if (ratio >= 2 / 3) return { awake, total, level: "high" };
  if (ratio >= 1 / 3) return { awake, total, level: "mid" };
  return { awake, total, level: "low" };
}

/** Default: sleep night, work day, awake evening. */
export function defaultActivities(): Activity[] {
  return [
    ...Array<Activity>(8).fill("sleep"), // 00–07
    ...Array<Activity>(9).fill("work"), // 08–16
    ...Array<Activity>(7).fill("awake"), // 17–23
  ];
}

export function cycleActivity(current: Activity): Activity {
  if (current === "sleep") return "work";
  if (current === "work") return "awake";
  return "sleep";
}

export function applyRange(
  activities: Activity[],
  start: number,
  end: number,
  value: Activity,
): Activity[] {
  const next = [...activities];
  const [s, e] = start <= end ? [start, end] : [end, start];
  for (let i = s; i <= e; i++) next[i] = value;
  return next;
}
