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
