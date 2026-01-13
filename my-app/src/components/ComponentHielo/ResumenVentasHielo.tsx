import React, { useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";

const ResumenVentasHielo = ({
  data,
  anio,
  mes,
}: {
  data: any[];
  anio: string;
  mes: string;
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [sortConfig, setSortConfig] = useState({
    key: "usuario",
    direction: "asc",
  });
  const [sortedData, setSortedData] = useState(data);

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
  // 📤 EXPORTAR EXCEL
  // ==========================
  const exportarTablaExcel = () => {
    if (!sortedData || sortedData.length === 0) return;

    try {
      const datosExportar = sortedData.map((r, index) => ({
        "N°": index + 1,
        "Usuario": r.usuario,
        "Unidades": r.cantidadVendida ?? 0,
        "Dólares": r.totalConIVA ?? 0,
        "Meta Histórica": r.meta?.meta_historica ?? 0,
        "Vs Mes Anterior": r.vsMesAnterior?.variacion_abs ?? 0,
      }));

      const ws = XLSX.utils.json_to_sheet(datosExportar);

      // Título
      XLSX.utils.sheet_add_aoa(
        ws,
        [[`RESUMEN VENTAS HIELO - ${mes}/${anio}`]],
        { origin: "A1" }
      );

      // Fila Totales
      const filaTotales = {
        "N°": "TOTAL",
        "Usuario": "",
        "Unidades": totalUnidades,
        "Dólares": totalUSD,
        "Meta Histórica": totalMetaHistorica,
        "proyeccion": totalProyeccion,
        "Vs Mes Anterior": totalVsMesAnterior,
      };

      XLSX.utils.sheet_add_json(ws, [filaTotales], {
        skipHeader: true,
        origin: -1,
      });

      // Auto ancho columnas
      const columnas = Object.keys(datosExportar[0]);
      ws["!cols"] = columnas.map((col: any) => {
        const maxLen = Math.max(
          col.length,
          ...datosExportar.map((r) => String(r[col]).length)
        );
        return { wch: maxLen + 4 };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ResumenHielo");

      XLSX.writeFile(
        wb,
        `resumen_ventas_hielo_${mes}_${anio}.xlsx`,
        { compression: true }
      );
    } catch (error) {
      console.error("❌ Error exportando Excel:", error);
    }
  };

  // ==========================
  // 🔀 ORDENAR
  // ==========================
  const requestSort = (key: string) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key, direction });

    const sorted = [...sortedData].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

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

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      {/* ==========================
         HEADER + EXPORTAR
      ========================== */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold px-4 py-3 text-blue-300">
          Resumen de Ventas de Hielo
        </h2>

        {isAdmin && (
          <div className="flex gap-4 mb-4">
            <button
              onClick={exportarTablaExcel}
              className="bg-[#0db48b] hover:bg-[#0aa77e] text-black font-semibold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2"
            >
              <span>📥</span> Exportar
            </button>
          </div>
        )}
      </div>

      {/* ==========================
         TABLA
      ========================== */}
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Usuario</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Dólares</th>
            <th className="px-4 py-3 text-right">Meta</th>
            <th className="px-4 py-3 text-right">Proyección	</th>
            <th className="px-4 py-3 text-right">Vs Mes Anterior</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((r, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57]`}
            >
              <td className="px-4 py-2 text-blue-300 font-bold">{r.usuario}</td>

              <td className="px-4 py-2 text-right text-green-400 font-bold">
                {Number(r.cantidadVendida).toLocaleString()}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.totalConIVA).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </td>

              <td className="px-4 py-2 text-right">
                {r.meta
                  ? `${Number(r.meta.meta_historica).toLocaleString("es-EC", {
                    minimumFractionDigits: 2,
                  })} (${new Date(r.meta.mes_mayor_consumo).toLocaleDateString("es-EC", {
                    month: "long",
                  })})`
                  : "–"}
              </td>
              {/* <td></td> */}

              <td className="px-4 py-2 text-right font-bold">
                {r.vsMesAnterior && r.vsMesAnterior.variacion_porc !== null ? (
                  <span
                    className={`inline-flex items-center gap-1
        ${r.vsMesAnterior.variacion_porc >= 0
                        ? "text-green-400"
                        : "text-red-400"}
      `}
                  >
                    (
                    {r.vsMesAnterior.variacion_porc > 0 ? "+" : ""}
                    {r.vsMesAnterior.variacion_porc.toFixed(1)}%
                    )
                    <span className="text-blue-300">
                      $
                      {Number(r.proyeccion).toLocaleString("es-EC", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </td>


              <td
                className={`px-4 py-2 text-right font-bold ${r.vsMesAnterior?.variacion_abs > 0
                  ? "text-green-400"
                  : r.vsMesAnterior?.variacion_abs < 0
                    ? "text-red-400"
                    : "text-gray-400"
                  }`}
              >
                {r.vsMesAnterior
                  ? `(${r.vsMesAnterior.variacion_porc.toFixed(2)}%) $${Math.abs(
                    r.vsMesAnterior.variacion_abs
                  ).toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
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

            <td className="px-4 py-3 text-right text-blue-400">
              ${totalVsMesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ResumenVentasHielo;
