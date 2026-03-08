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

const money = (n?: number) =>
  Number(n || 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });

const estadoIcon = (e?: string) =>
  e === "ACTIVO" ? "🟢" : e === "RIESGO" ? "🟡" : e === "INACTIVO" ? "🔴" : "⚪";

const Arrow = ({ col, sk, sd }: { col: SortKey; sk: SortKey; sd: SortDir }) => (
  <span className="ml-1 opacity-50 text-[10px]">{sk === col ? (sd === "asc" ? "↑" : "↓") : "↕"}</span>
);

export default function DashboardClientesTabla() {
  const navigate = useNavigate();

  const [inputQuery,  setInputQuery]  = useState("");   // refleja el input en tiempo real
  const [searchQuery, setSearchQuery] = useState("");   // con debounce → va al backend

  const [clientes,       setClientes]       = useState<ClienteRow[]>([]);
  const [kpis,           setKpis]           = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);  // ← solo la primera vez
  const [isFetching,     setIsFetching]     = useState(false); // ← recargas: NO oculta tabla
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const LIMIT = 10000;

  // ── Debounce 400ms → actualiza searchQuery ────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(inputQuery); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [inputQuery]);

  // ── Fetch — NO pone loading si ya hay datos (isFetching en su lugar) ──
  useEffect(() => {
    const ctrl = new AbortController();

    const cargar = async () => {
      // Si ya tenemos datos → recarga silenciosa (sin destruir la tabla)
      if (clientes.length > 0) setIsFetching(true);
      else                      setInitialLoading(true);

      try {
        const q   = searchQuery.trim();
        const url = `${API_BASE_URL}/api/dashboard-clientes/resumen?page=${page}&limit=${LIMIT}` +
                    (q ? `&buscar=${encodeURIComponent(q)}` : "");

        const res  = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: ApiResponse = await res.json();
        if (!json.ok) { setClientes([]); return; }

        const rows: ClienteRow[] = (json.data || []).map((r: any) => ({
          codigo:   r.codigo_cliente,
          nombre:   r.nombre_cliente,
          cedula:   r.identificacion_cliente,
          direccion: r.direccion ?? "-",
          vendedor: r.seller_code ?? "-",
          unidades: Number(r.total_unidades || 0),
          dolares:  Number(r.total_ventas   || 0),
          facturas: Number(r.total_facturas || 0),
          tipo_negocio: r.tipo_negocio ?? "SIN CLASIFICAR",
          tipo_pago:    r.tipo_pago ?? (r.tiene_credito_cliente ? "CREDITO" : "CONTADO"),
          tiene_credito: Boolean(r.tiene_credito_cliente),
          ultima_compra:    r.ultima_compra,
          dias_sin_comprar: r.dias_sin_comprar,
          estado_cliente:   r.estado_cliente,
        }));

        setClientes(rows);
        setKpis(json.kpis);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotalRegistros(json.pagination.total  || 0);
        } else {
          setTotalPages(1);
          setTotalRegistros(rows.length);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error cargando clientes", err);
        setClientes([]); setTotalPages(1); setTotalRegistros(0);
      } finally {
        setInitialLoading(false);
        setIsFetching(false);
      }
    };

    cargar();
    return () => ctrl.abort();
  }, [page, searchQuery]);

  // ── Ordenamiento ──────────────────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => sortKey === key && prev === "asc" ? "desc" : "asc");
    setSortKey(key);
  }, [sortKey]);

  // ── Filtro local + sort (sin llamada al backend) ──────────────────
  const filteredData = useMemo(() => {
    const q = inputQuery.trim().toLowerCase();
    let data = q
      ? clientes.filter(r =>
          r.nombre?.toLowerCase().includes(q) || r.cedula?.toLowerCase().includes(q))
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

  // ── Totales ───────────────────────────────────────────────────────
  const totalUnidades   = filteredData.reduce((a, r) => a + r.unidades, 0);
  const totalDolares    = filteredData.reduce((a, r) => a + r.dolares,  0);
  const totalFacturas   = filteredData.reduce((a, r) => a + r.facturas, 0);
  const ticketPromedio  = totalFacturas > 0 ? totalDolares / totalFacturas : 0;
  const clientesCredito = filteredData.filter(c => c.tiene_credito).length;
  const totalClientesKPI = totalRegistros || clientes.length;

  // ── Th helper ─────────────────────────────────────────────────────
  const Th = ({ label, col, align = "left" }: { label: string; col: SortKey; align?: "left"|"right"|"center" }) => (
    <th onClick={() => handleSort(col)}
      className={`px-4 py-3 text-${align} cursor-pointer hover:text-white whitespace-nowrap select-none transition-colors`}>
      {label}<Arrow col={col} sk={sortKey} sd={sortDir}/>
    </th>
  );

  // ── Carga inicial ─────────────────────────────────────────────────
  if (initialLoading)
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen text-white gap-3">
          <span className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"/>
          Cargando clientes...
        </div>
      </DashboardLayout>
    );

  // ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-10 py-6">
        <Header/>

        <h1 className="text-3xl font-bold tracking-wide mb-6">DASHBOARD CLIENTES</h1>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: "Clientes",         value: totalClientesKPI,              color: "text-white"       },
            { label: "Ventas",           value: money(totalDolares),           color: "text-blue-400"    },
            { label: "Ticket Promedio",  value: money(ticketPromedio),         color: "text-green-400"   },
            { label: "Clientes Crédito", value: clientesCredito,               color: "text-yellow-400"  },
          ].map(k => (
            <div key={k.label} className="bg-[#013d32] p-4 rounded-lg">
              <p className="text-sm text-gray-300">{k.label}</p>
              <h2 className={`text-2xl font-bold ${k.color}`}>{k.value}</h2>
            </div>
          ))}
        </div>

        {/* BUSCADOR */}
        <div className="relative w-96 mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <input
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              className="w-full rounded-lg bg-[#013d32] border border-[#046C5E] px-4 py-2 pr-8 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 transition-all"
            />
            {inputQuery && (
              <button onClick={() => setInputQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition text-base leading-none">
                ✕
              </button>
            )}
          </div>
          {/* spinner sutil durante recargas — la tabla NO desaparece */}
          {isFetching && (
            <span className="w-4 h-4 border-2 border-green-400/20 border-t-green-400 rounded-full animate-spin flex-shrink-0"/>
          )}
        </div>

        {/* TABLA */}
        <div className="overflow-x-auto rounded-lg shadow-lg">
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
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-white/30 text-sm italic">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : filteredData.map((row, idx) => (
                <tr key={`${row.codigo}-${idx}`}
                  onClick={() => navigate(`/dashboard/cliente/${row.codigo}`)}
                  className={`cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57]`}>
                  <td className="px-4 py-2 font-bold text-gray-300 text-center">{(page - 1) * LIMIT + idx + 1}</td>
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
              ))}
            </tbody>

            <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
              <tr>
                <td colSpan={4} className="px-4 py-3">TOTAL GENERAL</td>
                <td className="px-4 py-3 text-right">{totalUnidades.toLocaleString("es-EC")}</td>
                <td className="px-4 py-3 text-right">{money(totalDolares)}</td>
                <td className="px-4 py-3 text-right">{totalFacturas}</td>
                <td/><td/><td/>
              </tr>
            </tfoot>
          </table>

          {/* PAGINACIÓN */}
          <div className="flex justify-center items-center gap-4 mt-6 pb-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-4 py-2 bg-[#014434] rounded disabled:opacity-40 hover:bg-[#025f4b] transition">
              ← Anterior
            </button>
            <span className="text-sm text-white/50">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-4 py-2 bg-[#014434] rounded disabled:opacity-40 hover:bg-[#025f4b] transition">
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
