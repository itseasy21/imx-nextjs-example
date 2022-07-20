import { useState, useEffect } from "react";
import Layout from "../components/layout";
import { ThemeProvider } from "@magiclabs/ui";
import "@magiclabs/ui/dist/cjs/index.css";
import { UserProvider } from "../lib/UserContext.tsx";

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider root>
      <UserProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </UserProvider>
    </ThemeProvider>
  );
}

export default MyApp;
