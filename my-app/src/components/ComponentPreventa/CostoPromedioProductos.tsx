import React from "react";

interface Props {
    data?: any;
}

const CATEGORIAS = [
    "300ML",
    "500ML",
    "625ML",
    "1L",
    "1L SPORT",
    "1.5L",
    "GALON",
    "6L"
];

const CostoPromedioProductos: React.FC<Props> = ({ data }) => {

    const transformar = (tabla: any) => {
        if (!tabla) return [];

        const filas: any[] = [];

        for (const preventa in tabla) {
            const productos = tabla[preventa];

            const fila: any = { preventa };

            CATEGORIAS.forEach(cat => {
                fila[`c_${cat}`] = productos[cat]?.precio ?? null;
                fila[`v_${cat}`] = productos[cat]?.vsAnterior ?? null;
            });

            filas.push(fila);
        }
        return filas;
    };

    const rows = data ? transformar(data) : [];

    const money = (v: number | null) =>
        v === null ? "—" : `$${v.toFixed(2)}`;

    const variacion = (v: number | null) =>
        v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`;

    return (
        <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-8">

            <h2 className="text-xl font-bold px-4 py-3 text-blue-300">
                PRECIO PROMEDIO POR PRODUCTO
            </h2>

            <table className="min-w-full text-sm">
                <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                    <tr>
                        <th className="px-4 py-3 text-left">Preventa</th>

                        {CATEGORIAS.map(cat => (
                            <React.Fragment key={`head-${cat}`}>
                                <th className="px-4 py-3 text-right">{cat}</th>
                                <th className="px-4 py-3 text-right">vs Ant</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, idx) => (
                        <tr
                            key={row.preventa}
                            className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#026452] transition`}
                        >
                            <td className="px-4 py-2 font-medium text-gray-100">
                                {row.preventa}
                            </td>

                            {CATEGORIAS.map(cat => {
                                const precio = row[`c_${cat}`];
                                const vs = row[`v_${cat}`];

                                return (
                                    <React.Fragment key={`${row.preventa}-${cat}`}>
                                        <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                                            {money(precio)}
                                        </td>

                                        <td
                                            className={`px-4 py-2 text-right font-semibold ${
                                                vs == null
                                                    ? "text-gray-400"
                                                    : vs >= 0
                                                    ? "text-green-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {variacion(vs)}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CostoPromedioProductos;
