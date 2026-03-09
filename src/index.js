import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import reportWebVitals from "./reportWebVitals";
import { trackEvent } from "./services/analytics";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Send Web Vitals metrics to Firebase Analytics
reportWebVitals(({ name, value, id }) => {
  trackEvent("web_vitals", {
    metric_name: name,
    metric_value: Math.round(name === "CLS" ? value * 1000 : value),
    metric_id: id,
  });
});
