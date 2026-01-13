// import React, { useState, useEffect } from "react";
// import logo from "../../assets/logo.png";
// import { useAuth } from "../../components/auth/AuthContext";
// import RankingPreventas from "../../components/ComponentPreventa/RankingPreventas";
// import TopClientes from "../../components/ComponentPreventa/TopClientes";
// import RankingRutasR from "../../components/ComponentPreventa/RankingRutasR";
// import DashboardLayout from "../../layout/DashboardLayout";
// import GraficoVentaPorProducto from "../../components/ComponentPreventa/GraficoVentaPorProducto";
// import CostoPromedioProductos from "../../components/ComponentPreventa/CostoPromedioProductos";
// import { Header } from "../../components/common/Header";
// import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
// import RankingDescartablePorCanal from "../../components/ComponentPreventa/RankingDescartablePorCanal";

// // Diccionario de meses
// const meses: Record<string, number> = {
//   Enero: 1,
//   Febrero: 2,
//   Marzo: 3,
//   Abril: 4,
//   Mayo: 5,
//   Junio: 6,
//   Julio: 7,
//   Agosto: 8,
//   Septiembre: 9,
//   Octubre: 10,
//   Noviembre: 11,
//   Diciembre: 12,
// };

// export default function DashboardPreventa() {
//   const hoy = new Date();
//   const mesActual = hoy.getMonth() + 1;
//   const anioActual = hoy.getFullYear();

//   const mesGuardado = localStorage.getItem("mesSeleccionado");
//   const anioGuardado = localStorage.getItem("anioSeleccionado");

//   const [mesSeleccionado, setMesSeleccionado] = useState<string>(
//     mesGuardado ?? mesActual.toString()
//   );
//   const [anioSeleccionado, setAnioSeleccionado] = useState<string>(
//     anioGuardado ?? anioActual.toString()
//   );

//   const [datos, setDatos] = useState<any>(null);
//   const [cargando, setCargando] = useState(false);
//   const [topClientesState, setTopClientesState] = useState<any[]>([]);

//   useEffect(() => {
//     if (mesSeleccionado && anioSeleccionado) {
//       obtenerDatos(parseInt(anioSeleccionado), parseInt(mesSeleccionado));
//     }
//   }, [mesSeleccionado, anioSeleccionado]);

//   useEffect(() => {
//     localStorage.setItem("mesSeleccionado", mesSeleccionado);
//     localStorage.setItem("anioSeleccionado", anioSeleccionado);
//   }, [mesSeleccionado, anioSeleccionado]);

//   const obtenerDatos = async (anio: number, mes: number) => {
//     try {
//       setCargando(true);
//       const res = await fetch(
//         `http://localhost:5000/api/ventas/dashboard?anio=${anio}&mes=${mes}`
//       );
//       const data = await res.json();
//       setDatos(data);
//       setTopClientesState(data.topClientes || []);
//     } catch (error) {
//     } finally {
//       setCargando(false);
//     }
//   };

//   const ranking = datos?.rankingPreventas || [];
//   const kpis = datos?.kpisGenerales;
//   const resumen = datos?.resumenGeneral;
//   const comp = datos?.comparativaMesAnterior;

//   const { user } = useAuth();
//   const isVendedor = user?.role === "VENDEDOR";
//   const isAdmin = user?.role === "ADMIN";

//   // ===============================
//   // 🔥 AGREGACIÓN TIENDAS / RURAL
//   // ===============================
//   const agruparCanal = (items: any[], campoMonto: "monto" | "dolares") => {
//     return items.reduce(
//       (acc, item) => {
//         acc.unidades += Number(item.unidades || 0);
//         acc.monto += Number(item.proyeccion || 0);

//         if (item.vsMesAnterior) {
//           acc.mesAnterior += Number(item.vsMesAnterior.monto_anterior || 0);
//           acc.variacionAbs += Number(item.vsMesAnterior.variacion_abs || 0);
//         }

//         return acc;
//       },
//       { unidades: 0, monto: 0, mesAnterior: 0, variacionAbs: 0 }
//     );
//   };

//   const resumenVentasUSD = datos
//     ? {
//       tiendas: (() => {
//         const r = agruparCanal(datos.rankingPreventas || [], "monto");
//         return {
//           ...r,
//           variacionPorc:
//             r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : 0,
//         };
//       })(),
//       rural: (() => {
//         const r = agruparCanal(datos.rankingRutasR || [], "dolares");
//         return {
//           ...r,
//           variacionPorc:
//             r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : 0,
//         };
//       })(),
//     }
//     : null;


//   return (
//     <DashboardLayout>
//       <div className="main-content min-h-screen text-white font-sans px-10 py-6 bg-gradient-to-b from-[#012E24] to-[#014434]">
//         <Header />

//         <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
//           <div className="flex items-center gap-4">
//             <img src={logo} className="h-12" alt="Logo" />
//             <div>
//               <h1 className="text-3xl font-bold">Dashboard de Preventas</h1>
//               <p className="text-sm text-gray-300">
//                 Órdenes, clientes y comparativas
//               </p>
//             </div>
//           </div>

//           <BotonActualizarSincronizacion />

//           <div className="flex gap-3">
//             <select
//               className="bg-[#046C5E] px-4 py-2 rounded-lg"
//               value={mesSeleccionado}
//               onChange={(e) => setMesSeleccionado(e.target.value)}
//             >
//               {Object.entries(meses).map(([n, v]) => (
//                 <option key={n} value={v}>
//                   {n}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="bg-[#046C5E] px-4 py-2 rounded-lg"
//               value={anioSeleccionado}
//               onChange={(e) => setAnioSeleccionado(e.target.value)}
//             >
//               {Array.from({ length: 5 }, (_, i) => {
//                 const y = new Date().getFullYear() - i;
//                 return (
//                   <option key={y} value={y}>
//                     {y}
//                   </option>
//                 );
//               })}
//             </select>
//           </div>
//         </header>

//         {cargando && (
//           <p className="text-center animate-pulse">Cargando datos…</p>
//         )}

//         {datos && !cargando && kpis && (
//           <>
//             {/* ================= CARD VENTAS USD ================= */}
//             {isAdmin && resumenVentasUSD && (
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
//                 <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-6 md:col-span-2">
//                   <h3 className="text-sm text-gray-300 mb-4 uppercase">
//                     Ventas USD
//                   </h3>

//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                     {["tiendas", "rural"].map((canal) => (
//                       <div
//                         key={canal}
//                         className="border border-[#046C5E] rounded-lg p-4"
//                       >
//                         <p className="text-xs text-gray-400 uppercase">
//                           {canal}
//                         </p>

//                         <p className="text-3xl font-bold">
//                           $
//                           {resumenVentasUSD[canal].monto.toLocaleString(
//                             "es-EC",
//                             { minimumFractionDigits: 2 }
//                           )}
//                         </p>

//                         <p className="text-xs text-gray-300">
//                           Mes anterior: $
//                           {resumenVentasUSD[canal].mesAnterior.toLocaleString(
//                             "es-EC"
//                           )}
//                         </p>

//                         <p
//                           className={`text-xs font-semibold ${resumenVentasUSD[canal].variacionAbs >= 0
//                               ? "text-green-400"
//                               : "text-red-400"
//                             }`}
//                         >
//                           Variación:{" "}
//                           {resumenVentasUSD[canal].variacionAbs.toLocaleString()}{" "}
//                           ({resumenVentasUSD[canal].variacionPorc.toFixed(1)}%)
//                         </p>

//                         <p className="text-xs text-gray-300 mt-1">
//                           Unidades:{" "}
//                           {resumenVentasUSD[canal].unidades.toLocaleString()}
//                         </p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {(isVendedor || isAdmin) && (
//               <RankingPreventas datos={datos} />
//             )}

//             {(isVendedor || isAdmin) && (
//               <RankingRutasR data={datos.rankingRutasR} />
//             )}

//             {isAdmin && (
//               <>
//                 <RankingDescartablePorCanal
//                   data={datos.ventasDescartablePorCanal}
//                 />
//                 <CostoPromedioProductos data={datos.precioPromedioTabla} />
//                 <GraficoVentaPorProducto data={datos.ventaPorProducto} />
//                 <TopClientes topClientes={topClientesState} />
//               </>
//             )}
//           </>
//         )}
//       </div>
//     </DashboardLayout>
//   );
// }












import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../components/auth/AuthContext";
import RankingPreventas from "../../components/ComponentPreventa/RankingPreventas";
import TopClientes from "../../components/ComponentPreventa/TopClientes";
import RankingRutasR from "../../components/ComponentPreventa/RankingRutasR";
import DashboardLayout from "../../layout/DashboardLayout";
import GraficoVentaPorProducto from "../../components/ComponentPreventa/GraficoVentaPorProducto";
import CostoPromedioProductos from "../../components/ComponentPreventa/CostoPromedioProductos";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import RankingDescartablePorCanal from "../../components/ComponentPreventa/RankingDescartablePorCanal";
import { API_URL } from "../../config/api";

// Diccionario de meses
const meses: Record<any, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

export default function DashboardPreventa() {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const mesGuardado = localStorage.getItem("mesSeleccionado");
  const anioGuardado = localStorage.getItem("anioSeleccionado");

  const [mesSeleccionado, setMesSeleccionado] = useState<any>(
    mesGuardado ?? mesActual.toString()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState<any>(
    anioGuardado ?? anioActual.toString()
  );

  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [topClientesState, setTopClientesState] = useState<any[]>([]);

  useEffect(() => {
    if (mesSeleccionado && anioSeleccionado) {
      obtenerDatos(parseInt(anioSeleccionado), parseInt(mesSeleccionado));
    }
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  const obtenerDatos = async (anio: number, mes: number) => {
    try {
      setCargando(true);
      const res = await fetch(
        // `${API_URL}/api/ventas/dashboard?anio=${anio}&mes=${mes}`
        `http://localhost:5000/api/ventas/dashboard?anio=${anio}&mes=${mes}`
      );
      const data:any = await res.json();
      setDatos(data);
      setTopClientesState(data.topClientes || []);
    } catch (error) {
    } finally {
      setCargando(false);
    }
  };

  const ranking = datos?.rankingPreventas || [];
  const kpis = datos?.kpisGenerales;
  const resumen = datos?.resumenGeneral;
  const comp = datos?.comparativaMesAnterior;

  const { user } = useAuth();
  const isVendedor = user?.role === "VENDEDOR";
  const isAdmin = user?.role === "ADMIN";

  // ===============================
  // 🔥 AGREGACIÓN TIENDAS / RURAL
  // ===============================
  const agruparCanal = (items: any[], campoMonto: "monto" | "dolares") => {
    return items.reduce(
      (acc, item) => {
        acc.unidades += Number(item.unidades || 0);
        acc.monto += Number(item.proyeccion || 0);

        if (item.vsMesAnterior) {
          acc.mesAnterior += Number(item.vsMesAnterior.monto_anterior || 0);
          acc.variacionAbs += Number(item.vsMesAnterior.variacion_abs || 0);
        }

        return acc;
      },
      { unidades: 0, monto: 0, mesAnterior: 0, variacionAbs: 0 }
    );
  };

  const resumenVentasUSD:any = datos
    ? {
      tiendas: (() => {
        const r = agruparCanal(datos.rankingPreventas || [], "monto");
        return {
          ...r,
          variacionPorc:
            r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : 0,
        };
      })(),
      rural: (() => {
        const r = agruparCanal(datos.rankingRutasR || [], "dolares");
        return {
          ...r,
          variacionPorc:
            r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : 0,
        };
      })(),
    }
    : null;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white font-sans px-10 py-6 bg-gradient-to-b from-[#012E24] to-[#014434]">
        <Header />

        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-12" alt="Logo" />
            <div>
              <h1 className="text-3xl font-bold">Dashboard de Preventas</h1>
              <p className="text-sm text-gray-300">
                Órdenes, clientes y comparativas
              </p>
            </div>
          </div>

          <BotonActualizarSincronizacion />

          <div className="flex gap-3">
            <select
              className="bg-[#046C5E] px-4 py-2 rounded-lg"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            >
              {Object.entries(meses).map(([n, v]) => (
                <option key={n} value={v}>
                  {n}
                </option>
              ))}
            </select>

            <select
              className="bg-[#046C5E] px-4 py-2 rounded-lg"
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {cargando && (
          <p className="text-center animate-pulse">Cargando datos…</p>
        )}

        {datos && !cargando && kpis && (
          <>
            {/* ================= CARD VENTAS USD ================= */}
            {isAdmin && resumenVentasUSD && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-6 md:col-span-2">
                  <h3 className="text-sm text-gray-300 mb-4 uppercase">
                    Ventas USD
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {["tiendas", "rural"].map((canal) => (
                      <div
                        key={canal}
                        className="border border-[#046C5E] rounded-lg p-4"
                      >
                        <p className="text-xs text-gray-400 uppercase">
                          {canal}
                        </p>

                        <p className="text-3xl font-bold">
                          $
                          {resumenVentasUSD[canal].monto.toLocaleString(
                            "es-EC",
                            { minimumFractionDigits: 2 }
                          )}
                        </p>

                        <p className="text-xs text-gray-300">
                          Mes anterior: $
                          {resumenVentasUSD[canal].mesAnterior.toLocaleString(
                            "es-EC"
                          )}
                        </p>

                        <p
                          className={`text-xs font-semibold ${resumenVentasUSD[canal].variacionAbs >= 0
                              ? "text-green-400"
                              : "text-red-400"
                            }`}
                        >
                          Variación:{" "}
                          {resumenVentasUSD[canal].variacionAbs.toLocaleString()}{" "}
                          ({resumenVentasUSD[canal].variacionPorc.toFixed(1)}%)
                        </p>

                        <p className="text-xs text-gray-300 mt-1">
                          Unidades:{" "}
                          {resumenVentasUSD[canal].unidades.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(isVendedor || isAdmin) && (
              <RankingPreventas datos={datos} anio={""} mes={""} />
            )}

            {(isVendedor || isAdmin) && (
              <RankingRutasR data={datos.rankingRutasR} anio={""} mes={""} />
            )}

            {isAdmin && (
              <>
                <RankingDescartablePorCanal data={datos.ventasDescartablePorCanal} anio={""} mes={""}/>
                <CostoPromedioProductos data={datos.precioPromedioTabla} />
                <GraficoVentaPorProducto data={datos.ventaPorProducto} />
                <TopClientes topClientes={topClientesState} />
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
