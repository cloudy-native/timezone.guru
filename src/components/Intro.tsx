import { Box, Code, Image, Link, SimpleGrid, Text } from "@chakra-ui/react";
import * as React from "react";

export function Intro() {
  return (
    <SimpleGrid columns={2} spacing={10}>
      <Box>
        <Text fontSize={"4xl"}>
          Timezone.guru is your trusted partner for global scheduling.
        </Text>
        <br/>
        <Text fontSize={"xl"}>
          Choose a few time zones and a daily schedule, and we'll suggest the
          best times to meet.
        </Text>
      </Box>
      <Link href="https://en.wikipedia.org/wiki/Time_zone">
        <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/World_Time_Zones_Map.png/2560px-World_Time_Zones_Map.png" />
      </Link>
    </SimpleGrid>
  );
}
