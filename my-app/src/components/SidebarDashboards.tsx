import { useState } from "react";
import { Link } from "react-router-dom";
import "../css/Navbar.css";
import { BarChart, Storefront, ShoppingCart, MoveToInbox, Factory, Layers } from "@mui/icons-material";

export default function SidebarDashboards() {

  const [isOpen, setIsOpen] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<string | null>("preventa");

  const menuItems = [
    { name: "PREVENTA", icon: <BarChart />, path: "/dashboard/preventa" },
    { name: "RURAL", icon: <Storefront />, path: "/dashboard/rural" },
    { name: "CANAL", icon: <ShoppingCart />, path: "/dashboard/Canal" },
    { name: "DISTRIBUCIÓN", icon: <MoveToInbox />, path: "/dashboard/distribucion" },
    { name: "POSVENTA", icon: <Layers />, path: "/dashboard/posventa" },
    { name: "SUPERMERCADOS", icon: <Factory />, path: "/dashboard/super" },
    { name: "CONSOLIDADO GENERAL", icon: <BarChart />, path: "/dashboard/consolidado" },
  ];

  return (
    <>
      {/* BOTÓN FUERA DEL SIDEBAR */}
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "<<" : ">>"}
      </button>

      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <ul>
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                className={selectedMenu === item.name ? "active-menu menu-item" : "menu-item"}
                onClick={() => setSelectedMenu(item.name)}
              >
                {item.icon} {isOpen && item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
