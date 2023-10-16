import * as _ from "lodash";

export type TimeZone = {
  label: string;
  value: string;
};

export type TimeZoneGroup = {
  label: string;
  options: TimeZone[];
};

function groupFor(item: string, separator: string = "/") {
  if (item.includes(separator)) {
    return item.split(separator)[0];
  } else {
    return "Etc";
  }
}

function group(timeZones: string[]) {
  return _.groupBy(timeZones, groupFor);
}

function makeLegible(value: string) {
  return value.split("_").join(" ");
}

function asOptions(entry: [string, string[]]) {
  const [key, group] = entry;

  function removePrefix(value: string) {
    if (value.startsWith(key)) {
      return { label: makeLegible(value.substring(key.length + 1)), value };
    } else {
      return { label: makeLegible(value), value };
    }
  }

  return {
    label: key,
    options: _.sortBy(group.map(removePrefix), (v) => v.label),
  };
}

function addLabels(groups: { [key: string]: string[] }) {
  return Object.entries(groups).map(asOptions);
}

export function getTimeZoneData(): TimeZoneGroup[] {
  const timeZones = Intl.supportedValuesOf("timeZone");
  const groups = group(timeZones);
  const withLabels = addLabels(groups);

  return withLabels;
}
