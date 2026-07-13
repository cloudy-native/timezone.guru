import {
  ACTIVITIES,
  ACTIVITY_LABEL,
  ACTIVITY_SHORT,
  AVAILABILITY_EMOJI,
  AVAILABILITY_LABEL,
  applyRange,
  availabilityFor,
  cycleActivity,
  defaultActivities,
  type Activity,
} from "./schedule";
import {
  buildShareUrl,
  copyText,
  defaultShareOptions,
  parseShareParams,
} from "./share";
import {
  dayOffset,
  formatHour,
  listZones,
  localInstant,
  localZoneOption,
  preferredOptionForZoneId,
  todayIso,
  zoneMatchesQuery,
  zonedParts,
  type ZoneOption,
} from "./zones";

type State = {
  date: string;
  zones: ZoneOption[];
  activities: Activity[];
  use24h: boolean;
  paintBrush: Activity;
  painting: boolean;
};

/**
 * Default columns: your current location first, then London and New York
 * (skipping a default that matches your zone so we don’t double up).
 */
function seedDefaultZones(allZones: ZoneOption[]): ZoneOption[] {
  const zoneKey = (z: ZoneOption) => `${z.city}|${z.id}`;
  const initialZones: ZoneOption[] = [];
  const seen = new Set<string>();

  const push = (z: ZoneOption | undefined): void => {
    if (!z) return;
    const key = zoneKey(z);
    if (seen.has(key) || seen.has(`id:${z.id}`)) return;
    seen.add(key);
    seen.add(`id:${z.id}`);
    initialZones.push(z);
  };

  push(localZoneOption());
  for (const id of ["Europe/London", "America/New_York"]) {
    push(preferredOptionForZoneId(allZones, id));
  }
  return initialZones;
}

/** Wall-clock time string for “now” cells (always live, not the selected date). */
function formatNowTime(
  instant: Date,
  timeZone: string,
  use24h: boolean,
): { time: string; zoneName: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: use24h ? "h23" : "h12",
    timeZoneName: "short",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  const zoneName = get("timeZoneName");
  const time = use24h
    ? `${hour.padStart(2, "0")}:${minute}`
    : `${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""}`;

  return { time, zoneName };
}

/** Rank search hits: exact city, prefix, country-alias hit, then population. */
function rankSuggestions(matches: ZoneOption[], q: string): ZoneOption[] {
  const nq = q.toLowerCase().trim();
  const score = (z: ZoneOption): number => {
    const city = z.city.toLowerCase();
    if (city === nq) return 0;
    if (city.startsWith(nq)) return 1;
    if (z.searchTokens.some((t) => t === nq)) return 2;
    if (z.country.toLowerCase() === nq || z.country.toLowerCase().startsWith(nq))
      return 3;
    if (z.searchTokens.some((t) => t.startsWith(nq))) return 4;
    return 5;
  };
  return [...matches].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    if (b.pop !== a.pop) return b.pop - a.pop;
    return a.city.localeCompare(b.city) || a.country.localeCompare(b.country);
  });
}

function init(): void {
  const root = document.querySelector<HTMLElement>("[data-app]");
  if (!root) return;

  const allZones = listZones();
  // Key by city+id so duplicate zone ids (e.g. Sydney & Melbourne) both work
  const zoneKey = (z: ZoneOption) => `${z.city}|${z.id}`;
  const zoneByKey = new Map(allZones.map((z) => [zoneKey(z), z]));

  const shared = parseShareParams(new URLSearchParams(location.search), allZones);

  const state: State = {
    date: shared?.date ?? todayIso(),
    zones:
      shared && shared.zones.length > 0
        ? shared.zones
        : seedDefaultZones(allZones),
    activities: shared?.activities ?? defaultActivities(),
    use24h: true,
    paintBrush: "work",
    painting: false,
  };

  const els = {
    date: root.querySelector<HTMLInputElement>("[data-date]")!,
    todayBtn: root.querySelector<HTMLButtonElement>("[data-today]")!,
    search: root.querySelector<HTMLInputElement>("[data-search]")!,
    suggestions: root.querySelector<HTMLUListElement>("[data-suggestions]")!,
    chips: root.querySelector<HTMLElement>("[data-chips]")!,
    grid: root.querySelector<HTMLElement>("[data-grid]")!,
    empty: root.querySelector<HTMLElement>("[data-empty]")!,
    clockToggle: root.querySelector<HTMLInputElement>("[data-clock-toggle]")!,
    painter: root.querySelector<HTMLElement>("[data-painter]")!,
    brush: root.querySelector<HTMLElement>("[data-brush]")!,
    presets: root.querySelector<HTMLElement>("[data-presets]")!,
    shareDate: root.querySelector<HTMLInputElement>("[data-share-date]")!,
    shareActivities: root.querySelector<HTMLInputElement>(
      "[data-share-activities]",
    )!,
    shareCopy: root.querySelector<HTMLButtonElement>("[data-share-copy]")!,
    shareNative: root.querySelector<HTMLButtonElement>("[data-share-native]")!,
    shareStatus: root.querySelector<HTMLElement>("[data-share-status]")!,
  };

  const shareDefaults = defaultShareOptions(
    state.date,
    todayIso(),
    state.activities,
  );
  els.shareDate.checked = shareDefaults.includeDate;
  els.shareActivities.checked = shareDefaults.includeActivities;
  els.clockToggle.checked = state.use24h;
  els.date.value = state.date;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    els.shareNative.hidden = false;
  }

  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  function setShareStatus(msg: string): void {
    els.shareStatus.textContent = msg;
    if (statusTimer) clearTimeout(statusTimer);
    if (msg) {
      statusTimer = setTimeout(() => {
        els.shareStatus.textContent = "";
      }, 2500);
    }
  }

  function currentShareUrl(): string {
    return buildShareUrl(
      {
        zones: state.zones,
        date: state.date,
        activities: state.activities,
      },
      {
        includeDate: els.shareDate.checked,
        includeActivities: els.shareActivities.checked,
      },
    );
  }

  function selectedKeys(): Set<string> {
    return new Set(state.zones.map(zoneKey));
  }

  function addZone(z: ZoneOption): void {
    if (selectedKeys().has(zoneKey(z))) return;
    state.zones = [...state.zones, z];
    els.search.value = "";
    hideSuggestions();
    render();
  }

  function removeZone(city: string, id: string): void {
    state.zones = state.zones.filter((z) => !(z.city === city && z.id === id));
    render();
  }

  function hideSuggestions(): void {
    els.suggestions.hidden = true;
    els.suggestions.innerHTML = "";
  }

  function showSuggestions(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q) {
      hideSuggestions();
      return;
    }
    const taken = selectedKeys();
    const allMatches = rankSuggestions(
      allZones.filter((z) => !taken.has(zoneKey(z)) && zoneMatchesQuery(z, q)),
      q,
    );
    const limit = 12;
    const matches = allMatches.slice(0, limit);
    const extra = allMatches.length - matches.length;

    if (matches.length === 0) {
      const safe = escapeHtml(query.trim());
      els.suggestions.innerHTML = `<li class="suggest-empty">No cities match “${safe}”. Try a full name or country (e.g. London, UK).</li>`;
      els.suggestions.hidden = false;
      return;
    }

    const hint =
      extra > 0
        ? `<li class="suggest-hint">Showing top ${matches.length} of ${allMatches.length.toLocaleString()} — type more to narrow</li>`
        : "";

    els.suggestions.innerHTML =
      hint +
      matches
        .map(
          (z) =>
            `<li><button type="button" data-add-key="${escapeHtml(zoneKey(z))}" class="suggest-item">
            <span class="suggest-city">${escapeHtml(z.city)}</span>
            <span class="suggest-meta">${escapeHtml(z.country)} · ${escapeHtml(z.id)}</span>
          </button></li>`,
        )
        .join("");
    els.suggestions.hidden = false;
  }

  function renderChips(): void {
    if (state.zones.length === 0) {
      els.chips.innerHTML = "";
      return;
    }
    els.chips.innerHTML = state.zones
      .map((z) => {
        const sample = zonedParts(localInstant(state.date, 12), z.id);
        return `<button type="button" class="chip" data-remove-city="${escapeHtml(z.city)}" data-remove-zone="${escapeHtml(z.id)}" aria-label="Remove ${escapeHtml(z.city)}">
          <span class="chip-city">${escapeHtml(z.city)}</span>
          <span class="chip-zone">${escapeHtml(sample.zoneName)}</span>
          <span class="chip-x" aria-hidden="true">×</span>
        </button>`;
      })
      .join("");
  }

  function activityAtInstant(instant: Date, zoneId: string): Activity {
    const p = zonedParts(instant, zoneId);
    return state.activities[p.hour] ?? "sleep";
  }

  /** Live wall times only — cheap partial update for the Now row. */
  function updateNowRow(): void {
    const now = new Date();
    const localNow = formatNowTime(now, localZoneIdSafe(), state.use24h);
    const localEl = els.grid.querySelector<HTMLElement>("[data-now-local]");
    if (localEl) {
      localEl.textContent = localNow.time;
    }

    els.grid.querySelectorAll<HTMLElement>("[data-now-zone]").forEach((el) => {
      const id = el.dataset.nowZone;
      if (!id) return;
      const { time, zoneName } = formatNowTime(now, id, state.use24h);
      const timeEl = el.querySelector(".now-clock");
      const zoneEl = el.querySelector(".now-zone");
      if (timeEl) timeEl.textContent = time;
      if (zoneEl) zoneEl.textContent = zoneName;
    });
  }

  function localZoneIdSafe(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  function renderGrid(): void {
    if (state.zones.length === 0) {
      els.grid.hidden = true;
      els.empty.hidden = false;
      return;
    }
    els.grid.hidden = false;
    els.empty.hidden = true;

    const now = new Date();
    const isToday = state.date === todayIso();
    const currentHour = now.getHours();
    const noon = localInstant(state.date, 12);
    const localTz = localZoneIdSafe();
    const localNow = formatNowTime(now, localTz, state.use24h);
    /** Short offset like city columns (GMT+1, EDT) for the selected date. */
    const localTzLabel =
      zonedParts(noon, localTz).zoneName || localTz.replace(/_/g, " ");

    const headCells = state.zones
      .map((z) => {
        const p = zonedParts(noon, z.id);
        return `<th scope="col" class="loc-head">
          <span class="loc-city">${escapeHtml(z.city)}</span>
          <span class="loc-abbr">${escapeHtml(p.zoneName)}</span>
        </th>`;
      })
      .join("");

    const nowCells = state.zones
      .map((z) => {
        const { time, zoneName } = formatNowTime(now, z.id, state.use24h);
        return `<td class="now-time-cell" data-now-zone="${escapeHtml(z.id)}">
          <span class="now-clock">${escapeHtml(time)}</span>
          <span class="now-zone">${escapeHtml(zoneName)}</span>
        </td>`;
      })
      .join("");

    const rows = Array.from({ length: 24 }, (_, hour) => {
      const instant = localInstant(state.date, hour);
      const isNow = isToday && hour === currentHour;
      const localLabel = formatHour(hour, state.use24h);
      // Row hour = your local hour, so the day template applies directly
      const localAct = state.activities[hour] ?? "sleep";

      const cityActs = state.zones.map((z) => activityAtInstant(instant, z.id));
      const avail = availabilityFor(cityActs);

      const cells = state.zones
        .map((z, i) => {
          const p = zonedParts(instant, z.id);
          const activity = cityActs[i]!;
          const offset = dayOffset(state.date, p);
          const dayBadge =
            offset === 0
              ? ""
              : offset > 0
                ? `<span class="day-badge" title="Next calendar day">+${offset}</span>`
                : `<span class="day-badge" title="Previous calendar day">${offset}</span>`;

          return `<td class="cell avail-${avail.level} act-stripe-${activity}${isNow ? " is-now" : ""}" title="${ACTIVITY_LABEL[activity]}">
            <span class="cell-time">${formatHour(p.hour, state.use24h)}${dayBadge}</span>
            <span class="cell-act" aria-hidden="true">${ACTIVITY_SHORT[activity]}</span>
          </td>`;
        })
        .join("");

      const qualityEmoji = AVAILABILITY_EMOJI[avail.level];
      const qualityLabel = AVAILABILITY_LABEL[avail.level];
      const scoreTitle =
        avail.total === 0
          ? qualityLabel
          : `${qualityLabel} (${avail.awake} of ${avail.total})`;

      return `<tr class="row-avail-${avail.level}${isNow ? " row-now" : ""}">
        <th scope="row" class="hour-cell avail-${avail.level} act-mark-${localAct}${isNow ? " is-now" : ""}" title="${ACTIVITY_LABEL[localAct]}">
          <div class="you-hour-row">
            <span class="hour-label">${localLabel}</span>
            ${isNow ? `<span class="now-dot" title="Current hour"></span>` : ""}
          </div>
          <span class="hour-act" aria-hidden="true">${ACTIVITY_SHORT[localAct]}</span>
        </th>
        <td class="quality-cell avail-${avail.level}" title="${escapeHtml(scoreTitle)}">
          <span class="avail-emoji" aria-hidden="true">${qualityEmoji}</span>
        </td>
        ${cells}
      </tr>`;
    }).join("");

    els.grid.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th scope="col" class="hour-head">
              <span class="hour-head-label">Your location</span>
              <span class="hour-head-sub" title="${escapeHtml(localTz)}">${escapeHtml(localTzLabel)}</span>

            </th>
            <th scope="col" class="quality-head">
              <span class="quality-head-label">Good</span>
            </th>
            ${headCells}
          </tr>
          <tr class="now-row">
            <th scope="row" class="hour-head now-head">
              <span class="now-label">Now</span>
              <span class="now-local" data-now-local>${escapeHtml(localNow.time)}</span>
            </th>
            <td class="quality-cell now-quality" aria-hidden="true"></td>
            ${nowCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderBrush(): void {
    els.brush.innerHTML = ACTIVITIES.map(
      (a) =>
        `<button type="button" class="brush-btn act-${a}${state.paintBrush === a ? " is-active" : ""}" data-brush="${a}">
          <span class="act-emoji" aria-hidden="true">${ACTIVITY_SHORT[a]}</span>
          ${ACTIVITY_LABEL[a]}
        </button>`,
    ).join("");
  }

  function clockFaceGradient(): string {
    const color = (a: Activity): string => {
      if (a === "sleep") return "var(--clock-sleep)";
      if (a === "work") return "var(--work-bg)";
      return "var(--awake-bg)";
    };
    const stops = state.activities
      .map((a, h) => {
        const start = (h / 24) * 360;
        const end = ((h + 1) / 24) * 360;
        return `${color(a)} ${start}deg ${end}deg`;
      })
      .join(", ");
    // from 0deg = midnight at 12 o'clock, clockwise through the day
    return `conic-gradient(from 0deg, ${stops})`;
  }

  function stripButton(hour: number): string {
    const a = state.activities[hour]!;
    return `<button type="button" class="strip-hour act-${a}" data-paint-hour="${hour}"
      aria-label="Hour ${formatHour(hour, state.use24h)}: ${ACTIVITY_LABEL[a]}">
      <span class="strip-h">${state.use24h ? String(hour).padStart(2, "0") : formatHour(hour, false)}</span>
    </button>`;
  }

  function renderPainter(): void {
    renderBrush();

    const am = Array.from({ length: 12 }, (_, h) => stripButton(h)).join("");
    const pm = Array.from({ length: 12 }, (_, h) => stripButton(h + 12)).join("");

    els.painter.innerHTML = `
      <div class="day-clock" data-clock>
        <div class="day-clock-ring" data-clock-ring style="background: ${clockFaceGradient()}"
          role="img" aria-label="24-hour activity clock. Midnight at top, clockwise."></div>
        <div class="day-clock-center" aria-hidden="true">
          <span class="day-clock-brush act-${state.paintBrush}">${ACTIVITY_SHORT[state.paintBrush]} ${ACTIVITY_LABEL[state.paintBrush]}</span>
          <span class="day-clock-hint">Drag ring to paint</span>
        </div>
        <span class="day-clock-tick t-00">00</span>
        <span class="day-clock-tick t-06">06</span>
        <span class="day-clock-tick t-12">12</span>
        <span class="day-clock-tick t-18">18</span>
      </div>

      <div class="day-strips" aria-label="Hour strips">
        <div class="day-strip">
          <span class="day-strip-label">00–11</span>
          <div class="day-strip-hours">${am}</div>
        </div>
        <div class="day-strip">
          <span class="day-strip-label">12–23</span>
          <div class="day-strip-hours">${pm}</div>
        </div>
      </div>
    `;
  }

  function syncPaintHour(hour: number): void {
    const activity = state.activities[hour]!;

    // Linear strips
    const btn = els.painter.querySelector<HTMLButtonElement>(
      `[data-paint-hour="${hour}"]`,
    );
    if (btn) {
      btn.className = `strip-hour act-${activity}`;
      btn.setAttribute(
        "aria-label",
        `Hour ${formatHour(hour, state.use24h)}: ${ACTIVITY_LABEL[activity]}`,
      );
    }

    // Clock face gradient + center brush label
    const ring = els.painter.querySelector<HTMLElement>("[data-clock-ring]");
    if (ring) ring.style.background = clockFaceGradient();
    const brushLabel = els.painter.querySelector(".day-clock-brush");
    if (brushLabel) {
      brushLabel.className = `day-clock-brush act-${state.paintBrush}`;
      brushLabel.textContent = `${ACTIVITY_SHORT[state.paintBrush]} ${ACTIVITY_LABEL[state.paintBrush]}`;
    }
  }

  function setHourActivity(hour: number, activity: Activity): void {
    if (hour < 0 || hour > 23) return;
    if (state.activities[hour] === activity) return;
    state.activities = state.activities.map((a, i) =>
      i === hour ? activity : a,
    );
    syncPaintHour(hour);
    renderGrid();
  }

  /**
   * Map pointer position on the 24h ring to an hour.
   * Midnight is at the top; hours run clockwise (15° each).
   */
  function hourFromClockEvent(e: { clientX: number; clientY: number }): number | null {
    const ring = els.painter.querySelector<HTMLElement>("[data-clock-ring]");
    if (!ring) return null;
    const rect = ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    // Ignore dead zone in the center hole (~38% radius)
    if (dist < rect.width * 0.18) return null;
    if (dist > rect.width * 0.52) return null;
    // atan2: 0 = east; convert so 0 = north, clockwise
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.min(23, Math.floor(deg / 15));
  }

  function paintFromPointer(
    e: { clientX: number; clientY: number },
    cycleOnHit: boolean,
  ): void {
    const hour = hourFromClockEvent(e);
    if (hour === null) return;
    if (cycleOnHit) {
      const next = cycleActivity(state.activities[hour]!);
      state.paintBrush = next;
      renderBrush();
      setHourActivity(hour, next);
      return;
    }
    setHourActivity(hour, state.paintBrush);
  }

  function render(): void {
    renderChips();
    renderGrid();
    renderPainter();
  }

  // --- Events ---

  els.date.addEventListener("change", () => {
    if (els.date.value) {
      state.date = els.date.value;
      render();
    }
  });

  els.todayBtn.addEventListener("click", () => {
    state.date = todayIso();
    els.date.value = state.date;
    render();
  });

  els.search.addEventListener("input", () => showSuggestions(els.search.value));
  els.search.addEventListener("focus", () => {
    if (els.search.value.trim()) showSuggestions(els.search.value);
  });
  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideSuggestions();
    if (e.key === "Enter") {
      e.preventDefault();
      const first = els.suggestions.querySelector<HTMLButtonElement>("[data-add-key]");
      first?.click();
    }
  });

  els.suggestions.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-add-key]");
    if (!btn) return;
    const z = zoneByKey.get(btn.dataset.addKey!);
    if (z) addZone(z);
  });

  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("[data-city-picker]")) {
      hideSuggestions();
    }
  });

  els.chips.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-zone]");
    if (btn?.dataset.removeCity && btn.dataset.removeZone) {
      removeZone(btn.dataset.removeCity, btn.dataset.removeZone);
    }
  });

  els.clockToggle.addEventListener("change", () => {
    state.use24h = els.clockToggle.checked;
    render();
  });

  els.brush.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-brush]");
    if (!btn) return;
    state.paintBrush = btn.dataset.brush as Activity;
    renderBrush();
    const brushLabel = els.painter.querySelector(".day-clock-brush");
    if (brushLabel) {
      brushLabel.className = `day-clock-brush act-${state.paintBrush}`;
      brushLabel.textContent = `${ACTIVITY_SHORT[state.paintBrush]} ${ACTIVITY_LABEL[state.paintBrush]}`;
    }
  });

  const endPaint = () => {
    state.painting = false;
  };
  window.addEventListener("mouseup", endPaint);
  window.addEventListener("touchend", endPaint, { passive: true });

  // Painter: clock ring + AM/PM strips (event delegation on container)
  els.painter.addEventListener("mousedown", (e) => {
    const strip = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-paint-hour]");
    if (strip) {
      e.preventDefault();
      const hour = Number(strip.dataset.paintHour);
      state.painting = true;
      const next = cycleActivity(state.activities[hour]!);
      state.paintBrush = next;
      renderBrush();
      setHourActivity(hour, next);
      return;
    }
    if ((e.target as HTMLElement).closest("[data-clock-ring]")) {
      e.preventDefault();
      state.painting = true;
      paintFromPointer(e, true);
    }
  });

  els.painter.addEventListener("mousemove", (e) => {
    if (!state.painting) return;
    const strip = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-paint-hour]");
    if (strip) {
      setHourActivity(Number(strip.dataset.paintHour), state.paintBrush);
      return;
    }
    if ((e.target as HTMLElement).closest("[data-clock]")) {
      paintFromPointer(e, false);
    }
  });

  els.painter.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const strip = target?.closest?.("[data-paint-hour]") as HTMLButtonElement | null;
      if (strip) {
        state.painting = true;
        setHourActivity(Number(strip.dataset.paintHour), state.paintBrush);
        return;
      }
      if (target?.closest?.("[data-clock-ring]")) {
        state.painting = true;
        paintFromPointer(touch, false);
      }
    },
    { passive: true },
  );

  els.painter.addEventListener(
    "touchmove",
    (e) => {
      if (!state.painting) return;
      const touch = e.touches[0];
      if (!touch) return;
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const strip = target?.closest?.("[data-paint-hour]") as HTMLButtonElement | null;
      if (strip) {
        setHourActivity(Number(strip.dataset.paintHour), state.paintBrush);
        return;
      }
      paintFromPointer(touch, false);
    },
    { passive: true },
  );

  els.presets.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-preset]");
    if (!btn) return;
    const preset = btn.dataset.preset;
    if (preset === "workday") {
      state.activities = applyRange(
        Array(24).fill("sleep") as Activity[],
        9,
        17,
        "work",
      );
    } else if (preset === "sleep") {
      state.activities = Array(24).fill("sleep") as Activity[];
    } else if (preset === "awake") {
      state.activities = Array(24).fill("awake") as Activity[];
    } else if (preset === "reset") {
      state.activities = defaultActivities();
    }
    render();
  });

  els.shareCopy.addEventListener("click", async () => {
    if (state.zones.length === 0) {
      setShareStatus("Add a city first");
      return;
    }
    const url = currentShareUrl();
    const ok = await copyText(url);
    setShareStatus(ok ? "Link copied" : "Couldn’t copy — select the URL manually");
    if (!ok) {
      window.prompt("Copy this link:", url);
    }
  });

  els.shareNative.addEventListener("click", async () => {
    if (state.zones.length === 0) {
      setShareStatus("Add a city first");
      return;
    }
    const url = currentShareUrl();
    try {
      await navigator.share({
        title: "Time Zone Guru",
        text: "Compare schedules across cities",
        url,
      });
      setShareStatus("Shared");
    } catch {
      /* user cancelled or share failed */
    }
  });

  if (shared?.unknown.length) {
    setShareStatus(`Unknown: ${shared.unknown.slice(0, 3).join(", ")}`);
  }

  render();

  // Keep the Now row accurate without a full re-render every tick
  window.setInterval(() => {
    if (state.zones.length === 0) return;
    updateNowRow();
  }, 15_000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
