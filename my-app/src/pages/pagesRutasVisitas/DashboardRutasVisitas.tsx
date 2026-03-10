import React, { useEffect, useState } from "react";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonRutasyDetalles from "../../components/elements/BotonRutasyDetalles";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ModalClientesNoVisitados from "../../components/ComponentVisitas/ModalClientesNoVisitados";
import BotonHistorialRutas from "../../components/elements/BotonHistorialRutas";
import { API_BASE_URL } from '../../config';


const meses: Record<string, number> = {
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

type SortKey =
  | "ruta"
  | "totalPlaneado"
  | "totalVisitado"
  | "porcentajePlaneado"
  | "porcentajeFueraRuta"
  | "porcentajeVendido";

export default function DashboardRutasVisitas() {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  // Estado para almacenar el mes y año seleccionado, tipo de periodo, fechas, visitas, etc.
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    localStorage.getItem("mesSeleccionado") ?? mesActual.toString()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState<string>(
    localStorage.getItem("anioSeleccionado") ?? anioActual.toString()
  );

  const [tipoPeriodo, setTipoPeriodo] = useState<"mes" | "semana" | "dia">("mes");
  const [fechaDia, setFechaDia] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fechaSemana, setFechaSemana] = useState<string>(new Date().toISOString().slice(0, 10));

  // Estado para las visitas y los datos ordenados
  const [visitas, setVisitas] = useState<any[]>([]);
  const [sortedData, setSortedData] = useState<any[]>([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarTabla, setMostrarTabla] = useState(false);

  // Estado para configuración de ordenación
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "porcentajePlaneado", direction: "desc" });

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Función para obtener el rango de fechas de una semana
  const obtenerRangoSemana = (fecha: string) => {
    const d = new Date(fecha);
    const day = d.getDay(); // 0 domingo
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    const lunes = new Date(d.setDate(diff));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 7);

    return {
      inicio: lunes.toISOString().slice(0, 10),
      fin: domingo.toISOString().slice(0, 10),
    };
  };

  // Función que se ejecuta cuando cambian las dependencias de useEffect
  useEffect(() => {
    cargarDashboard();
  }, [
    tipoPeriodo,
    mesSeleccionado,
    anioSeleccionado,
    fechaDia,
    fechaSemana,
  ]);

  // Cargar los datos del dashboard
  const cargarDashboard = async () => {
    try {
      setCargando(true);
      setMostrarTabla(false);

      let url = `${API_BASE_URL}/api/visitas/dashboard`;
      if (tipoPeriodo === "mes") {
        const mes = mesSeleccionado.padStart(2, "0");

        const ultimoDia = new Date(
          Number(anioSeleccionado),
          Number(mes),
          0
        ).getDate();

        const fechaInicio = `${anioSeleccionado}-${mes}-01`;
        const fechaFin = `${anioSeleccionado}-${mes}-${ultimoDia}`;

        url += `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&tipoFiltro=mes`;
      }
      if (tipoPeriodo === "dia") {
        url += `?fechaInicio=${fechaDia}&fechaFin=${fechaDia}&tipoFiltro=dia`;
      }
      if (tipoPeriodo === "semana") {
        const { inicio, fin } = obtenerRangoSemana(fechaSemana);
        url += `?fechaInicio=${inicio}&fechaFin=${fin}&tipoFiltro=semana`;
      }

      console.log("🔍 URL generada:", url);

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Error backend:", text);
        throw new Error(text);
      }

      const json = await res.json();

      console.log("📊 Datos recibidos:", json);  // Verifica los datos recibidos

      const data = json ?? []; // Asegurémonos de que json contenga los datos, si no, asignamos un array vacío
      setVisitas(data);
      setSortedData(data);  // Asegúrate de que data está siendo asignada correctamente
    } catch (error) {
      console.error("❌ Error cargando visitas", error);
      setVisitas([]);
      setSortedData([]);
    } finally {
      setCargando(false);
    }
  };



  // Mostrar la tabla solo cuando se haya terminado de cargar
  useEffect(() => {
    if (!cargando) {
      const t = setTimeout(() => setMostrarTabla(true), 40);
      return () => clearTimeout(t);
    }
  }, [cargando]);



  // Guardar en localStorage el mes y año seleccionado
  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  // Función para asegurar que los valores sean numéricos y no nulos
  const toNumberSafe = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };

  // Función para ordenar las columnas de la tabla
  const requestSort = (key: SortKey) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc"
        ? "desc"
        : "asc";

    setSortConfig({ key, direction });

    const sorted = [...sortedData].sort((a, b) => {
      if (key === "ruta") {
        return direction === "asc"
          ? String(a.ruta).localeCompare(String(b.ruta))
          : String(b.ruta).localeCompare(String(a.ruta));
      }

      const aNum = toNumberSafe(a[key]);
      const bNum = toNumberSafe(b[key]);
      return direction === "asc" ? aNum - bNum : bNum - aNum;
    });

    setSortedData(sorted);
  };

  // Función para agregar color según el porcentaje de visitas
  const colorPorcentaje = (v: number) => {
    if (v >= 90) return "text-green-400 font-bold";
    if (v < 70) return "text-red-400 font-bold";
    return "text-yellow-400 font-semibold";
  };

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-10 py-6">
        <Header />

        {/* ================= HEADER ================= */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-5">
          <div className="flex items-center gap-4">
            <LocalShippingIcon sx={{ fontSize: 48 }} />
            <h1 className="text-3xl font-bold">DASHBOARD VISITAS RUTAS</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            {isAdmin && (
              <div className="w-full sm:w-auto">
                <BotonRutasyDetalles />
              </div>
            )}
            {isAdmin && (
              <div className="w-full sm:w-auto">
                <BotonHistorialRutas />
              </div>
            )}
          </div>


          <div className="flex gap-3 items-center">
            {/* Selector de periodo */}
            <select
              className="bg-[#046C5E] px-4 py-2 rounded-lg"
              value={tipoPeriodo}
              onChange={(e) => setTipoPeriodo(e.target.value as "mes" | "semana" | "dia")}
            >
              <option value="mes">Mes</option>
              <option value="semana">Semana</option>
              <option value="dia">Día</option>
            </select>

            {tipoPeriodo === "mes" && (
              <>
                <select
                  className="bg-[#046C5E] px-4 py-2 rounded-lg"
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                >
                  {Object.entries(meses).map(([nombre, valor]) => (
                    <option key={valor} value={valor}>
                      {nombre}
                    </option>
                  ))}
                </select>

                <select
                  className="bg-[#046C5E] px-4 py-2 rounded-lg"
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(e.target.value)}
                >
                  {Array.from({ length: 5 }, (_, i) => anioActual + 1 - i).map(
                    (anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    )
                  )}
                </select>
              </>
            )}

            {tipoPeriodo === "semana" && (
              <input
                type="date"
                className="bg-[#046C5E] px-4 py-2 rounded-lg"
                value={fechaSemana}
                onChange={(e) => setFechaSemana(e.target.value)}
              />
            )}

            {tipoPeriodo === "dia" && (
              <input
                type="date"
                className="bg-[#046C5E] px-4 py-2 rounded-lg"
                value={fechaDia}
                onChange={(e) => setFechaDia(e.target.value)}
              />
            )}
          </div>
        </header>

        {/* ================= LOADING ================= */}
        {cargando && (
          <div className="text-center py-16 text-gray-300 animate-pulse">
            Cargando dashboard de visitas…
          </div>
        )}

        {/* ================= TABLA ================= */}
        {mostrarTabla && (
          <div className="bg-[#012E24] border border-[#046C5E]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                <tr>
                  {[
                    ["n", "N°"],
                    ["ruta", "Ruta"],
                    ["totalPlaneado", "Planeadas"],
                    ["totalVisitado", "Visitadas"],
                    ["fueraDeRuta", "Fuera de Ruta"],
                    ["porcentajeVendido", "Vendido"],
                    ["porcentajePlaneado", "% Planeado"],
                    ["porcentajeFueraRuta", "% Fuera de Ruta"],
                    ["porcentajeVendido", "% Vendido"],
                  ].map(([key, label], index) => (
                    <th
                      key={`${key}-${index}`}  // Aquí se usa un índice para asegurarse de que las claves sean únicas
                      className="px-4 py-3 text-center cursor-pointer hover:text-white transition-colors select-none min-w-[150px]"
                      onClick={() => requestSort(key)}
                    >
                      {label}
                      <span className="text-green-300">
                        {sortConfig.key === key
                          ? sortConfig.direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedData.map((ruta, index) => (
                  <tr
                    key={ruta.ruta}
                    onClick={() => setRutaSeleccionada(ruta)}   // 🔥 IMPORTANTE
                    className={`cursor-pointer transition-all
        ${index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
        hover:bg-[#016a57]
        border-l-4 border-transparent hover:border-green-400`}
                  >
                    <td className="px-4 py-2 text-center font-bold">
                      {index + 1}
                    </td>

                    <td className="px-4 py-2 text-center text-blue-300 font-bold">
                      {ruta.ruta}
                    </td>

                    <td className="px-4 py-2 text-center font-bold">
                      {ruta.totalPlaneado}
                    </td>

                    <td className="px-4 py-2 text-center font-bold">
                      {ruta.totalVisitado}
                    </td>

                    <td className="px-4 py-2 text-center font-bold">
                      {ruta.fueraDeRuta}
                    </td>

                    <td className="px-4 py-2 text-center font-bold">
                      {ruta.vendido}
                    </td>

                    <td className="px-4 py-2 text-center">
                      {ruta.porcentajePlaneado?.toFixed(2)}%
                    </td>

                    <td className="px-4 py-2 text-center">
                      {ruta.porcentajeFueraRuta?.toFixed(2)}%
                    </td>

                    <td className="px-4 py-2 text-center">
                      {ruta.porcentajeVendido?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

            {rutaSeleccionada && (
              <ModalClientesNoVisitados
                ruta={rutaSeleccionada.ruta}
                tipoPeriodo={tipoPeriodo}
                fechaDia={fechaDia}
                fechaSemana={fechaSemana}
                mesSeleccionado={mesSeleccionado}
                anioSeleccionado={anioSeleccionado}
                onClose={() => setRutaSeleccionada(null)}
              />
            )}

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
