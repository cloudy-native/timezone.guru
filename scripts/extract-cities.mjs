/**
 * Build src/data/cities.json from GeoNames + @vvo/tzdb.
 *
 * Sources:
 * - GeoNames cities15000 (pop ≥ 15k + capitals): https://download.geonames.org/export/dump/
 * - countryInfo.txt for country names / continents
 * - @vvo/tzdb mainCities so remote / low-pop zone labels stay searchable
 *
 * Inclusion: population ≥ MIN_POP, or rank within country ≤ TOP_PER_COUNTRY,
 * plus every tzdb main city (even below the floor).
 *
 * Re-run when you want fresher populations / new places:
 *   pnpm cities:extract
 *
 * Licensed data: GeoNames CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTimeZones } from "@vvo/tzdb";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "src", "data", "cities.json");
const WORK = join(tmpdir(), "timezone-guru-cities");

/** City proper / admin seats large enough to be useful search targets. */
const MIN_POP = 100_000;
/** Always keep this many largest places per country (covers smaller nations). */
const TOP_PER_COUNTRY = 15;

const GEONAMES_CITIES =
  "https://download.geonames.org/export/dump/cities15000.zip";
const GEONAMES_COUNTRIES =
  "https://download.geonames.org/export/dump/countryInfo.txt";

const CONTINENTS = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
  AN: "Antarctica",
};

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/**
 * @param {string} zipPath
 * @param {string} entryName
 * @param {string} destDir
 */
function unzipEntry(zipPath, entryName, destDir) {
  try {
    execFileSync("unzip", ["-qo", zipPath, entryName, "-d", destDir], {
      stdio: "pipe",
    });
  } catch {
    // Fallback when unzip(1) is missing
    execFileSync(
      "python3",
      [
        "-c",
        `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
z.extract(sys.argv[2], sys.argv[3])
`,
        zipPath,
        entryName,
        destDir,
      ],
      { stdio: "pipe" },
    );
  }
}

/**
 * @param {string} text
 * @returns {Map<string, { name: string, region: string }>}
 */
function parseCountryInfo(text) {
  /** @type {Map<string, { name: string, region: string }>} */
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    const iso = cols[0];
    const name = cols[4];
    const continent = cols[8];
    if (!iso || !name) continue;
    map.set(iso, {
      name,
      region: CONTINENTS[/** @type {keyof typeof CONTINENTS} */ (continent)] ?? continent ?? "",
    });
  }
  return map;
}

/**
 * @typedef {{ city: string, country: string, region: string, id: string, pop: number, countryCode: string }} CityRow
 */

/**
 * @param {string} path
 * @param {Map<string, { name: string, region: string }>} countries
 * @returns {CityRow[]}
 */
function parseCities15000(path, countries) {
  const text = readFileSync(path, "utf8");
  /** @type {CityRow[]} */
  const rows = [];

  for (const line of text.split("\n")) {
    if (!line) continue;
    const p = line.split("\t");
    if (p.length < 18) continue;

    const name = (p[2] || p[1] || "").trim(); // prefer ASCII
    const countryCode = (p[8] || "").trim();
    const pop = Number.parseInt(p[14] || "0", 10) || 0;
    const id = (p[17] || "").trim();
    if (!name || !countryCode || !id) continue;

    const meta = countries.get(countryCode);
    rows.push({
      city: name,
      country: meta?.name ?? countryCode,
      region: meta?.region ?? "",
      id,
      pop,
      countryCode,
    });
  }
  return rows;
}

/**
 * @param {CityRow[]} rows
 * @returns {CityRow[]}
 */
function selectCities(rows) {
  /** @type {Map<string, CityRow[]>} */
  const byCountry = new Map();
  for (const r of rows) {
    const list = byCountry.get(r.countryCode) ?? [];
    list.push(r);
    byCountry.set(r.countryCode, list);
  }

  /** @type {Map<string, CityRow>} */
  const picked = new Map();
  const keyOf = (/** @type {CityRow} */ r) =>
    `${r.city.toLowerCase()}|${r.countryCode}|${r.id}`;

  const keep = (/** @type {CityRow} */ r) => {
    const k = keyOf(r);
    const prev = picked.get(k);
    if (!prev || r.pop > prev.pop) picked.set(k, r);
  };

  for (const list of byCountry.values()) {
    list.sort((a, b) => b.pop - a.pop);
    list.forEach((r, i) => {
      if (r.pop >= MIN_POP || i < TOP_PER_COUNTRY) keep(r);
    });
  }

  return [...picked.values()];
}

/**
 * Ensure every tzdb main city is searchable (remote islands, small capitals).
 * @param {CityRow[]} cities
 * @param {Map<string, { name: string, region: string }>} countries
 * @returns {CityRow[]}
 */
function mergeTzdbMainCities(cities, countries) {
  /** @type {Map<string, CityRow>} */
  const map = new Map();
  const keyOf = (/** @type {Pick<CityRow, 'city' | 'countryCode' | 'id'>} */ r) =>
    `${r.city.toLowerCase()}|${r.countryCode}|${r.id}`;

  for (const c of cities) map.set(keyOf(c), c);

  for (const tz of getTimeZones()) {
    const countryCode = tz.countryCode || "";
    const meta = countries.get(countryCode);
    const country = tz.countryName || meta?.name || countryCode;
    const region = tz.continentName || meta?.region || "";
    const citiesList =
      tz.mainCities.length > 0
        ? tz.mainCities
        : [(tz.name.split("/").pop() ?? tz.name).replace(/_/g, " ")];

    for (const city of citiesList) {
      const id = zoneIdForCity(tz.name, tz.group, city);
      const row = {
        city,
        country,
        region,
        id,
        pop: 0,
        countryCode,
      };
      const k = keyOf(row);
      if (!map.has(k)) map.set(k, row);
    }
  }

  return [...map.values()];
}

/**
 * Prefer a city-specific IANA id from the zone group when it matches.
 * @param {string} canonical
 * @param {string[]} group
 * @param {string} city
 */
function zoneIdForCity(canonical, group, city) {
  const needle = city.replace(/\s+/g, "_").toLowerCase();
  const match = group.find((z) => {
    const tail = z.split("/").pop()?.toLowerCase() ?? "";
    return tail === needle || tail.replace(/_/g, "") === needle.replace(/_/g, "");
  });
  return match ?? canonical;
}

/**
 * Compact JSON for the client (full keys are still small enough).
 * @param {CityRow[]} cities
 */
function toOutput(cities) {
  return cities
    .map((c) => ({
      city: c.city,
      country: c.country,
      region: c.region,
      id: c.id,
      pop: c.pop,
    }))
    .sort(
      (a, b) =>
        a.city.localeCompare(b.city) ||
        a.country.localeCompare(b.country) ||
        b.pop - a.pop,
    );
}

async function main() {
  mkdirSync(WORK, { recursive: true });
  mkdirSync(join(ROOT, "src", "data"), { recursive: true });

  const zipPath = join(WORK, "cities15000.zip");
  const countriesPath = join(WORK, "countryInfo.txt");
  const citiesTxt = join(WORK, "cities15000.txt");

  console.log("Downloading GeoNames cities15000…");
  await download(GEONAMES_CITIES, zipPath);
  console.log("Downloading GeoNames countryInfo…");
  await download(GEONAMES_COUNTRIES, countriesPath);

  console.log("Unpacking…");
  unzipEntry(zipPath, "cities15000.txt", WORK);
  if (!existsSync(citiesTxt)) {
    throw new Error(`Expected ${citiesTxt} after unzip`);
  }

  const countries = parseCountryInfo(readFileSync(countriesPath, "utf8"));
  const parsed = parseCities15000(citiesTxt, countries);
  console.log(`Parsed ${parsed.length.toLocaleString()} GeoNames rows`);

  const selected = selectCities(parsed);
  console.log(
    `Selected ${selected.length.toLocaleString()} (pop ≥ ${MIN_POP.toLocaleString()} or top ${TOP_PER_COUNTRY}/country)`,
  );

  const merged = mergeTzdbMainCities(selected, countries);
  console.log(`After tzdb mainCities merge: ${merged.length.toLocaleString()}`);

  const out = toOutput(merged);
  const json = `${JSON.stringify(out, null, 0)}\n`;
  writeFileSync(OUT, json, "utf8");

  const bristol = out.find(
    (c) => c.city === "Bristol" && c.country === "United Kingdom",
  );
  console.log(`Wrote ${OUT}`);
  console.log(`  ${out.length.toLocaleString()} cities, ${(json.length / 1024).toFixed(1)} KB`);
  console.log(
    bristol
      ? `  Bristol, UK: yes (pop ${bristol.pop.toLocaleString()}, ${bristol.id})`
      : "  Bristol, UK: MISSING — adjust thresholds",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
