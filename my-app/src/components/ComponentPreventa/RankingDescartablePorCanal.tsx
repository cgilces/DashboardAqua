import React, { useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from 'react-router-dom'; // Importa useNavigate
import { BsDownload } from "react-icons/bs";
interface VentaDescartable {
  seller_code: string;
  unidades: string | number;
  dolares: string | number;
  meta?: {
    meta_historica: number;
    mes_mayor_consumo: string; // Fecha en formato ISO 8601
  };
  proyeccion?: number;
  vsMesAnterior?: {
    monto_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
}


const RankingDescartablePorCanal = ({
  data,
  anio,
  mes,
}: {
  data: Record<string, VentaDescartable>;  // Cambio aquí: data es un objeto, no un array
  anio: string;
  mes: string;
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Convertir el objeto data en un array
  const [sortedData, setSortedData] = useState<VentaDescartable[]>(
    Object.values(data)  // Convertir a array
  );

  const [sortConfig, setSortConfig] = useState({
    key: "ranking",
    direction: "asc",
  });

  const navigate = useNavigate(); // Usamos useNavigate para navegar

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
  const totalUnidades = sortedData.reduce(
    (a, b) => a + Number(b.unidades || 0),
    0
  );
  const totalUSD = sortedData.reduce(
    (a, b) => a + Number(b.dolares || 0),
    0
  );
  const totalMeta = sortedData.reduce(
    (a, b) => a + (Number(b.meta?.meta_historica) || 0),
    0
  );

  const totalProyeccion = sortedData.reduce(
    (a, b) => a + Number(b.proyeccion || 0),
    0
  );
  const totalVsMesAnterior = sortedData.reduce(
    (a, b) => a + Number(b.vsMesAnterior?.variacion_abs || 0),
    0
  );

  // ============================
  //  ORDENAR
  // ============================
 
const requestSort = (key: keyof VentaDescartable) => {
  let direction = "asc";
  if (sortConfig.key === key && sortConfig.direction === "asc") {
    direction = "desc";
  }

  setSortConfig({ key, direction });

  const sorted = [...sortedData].sort((a, b) => {
    // ORDEN ALFABÉTICO PARA 'seller_code'
    if (key === "seller_code") {
      return direction === "asc"
        ? a.seller_code.localeCompare(b.seller_code)
        : b.seller_code.localeCompare(a.seller_code);
    }

    // 💰 Ordenar por 'vsMesAnterior' usando el campo 'variacion' o 'variacion_abs'
    if (key === "vsMesAnterior") {
      const aVal = a.vsMesAnterior?.variacion_abs || 0;  // Cambié a 'variacion_abs' o 'variacion'
      const bVal = b.vsMesAnterior?.variacion_abs || 0;
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    // ORDENAR EL CAMPO 'meta_historica' dentro de 'meta'
    if (key === "meta") {
      const aVal = Number(a.meta?.meta_historica || 0);  // Acceder a 'meta_historica'
      const bVal = Number(b.meta?.meta_historica || 0);  // Acceder a 'meta_historica'
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    // CAMPOS NUMÉRICOS (para otros campos)
    const aVal = Number(a[key] || 0);
    const bVal = Number(b[key] || 0);
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });

  setSortedData(sorted);
};


  // ============================
  //  EXCEL
  // ============================
  const exportarExcel = () => {
    const datos = sortedData.map((r, i) => ({
      "N°": i + 1,
      Canal: obtenerCanal(r.seller_code),
      Usuario: r.seller_code,
      Unidades: Number(r.unidades),
      USD: Number(r.dolares),
      Meta: Number(r.meta?.meta_historica || 0),
      Proyección: Number(r.proyeccion || 0),
      "Vs Mes Anterior": r.vsMesAnterior?.variacion_abs || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.sheet_add_aoa(
      ws,
      [[`RANKING DESCARTABLE POR CANAL - ${mes}/${anio}`]],
      { origin: "A1" }
    );

    XLSX.utils.sheet_add_json(
      ws,
      [
        {
          "N°": "TOTAL",
          Canal: "",
          Usuario: "",
          Unidades: totalUnidades,
          USD: totalUSD,
          Meta: totalMeta,
          Proyección: totalProyeccion,
          "Vs Mes Anterior": totalVsMesAnterior,
        },
      ],
      { skipHeader: true, origin: -1 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DescartableCanal");
    XLSX.writeFile(
      wb,
      `ranking_descartable_canal_${mes}_${anio}.xlsx`
    );
  };

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      {/* HEADER */}
      <div
        className="
    flex flex-col gap-4
    md:flex-row md:items-center md:justify-between
    mb-4
  "
      >        {/* Título + subtítulo */}
        <div className="flex flex-col text-center md:text-left">
          <h2 className="text-xl font-bold px-4 text-blue-300">
            RANKING DESCARTABLE POR CANAL
          </h2>
          <p className="text-sm px-4 text-green-300 mt-1 tracking-wide">
            · Domicilio · Mayorista · VIP ·
          </p>
        </div>

        {/* Botón exportar */}

        {isAdmin && (
          <div className="flex gap-4 mb-4"> {/* Flexbox para alinear los botones */}
            <button
              onClick={exportarExcel}
              className="
            flex items-center justify-center gap-2
            w-full md:w-auto
            px-4 py-2
            rounded-lg
            border border-[#0db48b]/60
            bg-[#0db48b]/20
            text-white font-semibold
            shadow-md
            hover:bg-[#0db48b]/30
            hover:shadow-lg
            active:scale-[0.98]
            transition-all
          "
            >
              <BsDownload size={16} className="text-white shrink-0" />
              <span>Exportar</span>
            </button>
          </div>
        )}

      </div>


      {/* TABLA */}
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N°</th>
            <th className="px-4 py-3 text-left">Canal</th>
            <th
              onClick={() => requestSort("seller_code")}
              className="px-4 py-3 text-left cursor-pointer select-none"
            >
              Usuario{" "}
              <span className="text-green-300">
                {sortConfig.key === "seller_code"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>

            <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer">Unidades ↕</th>
            <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer">USD ↕</th>
            <th onClick={() => requestSort("meta")} className="px-4 py-3 text-right cursor-pointer">Meta ↕</th>
            <th onClick={() => requestSort("proyeccion")} className="px-4 py-3 text-right cursor-pointer">Proyección ↕</th>
            <th onClick={() => requestSort("vsMesAnterior")} className="px-4 py-3 text-right cursor-pointer">Vs Mes Ant ↕</th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((r, i) => (
            <tr
              key={i}
              onClick={() =>
                navigate(`/ruta2/${r.seller_code}?anio=${anio}&mes=${mes}`)
              }
              className={`${i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] cursor-pointer transition-all duration-200`}
            >
              <td className="px-4 py-2">{i + 1}</td>
              <td className="px-4 py-2 text-green-400 font-bold">{obtenerCanal(r.seller_code)}</td>
              <td className="px-4 py-2 text-blue-300 font-bold">{r.seller_code}</td>
              <td className="px-4 py-2 text-right text-green-400">{Number(r.unidades).toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-blue-300">${Number(r.dolares).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>


              <td className="px-4 py-2 text-right">
                {r.meta
                  ? `${r.meta.meta_historica.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${new Date(r.meta.mes_mayor_consumo).getTime() ? new Date(r.meta.mes_mayor_consumo).toLocaleDateString("es-EC", { month: "long" }) : "Fecha inválida"})`
                  : "–"}
              </td>

              <td className="px-4 py-2 text-right">${Number(r.proyeccion || 0).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>

              <td
                className={`px-4 py-2 text-right font-bold ${(r.vsMesAnterior?.variacion_abs ?? 0) >= 0
                  ? "text-green-400"
                  : "text-red-400"
                  }`}
              >
                {r.vsMesAnterior ? (() => {
                  const abs = Number(r.vsMesAnterior.variacion_abs) || 0;
                  const porc = r.vsMesAnterior.variacion_porc;
                  const signo = abs >= 0 ? "+" : "-";

                  return (
                    <>
                      (
                      {porc !== null
                        ? `${porc >= 0 ? "+" : "-"}${Math.abs(porc).toFixed(1)}%`
                        : "0%"}
                      )
                      {" "}
                      {signo}$
                      {Math.abs(abs).toLocaleString("es-EC", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  );
                })() : "–"}
              </td>


            </tr>
          ))}
        </tbody>

        <tfoot className="bg-[#014434] font-bold">
          <tr>
            <td className="px-4 py-3">TOTAL</td>
            <td colSpan={2}></td>
            <td className="px-4 py-3 text-right text-green-400">{totalUnidades.toLocaleString()}</td>
            <td className="px-4 py-3 text-right text-blue-400">${totalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
            <td className="px-4 py-3 text-right">${totalMeta.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
            <td className="px-4 py-3 text-right">${totalProyeccion.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
            <td className="px-4 py-3 text-right">${totalVsMesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default RankingDescartablePorCanal;
