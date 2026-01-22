import React, { useState, useEffect, useMemo } from "react";
import logo from "../../assets/imagen-botellon-v01.png";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import TablaVentasBase from "../../components/ComponentBotellon/TablaVentasBase";
import ResumenVentasCanalUSD from "../../components/ComponentBotellon/ResumenVentasCanalUSD";

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
   🧠 SECCIONES BOTELLÓN
================================ */
const SECCIONES = [
  { key: "DOMICILIO", titulo: "Domicilio", excel: "domicilio" },
  { key: "EMPRESAS", titulo: "Empresas", excel: "empresas" },
  { key: "MAYORISTA", titulo: "Mayorista", excel: "mayorista" },
  { key: "QUITO", titulo: "Quito", excel: "quito" },
  { key: "RURAL", titulo: "Rural", excel: "rural" },
  { key: "TELEVENTA_VIP", titulo: "Televentas VIP", excel: "televentas_vip" },
  { key: "TIENDAS", titulo: "Tiendas", excel: "tiendas" },
  { key: "TIENDAS_VIP", titulo: "Tiendas VIP", excel: "tiendas_vip" },
  { key: "VIP", titulo: "VIP", excel: "vip" },
];

export default function DashboardBotellon() {
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

  /* ================================
     📦 DATA
  ================================ */
  const [botellones, setBotellones] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [mostrarTablas, setMostrarTablas] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  /* ================================
     🔄 CARGA DASHBOARD
  ================================ */
  useEffect(() => {
    cargarDashboard();
  }, [anioSeleccionado, mesSeleccionado]);

  const cargarDashboard = async () => {
    try {
      setCargando(true);

      const res = await fetch(
        `http://localhost:5000/api/botellones/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`
      );
      const json = await res.json();

      setBotellones(json.botellones);
    } catch (error) {
      console.error("❌ Error cargando dashboard botellones", error);
    } finally {
      setCargando(false);
    }
  };

  /* ================================
     💾 PERSISTENCIA FILTROS
  ================================ */
  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  /* ================================
     ⚡ RENDER DIFERIDO TABLAS
  ================================ */
  useEffect(() => {
    if (botellones) {
      const t = setTimeout(() => setMostrarTablas(true), 50);
      return () => clearTimeout(t);
    }
  }, [botellones]);

  /* ================================
     📊 RESUMEN VENTAS USD (OPTIMIZADO)
  ================================ */
  const resumenVentasUSD = useMemo(() => {
    if (!botellones) return null;

    return Object.fromEntries(
      SECCIONES.map((s) => {
        const key = s.key;
        const lowerKey = key.toLowerCase();

        const total = botellones[key]?.total;
        const vs = botellones[key]?.vsMesAnterior;

        return [
          lowerKey,
          {
            monto: total?.dolares ?? 0,
            unidades: total?.unidades ?? 0,
            vsMesAnterior: {
              monto_anterior: vs?.monto_anterior ?? 0,
              variacion_abs: vs?.variacion_abs ?? 0,
              variacion_porc: vs?.variacion_porc ?? 0,
            },
          },
        ];
      })
    );
  }, [botellones]);

  console.log("resumenVentasUSD keys:", Object.keys(resumenVentasUSD || {}));

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-10 py-6 bg-gradient-to-b from-[#162B25] to-[#162B25]">
        <Header />
        {/* ================= HEADER ================= */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-16" alt="Logo" />
            <div>
              <h1 className="text-3xl font-bold">Dashboard Botellones</h1>
              <p className="text-sm text-gray-300">
                Órdenes + Facturas por grupo comercial
              </p>
            </div>
          </div>

          {isAdmin && <BotonActualizarSincronizacion />}

          <div className="flex gap-3">
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
          </div>
        </header>

        {/* ================= OVERLAY CARGA ================= */}
        {cargando && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <span className="animate-pulse text-white">
              Actualizando datos…
            </span>
          </div>
        )}

        {/* ================= RESUMEN USD ================= */}
        {isAdmin && resumenVentasUSD && (
          <ResumenVentasCanalUSD
            titulo="Ventas USD Botellón"
            canales={[
              "domicilio",
              "empresas",
              "mayorista",
              "quito",
              "rural",
              "televenta_vip",
              "tiendas",
              "tiendas_vip",
              "vip",
            ]}
            data={resumenVentasUSD}
          />
        )}

        {/* ================= TABLAS ================= */}
        {mostrarTablas &&
          SECCIONES.map((s) => (
            <TablaVentasBase
              key={s.key}
              titulo={s.titulo}
              data={botellones?.[s.key]?.detalle}
              nombreHojaExcel={s.titulo}
              nombreArchivoExcel={s.excel}
              anio={anioSeleccionado}
              mes={mesSeleccionado}
            />
          ))}

      </div>
    </DashboardLayout>
  );
}
