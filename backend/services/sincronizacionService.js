// services/sincronizacionService.js
require("dotenv").config();
const crypto = require('crypto');


const axios = require("axios");
const fs = require("fs");
const path = require("path");

const sequelize = require("../db");
const {
  Clientes,
  TipoNegocio,
  ClienteUsuarioVenta, //  NUEVO
  Factura,
  Orden,
  DetalleDocumento,
  SincronizacionVenta,
} = require("../models");


const Producto = require('../models/producto');

// Verifica que esto esté importado correctamente en tu archivo de servicio
const DireccionCliente = require('../models/DireccionCliente');



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

const normalizeCode = (v) => {
  if (!v && v !== 0) return null;
  return String(v).trim().replace(/^0+/, "");
};

// ===============================
// LOG DE ERRORES A ARCHIVO
// ===============================
const logErrorsToFile = (errores, filename = "errores.txt") => {
  const logFilePath = path.join(__dirname, filename);
  const timestamp = new Date().toISOString();
  const logContent = errores
    .map((error) => `\n[${timestamp}] - Error en documento ${error.code}:\n${JSON.stringify(error.error, null, 2)}`)
    .join("\n");

  try {
    fs.appendFileSync(logFilePath, logContent, "utf8");
    console.log("📝 Errores guardados en errores.txt");
  } catch (err) {
    console.error("❌ Error escribiendo archivo de log de errores:", err);
  }
};


const sanitizeCoordinate = (value, tipo) => {
  if (!value) return null;

  const num = parseFloat(value);

  if (!Number.isFinite(num)) return null;

  // Validación geográfica real
  if (tipo === "lat" && (num < -90 || num > 90)) return null;
  if (tipo === "lon" && (num < -180 || num > 180)) return null;

  return Number(num.toFixed(8));
};


// ================================================================
// SERVICIO PRINCIPAL
// ================================================================
const sincronizarVentasRango = async (startDate, endDate, syncState = null) => {
  console.log("\n====================================");
  console.log(`🚀 SINCRONIZACIÓN ${startDate} → ${endDate}`);
  console.log("====================================\n");

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
    console.error("❌ Error creando registro de sincronización:", err.message);
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

    console.log(`🔐 Sesión MobilVendor OK: ${session_id}`);

    let totalPages = 1;
    let currentPage = 1;

    while (currentPage <= totalPages) {
      console.log("\n-------------------------------");
      console.log(`📦 SOLICITANDO PÁGINA ${currentPage} / ${totalPages}`);
      console.log("-------------------------------");

      if (syncState) {
        syncState.page = currentPage;
        syncState.total = totalPages;
        syncState.percent = totalPages
          ? Math.round((currentPage / totalPages) * 100)
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

      console.log("📤 Request filter:", body.filter);

      const { data } = await axios.post(API_URL, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      });

      // logDataToFile(data);

      const headers = data.invoices || data.headers || [];
      const details = data.details || [];
      totalPages = data.pages || totalPages;

      console.log(`📥 Página ${currentPage}`);
      console.log(`   → Cabeceras: ${headers.length}`);
      console.log(`   → Detalles : ${details.length}`);
      console.log(`   → Total páginas : ${totalPages}`);

      if (!headers.length) {
        console.log("🏁 No hay más cabeceras");
        break;
      }

      totalHeaders += headers.length;
      totalDetails += details.length;

      // ===============================
      // AGRUPAR DETALLES
      // ===============================
      const detallesPorDocumento = new Map();
      for (const d of details) {
        const rawCode = d.invoice_code || d.document_code || d.code;
        const docCode = normalizeCode(rawCode);

        if (!docCode) {
          console.log("⚠️ Detalle ignorado por código inválido:", rawCode);
          continue;
        }

        if (!detallesPorDocumento.has(docCode)) {
          detallesPorDocumento.set(docCode, []);
        }
        detallesPorDocumento.get(docCode).push(d);
      }

      console.log(
        `🧩 Detalles agrupados en ${detallesPorDocumento.size} documentos`
      );

      // ===============================
      // PROCESAR CABECERAS
      // ===============================
      for (const doc of headers) {
        const rawCode = doc.code;
        const code = normalizeCode(rawCode);

        if (!code) {
          console.log("⚠️ Cabecera ignorada por código inválido:", rawCode);
          continue;
        }

        let tDoc;
        try {
          console.log(`🔄 Procesando documento ${code}`);
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
          // const sellerCode = doc.seller_code || doc.user_code || null;
          const sellerCode = (doc.seller_code || doc.user_code || "").toString().trim() || null;


          console.log(
            `📄 ${type === 1 ? "FACTURA" : "ORDEN"} ${code} | cliente=${customerCode} | vendedor=${sellerCode}`
          );


          // Función para convertir Unix timestamp a fecha en hora de Ecuador
          const parseUnixToEcuadorTime = (timestamp) => {
            if (!timestamp || timestamp === "Invalid date") {
              return new Date(); // Si no se pasa una fecha válida, se asigna la fecha actual
            }
            const date = new Date(timestamp * 1000);  // Convertir timestamp (segundos) a milisegundos
            const ecuadorTime = new Date(date.getTime() - (5 * 60 * 60 * 1000)); // Ajuste a UTC-5 (hora de Ecuador)
            return ecuadorTime;
          };


          // // ----- Tipo  de Negocio
          const businessTypeCode = doc.business_type_code || null;
          const businessTypeDescription = doc.business_type_description || null;

          // Crear tipo de negocio solo si existe código
          if (businessTypeCode) {
            await TipoNegocio.upsert(
              {
                codigo: businessTypeCode,
                descripcion: businessTypeDescription || businessTypeCode,
                estado: 1,
                fecha_creacion: new Date(),
                fecha_actualizacion: new Date(),
              },
              {
                transaction: tDoc,
                conflictFields: ["codigo"],
              }
            );
          }






          // // ----- CLIENTE
          if (customerCode) {
            await Clientes.upsert(
              {
                codigo_cliente: customerCode,
                company_id: 1,
                descripcion_company: "GRUPOAQUA S.A.",
                tipo_identificacion_cliente: doc.customer_identity_type || null,
                identificacion_cliente: doc.customer_identity || null,
                nombre_cliente: doc.customer_name || null,
                nombre_comercial_cliente: doc.company_name || doc.customer_name || null,
                contacto_cliente: doc.contact || null,
                codigo_tipo_negocio: doc.business_type_code || null,
                codigo_moneda_cliente: doc.currency_code || 'USD',
                codigo_lista_precio_cliente: doc.price_list_code || null,
                metodo_pago_cliente: doc.payment_method_description || null,
                codigo_grupo_cliente: doc.customer_group_code || null,
                descuento_cliente: doc.discount_p || 0.00,
                objetivo_venta_cliente: doc.goal_per_sale || null,
                saldo_cliente: doc.balance || 0.00,
                tiene_credito_cliente: doc.has_credit === "1",
                tiene_documentos_cliente: doc.has_documents === "1",
                estado_cliente: doc.status || 0,
                estado_proceso_cliente: doc.process_status || 0,
                nacionalidad_cliente: doc.nationality || null,
                codigo_usuario_asignado_cliente: doc.user_code || null,
                fecha_creacion_cliente: parseUnixToEcuadorTime(doc.create_date) || new Date(),
                fecha_actualizacion_cliente: parseUnixToEcuadorTime(doc.store_date) || new Date(),
              },
              {
                transaction: tDoc,
                conflictFields: ['codigo_cliente'],  // Aseguramos que 'codigo_cliente' sea único
              }
            );
            console.log(`Clientes ${customerCode} insertado/actualizado.`);
          }

          // ----- DIRECCIÓN DEL CLIENTE
          if (customerCode) {
            await DireccionCliente.upsert(
              {
                codigo_cliente: customerCode, // Relacionamos la dirección con el cliente
                descripcion_direccion_cliente: doc.address_description || null,
                codigo_direccion_cliente: doc.customer_address_code || null,
                calle1_direccion_cliente: doc.street1 || null,
                bloque_direccion_cliente: doc.block || null,
                calle2_direccion_cliente: doc.street2 || null,
                referencia_direccion_cliente: doc.reference || null,
                codigo_postal_direccion_cliente: doc.zipcode || null,
                telefono_direccion_cliente: doc.phone || null,
                fax_direccion_cliente: doc.fax || null,
                email_direccion_cliente: doc.email || null,
                latitud_direccion_cliente: sanitizeCoordinate(doc.address_lat, "lat"),
                longitud_direccion_cliente: sanitizeCoordinate(doc.address_lon, "lon"),

                fecha_ultima_visita_direccion_cliente: parseUnixToEcuadorTime(doc.last_visit_date) || null,
                estado_direccion_cliente: doc.location_status || 1,
                estado_ubicacion_direccion_cliente: doc.geo_area_code || 3,
                fecha_creacion_direccion_cliente: parseUnixToEcuadorTime(doc.create_date) || new Date(),
                fecha_actualizacion_direccion_cliente: parseUnixToEcuadorTime(doc.store_date) || new Date(),
              },
              {
                transaction: tDoc,
                conflictFields: ['codigo_cliente', 'codigo_direccion_cliente']
              }
            );
            console.log(`Dirección del cliente ${customerCode} insertada/actualizada.`);
          }


          // // ----- FACTURA / ORDEN
          if (type === 1) {
            totalFacturas++;
            console.log(`🟢 Guardando FACTURA ${code}`);

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

                //  NUEVO CAMPO
                customer_address_code:
                  doc.customer_address_code ||
                  doc.customer_address_code_2 ||
                  doc.customer_address ||
                  doc.customer_address_id ||
                  doc.delivery_address_code ||
                  doc.customer_address_code_1 ||
                  null,

                total: toNumber(doc.total),
                subtotal: toNumber(doc.subtotal),
                iva: toNumber(doc.iva),
                discount: toNumber(doc.discount),
              },
              { transaction: tDoc }
            );

          } else if (type === 2) {
            totalOrdenes++;
            console.log(`🔵 Guardando ORDEN ${code}`);

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
                origen_sistema: "MOBILVENDOR",

              },
              { transaction: tDoc }
            );
          }

          // // ----- RELACIÓN CLIENTE-USUARIO 
          if (customerCode && sellerCode) {
            console.log(
              `👤 Relacionando cliente ${customerCode} con usuario ${sellerCode}`
            );

            await ClienteUsuarioVenta.upsert(
              {
                codigo_cliente: customerCode,
                seller_code: sellerCode,
                ruta_code: routeCode || null,
                tipo_atencion: inferTipoRuta(routeCode),
                ultima_atencion: creationDate,
                codigo_direccion_cliente: doc.customer_address_code || 'DEFAULT',  // Aquí se asigna desde los datos del documento

              },
              {
                transaction: tDoc,
                conflictFields: ["codigo_cliente", "seller_code"],
              }
            );


          }

          // // // ----- DETALLES cuerpo
          await DetalleDocumento.destroy({
            where: { documento_code: code },
            transaction: tDoc,
          });

          const detallesDoc = detallesPorDocumento.get(code) || [];
          console.log(`📝 ${code} → ${detallesDoc.length} detalles`);



          const detallesUnicos = new Map();

          for (const d of detallesDoc) {
            const key = `${d.article_code}-${d.quantity}-${d.price}-${d.total}`;

            if (!detallesUnicos.has(key)) {
              detallesUnicos.set(key, d);
            } else {
              console.log(`⚠️ Detalle repetido eliminado: ${d.article_code}`);
            }
          }









          for (const d of detallesUnicos.values()) {

            // ===============================
            // SINCRONIZAR PRODUCTO
            // ===============================
            if (d.article_code) {
              await Producto.upsert(
                {
                  codigo_producto: d.article_code,
                  nombre_producto: d.article_description || "SIN NOMBRE",
                  nombre_alterno: d.article_alias || null,
                  codigo_barras: d.article_barcode || null,
                  codigo_marca: d.article_brand_code || null,
                  codigo_categoria: d.article_category_code || null,
                  codigo_familia: d.article_family_code || null,
                  codigo_unidad_medida: d.unit_code || null,
                  codigo_tipo_inventario: d.article_inv_type_code || null,
                  costo: toNumber(d.cost),
                  estado: 1,
                  tipo_producto: toNumber(d.article_type),
                },
                { transaction: tDoc }
              );

              console.log(`📦 Producto sincronizado: ${d.article_code}`);
            }

            // ===============================
            // CREAR DETALLE
            // ===============================
            await DetalleDocumento.create(
              {
                documento_code: code,
                codigo_producto: d.article_code || "SIN-CODIGO",
                descripcion: d.article_description || "",
                cantidad: toNumber(d.quantity),
                precio: toNumber(d.price),
                subtotal: toNumber(d.subtotal),
                total: toNumber(d.total),
                iva: toNumber(d.iva),
                unit_alias: d.unit_alias || null,
                barcode: d.barcode || null,
                codigo_categoria: d.article_category_code || null,
                descripcion_categoria: d.article_category_description || null,
              },
              { transaction: tDoc }
            );
          }
          await tDoc.commit();
          console.log(` Documento ${code} confirmado`);
        } catch (errDoc) {
          if (tDoc) await tDoc.rollback();
          console.log(`❌ ERROR en documento ${code}`);
          console.log("Detalles del error:", errDoc); // Ver todo el error
          console.log("Pila de ejecución:", errDoc.stack || "No disponible"); // Pila de ejecución del error

          erroresPorDocumento.push({
            code,
            error: {
              message: errDoc.message,
              stack: errDoc.stack,  // Esto te permitirá ver la pila de ejecución
              details: errDoc.errors || errDoc.parent || errDoc,
            }
          });
          console.log("Errores por documento:", erroresPorDocumento);
          // Guardar solo los errores en un archivo
          logErrorsToFile(erroresPorDocumento);

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

    // Agregar esta línea en el bloque donde ya estás procesando las cabeceras (después del proceso de facturas y órdenes)
    const totalClientes = await Clientes.count();  // Cuenta la cantidad total de clientes en la base de datos

    console.log("\n====================================");
    console.log(" SINCRONIZACIÓN COMPLETA");
    console.log(`   → Cabeceras : ${totalHeaders}`);
    console.log(`   → Detalles  : ${totalDetails}`);
    console.log(`   → Facturas  : ${totalFacturas}`);
    console.log(`   → Órdenes   : ${totalOrdenes}`);
    console.log(`   → Clientes  : ${totalClientes}`);  // Muestra la cantidad de clientes
    console.log(`   → Errores   : ${erroresPorDocumento.length}`);
    console.log("====================================\n");

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
    console.error("❌ ERROR GLOBAL:");
    console.error("Mensaje del error:", err.message);  // El mensaje del error
    console.error("Detalles del error:", err);  // El error completo (incluyendo el stack trace)

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
