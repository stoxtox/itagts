import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "./theme";
import NavigationTabs from "./components/NavigationTabs";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* React‑Router takes care of URL routing */}
      <BrowserRouter>
        <Routes>
          {/* All pages are rendered by NavigationTabs.
              It decides which inner view (runner / creator / …) to show
              based on the URL pathname.                        */}
          <Route path="/*" element={<NavigationTabs />} />

          {/* Any unknown route → send user to the default page */}
          <Route path="*" element={<Navigate to="/runner" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}