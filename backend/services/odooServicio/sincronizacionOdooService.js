require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const sequelize = require("../../db");

const {
  Clientes,
  Orden,
  Factura,
  DetalleDocumento,
  Producto,
  SincronizacionVenta,
} = require("../../models");

const { object, loginOdoo } = require("./odooConexion");

// ========================================================
// HELPERS
// ========================================================
const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const logErrorsToFile = (errores, filename = "errores_odoo.txt") => {
  const logFilePath = path.join(__dirname, filename);
  const timestamp   = new Date().toISOString();
  const separator   = "─".repeat(60);
  const content     = errores
    .map(({ doc, error }) =>
      `\n${separator}\n[${timestamp}] Doc: ${doc}\n${JSON.stringify(error, null, 2)}`
    )
    .join("\n");
  try {
    fs.appendFileSync(logFilePath, content, "utf8");
    console.log(`📝 ${errores.length} error(es) guardado(s) en ${filename}`);
  } catch (err) {
    console.error("❌ No se pudo escribir el archivo de log:", err.message);
  }
};

const odooExecute = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

// ========================================================
// PREFETCH EN BATCH
// ========================================================
const fetchClientesBatch = async (uid, ids) => {
  if (!ids.length) return {};
  const data = await odooExecute([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "res.partner", "read", [ids],
    {
      fields: [
        "id", "name", "company_id", "vat", "email",
        "phone", "mobile", "street", "city", "country_id",
        "industry_id", "property_payment_term_id", "x_studio_ruta",
        "mobilvendor_id",
      ],
    },
  ]);
  return Object.fromEntries(data.map((c) => [c.id, c]));
};

const fetchDireccionesBatch = async (uid, parentIds) => {
  if (!parentIds.length) return {};
  const data = await odooExecute([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "res.partner", "search_read",
    [[["parent_id", "in", parentIds]]],
    {
      fields: [
        "id", "parent_id", "type", "name",
        "street", "street2", "city", "zip",
        "phone", "mobile", "email",
      ],
    },
  ]);
  const map = {};
  for (const d of data) {
    const pid = d.parent_id[0];
    if (!map[pid]) map[pid] = [];
    map[pid].push(d);
  }
  return map;
};

const fetchLineasPedidosBatch = async (uid, ordenIds) => {
  if (!ordenIds.length) return {};
  const data = await odooExecute([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "sale.order.line", "search_read",
    [[["order_id", "in", ordenIds]]],
    {
      fields: [
        "order_id", "product_id", "name",
        "product_uom_qty", "qty_delivered", "qty_invoiced",
        "price_unit", "discount",
        "price_subtotal", "price_total", "price_tax",
        "invoice_status", "is_downpayment", "is_delivery",
        "product_uom", "sequence", "state",
      ],
    },
  ]);
  const map = {};
  for (const l of data) {
    const oid = l.order_id[0];
    if (!map[oid]) map[oid] = [];
    map[oid].push(l);
  }
  return map;
};

const fetchLineasFacturasBatch = async (uid, facturaIds) => {
  if (!facturaIds.length) return {};
  const data = await odooExecute([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "account.move.line", "search_read",
    [[
      ["move_id", "in", facturaIds],
      ["display_type", "=", "product"],
    ]],
    {
      fields: [
        "move_id", "product_id", "name",
        "quantity", "price_unit", "discount", "discount_percentage",
        "price_subtotal", "price_total",
        "tax_base_amount", "product_uom_id",
        "display_type", "parent_state", "is_downpayment", "date",
      ],
    },
  ]);
  const map = {};
  for (const l of data) {
    const fid = l.move_id[0];
    if (!map[fid]) map[fid] = [];
    map[fid].push(l);
  }
  return map;
};

const fetchProductosBatch = async (uid, ids) => {
  if (!ids.length) return {};
  const data = await odooExecute([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "product.product", "read", [ids],
    {
      fields: [
        "id", "name", "default_code", "barcode",
        "categ_id", "standard_price", "list_price",
        "uom_id", "uom_po_id", "active",
        "description_sale", "type", "weight", "volume",
      ],
    },
  ]);
  return Object.fromEntries(data.map((p) => [p.id, p]));
};

// ========================================================
// UPSERT CLIENTES + DIRECCIONES  (secuencial → sin deadlock)
// ========================================================
const upsertClientesYDirecciones = async (uid, clienteIds, docs) => {
  if (!clienteIds.length) return { clientesMap: {}, totalClientes: 0 };

  const [clientesMap, direccionesMap] = await Promise.all([
    fetchClientesBatch(uid, clienteIds),
    fetchDireccionesBatch(uid, clienteIds),
  ]);

  for (const cliente of Object.values(clientesMap)) {
    const idCompany          = Array.isArray(cliente.company_id) ? cliente.company_id[0] : null;
    const descripcionCompany = Array.isArray(cliente.company_id) ? cliente.company_id[1] : null;
    const docDelCliente      = docs.find((o) => o.partner_id?.[0] === cliente.id);

    await Clientes.upsert({
      codigo_cliente              : String(cliente.id),
      company_id                  : idCompany,
      descripcion_company         : descripcionCompany,
      identificacion_cliente      : cliente.vat              || null,
      nombre_cliente              : cliente.name             || null,
      nombre_comercial_cliente    : cliente.name             || null,
      email_cliente               : cliente.email ? String(cliente.email).substring(0, 500) : null,
      telefono_cliente            : cliente.phone || cliente.mobile || null,
      contacto_cliente            : cliente.name             || null,
      direccion_cliente           : cliente.street           || null,
      ciudad_cliente              : cliente.city             || null,
      pais_cliente                : cliente.country_id?.[1]  || null,
      industria_cliente           : cliente.industry_id?.[1] || null,
      condicion_pago_cliente      : cliente.property_payment_term_id?.[1] || null,
      tiene_credito_cliente       : !!cliente.property_payment_term_id,
      mobilvendor_id_cliente      : cliente.mobilvendor_id && cliente.mobilvendor_id !== false
        ? String(cliente.mobilvendor_id) : null,
      codigo_moneda_cliente       : "USD",
      descuento_cliente           : 0,
      saldo_cliente               : 0,
      tiene_documentos_cliente    : false,
      estado_proceso_cliente      : 0,
      codigo_usuario_asignado_cliente: docDelCliente?.user_id?.[0]
        ? String(docDelCliente.user_id[0]) : null,
      estado_cliente              : 1,
      fecha_creacion_cliente      : new Date(),
      fecha_actualizacion_cliente : new Date(),
    });

    for (const d of (direccionesMap[cliente.id] || [])) {
      await sequelize.query(
        `INSERT INTO direcciones_clientes (
            codigo_cliente, codigo_direccion_cliente,
            descripcion_direccion_cliente,
            calle1_direccion_cliente, calle2_direccion_cliente,
            codigo_postal_direccion_cliente,
            telefono_direccion_cliente, email_direccion_cliente,
            estado_direccion_cliente,
            fecha_creacion_direccion_cliente,
            fecha_actualizacion_direccion_cliente
          ) VALUES (
            :codigo_cliente, :codigo_dir, :descripcion,
            :calle1, :calle2, :zip, :telefono, :email, 1, NOW(), NOW()
          )
          ON CONFLICT (codigo_cliente, codigo_direccion_cliente)
          DO UPDATE SET
            descripcion_direccion_cliente         = EXCLUDED.descripcion_direccion_cliente,
            calle1_direccion_cliente              = EXCLUDED.calle1_direccion_cliente,
            calle2_direccion_cliente              = EXCLUDED.calle2_direccion_cliente,
            codigo_postal_direccion_cliente       = EXCLUDED.codigo_postal_direccion_cliente,
            telefono_direccion_cliente            = EXCLUDED.telefono_direccion_cliente,
            email_direccion_cliente               = EXCLUDED.email_direccion_cliente,
            fecha_actualizacion_direccion_cliente = NOW()`,
        {
          replacements: {
            codigo_cliente: String(cliente.id),
            codigo_dir    : String(d.id),
            descripcion   : d.type || d.name || null,
            calle1        : d.street  || null,
            calle2        : d.street2 || null,
            zip           : d.zip ? String(d.zip).substring(0, 50) : null,
            telefono      : d.phone || d.mobile || null,
            email         : d.email || null,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );
    }
  }

  return { clientesMap, totalClientes: Object.keys(clientesMap).length };
};

// ========================================================
// UPSERT PRODUCTOS  (secuencial → sin deadlock)
// Un solo bulkCreate por chunk, FUERA del Promise.all
// ========================================================
const upsertProductosBatch = async (productosMap, contadores) => {
  const productos = Object.values(productosMap);
  if (!productos.length) return;

  await Producto.bulkCreate(
    productos.map((p) => ({
      codigo_producto        : String(p.id),
      nombre_producto        : p.name || "SIN NOMBRE",
      nombre_alterno         : p.name || null,
      codigo_barras          : p.barcode          || null,
      codigo_interno         : p.default_code     || null,
      codigo_categoria       : p.categ_id?.[0] ? String(p.categ_id[0]) : null,
      categoria_producto     : p.categ_id?.[1]    || null,
      codigo_unidad_medida   : p.uom_id?.[1]      || null,
      unidad_medida          : p.uom_id?.[1]      || null,
      unidad_medida_compra   : p.uom_po_id?.[1]   || null,
      tipo_producto          : p.type             || null,
      codigo_tipo_inventario : p.type             || null,
      costo                  : toNumber(p.standard_price),
      ultimo_costo           : toNumber(p.standard_price),
      precio                 : toNumber(p.list_price),
      peso                   : toNumber(p.weight),
      volumen                : toNumber(p.volume),
      descripcion_venta      : p.description_sale || null,
      activo                 : p.active !== false,
      estado                 : p.active !== false ? 1 : 0,
      origen_sistema         : "ODOO",
    })),
    {
      updateOnDuplicate: [
        "nombre_producto", "nombre_alterno", "codigo_barras", "codigo_interno",
        "codigo_categoria", "categoria_producto",
        "codigo_unidad_medida", "unidad_medida", "unidad_medida_compra",
        "tipo_producto", "codigo_tipo_inventario",
        "costo", "ultimo_costo", "precio",
        "peso", "volumen", "descripcion_venta", "activo", "estado", "origen_sistema",
      ],
    }
  );

  contadores.productos += productos.length;
};

// ========================================================
// PROCESAR CHUNK DE PEDIDOS
// Orden de operaciones:
//   1. upsertClientes   — secuencial (tabla clientes)
//   2. upsertProductos  — secuencial (tabla productos)
//   3. Promise.all      — solo ordenes + detalle_documento (keys únicas)
// ========================================================
const procesarChunkPedidos = async (uid, pedidos, errores, contadores) => {
  const clienteIds = [...new Set(pedidos.map((o) => o.partner_id?.[0]).filter(Boolean))];
  const ordenIds   = pedidos.map((o) => o.id);

  // 1. Clientes (secuencial)
  const { clientesMap, totalClientes } = await upsertClientesYDirecciones(uid, clienteIds, pedidos);
  contadores.clientes += totalClientes;

  // 2. Fetch lineas + productos
  const lineasMap    = await fetchLineasPedidosBatch(uid, ordenIds);
  const todasLineas  = Object.values(lineasMap).flat();
  const productoIds  = [...new Set(todasLineas.map((l) => l.product_id?.[0]).filter(Boolean))];
  const productosMap = await fetchProductosBatch(uid, productoIds);

  // 3. Productos (secuencial — un solo bulkCreate para todo el chunk)
  await upsertProductosBatch(productosMap, contadores);

  // 4. Ordenes en paralelo — solo tocan ordenes + detalle_documento (sin conflicto)
  await Promise.all(pedidos.map(async (orden) => {
    const t = await sequelize.transaction();
    try {
      const cliente            = clientesMap[orden.partner_id?.[0]] || null;
      const idCompany          = Array.isArray(cliente?.company_id) ? cliente.company_id[0] : null;
      const descripcionCompany = Array.isArray(cliente?.company_id) ? cliente.company_id[1] : null;

      const statusNum =
        orden.state === "sale" || orden.state === "done"    ? 2
        : orden.state === "draft" || orden.state === "sent" ? 1
        : orden.state === "cancel"                          ? 0
        : null;

      await Orden.upsert({
        code              : orden.name,
        origen_sistema    : "ODOO",
        type              : 2,
        status            : statusNum,
        estado_odoo       : orden.state            || null,
        estado_facturacion: orden.invoice_status   || null,
        estado_entrega    : orden.delivery_status  || null,
        fecha_creacion    : orden.date_order       || null,
        fecha_validez     : orden.validity_date    || null,
        fecha_compromiso  : orden.commitment_date  || null,
        fecha_entrega     : orden.effective_date   || null,
        campania_id       : idCompany,
        descripcion_company: descripcionCompany,
        customer_code     : orden.partner_id?.[0]  ? String(orden.partner_id[0])  : null,
        customer_nombre   : orden.partner_id?.[1]  || null,
        seller_code       : orden.user_id?.[0]     ? String(orden.user_id[0])      : null,
        seller_nombre     : orden.user_id?.[1]     || null,
        equipo_ventas     : orden.team_id?.[1]     || null,
        customer_address_code: orden.partner_shipping_id?.[0] || null,
        route_code        : cliente?.x_studio_ruta  || null,
        moneda            : orden.currency_id?.[1]  || "USD",
        tasa_cambio       : orden.currency_rate      || 1,
        total             : toNumber(orden.amount_total),
        subtotal          : toNumber(orden.amount_untaxed),
        iva               : toNumber(orden.amount_tax),
        discount          : 0,
        monto_no_pagado   : toNumber(orden.amount_unpaid),
        almacen_id        : orden.warehouse_id?.[0]  || null,
        transportista_id  : orden.carrier_id?.[0]    || null,
        politica_entrega  : orden.picking_policy     || null,
        payment_term_id   : orden.payment_term_id?.[0] || null,
        payment_term_nombre: orden.payment_term_id?.[1] || null,
        source_document   : orden.client_order_ref   || null,
        mobilvendor_id    : orden.mobilvendor_id     || null,
        notes             : orden.note               || null,
      }, { transaction: t });

      const lineas = lineasMap[orden.id] || [];
      await DetalleDocumento.destroy({ where: { documento_code: orden.name }, transaction: t });

      if (lineas.length) {
        await DetalleDocumento.bulkCreate(
          lineas.map((linea) => {
            const producto      = productosMap[linea.product_id?.[0]];
            const costoUnitario = toNumber(producto?.standard_price);
            const cantidad      = toNumber(linea.product_uom_qty);
            const precio        = toNumber(linea.price_unit);
            const subtotal      = toNumber(linea.price_subtotal);
            const margen        = (precio - costoUnitario) * cantidad;
            return {
              documento_code              : orden.name,
              codigo_producto             : linea.product_id?.[0] ? String(linea.product_id[0]) : "SIN-CODIGO",
              descripcion                 : linea.name || "",
              producto_nombre             : producto?.name          || linea.name || null,
              producto_categoria          : producto?.categ_id?.[1] || null,
              producto_codigo_interno     : producto?.default_code  || null,
              cantidad,
              cantidad_entregada          : toNumber(linea.qty_delivered),
              cantidad_facturada          : toNumber(linea.qty_invoiced),
              cantidad_pendiente_entregar : Math.max(0, cantidad - toNumber(linea.qty_delivered)),
              cantidad_pendiente_facturar : Math.max(0, cantidad - toNumber(linea.qty_invoiced)),
              precio,
              descuento_linea             : toNumber(linea.discount),
              subtotal,
              total                       : toNumber(linea.price_total),
              iva                         : toNumber(linea.price_tax),
              precio_sin_impuesto         : precio,
              precio_con_impuesto         : cantidad > 0 ? toNumber(linea.price_total) / cantidad : precio,
              impuesto_linea              : toNumber(linea.price_tax),
              margen_linea                : margen,
              margen_porcentaje_linea     : subtotal > 0 ? (margen / subtotal) * 100 : 0,
              unit_alias                  : linea.product_uom?.[1]  || null,
              unidad_medida               : linea.product_uom?.[1]  || null,
              barcode                     : producto?.barcode        || null,
              secuencia                   : linea.sequence           || 0,
              codigo_categoria            : producto?.categ_id?.[0] ? String(producto.categ_id[0]) : null,
              descripcion_categoria       : producto?.categ_id?.[1] || null,
              estado_facturacion_linea    : linea.invoice_status     || null,
              estado_odoo_linea           : linea.state              || null,
              es_anticipo                 : linea.is_downpayment     || false,
              es_envio                    : linea.is_delivery        || false,
            };
          }),
          { ignoreDuplicates: true, transaction: t }
        );
        contadores.detalles += lineas.length;
      }

      await t.commit();
      console.log(`✅ Pedido: ${orden.name} (${lineas.length} líneas)`);

    } catch (err) {
      await t.rollback();
      console.error(`❌ Error pedido: ${orden.name}`, err.message);
      errores.push({ doc: orden.name, error: err.message });
    }
  }));
};

// ========================================================
// PROCESAR CHUNK DE FACTURAS
// Mismo patrón: clientes → productos → Promise.all facturas
// ========================================================
const procesarChunkFacturas = async (uid, facturas, errores, contadores) => {
  const clienteIds = [...new Set(facturas.map((f) => f.partner_id?.[0]).filter(Boolean))];
  const facturaIds = facturas.map((f) => f.id);

  // 1. Clientes (secuencial)
  const { clientesMap, totalClientes } = await upsertClientesYDirecciones(uid, clienteIds, facturas);
  contadores.clientes += totalClientes;

  // 2. Fetch líneas + productos
  const lineasMap    = await fetchLineasFacturasBatch(uid, facturaIds);
  const todasLineas  = Object.values(lineasMap).flat();
  const productoIds  = [...new Set(todasLineas.map((l) => l.product_id?.[0]).filter(Boolean))];
  const productosMap = await fetchProductosBatch(uid, productoIds);

  // 3. Productos (secuencial — un solo bulkCreate para todo el chunk)
  await upsertProductosBatch(productosMap, contadores);

  // 4. Facturas en paralelo — solo tocan facturas + detalle_documento (sin conflicto)
  await Promise.all(facturas.map(async (factura) => {
    const t = await sequelize.transaction();
    try {
      const cliente       = clientesMap[factura.partner_id?.[0]] || null;
      const statusNum     =
        factura.state === "posted"   ? 2
        : factura.state === "draft"  ? 1
        : factura.state === "cancel" ? 0
        : null;
      const tipoDocId     = Array.isArray(factura.l10n_latam_document_type_id)
        ? factura.l10n_latam_document_type_id[0] : null;
      const tipoDocNombre = Array.isArray(factura.l10n_latam_document_type_id)
        ? factura.l10n_latam_document_type_id[1] : null;

      await Factura.upsert({
        code              : factura.name,
        origen_sistema    : "ODOO",
        type              : tipoDocId,
        status            : statusNum,
        estado_pago       : factura.payment_state               || null,
        fecha_creacion    : factura.invoice_date                || null,
        fecha_vencimiento : factura.invoice_date_due            || null,
        fecha_autorizacion: factura.l10n_ec_authorization_date  || null,
        fecha_entrega     : factura.invoice_date_due            || null,
        customer_code     : factura.partner_id?.[0]     ? String(factura.partner_id[0])         : null,
        customer_address_code: factura.partner_shipping_id?.[0] ? String(factura.partner_shipping_id[0]) : null,
        seller_code       : factura.invoice_user_id?.[0] ? String(factura.invoice_user_id[0])   : null,
        route_code        : cliente?.x_studio_ruta              || null,
        total             : toNumber(factura.amount_total),
        subtotal          : toNumber(factura.amount_untaxed),
        iva               : toNumber(factura.amount_tax),
        saldo_pendiente   : toNumber(factura.amount_residual),
        discount          : 0,
        tipo_documento    : tipoDocNombre                       || null,
        auth_code         : factura.l10n_ec_authorization_number || null,
        moneda            : factura.currency_id?.[1]            || "USD",
        reversed_entry_id : Array.isArray(factura.reversed_entry_id)
          ? factura.reversed_entry_id[0] : (factura.reversed_entry_id || null),
        company_id        : Array.isArray(factura.company_id)
          ? factura.company_id[0] : (factura.company_id || null),
        notes             : factura.narration                   || null,
      }, { transaction: t });

      const lineas = lineasMap[factura.id] || [];
      await DetalleDocumento.destroy({ where: { documento_code: factura.name }, transaction: t });

      if (lineas.length) {
        await DetalleDocumento.bulkCreate(
          lineas.map((linea) => {
            const producto  = productosMap[linea.product_id?.[0]];
            const cantidad  = toNumber(linea.quantity);
            const precio    = toNumber(linea.price_unit);
            const subtotal  = toNumber(linea.price_subtotal);
            const total     = toNumber(linea.price_total);
            const iva       = total - subtotal;
            return {
              documento_code              : factura.name,
              codigo_producto             : linea.product_id?.[0] ? String(linea.product_id[0]) : "SIN-CODIGO",
              descripcion                 : linea.name || "",
              producto_nombre             : producto?.name          || linea.name || null,
              producto_categoria          : producto?.categ_id?.[1] || null,
              producto_codigo_interno     : producto?.default_code  || null,
              cantidad,
              cantidad_entregada          : cantidad,
              cantidad_facturada          : cantidad,
              cantidad_pendiente_entregar : 0,
              cantidad_pendiente_facturar : 0,
              precio,
              descuento_linea             : toNumber(linea.discount_percentage ?? linea.discount ?? 0),
              subtotal,
              total,
              iva,
              precio_sin_impuesto         : precio,
              precio_con_impuesto         : cantidad > 0 ? total / cantidad : precio,
              impuesto_linea              : iva,
              margen_linea                : 0,
              margen_porcentaje_linea     : 0,
              unit_alias                  : linea.product_uom_id?.[1] || null,
              unidad_medida               : linea.product_uom_id?.[1] || null,
              barcode                     : producto?.barcode          || null,
              codigo_categoria            : producto?.categ_id?.[0] ? String(producto.categ_id[0]) : null,
              descripcion_categoria       : producto?.categ_id?.[1]   || null,
              es_anticipo                 : linea.is_downpayment || false,
              es_envio                    : false,
            };
          }),
          { ignoreDuplicates: true, transaction: t }
        );
        contadores.detalles += lineas.length;
      }

      await t.commit();
      console.log(`✅ Factura: ${factura.name} (${lineas.length} líneas)`);

    } catch (err) {
      await t.rollback();
      console.error(`❌ Error factura: ${factura.name}`, err.message);
      errores.push({ doc: factura.name, error: err.message });
    }
  }));
};

// ========================================================
// SERVICIO PRINCIPAL
// ========================================================
const sincronizarOdooCompletoRango = async (startDate, endDate) => {
  console.log("\n==================================================");
  console.log("🚀 INICIANDO SINCRONIZACIÓN ODOO");
  console.log("📅 Rango:", startDate, "→", endDate);
  console.log("==================================================\n");

  const syncRow = await SincronizacionVenta.create({
    desde_date     : startDate,
    hasta_date     : endDate,
    estado         : "EN_PROCESO",
    total_registros: 0,
    mensaje        : null,
  });

  const idSync     = syncRow.id_sync;
  const errores    = [];
  const contadores = { clientes: 0, productos: 0, detalles: 0 };

  try {
    const uid = await loginOdoo();
    console.log("🔐 Login Odoo correcto. UID:", uid);

    // ── 1. PEDIDOS ─────────────────────────────────────────────
    console.log("\n📦 Buscando pedidos de venta...");
    const pedidos = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "sale.order", "search_read",
      [[["date_order", ">=", startDate], ["date_order", "<=", endDate]]],
      {
        fields: [
          "id", "name",
          "date_order", "validity_date", "effective_date", "commitment_date",
          "partner_id", "partner_shipping_id", "user_id", "team_id",
          "company_id", "warehouse_id", "carrier_id", "picking_policy",
          "currency_id", "currency_rate",
          "amount_total", "amount_untaxed", "amount_tax", "amount_unpaid",
          "state", "invoice_status", "delivery_status",
          "payment_term_id", "client_order_ref", "note", "mobilvendor_id",
        ],
      },
    ]);

    console.log(`📦 Pedidos encontrados: ${pedidos.length}`);
    const chunksPedidos = chunkArray(pedidos, 50);
    for (let i = 0; i < chunksPedidos.length; i++) {
      console.log(`\n⚙️  Pedidos — Chunk ${i + 1}/${chunksPedidos.length} (${chunksPedidos[i].length} pedidos)...`);
      await procesarChunkPedidos(uid, chunksPedidos[i], errores, contadores);
    }

    // ── 2. FACTURAS ────────────────────────────────────────────
    console.log("\n🧾 Buscando facturas de venta...");
    const facturas = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[
        ["move_type", "=", "out_invoice"],
        ["invoice_date", ">=", startDate],
        ["invoice_date", "<=", endDate],
      ]],
      {
        fields: [
          "id", "name", "move_type", "state",
          "payment_state", "payment_reference",
          "invoice_date", "invoice_date_due", "date",
          "partner_id", "partner_shipping_id", "invoice_user_id",
          "company_id", "currency_id", "team_id",
          "amount_total", "amount_untaxed", "amount_tax",
          "amount_residual", "amount_total_signed",
          "l10n_ec_authorization_number", "l10n_ec_authorization_date",
          "l10n_ec_sri_payment_id", "l10n_latam_document_type_id",
          "reversed_entry_id", "invoice_origin", "ref", "narration",
        ],
      },
    ]);

    console.log(`🧾 Facturas encontradas: ${facturas.length}`);
    const chunksFacturas = chunkArray(facturas, 50);
    for (let i = 0; i < chunksFacturas.length; i++) {
      console.log(`\n⚙️  Facturas — Chunk ${i + 1}/${chunksFacturas.length} (${chunksFacturas[i].length} facturas)...`);
      await procesarChunkFacturas(uid, chunksFacturas[i], errores, contadores);
    }

    // ── Finalizar ──────────────────────────────────────────────
    const totalErrores = errores.length;
    await SincronizacionVenta.update(
      {
        estado         : totalErrores ? "CON_ERRORES" : "COMPLETADO",
        total_registros: pedidos.length + facturas.length,
        mensaje        : `Pedidos:${pedidos.length} Facturas:${facturas.length} Clientes:${contadores.clientes} Productos:${contadores.productos} Detalles:${contadores.detalles} Errores:${totalErrores}`,
      },
      { where: { id_sync: idSync } }
    );

    if (totalErrores) logErrorsToFile(errores);

    console.log("\n====================================");
    console.log("✅ SINCRONIZACIÓN ODOO COMPLETADA");
    console.log(`   → Pedidos   : ${pedidos.length}`);
    console.log(`   → Facturas  : ${facturas.length}`);
    console.log(`   → Clientes  : ${contadores.clientes}`);
    console.log(`   → Productos : ${contadores.productos}`);
    console.log(`   → Detalles  : ${contadores.detalles}`);
    console.log(`   → Errores   : ${totalErrores}`);
    console.log("====================================\n");

    return {
      totalPedidos  : pedidos.length,
      totalFacturas : facturas.length,
      totalClientes : contadores.clientes,
      totalProductos: contadores.productos,
      totalDetalles : contadores.detalles,
      errores,
    };

  } catch (err) {
    console.error("💥 Error crítico en sincronización Odoo:", err.message);
    await SincronizacionVenta.update(
      { estado: "ERROR", mensaje: err.message.substring(0, 500) },
      { where: { id_sync: idSync } }
    );
    throw err;
  }
};

module.exports = { sincronizarOdooCompletoRango };
