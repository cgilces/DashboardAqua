import React, { useEffect, useState } from "react";

export default function ModalClientesNoVisitados({
    ruta,
    tipoPeriodo,
    fechaDia,
    fechaSemana,
    mesSeleccionado,
    anioSeleccionado,
    onClose,
}) {
    const [clientes, setClientes] = useState([]);
    const [cargando, setCargando] = useState(true);

    /* ================================
       📅 UTIL: rango semanal
    ================================ */
    const obtenerRangoSemana = (fecha) => {
        const d = new Date(fecha);
        const day = d.getDay();
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
       🔄 CARGA CLIENTES
    ================================ */
    useEffect(() => {
        if (!ruta) return;

        const cargarClientes = async () => {
            try {
                setCargando(true);

                let url = "http://localhost:5000/api/visitas/no-visitados";


                if (tipoPeriodo === "mes") {
                    const fecha = `${anioSeleccionado}-${mesSeleccionado.padStart(2, "0")}`;
                    url += `?ruta=${ruta}&tipo=mes&fecha=${fecha}`;
                }

                if (tipoPeriodo === "dia") {
                    url += `?ruta=${ruta}&tipo=dia&fecha=${fechaDia}`;
                }

                if (tipoPeriodo === "semana") {
                    const { inicio, fin } = obtenerRangoSemana(fechaSemana);
                    url += `?ruta=${ruta}&tipo=semana&inicio=${inicio}&fin=${fin}`;
                }

                const res = await fetch(url);
                console.log("URL SIN CONSUMO:", res)

                const json = await res.json();
                console.log("modal sin consumo:", json.data)


                setClientes(json.data ?? []);
            } catch (error) {
                console.error("❌ Error cargando clientes no visitados", error);
                setClientes([]);
            } finally {
                setCargando(false);
            }
        };

        cargarClientes();
    }, [
        ruta,
        tipoPeriodo,
        fechaDia,
        fechaSemana,
        mesSeleccionado,
        anioSeleccionado,
    ]);

    /* ================================
       🎨 RENDER
    ================================ */
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#012E24] p-6 rounded-xl border border-[#046C5E] w-[900px] max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">
                    Clientes no visitados – {ruta}
                </h2>

                {cargando && (
                    <p className="text-gray-400">Cargando clientes…</p>
                )}

                {!cargando && !clientes.length && (
                    <p className="text-green-400">
                        🎉 Todos los clientes fueron visitados en este período
                    </p>
                )}

                {!cargando && clientes.length > 0 && (
                    <table className="w-full text-sm mt-4">
                        <thead className="bg-[#014434] text-green-300 text-xs uppercase">
                            <tr>
                                <th className="px-3 py-2 text-left">N°</th>
                                <th className="px-3 py-2 text-left">Código</th>
                                <th className="px-3 py-2 text-left">Ruta</th>

                                <th className="px-3 py-2 text-left">Cliente</th>
                                <th className="px-3 py-2 text-left">Teléfono</th>
                                <th className="px-6 py-2 text-left">Ultima_Visita</th>
                                <th className="px-3 py-2 text-left">Ultimo_Producto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientes.map((c, index) => (
                                <tr
                                    key={`${c.codigo_cliente}-${index}`}
                                    className="border-b border-[#046C5E]/40 hover:bg-[#016a57]"
                                >
                                    <td className="px-3 py-2 text-gray-400">
                                        {index + 1}
                                    </td>

                                    <td className="px-3 py-2">{c.codigo_cliente}</td>
                                    <td className="px-3 py-2 ">{ruta}</td>

                                    <td className="px-3 py-2">{c.nombre_cliente}</td>
                                    <td className="px-3 py-2">
                                        {c.telefono ?? "—"}
                                    </td>

                                    {/* placeholders por ahora */}
                                    <td className="px-3 py-2 ">{c.ultima_visita}</td>
                                    <td className="px-3 py-2 ">{c.ultimo_producto}</td>
                                </tr>
                            ))}
                        </tbody>

                    </table>
                )}

                <div className="text-right mt-6">
                    <button
                        onClick={onClose}
                        className="bg-red-600 px-4 py-2 rounded-lg"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
