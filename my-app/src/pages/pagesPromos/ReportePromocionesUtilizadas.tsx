import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { RotateCcw, Check, Tag } from "lucide-react";
import { API_BASE_URL } from "../../config";
import logo from "../../assets/logo.png";

// ════════════════════════════════════════════════════════════════════════════
// REPORTE DE PROMOCIONES UTILIZADAS — réplica del dashboard86 de MobilVendor.
// Detalle línea por línea con filtros de rango de fechas (con hora), promoción
// y 2 pestañas (Factura_Orden / Devolucion_SolicitudDev). Gráfico de torta a la
// derecha (FACTURA azul / ORDEN rosado) con el conteo de registros al centro.
// ════════════════════════════════════════════════════════════════════════════

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ReporteRow {
  tipo: string;        // FACTURA | ORDEN
  vendedor: string;
  codigoDoc: string;
  fecha: string;       // ISO
  articulo: string;
  descripcion: string;
  unidad: string;
  factor: number;
  cantidad: number;
  descPct: number;
  promocion: string;   // CODIGO/CODIGO
}
interface ReporteResp {
  rows: ReporteRow[];
  totalCantidad: number;
  conteo: { factura: number; orden: number; total: number };
  soportado: boolean;
}
interface PromoOpt {
  codigo: string;
  nombre: string;
}
type Tab = "factura_orden" | "devolucion";
interface Filtros {
  inicio: string; // yyyy-MM-ddTHH:mm (datetime-local)
  fin: string;
  promo: string;  // "" = (Todos)
  tab: Tab;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

// yyyy-MM-ddTHH:mm para <input type="datetime-local">
const toInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Defaults: desde el inicio del mes actual (00:00) hasta ahora.
const defaultFiltros = (): Filtros => {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  return { inicio: toInput(inicioMes), fin: toInput(now), promo: "", tab: "factura_orden" };
};

// FECHA de la tabla en formato m/d/a (como dashboard86)
const fmtFechaMDA = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

// Fecha de emisión dinámica: dd/MM/yyyy HH:mm
const fechaEmision = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// Normaliza para comparar (mayúsculas, sin acentos) — usado por los filtros.
const norm = (s: unknown) =>
  (s ?? "").toString().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Coincidencia por LÍMITE DE PALABRA: el texto buscado debe estar delimitado por
// inicio/fin o por un carácter no alfanumérico. Así "V6" matchea "V6" pero NO
// "PV6", y a la vez "GALON" sigue matcheando "PACK x6 GALON" y "FA001-081" matchea
// "FA001-081-000004732". Vacío = no filtra.
const coincide = (valor: unknown, filtro: string): boolean => {
  const f = norm(filtro);
  if (!f) return true;
  const v = norm(valor);
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${esc}([^A-Z0-9]|$)`).test(v);
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("app_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Componente ─────────────────────────────────────────────────────────────────
const ReportePromocionesUtilizadas: React.FC = () => {
  // Borrador (lo que el usuario edita) vs aplicado (lo que dispara el fetch).
  const [draft, setDraft] = useState<Filtros>(defaultFiltros);
  const [filtros, setFiltros] = useState<Filtros>(draft);

  const [data, setData] = useState<ReporteResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [promos, setPromos] = useState<PromoOpt[]>([]);

  // Filtros de la tabla (cliente, instantáneos): vendedor / descripción / tipo.
  // Combobox: se puede ESCRIBIR o elegir de la lista.
  const [fVendedor, setFVendedor]       = useState("");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fTipo, setFTipo]               = useState("");
  const [fCodigoDoc, setFCodigoDoc]     = useState("");

  // Catálogo de promos para el dropdown (una sola vez)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/promos/lista`, { headers: authHeaders() });
        if (res.ok) setPromos(await res.json());
      } catch {
        /* dropdown queda solo con (Todos) */
      }
    })();
  }, []);

  // Datos del reporte — se recargan cuando cambian los filtros aplicados
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSeleccion(null);
      try {
        const qs = new URLSearchParams({
          inicio: filtros.inicio,
          fin: filtros.fin,
          tab: filtros.tab,
        });
        if (filtros.promo) qs.set("promo", filtros.promo);
        const res = await fetch(`${API_BASE_URL}/api/promos/reporte?${qs.toString()}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Error al obtener el reporte");
        setData(await res.json());
      } catch (err: any) {
        setError(err.message || "Error desconocido");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filtros]);

  const aceptar = () => setFiltros({ ...draft });
  const restablecer = () => {
    const d = { ...defaultFiltros(), tab: draft.tab };
    setDraft(d);
    setFiltros(d);
    setFVendedor("");
    setFDescripcion("");
    setFTipo("");
    setFCodigoDoc("");
  };
  const cambiarTab = (tab: Tab) => {
    setDraft((d) => ({ ...d, tab }));
    setFiltros((f) => ({ ...f, tab }));
  };

  const rows = data?.rows ?? [];

  // Opciones de cada combobox = valores únicos de los datos cargados.
  const opcionesVendedor = useMemo(
    () => [...new Set(rows.map((r) => r.vendedor).filter(Boolean))].sort(), [rows]);
  const opcionesDescripcion = useMemo(
    () => [...new Set(rows.map((r) => r.descripcion).filter(Boolean))].sort(), [rows]);
  const opcionesTipo = useMemo(
    () => [...new Set(rows.map((r) => r.tipo).filter(Boolean))].sort(), [rows]);
  const opcionesCodigoDoc = useMemo(
    () => [...new Set(rows.map((r) => r.codigoDoc).filter(Boolean))].sort(), [rows]);

  // Filtrado en cliente (instantáneo): vendedor/descripción/tipo/código documento.
  const filteredRows = useMemo(
    () => rows.filter((r) =>
      coincide(r.vendedor, fVendedor) &&
      coincide(r.descripcion, fDescripcion) &&
      coincide(r.tipo, fTipo) &&
      coincide(r.codigoDoc, fCodigoDoc)
    ),
    [rows, fVendedor, fDescripcion, fTipo, fCodigoDoc]
  );

  // El total del pie y el conteo del gráfico reflejan lo FILTRADO.
  const conteo = useMemo(() => ({
    factura: filteredRows.filter((r) => norm(r.tipo) === "FACTURA").length,
    orden:   filteredRows.filter((r) => norm(r.tipo) === "ORDEN").length,
    total:   filteredRows.length,
  }), [filteredRows]);
  const totalCantidadFiltrado = useMemo(
    () => filteredRows.reduce((a, r) => a + (Number(r.cantidad) || 0), 0),
    [filteredRows]
  );

  // Al cambiar un filtro cambian los índices → limpiar la fila seleccionada.
  useEffect(() => { setSeleccion(null); }, [fVendedor, fDescripcion, fTipo, fCodigoDoc]);

  const pieOption = useMemo(
    () => ({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: {
        bottom: 0,
        textStyle: { color: "#cbd5e1" },
        data: ["FACTURA", "ORDEN"],
      },
      title: {
        text: String(conteo.total),
        subtext: "registros",
        left: "center",
        top: "38%",
        textStyle: { color: "#ffffff", fontSize: 30, fontWeight: "bold" },
        subtextStyle: { color: "#94a3b8", fontSize: 12 },
      },
      series: [
        {
          name: "PROMOCIONES EN",
          type: "pie",
          radius: ["55%", "78%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: [
            { value: conteo.factura, name: "FACTURA", itemStyle: { color: "#3b82f6" } },
            { value: conteo.orden, name: "ORDEN", itemStyle: { color: "#ec4899" } },
          ],
        },
      ],
    }),
    [conteo]
  );

  return (
    <div className="rounded-2xl bg-[#0b3b34]/60 border border-[#046C5E] overflow-hidden">
      {/* ── Cabecera del reporte: logo + título centrado + emisión ── */}
      <div className="relative flex items-center justify-center px-5 py-4 border-b border-[#046C5E] bg-[#02463c]">
        <img src={logo} alt="Aqua" className="absolute left-5 h-10 w-auto" />
        <h2 className="text-lg md:text-2xl font-bold tracking-wide text-center">
          REPORTE DE PROMOCIONES UTILIZADAS
        </h2>
        <span className="absolute right-5 text-xs text-emerald-200/80">
          Emitido: {fechaEmision()}
        </span>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-[#046C5E]">
        <label className="flex flex-col text-xs text-emerald-200">
          Fecha Inicio
          <input
            type="datetime-local"
            step={1}
            value={draft.inicio}
            onChange={(e) => setDraft((d) => ({ ...d, inicio: e.target.value }))}
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg"
          />
        </label>
        <label className="flex flex-col text-xs text-emerald-200">
          Fecha Fin
          <input
            type="datetime-local"
            step={1}
            value={draft.fin}
            onChange={(e) => setDraft((d) => ({ ...d, fin: e.target.value }))}
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg"
          />
        </label>

        <button
          onClick={restablecer}
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm"
        >
          <RotateCcw size={15} /> Restablecer
        </button>
        <button
          onClick={aceptar}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#022] font-semibold px-4 py-2 rounded-lg text-sm"
        >
          <Check size={15} /> Aceptar
        </button>

        <label className="flex flex-col text-xs text-emerald-200 ml-auto min-w-[200px]">
          PROMOCIÓN
          <select
            value={draft.promo}
            onChange={(e) => setDraft((d) => ({ ...d, promo: e.target.value }))}
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg appearance-none"
          >
            <option value="">(Todos)</option>
            {promos.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Filtros de tabla (combobox: se puede ESCRIBIR o elegir) ── */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-[#046C5E] bg-[#0b3b34]/30">
        <span className="text-xs text-emerald-200/70 self-center font-medium">Filtrar tabla:</span>

        <label className="flex flex-col text-xs text-emerald-200 min-w-[180px]">
          VENDEDOR
          <input
            list="dl-vendedor"
            value={fVendedor}
            onChange={(e) => setFVendedor(e.target.value)}
            placeholder="Escribe o elige…"
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg placeholder-emerald-200/40"
          />
          <datalist id="dl-vendedor">
            {opcionesVendedor.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>

        <label className="flex flex-col text-xs text-emerald-200 min-w-[220px]">
          DESCRIPCIÓN
          <input
            list="dl-descripcion"
            value={fDescripcion}
            onChange={(e) => setFDescripcion(e.target.value)}
            placeholder="Escribe o elige…"
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg placeholder-emerald-200/40"
          />
          <datalist id="dl-descripcion">
            {opcionesDescripcion.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>

        <label className="flex flex-col text-xs text-emerald-200 min-w-[150px]">
          TIPO
          <input
            list="dl-tipo"
            value={fTipo}
            onChange={(e) => setFTipo(e.target.value)}
            placeholder="Escribe o elige…"
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg placeholder-emerald-200/40"
          />
          <datalist id="dl-tipo">
            {opcionesTipo.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>

        <label className="flex flex-col text-xs text-emerald-200 min-w-[200px]">
          CÓDIGO DOC.
          <input
            list="dl-codigodoc"
            value={fCodigoDoc}
            onChange={(e) => setFCodigoDoc(e.target.value)}
            placeholder="Escribe o elige…"
            className="mt-1 bg-[#046C5E] text-white px-3 py-2 rounded-lg placeholder-emerald-200/40"
          />
          <datalist id="dl-codigodoc">
            {opcionesCodigoDoc.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>

        {(fVendedor || fDescripcion || fTipo || fCodigoDoc) && (
          <button
            onClick={() => { setFVendedor(""); setFDescripcion(""); setFTipo(""); setFCodigoDoc(""); }}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs"
          >
            <RotateCcw size={13} /> Limpiar filtros
          </button>
        )}

        <span className="text-xs text-emerald-200/60 self-center ml-auto">
          {filteredRows.length} de {rows.length} líneas
        </span>
      </div>

      {/* ── Pestañas ── */}
      <div className="flex gap-1 px-5 pt-3 bg-[#0b3b34]/40">
        {([
          ["factura_orden", "Factura_Orden"],
          ["devolucion", "Devolucion_SolicitudDev"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => cambiarTab(key)}
            className={`px-4 py-2 text-sm rounded-t-lg font-medium transition-colors ${
              filtros.tab === key
                ? "bg-[#1e3a8a] text-white"
                : "bg-[#0b3b34] text-emerald-200/70 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo: tabla + gráfico ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 p-4">
        {/* Tabla */}
        <div className="rounded-lg border border-[#046C5E] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
            </div>
          ) : error ? (
            <p className="text-red-400 text-center py-16">Error: {error}</p>
          ) : data && !data.soportado ? (
            <div className="text-center py-20 text-gray-400 px-6">
              <Tag size={36} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">Devoluciones / Solicitudes de devolución</p>
              <p className="text-xs mt-2 opacity-70">
                Esta pestaña aún no tiene datos: el sincronizador de MobilVendor solo trae
                facturas y órdenes (type 1 y 2). Para poblarla hay que sincronizar los
                documentos de devolución (pendiente fase 2).
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="text-center text-gray-400 py-20">
              {rows.length === 0
                ? "No se registraron promociones en este rango."
                : "Ningún registro coincide con los filtros."}
            </p>
          ) : (
            <div className="overflow-auto max-h-[34rem]">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-[#1e3a8a] text-white">
                  <tr>
                    {[
                      "TIPO", "VENDEDOR", "CODIGO DOC.", "FECHA", "ARTICULO",
                      "DESCRIPCION", "UNIDAD", "FACTOR", "CANTIDAD (U)", "DESC. %", "PROMOCION",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2 font-semibold ${
                          ["FACTOR", "CANTIDAD (U)", "DESC. %"].includes(h)
                            ? "text-right"
                            : "text-left"
                        } ${i === 5 ? "min-w-[220px]" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, idx) => {
                    const sel = seleccion === idx;
                    return (
                      <tr
                        key={`${r.codigoDoc}-${idx}`}
                        onClick={() => setSeleccion(idx)}
                        className={`cursor-pointer border-t border-white/5 ${
                          sel ? "bg-[#1e3a8a] text-white" : "hover:bg-white/5"
                        }`}
                      >
                        <td className="px-3 py-1.5">{r.tipo}</td>
                        <td className="px-3 py-1.5">{r.vendedor}</td>
                        <td className="px-3 py-1.5">{r.codigoDoc}</td>
                        <td className="px-3 py-1.5">{fmtFechaMDA(r.fecha)}</td>
                        <td className="px-3 py-1.5">{r.articulo}</td>
                        <td className="px-3 py-1.5 whitespace-normal">{r.descripcion}</td>
                        <td className="px-3 py-1.5">{r.unidad}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNum(r.factor)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(r.cantidad)}</td>
                        <td className="px-3 py-1.5 text-right">{fmtNum(r.descPct)}</td>
                        <td className="px-3 py-1.5">{r.promocion}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-[#02463c] text-white font-semibold">
                  <tr className="border-t-2 border-emerald-400/50">
                    <td className="px-3 py-2" colSpan={8}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">{fmtNum(totalCantidadFiltrado)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Gráfico de torta */}
        <div className="rounded-lg border border-[#046C5E] p-3 flex flex-col">
          <p className="text-xs uppercase tracking-wide text-emerald-200 mb-1">PROMOCIONES EN:</p>
          {data && data.soportado ? (
            <ReactECharts
              key={`pie-${conteo.total}-${conteo.factura}-${conteo.orden}`}
              option={pieOption}
              style={{ height: "320px", width: "100%" }}
              notMerge
            />
          ) : (
            <div className="flex-1 grid place-items-center text-gray-500 text-sm">Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportePromocionesUtilizadas;
