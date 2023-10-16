import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  Spacer,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { SingleDatepicker } from "chakra-dayzed-datepicker";
import { Select } from "chakra-react-select";
import { DateTime } from "luxon";
import * as React from "react";
import { useState } from "react";
import { getTimeZoneData, TimeZone } from "../utils/timezones";
import { Intro } from "./Intro";

// Tried for all of 3 mins to get enums working here...
//
const SLEEP = "sleep";
const WORK = "work";
const PLAY = "play";

const timeZoneData = getTimeZoneData();

console.log(timeZoneData);

// The big hand's on the...
//
const clockHours = [
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

// 24HR clock
//
const universalHours = Array(24)
  .fill("")
  .map((_, index) => index.toString().padStart(2, "0"));

export function Main() {
  const [timeZones, setTimeZones] = useState<TimeZone[]>([]);
  const [activities, setActivities] = useState<string[]>([
    ...Array(8).fill(SLEEP),
    ...Array(8).fill(WORK),
    ...Array(8).fill(PLAY),
  ]);
  const [date, setDate] = useState(new Date());
  const [hourSymbols, setHourSymbols] = useState(clockHours);

  function colorSchemeFor(activity: string): string | undefined {
    switch (activity) {
      case WORK:
        return "green";
      case PLAY:
        return "blue";
      case SLEEP:
        return "gray";
    }
  }

  function updateActivities(activity: string, hour: number) {
    const newActivities = [...activities];

    newActivities[hour] = activity;

    setActivities(newActivities);
  }

  // TODO: Clean up types
  //
  function updateTimeZones(tz: any) {
    setTimeZones(tz);
  }

  // Just make an array of React elements and add them all at once to the grid.
  // The logic's hard enough, so don't mess up the render method with weird loops.
  //
  const tableElements: JSX.Element[] = [];

  // The basic idea is to calculate everything relative to UTC so we catch things like DST changes
  //
  timeZones.forEach((timeZone) => {
    tableElements.push(
      <GridItem colSpan={3} >
        <Text size={"xs"}>{timeZone.label}</Text>
      </GridItem>
    );

    activities.forEach((_, hour) => {
      const dateTime = DateTime.fromJSDate(date);
      const utc = dateTime.setZone("UTC").plus({ hours: hour });
      const timeZoneDate = utc.setZone(timeZone.value);
      const timeZoneHour = timeZoneDate.hour;
      const buttonVariant = timeZoneHour == 0 ? "outline" : "solid";
      const colorScheme = colorSchemeFor(activities[timeZoneHour]);

      tableElements.push(
        <GridItem key={"hour"}>
          <Button
            variant={buttonVariant}
            colorScheme={colorScheme}
            size={"xs"}
            width={"100%"}
          >
            {hourSymbols[timeZoneHour]}
          </Button>
        </GridItem>
      );
    });
  });

  return (
    <VStack align={"stretch"} spacing={4} mt={10}>
      <Intro />
      <Flex alignItems={"stretch"}>
        <Switch
          onChange={(v) => {
            setHourSymbols(v.target.checked ? universalHours : clockHours);
          }}
        >
          24H
        </Switch>
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
      <Card>
        <CardHeader>
          <Heading size="md">Sleep, work, play times</Heading>
          <Text>
            Set an activity for each hour in the day. It doesn't have to be very
            accurate because you'll see a general period of overlap.
          </Text>
        </CardHeader>
        <CardBody>
          <HStack>
            {Array(24)
              .fill("")
              .map((n, hour) => {
                return (
                  <RadioGroup
                    key={hour}
                    value={activities[hour]}
                    onChange={(v) => updateActivities(v, hour)}
                  >
                    <VStack alignItems={"flex-start"}>
                      <Text>{hourSymbols[hour]}</Text>
                      <Radio value={SLEEP} colorScheme={colorSchemeFor(SLEEP)}>
                        <Text fontSize={"xs"}>{hour === 0 ? "sleep" : ""}</Text>
                      </Radio>
                      <Radio value={WORK} colorScheme={colorSchemeFor(WORK)}>
                        <Text fontSize={"xs"}>{hour === 0 ? "work" : ""}</Text>
                      </Radio>
                      <Radio value={PLAY} colorScheme={colorSchemeFor(PLAY)}>
                        <Text fontSize={"xs"}>{hour === 0 ? "play" : ""}</Text>
                      </Radio>
                    </VStack>
                  </RadioGroup>
                );
              })}
          </HStack>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Heading size={"md"}>When and where?</Heading>
          <Text>Pick a date, find as many time zones as you like.</Text>
        </CardHeader>
        <CardBody>
          <Flex alignItems={"stretch"}>
            <Button
              colorScheme={"blue"}
              onClick={(_) => {
                setDate(new Date());
              }}
            >
              Now
            </Button>
            <Box>
              <SingleDatepicker
                name="date-input"
                date={date}
                onDateChange={(newDate) => {
                  console.log("datepicker", newDate);
                  // Add back current time
                  //
                  const now = new Date();

                  newDate.setHours(
                    now.getHours(),
                    now.getMinutes(),
                    now.getSeconds()
                  );

                  setDate(newDate);
                }}
              />
            </Box>
            <Spacer />
            <Box width={"xl"}>
              <Select
                hasStickyGroupHeaders
                isMulti
                name="countries"
                options={timeZoneData}
                placeholder="Select locations and timezones..."
                closeMenuOnSelect={false}
                onChange={updateTimeZones}
              />
            </Box>
          </Flex>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Heading size={"md"}>Now find good times</Heading>
          <Text>Pick a column when most people are awake.</Text>
        </CardHeader>
        <CardBody>
          <Grid templateColumns={`repeat(${24 + 2 + 1}, 1fr)`} gap={"1"}>
            {tableElements}
          </Grid>
        </CardBody>
      </Card>
    </VStack>
  );
}
