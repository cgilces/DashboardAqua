import SidebarDashboards from "../components/SidebarDashboards";
import { ReactNode } from "react";
import "./DashboardLayout.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="layout-container">
      <SidebarDashboards />
      <div className="layout-content">
        {children}

       
      </div>
    </div>
  );
}
