import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../css/Navbar.css";

import {
  BarChart,
  Storefront,
  Menu,
  Close,
} from "@mui/icons-material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";


import logo from "../../src/assets/icono-plus.png";
import botellon from "../../src/assets/botellon.png";
import botelladescartable from "../../src/assets/botelladescartable.png";
import imagenhielo from "../../src/assets/imagen-hielo.png";
import capsulamust from "../../src/assets/capsulamust.png";

export default function SidebarDashboards() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { name: "CONSOLIDADO", icon: <BarChart />, path: "/dashboard/consolidado" },
    { name: "BOTELLÓN", icon: <img src={botellon} />, path: "/dashboard/botellon" },
    { name: "DESCARTABLE", icon: <img src={botelladescartable} />, path: "/dashboard/preventa" },
    { name: "HIELO", icon: <img src={imagenhielo} />, path: "/dashboard/hielo" },
    { name: "PLUS", icon: <img src={logo} />, path: "/dashboard/plus" },
    { name: "CAFÉ", icon: <img src={capsulamust} />, path: "/dashboard/cafe" },
    { name: "VISITAS RUTAS", icon: <LocalShippingIcon />, path: "/dashboard/rutas-visitas" },
    { name: "CLIENTES", icon: <PeopleAltIcon />, path: "/dashboard/clientes" },
    { name: "CREAR_USUARIOS", icon: <PeopleAltIcon />, path: "/dashboard/crearusuarios" },


  ];

  return (
    <>
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <Close /> : <Menu />}
      </button>

      <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <ul>
          {menuItems.map((item) => {
            const active = location.pathname.startsWith(item.path);

            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`menu-item ${active ? "active-menu" : ""}`}
                  onClick={() => window.innerWidth <= 600 && setIsOpen(false)}
                >
                  <span className="menu-icon">{item.icon}</span>
                  {isOpen && <span className="menu-text">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
