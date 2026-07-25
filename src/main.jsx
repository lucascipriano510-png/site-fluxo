import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminWhatsAppOnboarding from "./components/AdminWhatsAppOnboarding.jsx";
import LiquidMetalLab from "./components/LiquidMetalLab.jsx";
import "./styles.css";

// Mantém a vitrine isolada: esta rota administrativa não monta o catálogo.
const normalizedPath = window.location.pathname.replace(/\/$/, "");
const isWhatsAppOnboardingRoute = normalizedPath === "/admin/conectar-whatsapp";
const isLiquidMetalLabRoute = normalizedPath === "/lab/liquid-metal";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isWhatsAppOnboardingRoute ? (
      <AdminWhatsAppOnboarding />
    ) : isLiquidMetalLabRoute ? (
      <LiquidMetalLab />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
