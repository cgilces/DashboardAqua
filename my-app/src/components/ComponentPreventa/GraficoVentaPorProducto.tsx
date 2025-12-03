import React from "react";
import ReactECharts from "echarts-for-react";

const GraficoVentaPorProducto = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-6">
        No hay información disponible para el gráfico.
      </p>
    );
  }

  // 🔥 Seleccionamos USD como base del porcentaje del gráfico
  const pieData = data.map((p) => ({
    name: p.producto,
    value: Number(p.dolares), // base de porcentaje = USD
    unidades: Number(p.unidades), // info adicional en tooltip
    usd: Number(p.dolares),
  }));

  const options = {
    backgroundColor: "transparent",

    title: {
      text: "",
    },

    tooltip: {
      trigger: "item",
      backgroundColor: "#013d32",
      borderColor: "#04C29B",
      borderWidth: 1,
      textStyle: { color: "#fff" },
      formatter: (params: any) => {
        return `
          <strong>${params.name}</strong><br/>
          USD: $${params.data.usd.toLocaleString('es-EC')}<br/>
          Unidades: ${params.data.unidades.toLocaleString('es-EC')}<br/>
          Participación: ${params.percent}%
        `;
      },
    },

    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: "#7DFFDA" },
    },

    series: [
      {
        name: "Venta por Producto",
        type: "pie",
        radius: ["40%", "70%"], // donut
        center: ["50%", "45%"],

        // 🔥 Mostrar porcentaje grande dentro del gráfico
        label: {
          show: true,
          position: "outside",
          formatter: "{d}%",
          color: "#fff",
          fontSize: 13,
        },

        labelLine: {
          show: true,
          length: 12,
          length2: 8,
          lineStyle: { color: "#04C29B" },
        },

        data: pieData,
      },
    ],
  };

  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-lg p-6 shadow-lg mt-6">
      <h2 className="text-xl font-bold text-green-300 mb-4 px-2">
        Venta por Producto (USD & Unidades)
      </h2>

      <ReactECharts option={options} style={{ height: "420px" }} />
    </div>
  );
};

export default GraficoVentaPorProducto;
