import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Heading,
  Stack,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import { Link as GatsbyLink } from "gatsby";
import * as React from "react";

export function Nav() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box bg={useColorModeValue("gray.200", "gray.900")} px={4}>
      <Flex h={24} alignItems={"center"} justifyContent={"space-between"}>
        <Heading size={"2xl"}>
          <GatsbyLink to="/">Timezone Guru</GatsbyLink>
        </Heading>
        <Flex alignItems={"center"}>
          <Stack direction={"row"} spacing={7}>
            {/* <ButtonGroup>
              <Button colorScheme={"blue"} as={GatsbyLink} to="/about">
                About
              </Button>
              <Button colorScheme={"blue"} as={GatsbyLink} to="/help">
                Help
              </Button>
            </ButtonGroup> */}
            <Button onClick={toggleColorMode}>
              {colorMode === "light" ? <MoonIcon /> : <SunIcon />}
            </Button>
          </Stack>
        </Flex>
      </Flex>
    </Box>
  );
}
