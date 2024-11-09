import { Container } from "@chakra-ui/react";
import * as React from "react";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

export function Layout({ children }: { children: any }) {
  return (
    <>
      <nav>
        <Nav />
      </nav>
      <Container maxW={"6xl"}>
        <main>
          {/* <MDXProvider
            components={{
              h1: (props) => <Heading {...props} />,
              h2: (props) => <Heading {...props} />,
              h3: (props) => <Heading {...props} />,
              p: Text,
            }}
          > */}
          {children}
          {/* </MDXProvider> */}
        </main>
        <footer>
          <Footer />
        </footer>
      </Container>
    </>
  );
}

export default Layout;
