import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Check, Zap, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from '../../config';

const fmt    = (v: number) => v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("es-EC");

type LocationState = {
  objetivo_gerencia?:          number;
  objetivo_gerencia_unidades?: number;
  proyeccion?:                 number;
  monto?:                      number;
  meta?:                       number;
};

const DetalleRuta = () => {
    const { usuario } = useParams();
    const location    = useLocation();
    const [data, setData] = useState([]);

    const query = new URLSearchParams(window.location.search);
    const anio = query.get("anio");
    const mes  = query.get("mes");

    // KPI data passed from RankingRutasR
    const state       = (location.state || {}) as LocationState;
    const objetivo    = Number(state.objetivo_gerencia)          || 0;
    const objUnidades = Number(state.objetivo_gerencia_unidades) || 0;
    const proyeccion  = Number(state.proyeccion)                 || 0;
    const monto       = Number(state.monto)                      || 0;
    const metaVendedor = Number(state.meta)                      || 0;

    const faltaUSD     = objetivo > 0 ? objetivo - proyeccion : 0;
    const porcObjetivo = objetivo > 0 ? (proyeccion / objetivo) * 100 : null;
    const superado     = faltaUSD <= 0;

    useEffect(() => {
        if (!anio || !mes) return;

        fetch(
            `${API_BASE_URL}/api/ventas/ruta/detalle?vendedor=${usuario}&anio=${anio}&mes=${mes}`
        )
            .then(res => res.json())
            .then(json => setData(json));
    }, [usuario, anio, mes]);

    return (
        <div className="p-6 min-h-screen bg-[#012E24] text-white">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-green-300">
                    Detalle de Ruta {usuario} — {mes}/{anio}
                </h1>

                <Link
                    to="/dashboard/preventa"
                    className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition"
                >
                    ← Volver al Dashboard
                </Link>
            </div>

            {/* CARD OBJETIVO GERENCIA */}
            {objetivo > 0 && (
                <div className="mb-8 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a1200]/80 to-[#012a20]/80 shadow-xl backdrop-blur-sm">

                    {/* Título */}
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600"/>
                        <h2 className="text-base font-bold text-amber-300 uppercase tracking-wider">
                            Objetivo de Gerencia — {usuario}
                        </h2>
                        <span className="ml-auto text-xs text-white/30 font-mono">{mes}/{anio}</span>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

                        {/* Objetivo */}
                        <div className="rounded-xl bg-white/5 border border-amber-500/20 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-1">Objetivo USD</p>
                            <p className="text-xl font-bold text-amber-300">${fmt(objetivo)}</p>
                            {objUnidades > 0 && (
                                <p className="text-xs text-white/40 mt-0.5">{fmtInt(objUnidades)} unidades</p>
                            )}
                        </div>

                        {/* Proyección */}
                        <div className="rounded-xl bg-white/5 border border-blue-500/20 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Proyección</p>
                            <p className="text-xl font-bold text-blue-300">${fmt(proyeccion)}</p>
                            <p className="text-xs text-white/40 mt-0.5">Venta actual: ${fmt(monto)}</p>
                        </div>

                        {/* Falta / Superado */}
                        <div className={`rounded-xl bg-white/5 border p-4 ${superado ? "border-green-500/30" : "border-red-500/30"}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/40">
                                {superado ? "Superado en" : "Falta alcanzar"}
                            </p>
                            <p className={`text-xl font-bold ${superado ? "text-green-400" : "text-red-400"}`}>
                                {superado ? "+" : "−"}${fmt(Math.abs(faltaUSD))}
                            </p>
                            {!superado && metaVendedor > 0 && (
                                <p className="text-xs text-white/40 mt-0.5">Meta vendedor: ${fmt(metaVendedor)}</p>
                            )}
                        </div>

                        {/* % Cumplimiento */}
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Cumplimiento</p>
                            <div>
                                <div className="w-full h-2.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            porcObjetivo! >= 100 ? "bg-green-400" :
                                            porcObjetivo! >= 80  ? "bg-yellow-400" : "bg-red-400"
                                        }`}
                                        style={{ width: `${Math.min(porcObjetivo ?? 0, 100)}%` }}
                                    />
                                </div>
                                <p className={`text-2xl font-extrabold ${
                                    porcObjetivo! >= 100 ? "text-green-400" :
                                    porcObjetivo! >= 80  ? "text-yellow-400" : "text-red-400"
                                }`}>
                                    {porcObjetivo !== null ? `${porcObjetivo.toFixed(1)}%` : "—"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mensaje contextual */}
                    <div className={`rounded-xl px-4 py-3 text-sm font-semibold border flex items-start gap-2 ${
                        superado
                            ? "bg-green-500/10 border-green-500/25 text-green-300"
                            : porcObjetivo! >= 80
                            ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
                            : "bg-red-500/10 border-red-500/25 text-red-300"
                    }`}>
                        {superado
                            ? <><Check size={16} className="mt-0.5 flex-shrink-0" /><span>{usuario} ha superado el objetivo de gerencia. Proyección {porcObjetivo!.toFixed(1)}% del objetivo.</span></>
                            : porcObjetivo! >= 80
                            ? <><Zap size={16} className="mt-0.5 flex-shrink-0" /><span>{usuario} está cerca del objetivo. Con ${fmt(faltaUSD)} más se alcanza la meta de gerencia.</span></>
                            : <><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{usuario} necesita ${fmt(faltaUSD)} adicionales para cumplir el objetivo de gerencia ({porcObjetivo!.toFixed(1)}% alcanzado).</span></>
                        }
                    </div>
                </div>
            )}

            {/* TABLA DE PRODUCTOS */}
            <div className="overflow-x-auto rounded-lg border border-[#046C5E] shadow-lg">
                <table className="min-w-full text-sm">

                    <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 text-left">Producto</th>
                            <th className="px-4 py-3 text-right">Unidades</th>
                            <th className="px-4 py-3 text-right">Dólares</th>
                        </tr>
                    </thead>

                    <tbody>
                        {data.map((p: any, i: number) => (
                            <tr
                                key={`${p.codigo_producto}-${i}`}
                                className={i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                            >
                                <td className="px-4 py-2">{p.descripcion}</td>

                                <td className="px-4 py-2 text-right text-green-400 font-bold">
                                    {Number(p.unidades).toLocaleString("es-EC")}
                                </td>

                                <td className="px-4 py-2 text-right text-blue-300 font-bold">
                                    ${Number(p.dolares).toLocaleString("es-EC", {
                                        minimumFractionDigits: 2
                                    })}
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
                        <tr>
                            <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                            <td className="px-4 py-3 text-right text-green-400">
                                {data.reduce((acc, p: any) => acc + Number(p.unidades || 0), 0).toLocaleString("es-EC")}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-300">
                                ${data.reduce((acc, p: any) => acc + Number(p.dolares || 0), 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

        </div>
    );
};

export default DetalleRuta;
