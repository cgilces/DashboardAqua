import React, { useState, useMemo, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Card } from "../../components/common/Card";
import Button from "../../components/elements/Button";
import PanelButtons from "../../components/elements/PanelButtons";
import {
    UserAddIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "../../components/common/Icons";
import Modal from "../../components/elements/Modal";
import { Table, Column } from "../../components/elements/Table";
import Input from "../../components/elements/Input";
import { Header } from "../../components/common/Header";
import DashboardLayout from "../../layout/DashboardLayout";
import logo from "../../assets/logo.png";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { DeleteIcon, EditIcon } from "lucide-react";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from '../../config';
import { MODULOS_ASIGNABLES, SECCIONES_POR_MODULO } from "../../utils/visibilidad";

interface User {
    id: number;
    username: string;
    role: string;
    routes: string[];
    modules: string[];
    moduleSections: Record<string, string[]>;
}

// ─── Tipos alerta ─────────────────────────────────────
type AlertType = "success" | "error";
interface AlertState {
    visible: boolean;
    type: AlertType;
    message: string;
    closing: boolean; // para animación de salida
}

// ─── Icono lupa ───────────────────────────────────────
const SearchIcon = ({ className = "" }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-4.35-4.35M18 10a8 8 0 10-8 8 8 8 0 008-8z" />
    </svg>
);

// ─── Icono check ──────────────────────────────────────
const CheckIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

// ─── Icono error ──────────────────────────────────────
const XCircleIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// ══════════════════════════════════════════════════════
// COMPONENTE ALERTA CENTRADA
// ══════════════════════════════════════════════════════
const CenteredAlert = ({
    alert, onClose
}: {
    alert: AlertState;
    onClose: () => void;
}) => {
    if (!alert.visible) return null;

    const isSuccess = alert.type === "success";

    return (
        // Overlay
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4
      transition-all duration-300
      ${alert.closing ? "opacity-0" : "opacity-100"}
    `}
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={onClose} // click fuera cierra
        >
            {/* Card alerta */}
            <div
                onClick={e => e.stopPropagation()} // evita cierre al clickar dentro
                className={`relative w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-5 text-center
          transform transition-all duration-300
          ${alert.closing ? "scale-90 opacity-0" : "scale-100 opacity-100"}
        `}
                style={{
                    background: isSuccess
                        ? "linear-gradient(135deg, #0a2a1f 0%, #0f3328 100%)"
                        : "linear-gradient(135deg, #2a0a0a 0%, #33100f 100%)",
                    boxShadow: isSuccess
                        ? "0 0 0 1px rgba(16,185,129,0.3), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(16,185,129,0.1)"
                        : "0 0 0 1px rgba(239,68,68,0.3), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.1)",
                }}
            >
                {/* Barra de progreso — cuenta 5s */}
                <div className="absolute top-0 left-0 h-0.5 w-full rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isSuccess ? "bg-emerald-400" : "bg-red-400"}`}
                        style={{
                            animation: alert.closing ? "none" : "shrink 5s linear forwards",
                        }}
                    />
                </div>

                {/* Icono */}
                <div className={`p-4 rounded-full ${isSuccess ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}
                    style={{ boxShadow: isSuccess ? "0 0 24px rgba(16,185,129,0.2)" : "0 0 24px rgba(239,68,68,0.2)" }}>
                    {isSuccess ? <CheckIcon /> : <XCircleIcon />}
                </div>

                {/* Título */}
                <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isSuccess ? "text-emerald-400/70" : "text-red-400/70"}`}>
                        {isSuccess ? "Operación exitosa" : "Error"}
                    </p>
                    <p className="text-white font-semibold text-lg leading-snug">{alert.message}</p>
                </div>

                {/* Botón OK */}
                <button onClick={onClose}
                    className={`px-8 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 active:scale-95
            ${isSuccess
                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                            : "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                        }`}>
                    OK
                </button>

                <p className="text-white/20 text-xs">Se cierra automáticamente en 5s</p>
            </div>

            {/* Keyframe para barra */}
            <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
        </div>
    );
};


// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════
const CreacionUsuario: React.FC = () => {

    const { user } = useAuth();
    const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";


    // ── Alert state ───────────────────────────────────
    const [alert, setAlert] = useState<AlertState>({
        visible: false, type: "success", message: "", closing: false
    });
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showAlert = useCallback((message: string, type: AlertType) => {
        // Limpiar timer anterior si hay uno
        if (timerRef.current) clearTimeout(timerRef.current);

        setAlert({ visible: true, type, message, closing: false });

        // Auto-cerrar a los 5s con animación de salida
        timerRef.current = setTimeout(() => {
            setAlert(prev => ({ ...prev, closing: true }));
            setTimeout(() => setAlert(prev => ({ ...prev, visible: false })), 300);
        }, 5000);
    }, []);

    const closeAlert = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setAlert(prev => ({ ...prev, closing: true }));
        setTimeout(() => setAlert(prev => ({ ...prev, visible: false })), 300);
    }, []);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    // ── State lista ───────────────────────────────────
    const [users, setUsers] = useState<User[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ── State formulario ──────────────────────────────
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("VENDEDOR");
    const [assignedRoutes, setAssignedRoutes] = useState<string[]>([]);
    const [allowedModules, setAllowedModules] = useState<string[]>([]);
    const [moduleSections, setModuleSections] = useState<Record<string, string[]>>({});
    const [tempRoute, setTempRoute] = useState("");
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // ── State modal ───────────────────────────────────
    const [modalElim, setModalElim] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    // ── GET /listausuario ─────────────────────────────
    const cargarUsuarios = async () => {
        try {
            setLoadingList(true);
            const res = await fetch(`${API_BASE_URL}/api/usuarios/listausuario`);
            const json = await res.json();
            if (!json.ok) throw new Error(json.msg);
            setUsers((json.usuarios || []).map((u: any) => ({
                id: u.id, username: u.usuario, role: u.rol,
                routes: Array.isArray(u.rutas_asignadas) ? u.rutas_asignadas : [],
                modules: Array.isArray(u.modulos_permitidos) ? u.modulos_permitidos : [],
                moduleSections: (u.modulo_secciones && typeof u.modulo_secciones === "object") ? u.modulo_secciones : {},
            })));
        } catch (err: any) {
            showAlert(err.message || "Error cargando usuarios", "error");
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => { cargarUsuarios(); }, []);

    // ── Filtro + paginación ───────────────────────────
    const filteredUsers = useMemo(() =>
        users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase())),
        [users, searchTerm]
    );
    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / itemsPerPage));
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage
    );
    useEffect(() => setCurrentPage(1), [searchTerm]);

    // ── Formulario helpers ────────────────────────────
    const resetForm = () => {
        setUsername(""); setPassword(""); setRole("VENDEDOR");
        setAssignedRoutes([]); setAllowedModules([]); setModuleSections({}); setEditingUserId(null);
    };

    const addRoute = () => {
        const r = tempRoute.trim();
        if (r && !assignedRoutes.includes(r)) { setAssignedRoutes(p => [...p, r]); setTempRoute(""); }
    };

    const toggleModule = (path: string) =>
        setAllowedModules(p => {
            if (p.includes(path)) {
                // Al quitar un módulo, también se limpian sus secciones.
                setModuleSections(s => { const c = { ...s }; delete c[path]; return c; });
                return p.filter(x => x !== path);
            }
            return [...p, path];
        });

    const toggleSeccion = (modulePath: string, key: string) =>
        setModuleSections(s => {
            const cur = s[modulePath] ?? [];
            const next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key];
            const c = { ...s };
            if (next.length) c[modulePath] = next; else delete c[modulePath];
            return c;
        });

    const handleEditUser = (u: User) => {
        setEditingUserId(u.id); setUsername(u.username);
        setRole(u.role); setAssignedRoutes(u.routes); setAllowedModules(u.modules ?? []);
        setModuleSections(u.moduleSections ?? {}); setPassword("");
    };

    // ── POST /crear  |  PUT /editar/:id ──────────────
    const handleSaveToDatabase = async () => {
        if (!username.trim()) return showAlert("El nombre de usuario es requerido", "error");
        if (!editingUserId && !password.trim()) return showAlert("La contraseña es requerida", "error");

        const body: any = {
            usuario: username.trim(),
            rol: role,
            rutas_asignadas: assignedRoutes,
            // ADMIN ve todo: no se guardan privilegios explícitos para ese rol.
            modulos_permitidos: role === "ADMIN" ? [] : allowedModules,
            modulo_secciones: role === "ADMIN" ? {} : moduleSections,
        };
        if (password.trim()) body.clave = password.trim();

        try {
            setSaving(true);
            const url = editingUserId ? `${API_BASE_URL}/api/usuarios/editar/${editingUserId}` : `${API_BASE_URL}/api/usuarios/crear`;
            const method = editingUserId ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const json = await res.json();
            if (!json.ok) throw new Error(json.msg);

            showAlert(
                editingUserId
                    ? `Usuario "${username}" actualizado correctamente`
                    : `Usuario "${username}" creado exitosamente`,
                "success"
            );
            resetForm();
            cargarUsuarios();
        } catch (err: any) {
            showAlert(err.message || "Error al guardar", "error");
        } finally { setSaving(false); }
    };

    // ── DELETE /eliminar/:id ──────────────────────────
    const openDeleteModal = (u: User) => { setUserToDelete(u); setModalElim(true); };
    const closeModal = () => { setModalElim(false); setUserToDelete(null); };
    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        const nombre = userToDelete.username;
        try {
            const res = await fetch(`${API_BASE_URL}/api/usuarios/eliminar/${userToDelete.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!json.ok) throw new Error(json.msg);
            showAlert(`Usuario "${nombre}" eliminado correctamente`, "success");
            cargarUsuarios();
        } catch (err: any) {
            showAlert(err.message || "Error al eliminar", "error");
        }
        closeModal();
    };

    // ── Columnas ──────────────────────────────────────
    const userColumns: Column<User>[] = [
        {
            header: "Usuario", accessorKey: "username",
            headerClassName: "text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#5fa88a]",
            className: "px-5 py-3 font-semibold text-[#e8f5f0]"
        },
        {
            header: "Rol",
            headerClassName: "text-center py-3 text-xs font-bold uppercase tracking-widest text-[#5fa88a]",
            className: "text-center py-3",
            render: u => {
                const colors: Record<string, string> = {
                    ADMIN: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                    VENDEDOR: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
                    DESPACHADOR: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
                };
                return (
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${colors[u.role] || "bg-white/10 text-white/60"}`}>
                        {u.role}
                    </span>
                );
            }
        },
        {
            header: "Rutas",
            headerClassName: "text-center py-3 text-xs font-bold uppercase tracking-widest text-[#5fa88a]",
            className: "text-center py-3",
            render: u => u.routes.length > 0 ? (
                <div className="flex flex-wrap gap-1 justify-center">
                    {u.routes.map((r, i) => (
                        <span key={i} className="bg-[#1a4a3a] text-[#7dd4b0] text-xs px-2 py-0.5 rounded-full border border-[#2d6b52]/50">
                            {r}
                        </span>
                    ))}
                </div>
            ) : <span className="text-white/20 text-sm">—</span>
        },
        {
            header: "Acciones",
            headerClassName: "text-center py-3 text-xs font-bold uppercase tracking-widest text-[#5fa88a]",
            className: "text-center py-3",
            render: u => (
                <div className="flex gap-2 justify-center">
                    <button onClick={() => handleEditUser(u)}
                        className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/25 hover:border-sky-400/40 transition-all duration-200 group">
                        <EditIcon className="w-3.5 h-3.5 text-sky-400 group-hover:text-sky-300" />
                    </button>
                    <button onClick={() => openDeleteModal(u)}
                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 hover:border-red-400/40 transition-all duration-200 group">
                        <DeleteIcon className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" />
                    </button>
                </div>
            )
        },
    ];

    // ─────────────────────────────────────────────────
    return (
        <DashboardLayout>
            {/* ══ ALERTA CENTRADA ══ */}
            <CenteredAlert alert={alert} onClose={closeAlert} />

            <div className="main-content min-h-screen text-white px-6 md:px-10 py-6">
                <Header />

                {/* HEADER */}
                <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E]/40 pb-4 py-6">
                    <div className="flex items-center gap-4">
                        <img src={logo} className="h-14 w-auto transition-all duration-300" alt="Logo" />
                        <div>
                            <h1 className="text-3xl font-bold tracking-wide">REGISTROS DE USUARIOS</h1>
                        </div>
                    </div>
                    
                </header>

                {/* GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── LISTADO ── */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl overflow-hidden"
                            style={{ boxShadow: "0 0 0 1px rgba(4,108,94,0.25), 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(4,108,94,0.15)" }}>

                            <div className="bg-[#0d2820] px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#1a4a3a]">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-[#e8f5f0] tracking-wide">Usuarios Registrados</h2>
                                    {loadingList
                                        ? <span className="w-3.5 h-3.5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin" />
                                        : <span className="text-xs text-[#5fa88a] bg-[#1a4a3a] px-2 py-0.5 rounded-full border border-[#2d6b52]/40">{totalUsers}</span>
                                    }
                                </div>

                                {/* Buscador */}
                                <div className="relative w-full sm:w-56">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5fa88a] pointer-events-none" />
                                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Buscar usuario..."
                                        className="w-full pl-9 pr-8 py-2 rounded-xl text-sm text-[#e8f5f0] placeholder-[#5fa88a]/50
                      bg-[#162f27] border border-[#2d6b52]/50
                      focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20
                      transition-all duration-200"/>
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5fa88a]/60 hover:text-white transition leading-none">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tabla */}
                            <div className="bg-[#0a1f19] overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#1a4a3a] bg-[#0d2820]">
                                            {userColumns.map((col, i) => (
                                                <th key={i} className={col.headerClassName}>{col.header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-10 text-[#5fa88a]/40 text-sm italic">
                                                    {loadingList ? "Cargando..." : "No se encontraron usuarios"}
                                                </td>
                                            </tr>
                                        ) : paginatedUsers.map((u, idx) => (
                                            <tr key={u.id}
                                                className={`border-b border-[#1a4a3a]/50 transition-colors duration-150
                          ${idx % 2 === 0 ? "bg-[#0a1f19]" : "bg-[#0c2319]"}
                          hover:bg-[#132e24]`}>
                                                {userColumns.map((col, ci) => (
                                                    <td key={ci} className={col.className}>
                                                        {col.render ? col.render(u) : (u as any)[col.accessorKey || ""]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            <div className="bg-[#0d2820] px-5 py-3 flex justify-between items-center border-t border-[#1a4a3a]">
                                <span className="text-xs text-[#5fa88a]/70">
                                    {totalUsers > 0
                                        ? `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalUsers)} de ${totalUsers}`
                                        : "Sin resultados"}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                                        className="p-1.5 rounded-lg border border-[#2d6b52]/40 bg-[#162f27] text-[#5fa88a]
                      hover:bg-[#1a4a3a] hover:border-[#5fa88a]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-[#5fa88a] min-w-[40px] text-center">{currentPage}/{totalPages}</span>
                                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
                                        className="p-1.5 rounded-lg border border-[#2d6b52]/40 bg-[#162f27] text-[#5fa88a]
                      hover:bg-[#1a4a3a] hover:border-[#5fa88a]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ── FORMULARIO ── */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl p-6 sticky top-6"
                            style={{ boxShadow: "0 0 0 1px rgba(4,108,94,0.3), 0 8px 40px rgba(0,0,0,0.5), 0 2px 12px rgba(4,108,94,0.2)", background: "linear-gradient(135deg, #0f2d24 0%, #162b25 60%, #0d2218 100%)" }}>

                            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-[#2d6b52]/30">
                                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25">
                                    <UserAddIcon className="w-4 h-4 text-emerald-400" />
                                </div>
                                <h2 className="text-base font-bold text-[#e8f5f0]">
                                    {editingUserId ? "Editar Usuario" : "Nuevo Usuario"}
                                </h2>
                                {editingUserId && (
                                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                        Editando
                                    </span>
                                )}
                            </div>

                            <div className="space-y-4">

                                {[
                                    { label: "Nombre de Usuario", type: "text", value: username, onChange: setUsername, placeholder: "Nombre de usuario" },
                                    { label: "Contraseña", type: "password", value: password, onChange: setPassword, placeholder: "Contraseña", optional: !!editingUserId },
                                ].map(field => (
                                    <div key={field.label}>
                                        <label className="text-xs font-semibold uppercase tracking-widest text-[#5fa88a]/80 block mb-1.5">
                                            {field.label}{" "}
                                            {field.optional && <span className="normal-case font-normal text-white/30">(opcional)</span>}
                                        </label>
                                        <input type={field.type} value={field.value} placeholder={field.placeholder}
                                            onChange={e => field.onChange(e.target.value)}
                                            className="w-full rounded-xl px-3.5 py-2.5 text-sm text-[#162b25] bg-white/95
                        border border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                        transition-all duration-200 placeholder-[#162b25]/30"/>
                                    </div>
                                ))}

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-widest text-[#5fa88a]/80 block mb-1.5">Rol</label>
                                    <select value={role} onChange={e => setRole(e.target.value)}
                                        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-[#162b25] bg-white/95
      border border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all duration-200">
                                        <option value="VENDEDOR">Vendedor</option>
                                        {isAdmin && <option value="ADMIN">Administrador</option>}
                                        {/* <option value="DESPACHADOR">Despachador</option> */}
                                        <option value="SUPERVISOR">Supervisor</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-widest text-[#5fa88a]/80 block mb-1.5">Rutas Asignadas</label>
                                    {assignedRoutes.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2 p-2.5 rounded-xl bg-white/5 border border-[#2d6b52]/30">
                                            {assignedRoutes.map((r, i) => (
                                                <span key={i} className="flex items-center gap-1 bg-[#1a4a3a] text-[#7dd4b0] text-xs px-2.5 py-1 rounded-full border border-[#2d6b52]/50 font-medium">
                                                    {r}
                                                    <button type="button" onClick={() => setAssignedRoutes(p => p.filter((_, ix) => ix !== i))}
                                                        className="font-bold hover:text-red-400 transition leading-none ml-0.5">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <input type="text" value={tempRoute} placeholder="Ej: R1"
                                            onChange={e => setTempRoute(e.target.value)}
                                            className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-[#162b25] bg-white/95
                        border border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all duration-200"
                                            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addRoute(); } }}
                                        />
                                        <button type="button" onClick={addRoute}
                                            className="px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300
                        hover:bg-emerald-500/30 font-bold text-lg transition-all duration-200 active:scale-95">
                                            +
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-white/25 mt-1.5">Enter, coma o "+" para agregar</p>
                                </div>

                                {/* ── PRIVILEGIOS: módulos visibles (no aplica a ADMIN, que ve todo) ── */}
                                {role !== "ADMIN" && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-widest text-[#5fa88a]/80 block mb-1.5">
                                            Módulos visibles
                                        </label>
                                        <p className="text-[10px] text-white/30 mb-2 leading-snug">
                                            Marca lo que este usuario puede ver. Si no marcas nada, se usan los permisos
                                            por defecto de su rol/canal.
                                        </p>
                                        <div className="grid grid-cols-1 gap-1 p-2.5 rounded-xl bg-white/5 border border-[#2d6b52]/30 max-h-72 overflow-y-auto">
                                            {MODULOS_ASIGNABLES.map(m => {
                                                const marcado = allowedModules.includes(m.path);
                                                const secciones = SECCIONES_POR_MODULO[m.path] ?? [];
                                                const seleccionadas = moduleSections[m.path] ?? [];
                                                return (
                                                    <div key={m.path}>
                                                        <label className="flex items-center gap-2 text-sm text-[#e8f5f0] cursor-pointer px-1.5 py-1 rounded-lg hover:bg-white/5 transition-colors">
                                                            <input type="checkbox"
                                                                checked={marcado}
                                                                onChange={() => toggleModule(m.path)}
                                                                className="accent-emerald-500 w-4 h-4" />
                                                            {m.label}
                                                        </label>
                                                        {/* Submenú de secciones (solo si el módulo está marcado y tiene secciones) */}
                                                        {marcado && secciones.length > 0 && (
                                                            <div className="ml-6 mb-1 pl-2 border-l border-[#2d6b52]/40">
                                                                <p className="text-[10px] text-white/30 py-0.5">
                                                                    Secciones (vacío = todo el módulo):
                                                                </p>
                                                                {secciones.map(s => (
                                                                    <label key={s.key}
                                                                        className="flex items-center gap-2 text-xs text-[#cfe9df] cursor-pointer px-1 py-0.5 rounded hover:bg-white/5">
                                                                        <input type="checkbox"
                                                                            checked={seleccionadas.includes(s.key)}
                                                                            onChange={() => toggleSeccion(m.path, s.key)}
                                                                            className="accent-emerald-500 w-3.5 h-3.5" />
                                                                        {s.label}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleSaveToDatabase} disabled={saving}
                                        className="flex-1 h-10 rounded-xl font-bold text-sm uppercase tracking-wider
                      bg-emerald-500/20 border border-emerald-500/30 text-emerald-300
                      hover:bg-emerald-500/30 hover:border-emerald-400/50
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 active:scale-[0.98]">
                                        {saving ? "Guardando..." : editingUserId ? "Actualizar" : "Guardar"}
                                    </button>
                                    {editingUserId && (
                                        <button onClick={resetForm}
                                            className="flex-1 h-10 rounded-xl font-bold text-sm uppercase tracking-wider
                        bg-white/5 border border-white/15 text-white/60
                        hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-[0.98]">
                                            Nuevo
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>

                </div>

                <Modal
                    isOpen={modalElim}
                    itemToDelete={userToDelete?.username || ""}
                    onClose={closeModal}
                    onConfirm={handleDeleteUser}
                />

            </div>
        </DashboardLayout>
    );
};

export default CreacionUsuario;
