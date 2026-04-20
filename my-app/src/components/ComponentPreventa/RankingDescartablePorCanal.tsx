import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { BsDownload } from "react-icons/bs";

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────
interface VentaDescartable {
  seller_code: string;
  unidades: string | number;
  dolares: string | number;
  clientes?: number;
  customer_codes?: string[];
  proyeccion?: number;
  vsMesAnterior?: {
    monto_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
  meta?: number | { meta_historica: number; mes_mayor_consumo: string };
  objetivo_gerencia?: number;
  objetivo_gerencia_unidades?: number;
}

interface OdooCanal {
  canal: string;            // equipo_ventas: "Moderno", "Distribuidores", ...
  total_imponible: number;
  total_unidades: number;
  rotacion: number;
  clientes: number;
  customer_codes?: string[];
  proyeccion?: number;
  vsMesAnterior?: {
    monto_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
}

interface CanalAgregado {
  canal: string;
  slug: string;
  fuente: "preventa" | "odoo" | "combinado";
  unidades: number;
  dolares: number;
  proyeccion: number;
  variacion_abs: number | null;
  variacion_porc: number | null;
  clientes: number;
  codigos: Set<string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const obtenerCanalPreventa = (seller_code: string): string => {
  if (seller_code.startsWith("A")) return "DOMICILIO";
  if (seller_code.startsWith("V")) return "VIP";
  if (seller_code.startsWith("M")) return "MAYORISTA";
  return "OTRO";
};

const SLUG_PREVENTA: Record<string, string> = {
  DOMICILIO: "domicilio",
  VIP:       "vip",
  MAYORISTA: "mayorista",
  OTRO:      "otro",
};

const SLUG_ODOO: Record<string, string> = {
  Moderno:        "moderno",
  Distribuidores: "distribuidores",
  Quito:          "quito",
  Empresas:       "empresas-odoo",
  Domicilio:      "domicilio-odoo",
};

const fmtNum = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

// ──────────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────────
const RankingDescartablePorCanal = ({
  data,
  odooData,
  anio,
  mes,
}: {
  data: Record<string, VentaDescartable>;
  odooData?: OdooCanal[];
  anio: string;
  mes: string;
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "canal" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: string) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  if (!data && !odooData) {
    return (
      <p className="text-gray-400 text-center mt-4">No hay datos para mostrar.</p>
    );
  }

  // ── Agregar canales preventa ───────────────────────────────────────────────
  const preventaMap: Record<string, {
    unidades: number; dolares: number; proyeccion: number;
    variacion_abs: number; monto_anterior: number; codigos: Set<string>;
  }> = {};

  Object.values(data ?? {}).forEach((r) => {
    const canal = obtenerCanalPreventa(r.seller_code);
    if (!preventaMap[canal]) {
      preventaMap[canal] = {
        unidades: 0, dolares: 0, proyeccion: 0,
        variacion_abs: 0, monto_anterior: 0, codigos: new Set<string>(),
      };
    }
    const g = preventaMap[canal];
    g.unidades      += Number(r.unidades  ?? 0);
    g.dolares       += Number(r.dolares   ?? 0);
    g.proyeccion    += Number(r.proyeccion ?? 0);
    g.variacion_abs += Number(r.vsMesAnterior?.variacion_abs  ?? 0);
    g.monto_anterior += Number(r.vsMesAnterior?.monto_anterior ?? 0);
    (r.customer_codes ?? []).forEach(code => { if (code) g.codigos.add(code); });
  });

  const canalesPreventa: CanalAgregado[] = Object.entries(preventaMap).map(
    ([canal, g]) => ({
      canal,
      slug:          SLUG_PREVENTA[canal] ?? canal.toLowerCase(),
      fuente:        "preventa" as const,
      unidades:      g.unidades,
      dolares:       g.dolares,
      proyeccion:    g.proyeccion,
      clientes:      g.codigos.size,
      codigos:       g.codigos,
      variacion_abs: g.variacion_abs,
      variacion_porc:
        g.monto_anterior > 0
          ? Number(((g.variacion_abs / g.monto_anterior) * 100).toFixed(2))
          : null,
    })
  ).sort((a, b) => b.dolares - a.dolares);

  // ── Canales ODOO ──────────────────────────────────────────────────────────
  const canalesOdoo: CanalAgregado[] = (odooData ?? []).map((o) => {
    const codigos = new Set<string>((o.customer_codes ?? []).filter(Boolean));
    return {
      canal:          o.canal,
      slug:           SLUG_ODOO[o.canal] ?? o.canal.toLowerCase(),
      fuente:         "odoo" as const,
      unidades:       Number(o.total_unidades ?? 0),
      dolares:        Number(o.total_imponible ?? 0),
      proyeccion:     Number(o.proyeccion ?? 0),
      variacion_abs:  o.vsMesAnterior ? Number(o.vsMesAnterior.variacion_abs) : null,
      variacion_porc: o.vsMesAnterior ? o.vsMesAnterior.variacion_porc : null,
      clientes:       codigos.size > 0 ? codigos.size : Number(o.clientes ?? 0),
      codigos,
    };
  }).sort((a, b) => b.dolares - a.dolares);

  // ── Fusionar DOMICILIO Mobilvendor + ODOO Domicilio ──────────────────────
  const mobilDom = canalesPreventa.find(c => c.canal === "DOMICILIO");
  const ooooDom  = canalesOdoo.find(c => c.canal === "Domicilio");

  let canalesPreventaFinal = canalesPreventa;
  let canalesOdooFinal     = canalesOdoo;

  if (mobilDom && ooooDom) {
    canalesPreventaFinal = canalesPreventa.filter(c => c.canal !== "DOMICILIO");
    canalesOdooFinal     = canalesOdoo.filter(c => c.canal !== "Domicilio");

    const varAbsTotal   = (mobilDom.variacion_abs ?? 0) + (ooooDom.variacion_abs ?? 0);
    const montoAntMobil = mobilDom.dolares - (mobilDom.variacion_abs ?? 0);
    const montoAntOdoo  = ooooDom.dolares  - (ooooDom.variacion_abs  ?? 0);
    const montoAntTotal = montoAntMobil + montoAntOdoo;
    const codigosDom    = new Set<string>([...mobilDom.codigos, ...ooooDom.codigos]);

    const combinado: CanalAgregado = {
      canal:          "DOMICILIO",
      slug:           "domicilio",
      fuente:         "combinado",
      unidades:       mobilDom.unidades  + ooooDom.unidades,
      dolares:        mobilDom.dolares   + ooooDom.dolares,
      proyeccion:     mobilDom.proyeccion + ooooDom.proyeccion,
      variacion_abs:  varAbsTotal,
      variacion_porc: montoAntTotal > 0
        ? Number(((varAbsTotal / montoAntTotal) * 100).toFixed(2))
        : null,
      clientes:       codigosDom.size > 0 ? codigosDom.size : (mobilDom.clientes + ooooDom.clientes),
      codigos:        codigosDom,
    };

    canalesPreventaFinal = [...canalesPreventaFinal, combinado].sort((a, b) => b.dolares - a.dolares);
  } else if (mobilDom && !ooooDom) {
    // Solo Mobilvendor, no hay ODOO Domicilio — sin cambios
  } else if (!mobilDom && ooooDom) {
    // Solo ODOO, moverlo a sección Mobilvendor como combinado
    canalesOdooFinal     = canalesOdoo.filter(c => c.canal !== "Domicilio");
    canalesPreventaFinal = [...canalesPreventaFinal, { ...ooooDom, canal: "DOMICILIO", slug: "domicilio", fuente: "combinado" as const }]
      .sort((a, b) => b.dolares - a.dolares);
  }

  // ── Fusionar VIP + ODOO Moderno en una sola fila ─────────────────────────
  const mobilVip    = canalesPreventaFinal.find(c => c.canal === "VIP");
  const odooModerno = canalesOdooFinal.find(c => c.canal === "Moderno");

  if (mobilVip && odooModerno) {
    canalesPreventaFinal = canalesPreventaFinal.filter(c => c.canal !== "VIP");
    canalesOdooFinal     = canalesOdooFinal.filter(c => c.canal !== "Moderno");

    const varAbsVip   = (mobilVip.variacion_abs  ?? 0) + (odooModerno.variacion_abs  ?? 0);
    const montoAntVip = mobilVip.dolares  - (mobilVip.variacion_abs  ?? 0);
    const montoAntMod = odooModerno.dolares - (odooModerno.variacion_abs ?? 0);
    const montoAntTot = montoAntVip + montoAntMod;
    const codigosVip  = new Set<string>([...mobilVip.codigos, ...odooModerno.codigos]);

    const vipCombinado: CanalAgregado = {
      canal:          "VIP",
      slug:           "vip",
      fuente:         "combinado",
      unidades:       mobilVip.unidades   + odooModerno.unidades,
      dolares:        mobilVip.dolares    + odooModerno.dolares,
      proyeccion:     mobilVip.proyeccion + odooModerno.proyeccion,
      variacion_abs:  varAbsVip,
      variacion_porc: montoAntTot > 0
        ? Number(((varAbsVip / montoAntTot) * 100).toFixed(2))
        : null,
      clientes:       codigosVip.size > 0 ? codigosVip.size : (mobilVip.clientes + odooModerno.clientes),
      codigos:        codigosVip,
    };

    canalesPreventaFinal = [...canalesPreventaFinal, vipCombinado]
      .sort((a, b) => b.dolares - a.dolares);
  } else if (!mobilVip && odooModerno) {
    // Solo ODOO Moderno, mostrarlo en Mobilvendor como VIP
    canalesOdooFinal     = canalesOdooFinal.filter(c => c.canal !== "Moderno");
    canalesPreventaFinal = [...canalesPreventaFinal, { ...odooModerno, canal: "VIP", slug: "vip", fuente: "combinado" as const }]
      .sort((a, b) => b.dolares - a.dolares);
  }

  // ── Lista unificada de canales (sin distinción de fuente) ────────────────
  const canalesBase: CanalAgregado[] = [...canalesPreventaFinal, ...canalesOdooFinal]
    .sort((a, b) => b.dolares - a.dolares);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canalesTodos = useMemo(() => {
    if (!sortKey) return canalesBase;
    return [...canalesBase].sort((a, b) => {
      if (sortKey === "canal") {
        return sortDir === "asc" ? a.canal.localeCompare(b.canal) : b.canal.localeCompare(a.canal);
      }
      const av = Number((a as any)[sortKey] ?? 0);
      const bv = Number((b as any)[sortKey] ?? 0);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [canalesBase, sortKey, sortDir]);

  // ── Totales ───────────────────────────────────────────────────────────────
  const totP = canalesPreventaFinal.reduce(
    (acc, c) => ({
      unidades:     acc.unidades  + c.unidades,
      dolares:      acc.dolares   + c.dolares,
      proyeccion:   acc.proyeccion + c.proyeccion,
      variacion_abs: acc.variacion_abs + (c.variacion_abs ?? 0),
    }),
    { unidades: 0, dolares: 0, proyeccion: 0, variacion_abs: 0 }
  );

  const totO = canalesOdooFinal.reduce(
    (acc, c) => ({
      unidades:     acc.unidades     + c.unidades,
      dolares:      acc.dolares      + c.dolares,
      proyeccion:   acc.proyeccion   + c.proyeccion,
      variacion_abs: acc.variacion_abs + (c.variacion_abs ?? 0),
    }),
    { unidades: 0, dolares: 0, proyeccion: 0, variacion_abs: 0 }
  );

  // ── Excel ─────────────────────────────────────────────────────────────────
  const exportarExcel = () => {
    const rows = canalesTodos.map((c, i) => ({
      "N°": i + 1,
      Canal: c.canal,
      Unidades: c.unidades,
      USD: c.dolares,
      Proyección: c.proyeccion || "—",
      "Variación $": c.variacion_abs ?? "—",
      "%": c.variacion_porc != null ? `${c.variacion_porc}%` : "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CanalDescartable");
    XLSX.writeFile(wb, `ranking_canal_${mes}_${anio}.xlsx`);
  };

  // ── Render fila ───────────────────────────────────────────────────────────
  const renderFila = (c: CanalAgregado, idx: number) => {
    const slug = `${c.slug}`;
    const onClick = () =>
      navigate(`/descartable-canal/${slug}/clientes/${anio}/${mes}`);

    const varColor =
      c.variacion_abs == null
        ? "text-gray-400"
        : c.variacion_abs >= 0
        ? "text-green-400"
        : "text-red-400";

    return (
      <tr
        key={`${c.fuente}-${c.canal}`}
        onClick={onClick}
        className={`${
          idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
        } hover:bg-[#025940] cursor-pointer transition-all duration-200`}
      >
        <td className="px-4 py-2 text-gray-300">{idx + 1}</td>
        <td className="px-4 py-2">
          <span className="font-bold text-white">{c.canal}</span>
          {c.clientes > 0 && (
            <span className="ml-2 text-gray-400 text-xs">
              {c.clientes} {c.clientes === 1 ? "cliente" : "clientes"}
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right text-green-400">
          {fmtInt(c.unidades)}
        </td>
        <td className="px-4 py-2 text-right text-blue-300 font-semibold">
          ${fmtNum(c.dolares)}
        </td>
        {isAdmin && (
          <td className="px-4 py-2 text-right text-emerald-400">
            {c.proyeccion ? `$${fmtNum(c.proyeccion)}` : "—"}
          </td>
        )}
        <td className={`px-4 py-2 text-right font-bold ${varColor}`}>
          {c.variacion_abs == null
            ? "—"
            : `${c.variacion_abs >= 0 ? "+" : ""}$${fmtNum(Math.abs(c.variacion_abs))}`}
        </td>
        <td className={`px-4 py-2 text-right font-bold ${varColor}`}>
          {c.variacion_porc == null
            ? "—"
            : `${c.variacion_porc >= 0 ? "+" : ""}${Math.abs(c.variacion_porc).toFixed(1)}%`}
        </td>
      </tr>
    );
  };

  const totalGenUnidades   = totP.unidades   + totO.unidades;
  const totalGenDolares    = totP.dolares    + totO.dolares;
  const totalGenProyeccion = totP.proyeccion + totO.proyeccion;
  const totalGenVariacion  = totP.variacion_abs + totO.variacion_abs;

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-blue-300">
            RANKING DESCARTABLE POR CANAL
          </h2>
          <p className="text-sm text-green-300 mt-1 tracking-wide">
            · Domicilio · VIP · Mayorista · Distribuidores · Empresas · Quito ·
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-green-400">{fmtInt(totalGenUnidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${fmtNum(totalGenDolares)}</p>
          </div>
          {isAdmin && (
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Proyección</p>
              <p className="text-base font-bold text-emerald-400">${fmtNum(totalGenProyeccion)}</p>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
            >
              <BsDownload size={16} />
              <span>Exportar</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs select-none">
            <tr>
              <th className="px-4 py-3 text-left w-10">N°</th>
              <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("canal")}>
                Canal<span className="ml-1 text-[#046C5E]">{sortIndicator("canal")}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("unidades")}>
                Unidades<span className="ml-1 text-[#046C5E]">{sortIndicator("unidades")}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("dolares")}>
                USD<span className="ml-1 text-[#046C5E]">{sortIndicator("dolares")}</span>
              </th>
              {isAdmin && (
                <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("proyeccion")}>
                  Proyección<span className="ml-1 text-[#046C5E]">{sortIndicator("proyeccion")}</span>
                </th>
              )}
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("variacion_abs")}>
                Variación $<span className="ml-1 text-[#046C5E]">{sortIndicator("variacion_abs")}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort("variacion_porc")}>
                %<span className="ml-1 text-[#046C5E]">{sortIndicator("variacion_porc")}</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {canalesTodos.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay datos para mostrar.
                </td>
              </tr>
            ) : (
              canalesTodos.map((c, i) => renderFila(c, i))
            )}
          </tbody>

          {/* TOTAL GENERAL */}
          <tfoot className="bg-[#014434] font-bold text-sm border-t-2 border-[#0db48b]">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right text-white">TOTAL GENERAL</td>
              <td className="px-4 py-3 text-right text-green-400">{fmtInt(totalGenUnidades)}</td>
              <td className="px-4 py-3 text-right text-blue-300">${fmtNum(totalGenDolares)}</td>
              {isAdmin && <td className="px-4 py-3 text-right text-emerald-400">${fmtNum(totalGenProyeccion)}</td>}
              <td className={`px-4 py-3 text-right ${totalGenVariacion >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalGenVariacion >= 0 ? "+" : ""}${fmtNum(Math.abs(totalGenVariacion))}
              </td>
              <td className="px-4 py-3 text-right text-gray-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default RankingDescartablePorCanal;
