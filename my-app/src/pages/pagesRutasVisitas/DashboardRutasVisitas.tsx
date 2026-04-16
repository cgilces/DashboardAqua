import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonRutasyDetalles from "../../components/elements/BotonRutasyDetalles";
import BotonHistorialRutas from "../../components/elements/BotonHistorialRutas";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { API_BASE_URL } from "../../config";

/* ============================================================
   CONSTANTES
============================================================ */
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_LARGOS: Record<string, number> = {
  Enero:1,Febrero:2,Marzo:3,Abril:4,Mayo:5,Junio:6,
  Julio:7,Agosto:8,Septiembre:9,Octubre:10,Noviembre:11,Diciembre:12,
};

const TIPOS_DOCUMENTO = [
  "Todo", "Facturas", "Órdenes", "Transferencias",
  "Devoluciones", "Solicitudes de devoluciones", "Pagos", "Nuevos clientes",
];

const GRUPOS_USUARIO = [
  "Todos los grupos", "POR DEFECTO", "DESCARTABLE T", "DESPACHADOR",
  "DISTRIBUIDOR", "DOMICILIO", "EMPRESAS", "HIELO", "MAYORISTA",
  "PREVENTA", "PREVENTA RURAL", "PREVENTA VIP", "QUITO", "RURAL",
  "SUPERVISOR", "TELEVENTA VIP", "TELEVENTAS", "TIENDAS", "TIENDAS VIP", "VIP",
];

/* ============================================================
   HELPERS
============================================================ */
const fmt2 = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFechaLarga = (d: Date) =>
  `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;

const fmtFechaTitulo = (fechaStr: string) => {
  const d = new Date(fechaStr + "T12:00:00");
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
};

const fmtVisita = (iso: string | null): string => {
  if (!iso) return "No";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No";
  const h   = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `Si, ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()} ${h}:${min}`;
};

const obtenerRangoSemana = (fecha: string) => {
  const d   = new Date(fecha);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const lunes   = new Date(d.setDate(diff));
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 7);
  return { inicio: lunes.toISOString().slice(0,10), fin: domingo.toISOString().slice(0,10) };
};

/* ============================================================
   TIPOS
============================================================ */
interface FilaUsuario {
  codigo_usuario: string;
  nombre_usuario: string;
  codigo_ruta: string;
  sucursal_usuario: string | null;
  grupo_usuario: string;
  dia_inicio: string | null;
  dia_fin: string | null;
  total_ruta: number;
  visitas: number;
  facturas_monto: number;
  facturas_count: number;
  ordenes_monto: number;
  ordenes_count: number;
  transferencias_monto: number;
  transferencias_count: number;
  devoluciones_monto: number;
  devoluciones_count: number;
  pagos_monto: number;
  pagos_count: number;
}

/* ============================================================
   COMPONENTE
============================================================ */
export default function DashboardRutasVisitas() {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual  = hoy.getMonth() + 1;

  /* ── Filtros de fecha/periodo ─ */
  const [tipoPeriodo,     setTipoPeriodo]     = useState<"mes"|"semana"|"dia">("dia");
  const [mesSeleccionado, setMesSeleccionado] = useState(
    localStorage.getItem("mesSeleccionado") ?? mesActual.toString()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionado") ?? anioActual.toString()
  );
  const [fechaDia,    setFechaDia]    = useState(hoy.toISOString().slice(0,10));
  const [fechaSemana, setFechaSemana] = useState(hoy.toISOString().slice(0,10));

  /* ── Filtros de contenido ─ */
  const [tipoDoc,  setTipoDoc]  = useState("Todo");
  const [grupo,    setGrupo]    = useState("Todos los grupos");
  const [busqueda, setBusqueda] = useState("");

  /* ── Datos ─ */
  const [filas,    setFilas]    = useState<FilaUsuario[]>([]);
  const [cargando, setCargando] = useState(true);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  /* ── Persistencia mes/año ─ */
  useEffect(() => {
    localStorage.setItem("mesSeleccionado",  mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  /* ── Rango de fechas ─ */
  const getRango = (): { inicio: string; fin: string } => {
    if (tipoPeriodo === "dia") return { inicio: fechaDia, fin: fechaDia };
    if (tipoPeriodo === "semana") return obtenerRangoSemana(fechaSemana);
    const mes      = mesSeleccionado.padStart(2, "0");
    const ultimoDia = new Date(Number(anioSeleccionado), Number(mes), 0).getDate();
    return { inicio: `${anioSeleccionado}-${mes}-01`, fin: `${anioSeleccionado}-${mes}-${ultimoDia}` };
  };

  /* ── Carga ─ */
  useEffect(() => { cargar(); }, [tipoPeriodo, mesSeleccionado, anioSeleccionado, fechaDia, fechaSemana]);

  const cargar = async () => {
    setCargando(true);
    try {
      const { inicio, fin } = getRango();
      const url = `${API_BASE_URL}/api/visitas/dashboard-usuarios?fechaInicio=${inicio}&fechaFin=${fin}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      setFilas(await res.json());
    } catch (e) {
      console.error("❌ Error visitas:", e);
      setFilas([]);
    } finally {
      setCargando(false);
    }
  };

  /* ── Filtrado cliente-side ─ */
  const filasFiltradas = useMemo(() => {
    return filas.filter(f => {
      // Filtro búsqueda texto
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!f.nombre_usuario?.toLowerCase().includes(q) && !f.codigo_ruta?.toLowerCase().includes(q))
          return false;
      }
      // Filtro grupo de usuario
      if (grupo !== "Todos los grupos") {
        const g = (f.grupo_usuario || "POR DEFECTO").toUpperCase();
        if (g !== grupo.toUpperCase()) return false;
      }
      // Filtro tipo de documento
      switch (tipoDoc) {
        case "Facturas":               return Number(f.facturas_count) > 0;
        case "Órdenes":                return Number(f.ordenes_count) > 0;
        case "Transferencias":         return Number(f.transferencias_count) > 0;
        case "Devoluciones":           return Number(f.devoluciones_count) > 0;
        case "Solicitudes de devoluciones": return Number(f.devoluciones_count) > 0;
        case "Pagos":                  return Number(f.pagos_count) > 0;
        case "Nuevos clientes":        return true; // campo no disponible aún
        default:                       return true;
      }
    });
  }, [filas, busqueda, grupo, tipoDoc]);

  /* ── Totales ─ */
  const tot = useMemo(() => ({
    total_ruta:           filasFiltradas.reduce((a,f) => a + Number(f.total_ruta), 0),
    visitas:              filasFiltradas.reduce((a,f) => a + Number(f.visitas), 0),
    facturas_monto:       filasFiltradas.reduce((a,f) => a + Number(f.facturas_monto), 0),
    facturas_count:       filasFiltradas.reduce((a,f) => a + Number(f.facturas_count), 0),
    ordenes_monto:        filasFiltradas.reduce((a,f) => a + Number(f.ordenes_monto), 0),
    ordenes_count:        filasFiltradas.reduce((a,f) => a + Number(f.ordenes_count), 0),
    transferencias_monto: filasFiltradas.reduce((a,f) => a + Number(f.transferencias_monto), 0),
    transferencias_count: filasFiltradas.reduce((a,f) => a + Number(f.transferencias_count), 0),
    devoluciones_monto:   filasFiltradas.reduce((a,f) => a + Number(f.devoluciones_monto), 0),
    devoluciones_count:   filasFiltradas.reduce((a,f) => a + Number(f.devoluciones_count), 0),
    pagos_monto:          filasFiltradas.reduce((a,f) => a + Number(f.pagos_monto), 0),
    pagos_count:          filasFiltradas.reduce((a,f) => a + Number(f.pagos_count), 0),
  }), [filasFiltradas]);

  const conc = (v: number, t: number) =>
    t > 0 ? `${Math.round((v / t) * 100)}%` : "0%";

  const etiquetaPeriodo = () => {
    const { inicio, fin } = getRango();
    if (tipoPeriodo === "dia") return fmtFechaTitulo(inicio);
    if (tipoPeriodo === "semana") {
      return `${fmtFechaLarga(new Date(inicio+"T12:00:00"))} – ${fmtFechaLarga(new Date(fin+"T12:00:00"))}`;
    }
    const nombre = Object.entries(MESES_LARGOS).find(([,v]) => v === Number(mesSeleccionado))?.[0] ?? mesSeleccionado;
    return `${nombre} ${anioSeleccionado}`;
  };

  /* ── Select helper ─ */
  const SelectFiltro = ({
    label, value, onChange, options, color = "emerald",
  }: {
    label: string; value: string; onChange: (v: string) => void;
    options: string[]; color?: "emerald" | "purple" | "blue";
  }) => {
    const ring = color === "purple" ? "focus:border-purple-400"
               : color === "blue"   ? "focus:border-blue-400"
               :                      "focus:border-emerald-400";
    const dot  = color === "purple" ? "bg-purple-400"
               : color === "blue"   ? "bg-blue-400"
               :                      "bg-emerald-400";
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        <div className="relative">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${dot}`} />
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`appearance-none bg-[#012E24] border border-[#046C5E]/60 rounded-lg
              pl-6 pr-8 py-2 text-xs text-white font-semibold cursor-pointer
              focus:outline-none ${ring} transition-colors
              hover:border-[#046C5E]`}
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  };

  const Th = ({ children, center = true }: { children: React.ReactNode; center?: boolean }) => (
    <th className={`px-3 py-2 text-[10px] uppercase tracking-wide text-emerald-300 whitespace-nowrap border-r border-[#046C5E]/30 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* ── CABECERA ── */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-[#046C5E] pb-4 gap-4">
          <div className="flex items-center gap-3">
            <LocalShippingIcon sx={{ fontSize: 36 }} />
            <h1 className="text-xl md:text-2xl font-bold">DASHBOARD VISITAS RUTAS</h1>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {isAdmin && <BotonRutasyDetalles />}
            {isAdmin && <BotonHistorialRutas />}
          </div>

          {/* Selector periodo */}
          <div className="flex flex-wrap gap-2 items-center">
            <select className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm" value={tipoPeriodo}
              onChange={e => setTipoPeriodo(e.target.value as any)}>
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>

            {tipoPeriodo === "mes" && (
              <>
                <select className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm" value={mesSeleccionado}
                  onChange={e => setMesSeleccionado(e.target.value)}>
                  {Object.entries(MESES_LARGOS).map(([n, v]) => (
                    <option key={v} value={v}>{n}</option>
                  ))}
                </select>
                <select className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm" value={anioSeleccionado}
                  onChange={e => setAnioSeleccionado(e.target.value)}>
                  {Array.from({ length: 5 }, (_, i) => anioActual + 1 - i).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </>
            )}
            {tipoPeriodo === "semana" && (
              <input type="date" className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm"
                value={fechaSemana} onChange={e => setFechaSemana(e.target.value)} />
            )}
            {tipoPeriodo === "dia" && (
              <input type="date" className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm"
                value={fechaDia} onChange={e => setFechaDia(e.target.value)} />
            )}
          </div>
        </header>

        {/* ══════════════════════════════════════════
            FILTROS — COMBOS
        ══════════════════════════════════════════ */}
        <div className="flex flex-wrap items-end gap-4 mb-5 p-4 bg-[#012E24] border border-[#046C5E]/40 rounded-xl">
          <SelectFiltro
            label="Tipo de documento"
            value={tipoDoc}
            onChange={setTipoDoc}
            options={TIPOS_DOCUMENTO}
            color="emerald"
          />
          <SelectFiltro
            label="Grupo de usuario"
            value={grupo}
            onChange={setGrupo}
            options={GRUPOS_USUARIO}
            color="purple"
          />
          {/* Período — info visual */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Período activo</p>
            <div className="flex items-center gap-2 bg-[#014434] border border-[#046C5E]/60 rounded-lg px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-emerald-300 whitespace-nowrap">{etiquetaPeriodo()}</span>
            </div>
          </div>
        </div>

        {/* ── Buscador ── */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="text-xs text-gray-400">
            {filasFiltradas.length} usuario{filasFiltradas.length !== 1 ? "s" : ""}
            {grupo !== "Todos los grupos" && <span className="ml-1 text-purple-400">· {grupo}</span>}
            {tipoDoc !== "Todo" && <span className="ml-1 text-emerald-400">· {tipoDoc}</span>}
          </p>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input type="text" placeholder="Buscar usuario o ruta…" value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-[#012E24] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 w-52 focus:outline-none focus:border-emerald-500/60" />
          </div>
        </div>

        {/* ── LOADING ── */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TABLA PRINCIPAL
        ══════════════════════════════════════════ */}
        {!cargando && (
          <div className="bg-[#012E24] border border-[#046C5E]/50 rounded-xl overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">

              {/* Nivel 1 — grupos de columnas */}
              <thead>
                <tr className="bg-[#013d2e] border-b border-[#046C5E]/40">
                  <th colSpan={2} className="px-3 py-2 border-r border-[#046C5E]/30" />
                  <th colSpan={5} className="px-3 py-2 text-center text-[10px] uppercase text-emerald-300 border-r border-[#046C5E]/30">
                    Identificación
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-emerald-300 border-r border-[#046C5E]/30">
                    Actividad
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-blue-300 border-r border-[#046C5E]/30">
                    Facturas
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-purple-300 border-r border-[#046C5E]/30">
                    Órdenes
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-amber-300 border-r border-[#046C5E]/30">
                    Transferencias
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-red-300 border-r border-[#046C5E]/30">
                    Devoluciones
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-[10px] uppercase text-green-300 border-r border-[#046C5E]/30">
                    Pagos
                  </th>
                  <th className="px-3 py-2 border-r border-[#046C5E]/30" />
                </tr>

                {/* Nivel 2 — columnas individuales */}
                <tr className="bg-[#014434] border-b border-[#046C5E]/50">
                  <Th>#</Th>
                  <Th center={false}>Usuario</Th>
                  <Th center={false}>Ruta</Th>
                  <Th center={false}>Sucursal</Th>
                  <Th center={false}>Grupo</Th>
                  <Th>Día inicio</Th>
                  <Th>Día fin</Th>
                  <Th>Ruta</Th>
                  <Th>Visitas</Th>
                  {/* Facturas */}
                  <Th>Monto</Th><Th>#</Th>
                  {/* Órdenes */}
                  <Th>Monto</Th><Th>#</Th>
                  {/* Transferencias */}
                  <Th>Monto</Th><Th>#</Th>
                  {/* Devoluciones */}
                  <Th>Monto</Th><Th>#</Th>
                  {/* Pagos */}
                  <Th>Monto</Th><Th>#</Th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wide text-emerald-300 text-center whitespace-nowrap">
                    Concreción
                  </th>
                </tr>
              </thead>

              {/* BODY */}
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-16 text-center text-gray-400 text-sm">
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((f, idx) => {
                    const tr = Number(f.total_ruta);
                    const vi = Number(f.visitas);
                    return (
                      <tr key={`${f.codigo_usuario}-${f.codigo_ruta}-${idx}`}
                        className={`border-b border-[#046C5E]/20 hover:bg-[#025940]/40 transition
                          ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>

                        <td className="px-3 py-2 text-center text-gray-400 border-r border-[#046C5E]/20">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold text-white min-w-[160px] border-r border-[#046C5E]/20">
                          {f.nombre_usuario || f.codigo_usuario}
                        </td>
                        <td className="px-3 py-2 text-blue-300 border-r border-[#046C5E]/20">{f.codigo_ruta || "—"}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs border-r border-[#046C5E]/20">{f.sucursal_usuario || "—"}</td>
                        <td className="px-3 py-2 border-r border-[#046C5E]/20">
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {f.grupo_usuario || "POR DEFECTO"}
                          </span>
                        </td>

                        {/* Día inicio */}
                        <td className="px-3 py-2 whitespace-nowrap border-r border-[#046C5E]/20">
                          {f.dia_inicio
                            ? <span className="text-emerald-400">{fmtVisita(f.dia_inicio)}</span>
                            : <span className="text-red-400">No</span>}
                        </td>

                        {/* Día fin */}
                        <td className="px-3 py-2 whitespace-nowrap border-r border-[#046C5E]/20">
                          {f.dia_fin && f.dia_fin !== f.dia_inicio
                            ? <span className="text-emerald-400">{fmtVisita(f.dia_fin)}</span>
                            : <span className="text-red-400">No</span>}
                        </td>

                        <td className="px-3 py-2 text-center font-bold text-white border-r border-[#046C5E]/20">{tr.toLocaleString("es-EC")}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-400 border-r border-[#046C5E]/20">{vi.toLocaleString("es-EC")}</td>

                        {/* Facturas */}
                        <td className="px-3 py-2 text-right text-blue-300 border-r border-[#046C5E]/20">{fmt2(Number(f.facturas_monto))}</td>
                        <td className="px-3 py-2 text-center text-blue-300 border-r border-[#046C5E]/20">{Number(f.facturas_count)}</td>
                        {/* Órdenes */}
                        <td className="px-3 py-2 text-right text-purple-300 border-r border-[#046C5E]/20">{fmt2(Number(f.ordenes_monto))}</td>
                        <td className="px-3 py-2 text-center text-purple-300 border-r border-[#046C5E]/20">{Number(f.ordenes_count)}</td>
                        {/* Transferencias */}
                        <td className="px-3 py-2 text-right text-amber-300 border-r border-[#046C5E]/20">{fmt2(Number(f.transferencias_monto))}</td>
                        <td className="px-3 py-2 text-center text-amber-300 border-r border-[#046C5E]/20">{Number(f.transferencias_count)}</td>
                        {/* Devoluciones */}
                        <td className="px-3 py-2 text-right text-red-300 border-r border-[#046C5E]/20">{fmt2(Number(f.devoluciones_monto))}</td>
                        <td className="px-3 py-2 text-center text-red-300 border-r border-[#046C5E]/20">{Number(f.devoluciones_count)}</td>
                        {/* Pagos */}
                        <td className="px-3 py-2 text-right text-green-300 border-r border-[#046C5E]/20">{fmt2(Number(f.pagos_monto))}</td>
                        <td className="px-3 py-2 text-center text-green-300 border-r border-[#046C5E]/20">{Number(f.pagos_count)}</td>

                        {/* Concreción */}
                        <td className="px-3 py-2 text-center font-semibold text-emerald-400 whitespace-nowrap">
                          {conc(vi, tr)} / 0% / {vi}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* TOTALES */}
              {filasFiltradas.length > 0 && (
                <tfoot>
                  <tr className="bg-[#014434] border-t-2 border-[#046C5E]/60 font-bold text-xs">
                    <td colSpan={7} className="px-3 py-3 text-emerald-300 uppercase tracking-wider border-r border-[#046C5E]/30">
                      Total ({filasFiltradas.length})
                    </td>
                    <td className="px-3 py-3 text-center text-white border-r border-[#046C5E]/30">{tot.total_ruta.toLocaleString("es-EC")}</td>
                    <td className="px-3 py-3 text-center text-emerald-400 border-r border-[#046C5E]/30">{tot.visitas.toLocaleString("es-EC")}</td>
                    <td className="px-3 py-3 text-right text-blue-300 border-r border-[#046C5E]/30">{fmt2(tot.facturas_monto)}</td>
                    <td className="px-3 py-3 text-center text-blue-300 border-r border-[#046C5E]/30">{tot.facturas_count}</td>
                    <td className="px-3 py-3 text-right text-purple-300 border-r border-[#046C5E]/30">{fmt2(tot.ordenes_monto)}</td>
                    <td className="px-3 py-3 text-center text-purple-300 border-r border-[#046C5E]/30">{tot.ordenes_count}</td>
                    <td className="px-3 py-3 text-right text-amber-300 border-r border-[#046C5E]/30">{fmt2(tot.transferencias_monto)}</td>
                    <td className="px-3 py-3 text-center text-amber-300 border-r border-[#046C5E]/30">{tot.transferencias_count}</td>
                    <td className="px-3 py-3 text-right text-red-300 border-r border-[#046C5E]/30">{fmt2(tot.devoluciones_monto)}</td>
                    <td className="px-3 py-3 text-center text-red-300 border-r border-[#046C5E]/30">{tot.devoluciones_count}</td>
                    <td className="px-3 py-3 text-right text-green-300 border-r border-[#046C5E]/30">{fmt2(tot.pagos_monto)}</td>
                    <td className="px-3 py-3 text-center text-green-300 border-r border-[#046C5E]/30">{tot.pagos_count}</td>
                    <td className="px-3 py-3 text-center text-emerald-400 whitespace-nowrap">
                      {conc(tot.visitas, tot.total_ruta)} / 0% / {tot.visitas}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
