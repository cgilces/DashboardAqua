// services/sincronizacionService.js
require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const sequelize = require("../db");
const {
  RutaPreventa,
  ClienteVenta,
  Factura,
  Orden,
  DetalleDocumento,
  SincronizacionVenta,
} = require("../models");

const { API_URL } = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

// ===============================
// HELPERS
// ===============================
const parseUnixToDate = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date((n * 1000) - (5 * 60 * 60 * 1000));


};

const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const inferTipoRuta = (codigo = "") => {
  const c = (codigo || "").toUpperCase();
  if (c.startsWith("PV")) return "PREVENTA";
  if (c.includes("TELE")) return "TELEVENTA";
  if (c.includes("VIP")) return "VIP";
  return null;
};

// Normalizar códigos para que cabeceras y detalles coincidan siempre
const normalizeCode = (v) => {
  if (!v && v !== 0) return null;
  return String(v).trim().replace(/^0+/, ""); // quita ceros iniciales si los hay
};

// Función para escribir los datos en un archivo de log
const logDataToFile = (data, filename = "api_log.txt") => {
  const logFilePath = path.join(__dirname, filename);
  const timestamp = new Date().toISOString(); // Crear un timestamp para cada entrada
  const logContent = `\n\n[${timestamp}] - Datos recibidos: ${JSON.stringify(
    data,
    null,
    2
  )}`;

  try {
    fs.appendFileSync(logFilePath, logContent, "utf8");
  } catch (err) {
    console.error("Error escribiendo en el archivo de log", err);
  }
};

// ================================================================
//  SERVICIO PRINCIPAL: SINCRONIZAR FACTURAS + ORDENES + DETALLES
// ================================================================
const sincronizarVentasRango = async (startDate, endDate, syncState = null) => {
  console.log(`\n\n====================================`);
  console.log(`🚀 SINCRONIZACIÓN ${startDate} → ${endDate}`);
  console.log(`====================================\n`);

  // 🔹 INICIALIZAR ESTADO GLOBAL (PARA FRONTEND)
  if (syncState) {
    syncState.running = true;
    syncState.startDate = startDate;
    syncState.endDate = endDate;
    syncState.page = 0;
    syncState.total = 0;
    syncState.percent = 0;
    syncState.error = null;
    syncState.startedAt = new Date();
    syncState.finishedAt = null;
  }

  // 1) Registrar inicio de sincronización
  let syncRow;
  try {
    syncRow = await SincronizacionVenta.create({
      desde_date: startDate,
      hasta_date: endDate,
      estado: "EN_PROCESO",
      total_registros: 0,
      mensaje: null,
    });
  } catch (err) {
    console.error("❌ Error creando sincronización:", err.message);
    throw err;
  }

  const idSync = syncRow.id_sync;
  console.log(`📝 Sync ID creado: ${idSync}`);

  let totalHeaders = 0;
  let totalDetails = 0;
  let totalFacturas = 0;
  let totalOrdenes = 0;
  let totalDetallesInsertados = 0;
  const erroresPorDocumento = [];

  try {
    const session_id = await obtenerSesionActual();
    if (!session_id) {
      throw new Error("No hay sesión activa con MobilVendor");
    }

    console.log(`🔐 Sesión MobilVendor: ${session_id}`);

    let totalPages = 1;
    let currentPage = 1;

    while (currentPage <= totalPages) {
      console.log(`\n-------------------------------`);
      console.log(`📦 SOLICITANDO PÁGINA ${currentPage} de ${totalPages}`);
      console.log(`-------------------------------`);

      // 🔹 ACTUALIZAR PROGRESO
      // if (syncState) {
      //   syncState.page = currentPage;
      //   syncState.total = totalPages;
      //   syncState.percent = totalPages
      //     ? Math.round((currentPage / totalPages) * 100)
      //     : 0;
      // }

      if (syncState) {
        syncState.page = currentPage;
        syncState.total = totalPages > 1 ? totalPages : syncState.total;
        syncState.percent = syncState.total
          ? Math.round((currentPage / syncState.total) * 100)
          : 0;
      }


      const body = {
        session_id,
        action: "getInvoices",
        filter: {
          process_status: "0,1,2,3,4,5",
          type: "1,2",
          status: "0,1,2,5,10",
          start_date: startDate,
          end_date: endDate,
          limit: 1000,
          page: currentPage,
        },
      };

      const { data } = await axios.post(API_URL, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      });

      const headers = data.invoices || data.headers || [];
      const details = data.details || [];
      totalPages = data.pages || totalPages;

      // 🔹 ACTUALIZAR TOTAL DE PÁGINAS
      if (syncState) {
        syncState.total = totalPages;
      }

      console.log(`📥 Página ${currentPage}`);
      console.log(`   → Cabeceras: ${headers.length}`);
      console.log(`   → Detalles : ${details.length}`);
      console.log(`   → Páginas  : ${totalPages}`);

      // if (!headers.length) break;

      if (!headers.length) {
        console.log("🏁 No hay más cabeceras");
        break;
      }


      totalHeaders += headers.length;
      totalDetails += details.length;

      // ===============================
      // AGRUPAR DETALLES POR DOCUMENTO
      // ===============================
      const detallesPorDocumento = new Map();
      for (const d of details) {
        const docCode = normalizeCode(
          d.invoice_code || d.document_code || d.code
        );
        if (!docCode) continue;
        if (!detallesPorDocumento.has(docCode)) {
          detallesPorDocumento.set(docCode, []);
        }
        detallesPorDocumento.get(docCode).push(d);
      }

      // ===============================
      // PROCESAR CABECERAS
      // ===============================
      for (const doc of headers) {
        const code = normalizeCode(doc.code);
        if (!code) continue;

        let tDoc;
        try {
          tDoc = await sequelize.transaction();

          const type = Number(doc.type);
          const status = Number(doc.status);
          const creationDate = parseUnixToDate(doc.create_date || doc.store_date);
          const dispatchDate =
            parseUnixToDate(doc.dispatch_date) ||
            parseUnixToDate(doc.create_date) ||
            parseUnixToDate(doc.store_date);

          const customerCode = doc.customer_code || null;
          const routeCode = doc.route?.code || doc.route_code || null;
          const sellerCode = doc.seller_code || doc.user_code || null;

          if (routeCode) {
            await RutaPreventa.upsert(
              {
                codigo_ruta: routeCode,
                descripcion:
                  doc.route?.description || doc.route_description || null,
                tipo: inferTipoRuta(routeCode),
              },
              { transaction: tDoc }
            );
          }

          if (customerCode) {
            await ClienteVenta.upsert(
              {
                codigo_cliente: customerCode,
                nombre_cliente: doc.customer_name || null,
                telefono: doc.phone || null,
                email: doc.email || null,
                latitud: doc.latitude || null,
                longitud: doc.longitude || null,
                ruta_asignada: routeCode,
                usuario_asignado: sellerCode,
              },
              { transaction: tDoc }
            );
          }

          if (type === 1) {
            totalFacturas++;
            await Factura.upsert(
              {
                code,
                type,
                status,
                fecha_creacion: creationDate,
                fecha_entrega: dispatchDate,
                customer_code: customerCode,
                route_code: routeCode,
                seller_code: sellerCode,
                total: toNumber(doc.total),
                subtotal: toNumber(doc.subtotal),
                iva: toNumber(doc.iva),
                discount: toNumber(doc.discount),
              },
              { transaction: tDoc }
            );
          } else if (type === 2) {
            totalOrdenes++;
            await Orden.upsert(
              {
                code,
                type,
                status,
                fecha_creacion: creationDate,
                fecha_entrega: dispatchDate,
                customer_code: customerCode,
                route_code: routeCode,
                seller_code: sellerCode,
                total: toNumber(doc.total),
                subtotal: toNumber(doc.subtotal),
                iva: toNumber(doc.iva),
                discount: toNumber(doc.discount),
              },
              { transaction: tDoc }
            );
          }

          await DetalleDocumento.destroy({
            where: { documento_code: code },
            transaction: tDoc,
          });

          const detallesDoc = detallesPorDocumento.get(code) || [];
          for (const d of detallesDoc) {
            await DetalleDocumento.create(
              {
                documento_code: code,
                codigo_producto: d.article_code || null,
                descripcion: d.article_description || "",
                cantidad: toNumber(d.quantity),
                precio: toNumber(d.price),
                subtotal: toNumber(d.subtotal),
                total: toNumber(d.total),
                iva: toNumber(d.iva),
                unit_alias: d.unit_alias || null,
                barcode: d.barcode || null,
                codigo_categoria: d.article_category_code || null,
                descripcion_categoria:
                  d.article_category_description || null,
              },
              { transaction: tDoc }
            );
            totalDetallesInsertados++;
          }

          await tDoc.commit();
        } catch (errDoc) {
          if (tDoc) await tDoc.rollback();
          erroresPorDocumento.push({ code, error: errDoc.message });
        }
      }

      currentPage++;
    }

    await SincronizacionVenta.update(
      {
        estado: "SUCCESS",
        total_registros: totalHeaders,
        mensaje: `Facturas:${totalFacturas} Órdenes:${totalOrdenes} Detalles:${totalDetallesInsertados} Errores:${erroresPorDocumento.length}`,
      },
      { where: { id_sync: idSync } }
    );

    // 🔹 FINAL OK
    if (syncState) {
      syncState.running = false;
      syncState.percent = 100;
      syncState.finishedAt = new Date();
    }

    return {
      idSync,
      totalHeaders,
      totalDetails,
      totalFacturas,
      totalOrdenes,
      totalDetallesInsertados,
      erroresPorDocumento,
    };
  } catch (err) {
    console.error("❌ ERROR GLOBAL:", err.message);

    if (syncState) {
      syncState.running = false;
      syncState.error = err.message;
      syncState.finishedAt = new Date();
    }

    await SincronizacionVenta.update(
      { estado: "FAILED", mensaje: err.message },
      { where: { id_sync: idSync } }
    );

    throw err;
  }
};

module.exports = {
  sincronizarVentasRango,
};




// // services/sincronizacionService.js
// require("dotenv").config();

// const axios = require("axios");
// const fs = require("fs");
// const path = require("path");

// const sequelize = require("../db");
// const {
//   RutaPreventa,
//   ClienteVenta,
//   Factura,
//   Orden,
//   DetalleDocumento,
//   SincronizacionVenta,
// } = require("../models");

// const { API_URL } = require("../config/config");
// const { obtenerSesionActual } = require("../utils/apiCliente");

// // ===============================
// // HELPERS
// // ===============================
// const parseUnixToDate = (value) => {
//   if (value === null || value === undefined) return null;
//   const n = Number(value);
//   if (!Number.isFinite(n) || n <= 0) return null;
//   return new Date((n * 1000) - (5 * 60 * 60 * 1000));


// };

// const toNumber = (val) => {
//   const n = Number(val);
//   return Number.isFinite(n) ? n : 0;
// };

// const inferTipoRuta = (codigo = "") => {
//   const c = (codigo || "").toUpperCase();
//   if (c.startsWith("PV")) return "PREVENTA";
//   if (c.includes("TELE")) return "TELEVENTA";
//   if (c.includes("VIP")) return "VIP";
//   return null;
// };

// // Normalizar códigos para que cabeceras y detalles coincidan siempre
// const normalizeCode = (v) => {
//   if (!v && v !== 0) return null;
//   return String(v).trim().replace(/^0+/, ""); // quita ceros iniciales si los hay
// };

// // Función para escribir los datos en un archivo de log
// const logDataToFile = (data, filename = "api_log.txt") => {
//   const logFilePath = path.join(__dirname, filename);
//   const timestamp = new Date().toISOString(); // Crear un timestamp para cada entrada
//   const logContent = `\n\n[${timestamp}] - Datos recibidos: ${JSON.stringify(
//     data,
//     null,
//     2
//   )}`;

//   try {
//     fs.appendFileSync(logFilePath, logContent, "utf8");
//   } catch (err) {
//     console.error("Error escribiendo en el archivo de log", err);
//   }
// };

// // ================================================================
// // 🔥 SERVICIO PRINCIPAL: SINCRONIZAR FACTURAS + ORDENES + DETALLES
// // ================================================================
// const sincronizarVentasRango = async (startDate, endDate) => {
//   console.log(`\n\n====================================`);
//   console.log(`🚀 SINCRONIZACIÓN ${startDate} → ${endDate}`);
//   console.log(`====================================\n`);

//   // 1) Registrar inicio de sincronización en la tabla sincronizaciones_ventas
//   let syncRow;
//   try {
//     syncRow = await SincronizacionVenta.create({
//       desde_date: startDate,
//       hasta_date: endDate,
//       estado: "EN_PROCESO",
//       total_registros: 0,
//       mensaje: null,
//     });
//   } catch (err) {
//     console.error("❌ Error creando registro en sincronizaciones_ventas:", err.message);
//     throw err;
//   }

//   const idSync = syncRow.id_sync;
//   console.log(`📝 Sync ID creado: ${idSync}`);

//   let totalHeaders = 0;
//   let totalDetails = 0;
//   let totalFacturas = 0;
//   let totalOrdenes = 0;
//   let totalDetallesInsertados = 0;
//   const erroresPorDocumento = [];

//   try {
//     const session_id = await obtenerSesionActual();
//     if (!session_id) {
//       throw new Error("No hay sesión activa con MobilVendor (session_id vacío)");
//     }

//     console.log(`🔐 Sesión MobilVendor: ${session_id}`);

//     let totalPages = 1; // Valor inicial en caso de que no se reciba de la API
//     let currentPage = 1;

//     while (currentPage <= totalPages) {
//       console.log(`\n-------------------------------`);
//       console.log(`📦 SOLICITANDO PÁGINA ${currentPage} de ${totalPages}`);
//       console.log(`-------------------------------`);

//       const body = {
//         session_id,
//         action: "getInvoices",
//         filter: {
//           process_status: "0,1,2,3,4,5", // Todos los estados de proceso
//           type: "1,2", // 1 = factura, 2 = orden
//           // status: "0,2,10", // Todos los estados
//           status: "0,1,2,5,10",
//           start_date: startDate,
//           end_date: endDate,
//           limit: 1000, // Número máximo de registros por página
//           page: currentPage, // Página que deseas consultar
//         },
//       };

//       console.log("📤 Request filter:", body.filter);

//       const { data } = await axios.post(API_URL, body, {
//         headers: { "Content-Type": "application/json" },
//         timeout: 60000,
//       });

//       logDataToFile(data);
//       console.log("Datos guardados en el archivo de log.");

//       const headers = data.invoices || data.headers || [];
//       const details = data.details || [];
//       totalPages = data.pages || totalPages; // Actualiza el total de páginas

//       console.log(`📥 Página ${currentPage}:`);
//       console.log(`   → Cabeceras recibidas: ${headers.length}`);
//       console.log(`   → Detalles recibidos : ${details.length}`);
//       console.log(`   → Total de páginas   : ${totalPages}`);

//       if (!headers.length) {
//         console.log("🏁 No hay más cabeceras, fin de paginación.");
//         break; // Sale del ciclo si no hay más cabeceras
//       }

//       totalHeaders += headers.length;
//       totalDetails += details.length;

//       // ===============================
//       // AGRUPAR DETALLES POR DOCUMENTO
//       // ===============================
//       const detallesPorDocumento = new Map();
//       for (const d of details) {
//         const rawCode = d.invoice_code || d.document_code || d.code;
//         const docCode = normalizeCode(rawCode);

//         if (!docCode) {
//           console.log("⚠️ Detalle ignorado por código inválido:", rawCode);
//           continue;
//         }

//         if (!detallesPorDocumento.has(docCode)) {
//           detallesPorDocumento.set(docCode, []);
//         }
//         detallesPorDocumento.get(docCode).push(d);
//       }

//       console.log(`🧩 Detalles agrupados en ${detallesPorDocumento.size} documentos`);

//       // ===============================
//       // PROCESAR CADA CABECERA
//       // ===============================
//       for (const doc of headers) {
//         const rawCode = doc.code;
//         const code = normalizeCode(rawCode);

//         if (!code) {
//           console.log("⚠️ Cabecera ignorada por CODE inválido:", rawCode);
//           continue;
//         }

//         const type = Number(doc.type); // 1 factura, 2 orden
//         const status = Number(doc.status);

//         // Fechas robustas
//         const creationDate = parseUnixToDate(doc.create_date || doc.store_date);
//         // const dispatchDate = parseUnixToDate(doc.dispatch_date);

//         const dispatchDate =
//           parseUnixToDate(doc.dispatch_date) ||
//           parseUnixToDate(doc.create_date) ||
//           parseUnixToDate(doc.store_date);


//         const customerCode = doc.customer_code || null;
//         const routeCode = doc.route?.code || doc.route_code || null;
//         const routeDescription =
//           doc.route?.description || doc.route_description || null;
//         const sellerCode = doc.seller_code || doc.user_code || null;

//         const total = toNumber(doc.total);
//         const subtotal = toNumber(doc.subtotal);
//         const iva = toNumber(doc.iva);
//         const discount = toNumber(doc.discount);

//         const parentId = doc.parent_id || null;
//         const latitude = doc.latitude ? Number(doc.latitude) : null;
//         const longitude = doc.longitude ? Number(doc.longitude) : null;

//         const conceptCode = doc.concept_code || null;
//         const conceptOrigin = doc.concept_origin || null;
//         const sequenceType = doc.sequence_type || null;
//         const notes = doc.notes || null;

//         // Fechas de autorización (solo facturas)
//         let fechaAutorizacion = null;
//         if (doc.auth_date) {
//           fechaAutorizacion = parseUnixToDate(doc.auth_date);
//         } else if (doc.authorization_date) {
//           fechaAutorizacion = parseUnixToDate(doc.authorization_date);
//         }
//         const authCode = doc.auth_code || null;
//         const accessKey = doc.access_key || doc.access_code || null;

//         const detallesDoc = detallesPorDocumento.get(code) || [];

//         // ===============================
//         // TRANSACCIÓN POR DOCUMENTO (Sequelize)
//         // ===============================
//         let tDoc;
//         try {
//           tDoc = await sequelize.transaction();

//           // 1) Upsert ruta
//           if (routeCode) {
//             const tipoRuta = inferTipoRuta(routeCode);
//             await RutaPreventa.upsert(
//               {
//                 codigo_ruta: routeCode,
//                 descripcion: routeDescription,
//                 tipo: tipoRuta,
//               },
//               { transaction: tDoc }
//             );
//           }

//           // 2) Upsert cliente
//           if (customerCode) {
//             const nombreCliente = doc.customer_name || null;
//             const direccionEntrega =
//               doc.delivery_address_code ||
//               doc.delivery_address ||
//               doc.address ||
//               null;
//             const telefono = doc.phone || null;
//             const email = doc.email || null;

//             await ClienteVenta.upsert(
//               {
//                 codigo_cliente: customerCode,
//                 nombre_cliente: nombreCliente,
//                 direccion_entrega: direccionEntrega,
//                 telefono,
//                 email,
//                 latitud: latitude,
//                 longitud: longitude,
//                 ruta_asignada: routeCode,
//               },
//               { transaction: tDoc }
//             );
//           }

//           // 3) Upsert FACTURA u ORDEN según type
//           if (type === 1) {
//             // FACTURA
//             totalFacturas++;
//             console.log(`🟢 FACTURA ${code} | status ${status}`);

//             await Factura.upsert(
//               {
//                 code,
//                 type,
//                 status,
//                 fecha_creacion: creationDate,
//                 fecha_autorizacion: fechaAutorizacion,
//                 fecha_entrega: dispatchDate,
//                 customer_code: customerCode,
//                 route_code: routeCode,
//                 seller_code: sellerCode,
//                 total,
//                 subtotal,
//                 iva,
//                 discount,
//                 parent_id: parentId,
//                 auth_code: authCode,
//                 access_key: accessKey,
//                 latitude,
//                 longitude,
//                 notes,
//               },
//               { transaction: tDoc }
//             );
//           } else if (type === 2) {

//             // ORDEN
//             totalOrdenes++;
//             console.log(`🔵 ORDEN ${code} | status ${status}`);

//             await Orden.upsert(
//               {
//                 code,
//                 type,
//                 status,
//                 fecha_creacion: creationDate,
//                 fecha_entrega: dispatchDate,
//                 customer_code: customerCode,
//                 route_code: routeCode,
//                 seller_code: sellerCode,
//                 total,
//                 subtotal,
//                 iva,
//                 discount,
//                 parent_id: parentId,
//                 latitude,
//                 longitude,
//                 concept_code: conceptCode,
//                 concept_origin: conceptOrigin,
//                 sequence_type: sequenceType,
//                 notes,
//               },
//               { transaction: tDoc }
//             );
//           } else {
//             console.log(`⚠️ Documento ${code} con type desconocido: ${type}`);
//           }

//           // 4) Detalles: borrar e insertar de nuevo
//           await DetalleDocumento.destroy({
//             where: { documento_code: code },
//             transaction: tDoc,
//           });

//           if (!detallesDoc.length) {
//             console.log(`⚠️ Documento ${code} sin detalles asociados`);
//           } else {
//             console.log(`📝 Documento ${code} → ${detallesDoc.length} detalles`);
//           }

//           for (const d of detallesDoc) {
//             const docCodeDet = normalizeCode(
//               d.invoice_code || d.document_code || code
//             );

//             const articleCode = d.article_code || d.item_code || null;
//             const desc = d.article_description || d.item_description || "";

//             const qty = toNumber(d.quantity);
//             const price = toNumber(d.price);
//             const sub = toNumber(d.subtotal);
//             const tot = toNumber(d.total);
//             const ivaDetalle = toNumber(d.iva);

//             const unitAlias = d.unit_alias || null;
//             const barcode = d.barcode || null;

//             // 🔥 NUEVOS CAMPOS (categoría en español)
//             const codigoCategoria = d.article_category_code || null;
//             const descripcionCategoria = d.article_category_description || null;

//             await DetalleDocumento.create(
//               {
//                 documento_code: docCodeDet,
//                 codigo_producto: articleCode,
//                 descripcion: desc,
//                 cantidad: qty,
//                 precio: price,
//                 subtotal: sub,
//                 total: tot,
//                 iva: ivaDetalle,
//                 unit_alias: unitAlias,
//                 barcode,

//                 // 🟩 Nuevos campos requeridos
//                 codigo_categoria: codigoCategoria,
//                 descripcion_categoria: descripcionCategoria,
//               },
//               { transaction: tDoc }
//             );

//             totalDetallesInsertados++;
//           }



//           await tDoc.commit();
//         } catch (errDoc) {
//           if (tDoc) await tDoc.rollback();
//           console.log(`❌ ERROR en documento ${code}:`, errDoc.message);
//           erroresPorDocumento.push({ code, error: errDoc.message });
//           // continúa con el siguiente documento
//         }
//       } // fin for headers

//       if (currentPage >= totalPages) {
//         console.log("🏁 Última página alcanzada, fin.");
//         break;
//       }

//       currentPage++; // Incrementar el número de página para la siguiente solicitud
//     }

//     // 5) Actualizar registro de sincronización
//     await SincronizacionVenta.update(
//       {
//         estado: "SUCCESS",
//         total_registros: totalHeaders,
//         mensaje: `Facturas: ${totalFacturas}, Órdenes: ${totalOrdenes}, Detalles: ${totalDetallesInsertados}, ErroresDoc: ${erroresPorDocumento.length}`,
//       },
//       { where: { id_sync: idSync } }
//     );

//     console.log(`\n====================================`);
//     console.log(`✅ SINCRONIZACIÓN COMPLETA`);
//     console.log(`   → Cabeceras totales : ${totalHeaders}`);
//     console.log(`   → Detalles totales  : ${totalDetails}`);
//     console.log(`   → Facturas          : ${totalFacturas}`);
//     console.log(`   → Órdenes           : ${totalOrdenes}`);
//     console.log(`   → Detalles insert.  : ${totalDetallesInsertados}`);
//     console.log(`   → Docs con error    : ${erroresPorDocumento.length}`);
//     console.log(`====================================\n`);

//     return {
//       idSync,
//       startDate,
//       endDate,
//       totalHeaders,
//       totalDetails,
//       totalFacturas,
//       totalOrdenes,
//       totalDetallesInsertados,
//       erroresPorDocumento,
//     };
//   } catch (err) {
//     console.error("❌ ERROR GLOBAL en sincronización:", err.message);

//     try {
//       await SincronizacionVenta.update(
//         {
//           estado: "FAILED",
//           mensaje: err.message,
//         },
//         { where: { id_sync: idSync } }
//       );
//     } catch (e2) {
//       console.error(
//         "❌ Error actualizando estado FAILED en sincronizaciones_ventas:",
//         e2.message
//       );
//     }

//     throw err;
//   }
// };

// module.exports = {
//   sincronizarVentasRango,
// };
