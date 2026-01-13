import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import TablaBotellonGrupo from "../../components/ComponentBotellon/TablaBotellonGrupo";
import TablaClientesBotellon from "../../components/ComponentBotellon/TablaClientesBotellon";

export default function BotellonesPorGrupo() {
  const { grupo } = useParams();
  const [params] = useSearchParams();

  const anio = params.get("anio");
  const mes = params.get("mes");

  const [datosGrupo, setDatosGrupo] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  // ==========================
  // CLIENTES BOTELLÓN
  // ==========================
  const [clientesRuta, setClientesRuta] = useState<any[]>([]);
  const [clientesPagina, setClientesPagina] = useState<any[]>([]);

  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [filtroConsumo, setFiltroConsumo] = useState("Todos");

  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 10;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "nombre_cliente",
    direction: "asc",
  });

  // ==========================
  // CARGAR RESUMEN DEL GRUPO
  // ==========================
  useEffect(() => {
    if (!grupo || !anio || !mes) return;

    const cargarGrupo = async () => {
      try {
        setCargando(true);
        const res = await fetch(
          `http://localhost:5000/api/botellones/dashboard?anio=${anio}&mes=${mes}`
        );
        const data = await res.json();

        // 🔥 AQUÍ está la clave
        setDatosGrupo(data?.botellones?.[grupo] ?? null);
      } catch (error) {
        console.error("Error cargando grupo:", error);
        setDatosGrupo(null);
      } finally {
        setCargando(false);
      }
    };

    cargarGrupo();
  }, [grupo, anio, mes]);

  // ==========================
  // CARGAR CLIENTES DEL GRUPO
  // ==========================
  useEffect(() => {
    if (!grupo || !anio || !mes) return;

    const cargarClientes = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/botellones/clientes?grupo=${grupo}&anio=${anio}&mes=${mes}`
        );
        const data = await res.json();

        // ✅ protección total
        // setClientesRuta(Array.isArray(data) ? data : []);
        setClientesRuta(Array.isArray(data?.clientes) ? data.clientes : []);

        setPaginaActual(1);
      } catch (error) {
        console.error("Error cargando clientes:", error);
        setClientesRuta([]);
      }
    };

    cargarClientes();
  }, [grupo, anio, mes]);

  // ==========================
  // ORDENAMIENTO
  // ==========================
  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // ==========================
  // FILTRO + ORDEN + PAGINACIÓN
  // ==========================
  useEffect(() => {
    if (!Array.isArray(clientesRuta)) {
      setClientesPagina([]);
      return;
    }

    let data = [...clientesRuta];

    // 🔍 búsqueda
    if (terminoBusqueda) {
      data = data.filter(c =>
        c.nombre_cliente
          ?.toLowerCase()
          .includes(terminoBusqueda.toLowerCase())
      );
    }

    // 🎯 filtro consumo
    if (filtroConsumo !== "Todos") {
      data = data.filter(c => c.tuvo_consumo === filtroConsumo);
    }

    // 🔃 ordenamiento
    data.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });

    // 📄 paginación
    const inicio = (paginaActual - 1) * filasPorPagina;
    const fin = inicio + filasPorPagina;
    setClientesPagina(data.slice(inicio, fin));
  }, [
    clientesRuta,
    terminoBusqueda,
    filtroConsumo,
    sortConfig,
    paginaActual,
  ]);

  const totalPaginas = Math.ceil(
    (clientesRuta?.length || 0) / filasPorPagina
  );

  // ==========================
  // RENDER
  // ==========================
  return (
    <DashboardLayout>
      <div className="main-content min-h-screen px-10 py-6 bg-gradient-to-b from-[#012E24] to-[#014434] text-white">
        <Header />

        {/* ===== HEADER ===== */}
        <div className="flex justify-between items-center mb-6 border-b border-[#046C5E] pb-4">
          <div>
            <h1 className="text-3xl font-bold">
              Botellones – {grupo?.replace("_", " ")}
            </h1>
            <p className="text-sm text-gray-300">
              Detalle · {mes}/{anio}
            </p>
          </div>

          <Link
            to="/dashboard/botellon"
            className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73]"
          >
            ← Volver al Dashboard
          </Link>
        </div>

        {cargando && <p className="text-center">Cargando…</p>}

        {/* ==========================
            RESUMEN BOTELLONES POR RUTA
        ========================== */}
        {!cargando && datosGrupo?.detalle && (
          <div className="max-w-[1200px] mx-auto mb-12">
            <TablaBotellonGrupo
              titulo={grupo!.replace("_", " ")}
              data={datosGrupo.detalle}
              total={datosGrupo.total}
            />
          </div>
        )}

        {/* ==========================
            TABLA CLIENTES BOTELLÓN
        ========================== */}
        {!cargando && clientesRuta.length > 0 && (
          <TablaClientesBotellon
            clientesRuta={clientesRuta}
            clientesPagina={clientesPagina}
            terminoBusqueda={terminoBusqueda}
            setTerminoBusqueda={setTerminoBusqueda}
            filtroConsumo={filtroConsumo}
            setFiltroConsumo={setFiltroConsumo}
            exportarClientesRuta={() =>
              console.log("Exportar clientes sin consumo")
            }
            sortConfig={sortConfig}
            requestSort={requestSort}
            paginaActual={paginaActual}
            totalPaginas={totalPaginas}
            setPaginaActual={setPaginaActual}
          />
        )}

        {!cargando && clientesRuta.length === 0 && (
          <p className="text-center text-gray-400 mt-10">
            No existen clientes para este grupo
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
