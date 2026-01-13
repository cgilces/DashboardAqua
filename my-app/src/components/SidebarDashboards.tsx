import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../src/assets/icono-plus.png";
import botellon from "../../src/assets/botellon.png";
import botelladescartable from "../../src/assets/botelladescartable.png";
import imagenhielo from "../../src/assets/imagen-hielo.png";
import capsulamust from "../../src/assets/capsulamust.png";


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
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation(); //  RUTA ACTUAL

  const menuItems = [
    { name: "CONSOLIDADO", icon: <BarChart />, path: "/dashboard/consolidado" },
    { name: "PREVENTA", icon: <Storefront />, path: "/dashboard/preventa" },
    {
      name: "BOTELLÓN",
      icon: (
        <img
          src={botellon}
          alt="PLUS"
          style={{
            height: "40px",
            width: "40px",
            objectFit: "contain"
          }}
        />
      ), path: "/dashboard/botellon"
    },
    {
      name: "DESCARTABLE",
      icon: (
        <img
          src={botelladescartable}
          alt="PLUS"
          style={{
            height: "40px",
            width: "40px",
            objectFit: "contain"
          }}
        />
      ), path: "/dashboard/preventa"
    },

    {
      name: "HIELO",
      icon: (
        <img
          src={imagenhielo}
          alt="HIELO"
          style={{
            height: "40px",
            width: "40px",
            objectFit: "contain"
          }}
        />
      ), path: "/dashboard/hielo"
    },
    {
      name: "PLUS",
      icon: (
        <img
          src={logo}
          alt="PLUS"
          style={{
            height: "40px",
            width: "40px",
            objectFit: "contain"
          }}
        />
      ),
      path: "/dashboard/plus"
    },

    {
      name: "CAFÉ",
      icon: (
        <img
          src={capsulamust}
          alt="PLUS"
          style={{
            height: "40px",
            width: "40px",
            objectFit: "contain"
          }}
        />
      ), path: "/dashboard/cafe"
    }
  ];

  return (
    <>
      {/* BOTÓN HAMBURGUESA */}
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <Close /> : <Menu />}
      </button>

      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <ul>
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`menu-item ${isActive ? "active-menu" : ""}`}
                  onClick={() => {
                    if (window.innerWidth <= 600) setIsOpen(false);
                  }}
                >
                  <span className="menu-icon">{item.icon}</span>
                  {isOpen && <span className="menu-text">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
