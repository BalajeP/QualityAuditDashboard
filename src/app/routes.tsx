import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { AuditForm } from "./components/AuditForm";
import { Agents } from "./components/Agents";
import { ScoringGrid } from "./components/ScoringGrid";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "scoring", Component: ScoringGrid },
      { path: "audit", Component: AuditForm },
      { path: "agents", Component: Agents },
      { path: "settings", Component: Settings },
    ],
  },
]);
