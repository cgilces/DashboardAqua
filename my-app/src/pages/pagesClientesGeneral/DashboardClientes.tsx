import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from '../../config';

type ClienteRow = {
  codigo: string; nombre: string; cedula: string; direccion: string; vendedor: string;
  unidades: number; dolares: number; facturas: number;
  tipo_negocio?: string; tipo_pago?: string; tiene_credito: boolean;
  ultima_compra?: string; dias_sin_comprar?: number; estado_cliente?: string;
};
type ApiResponse = {
  ok: boolean;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  kpis: any;
  data: any[];
};
type SortKey = keyof ClienteRow | "";
type SortDir = "asc" | "desc";

const PAGE_SIZE     = 100;   // filas visibles por página
const FETCH_LIMIT   = 10000; // traer todo de una vez

const money = (n?: number) =>
  Number(n || 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });

const ESTADO_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  ACTIVO:   { dot: "bg-green-500",  badge: "text-green-400 bg-green-500/15 border-green-500/30",  label: "Activo"   },
  RIESGO:   { dot: "bg-yellow-400", badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30", label: "Riesgo"   },
  INACTIVO: { dot: "bg-red-500",    badge: "text-red-400 bg-red-500/15 border-red-500/30",         label: "Inactivo" },
};
const estadoIcon = (e?: string) => {
  const cfg = ESTADO_CFG[e || ""] ?? { dot: "bg-gray-400", badge: "text-gray-400 bg-gray-500/15 border-gray-500/30", label: "—" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const Arrow = ({ col, sk, sd }: { col: SortKey; sk: SortKey; sd: SortDir }) => (
  <span className="ml-1 opacity-50 text-[10px]">{sk === col ? (sd === "asc" ? "↑" : "↓") : "↕"}</span>
);

export default function DashboardClientesTabla() {
  const navigate = useNavigate();

  const [inputQuery,     setInputQuery]     = useState("");
  const [clientes,       setClientes]       = useState<ClienteRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching,     setIsFetching]     = useState(false);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // página VISUAL (sobre filteredData, no sobre el fetch)
  const [page,     setPage]     = useState(1);
  const [sortKey,  setSortKey]  = useState<SortKey>("");
  const [sortDir,  setSortDir]  = useState<SortDir>("asc");

  // ── Fetch único — trae todos los clientes ────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();

    const cargar = async () => {
      clientes.length > 0 ? setIsFetching(true) : setInitialLoading(true);

      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/resumen?page=1&limit=${FETCH_LIMIT}`;
        const res  = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: ApiResponse = await res.json();
        if (!json.ok) { setClientes([]); return; }

        const rows: ClienteRow[] = (json.data || []).map((r: any) => ({
          codigo:          r.codigo_cliente,
          nombre:          r.nombre_cliente,
          cedula:          r.identificacion_cliente,
          direccion:       r.direccion ?? "-",
          vendedor:        r.seller_code ?? "-",
          unidades:        Number(r.total_unidades || 0),
          dolares:         Number(r.total_ventas   || 0),
          facturas:        Number(r.total_facturas || 0),
          tipo_negocio:    r.tipo_negocio ?? "SIN CLASIFICAR",
          tipo_pago:       r.tipo_pago ?? (r.tiene_credito_cliente ? "CREDITO" : "CONTADO"),
          tiene_credito:   Boolean(r.tiene_credito_cliente),
          ultima_compra:   r.ultima_compra,
          dias_sin_comprar: r.dias_sin_comprar,
          estado_cliente:  r.estado_cliente,
        }));

        setClientes(rows);
        setTotalRegistros(json.pagination?.total || rows.length);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error cargando clientes", err);
        setClientes([]); setTotalRegistros(0);
      } finally {
        setInitialLoading(false);
        setIsFetching(false);
      }
    };

    cargar();
    return () => ctrl.abort();
  }, []);

  // ── Sort ─────────────────────────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => sortKey === key && prev === "asc" ? "desc" : "asc");
    setSortKey(key);
    setPage(1); // volver a pág 1 al cambiar orden
  }, [sortKey]);

  // ── Buscar + ordenar sobre TODOS los datos ────────────────────────
  const filteredSorted = useMemo(() => {
    const q = inputQuery.trim().toLowerCase();

    let data = q
      ? clientes.filter(r =>
          r.nombre?.toLowerCase().includes(q) ||
          r.cedula?.toLowerCase().includes(q)  ||
          r.vendedor?.toLowerCase().includes(q)
        )
      : [...clientes];

    if (sortKey) {
      data.sort((a, b) => {
        const av = a[sortKey as keyof ClienteRow];
        const bv = b[sortKey as keyof ClienteRow];
        if (sortKey === "ultima_compra") {
          const da = av ? new Date(av as string).getTime() : 0;
          const db = bv ? new Date(bv as string).getTime() : 0;
          return sortDir === "asc" ? da - db : db - da;
        }
        if (typeof av === "number"  && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        if (typeof av === "boolean" && typeof bv === "boolean")
          return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
        return sortDir === "asc"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""));
      });
    }
    return data;
  }, [clientes, inputQuery, sortKey, sortDir]);

  // ── Reset página al buscar ────────────────────────────────────────
  useEffect(() => { setPage(1); }, [inputQuery]);

  // ── Página visual sobre filteredSorted ───────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const pageData    = filteredSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── KPIs sobre TODO lo filtrado ───────────────────────────────────
  const totalUnidades   = filteredSorted.reduce((a, r) => a + r.unidades, 0);
  const totalDolares    = filteredSorted.reduce((a, r) => a + r.dolares,  0);
  const totalFacturas   = filteredSorted.reduce((a, r) => a + r.facturas, 0);
  const ticketPromedio  = totalFacturas > 0 ? totalDolares / totalFacturas : 0;
  const clientesCredito = filteredSorted.filter(c => c.tiene_credito).length;

  // ── Th helper ─────────────────────────────────────────────────────
  const Th = ({ label, col, align = "left" }: { label: string; col: SortKey; align?: "left"|"right"|"center" }) => (
    <th onClick={() => handleSort(col)}
      className={`px-4 py-3 text-${align} cursor-pointer hover:text-white whitespace-nowrap select-none transition-colors`}>
      {label}<Arrow col={col} sk={sortKey} sd={sortDir}/>
    </th>
  );

  // ── Paginación helper ─────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: (number | "...")[] = [];
    const left  = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    range.push(1);
    if (left > 2)           range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1)     range.push(totalPages);
    return range;
  }, [page, totalPages]);

  // ── Carga inicial ─────────────────────────────────────────────────
  if (initialLoading)
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
          <p className="text-gray-400 text-sm">Cargando datos…</p>
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header/>
        <h1 className="text-xl md:text-3xl font-bold tracking-wide mb-6">DASHBOARD CLIENTES</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { label: "Clientes",         value: filteredSorted.length,  color: "text-white"      },
            { label: "Ventas",           value: money(totalDolares),    color: "text-blue-400"   },
            { label: "Ticket Promedio",  value: money(ticketPromedio),  color: "text-green-400"  },
            { label: "Clientes Crédito", value: clientesCredito,        color: "text-yellow-400" },
          ].map(k => (
            <div key={k.label} className="bg-[#013d32] border border-[#046C5E] p-4 rounded-lg">
              <p className="text-xs md:text-sm text-gray-400">{k.label}</p>
              <h2 className={`text-xl md:text-2xl font-bold ${k.color}`}>{k.value}</h2>
            </div>
          ))}
        </div>

        {/* BUSCADOR */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative w-full md:w-96">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder="Buscar por nombre, cédula o vendedor..."
              className="w-full rounded-lg bg-[#013d32] border border-[#046C5E] pl-9 pr-8 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 transition-all"
            />
            {inputQuery && (
              <button onClick={() => setInputQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition text-base leading-none">
                ✕
              </button>
            )}
          </div>

          {isFetching && (
            <span className="w-4 h-4 border-2 border-green-400/20 border-t-green-400 rounded-full animate-spin flex-shrink-0"/>
          )}

          {/* contador de resultados */}
          <span className="text-sm text-white/40">
            {filteredSorted.length === clientes.length
              ? `${clientes.length.toLocaleString("es-EC")} clientes`
              : `${filteredSorted.length.toLocaleString("es-EC")} de ${clientes.length.toLocaleString("es-EC")} clientes`
            }
          </span>
        </div>

        {/* ── MOBILE CARDS ──────────────────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {pageData.length === 0 ? (
            <div className="text-center text-white/30 italic py-10">No se encontraron clientes</div>
          ) : pageData.map((row, idx) => {
            const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
            return (
              <div key={`card-${row.codigo}-${idx}`}
                onClick={() => navigate(`/dashboard/cliente/${row.codigo}`)}
                className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all shadow-lg">
                {/* Header: nombre + estado */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-white/40 font-mono"># {globalIdx} · {row.codigo}</span>
                    <p className="text-sm font-bold text-white leading-tight truncate">{row.nombre}</p>
                    <p className="text-xs text-white/50 mt-0.5">{row.cedula || "-"}</p>
                  </div>
                  <span className="text-xl flex-shrink-0 mt-0.5">{estadoIcon(row.estado_cliente)}</span>
                </div>

                {/* Grid de métricas */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Unidades</p>
                    <p className="text-sm font-bold text-green-400">{row.unidades.toLocaleString("es-EC")}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Ventas</p>
                    <p className="text-sm font-bold text-blue-400">{money(row.dolares)}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Facturas</p>
                    <p className="text-sm font-bold text-white">{row.facturas}</p>
                  </div>
                </div>

                {/* Info secundaria */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/40">Vendedor: </span>
                    <span className="text-white/80">{row.vendedor || "-"}</span>
                  </div>
                  <div>
                    <span className="text-white/40">Tipo: </span>
                    <span className="text-white/80">{row.tipo_negocio || "-"}</span>
                  </div>
                  <div>
                    <span className="text-white/40">Pago: </span>
                    <span className="font-semibold text-yellow-300/80">{row.tipo_pago || (row.tiene_credito ? "CREDITO" : "CONTADO")}</span>
                  </div>
                  <div>
                    <span className="text-white/40">Última compra: </span>
                    <span className="text-white/80">{row.ultima_compra ? new Date(row.ultima_compra).toLocaleDateString("es-EC") : "-"}</span>
                  </div>
                </div>

                {row.direccion && row.direccion !== "-" && (
                  <p className="text-[10px] text-white/30 mt-2 truncate">📍 {row.direccion}</p>
                )}
              </div>
            );
          })}

          {/* Paginación mobile */}
          {totalPages > 1 && (
            <div className="border-t border-[#046C5E]/30 pt-4 pb-2">
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">‹</button>
                {pageNumbers.map((n, i) =>
                  n === "..." ? <span key={`dm-${i}`} className="px-1 text-white/30 text-sm">…</span> : (
                    <button key={n} onClick={() => setPage(n as number)}
                      className={`px-3 py-2 rounded-lg text-sm transition ${page === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#025f4b]"}`}>
                      {n}
                    </button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">»</button>
              </div>
              <p className="text-center text-xs text-white/30 mt-2">
                Pág {page}/{totalPages} — {filteredSorted.length.toLocaleString("es-EC")} clientes
              </p>
            </div>
          )}
        </div>

        {/* ── DESKTOP TABLE ─────────────────────────────────────────── */}
        <div className="hidden md:block rounded-2xl overflow-hidden border border-[#046C5E]/40 shadow-xl bg-gradient-to-b from-[#013d30] to-[#012E24]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-center">#</th>
                  <Th label="Cliente"       col="nombre"/>
                  <Th label="Estado"        col="estado_cliente" align="center"/>
                  <Th label="Vendedor"      col="vendedor"/>
                  <Th label="Unidades"      col="unidades"       align="right"/>
                  <Th label="Ventas"        col="dolares"        align="right"/>
                  <Th label="Facturas"      col="facturas"       align="right"/>
                  <Th label="Tipo Negocio"  col="tipo_negocio"/>
                  <Th label="Pago"          col="tipo_pago"/>
                  <Th label="Última Compra" col="ultima_compra"  align="right"/>
                </tr>
              </thead>

              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-white/30 text-sm italic">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : pageData.map((row, idx) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={`${row.codigo}-${idx}`}
                      onClick={() => navigate(`/dashboard/cliente/${row.codigo}`)}
                      className={`cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57]`}>
                      <td className="px-4 py-2 font-bold text-gray-300 text-center">{globalIdx}</td>
                      <td className="px-4 py-2">{row.nombre}</td>
                      <td className="px-4 py-2 text-center text-lg">{estadoIcon(row.estado_cliente)}</td>
                      <td className="px-4 py-2">{row.vendedor}</td>
                      <td className="px-4 py-2 text-right text-green-400 font-bold">{row.unidades.toLocaleString("es-EC")}</td>
                      <td className="px-4 py-2 text-right text-blue-400 font-bold">{money(row.dolares)}</td>
                      <td className="px-4 py-2 text-right">{row.facturas}</td>
                      <td className="px-4 py-2">{row.tipo_negocio || "-"}</td>
                      <td className="px-4 py-2 font-semibold">{row.tipo_pago || (row.tiene_credito ? "CREDITO" : "CONTADO")}</td>
                      <td className="px-4 py-2 text-right">
                        {row.ultima_compra ? new Date(row.ultima_compra).toLocaleDateString("es-EC") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-green-300">
                    TOTAL — {filteredSorted.length.toLocaleString("es-EC")} clientes
                    {inputQuery && ` (filtrado de ${clientes.length.toLocaleString("es-EC")})`}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">{totalUnidades.toLocaleString("es-EC")}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{money(totalDolares)}</td>
                  <td className="px-4 py-3 text-right">{totalFacturas.toLocaleString("es-EC")}</td>
                  <td/><td/><td/>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Paginación desktop */}
          {totalPages > 1 && (
            <div className="border-t border-[#046C5E]/30 px-4 py-3">
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">‹ Anterior</button>
                {pageNumbers.map((n, i) =>
                  n === "..." ? <span key={`dd-${i}`} className="px-2 text-white/30">…</span> : (
                    <button key={n} onClick={() => setPage(n as number)}
                      className={`px-3 py-2 rounded-lg text-sm transition ${page === n ? "bg-emerald-600 text-white font-bold" : "bg-[#014434] hover:bg-[#025f4b]"}`}>
                      {n}
                    </button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">Siguiente ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] transition text-sm">»</button>
                <span className="text-sm text-white/40 ml-2">
                  Pág {page} / {totalPages} — mostrando {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filteredSorted.length)} de {filteredSorted.length.toLocaleString("es-EC")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}