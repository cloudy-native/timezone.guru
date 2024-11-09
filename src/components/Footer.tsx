import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Box, Flex, Link, Spacer, Text } from "@chakra-ui/react";
import * as React from "react";

export function Footer() {
  return (
    <Box my={20}>
      <Flex justifyContent={"space-between"}>
        <Spacer />
        <Text>
          Made with ❤️ by{" "}
          <Link href="https://www.linkedin.com/in/stephenharrison/">
            Stephen Harrison <ExternalLinkIcon />
          </Link>
        </Text>
      </Flex>
    </Box>
  );
}
