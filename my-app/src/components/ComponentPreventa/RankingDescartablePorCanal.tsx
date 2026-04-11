import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { BsDownload, BsGear } from "react-icons/bs";

interface VentaDescartable {
  seller_code: string;
  unidades: string | number;
  dolares: string | number;
  meta?: number | { meta_historica: number; mes_mayor_consumo: string };
  proyeccion?: number;
  objetivo_gerencia?: number;
  objetivo_gerencia_unidades?: number;
  vsMesAnterior?: {
    monto_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
}

// ✅ Helper: extrae el valor numérico de meta sin importar si es objeto o número
const getMetaValue = (meta: VentaDescartable["meta"]): number => {
  if (!meta) return 0;
  if (typeof meta === "object") return Number(meta.meta_historica) || 0;
  return Number(meta) || 0;
};

const RankingDescartablePorCanal = ({
  data,
  anio,
  mes,
}: {
  data: Record<string, VentaDescartable>;
  anio: string;
  mes: string;
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const navigate = useNavigate();

  const [sortedData, setSortedData] = useState<VentaDescartable[]>(
    Object.values(data)
  );

  useEffect(() => {
    setSortedData(Object.values(data));
  }, [data]);

  const [sortConfig, setSortConfig] = useState({
    key: "ranking",
    direction: "asc",
  });

  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-gray-400 text-center mt-4">
        No hay datos para mostrar.
      </p>
    );
  }

  // ============================
  // 🏷️ CANAL
  // ============================
  const obtenerCanal = (seller: string) => {
    if (seller.startsWith("A")) return "DOMICILIO";
    if (seller.startsWith("V")) return "VIP";
    if (seller.startsWith("M")) return "MAYORISTA";
    return "OTRO";
  };

  // ============================
  // 🔢 TOTALES
  // ============================
  const totalUnidades = sortedData.reduce((a, b) => a + Number(b.unidades ?? 0), 0);
  const totalUSD = sortedData.reduce((a, b) => a + Number(b.dolares ?? 0), 0);
  const totalMeta = sortedData.reduce((a, b) => a + getMetaValue(b.meta), 0);
  const totalProyeccion = sortedData.reduce((a, b) => a + Number(b.proyeccion ?? 0), 0);
  const totalObjetivoGerencia = sortedData.reduce((a, b) => a + Number(b.objetivo_gerencia ?? 0), 0);
  const totalVsMesAnterior = sortedData.reduce(
    (a, b) => a + Number(b.vsMesAnterior?.variacion_abs ?? 0), 0
  );

  // ============================
  // 🔃 ORDENAR
  // ============================
  const requestSort = (key: keyof VentaDescartable) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });

    const sorted = [...sortedData].sort((a, b) => {
      if (key === "seller_code") {
        return direction === "asc"
          ? a.seller_code.localeCompare(b.seller_code)
          : b.seller_code.localeCompare(a.seller_code);
      }
      if (key === "vsMesAnterior") {
        const aVal = a.vsMesAnterior?.variacion_abs ?? 0;
        const bVal = b.vsMesAnterior?.variacion_abs ?? 0;
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (key === "meta") {
        return direction === "asc"
          ? getMetaValue(a.meta) - getMetaValue(b.meta)
          : getMetaValue(b.meta) - getMetaValue(a.meta);
      }
      const aVal = Number((a as any)[key] ?? 0);
      const bVal = Number((b as any)[key] ?? 0);
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });

    setSortedData(sorted);
  };

  // ============================
  // 📊 EXCEL
  // ============================
  const exportarExcel = () => {
    const datos = sortedData.map((r, i) => ({
      "N°": i + 1,
      Canal: obtenerCanal(r.seller_code),
      Usuario: r.seller_code,
      Unidades: Number(r.unidades ?? 0),
      USD: Number(r.dolares ?? 0),
      Proyección: Number(r.proyeccion ?? 0),
      "Vs Mes Anterior": r.vsMesAnterior?.variacion_abs ?? 0,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.sheet_add_aoa(
      ws,
      [[`RANKING DESCARTABLE POR CANAL - ${mes}/${anio}`]],
      { origin: "A1" }
    );
    XLSX.utils.sheet_add_json(
      ws,
      [{
        "N°": "TOTAL",
        Canal: "",
        Usuario: "",
        Unidades: totalUnidades,
        USD: totalUSD,
        Proyección: totalProyeccion,
        "Vs Mes Anterior": totalVsMesAnterior,
      }],
      { skipHeader: true, origin: -1 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DescartableCanal");
    XLSX.writeFile(wb, `ranking_descartable_canal_${mes}_${anio}.xlsx`);
  };

  const groupedData = sortedData.reduce((acc, item) => {
    const canal = obtenerCanal(item.seller_code);

    if (!acc[canal]) {
      acc[canal] = [];
    }

    acc[canal].push(item);

    return acc;
  }, {} as Record<string, VentaDescartable[]>);

  const canalKeys = Object.keys(groupedData);

  // ============================
  // 🖼️ RENDER CELDA META
  // ============================
  const renderMeta = (meta: VentaDescartable["meta"]) => {
    if (!meta) return "–";

    const valor = getMetaValue(meta);
    const valorStr = valor.toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (typeof meta === "object" && meta.mes_mayor_consumo) {
      const fecha = new Date(meta.mes_mayor_consumo);
      const mesStr = !isNaN(fecha.getTime())
        ? fecha.toLocaleDateString("es-EC", { month: "long" })
        : "–";
      return `$${valorStr} (${mesStr})`;
    }

    return `$${valorStr}`;
  };

  // ============================
  // 🖼️ RENDER CELDA VS MES ANT
  // ============================
  const renderVsMesAnterior = (vsMesAnterior: VentaDescartable["vsMesAnterior"]) => {
    if (!vsMesAnterior) return "–";
    const abs = Number(vsMesAnterior.variacion_abs ?? 0);
    const porc = vsMesAnterior.variacion_porc;
    const signo = abs >= 0 ? "+" : "-";
    return (
      <>
        ({porc !== null
          ? `${porc >= 0 ? "+" : "-"}${Math.abs(porc).toFixed(1)}%`
          : "0%"})
        {" "}{signo}$
        {Math.abs(abs).toLocaleString("es-EC", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </>
    );
  };

  const fmtNum = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString("es-EC");

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-blue-300">
            RANKING DESCARTABLE POR CANAL
          </h2>
          <p className="text-sm text-green-300 mt-1 tracking-wide">
            · Domicilio · Mayorista · VIP ·
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-green-400">{fmtInt(totalUnidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${fmtNum(totalUSD)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Proyección</p>
            <p className="text-base font-bold text-emerald-400">${fmtNum(totalProyeccion)}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate("/configurar-metas")}
              title="Configurar Metas"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/60 bg-blue-500/20 text-white font-semibold hover:bg-blue-500/30 active:scale-[0.98] transition-all"
            >
              <BsGear size={16} className="text-white shrink-0" />
              <span>Metas</span>
            </button>
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
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N°</th>
            <th className="px-4 py-3 text-left">Canal</th>
            <th
              onClick={() => requestSort("seller_code")}
              className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none"
            >
              Usuario{" "}
              <span className="text-green-300">
                {sortConfig.key === "seller_code"
                  ? sortConfig.direction === "asc" ? "↑" : "↓"
                  : "↕"}
              </span>
            </th>
            <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">Unidades ↕</th>
            <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">USD ↕</th>
            <th onClick={() => requestSort("proyeccion")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">Proyección ↕</th>
            <th onClick={() => requestSort("vsMesAnterior")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">Variación ↕</th>
            <th onClick={() => requestSort("vsMesAnterior")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">% ↕</th>
          </tr>
        </thead>

        <tbody>
          {canalKeys.map((canal, idx) => {
            const canalData = groupedData[canal];

            // Cálculos de totales por canal
            const totalCanalUnidades = canalData.reduce((a, b) => a + Number(b.unidades ?? 0), 0);
            const totalCanalUSD = canalData.reduce((a, b) => a + Number(b.dolares ?? 0), 0);
            const totalCanalMeta = canalData.reduce((a, b) => a + getMetaValue(b.meta), 0);
            const totalCanalCupo = canalData.reduce((a, b) => a + Number(b.objetivo_gerencia ?? 0), 0);
            const totalCanalProyeccion = canalData.reduce((a, b) => a + Number(b.proyeccion ?? 0), 0);
            const totalCanalVsMesAnterior = canalData.reduce(
              (a, b) => a + Number(b.vsMesAnterior?.variacion_abs ?? 0), 0
            );

            return (
              <>
                {/* Encabezado de Canal */}
                <tr key={idx} className="bg-[#014434]">
                  <td colSpan={9} className="px-4 py-3 font-bold text-green-300">{canal}</td>
                </tr>

                {/* Filas de cada usuario dentro del canal */}
                {canalData.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => navigate(`/descartable-canal/${obtenerCanal(r.seller_code).toLowerCase()}/clientes/${anio}/${mes}`)}
                    className={`${i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                      } hover:bg-[#016a57] cursor-pointer transition-all duration-200`}
                  >
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2 text-green-400 font-bold">{obtenerCanal(r.seller_code)}</td>
                    <td className="px-4 py-2 text-blue-300 font-bold">{r.seller_code}</td>
                    <td className="px-4 py-2 text-right text-green-400">
                      {Number(r.unidades ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-300">
                      ${Number(r.dolares ?? 0).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ${Number(r.proyeccion ?? 0).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-2 text-right font-bold ${(r.vsMesAnterior?.variacion_abs ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                      {!r.vsMesAnterior ? "–" : (() => {
                        const abs = Number(r.vsMesAnterior.variacion_abs ?? 0);
                        const signo = abs >= 0 ? "+" : "-";
                        return <>{signo}${Math.abs(abs).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
                      })()}
                    </td>
                    <td className={`px-4 py-2 text-right font-bold ${(r.vsMesAnterior?.variacion_abs ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                      {!r.vsMesAnterior ? "–" : (() => {
                        const porc = r.vsMesAnterior.variacion_porc;
                        return porc !== null
                          ? `${porc >= 0 ? "+" : "-"}${Math.abs(porc).toFixed(1)}%`
                          : "0%";
                      })()}
                    </td>
                  </tr>
                ))}

                {/* Total por Canal */}
                <tr className="bg-[#013d32]">
                  <td colSpan={3} className="px-4 py-3 text-right text-green-400 font-bold">TOTAL {canal}</td>
                  <td className="px-4 py-3 text-right">{totalCanalUnidades.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">${totalCanalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right">{totalCanalProyeccion.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
                  <td className={`px-4 py-3 text-right ${totalCanalVsMesAnterior >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalCanalVsMesAnterior >= 0 ? "+" : "-"}${Math.abs(totalCanalVsMesAnterior).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                </tr>
              </>
            );
          })}
        </tbody>

        <tfoot className="bg-[#014434] font-bold">
          <tr>
            <td className="px-4 py-3">TOTAL</td>
            <td colSpan={2}></td>
            <td className="px-4 py-3 text-right text-green-400">
              {totalUnidades.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right">
              ${totalProyeccion.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </td>
            <td className={`px-4 py-3 text-right ${totalVsMesAnterior >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalVsMesAnterior >= 0 ? "+" : "-"}${Math.abs(totalVsMesAnterior).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
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