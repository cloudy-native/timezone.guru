import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  Spacer,
  Text,
  VStack,
} from "@chakra-ui/react";
import { SingleDatepicker } from "chakra-dayzed-datepicker";
import { Select } from "chakra-react-select";
import * as React from "react";
import { useState } from "react";
import { TIME_ZONE_GROUPS } from "../data/timezone_groups";

// Tried for all of 3 mins to get enums working here ... we're on the clock!
//
const SLEEP = "sleep";
const WORK = "work";
const PLAY = "play";

const humanTimes = [
  "12A",
  "1A",
  "2A",
  "3A",
  "4A",
  "5A",
  "6A",
  "7A",
  "8A",
  "9A",
  "10A",
  "11A",
  "12P",
  "1P",
  "2P",
  "3P",
  "4P",
  "5P",
  "6P",
  "7P",
  "8P",
  "9P",
  "10P",
  "11P",
];

type TimeZone = {
  label: string;
  value: string;
};

function colorSchemeFor(activity: string): string | undefined {
  switch (activity) {
    case WORK:
      return "green";
    case PLAY:
      return "blue";
    case SLEEP:
      return "yellow";
  }
}

export function Main() {
  const [timeZones, setTimeZones] = useState<TimeZone[]>([]);
  const [activities, setActivities] = useState<string[]>([
    ...Array(8).fill(SLEEP),
    ...Array(8).fill(WORK),
    ...Array(8).fill(PLAY),
  ]);
  const [date, setDate] = useState(new Date());

  function updateActivities(activity: string, hour: number) {
    const newActivities = [...activities];

    newActivities[hour] = activity;

    setActivities(newActivities);
  }

  function updateTimeZones(tz: any) {
    setTimeZones(tz);
  }

  function dateInTimeZone(date: Date, timeZone: string) {
    return new Date(
      date.toLocaleString("en-US", {
        timeZone,
      })
    );
  }

  // The hour will *almost* always be the hour in the date + hour offset. Except for DST changes
  //
  function hourForDate(date: Date, hourOffset: number) {
    const newDate = new Date(date);

    newDate.setHours(newDate.getHours() + hourOffset);

    return newDate.getHours();
  }

  // Just make an array of React elements and add them all at once to the grid.
  // The logic's hard enough, so pull it out of the render.
  //
  const tableElements: JSX.Element[] = [];

  // chartDateTime is the calendar-selected date but with the time now
  //
  const chartDateTime = new Date(
    new Date().setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
  );

  timeZones.forEach((tz) => {
    tableElements.push(
      <GridItem colSpan={3}>
        <Text size={"xs"}>{tz.label}</Text>
      </GridItem>
    );

    const timeZoneDate = dateInTimeZone(chartDateTime, tz.value);

    activities.forEach((_, activityIndex) => {
      const activityHour = hourForDate(timeZoneDate, activityIndex);
      const buttonVariant = activityHour == 0 ? "outline" : "solid";

      tableElements.push(
        <GridItem>
          <Button
            variant={buttonVariant}
            colorScheme={colorSchemeFor(activities[activityHour])}
            size={"xs"}
            width={"100%"}
          >
            {humanTimes[activityHour]}
          </Button>
        </GridItem>
      );
    });
  });

  return (
    <VStack align={"stretch"} spacing={10} mt={10}>
      <Text fontSize={"2xl"}>
        Got a team across the world? Parents back home across the country?
        Yani's in Melbourne, Chris is in Chicago, but you're in Boston? Then
        this tool's for you.
      </Text>
      <Text>
        Start by adding the places and time zones where people are. Then set how
        the day's activities are split between sleep, work, and play. Set a date
        if you like. Then look at the grid to see where availability is
        favorable.
      </Text>
      <Heading>Where does everyone live?</Heading>
      <Select
        hasStickyGroupHeaders
        isMulti
        name="countries"
        options={TIME_ZONE_GROUPS}
        placeholder="Select some places and timezones..."
        closeMenuOnSelect={false}
        onChange={(tz) => updateTimeZones(tz)}
      />
      <Heading>Sleep, work, play times</Heading>
      <HStack>
        <VStack>
          <Text>Select</Text>
          <Text>Sleep</Text>
          <Text>Work</Text>
          <Text>Play</Text>
        </VStack>
        {Array(24)
          .fill("")
          .map((n, hour) => {
            return (
              <RadioGroup
                value={activities[hour]}
                onChange={(v) => updateActivities(v, hour)}
              >
                <VStack>
                  <Text>{humanTimes[hour]}</Text>
                  <Radio value={SLEEP} />
                  <Radio value={WORK} />
                  <Radio value={PLAY} />
                </VStack>
              </RadioGroup>
            );
          })}
      </HStack>
      <Heading>Here's how to make that work</Heading>
      <Flex justifyContent={"space-between"}>
        <Box>
          <SingleDatepicker
            name="date-input"
            date={date}
            onDateChange={setDate}
          />
        </Box>
        <Spacer />
        <ButtonGroup size={"xs"}>
          <Button colorScheme={colorSchemeFor(SLEEP)}>Sleep</Button>
          <Button colorScheme={colorSchemeFor(WORK)}>Work</Button>
          <Button colorScheme={colorSchemeFor(PLAY)}>Play</Button>
          <Button colorScheme={colorSchemeFor(SLEEP)} variant={"outline"}>
            Midnight
          </Button>
        </ButtonGroup>
      </Flex>
      <Grid templateColumns="repeat(27, 1fr)" gap={"1"}>
        {tableElements}
      </Grid>
    </VStack>
  );
}
