import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface Props {
  datos: any;
  tipo?: "presentaciones" | "tendencia" | "preventas";
}

const GraficosDashboard: React.FC<Props> = ({ datos, tipo }) => {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!datos || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    let option: echarts.EChartsOption = {};

    // =========================
    // 🔹 TOP PRESENTACIONES
    // =========================
    if (tipo === "presentaciones") {
      const nombres = datos.topPresentaciones.map((p: any) => p.presentacion);
      const valores = datos.topPresentaciones.map((p: any) => p.monto);

      option = {
        backgroundColor: "transparent",
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: nombres,
          axisLabel: {
            rotate: 30,
            color: "#d1d5db",
            fontSize: 12,
          },
        },
        yAxis: {
          type: "value",
          name: "USD",
          axisLabel: { color: "#d1d5db" },
          splitLine: { lineStyle: { color: "#035c48" } },
        },
        series: [
          {
            type: "bar",
            data: valores,
            itemStyle: {
              color: "#4c8cb4",
              borderRadius: [6, 6, 0, 0],
            },
            emphasis: { focus: "series" },
          },
        ],
      };
    }

    // =========================
    // 🔹 TENDENCIA MENSUAL
    // =========================
    if (tipo === "tendencia") {
      const meses = datos.mesesDetectados || [];
      const totales = meses.map((mes: any) => {
        const [anio, num] = mes.split("-");
        return datos.facturasUnidas
          .filter((f: any) => {
            const d = new Date(Number(f.dispatch_date) * 1000);
            return (
              d.getFullYear().toString() === anio &&
              d.getMonth() + 1 === Number(num)
            );
          })
          .reduce((acc: number, f: any) => acc + (f.total || 0), 0);
      });

      option = {
        backgroundColor: "transparent",
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: meses,
          axisLabel: { color: "#d1d5db" },
        },
        yAxis: {
          type: "value",
          name: "USD",
          axisLabel: { color: "#d1d5db" },
          splitLine: { lineStyle: { color: "#035c48" } },
        },
        series: [
          {
            type: "line",
            smooth: true,
            data: totales,
            lineStyle: { color: "#74ab3c", width: 3 },
            itemStyle: { color: "#74ab3c" },
          },
        ],
      };
    }

    // =========================
    // 🔹 RANKING DE PREVENTAS (Unidades vs USD)
    // =========================
    if (tipo === "preventas") {
      const ranking = datos.rankingPreventas || [];

      const nombres = ranking.map((r: any) => r.preventa);
      const unidades = ranking.map((r: any) => r.unidades);
      const montos = ranking.map((r: any) => r.monto);

      option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params: any) => {
            const uni = params.find((p: any) => p.seriesName === "Unidades");
            const usd = params.find((p: any) => p.seriesName === "USD");
            return `
              <strong>${params[0].axisValue}</strong><br/>
              ${uni ? `📦 Unidades: ${uni.value.toLocaleString()}` : ""}
              <br/>
              ${usd ? `💵 USD: $${usd.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ""}
            `;
          },
        },
        legend: {
          data: ["Unidades", "USD"],
          top: 10,
          textStyle: { color: "#d1d5db" },
        },
        grid: { top: 60, left: "8%", right: "8%", bottom: "10%" },
        xAxis: {
          type: "category",
          data: nombres,
          axisLabel: { color: "#d1d5db", rotate: 30 },
        },
        yAxis: [
          {
            type: "value",
            name: "Unidades",
            position: "left",
            axisLabel: { color: "#d1d5db" },
            splitLine: { lineStyle: { color: "#035c48" } },
          },
          {
            type: "value",
            name: "USD",
            position: "right",
            axisLabel: { color: "#d1d5db" },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: "Unidades",
            type: "bar",
            data: unidades,
            yAxisIndex: 0,
            itemStyle: { color: "#74ab3c" },
            barWidth: "40%",
          },
          {
            name: "USD",
            type: "bar",
            data: montos,
            yAxisIndex: 1,
            itemStyle: { color: "#4c8cb4" },
            barWidth: "40%",
          },
        ],
      };
    }

    // =========================
    // Render y cleanup
    // =========================
    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [datos, tipo]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
};

export default GraficosDashboard;
