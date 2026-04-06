import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface Props {
  data: any[];
}

const GraficoVentaPorProducto: React.FC<Props> = ({ data }) => {
  // 📱 Detectar móviles
  const isMobile = () =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  // 🔁 Transformación + limpieza de datos (MEMORIZADA)
  const pieDataValid = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((p) => ({
        name: p.producto,
        value: Number(p.dolares),
        unidades: Number(p.unidades),
        usd: Number(p.dolares),
      }))
      .filter((p) => !isNaN(p.value) && p.value > 0);
  }, [data]);

  const totalUSD = useMemo(() => {
    return pieDataValid.reduce((sum, p) => sum + p.value, 0);
  }, [pieDataValid]);

  // ⛔ No hay datos
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

  // 🎨 Opciones del gráfico
  const options = {
    backgroundColor: "transparent",

    tooltip: {
      trigger: "item",
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

      position: function (
        pos: any,
        params: any,
        dom: any,
        rect: any,
        size: any
      ) {
        if (!isMobile()) return pos;

        const chartW = size.viewSize[0];
        const chartH = size.viewSize[1];

        return {
          left: chartW / 2 - dom.offsetWidth / 2,
          top: chartH / 2 - dom.offsetHeight / 2,
        };
      },

      formatter: (params: any) => `
        <strong>${params.name}</strong><br/>
        USD: $${params.data.usd.toLocaleString("es-EC")}<br/>
        Unidades: ${params.data.unidades.toLocaleString("es-EC")}<br/>
        Participación: ${params.percent}%
      `,
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

        data: pieDataValid,
      },
    ],
  };

  // ✅ Render final (con remount forzado)
  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-lg p-6 shadow-lg mt-6">
      <h2 className="text-xl font-bold text-green-300 mb-4 px-2">
        Venta por Producto (USD & Unidades)
      </h2>

      <ReactECharts
        key={`grafico-producto-${pieDataValid.length}-${totalUSD}`}
        option={options}
        style={{ height: "420px" }}
        notMerge={true}
        lazyUpdate={false}
      />
    </div>
  );
};

export default GraficoVentaPorProducto;
