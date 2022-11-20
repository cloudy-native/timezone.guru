import { Container } from "@chakra-ui/react";
import * as React from "react";
import { Footer } from "../components/Footer";
import { Main } from "../components/Main";
import { Nav } from "../components/Nav";

function IndexPage() {
  return (
    <>
      <nav>
        <Nav />
      </nav>
      <Container maxW={"6xl"}>
        <main>
          <Main />
        </main>
        <footer>
          <Footer />
        </footer>
      </Container>
    </>
  );
}

export default IndexPage;
