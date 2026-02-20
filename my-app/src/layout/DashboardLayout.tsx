import SidebarDashboards from "../components/SidebarDashboards";
import { ReactNode } from "react";
import ChatFlotante from "../components/elements/ChatFlotante";
import "./DashboardLayout.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="layout-container">
      <SidebarDashboards />
      <div className="layout-content">
        {children}

        {/* AQUÍ VA EL CHAT GLOBAL */}
        <ChatFlotante />
      </div>
    </div>
  );
}
