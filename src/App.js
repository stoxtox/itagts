import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppThemeProvider } from "./contexts/ThemeContext";
import NavigationTabs from "./components/NavigationTabs";

export default function App() {
  return (
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<NavigationTabs />} />
          <Route path="*" element={<Navigate to="/runner" replace />} />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  );
}
