import { Box, Code, Image, Link, SimpleGrid, Text } from "@chakra-ui/react";
import * as React from "react";

export function Intro() {
  return (
    <SimpleGrid columns={2} spacing={10}>
      <Box>
        <Text fontSize={"4xl"}>
          timezone.guru is your trusted partner for scheduling time together
          around the globe.
        </Text>
        <Text fontSize={"xl"}>
          Pick some time zones and a daily schedule and we'll show you the best
          times to get together.
        </Text>
      </Box>
      <Link href="https://en.wikipedia.org/wiki/Time_zone">
        <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/World_Time_Zones_Map.png/2560px-World_Time_Zones_Map.png" />
      </Link>
    </SimpleGrid>
  );
}
