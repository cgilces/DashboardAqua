import { useState } from "react";
import { Link } from "react-router-dom";
import "../css/Navbar.css";

import {
  BarChart,
  Storefront,
  ShoppingCart,
  MoveToInbox,
  AcUnit,
  Layers,
  EmojiFoodBeverage,
  Menu,
  Close
} from "@mui/icons-material";

export default function SidebarDashboards() {
  // 🔹 AHORA EL MENÚ SIEMPRE INICIA CERRADO
  const [isOpen, setIsOpen] = useState(false);

  const [selectedMenu, setSelectedMenu] = useState<string>("CONSOLIDADO");

  const menuItems = [
    { name: "CONSOLIDADO", icon: <BarChart />, path: "/dashboard/consolidado" },
    { name: "PREVENTA", icon: <Storefront />, path: "/dashboard/preventa" },
    { name: "BOTELLÓN", icon: <ShoppingCart />, path: "/dashboard/botellon" },
    { name: "DESCARTABLE", icon: <MoveToInbox />, path: "/dashboard/descartable" },
    { name: "HIELO", icon: <AcUnit />, path: "/dashboard/hielo" },
    { name: "PLUS", icon: <Layers />, path: "/dashboard/plus" },
    { name: "CAFÉ", icon: <EmojiFoodBeverage />, path: "/dashboard/cafe" }
  ];

  return (
    <>
      {/* BOTÓN HAMBURGUESA */}
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <Close /> : <Menu />}
      </button>

      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <ul>
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                className={
                  selectedMenu === item.name
                    ? "menu-item active-menu"
                    : "menu-item"
                }
                onClick={() => {
                  setSelectedMenu(item.name);

                  // 🔹 AUTO-CERRAR EN MÓVILES
                  if (window.innerWidth <= 600) setIsOpen(false);
                }}
              >
                <span className="menu-icon">{item.icon}</span>
                {isOpen && <span className="menu-text">{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
