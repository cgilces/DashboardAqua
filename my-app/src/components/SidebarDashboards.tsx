import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../css/Navbar.css";

import { BarChart, Menu, Close } from "@mui/icons-material";
import LocalShippingIcon  from "@mui/icons-material/LocalShipping";
import PeopleAltIcon      from "@mui/icons-material/PeopleAlt";
import GroupAddIcon        from "@mui/icons-material/GroupAdd";
import LeaderboardIcon     from "@mui/icons-material/Leaderboard";

import { useAuth } from "../components/auth/AuthContext"; // ← ajusta la ruta si difiere

import logo               from "../assets/icono-plus.png";
import botellon           from "../assets/botellon.png";
import botelladescartable from "../assets/botelladescartable.png";
import imagenhielo        from "../assets/imagen-hielo.png";
import capsulamust        from "../assets/capsulamust.png";

// ─── Tipo con roles opcionales ────────────────────────
type MenuItem = {
  name:   string;
  icon:   React.ReactNode;
  path:   string;
  roles?: string[]; // undefined = visible para todos
};

const ALL_MENU_ITEMS: MenuItem[] = [
  { name: "CONSOLIDADO",   icon: <BarChart />,                                        path: "/dashboard/consolidado",   roles: ["ADMIN"] },
  { name: "GERENCIA",      icon: <LeaderboardIcon />,                                 path: "/dashboard/gerencia",      roles: ["ADMIN"] },
  { name: "BOTELLÓN",      icon: <img src={botellon}           alt="botellon"    />,  path: "/dashboard/botellon",      roles: ["ADMIN"] },
  { name: "DESCARTABLE",   icon: <img src={botelladescartable} alt="descartable" />,  path: "/dashboard/preventa",      roles: ["ADMIN", "SUPERVISOR"] },
  { name: "HIELO",         icon: <img src={imagenhielo}        alt="hielo"       />,  path: "/dashboard/hielo",         roles: ["ADMIN"] },
  { name: "PLUS",          icon: <img src={logo}               alt="plus"        />,  path: "/dashboard/plus",          roles: ["ADMIN"] },
  { name: "CAFÉ",          icon: <img src={capsulamust}        alt="cafe"        />,  path: "/dashboard/cafe",          roles: ["ADMIN"] },
  { name: "VISITAS RUTAS", icon: <LocalShippingIcon />,                               path: "/dashboard/rutas-visitas", roles: ["ADMIN"] },
  { name: "CLIENTES",      icon: <PeopleAltIcon />,                                   path: "/dashboard/clientes",      roles: ["ADMIN"] },
  {
    name:  "USUARIOS",
    icon:  <GroupAddIcon />,
    path:  "/dashboard/crearusuarios",
    roles: ["ADMIN", "SUPERVISOR"], // ADMIN y SUPERVISOR ven este ítem
  },
];

export default function SidebarDashboards() {
  const [isOpen, setIsOpen] = useState(false);
  const location            = useLocation();
  const { user }            = useAuth();

  // Filtra ítems según el rol del usuario logueado
  const menuItems = ALL_MENU_ITEMS.filter(
    item => !item.roles || item.roles.includes(user?.role ?? "")
  );

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
