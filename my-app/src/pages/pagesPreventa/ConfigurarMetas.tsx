import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ConfigurarMetas() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        preventa: "",
        meta_unidades: "",
        meta_dolares: "",
        mes: "",
        anio: new Date().getFullYear(),
    });

    const [metas, setMetas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    // ------------------------------------------------------------
    // 📌 INPUT HANDLER
    // ------------------------------------------------------------
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // ------------------------------------------------------------
    // 📌 OBTENER METAS DESDE EL BACKEND
    // ------------------------------------------------------------
    const cargarMetas = async () => {
        try {
            setLoading(true);

            const res = await fetch("http://localhost:5000/api/metas/listarmetas");
            const data = await res.json();

            console.log("📥 DATA:", data);

            // Validar que metas exista
            const lista = Array.isArray(data.metas) ? data.metas : [];

            // Ordenar por preventa
            const ordenadas = lista.sort((a: any, b: any) =>
                a.codigo_ruta.localeCompare(b.codigo_ruta, undefined, {
                    numeric: true,
                    sensitivity: "base"
                })
            );

            setMetas(ordenadas);
        } catch (error) {
            console.error("❌ Error cargando metas:", error);
            setMetas([]);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        cargarMetas();
    }, []);

    // ------------------------------------------------------------
    // 📌 GUARDAR / ACTUALIZAR META
    // ------------------------------------------------------------
    const guardarMeta = async () => {
        if (!form.preventa || !form.mes || !form.meta_unidades || !form.meta_dolares) {
            alert("⚠️ Todos los campos son obligatorios");
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/api/metas/guardarmetas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            alert(data.message || "Meta guardada");

            cargarMetas(); // refrescar tabla
        } catch (error) {
            console.error("❌ Error al guardar meta", error);
            alert("No se pudo guardar");
        }
    };

    // ------------------------------------------------------------
    // 📌 COMPONENTE
    // ------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#012E24] text-white p-4 sm:p-6 md:p-10">

            {/* TITULO */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-green-300 text-center w-full">
                    ⚙ Configurar Metas de Preventas
                </h1>


                <Link
                    to="/dashboard/preventa"
                    className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition whitespace-nowrap"
                >
                    ← Volver al Dashboard
                </Link>

            </div>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">

                {/* =====================================================
            FORMULARIO
        ===================================================== */}
                <div className="bg-[#013d32] p-4 sm:p-8 rounded-xl shadow-lg text-sm sm:text-base">

                    {/* PREVENTA */}
                    <div className="mb-3 sm:mb-4">
                        <label className="text-gray-300 text-xs sm:text-sm">Ruta / Preventa:</label>
                        <input
                            name="preventa"
                            className="w-full mt-1 p-2 sm:p-3 rounded bg-[#024d3f] text-white text-sm uppercase"
                            placeholder="Ej: PV10, TELEVENTA 1"
                            value={form.preventa}
                            onChange={(e) => setForm({ ...form, preventa: e.target.value.toUpperCase() })}
                        />
                    </div>

                    {/* MES */}
                    <div className="mb-3 sm:mb-4">
                        <label className="text-gray-300 text-xs sm:text-sm">Mes:</label>
                        <select
                            name="mes"
                            className="w-full mt-1 p-2 sm:p-3 rounded bg-[#024d3f] text-white text-sm"
                            value={form.mes}
                            onChange={handleChange}
                        >
                            <option value="">Seleccione…</option>
                            {meses.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* AÑO */}
                    <div className="mb-3 sm:mb-4">
                        <label className="text-gray-300 text-xs sm:text-sm">Año:</label>
                        <select
                            name="anio"
                            className="w-full mt-1 p-2 sm:p-3 rounded bg-[#024d3f] text-white text-sm"
                            value={form.anio}
                            onChange={handleChange}
                        >
                            {Array.from({ length: 5 }, (_, i) => {
                                const y = new Date().getFullYear() - i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>

                    {/* META UNIDADES */}
                    <div className="mb-3 sm:mb-4">
                        <label className="text-gray-300 text-xs sm:text-sm">Meta Unidades:</label>
                        <input
                            type="number"
                            name="meta_unidades"
                            className="w-full mt-1 p-2 sm:p-3 rounded bg-[#024d3f] text-white text-sm"
                            value={form.meta_unidades}
                            onChange={handleChange}
                        />
                    </div>

                    {/* META USD */}
                    <div className="mb-3 sm:mb-4">
                        <label className="text-gray-300 text-xs sm:text-sm">Meta en USD:</label>
                        <input
                            type="number"
                            name="meta_dolares"
                            className="w-full mt-1 p-2 sm:p-3 rounded bg-[#024d3f] text-white text-sm"
                            value={form.meta_dolares}
                            onChange={handleChange}
                        />
                    </div>

                    {/* BOTÓN GUARDAR */}
                    <button
                        onClick={guardarMeta}
                        className="w-full bg-[#0db48b] hover:bg-[#0aa77e] text-black font-bold py-2 sm:py-3 mt-4 rounded-lg shadow-md text-sm sm:text-base"
                    >
                        Guardar Meta Preventa
                    </button>


                </div>

                {/* =====================================================
            TABLA DE METAS
        ===================================================== */}
                <div className="bg-[#013d32] p-4 sm:p-8 rounded-xl shadow-lg text-xs sm:text-sm">

                    <h2 className="text-lg sm:text-xl font-semibold mb-4 text-green-300 text-center">
                        📋 Metas Registradas
                    </h2>

                    <div className="overflow-x-auto">

                        {loading ? (
                            <p className="text-center text-gray-400 py-4">Cargando...</p>
                        ) : metas.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">No hay metas registradas.</p>
                        ) : (
                            <table className="min-w-full text-sm">

                                {/* ENCABEZADO */}
                                <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Ruta / Preventa</th>
                                        <th className="px-4 py-3 text-right">Unidades</th>
                                        <th className="px-4 py-3 text-right">Dólares</th>
                                        <th className="px-4 py-3 text-center">Mes</th>
                                        <th className="px-4 py-3 text-center">Año</th>
                                    </tr>
                                </thead>

                                {/* CUERPO */}
                                <tbody>
                                    {metas.map((m, idx) => (
                                        <tr
                                            key={idx}
                                            className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} 
                                hover:bg-[#026452] transition`}
                                        >
                                            <td className="px-4 py-2 font-medium text-gray-100">
                                                {m.codigo_ruta}
                                            </td>

                                            <td className="px-4 py-2 text-right text-green-400 font-semibold">
                                                {m.meta_unidades.toLocaleString()}
                                            </td>

                                            <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                                                $
                                                {Number(m.meta_dolares).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>

                                            <td className="px-4 py-2 text-center text-green-300">
                                                {meses[m.mes - 1]}
                                            </td>

                                            <td className="px-4 py-2 text-center text-gray-200">
                                                {m.anio}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        )}
                    </div>

                </div>


            </div>
        </div>
    );
}
