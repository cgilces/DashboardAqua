// // services/ventasServicio.js
// const axios = require("axios");
// const { API_URL } = require("../config/config");
// const { obtenerSesionActual } = require("../utils/apiCliente");

// // ======================================================
// // ✅ 1️⃣ Obtener facturas filtradas por fecha desde MobilVendor (con paginación)
// // ======================================================
// const obtenerFacturasMobilvendor = async (fechaInicio, fechaFin) => {
//   console.log(`🟡 [VENTAS] Descargando facturas filtradas desde ${fechaInicio} hasta ${fechaFin}...`);

//   const session_id = await obtenerSesionActual();
//   if (!session_id) throw new Error("No hay sesión activa con MobilVendor");

//   const cuerpo = {
//     session_id,
//     action: "getInvoices",
//     filter: {
//       process_status: "0,1,2,3,4,5", // Todos los estados de proceso
//       type: "1,2", // 1 = factura, 2 = orden
//       status: "0,2,10", // Todos los estados
//       start_date: fechaInicio,
//       end_date: fechaFin,
//       limit: 1000, // Número máximo de registros por página
//       page: currentPage, // Página que deseas consultar
//     },
//   };

//   try {
//     const respuesta = await axios.post(API_URL, cuerpo, {
//       headers: { "Content-Type": "application/json" },
//       timeout: 40000,
//     });

//     const data = respuesta.data;
//     const cabeceras = data.invoices || data.headers || [];
//     const detalles = data.details || [];

//     console.log(`✅ [VENTAS] Facturas recibidas: ${cabeceras.length}`);
//     console.log(`✅ [VENTAS] Detalles recibidos: ${detalles.length}`);

//     return { cabeceras, detalles };
//   } catch (err) {
//     console.error("❌ [VENTAS] Error al obtener facturas filtradas:", err.message);
//     throw err;
//   }
// };

// // ======================================================
// // 2️⃣ Unir cabeceras + detalles por código de factura
// // ======================================================
// const unirCabecerasYDetalles = (cabeceras, detalles) => {
//   console.log("🔄 [VENTAS] Uniendo cabeceras con detalles...");

//   const indiceCabeceras = new Map();
//   cabeceras.forEach((c) => {
//     indiceCabeceras.set(c.code, {
//       ...c,
//       total: Number(c.total) || 0,
//       detalles: [],
//     });
//   });

//   detalles.forEach((d) => {
//     const codigoFactura = d.invoice_code;
//     const filaCabecera = indiceCabeceras.get(codigoFactura);
//     if (filaCabecera) {
//       filaCabecera.detalles.push({
//         ...d,
//         quantity: parseFloat(d.quantity) || 0,
//         price: parseFloat(d.price) || 0,
//         total: parseFloat(d.total) || 0,
//       });
//     }
//   });

//   const facturasUnidas = Array.from(indiceCabeceras.values());
//   console.log(`✅ [VENTAS] Se unieron ${facturasUnidas.length} facturas con sus detalles.`);
//   return facturasUnidas;
// };

// // ======================================================
// // 3️⃣ Calcular KPIs generales para el dashboard
// // ======================================================
// const calcularResumenDashboard = (facturasUnidas, filtros) => {
//   console.log("📊 [VENTAS] Calculando KPIs del dashboard...");

//   const { anio, mes } = filtros || {};
//   const anioNum = Number(anio);
//   const mesNum = Number(mes);

//   let unidadesTotales = 0;
//   let montoTotal = 0;

//   const ventasPorPreventa = {};
//   const ventasPorPresentacion = {};
//   const mesesDetectados = new Set();
//   const clientesConConsumo = new Set();

//   const facturasFiltradas = [];

//   for (const factura of facturasUnidas) {
//     // 🧩 Solo facturas entregadas (type 2)
//     if (String(factura.type) !== "2") continue;

//     // 📅 Validar mes/año exacto por dispatch_date
//     const ts = Number(factura.dispatch_date);
//     if (isNaN(ts) || ts <= 0) continue;

//     const fecha = new Date(ts * 1000);
//     const y = fecha.getFullYear();
//     const m = fecha.getMonth() + 1;
//     mesesDetectados.add(`${y}-${m.toString().padStart(2, "0")}`);

//     if (y !== anioNum || m !== mesNum) continue;
//     facturasFiltradas.push(factura);

//     // 🧾 Código de preventa o ruta
//     let codigoPreventa =
//       factura.route?.code ||
//       factura.seller_code ||
//       factura.pre_seller ||
//       factura.user_code ||
//       "SIN_PREVENTA";

//     codigoPreventa = codigoPreventa.toString().trim().toUpperCase();

//     // Filtrar rutas tipo PV1, PV2, etc.
//     if (!/^PV\d+$/i.test(codigoPreventa.replace(/\s+/g, ""))) continue;

//     const detalles = factura.detalles || [];
//     if (detalles.length && factura.customer_code) {
//       clientesConConsumo.add(factura.customer_code);
//     }

//     for (const d of detalles) {
//       const cantidad = parseFloat(d.quantity) || 0;
//       const total = parseFloat(d.total) || 0;

//       unidadesTotales += cantidad;
//       montoTotal += total;

//       // Ventas por preventa
//       if (!ventasPorPreventa[codigoPreventa]) {
//         ventasPorPreventa[codigoPreventa] = { unidades: 0, monto: 0 };
//       }
//       ventasPorPreventa[codigoPreventa].unidades += cantidad;
//       ventasPorPreventa[codigoPreventa].monto += total;

//       // Ventas por presentación
//       const presentacion =
//         d.article_description || d.article_alias || d.article_code || "SIN_PRESENTACION";

//       if (!ventasPorPresentacion[presentacion]) {
//         ventasPorPresentacion[presentacion] = { unidades: 0, monto: 0 };
//       }
//       ventasPorPresentacion[presentacion].unidades += cantidad;
//       ventasPorPresentacion[presentacion].monto += total;
//     }
//   }

//   // Rankings
//   const rankingPreventas = Object.entries(ventasPorPreventa)
//     .map(([preventa, datos]) => ({
//       preventa,
//       unidades: datos.unidades,
//       monto: datos.monto,
//     }))
//     .sort((a, b) => b.unidades - a.unidades);

//   const topPresentaciones = Object.entries(ventasPorPresentacion)
//     .map(([presentacion, datos]) => ({
//       presentacion,
//       unidades: datos.unidades,
//       monto: datos.monto,
//     }))
//     .sort((a, b) => b.monto - a.monto)
//     .slice(0, 10);

//   // KPIs Generales
//   const ordenesGeneradas = facturasFiltradas.length;
//   const ordenesEntregadas = facturasFiltradas.filter((f) => String(f.status) === "2").length;

//   const clientesEnRuta = clientesConConsumo.size;
//   const clientesSinConsumo = 0;

//   const metaMensualUnidades = unidadesTotales * 1.1;
//   const metaMensualUSD = montoTotal * 1.1;

//   const kpisGenerales = {
//     unidadesTotales,
//     montoTotal,
//     cumplimientoUnidadesMensual:
//       metaMensualUnidades > 0 ? unidadesTotales / metaMensualUnidades : 0,
//     cumplimientoUSDMensual:
//       metaMensualUSD > 0 ? montoTotal / metaMensualUSD : 0,
//   };

//   const resumenGeneral = {
//     ordenesGeneradas,
//     ordenesEntregadas,
//     clientesEnRuta,
//     clientesSinConsumo,
//   };

//   console.log("🧾 Meses detectados:", Array.from(mesesDetectados).join(", ") || "Ninguno");
//   console.log("📈 [VENTAS] Total unidades:", unidadesTotales);
//   console.log("💰 [VENTAS] Total monto USD:", montoTotal.toFixed(2));

//   return {
//     kpisGenerales,
//     rankingPreventas,
//     resumenGeneral,
//     topPresentaciones,
//     mesesDetectados: Array.from(mesesDetectados),
//     facturasFiltradas,
//     _raw: { unidadesTotales, montoTotal },
//   };
// };

// // ======================================================
// // 4️⃣ Función principal usada por el controlador
// // ======================================================
// const obtenerDatosDashboard = async (filtros) => {
//   console.log("🚀 [VENTAS] Iniciando generación de dashboard preventas...");

//   const { anio, mes } = filtros;
//   const anioNum = Number(anio);
//   const mesNum = Number(mes);

//   const fechaInicio = `${anioNum}-${String(mesNum).padStart(2, "0")}-01`;
//   const fechaFin = new Date(anioNum, mesNum, 0).toISOString().split("T")[0];

//   console.log(`📆 [VENTAS] Rango aplicado: ${fechaInicio} → ${fechaFin}`);

//   const { cabeceras, detalles } = await obtenerFacturasMobilvendor(fechaInicio, fechaFin);
//   const facturasUnidas = unirCabecerasYDetalles(cabeceras, detalles);

//   const resumenActual = calcularResumenDashboard(facturasUnidas, filtros);

//   // Comparativa con mes anterior
//   let comparativasMesAnterior = null;
//   if (anio && mes) {
//     const fecha = new Date(anioNum, mesNum - 1, 1);
//     fecha.setMonth(fecha.getMonth() - 1);

//     const anioPrev = fecha.getFullYear();
//     const mesPrev = fecha.getMonth() + 1;

//     console.log(`📊 [VENTAS] Calculando comparativa contra ${anioPrev}-${mesPrev}`);

//     const fechaInicioPrev = `${anioPrev}-${String(mesPrev).padStart(2, "0")}-01`;
//     const fechaFinPrev = new Date(anioPrev, mesPrev, 0).toISOString().split("T")[0];

//     const { cabeceras: cabPrev, detalles: detPrev } =
//       await obtenerFacturasMobilvendor(fechaInicioPrev, fechaFinPrev);

//     const facturasUnidasPrev = unirCabecerasYDetalles(cabPrev, detPrev);
//     const resumenPrev = calcularResumenDashboard(facturasUnidasPrev, {
//       anio: anioPrev,
//       mes: mesPrev,
//     });

//     const uAct = resumenActual._raw.unidadesTotales;
//     const uPrev = resumenPrev._raw.unidadesTotales;
//     const mAct = resumenActual._raw.montoTotal;
//     const mPrev = resumenPrev._raw.montoTotal;

//     const variacionUnidades = uPrev > 0 ? ((uAct - uPrev) / uPrev) * 100 : null;
//     const variacionMonto = mPrev > 0 ? ((mAct - mPrev) / mPrev) * 100 : null;

//     comparativasMesAnterior = {
//       anio: anioPrev,
//       mes: mesPrev,
//       unidadesTotales: uPrev,
//       montoTotal: mPrev,
//       variacionUnidades,
//       variacionMonto,
//     };
//   }

//   const { _raw, facturasFiltradas, ...publicResumen } = resumenActual;

//   console.log("✅ [VENTAS] Dashboard preventas generado correctamente.");
//   return {
//     facturasUnidas: facturasFiltradas,
//     ...publicResumen,
//     comparativasMesAnterior,
//   };
// };

// module.exports = {
//   obtenerFacturasMobilvendor,
//   obtenerDatosDashboard,
// };
