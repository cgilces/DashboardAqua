import React, { useEffect, useState } from "react";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

import ModalClientesNoVisitados from "../../components/ComponentVisitas/ModalClientesNoVisitados";


/* ================================
   📅 MESES
================================ */
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

/* ================================
   🔢 SORT KEYS
================================ */
type SortKey =
  | "ruta"
  | "planeadas"
  | "visitas"
  | "fuera_ruta"
  | "vendido"
  | "porc_planeado"
  | "porc_fuera_ruta"
  | "porc_vendido";

export default function DashboardRutasVisitas() {
  /* ================================
     📆 FECHAS
  ================================ */
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const [mesSeleccionado, setMesSeleccionado] = useState(
    localStorage.getItem("mesSeleccionado") ?? mesActual.toString()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionado") ?? anioActual.toString()
  );

  // ➕ NUEVO: tipo de período
  const [tipoPeriodo, setTipoPeriodo] = useState<"mes" | "semana" | "dia">("mes");

  // ➕ NUEVO: fecha día
  const [fechaDia, setFechaDia] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // ➕ NUEVO: fecha base para semana
  const [fechaSemana, setFechaSemana] = useState(
    new Date().toISOString().slice(0, 10)
  );

  /* ================================
     📊 DATA
  ================================ */
  const [visitas, setVisitas] = useState<any[]>([]);
  const [sortedData, setSortedData] = useState<any[]>([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarTabla, setMostrarTabla] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "porc_planeado", direction: "desc" });

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  /* ================================
      NUEVO: calcular rango semanal
     (lunes → domingo)
  ================================ */
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

  /* ================================
     🔄 CARGA DASHBOARD
  ================================ */
  useEffect(() => {
    cargarDashboard();
  }, [
    tipoPeriodo,
    mesSeleccionado,
    anioSeleccionado,
    fechaDia,
    fechaSemana,
  ]);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      setMostrarTabla(false);

      let url = "http://localhost:5000/api/visitas/dashboard";

      if (tipoPeriodo === "mes") {
        const fecha = `${anioSeleccionado}-${mesSeleccionado.padStart(2, "0")}`;
        url += `?tipo=mes&fecha=${fecha}`;
      }

      if (tipoPeriodo === "dia") {
        url += `?tipo=dia&fecha=${fechaDia}`;
      }

      // ✅ AJUSTE: semana como espera el backend
      if (tipoPeriodo === "semana") {
        const { inicio, fin } = obtenerRangoSemana(fechaSemana);
        url += `?tipo=semana&inicio=${inicio}&fin=${fin}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      const data = json.data ?? [];
      setVisitas(data);
      setSortedData(data);
    } catch (error) {
      console.error("❌ Error cargando visitas", error);
      setVisitas([]);
      setSortedData([]);
    } finally {
      setCargando(false);
    }
  };

  /* ================================
     ⚡ RENDER DIFERIDO
  ================================ */
  useEffect(() => {
    if (!cargando) {
      const t = setTimeout(() => setMostrarTabla(true), 40);
      return () => clearTimeout(t);
    }
  }, [cargando]);

  /* ================================
     💾 PERSISTENCIA
  ================================ */
  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  /* ================================
     🔃 ORDENAMIENTO
  ================================ */
  const toNumberSafe = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };

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

  /* ================================
     🎨 HELPERS
  ================================ */
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
            <h1 className="text-3xl font-bold ">
              DASHBOARD VISITAS RUTAS
            </h1>
          </div>

          {isAdmin && <BotonActualizarSincronizacion />}

          <div className="flex gap-3 items-center">
            {/*  NUEVO: selector período */}
            <select
              className="bg-[#046C5E] px-4 py-2 rounded-lg"
              value={tipoPeriodo}
              onChange={(e) =>
                setTipoPeriodo(e.target.value as "mes" | "semana" | "dia")
              }
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
          <div className="bg-[#012E24] border border-[#046C5E] ">
            <table className="w-full text-sm">
              <thead className="bg-[#014434] text-green-300 text-xs uppercase">
                <tr>
                  {[
                    ["ruta", "Ruta"],
                    ["planeadas", "Planeadas"],
                    ["visitas", "Visitas"],
                    ["fuera_ruta", "Fuera Ruta"],
                    ["vendido", "Vendido"],
                    ["porc_planeado", "% Planeado"],
                    ["porc_fuera_ruta", "% Fuera Ruta"],
                    ["porc_vendido", "% Vendido"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="px-4 py-3 cursor-pointer text-center"
                      onClick={() => requestSort(key as SortKey)}
                    >
                      {label}{" "}
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
                {sortedData.map((r, index) => (
                  <tr
                    key={r.ruta}
                    onClick={() => setRutaSeleccionada(r)}
                    className={`cursor-pointer transition-all
                      ${index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                      hover:bg-[#016a57]
                      border-l-4 border-transparent hover:border-green-400`}
                  >
                    <td className="px-4 py-2 font-bold">{r.ruta}</td>
                    <td className="px-4 py-2 text-center">{r.planeadas}</td>
                    <td className="px-4 py-2 text-center">{r.visitas}</td>
                    <td className="px-4 py-2 text-center">{r.fuera_ruta}</td>
                    <td className="px-4 py-2 text-center">{r.vendido}</td>

                    <td
                      className={`px-4 py-2 text-center ${colorPorcentaje(
                        Number(r.porc_planeado ?? 0)
                      )}`}
                    >
                      {r.porc_planeado}%
                    </td>

                    <td className="px-4 py-2 text-center text-orange-400">
                      {r.porc_fuera_ruta}%
                    </td>

                    <td className="px-4 py-2 text-center text-cyan-400">
                      {r.porc_vendido}%
                    </td>
                  </tr>
                ))}

                {!sortedData.length && !cargando && (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-400">
                      No hay datos para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}  

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
    </DashboardLayout>
  );
}
