import { useNavigate } from "react-router-dom";

interface Props {
  anio: number | string;
  mes: number | string;
  datos?: any;
  esMesActual?: boolean;
}

const money = (v?: number) =>
  v != null ? `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` : "$0,00";

const TablaQuitoBotellon: React.FC<Props> = ({ anio, mes, datos, esMesActual = false }) => {
  const navigate = useNavigate();
  if (!datos) return null;

  const { total, detalle = [] } = datos;
  const dolares = Number(total?.dolares ?? 0);
  const unidades = Number(total?.unidades ?? 0);
  const numFacturas = Number(total?.numFacturas ?? 0);
  const numOrdenes = Number(total?.numOrdenes ?? 0);
  const mesAnt = Number(total?.mesAnterior?.dolares ?? 0);
  const varAbs = Number(total?.mesAnterior?.variacionAbs ?? (dolares - mesAnt));
  const varPorc = Number(total?.mesAnterior?.variacionPorc ?? 0);
  const proyDolares = detalle.reduce((s: number, r: any) => s + Number(r.proyeccion?.dolares || 0), 0);
  const proyUnidades = detalle.reduce((s: number, r: any) => s + Number(r.proyeccion?.unidades || 0), 0);
  const positivo = varAbs >= 0;

  if (unidades === 0 && dolares === 0 && proyDolares === 0) return null;

  const irClientes = () => navigate(`/quito-botellon/clientes/${anio}/${mes}`);

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-6 md:mb-8 overflow-hidden">
      <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-green-300 leading-tight">QUITO</h2>
          <p className="text-xs sm:text-sm text-gray-300">Botellones — Canal Quito (MobilVendor U1 + Odoo)</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 sm:gap-3 items-stretch">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-2 sm:px-3 py-2 text-center">
            <p className="text-[10px] sm:text-xs text-gray-400">Unidades</p>
            <p className="text-sm sm:text-base font-bold text-green-400 break-all">{unidades.toLocaleString("es-EC")}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-2 sm:px-3 py-2 text-center">
            <p className="text-[10px] sm:text-xs text-gray-400">Dólares</p>
            <p className="text-sm sm:text-base font-bold text-white break-all">{money(dolares)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-2 sm:px-3 py-2 text-center">
            <p className="text-[10px] sm:text-xs text-gray-400">Proyección</p>
            <p className="text-sm sm:text-base font-bold text-emerald-400 break-all">{money(proyDolares)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-2 sm:px-3 py-2 text-center">
            <p className="text-[10px] sm:text-xs text-gray-400">Facturas</p>
            <p className="text-sm sm:text-base font-bold text-blue-300">{numFacturas.toLocaleString("es-EC")}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-2 sm:px-3 py-2 text-center">
            <p className="text-[10px] sm:text-xs text-gray-400">Órdenes</p>
            <p className="text-sm sm:text-base font-bold text-blue-300">{numOrdenes.toLocaleString("es-EC")}</p>
          </div>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto scroll-x-thin">
        <table className="min-w-full text-sm">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">CANAL</th>
              <th className="px-4 py-3 text-right">UNIDADES</th>
              <th className="px-4 py-3 text-right">DÓLARES</th>
              <th className="px-4 py-3 text-right">PROYECCIÓN UNID.</th>
              <th className="px-4 py-3 text-right">PROYECCIÓN USD $</th>
              <th className="px-4 py-3 text-right">VARIACIÓN</th>
              <th className="px-4 py-3 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              onClick={irClientes}
              className="bg-[#013d32] hover:bg-[#025940] cursor-pointer transition-all duration-200
                         border-l-4 border-transparent hover:border-green-400 hover:shadow-lg"
            >
              <td className="px-4 py-3 font-bold text-blue-300">
                QUITO BOTELLÓN
                <span className="ml-2 text-[10px] text-gray-400 font-normal italic">Ver clientes →</span>
              </td>
              <td className="px-4 py-3 text-right text-green-400 font-bold">{unidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right text-blue-400 font-bold">{money(dolares)}</td>
              <td className="px-4 py-3 text-right text-gray-300">{proyUnidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                {esMesActual ? money(proyDolares) : money(dolares)}
              </td>
              <td className={`px-4 py-3 text-right font-bold ${positivo ? "text-green-400" : "text-red-400"}`}>
                {varAbs >= 0 ? "+" : "-"}{money(Math.abs(varAbs))}
              </td>
              <td className={`px-4 py-3 text-right font-bold ${positivo ? "text-green-400" : "text-red-400"}`}>
                {varPorc >= 0 ? "+" : ""}{varPorc.toFixed(2)}%
              </td>
            </tr>
          </tbody>
          <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
            <tr>
              <td className="px-4 py-3 text-white">TOTAL GENERAL</td>
              <td className="px-4 py-3 text-right text-blue-300">{unidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right text-blue-300">{money(dolares)}</td>
              <td className="px-4 py-3 text-right text-blue-300">{proyUnidades.toLocaleString("es-EC")}</td>
              <td className="px-4 py-3 text-right text-blue-300">{esMesActual ? money(proyDolares) : money(dolares)}</td>
              <td className={`px-4 py-3 text-right ${positivo ? "text-green-400" : "text-red-400"}`}>
                {varAbs >= 0 ? "+" : "-"}{money(Math.abs(varAbs))}
              </td>
              <td className="px-4 py-3 text-right text-gray-400">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="md:hidden px-3 pb-4">
        <button
          onClick={irClientes}
          className="w-full bg-[#013d32] hover:bg-[#025940] active:bg-[#02492f] transition
                     border border-[#046C5E] rounded-xl p-4 text-left"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-blue-300 text-sm">QUITO BOTELLÓN</span>
            <span className="text-[10px] text-emerald-300 italic">Ver clientes →</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-gray-400">Unidades</dt>
            <dd className="text-right text-green-400 font-semibold">{unidades.toLocaleString("es-EC")}</dd>
            <dt className="text-gray-400">Dólares</dt>
            <dd className="text-right text-blue-400 font-semibold">{money(dolares)}</dd>
            <dt className="text-gray-400">Proy. Unid.</dt>
            <dd className="text-right text-gray-200">{proyUnidades.toLocaleString("es-EC")}</dd>
            <dt className="text-gray-400">Proy. USD</dt>
            <dd className="text-right text-emerald-400 font-semibold">
              {esMesActual ? money(proyDolares) : money(dolares)}
            </dd>
            <dt className="text-gray-400">Variación</dt>
            <dd className={`text-right font-semibold ${positivo ? "text-green-400" : "text-red-400"}`}>
              {varAbs >= 0 ? "+" : "-"}{money(Math.abs(varAbs))}
            </dd>
            <dt className="text-gray-400">%</dt>
            <dd className={`text-right font-semibold ${positivo ? "text-green-400" : "text-red-400"}`}>
              {varPorc >= 0 ? "+" : ""}{varPorc.toFixed(2)}%
            </dd>
          </dl>
        </button>
      </div>
    </div>
  );
};

export default TablaQuitoBotellon;
