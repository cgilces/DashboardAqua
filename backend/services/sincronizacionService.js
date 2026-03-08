// services/sincronizacionService.js
"use strict";

require("dotenv").config();

const axios      = require("axios");
const axiosRetry = require("axios-retry").default ?? require("axios-retry");
const fs         = require("fs");
const path       = require("path");

const sequelize = require("../db");
const {
  Clientes,
  TipoNegocio,
  ClienteUsuarioVenta,
  Factura,
  Orden,
  DetalleDocumento,
  SincronizacionVenta,
  Producto,
} = require("../models");

const DireccionCliente = require("../models/DireccionCliente");
const { API_URL }              = require("../config/config");
const { obtenerSesionActual }  = require("../utils/apiCliente");

// ================================================================
// CONFIGURACIÓN DE AXIOS CON RETRY AUTOMÁTICO
// MobilVendor puede tardar o fallar puntualmente; reintentamos 3 veces
// con backoff exponencial antes de dar el error por fatal.
// ================================================================
axiosRetry(axios, {
  retries      : 3,
  retryDelay   : axiosRetry.exponentialDelay,   // 1s → 2s → 4s
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) ||
    err.code === "ECONNABORTED" ||
    (err.response?.status >= 500),
  onRetry: (retryCount, err) =>
    console.warn(`⚠️  Reintento ${retryCount} para MobilVendor: ${err.message}`),
});

// ================================================================
// CONSTANTES
// ================================================================
const ECUADOR_TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5 (America/Guayaquil sin DST)
const API_PAGE_LIMIT        = 1000;
const LOG_FILE              = path.join(__dirname, "errores_sync.txt");
const COMPANY_ID            = 1;
const COMPANY_DESC          = "GRUPOAQUA S.A.";

// ================================================================
// HELPERS DE FECHA
// ================================================================

/**
 * Convierte un Unix timestamp (segundos) a Date ajustado a UTC-5 (Ecuador).
 * Nota: America/Guayaquil no observa DST, así que el offset fijo es correcto.
 * Si en algún momento la zona cambia, reemplazar por date-fns-tz:
 *   import { utcToZonedTime } from "date-fns-tz";
 *   return utcToZonedTime(new Date(ts * 1000), "America/Guayaquil");
 *
 * @param {number|string|null} value - Unix timestamp en segundos.
 * @returns {Date|null}
 */
const parseUnixToEcuador = (value) => {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000 - ECUADOR_TZ_OFFSET_MS);
};

// ================================================================
// HELPERS GENERALES
// ================================================================

/**
 * Convierte un valor a número finito; devuelve 0 si no es numérico.
 * @param {*} val
 * @returns {number}
 */
const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Infiere el tipo de ruta a partir del código.
 * @param {string} [codigo]
 * @returns {"PREVENTA"|"TELEVENTA"|"VIP"|null}
 */
const inferTipoRuta = (codigo = "") => {
  const c = (codigo || "").toUpperCase();
  if (c.startsWith("PV"))      return "PREVENTA";
  if (c.includes("TELE"))      return "TELEVENTA";
  if (c.includes("VIP"))       return "VIP";
  return null;
};

/**
 * Normaliza un código: elimina ceros a la izquierda y espacios.
 * @param {*} v
 * @returns {string|null}
 */
const normalizeCode = (v) => {
  if (v == null && v !== 0) return null;
  const s = String(v).trim().replace(/^0+/, "");
  return s.length ? s : null;
};

/**
 * Valida y sanitiza una coordenada geográfica.
 * @param {*}                 value
 * @param {"lat"|"lon"} tipo
 * @returns {number|null}
 */
const sanitizeCoordinate = (value, tipo) => {
  if (value == null) return null;
  const num = parseFloat(value);
  if (!Number.isFinite(num))                          return null;
  if (tipo === "lat" && (num < -90  || num > 90))     return null;
  if (tipo === "lon" && (num < -180 || num > 180))    return null;
  return Number(num.toFixed(8));
};

// ================================================================
// LOGGING DE ERRORES
// Acumula en memoria durante el sync y escribe UNA SOLA VEZ al final,
// evitando bloquear el event loop con writeFileSync en cada iteración.
// ================================================================

/**
 * Escribe al archivo de log todos los errores acumulados de una ejecución.
 * @param {{ code: string, error: object }[]} errores
 */
const flushErrorLog = (errores) => {
  if (!errores.length) return;
  const timestamp  = new Date().toISOString();
  const separator  = "─".repeat(60);
  const content    = errores
    .map(({ code, error }) =>
      `\n${separator}\n[${timestamp}] Documento: ${code}\n${JSON.stringify(error, null, 2)}`
    )
    .join("\n");

  try {
    fs.appendFileSync(LOG_FILE, content, "utf8");
    console.log(`📝 ${errores.length} error(es) guardado(s) en errores_sync.txt`);
  } catch (err) {
    console.error("❌ No se pudo escribir el archivo de log:", err.message);
  }
};

// ================================================================
// CLASE: SyncProgress
// Encapsula las mutaciones sobre el objeto de estado en tiempo real
// que el controlador expone al frontend (SSE / polling).
// Evita accesos directos a la estructura desde distintos puntos del código.
// ================================================================
class SyncProgress {
  /**
   * @param {object|null} state - Objeto de estado compartido con el controlador.
   */
  constructor(state) {
    this._s = state;
  }

  start(startDate, endDate) {
    if (!this._s) return;
    Object.assign(this._s, {
      running    : true,
      startDate,
      endDate,
      page       : 0,
      total      : 0,
      percent    : 0,
      error      : null,
      startedAt  : new Date(),
      finishedAt : null,
    });
  }

  updatePage(page, totalPages) {
    if (!this._s) return;
    this._s.page    = page;
    this._s.total   = totalPages;
    this._s.percent = totalPages
      ? Math.round((page / totalPages) * 100)
      : 0;
  }

  finish(error = null) {
    if (!this._s) return;
    this._s.running    = false;
    this._s.percent    = error ? this._s.percent : 100;
    this._s.error      = error ?? null;
    this._s.finishedAt = new Date();
  }
}

// ================================================================
// CLASE: SyncStats
// Agrupa todos los contadores del proceso para evitar variables sueltas
// y facilitar su serialización al registrar el resultado en BD.
// ================================================================
class SyncStats {
  headers  = 0;
  details  = 0;
  facturas = 0;
  ordenes  = 0;
  errores  = 0;

  /** Representación legible para el campo `mensaje` de SincronizacionVenta. */
  toMessage() {
    return (
      `Facturas:${this.facturas} ` +
      `Órdenes:${this.ordenes} ` +
      `Errores:${this.errores}`
    );
  }

  /** Log de resumen en consola. */
  print() {
    console.log("\n====================================");
    console.log("✅ SINCRONIZACIÓN COMPLETA");
    console.log(`   → Cabeceras : ${this.headers}`);
    console.log(`   → Detalles  : ${this.details}`);
    console.log(`   → Facturas  : ${this.facturas}`);
    console.log(`   → Órdenes   : ${this.ordenes}`);
    console.log(`   → Errores   : ${this.errores}`);
    console.log("====================================\n");
  }
}

// ================================================================
// PROCESADORES POR ENTIDAD
// Cada función recibe los datos crudos del documento y la transacción
// activa. Devuelven void; lanzan Error si algo falla.
// ================================================================

/**
 * Sincroniza el tipo de negocio del documento (upsert).
 */
async function syncTipoNegocio(doc, transaction) {
  const codigo = doc.business_type_code || null;
  if (!codigo) return;

  await TipoNegocio.upsert(
    {
      codigo,
      descripcion       : doc.business_type_description || codigo,
      estado            : 1,
      fecha_creacion    : new Date(),
      fecha_actualizacion: new Date(),
    },
    { transaction, conflictFields: ["codigo"] }
  );
}

/**
 * Sincroniza el cliente del documento (upsert).
 */
async function syncCliente(doc, customerCode, transaction) {
  if (!customerCode) return;

  await Clientes.upsert(
    {
      codigo_cliente                  : customerCode,
      company_id                      : COMPANY_ID,
      descripcion_company             : COMPANY_DESC,
      tipo_identificacion_cliente     : doc.customer_identity_type  || null,
      identificacion_cliente          : doc.customer_identity       || null,
      nombre_cliente                  : doc.customer_name           || null,
      nombre_comercial_cliente        : doc.company_name || doc.customer_name || null,
      contacto_cliente                : doc.contact                 || null,
      codigo_tipo_negocio             : doc.business_type_code      || null,
      codigo_moneda_cliente           : doc.currency_code           || "USD",
      codigo_lista_precio_cliente     : doc.price_list_code         || null,
      metodo_pago_cliente             : doc.payment_method_description || null,
      codigo_grupo_cliente            : doc.customer_group_code     || null,
      descuento_cliente               : doc.discount_p              || 0,
      objetivo_venta_cliente          : doc.goal_per_sale           || null,
      saldo_cliente                   : doc.balance                 || 0,
      tiene_credito_cliente           : doc.has_credit === "1",
      tiene_documentos_cliente        : doc.has_documents === "1",
      estado_cliente                  : doc.status                  || 0,
      estado_proceso_cliente          : doc.process_status          || 0,
      nacionalidad_cliente            : doc.nationality             || null,
      codigo_usuario_asignado_cliente : doc.user_code               || null,
      fecha_creacion_cliente          : parseUnixToEcuador(doc.create_date) || new Date(),
      fecha_actualizacion_cliente     : parseUnixToEcuador(doc.store_date)  || new Date(),
    },
    { transaction, conflictFields: ["codigo_cliente"] }
  );
}

/**
 * Sincroniza la dirección del cliente (upsert).
 */
async function syncDireccionCliente(doc, customerCode, transaction) {
  if (!customerCode) return;

  await DireccionCliente.upsert(
    {
      codigo_cliente                        : customerCode,
      descripcion_direccion_cliente         : doc.address_description  || null,
      codigo_direccion_cliente              : doc.customer_address_code || null,
      calle1_direccion_cliente              : doc.street1               || null,
      bloque_direccion_cliente              : doc.block                 || null,
      calle2_direccion_cliente              : doc.street2               || null,
      referencia_direccion_cliente          : doc.reference             || null,
      codigo_postal_direccion_cliente       : doc.zipcode               || null,
      telefono_direccion_cliente            : doc.phone                 || null,
      fax_direccion_cliente                 : doc.fax                   || null,
      email_direccion_cliente               : doc.email                 || null,
      latitud_direccion_cliente             : sanitizeCoordinate(doc.address_lat, "lat"),
      longitud_direccion_cliente            : sanitizeCoordinate(doc.address_lon, "lon"),
      fecha_ultima_visita_direccion_cliente : parseUnixToEcuador(doc.last_visit_date) || null,
      estado_direccion_cliente              : doc.location_status       || 1,
      estado_ubicacion_direccion_cliente    : doc.geo_area_code         || 3,
      fecha_creacion_direccion_cliente      : parseUnixToEcuador(doc.create_date) || new Date(),
      fecha_actualizacion_direccion_cliente : parseUnixToEcuador(doc.store_date)  || new Date(),
    },
    { transaction, conflictFields: ["codigo_cliente", "codigo_direccion_cliente"] }
  );
}

/**
 * Sincroniza la factura u orden según el tipo del documento.
 * @returns {"factura"|"orden"|null}
 */
async function syncDocumento(doc, code, transaction) {
  const type   = Number(doc.type);
  const status = Number(doc.status);

  const customerCode = doc.customer_code  || null;
  const routeCode    = doc.route?.code || doc.route_code || null;
  const sellerCode   = String(doc.seller_code || doc.user_code || "").trim() || null;

  const creationDate  = parseUnixToEcuador(doc.create_date || doc.store_date);
  const dispatchDate  =
    parseUnixToEcuador(doc.dispatch_date) ||
    parseUnixToEcuador(doc.create_date)   ||
    parseUnixToEcuador(doc.store_date);

  const basePayload = {
    code,
    type,
    status,
    fecha_creacion : creationDate,
    fecha_entrega  : dispatchDate,
    customer_code  : customerCode,
    route_code     : routeCode,
    seller_code    : sellerCode,
    total          : toNumber(doc.total),
    subtotal       : toNumber(doc.subtotal),
    iva            : toNumber(doc.iva),
    discount       : toNumber(doc.discount),
  };

  if (type === 1) {
    await Factura.upsert(
      {
        ...basePayload,
        customer_address_code:
          doc.customer_address_code   ||
          doc.customer_address_code_2 ||
          doc.customer_address        ||
          doc.customer_address_id     ||
          doc.delivery_address_code   ||
          doc.customer_address_code_1 ||
          null,
      },
      { transaction }
    );
    return "factura";
  }

  if (type === 2) {
    await Orden.upsert(
      { ...basePayload, origen_sistema: "MOBILVENDOR" },
      { transaction }
    );
    return "orden";
  }

  return null;
}

/**
 * Sincroniza la relación Cliente → Usuario/Vendedor.
 */
async function syncClienteUsuario(doc, code, customerCode, transaction) {
  const routeCode  = doc.route?.code || doc.route_code || null;
  const sellerCode = String(doc.seller_code || doc.user_code || "").trim() || null;

  if (!customerCode || !sellerCode) return;

  const creationDate = parseUnixToEcuador(doc.create_date || doc.store_date);

  await ClienteUsuarioVenta.upsert(
    {
      codigo_cliente         : customerCode,
      seller_code            : sellerCode,
      ruta_code              : routeCode || null,
      tipo_atencion          : inferTipoRuta(routeCode),
      ultima_atencion        : creationDate,
      codigo_direccion_cliente: doc.customer_address_code || "DEFAULT",
    },
    { transaction, conflictFields: ["codigo_cliente", "seller_code"] }
  );
}

/**
 * Deduplica los detalles de un documento.
 *
 * Criterio: si el mismo artículo aparece más de una vez (puede pasar por
 * errores del dispositivo móvil), se suman las cantidades en lugar de
 * descartar silenciosamente, preservando el valor económico real.
 *
 * @param {object[]} detallesDoc
 * @returns {object[]}
 */
function deduplicateDetails(detallesDoc) {
  const map = new Map();

  for (const d of detallesDoc) {
    const key = d.article_code;

    if (!key) {
      console.warn("⚠️  Detalle sin article_code ignorado.");
      continue;
    }

    if (map.has(key)) {
      // Acumular cantidades en lugar de descartar
      const existing     = map.get(key);
      existing.quantity  = toNumber(existing.quantity) + toNumber(d.quantity);
      existing.subtotal  = toNumber(existing.subtotal) + toNumber(d.subtotal);
      existing.total     = toNumber(existing.total)    + toNumber(d.total);
      console.log(`🔀 Detalle duplicado fusionado: ${key} (+${d.quantity} uds)`);
    } else {
      map.set(key, { ...d });
    }
  }

  return [...map.values()];
}

/**
 * Sincroniza el producto y el detalle de un documento.
 */
async function syncDetalle(detalle, documentCode, transaction) {
  // --- Producto ---
  if (detalle.article_code) {
    await Producto.upsert(
      {
        codigo_producto        : detalle.article_code,
        nombre_producto        : detalle.article_description || "SIN NOMBRE",
        nombre_alterno         : detalle.article_alias         || null,
        codigo_barras          : detalle.article_barcode        || null,
        codigo_marca           : detalle.article_brand_code     || null,
        codigo_categoria       : detalle.article_category_code  || null,
        codigo_familia         : detalle.article_family_code    || null,
        codigo_unidad_medida   : detalle.unit_code              || null,
        codigo_tipo_inventario : detalle.article_inv_type_code  || null,
        costo                  : toNumber(detalle.cost),
        estado                 : 1,
        tipo_producto          : toNumber(detalle.article_type),
      },
      { transaction }
    );
  }

  // --- Detalle del documento ---
  await DetalleDocumento.upsert(
    {
      documento_code        : documentCode,
      codigo_producto       : detalle.article_code          || "SIN-CODIGO",
      descripcion           : detalle.article_description   || "",
      cantidad              : toNumber(detalle.quantity),
      precio                : toNumber(detalle.price),
      subtotal              : toNumber(detalle.subtotal),
      total                 : toNumber(detalle.total),
      iva                   : toNumber(detalle.iva),
      unit_alias            : detalle.unit_alias             || null,
      barcode               : detalle.barcode                || null,
      codigo_categoria      : detalle.article_category_code  || null,
      descripcion_categoria : detalle.article_category_description || null,
    },
    {
      transaction,
      conflictFields: ["documento_code", "codigo_producto"],
    }
  );
}

// ================================================================
// PROCESADOR DE UN DOCUMENTO COMPLETO
// Ejecuta todas las operaciones dentro de una transacción atómica.
// Si cualquier paso falla, hace rollback del documento completo
// sin afectar al resto de la sincronización.
// ================================================================

/**
 * @param {object}               doc
 * @param {Map<string,object[]>} detallesPorDocumento
 * @param {SyncStats}            stats
 * @returns {Promise<void>}
 * @throws si el código del documento es inválido o la transacción falla.
 */
async function procesarDocumento(doc, detallesPorDocumento, stats) {
  const rawCode = doc.code;
  const code    = normalizeCode(rawCode);

  if (!code) {
    console.warn(`⚠️  Cabecera ignorada por código inválido: ${rawCode}`);
    return;
  }

  const customerCode = doc.customer_code || null;

  console.log(`\n🔄 Documento ${code} | tipo=${doc.type} | cliente=${customerCode}`);

  const t = await sequelize.transaction();

  try {
    // 1. Entidades maestras
    await syncTipoNegocio(doc, t);
    await syncCliente(doc, customerCode, t);
    await syncDireccionCliente(doc, customerCode, t);

    // 2. Documento principal (factura u orden)
    const tipoDoc = await syncDocumento(doc, code, t);
    if (tipoDoc === "factura") stats.facturas++;
    else if (tipoDoc === "orden") stats.ordenes++;

    // 3. Relación cliente-vendedor
    await syncClienteUsuario(doc, code, customerCode, t);

    // 4. Detalles
    //    Estrategia: eliminar los existentes y reinsertar los nuevos (dentro
    //    de la misma transacción para que el rollback los restaure si falla).
    await DetalleDocumento.destroy({ where: { documento_code: code }, transaction: t });

    const rawDetails    = detallesPorDocumento.get(code) || [];
    const dedupDetails  = deduplicateDetails(rawDetails);

    for (const detalle of dedupDetails) {
      await syncDetalle(detalle, code, t);
    }

    await t.commit();
    console.log(`   ✅ ${code} confirmado (${dedupDetails.length} detalles)`);

  } catch (err) {
    await t.rollback();
    throw err; // El llamador lo capturará y registrará el error
  }
}

// ================================================================
// SERVICIO PRINCIPAL
// ================================================================

/**
 * Sincroniza las ventas (facturas + órdenes) de MobilVendor para el
 * rango de fechas indicado, página a página, con reintentos automáticos.
 *
 * @param {string}      startDate  - Fecha inicio "YYYY-MM-DD".
 * @param {string}      endDate    - Fecha fin   "YYYY-MM-DD".
 * @param {object|null} syncState  - Estado compartido para SSE/polling (mutable).
 * @returns {Promise<{
 *   idSync: number,
 *   stats: SyncStats,
 *   erroresPorDocumento: { code: string, error: object }[]
 * }>}
 */
const sincronizarVentasRango = async (startDate, endDate, syncState = null) => {
  console.log("\n====================================");
  console.log(`🚀 SINCRONIZACIÓN ${startDate} → ${endDate}`);
  console.log("====================================\n");

  const progress = new SyncProgress(syncState);
  const stats    = new SyncStats();
  const erroresPorDocumento = [];

  progress.start(startDate, endDate);

  // ── Crear registro de sincronización en BD ───────────────────────
  let syncRow;
  try {
    syncRow = await SincronizacionVenta.create({
      desde_date     : startDate,
      hasta_date     : endDate,
      estado         : "EN_PROCESO",
      total_registros: 0,
      mensaje        : null,
    });
  } catch (err) {
    console.error("❌ Error creando registro de sincronización:", err.message);
    progress.finish(err.message);
    throw err;
  }

  const idSync = syncRow.id_sync;
  console.log(`📝 Sync ID: ${idSync}`);

  try {
    // ── Verificar sesión MobilVendor ───────────────────────────────
    const session_id = await obtenerSesionActual();
    if (!session_id) throw new Error("No hay sesión activa con MobilVendor.");
    console.log(`🔐 Sesión MobilVendor OK: ${session_id}`);

    let totalPages  = 1;
    let currentPage = 1;

    // ── Loop de páginas ────────────────────────────────────────────
    while (currentPage <= totalPages) {
      console.log(`\n📦 PÁGINA ${currentPage} / ${totalPages}`);
      progress.updatePage(currentPage, totalPages);

      // Petición a MobilVendor (con retry automático por axiosRetry)
      const { data } = await axios.post(
        API_URL,
        {
          session_id,
          action: "getInvoices",
          filter: {
            process_status: "0,1,2,3,4,5",
            type           : "1,2",
            status         : "0,1,2,5,10",
            start_date     : startDate,
            end_date       : endDate,
            limit          : API_PAGE_LIMIT,
            page           : currentPage,
          },
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 120_000,
        }
      );

      const headers  = data.invoices || data.headers || [];
      const details  = data.details  || [];
      totalPages     = data.pages    || totalPages;

      console.log(`   → Cabeceras: ${headers.length} | Detalles: ${details.length} | Páginas: ${totalPages}`);

      if (!headers.length) {
        console.log("🏁 Sin más cabeceras — finalizando paginación.");
        break;
      }

      stats.headers += headers.length;
      stats.details += details.length;

      // ── Agrupar detalles por código de documento ─────────────────
      const detallesPorDocumento = new Map();

      for (const d of details) {
        const rawCode = d.invoice_code || d.document_code || d.code;
        const docCode = normalizeCode(rawCode);

        if (!docCode) {
          console.warn(`⚠️  Detalle ignorado, código inválido: ${rawCode}`);
          continue;
        }

        if (!detallesPorDocumento.has(docCode)) detallesPorDocumento.set(docCode, []);
        detallesPorDocumento.get(docCode).push(d);
      }

      // ── Procesar cada cabecera ───────────────────────────────────
      for (const doc of headers) {
        const code = normalizeCode(doc.code);

        try {
          await procesarDocumento(doc, detallesPorDocumento, stats);
        } catch (errDoc) {
          stats.errores++;
          const errorEntry = {
            code : code ?? doc.code,
            error: {
              message: errDoc.message,
              stack  : errDoc.stack,
              details: errDoc.errors || errDoc.parent || null,
            },
          };
          erroresPorDocumento.push(errorEntry);
          console.error(`❌ ERROR documento ${code}: ${errDoc.message}`);
        }
      }

      currentPage++;
    } // fin while

    // ── Escribir log de errores UNA SOLA VEZ al final ────────────
    flushErrorLog(erroresPorDocumento);

    // ── Actualizar registro de sincronización como exitoso ────────
    await SincronizacionVenta.update(
      {
        estado          : "SUCCESS",
        total_registros : stats.headers,
        mensaje         : stats.toMessage(),
      },
      { where: { id_sync: idSync } }
    );

    stats.print();
    progress.finish();

    return { idSync, stats, erroresPorDocumento };

  } catch (err) {
    // Error global (fallo de sesión, red, BD fuera de servicio, etc.)
    console.error("\n❌ ERROR GLOBAL DE SINCRONIZACIÓN:");
    console.error("Mensaje:", err.message);
    console.error("Stack:",   err.stack);

    await SincronizacionVenta.update(
      { estado: "FAILED", mensaje: err.message },
      { where: { id_sync: idSync } }
    ).catch(() => {}); // No ocultar el error original si este update también falla

    progress.finish(err.message);
    throw err;
  }
};

// ================================================================
// EXPORTS
// ================================================================
module.exports = { sincronizarVentasRango };