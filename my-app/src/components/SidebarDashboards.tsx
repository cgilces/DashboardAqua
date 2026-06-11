import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../css/Navbar.css";

import { BarChart, Menu, Close } from "@mui/icons-material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";

import { useAuth } from "../components/auth/AuthContext";
import { canalesDeUsuario } from "../utils/visibilidad";

import logo from "../assets/icono-plus.png";
import botellon from "../assets/botellon.png";
import botelladescartable from "../assets/botelladescartable.png";
import imagenhielo from "../assets/imagen-hielo.png";
import capsulamust from "../assets/capsulamust.png";

type MenuItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
  canales?: string[];       // canales (prefijos de ruta) a los que pertenece el módulo
  abiertoATodos?: boolean;  // visible para cualquier usuario logueado (ej. Clientes)
  adminOnly?: boolean;      // solo ADMIN, nunca asignable a otros (ej. Usuarios)
};

const ALL_MENU_ITEMS: MenuItem[] = [
  { name: "CONSOLIDADO",   icon: <BarChart />,                                        path: "/dashboard/consolidado",   roles: ["ADMIN"] },
  { name: "BOTELLÓN",      icon: <img src={botellon}           alt="botellon"    />,  path: "/dashboard/botellon",      roles: ["ADMIN"], canales: ["T"] },
  { name: "DESCARTABLE",   icon: <img src={botelladescartable} alt="descartable" />,  path: "/dashboard/preventa",      roles: ["ADMIN", "SUPERVISOR"], canales: ["TV", "PV", "R", "A", "M", "V"] },
  { name: "HIELO",         icon: <img src={imagenhielo}        alt="hielo"       />,  path: "/dashboard/hielo",         roles: ["ADMIN"], canales: ["H"] },
  { name: "PLUS",          icon: <img src={logo}               alt="plus"        />,  path: "/dashboard/plus",          roles: ["ADMIN"] },
  { name: "CAFÉ",          icon: <img src={capsulamust}        alt="cafe"        />,  path: "/dashboard/cafe",          roles: ["ADMIN"] },
  { name: "PROMOCIONES",   icon: <LocalOfferIcon />,                                  path: "/dashboard/promociones",   roles: ["ADMIN"] },
  { name: "VISITAS RUTAS", icon: <LocalShippingIcon />,                               path: "/dashboard/rutas-visitas", roles: ["ADMIN"] },
  { name: "CLIENTES",      icon: <PeopleAltIcon />,                                   path: "/dashboard/clientes",      abiertoATodos: true },
  { name: "USUARIOS",      icon: <GroupAddIcon />,                                    path: "/dashboard/crearusuarios", roles: ["ADMIN"], adminOnly: true },
];

const isMobileViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 1023.98px)").matches;

export default function SidebarDashboards() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const location = useLocation();
  const { user } = useAuth();

  // Visibilidad del menú:
  //  - ADMIN → todo.
  //  - `adminOnly` (Usuarios) → nunca para otros roles.
  //  - Si el usuario tiene privilegios EXPLÍCITOS (allowed_modules) → solo esos.
  //  - Si no, defaults: `abiertoATodos` (Clientes) + módulos de su canal + por rol.
  const role = (user?.role ?? "").toUpperCase();
  const canalesUsuario = canalesDeUsuario(user?.assigned_routes);
  const modulosPermitidos = user?.allowed_modules ?? [];
  const tienePrivilegiosExplicitos = Array.isArray(modulosPermitidos) && modulosPermitidos.length > 0;

  const menuItems = ALL_MENU_ITEMS.filter((item) => {
    if (role === "ADMIN") return true;
    if (item.adminOnly) return false;
    if (tienePrivilegiosExplicitos) return modulosPermitidos.includes(item.path);
    // Defaults cuando no hay privilegios explícitos configurados:
    if (item.abiertoATodos) return true;
    if (item.canales && item.canales.length) {
      return item.canales.some((c) => canalesUsuario.includes(c));
    }
    return !item.roles || item.roles.includes(role);
  });

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileViewport()) setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bloquear scroll del body cuando drawer abierto en móvil
  useEffect(() => {
    if (isOpen && isMobileViewport()) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
    return () => document.body.classList.remove("sidebar-open");
  }, [isOpen]);

  // Cerrar al cambiar de ruta en móvil
  useEffect(() => {
    if (isMobileViewport()) setIsOpen(false);
  }, [location.pathname]);

  // Reajustar al cambiar de breakpoint: siempre cerrar, nunca abrir automáticamente
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const handler = () => setIsOpen(false);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const toggle = () => setIsOpen((p) => !p);
  const closeOnMobile = () => {
    if (isMobileViewport()) setIsOpen(false);
  };

  return (
    <>
      <button
        className="toggle-btn"
        onClick={toggle}
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isOpen}
      >
        {isOpen ? <Close /> : <Menu />}
      </button>

      <div
        className={`sidebar-backdrop ${isOpen ? "visible" : ""}`}
        onClick={closeOnMobile}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? "open" : "closed"}`}
        aria-label="Menú principal"
      >
        <ul>
          {menuItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`menu-item ${active ? "active-menu" : ""}`}
                  onClick={closeOnMobile}
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
