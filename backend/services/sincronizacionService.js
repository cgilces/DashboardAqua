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
    Subcanal, //  AGREGAR
  ClienteUsuarioVenta,
  Factura,
  Orden,
  DetalleDocumento,
  SincronizacionVenta,
  Producto,
} = require("../models");

const DireccionCliente = require("../models/DireccionCliente");
const { API_URL }             = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

// ================================================================
// CONFIGURACIÓN DE AXIOS CON RETRY AUTOMÁTICO
// ================================================================
axiosRetry(axios, {
  retries      : 3,
  retryDelay   : axiosRetry.exponentialDelay,
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
const ECUADOR_TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const API_PAGE_LIMIT        = 1000;
const LOG_FILE              = path.join(__dirname, "errores_sync.txt");
const COMPANY_ID            = 1;
const COMPANY_DESC          = "GRUPOAQUA S.A.";

// ================================================================
// HELPERS DE FECHA
// ================================================================
const parseUnixToEcuador = (value) => {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000 - ECUADOR_TZ_OFFSET_MS);
};

// ================================================================
// HELPERS GENERALES
// ================================================================
const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const inferTipoRuta = (codigo = "") => {
  const c = (codigo || "").toUpperCase();
  if (c.startsWith("PV"))  return "PREVENTA";
  if (c.includes("TELE"))  return "TELEVENTA";
  if (c.includes("VIP"))   return "VIP";
  return null;
};

const normalizeCode = (v) => {
  if (v == null && v !== 0) return null;
  const s = String(v).trim().replace(/^0+/, "");
  return s.length ? s : null;
};

const sanitizeCoordinate = (value, tipo) => {
  if (value == null) return null;
  const num = parseFloat(value);
  if (!Number.isFinite(num))                       return null;
  if (tipo === "lat" && (num < -90  || num > 90))  return null;
  if (tipo === "lon" && (num < -180 || num > 180)) return null;
  return Number(num.toFixed(8));
};

// ================================================================
// LOGGING DE ERRORES
// ================================================================
const flushErrorLog = (errores) => {
  if (!errores.length) return;
  const timestamp = new Date().toISOString();
  const separator = "─".repeat(60);
  const content   = errores
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
// ================================================================
class SyncProgress {
  constructor(state) {
    this._s = state;
  }

  start(startDate, endDate) {
    if (!this._s) return;
    Object.assign(this._s, {
      running   : true,
      startDate,
      endDate,
      page      : 0,
      total     : 0,
      percent   : 0,
      error     : null,
      startedAt : new Date(),
      finishedAt: null,
    });
  }

  updatePage(page, totalPages) {
    if (!this._s) return;
    // MobilVendor ocupa del 5% al 70% del progreso total
    if (totalPages) {
      this._s.percent = 5 + Math.round((page / totalPages) * 65);
    }
  }

  finish(error = null) {
    if (!this._s) return;
    // No marcar running=false ni finishedAt aquí.
    // El controller se encarga cuando TODOS los procesos terminan.
    if (error) {
      this._s.error = error;
    }
  }
}

// ================================================================
// CLASE: SyncStats
// ================================================================
class SyncStats {
  headers  = 0;
  details  = 0;
  facturas = 0;
  ordenes  = 0;
  errores  = 0;

  toMessage() {
    return (
      `Facturas:${this.facturas} ` +
      `Órdenes:${this.ordenes} ` +
      `Errores:${this.errores}`
    );
  }

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
// ================================================================

async function syncTipoNegocio(doc, transaction) {
  const codigo = doc.business_type_code || null;
  if (!codigo) return;

  await TipoNegocio.upsert(
    {
      codigo,
      descripcion        : doc.business_type_description || codigo,
      estado             : 1,
      fecha_creacion     : new Date(),
      fecha_actualizacion: new Date(),
    },
    { transaction, conflictFields: ["codigo"] }
  );
}



async function syncTipoNegocio(doc, transaction) {
  const codigo = doc.business_type_code || null;
  if (!codigo) return;

  await TipoNegocio.upsert(
    {
      codigo,
      descripcion        : doc.business_type_description || codigo,
      estado             : 1,
      fecha_creacion     : new Date(),
      fecha_actualizacion: new Date(),
    },
    { transaction, conflictFields: ["codigo"] }
  );
}

//  NUEVO: SUBCANAL
async function syncSubcanal(doc, transaction) {
  const codigo = doc.subchannel_code || null;
  if (!codigo) return;

  await Subcanal.upsert(
    {
      codigo_subcanal      : codigo,
      descripcion_subcanal : doc.subchannel_description || codigo,
      estado               : 1,
      fecha_creacion       : new Date(),
      fecha_actualizacion  : new Date(),
    },
    {
      transaction,
      conflictFields: ["codigo_subcanal"]
    }
  );
}

async function syncCliente(doc, customerCode, transaction) {
  if (!customerCode) return;

  await Clientes.upsert(
    {
      codigo_cliente                  : customerCode,
      company_id                      : COMPANY_ID,
      descripcion_company             : COMPANY_DESC,
      tipo_identificacion_cliente     : doc.customer_identity_type     || null,
      identificacion_cliente          : doc.customer_identity          || null,
      nombre_cliente                  : doc.customer_name              || null,
      nombre_comercial_cliente        : doc.company_name || doc.customer_name || null,
      contacto_cliente                : doc.contact                    || null,
      codigo_tipo_negocio             : doc.business_type_code         || null,
      codigo_subcanal                 : doc.subchannel_code            || null,
      codigo_moneda_cliente           : doc.currency_code              || "USD",
      codigo_lista_precio_cliente     : doc.price_list_code            || null,
      metodo_pago_cliente             : doc.payment_method_description || null,
      codigo_grupo_cliente            : doc.customer_group_code        || null,
      descuento_cliente               : doc.discount_p                 || 0,
      objetivo_venta_cliente          : doc.goal_per_sale              || null,
      saldo_cliente                   : doc.balance                    || 0,
      tiene_credito_cliente           : doc.has_credit === "1",
      tiene_documentos_cliente        : doc.has_documents === "1",
      estado_cliente                  : doc.status                     || 0,
      estado_proceso_cliente          : doc.process_status             || 0,
      nacionalidad_cliente            : doc.nationality                || null,
      codigo_usuario_asignado_cliente : doc.user_code                  || null,
      fecha_creacion_cliente          : parseUnixToEcuador(doc.create_date) || new Date(),
      fecha_actualizacion_cliente     : parseUnixToEcuador(doc.store_date)  || new Date(),
    },
    { transaction, conflictFields: ["codigo_cliente"] }
  );
}

/**
 * CORREGIDO: SQL nativo para garantizar ON CONFLICT sobre
 * el constraint real (codigo_cliente, codigo_direccion_cliente).
 * Sequelize ignora conflictFields en upsert con esta versión del driver.
 */
async function syncDireccionCliente(doc, customerCode, transaction) {
  if (!customerCode) return;

  const codigoDireccion = doc.customer_address_code || null;
  if (!codigoDireccion) return;

  // CORREGIDO: truncar zipcode a 20 chars para respetar VARCHAR(20)
  const zipcode = doc.zipcode
    ? String(doc.zipcode).substring(0, 20)
    : null;

  await sequelize.query(
    `INSERT INTO direcciones_clientes (
        codigo_cliente,
        codigo_direccion_cliente,
        descripcion_direccion_cliente,
        calle1_direccion_cliente,
        bloque_direccion_cliente,
        calle2_direccion_cliente,
        referencia_direccion_cliente,
        codigo_postal_direccion_cliente,
        telefono_direccion_cliente,
        fax_direccion_cliente,
        email_direccion_cliente,
        latitud_direccion_cliente,
        longitud_direccion_cliente,
        fecha_ultima_visita_direccion_cliente,
        estado_direccion_cliente,
        estado_ubicacion_direccion_cliente,
        fecha_creacion_direccion_cliente,
        fecha_actualizacion_direccion_cliente
      ) VALUES (
        :codigo_cliente,
        :codigo_direccion_cliente,
        :descripcion,
        :calle1,
        :bloque,
        :calle2,
        :referencia,
        :zip,
        :telefono,
        :fax,
        :email,
        :latitud,
        :longitud,
        :fecha_ultima_visita,
        :estado,
        :estado_ubicacion,
        :fecha_creacion,
        :fecha_actualizacion
      )
      ON CONFLICT (codigo_cliente, codigo_direccion_cliente)
      DO UPDATE SET
        descripcion_direccion_cliente         = COALESCE(EXCLUDED.descripcion_direccion_cliente, direcciones_clientes.descripcion_direccion_cliente),
        calle1_direccion_cliente              = COALESCE(EXCLUDED.calle1_direccion_cliente, direcciones_clientes.calle1_direccion_cliente),
        bloque_direccion_cliente              = COALESCE(EXCLUDED.bloque_direccion_cliente, direcciones_clientes.bloque_direccion_cliente),
        calle2_direccion_cliente              = COALESCE(EXCLUDED.calle2_direccion_cliente, direcciones_clientes.calle2_direccion_cliente),
        referencia_direccion_cliente          = COALESCE(EXCLUDED.referencia_direccion_cliente, direcciones_clientes.referencia_direccion_cliente),
        codigo_postal_direccion_cliente       = COALESCE(EXCLUDED.codigo_postal_direccion_cliente, direcciones_clientes.codigo_postal_direccion_cliente),
        telefono_direccion_cliente            = COALESCE(EXCLUDED.telefono_direccion_cliente, direcciones_clientes.telefono_direccion_cliente),
        fax_direccion_cliente                 = COALESCE(EXCLUDED.fax_direccion_cliente, direcciones_clientes.fax_direccion_cliente),
        email_direccion_cliente               = COALESCE(EXCLUDED.email_direccion_cliente, direcciones_clientes.email_direccion_cliente),
        latitud_direccion_cliente             = COALESCE(EXCLUDED.latitud_direccion_cliente, direcciones_clientes.latitud_direccion_cliente),
        longitud_direccion_cliente            = COALESCE(EXCLUDED.longitud_direccion_cliente, direcciones_clientes.longitud_direccion_cliente),
        fecha_ultima_visita_direccion_cliente = COALESCE(EXCLUDED.fecha_ultima_visita_direccion_cliente, direcciones_clientes.fecha_ultima_visita_direccion_cliente),
        estado_direccion_cliente              = EXCLUDED.estado_direccion_cliente,
        estado_ubicacion_direccion_cliente    = EXCLUDED.estado_ubicacion_direccion_cliente,
        fecha_actualizacion_direccion_cliente = EXCLUDED.fecha_actualizacion_direccion_cliente`,
    {
      replacements: {
        codigo_cliente          : String(customerCode),
        codigo_direccion_cliente: String(codigoDireccion),
        descripcion             : (doc.address_description && doc.address_description !== "delivery" && doc.address_description !== "other")
                                    ? doc.address_description : null,
        calle1                  : doc.street1              || null,
        bloque                  : doc.block                || null,
        calle2                  : doc.street2              || null,
        referencia              : doc.reference            || null,
        zip                     : zipcode,
        telefono                : doc.phone                || null,
        fax                     : doc.fax                  || null,
        email                   : doc.email                || null,
        latitud                 : sanitizeCoordinate(doc.address_lat, "lat"),
        longitud                : sanitizeCoordinate(doc.address_lon, "lon"),
        fecha_ultima_visita     : parseUnixToEcuador(doc.last_visit_date) || null,
        estado                  : doc.location_status  || 1,
        estado_ubicacion        : doc.geo_area_code    || 3,
        fecha_creacion          : parseUnixToEcuador(doc.create_date) || new Date(),
        fecha_actualizacion     : parseUnixToEcuador(doc.store_date)  || new Date(),
      },
      transaction,
      type: sequelize.QueryTypes.INSERT,
    }
  );
}

// ================================================================
// SINCRONIZACIÓN DE DIRECCIONES DESDE customer_addresses
// ================================================================
/**
 * Consulta directamente el endpoint customer_addresses de MobilVendor
 * para obtener descripción, latitud y longitud correctas.
 */
const sincronizarDirecciones = async (syncState = null) => {
  console.log("\n====================================");
  console.log("🚀 SINCRONIZACIÓN DE DIRECCIONES (customer_addresses)");
  console.log("====================================\n");

  const progress = new SyncProgress(syncState);
  progress.start("direcciones", "completo");

  try {
    const session_id = await obtenerSesionActual();
    if (!session_id) throw new Error("No hay sesión activa con MobilVendor.");
    console.log(`🔐 Sesión MobilVendor OK: ${session_id}`);

    let totalPages  = 1;
    let currentPage = 1;
    let totalProcessed = 0;
    let totalErrors    = 0;

    while (currentPage <= totalPages) {
      console.log(`\n📦 PÁGINA ${currentPage} / ${totalPages}`);
      progress.updatePage(currentPage, totalPages);

      const { data } = await axios.post(
        API_URL,
        {
          session_id,
          action: "get",
          schema: "customer_addresses",
          page  : currentPage,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 120_000,
        }
      );

      const records = data.records || [];
      totalPages    = data.pages   || totalPages;

      console.log(`   → Registros: ${records.length} | Páginas: ${totalPages}`);

      if (!records.length) {
        console.log("🏁 Sin más registros — finalizando.");
        break;
      }

      for (const addr of records) {
        const customerCode    = addr.customer_code || null;
        const codigoDireccion = addr.code          || null;

        if (!customerCode || !codigoDireccion) continue;

        const zipcode = addr.zipcode
          ? String(addr.zipcode).substring(0, 20)
          : null;

        try {
          const [, rowCount] = await sequelize.query(
            `UPDATE direcciones_clientes SET
                descripcion_direccion_cliente         = :descripcion,
                calle1_direccion_cliente              = COALESCE(:calle1, calle1_direccion_cliente),
                bloque_direccion_cliente              = COALESCE(:bloque, bloque_direccion_cliente),
                calle2_direccion_cliente              = COALESCE(:calle2, calle2_direccion_cliente),
                referencia_direccion_cliente          = COALESCE(:referencia, referencia_direccion_cliente),
                codigo_postal_direccion_cliente       = COALESCE(:zip, codigo_postal_direccion_cliente),
                telefono_direccion_cliente            = COALESCE(:telefono, telefono_direccion_cliente),
                fax_direccion_cliente                 = COALESCE(:fax, fax_direccion_cliente),
                email_direccion_cliente               = COALESCE(:email, email_direccion_cliente),
                latitud_direccion_cliente             = COALESCE(:latitud, latitud_direccion_cliente),
                longitud_direccion_cliente            = COALESCE(:longitud, longitud_direccion_cliente),
                fecha_ultima_visita_direccion_cliente = COALESCE(:fecha_ultima_visita, fecha_ultima_visita_direccion_cliente),
                fecha_actualizacion_direccion_cliente = :fecha_actualizacion
              WHERE codigo_cliente = :codigo_cliente
                AND codigo_direccion_cliente = :codigo_direccion_cliente`,
            {
              replacements: {
                codigo_cliente          : String(customerCode),
                codigo_direccion_cliente: String(codigoDireccion),
                descripcion             : addr.description        || null,
                calle1                  : addr.street1            || null,
                bloque                  : addr.block              || null,
                calle2                  : addr.street2            || null,
                referencia              : addr.reference          || null,
                zip                     : zipcode,
                telefono                : addr.phone              || null,
                fax                     : addr.fax                || null,
                email                   : addr.email              || null,
                latitud                 : sanitizeCoordinate(addr.lat, "lat"),
                longitud                : sanitizeCoordinate(addr.lon, "lon"),
                fecha_ultima_visita     : parseUnixToEcuador(addr.last_visit_date) || null,
                fecha_actualizacion     : parseUnixToEcuador(addr.u) || new Date(),
              },
              type: sequelize.QueryTypes.UPDATE,
            }
          );
          if (rowCount > 0) totalProcessed++;
        } catch (err) {
          totalErrors++;
          if (totalErrors <= 5) {
            console.error(`❌ Error dirección ${codigoDireccion} (cliente ${customerCode}): ${err.message}`);
          }
        }
      }

      currentPage++;
    }

    console.log("\n====================================");
    console.log("✅ SINCRONIZACIÓN DE DIRECCIONES COMPLETA");
    console.log(`   → Procesadas : ${totalProcessed}`);
    console.log(`   → Errores    : ${totalErrors}`);
    console.log("====================================\n");

    progress.finish();
    return { totalProcessed, totalErrors };

  } catch (err) {
    console.error("\n❌ ERROR SINCRONIZACIÓN DIRECCIONES:", err.message);
    progress.finish(err.message);
    throw err;
  }
};

async function syncDocumento(doc, code, transaction) {
  const type   = Number(doc.type);
  const status = Number(doc.status);

  const customerCode = doc.customer_code  || null;
  const routeCode    = doc.route?.code || doc.route_code || null;
  const sellerCode   = String(doc.seller_code || doc.user_code || "").trim() || null;

  // DEBUG TEMPORAL — ver campos de fecha cuando create_date falta
  if (!doc.create_date || Number(doc.create_date) <= 0) {
    console.log(`[DEBUG fechas] code=${doc.code} | create_date=${doc.create_date} | store_date=${doc.store_date} | dispatch_date=${doc.dispatch_date} | date=${doc.date} | document_date=${doc.document_date} | order_date=${doc.order_date}`);
  }
  const creationDate = parseUnixToEcuador(doc.create_date || doc.store_date);
  const dispatchDate =
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
      { 
        ...basePayload,
        origen_sistema: "MOBILVENDOR",

        // 🔥 NUEVOS CAMPOS
        codigo_subcanal: doc.subchannel_code || null,
        codigo_tipo_negocio: doc.business_type_code || null
      },
      { transaction }
    );
    return "orden";
  }

  return null;
}

async function syncClienteUsuario(doc, code, customerCode, transaction) {
  const routeCode  = doc.route?.code || doc.route_code || null;
  const sellerCode = String(doc.seller_code || doc.user_code || "").trim() || null;

  if (!customerCode || !sellerCode) return;

  const creationDate = parseUnixToEcuador(doc.create_date || doc.store_date);

  await ClienteUsuarioVenta.upsert(
    {
      codigo_cliente          : customerCode,
      seller_code             : sellerCode,
      ruta_code               : routeCode || null,
      tipo_atencion           : inferTipoRuta(routeCode),
      ultima_atencion         : creationDate,
      codigo_direccion_cliente: doc.customer_address_code || "DEFAULT",
    },
  { 
    transaction, 
    conflictFields: ["codigo_cliente", "seller_code", "codigo_direccion_cliente"] 
  });
}

function deduplicateDetails(detallesDoc) {
  const map = new Map();

  for (const d of detallesDoc) {
    const key = d.article_code;

    if (!key) {
      console.warn("⚠️  Detalle sin article_code ignorado.");
      continue;
    }

    if (map.has(key)) {
      const existing    = map.get(key);
      existing.quantity = toNumber(existing.quantity) + toNumber(d.quantity);
      existing.subtotal = toNumber(existing.subtotal) + toNumber(d.subtotal);
      existing.total    = toNumber(existing.total)    + toNumber(d.total);
      console.log(`🔀 Detalle duplicado fusionado: ${key} (+${d.quantity} uds)`);
    } else {
      map.set(key, { ...d });
    }
  }

  return [...map.values()];
}

async function syncDetalle(detalle, documentCode, transaction) {
  // --- Producto ---
  if (detalle.article_code) {
    await Producto.upsert(
      {
        codigo_producto        : detalle.article_code,
        nombre_producto        : detalle.article_description || "SIN NOMBRE",
        nombre_alterno         : detalle.article_alias           || null,
        codigo_barras          : detalle.article_barcode          || null,
        codigo_marca           : detalle.article_brand_code       || null,
        codigo_categoria       : detalle.article_category_code    || null,
        codigo_familia         : detalle.article_family_code      || null,
        codigo_unidad_medida   : detalle.unit_code                || null,
        codigo_tipo_inventario : detalle.article_inv_type_code    || null,
        costo                  : toNumber(detalle.cost),
        estado                 : 1,
        tipo_producto          : toNumber(detalle.article_type),
        origen_sistema         : "MOBILVENDOR",

      },
      { transaction }
    );
  }

  // --- Detalle del documento ---
  // Ya se hizo destroy antes del loop, siempre es INSERT puro — no hay conflicto posible
  await DetalleDocumento.create(
    {
      documento_code       : documentCode,
      codigo_producto      : detalle.article_code        || "SIN-CODIGO",
      descripcion          : detalle.article_description || "",
      cantidad             : toNumber(detalle.quantity),
      precio               : toNumber(detalle.price),
      subtotal             : toNumber(detalle.subtotal),
      total                : toNumber(detalle.total),
      iva                  : toNumber(detalle.iva),
      unit_alias           : detalle.unit_alias                    || null,
      barcode              : detalle.barcode                       || null,
      codigo_categoria     : detalle.article_category_code         || null,
      descripcion_categoria: detalle.article_category_description  || null,
    },
    { transaction }
  );
}

// ================================================================
// PROCESADOR DE UN DOCUMENTO COMPLETO
// ================================================================
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
    await syncTipoNegocio(doc, t);
    await syncSubcanal(doc, t); //  AQUÍ

    await syncCliente(doc, customerCode, t);
    await syncDireccionCliente(doc, customerCode, t);

    const tipoDoc = await syncDocumento(doc, code, t);
    if (tipoDoc === "factura") stats.facturas++;
    else if (tipoDoc === "orden") stats.ordenes++;

    await syncClienteUsuario(doc, code, customerCode, t);

    // Destroy + create dentro de la misma transacción — rollback seguro
    await DetalleDocumento.destroy({ where: { documento_code: code }, transaction: t });

    const rawDetails   = detallesPorDocumento.get(code) || [];
    const dedupDetails = deduplicateDetails(rawDetails);

    for (const detalle of dedupDetails) {
      await syncDetalle(detalle, code, t);
    }

    await t.commit();
    console.log(`   ✅ ${code} confirmado (${dedupDetails.length} detalles)`);

  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ================================================================
// SERVICIO PRINCIPAL
// ================================================================
const sincronizarVentasRango = async (startDate, endDate, syncState = null) => {
  console.log("\n====================================");
  console.log(`🚀 SINCRONIZACIÓN ${startDate} → ${endDate}`);
  console.log("====================================\n");

  const progress = new SyncProgress(syncState);
  const stats    = new SyncStats();
  const erroresPorDocumento = [];

  progress.start(startDate, endDate);

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
    const session_id = await obtenerSesionActual();
    if (!session_id) throw new Error("No hay sesión activa con MobilVendor.");
    console.log(`🔐 Sesión MobilVendor OK: ${session_id}`);

    let totalPages  = 1;
    let currentPage = 1;

    while (currentPage <= totalPages) {
      console.log(`\n📦 PÁGINA ${currentPage} / ${totalPages}`);
      progress.updatePage(currentPage, totalPages);

      const { data } = await axios.post(
        API_URL,
        {
          session_id,
          action: "getInvoices",
          filter: {
            process_status: "0,1,2,3,4,5",
            type          : "1,2",
            status        : "0,1,2,5,10",
            start_date    : startDate,
            end_date      : endDate,
            limit         : API_PAGE_LIMIT,
            page          : currentPage,
          },
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 120_000,
        }
      );

      const headers = data.invoices || data.headers || [];
      const details = data.details  || [];
      totalPages    = data.pages    || totalPages;

      console.log(`   → Cabeceras: ${headers.length} | Detalles: ${details.length} | Páginas: ${totalPages}`);

      if (!headers.length) {
        console.log("🏁 Sin más cabeceras — finalizando paginación.");
        break;
      }

      stats.headers += headers.length;
      stats.details += details.length;

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
    }

    flushErrorLog(erroresPorDocumento);

    await SincronizacionVenta.update(
      {
        estado         : "SUCCESS",
        total_registros: stats.headers,
        mensaje        : stats.toMessage(),
      },
      { where: { id_sync: idSync } }
    );

    stats.print();
    progress.finish();

    return { idSync, stats, erroresPorDocumento };

  } catch (err) {
    console.error("\n❌ ERROR GLOBAL DE SINCRONIZACIÓN:");
    console.error("Mensaje:", err.message);
    console.error("Stack:",   err.stack);

    await SincronizacionVenta.update(
      { estado: "FAILED", mensaje: err.message },
      { where: { id_sync: idSync } }
    ).catch(() => {});

    progress.finish(err.message);
    throw err;
  }
};

// ================================================================
// EXPORTS
// ================================================================
module.exports = { sincronizarVentasRango, sincronizarDirecciones };