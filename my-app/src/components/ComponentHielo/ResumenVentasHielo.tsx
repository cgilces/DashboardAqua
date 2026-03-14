import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { BsDownload } from "react-icons/bs";

type SortDirection = "asc" | "desc";

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const ResumenVentasHielo = ({ data, anio, mes, }: { data: any[]; anio: string; mes: string; }) => {
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "usuario",
    direction: "asc",
  });

  const [sortedData, setSortedData] = useState<any[]>([]);

  useEffect(() => {
    setSortedData(data);
  }, [data]);

  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-center">No hay datos para mostrar.</p>;
  }

  // ==========================
  // 🔢 TOTALES
  // ==========================
  const totalUnidades = sortedData.reduce(
    (acc, r) => acc + Number(r.cantidadVendida || 0),
    0
  );

  const totalUSD = sortedData.reduce(
    (acc, r) => acc + Number(r.totalConIVA || 0),
    0
  );

  const totalMetaHistorica = sortedData.reduce(
    (acc, r) => acc + Number(r.meta?.meta_historica || 0),
    0
  );

  const totalProyeccion = sortedData.reduce(
    (acc, r) => acc + Number(r.proyeccion || 0),
    0
  );

  const totalVsMesAnterior = sortedData.reduce(
    (acc, r) => acc + Number(r.vsMesAnterior?.variacion_abs || 0),
    0
  );

  // ==========================
  // 🔀 ORDENAMIENTO
  // ==========================

  const requestSort = (key: string) => {
    let direction: SortDirection = "asc";

    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key, direction });

    const sorted = [...sortedData].sort((a, b) => {
      const getValue = (row: any) => {
        switch (key) {
          case "meta":
            // Convertir el valor de "meta_historica" de string a número
            return parseFloat(row.meta?.meta_historica || "0");
          case "vsMesAnterior":
            return row.vsMesAnterior?.variacion_abs ?? 0;
          default:
            return row[key];
        }
      };

      const aVal = getValue(a);
      const bVal = getValue(b);

      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    setSortedData(sorted);
  };



  const iconoOrden = (key: string) =>
    sortConfig.key === key
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : "↕";

  // ==========================
  // 📤 EXPORTAR EXCEL
  // ==========================
  const exportarTablaExcel = () => {
    if (!sortedData || sortedData.length === 0) return;

    const datosExportar = sortedData.map((r, index) => ({
      "N°": index + 1,
      Usuario: r.usuario,
      Unidades: r.cantidadVendida ?? 0,
      Dólares: r.totalConIVA ?? 0,
      "Meta Histórica": r.meta?.meta_historica ?? 0,
      Proyección: r.proyeccion ?? 0,
      "Vs Mes Anterior": r.vsMesAnterior?.variacion_abs ?? 0,
    }));

    const ws = XLSX.utils.json_to_sheet(datosExportar);

    XLSX.utils.sheet_add_aoa(
      ws,
      [[`RESUMEN VENTAS HIELO - ${mes}/${anio}`]],
      { origin: "A1" }
    );

    XLSX.utils.sheet_add_json(
      ws,
      [
        {
          "N°": "TOTAL",
          Usuario: "",
          Unidades: totalUnidades,
          Dólares: totalUSD,
          "Meta Histórica": totalMetaHistorica,
          Proyección: totalProyeccion,
          "Vs Mes Anterior": totalVsMesAnterior,
        },
      ],
      { skipHeader: true, origin: -1 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ResumenHielo");

    XLSX.writeFile(
      wb,
      `resumen_ventas_hielo_${mes}_${anio}.xlsx`,
      { compression: true }
    );
  };

  const fmt = (n: number) =>
    n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString("es-EC");

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-cyan-300">
          RESUMEN DE VENTAS DE HIELO
        </h2>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-cyan-300">{fmtInt(totalUnidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${fmt(totalUSD)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Meta</p>
            <p className="text-base font-bold text-amber-300">${fmt(totalMetaHistorica)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Proyección</p>
            <p className="text-base font-bold text-emerald-400">${fmt(totalProyeccion)}</p>
          </div>
          {isAdmin && (
            <button
              onClick={exportarTablaExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
            >
              <BsDownload size={16} className="text-white shrink-0" />
              <span>Exportar</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("usuario")}>
              Usuario {iconoOrden("usuario")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("cantidadVendida")}>
              Unidades {iconoOrden("cantidadVendida")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("totalConIVA")}>
              Dólares {iconoOrden("totalConIVA")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("meta")}>
              Meta {iconoOrden("meta")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("proyeccion")}>
              Proyección {iconoOrden("proyeccion")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("vsMesAnterior")}>
              Variación {iconoOrden("vsMesAnterior")}
            </th>
            <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort("vsMesAnterior")}>
              % {iconoOrden("vsMesAnterior")}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((r, i) => (
            <tr
              key={i}
              onClick={() => navigate(`/detalle-hielo/${r.usuario}/${anio}/${mes}`)}  // Redirige al hacer clic en cualquier fila
              className={`${i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] cursor-pointer`}  // Agrega cursor pointer para mostrar que es clickeable
            >
              <td className="px-4 py-2 text-blue-300 font-bold">{r.usuario}</td>
              <td className="px-4 py-2 text-right text-green-400 font-bold">
                {Number(r.cantidadVendida ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.totalConIVA ?? 0).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2 text-right">
                {r.meta
                  ? `${Number(r.meta.meta_historica ?? 0).toLocaleString("es-EC", {
                    minimumFractionDigits: 2,
                  })} (${new Date(r.meta.mes_mayor_consumo).toLocaleDateString("es-EC", {
                    month: "long",
                  })})`
                  : "–"}
              </td>

              <td className="px-4 py-2 text-right font-bold">
                {r.vsMesAnterior && r.vsMesAnterior.variacion_porc !== null ? (
                  <span
                    className={`inline-flex items-center gap-1
            ${r.vsMesAnterior.variacion_porc >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    (
                    {r.vsMesAnterior.variacion_porc > 0 ? "+" : ""}
                    {(r.vsMesAnterior.variacion_porc ?? 0).toFixed(1)}%
                    )
                    <span className="text-blue-300">
                      $
                      {Number(r.proyeccion ?? 0).toLocaleString("es-EC", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </td>

              {/* VARIACIÓN */}
              <td
                className={`px-4 py-2 text-right font-bold ${r.vsMesAnterior?.variacion_abs > 0
                  ? "text-green-400"
                  : r.vsMesAnterior?.variacion_abs < 0
                    ? "text-red-400"
                    : "text-gray-400"
                  }`}
              >
                {r.vsMesAnterior
                  ? `${(r.vsMesAnterior.variacion_abs ?? 0) >= 0 ? "+" : "-"}$${Math.abs(
                    r.vsMesAnterior.variacion_abs ?? 0
                  ).toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
                  : "–"}
              </td>
              {/* % */}
              <td
                className={`px-4 py-2 text-right font-bold ${r.vsMesAnterior?.variacion_abs > 0
                  ? "text-green-400"
                  : r.vsMesAnterior?.variacion_abs < 0
                    ? "text-red-400"
                    : "text-gray-400"
                  }`}
              >
                {r.vsMesAnterior
                  ? `${(r.vsMesAnterior.variacion_porc ?? 0) >= 0 ? "+" : ""}${(r.vsMesAnterior.variacion_porc ?? 0).toFixed(2)}%`
                  : "–"}
              </td>
            </tr>
          ))}
        </tbody>


        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>
            <td className="px-4 py-3 text-right text-green-400">
              {totalUnidades.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalMetaHistorica.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
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

export default ResumenVentasHielo;
