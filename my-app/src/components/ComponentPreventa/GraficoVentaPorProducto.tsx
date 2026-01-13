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

  // 🔧 Detectar móviles
  const isMobile = () =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  // 🔥 Base del gráfico
  const pieData = data.map((p) => ({
    name: p.producto,
    value: Number(p.dolares),
    unidades: Number(p.unidades),
    usd: Number(p.dolares),
  }));




  const pieDataValid = pieData.filter(
    (p) => !isNaN(p.value) && p.value > 0
  );


  // console.log("pieData", pieData);

  const totalUSD = pieDataValid.reduce((sum, p) => sum + p.value, 0);

  // console.log("totalUSD", totalUSD);

  const options = {
    backgroundColor: "transparent",

    title: { text: "" },

    tooltip: {
      trigger: "item",

      // Desktop = hover + click / Mobile = solo click
      triggerOn: isMobile() ? "click" : "mousemove|click",

      backgroundColor: "#013d32",
      borderColor: "#04C29B",
      borderWidth: 1,
      textStyle: { color: "#fff" },

      extraCssText: `
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    max-width: 240px;
    white-space: normal;
    pointer-events: auto;
  `,

      // ⭐ Tooltip centrado solo en móvil

      position: function (
        pos: any,
        params: any,
        dom: any,
        rect: any,
        size: any
      ) {
        if (!isMobile()) {
          return pos;
        }

        const chartW = size.viewSize[0];
        const chartH = size.viewSize[1];

        return {
          left: chartW / 2 - dom.offsetWidth / 2,
          top: chartH / 2 - dom.offsetHeight / 2,
        };
      },



      formatter: (params: any) => {
        return `
      <strong>${params.name}</strong><br/>
      USD: $${params.data.usd.toLocaleString("es-EC")}<br/>
      Unidades: ${params.data.unidades.toLocaleString("es-EC")}<br/>
      Participación: ${params.percent}%<br/>
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
        radius: ["40%", "70%"],
        center: ["50%", "45%"],

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

  // ⛔ 1. NO hay datos
  if (pieDataValid.length === 0 || totalUSD === 0) {
    return (
      <div className="bg-[#012E24] border border-[#046C5E] rounded-lg p-6 shadow-lg mt-6">
        <h2 className="text-xl font-bold text-green-300 mb-4 px-2">
          Venta por Producto (USD & Unidades)
        </h2>
        <p className="text-center text-gray-400 py-10">
          No hay información disponible para el mes seleccionado.
        </p>
      </div>
    );
  }

  // ✅ 2. SÍ hay datos → renderizar gráfico
  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-lg p-6 shadow-lg mt-6">
      <h2 className="text-xl font-bold text-green-300 mb-4 px-2">
        Venta por Producto (USD & Unidades)
      </h2>

      <ReactECharts
        option={options}
        style={{ height: "420px" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );


};

export default GraficoVentaPorProducto;
