import { Image, Link, SimpleGrid, Text } from "@chakra-ui/react";
import * as React from "react";

export function Intro() {
  return (
    <SimpleGrid columns={2} spacing={10}>
      <Text fontSize={"4xl"}>Your partner in scheduling around the globe.</Text>
      <Link href="https://en.wikipedia.org/wiki/Time_zone">
        <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/World_Time_Zones_Map.png/2560px-World_Time_Zones_Map.png" />
      </Link>
    </SimpleGrid>
  );
}
