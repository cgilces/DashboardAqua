import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { BsDownload, BsGear } from "react-icons/bs";

const RankingRutasR = ({
  data,
  anio,
  mes
}: {
  data: any[];
  anio: string;
  mes: string;
}) => {
  const { user } = useAuth();

  const isVendedor = user?.role === "VENDEDOR";

  // 🔐 Calcular filas visibles ANTES de los hooks
  const dataFiltrada = isVendedor
    ? (data || []).filter((r) => r.usuario === user?.username)
    : data || [];

  // ✅ Ocultar tabla si no hay datos o si el VENDEDOR no tiene filas aquí
  if (!data || data.length === 0 || (isVendedor && dataFiltrada.length === 0)) {
    return null;
  }

  return <RankingRutasInner data={data} anio={anio} mes={mes} user={user} dataFiltrada={dataFiltrada} />;
};

const RankingRutasInner = ({
  data,
  anio,
  mes,
  user,
  dataFiltrada,
}: {
  data: any[];
  anio: string;
  mes: string;
  user: any;
  dataFiltrada: any[];
}) => {
  const navigate = useNavigate();
  const isVendedor = user?.role === "VENDEDOR";
  const isAdmin = user?.role === "ADMIN";

  const [sortConfig, setSortConfig] = useState({ key: 'N*', direction: 'asc' });
  const [sortedData, setSortedData] = useState(dataFiltrada);

  // ============================
  // 🔢 CALCULO DE TOTALES
  // ============================
  const totalUnidades = sortedData.reduce((acc, r) => acc + Number(r.unidades || 0), 0);
  const totalUSD = sortedData.reduce((acc, r) => acc + Number(r.dolares || 0), 0);
  const totalMeta = sortedData.reduce((acc, r) => acc + Number(r.meta || 0), 0);
  const totalCupo = sortedData.reduce((acc, r) => acc + Number(r.objetivo_gerencia || 0), 0);
  const totalProyeccion = sortedData.reduce((acc, r) => acc + Number(r.proyeccion || 0), 0);
  const totalVsMesAnterior = sortedData.reduce((acc, r) => acc + (r.vsMesAnterior?.variacion_abs || 0), 0);

  const precioPromedioTotal =
    totalUnidades > 0 ? totalUSD / totalUnidades : 0;

  const exportarTablaExcel = () => {
    if (!sortedData || sortedData.length === 0) return;

    try {
      const rutaUpper = "Ranking Rutas";

      type ExcelRow = {
        "N*": number;
        Usuario: string;
        Unidades: string;
        Dólares: string;
        Meta: string;
        Proyección: string;
        "Vs Mes Anterior": string;
      };

      const datosExportar: ExcelRow[] = sortedData.map((r, index) => ({
        "N*": index + 1,
        Usuario: r.usuario,
        Unidades: r.unidades?.toLocaleString() ?? "0",
        Dólares: r.dolares?.toLocaleString("es-EC", { minimumFractionDigits: 2 }) ?? "0.00",
        Meta: r.meta?.toLocaleString("es-EC", { minimumFractionDigits: 2 }) ?? "0.00",
        Proyección: r.proyeccion?.toLocaleString("es-EC", { minimumFractionDigits: 2 }) ?? "0.00",
        "Vs Mes Anterior":
          r.vsMesAnterior?.variacion_abs?.toLocaleString("es-EC", {
            minimumFractionDigits: 2,
          }) ?? "Sin datos",
      }));

      const ws = XLSX.utils.json_to_sheet(datosExportar);
      const titulo = [`RANKING RUTAS - ${rutaUpper} - ${mes}/${anio}`];
      XLSX.utils.sheet_add_aoa(ws, [titulo], { origin: "A1" });

      const filaTotales = {
        "Ranking": "Total",
        "Usuario": "",
        "Unidades": totalUnidades.toLocaleString(),
        "Dólares": totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Meta": totalMeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Proyección": totalProyeccion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Vs Mes Anterior": totalVsMesAnterior.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      };

      XLSX.utils.sheet_add_json(ws, [filaTotales], { skipHeader: true, origin: -1 });

      const columnas = Object.keys(datosExportar[0]) as (keyof ExcelRow)[];
      ws["!cols"] = columnas.map((col) => {
        const maxLong = Math.max(
          col.length,
          ...datosExportar.map((row) => String(row[col]).length)
        );
        return { wch: maxLong + 4 };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RankingRutas");

      const nombreArchivo = `ranking_rutas_${rutaUpper}_${mes}_${anio}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo, { compression: true });

    } catch (error) {
      console.error("❌ Error exportando Excel:", error);
    }
  };

  const requestSort = (key: any) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sorted = [...dataFiltrada].sort((a, b) => {
      const aValue = key === 'vsMesAnterior'
        ? a[key]?.monto_anterior
        : a[key];

      const bValue = key === 'vsMesAnterior'
        ? b[key]?.monto_anterior
        : b[key];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    setSortedData(sorted);
  };

  const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString("es-EC");

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          RANKING R - DESCARTABLE
        </h2>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-green-400">{fmtInt(totalUnidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${fmt(totalUSD)}</p>
          </div>

          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Precio Promedio</p>
            <p className="text-base font-bold text-yellow-300">
              ${fmt(precioPromedioTotal)}
            </p>
          </div>


          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Meta</p>
            <p className="text-base font-bold text-white">${fmt(totalMeta)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Proyección</p>
            <p className="text-base font-bold text-emerald-400">${fmt(totalProyeccion)}</p>
          </div>
          {totalCupo > 0 && (
            <div className="bg-[#011f1a] border border-amber-500/40 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-amber-400">Cupo</p>
              <p className="text-base font-bold text-amber-300">${fmt(totalCupo)}</p>
            </div>
          )}
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
              onClick={exportarTablaExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
            >
              <BsDownload size={16} />
              <span>Exportar</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('N*')}>
                N* <span className="text-green-300">{sortConfig.key === 'N*' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('usuario')}>
                Usuario <span className="text-green-300">{sortConfig.key === 'usuario' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('unidades')}>
                Unidades <span className="text-green-300">{sortConfig.key === 'unidades' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('dolares')}>
                Dólares <span className="text-green-300">{sortConfig.key === 'dolares' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>

              <th className="px-4 py-3 text-right">
                Precio Promedio
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none text-amber-300" onClick={() => requestSort('objetivo_gerencia')}>
                CUPO <span className="text-amber-300">{sortConfig.key === 'objetivo_gerencia' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('proyeccion')}>
                Proyección <span className="text-green-300">{sortConfig.key === 'proyeccion' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('vsMesAnterior')}>
                Variación <span className="text-green-300">{sortConfig.key === 'vsMesAnterior' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => requestSort('vsMesAnterior')}>
                % <span className="text-green-300">{sortConfig.key === 'vsMesAnterior' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedData.map((r, index) => {
              const cupo = Number(r.objetivo_gerencia || 0);
              const proy = Number(r.proyeccion || 0);
              const variacionAbs = proy - cupo;
              const variacionPorc = cupo > 0 ? (variacionAbs / cupo) * 100 : 0;
              const tieneCupo = cupo > 0;

              return (
                <tr
                  key={index}
                  onClick={() => navigate(`/detalle-ruta/${r.usuario}/${anio}/${mes}`, {
                    state: {
                      objetivo_gerencia: r.objetivo_gerencia,
                      objetivo_gerencia_unidades: r.objetivo_gerencia_unidades,
                      proyeccion: r.proyeccion,
                      monto: r.dolares,
                      meta: r.meta,
                    }
                  })}
                  className={`transition-all duration-200 cursor-pointer
                ${index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                hover:bg-[#025940] hover:shadow-lg hover:text-white
                border-l-4 border-transparent hover:border-green-400
              `}
                >
                  <td className="px-4 py-2 font-medium text-gray-100">{index + 1}</td>
                  <td className="px-4 py-2 text-blue-300 font-bold">{r.usuario}</td>
                  <td className="px-4 py-2 text-right text-green-400 font-bold">
                    {Number(r.unidades).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-blue-300 font-bold">
                    ${Number(r.dolares).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-right text-yellow-300 font-bold">
                    ${fmt(
                      Number(r.unidades) > 0
                        ? Number(r.dolares) / Number(r.unidades)
                        : 0
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-amber-300">
                    {tieneCupo ? `$${fmt(cupo)}` : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-blue-300">
                    ${proy.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                  </td>
                  {/* VARIACIÓN */}
                  <td className={`px-4 py-2 text-right font-bold ${!tieneCupo ? "text-gray-400" : variacionAbs < 0 ? "text-red-400" : variacionAbs > 0 ? "text-green-400" : "text-gray-400"}`}>
                    {!tieneCupo
                      ? <span className="text-gray-500 text-xs italic">—</span>
                      : <>{variacionAbs > 0 ? "+" : "-"}${Math.abs(variacionAbs).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                    }
                  </td>
                  {/* % */}
                  <td className={`px-4 py-2 text-right font-bold ${!tieneCupo ? "text-gray-400" : variacionPorc < 0 ? "text-red-400" : variacionPorc > 0 ? "text-green-400" : "text-gray-400"}`}>
                    {!tieneCupo
                      ? <span className="text-gray-500 text-xs italic">—</span>
                      : <>{variacionPorc > 0 ? "+" : ""}{variacionPorc.toFixed(2)}%</>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
            <tr>
              <td className="px-4 py-3 text-left">Total</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right text-green-400">{totalUnidades.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-blue-400">
                ${totalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right text-yellow-300">
                ${fmt(precioPromedioTotal)}
              </td>
              <td className="px-4 py-3 text-right text-amber-300">
                {totalCupo > 0 ? `$${fmt(totalCupo)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right text-blue-400">
                ${totalProyeccion.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              {(() => {
                const totalVar = totalProyeccion - totalCupo;
                return (
                  <td className={`px-4 py-3 text-right ${totalVar >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalCupo > 0
                      ? <>{totalVar >= 0 ? "+" : "-"}${Math.abs(totalVar).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                );
              })()}
              <td className="px-4 py-3 text-right text-gray-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default RankingRutasR;