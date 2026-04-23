import { useNavigate } from "react-router-dom";

interface Props {
  anio: number | string;
  mes: number | string;
  datos?: any;
  esMesActual?: boolean;
}

const money = (v?: number) =>
  v != null
    ? `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
    : "$0,00";

const TablaDomicilioBotellon: React.FC<Props> = ({
  anio,
  mes,
  datos,
  esMesActual = false,
}) => {
  const navigate = useNavigate();
  if (!datos) return null;

  const { total, detalle = [] } = datos;

  const dolares = Number(total?.dolares ?? 0);
  const unidades = Number(total?.unidades ?? 0);
  const numFacturas = Number(total?.numFacturas ?? 0);
  const numOrdenes = Number(total?.numOrdenes ?? 0);

  const mesAnt = Number(total?.mesAnterior?.dolares ?? 0);
  const varAbs = Number(
    total?.mesAnterior?.variacionAbs ?? dolares - mesAnt
  );
  const varPorc = Number(total?.mesAnterior?.variacionPorc ?? 0);

  const proyDolares = detalle.reduce(
    (s: number, r: any) => s + Number(r.proyeccion?.dolares || 0),
    0
  );
  const proyUnidades = detalle.reduce(
    (s: number, r: any) => s + Number(r.proyeccion?.unidades || 0),
    0
  );

  const positivo = varAbs >= 0;

  // ✅ PRECIO PROMEDIO
  const precioProm = unidades > 0 ? dolares / unidades : 0;
  const precioPromedio = (v: number) =>
    v.toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const irClientes = () =>
    navigate(`/domicilio-botellon/clientes/${anio}/${mes}`);

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-6 md:mb-8 overflow-hidden">

      {/* HEADER */}
      <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between px-3 sm:px-4 py-3 sm:py-4">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-green-300">
            DOMICILIO
          </h2>
          <p className="text-xs sm:text-sm text-gray-300">
            Botellones — Canal Domicilio
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 sm:gap-3">
          <Card label="Unidades" value={unidades.toLocaleString("es-EC")} color="text-green-400" />
          <Card label="Dólares" value={money(dolares)} color="text-white" />
          <Card label="Precio Prom." value={`$${precioPromedio(precioProm)}`} color="text-purple-300" />
          <Card label="Proyección" value={money(proyDolares)} color="text-emerald-400" />
          <Card label="Facturas" value={numFacturas.toLocaleString("es-EC")} color="text-blue-300" />
          <Card label="Órdenes" value={numOrdenes.toLocaleString("es-EC")} color="text-blue-300" />
        </div>
      </div>

      {/* TABLA DESKTOP */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">CANAL</th>
              <th className="px-4 py-3 text-right">UNIDADES</th>
              <th className="px-4 py-3 text-right">DÓLARES</th>
              <th className="px-4 py-3 text-right">Precio Promedio</th>
              <th className="px-4 py-3 text-right">PROYECCIÓN UNID.</th>
              <th className="px-4 py-3 text-right">PROYECCIÓN USD $</th>
              <th className="px-4 py-3 text-right">VARIACIÓN</th>
              <th className="px-4 py-3 text-right">%</th>
            </tr>
          </thead>

          <tbody>
            <tr
              onClick={irClientes}
              className="bg-[#013d32] hover:bg-[#025940] cursor-pointer"
            >
              <td className="px-4 py-3 font-bold text-blue-300">
                DOMICILIO BOTELLÓN
              </td>

              <td className="px-4 py-3 text-right text-green-400 font-bold">
                {unidades.toLocaleString("es-EC")}
              </td>

              <td className="px-4 py-3 text-right text-blue-400 font-bold">
                {money(dolares)}
              </td>

              <td className="px-4 py-3 text-right text-purple-400 font-bold">
                {money(precioProm)}
              </td>

              <td className="px-4 py-3 text-right font-bold">
                {proyUnidades.toLocaleString("es-EC")}
              </td>

              <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                {esMesActual ? money(proyDolares) : money(dolares)}
              </td>

              <td
                className={`px-4 py-3 text-right font-bold ${positivo ? "text-green-400" : "text-red-400"
                  }`}
              >
                {varAbs >= 0 ? "+" : "-"}
                {money(Math.abs(varAbs))}
              </td>

              <td
                className={`px-4 py-3 text-right font-bold ${positivo ? "text-green-400" : "text-red-400"
                  }`}
              >
                {varPorc.toFixed(2)}%
              </td>
            </tr>
          </tbody>

          {/* FOOTER */}
          <tfoot className="bg-[#014434] font-bold">
            <tr>
              <td className="px-4 py-3">TOTAL</td>
              <td className="px-4 py-3 text-right">{unidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right">{money(dolares)}</td>
              <td className="px-4 py-3 text-right text-purple-300">
                ${precioPromedio(precioProm)}
              </td>
              <td className="px-4 py-3 text-right">{proyUnidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right">{money(proyDolares)}</td>
              <td className="px-4 py-3 text-right">{money(varAbs)}</td>
              <td className="px-4 py-3 text-right">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MOBILE */}
      <div className="md:hidden px-3 pb-4">
        <button onClick={irClientes} className="w-full bg-[#013d32] p-4 rounded-xl">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Item label="Unidades" value={unidades.toLocaleString("es-EC")} color="text-green-400" />
            <Item label="Dólares" value={money(dolares)} color="text-blue-400" />
            <Item label="Precio Prom." value={`$${precioPromedio(precioProm)}`} color="text-purple-300" />
            <Item label="Proy. Und" value={proyUnidades.toLocaleString("es-EC")} />
            <Item label="Proy. USD" value={money(proyDolares)} color="text-emerald-400" />
          </dl>
        </button>
      </div>
    </div>
  );
};

/* 🔹 Componentes reutilizables */
const Card = ({ label, value, color }: any) => (
  <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`font-bold ${color}`}>{value}</p>
  </div>
);

const Item = ({ label, value, color = "text-white" }: any) => (
  <>
    <dt className="text-gray-400">{label}</dt>
    <dd className={`text-right font-semibold ${color}`}>{value}</dd>
  </>
);

export default TablaDomicilioBotellon;