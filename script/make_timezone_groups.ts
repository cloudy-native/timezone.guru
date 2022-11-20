import * as _ from "lodash";
import { TIME_ZONES } from "../src/data/timezones";

async function read() {
  return TIME_ZONES;
}

function groupFor(item: string, separator: string = "/") {
  if (item.includes(separator)) {
    return item.split(separator)[0];
  } else {
    return "Etc";
  }
}

async function group(timeZones: string[]) {
  return _.groupBy(timeZones, groupFor);
}

function makeReadable(value: string) {
  return value.split("_").join(" ")
}

function asOptions(entry: [string, string[]]) {
  const [key, group] = entry;

  function removePrefix(value: string) {
    if (value.startsWith(key)) {
      return { label: makeReadable(value.substring(key.length + 1)), value };
    } else {
      return { label: makeReadable(value), value };
    }
  }

  return {
    label: key,
    options: _.sortBy(group.map(removePrefix), (v) => v.label),
  };
}

async function addLabels(groups: { [key: string]: string[] }) {
  return Object.entries(groups).map(asOptions);
}

read()
  .then(group)
  .then(addLabels)
  .then(JSON.stringify)
  .then(console.log)
  .catch(console.error);
