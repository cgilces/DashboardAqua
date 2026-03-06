import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL } from '../../config';


const DetalleRutaDescartable = () => {
    const { usuario } = useParams(); // R1, R2, etc.
    const [data, setData] = useState<any[]>([]);

    // Capturar ?anio=XXXX&mes=XX desde la URL
    const query = new URLSearchParams(window.location.search);
    const anio = query.get("anio");
    const mes = query.get("mes");

    useEffect(() => {
        if (!anio || !mes) return;

        // Realizamos la petición a la API
        fetch(
            `${API_BASE_URL}/api/ventas/detalle-ruta-descartableporcanal/${usuario}/${anio}/${mes}`
        )
            .then((res) => res.json())
            .then((json) => {
                // Imprimir la respuesta de la API en consola para inspeccionarla
                console.log("Respuesta de la API:", json);

                // Verificar si la respuesta contiene la propiedad productosVendidos y es un array
                if (Array.isArray(json.productosVendidos)) {
                    setData(json.productosVendidos); // Guardar los productosVendidos en el estado
                } else {
                    console.error("Error: La respuesta no contiene productosVendidos como un array.");
                    setData([]); // Usar un array vacío en caso de error
                }
            })
            .catch((error) => {
                console.error("Error al obtener los datos:", error);
                setData([]); // En caso de error, se muestra un array vacío
            });
    }, [usuario, anio, mes]);

    return (
        <div className="p-6 min-h-screen bg-[#012E24] text-white">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-green-300">
                    Detalle de Ruta Descartable {usuario} — {mes}/{anio}
                </h1>

                <Link
                    to="/dashboard/preventa"
                    className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition"
                >
                    ← Volver al Dashboard
                </Link>
            </div>

            {/* TABLA */}
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
                        {data.length > 0 ? (
                            data.map((p: any, i: number) => (
                                <tr
                                    key={`${p.codigo_producto}-${i}`}
                                    className={i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                                >
                                    <td className="px-4 py-2">{p.producto}</td>

                                    <td className="px-4 py-2 text-right text-green-400 font-bold">
                                        {Number(p.unidades_vendidas).toLocaleString("es-EC")}
                                    </td>

                                    <td className="px-4 py-2 text-right text-blue-300 font-bold">
                                        ${Number(p.monto_usd).toLocaleString("es-EC", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-center text-red-400">
                                    No se encontraron datos para esta ruta.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DetalleRutaDescartable;
