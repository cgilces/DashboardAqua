import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Tag, Award, Users, User, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface PromoRow {
  promoCodigo: string;
  promoNombre: string;
  veces: number;
  prendedores?: number;
  unidades: number;
  monto: number;
  descuento: number;
}
interface PrendedorRow {
  prendedor: string;
  promosDistintas: number;
  ventasConPromo: number;
  unidades: number;
  monto: number;
  descuento: number;
}

const meses = {
  Enero: "01", Febrero: "02", Marzo: "03", Abril: "04",
  Mayo: "05", Junio: "06", Julio: "07", Agosto: "08",
  Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(n || 0);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("app_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Ordenamiento reutilizable ────────────────────────────────────────────────
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

function useSort(initial: SortState = null) {
  const [state, setState] = useState<SortState>(initial);
  const onSort = (col: string) =>
    setState((s) =>
      s && s.key === col ? { key: col, dir: s.dir === "desc" ? "asc" : "desc" } : { key: col, dir: "desc" }
    );
  return { state, onSort };
}

function sortRows<T>(rows: T[], state: SortState): T[] {
  if (!state) return rows;
  const { key, dir } = state;
  return [...rows].sort((a: any, b: any) => {
    const av = a[key];
    const bv = b[key];
    let r: number;
    if (typeof av === "number" && typeof bv === "number") r = av - bv;
    else r = String(av ?? "").localeCompare(String(bv ?? ""), "es", { numeric: true });
    return dir === "asc" ? r : -r;
  });
}

const SortTh: React.FC<{
  label: string;
  col: string;
  state: SortState;
  onSort: (col: string) => void;
  align?: "left" | "right";
  className?: string;
}> = ({ label, col, state, onSort, align = "right", className = "" }) => {
  const active = state?.key === col;
  return (
    <th
      onClick={() => onSort(col)}
      title="Ordenar"
      className={`py-2 cursor-pointer select-none hover:text-white transition-colors ${align === "left" ? "text-left" : "text-right"} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {active ? (
          state!.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
        {label}
      </span>
    </th>
  );
};

const DashboardPromos: React.FC = () => {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, "0");
  const anioActual = String(hoy.getFullYear());

  const [mes, setMes] = useState(localStorage.getItem("mesPromos") ?? mesActual);
  const [anio, setAnio] = useState(localStorage.getItem("anioPromos") ?? anioActual);

  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [prendedores, setPrendedores] = useState<PrendedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vista por vendedor
  const [vendedorSel, setVendedorSel] = useState<string>("");
  const [vendPromos, setVendPromos] = useState<PromoRow[]>([]);
  const [vendLoading, setVendLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("mesPromos", mes);
    localStorage.setItem("anioPromos", anio);
  }, [mes, anio]);

  // Carga general (ranking + prendedores)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/promos/dashboard?anio=${anio}&mes=${mes}`,
          { headers: authHeaders() }
        );
        if (!res.ok) throw new Error("Error al obtener promociones");
        const data = await res.json();
        setPromos(data?.promos ?? []);
        setPrendedores(data?.prendedores ?? []);
      } catch (err: any) {
        setError(err.message || "Error desconocido");
        setPromos([]);
        setPrendedores([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mes, anio]);

  // Carga del vendedor seleccionado
  useEffect(() => {
    if (!vendedorSel) {
      setVendPromos([]);
      return;
    }
    const fetchVend = async () => {
      setVendLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/promos/prendedor/${encodeURIComponent(vendedorSel)}?anio=${anio}&mes=${mes}`,
          { headers: authHeaders() }
        );
        if (!res.ok) throw new Error("Error");
        setVendPromos(await res.json());
      } catch {
        setVendPromos([]);
      } finally {
        setVendLoading(false);
      }
    };
    fetchVend();
  }, [vendedorSel, mes, anio]);

  const top = promos[0];
  const maxUnidades = promos.reduce((m, p) => Math.max(m, p.unidades), 0) || 1;

  // Totales del vendedor (de la fila ya calculada en el ranking de prendedores)
  const vendInfo = useMemo(
    () => prendedores.find((p) => p.prendedor === vendedorSel) || null,
    [prendedores, vendedorSel]
  );
  const vendMaxUnidades = vendPromos.reduce((m, p) => Math.max(m, p.unidades), 0) || 1;

  // Orden de la tabla de vendedores
  const { state: predSort, onSort: onPredSort } = useSort();
  const prendedoresSorted = useMemo(() => sortRows(prendedores, predSort), [prendedores, predSort]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-xl bg-[#046C5E]">
              <Tag size={28} />
            </span>
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-wide">DASHBOARD PROMOCIONES</h1>
              <p className="text-sm text-gray-300">Promos vendidas — general y por vendedor</p>
            </div>
          </div>

          <div className="flex justify-center w-full md:w-auto">
            <BotonActualizarSincronizacion />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Selector de vendedor */}
            <div className="relative flex-1 min-w-[160px]">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-9 pr-4 py-2 rounded-lg w-full appearance-none"
                value={vendedorSel}
                onChange={(e) => setVendedorSel(e.target.value)}
              >
                <option value="">Todos los vendedores</option>
                {prendedores.map((p) => (
                  <option key={p.prendedor} value={p.prendedor}>{p.prendedor}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[120px]">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-9 pr-4 py-2 rounded-lg w-full appearance-none"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              >
                {Object.entries(meses).map(([nombre, valor]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-[110px]">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-9 pr-4 py-2 rounded-lg w-full appearance-none"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              >
                {Array.from({ length: 5 }, (_, i) => 2026 - i).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {loading && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando promociones…</p>
          </div>
        )}
        {error && <p className="text-red-400 text-center">Error: {error}</p>}

        {!loading && !error && promos.length === 0 && (
          <div className="text-center py-24 text-gray-400">
            <Tag size={40} className="mx-auto mb-3 opacity-50" />
            <p>No se registraron ventas con promoción en este período.</p>
            <p className="text-xs mt-2 opacity-70">
              Si recién se activó el seguimiento de promos, vuelve a sincronizar el período.
            </p>
          </div>
        )}

        {/* ══════════ VISTA POR VENDEDOR ══════════ */}
        {!loading && !error && vendedorSel && (
          <section>
            <button
              onClick={() => setVendedorSel("")}
              className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 mb-4"
            >
              <ArrowLeft size={16} /> Ver todos los vendedores
            </button>

            <div className="rounded-2xl bg-gradient-to-r from-[#046C5E] to-[#02463c] p-5 mb-6 flex items-center gap-4">
              <span className="grid place-items-center h-12 w-12 rounded-full bg-white/10">
                <User size={24} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-200">Vendedor</p>
                <p className="text-2xl font-bold">{vendedorSel}</p>
              </div>
            </div>

            {/* KPIs del vendedor */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Kpi label="Promos distintas" valor={fmt(vendInfo?.promosDistintas ?? vendPromos.length)} />
              <Kpi label="Unidades" valor={fmt(vendInfo?.unidades ?? vendPromos.reduce((s, p) => s + p.unidades, 0))} />
              <Kpi label="Vendido $" valor={`$${fmtMoney(vendInfo?.monto ?? vendPromos.reduce((s, p) => s + p.monto, 0))}`} acento="emerald" />
              <Kpi label="Descuento $" valor={`$${fmtMoney(vendInfo?.descuento ?? vendPromos.reduce((s, p) => s + p.descuento, 0))}`} acento="amber" />
            </div>

            <div className="rounded-2xl bg-[#0b3b34]/60 border border-[#046C5E] overflow-hidden">
              <h2 className="px-5 py-3 font-semibold flex items-center gap-2 border-b border-[#046C5E]">
                <Tag size={18} /> Promos vendidas por {vendedorSel}
              </h2>
              {vendLoading ? (
                <div className="py-16 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-400" />
                </div>
              ) : vendPromos.length === 0 ? (
                <p className="text-center text-gray-400 py-12">Sin promos en el período.</p>
              ) : (
                <TablaPromos rows={vendPromos} maxUnidades={vendMaxUnidades} />
              )}
            </div>
          </section>
        )}

        {/* ══════════ VISTA GENERAL ══════════ */}
        {!loading && !error && !vendedorSel && promos.length > 0 && (
          <>
            {top && (
              <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#046C5E] to-[#02463c] p-5 md:p-6 flex items-center gap-4 shadow-lg">
                <Award size={40} className="text-yellow-300 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-emerald-200">Promoción más vendida</p>
                  <p className="text-lg md:text-2xl font-bold truncate">{top.promoNombre}</p>
                  <p className="text-sm text-emerald-100">
                    {fmt(top.unidades)} uds · {fmt(top.veces)} ventas · ${fmtMoney(top.monto)} vendido · {fmt(top.prendedores || 0)} vendedores
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Ranking general de promos */}
              <section className="rounded-2xl bg-[#0b3b34]/60 border border-[#046C5E] overflow-hidden">
                <h2 className="px-5 py-3 font-semibold flex items-center gap-2 border-b border-[#046C5E]">
                  <Tag size={18} /> Ranking general de promociones
                </h2>
                <div className="overflow-y-auto max-h-[28rem]">
                  <TablaPromos rows={promos} maxUnidades={maxUnidades} />
                </div>
              </section>

              {/* Ranking de prendedores */}
              <section className="rounded-2xl bg-[#0b3b34]/60 border border-[#046C5E] overflow-hidden">
                <h2 className="px-5 py-3 font-semibold flex items-center gap-2 border-b border-[#046C5E]">
                  <Users size={18} /> Vendedores (clic para ver su detalle)
                </h2>
                <div className="overflow-y-auto max-h-[28rem]">
                  <table className="w-full text-sm">
                    <thead className="text-emerald-200 text-xs uppercase sticky top-0 bg-[#0b3b34]">
                      <tr>
                        <SortTh label="Vendedor" col="prendedor" state={predSort} onSort={onPredSort} align="left" className="px-4" />
                        <SortTh label="Promos" col="promosDistintas" state={predSort} onSort={onPredSort} className="px-3" />
                        <SortTh label="Unidades" col="unidades" state={predSort} onSort={onPredSort} className="px-3" />
                        <SortTh label="Vendido $" col="monto" state={predSort} onSort={onPredSort} className="px-3 whitespace-nowrap" />
                        <SortTh label="Descuento $" col="descuento" state={predSort} onSort={onPredSort} className="px-4 whitespace-nowrap" />
                      </tr>
                    </thead>
                    <tbody>
                      {prendedoresSorted.map((p) => (
                        <tr
                          key={p.prendedor}
                          onClick={() => setVendedorSel(p.prendedor)}
                          className="border-t border-white/5 hover:bg-emerald-400/10 cursor-pointer"
                        >
                          <td className="px-4 py-2 font-medium">{p.prendedor}</td>
                          <td className="px-3 py-2 text-right">{fmt(p.promosDistintas)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(p.unidades)}</td>
                          <td className="px-3 py-2 text-right text-emerald-300 whitespace-nowrap">${fmtMoney(p.monto)}</td>
                          <td className="px-4 py-2 text-right text-amber-300 whitespace-nowrap">${fmtMoney(p.descuento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

// ── Subcomponentes ───────────────────────────────────────────────────────────
const Kpi: React.FC<{ label: string; valor: string; acento?: "emerald" | "amber" }> = ({ label, valor, acento }) => (
  <div className="rounded-xl bg-[#0b3b34]/60 border border-[#046C5E] px-4 py-3">
    <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
    <p className={`text-xl font-bold ${acento === "emerald" ? "text-emerald-300" : acento === "amber" ? "text-amber-300" : "text-white"}`}>
      {valor}
    </p>
  </div>
);

const TablaPromos: React.FC<{ rows: PromoRow[]; maxUnidades: number }> = ({ rows, maxUnidades }) => {
  const { state, onSort } = useSort();
  const sorted = useMemo(() => sortRows(rows, state), [rows, state]);
  return (
  <table className="w-full text-sm table-fixed">
    <thead className="text-emerald-200 text-xs uppercase sticky top-0 bg-[#0b3b34]">
      <tr>
        <SortTh label="Promo" col="promoNombre" state={state} onSort={onSort} align="left" className="px-4 w-auto" />
        <SortTh label="Unidades" col="unidades" state={state} onSort={onSort} className="px-3 w-20" />
        <SortTh label="Ventas" col="veces" state={state} onSort={onSort} className="px-3 w-16" />
        <SortTh label="Vendido $" col="monto" state={state} onSort={onSort} className="px-3 w-28 whitespace-nowrap" />
        <SortTh label="Descuento $" col="descuento" state={state} onSort={onSort} className="px-4 w-28 whitespace-nowrap" />
      </tr>
    </thead>
    <tbody>
      {sorted.map((p, i) => (
        <tr key={p.promoCodigo} className="border-t border-white/5 hover:bg-white/5">
          <td className="px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-300/70 w-5 text-right shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.promoNombre}</p>
                <div className="h-1.5 mt-1 rounded bg-white/10 overflow-hidden w-full max-w-xs">
                  <div className="h-full bg-emerald-400" style={{ width: `${(p.unidades / maxUnidades) * 100}%` }} />
                </div>
              </div>
            </div>
          </td>
          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmt(p.unidades)}</td>
          <td className="px-3 py-2 text-right text-gray-300 whitespace-nowrap">{fmt(p.veces)}</td>
          <td className="px-3 py-2 text-right text-emerald-300 whitespace-nowrap">${fmtMoney(p.monto)}</td>
          <td className="px-4 py-2 text-right text-amber-300 whitespace-nowrap">${fmtMoney(p.descuento)}</td>
        </tr>
      ))}
    </tbody>
  </table>
  );
};

export default DashboardPromos;
