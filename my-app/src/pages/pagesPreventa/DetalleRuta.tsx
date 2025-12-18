import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const DetalleRuta = () => {
    const { usuario } = useParams(); // R1, R2, etc.
    const [data, setData] = useState([]);

    // 🆕 Capturar ?anio=XXXX&mes=XX desde la URL
    const query = new URLSearchParams(window.location.search);
    const anio = query.get("anio");
    const mes = query.get("mes");

    useEffect(() => {
        if (!anio || !mes) return;

        fetch(
            `http://localhost:5000/api/ventas/ruta/detalle?vendedor=${usuario}&anio=${anio}&mes=${mes}`
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
                </table>
            </div>

        </div>
    );
};

export default DetalleRuta;
