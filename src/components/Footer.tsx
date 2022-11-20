import { LinkIcon } from "@chakra-ui/icons";
import { Box, Divider, Flex, Link, Spacer, Text } from "@chakra-ui/react";
import * as React from "react";

export function Footer() {
  return (
    <Box my={20}>
      <Divider />
      <Flex justifyContent={"space-between"}>
        <Spacer />
        <Text>
          Made with ❤️ one lazy Friday afternoon by{" "}
          <Link href="https://www.linkedin.com/in/stephenharrison/">
            Stephen Harrison <LinkIcon />
          </Link>
        </Text>
      </Flex>
    </Box>
  );
}
