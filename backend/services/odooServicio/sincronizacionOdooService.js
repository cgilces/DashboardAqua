require("dotenv").config();
const fs = require("fs");
const path = require("path");
const sequelize = require("../../db");

const {
  Clientes,
  DireccionCliente,
  Orden,
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


const logErrorsToFile = (errores) => {
  const logFilePath = path.join(__dirname, "errores_odoo.txt");
  const timestamp = new Date().toISOString();
  const logContent = errores
    .map(e => `\n[${timestamp}] ${JSON.stringify(e, null, 2)}`)
    .join("\n");
  fs.appendFileSync(logFilePath, logContent, "utf8");
};

const odooExecute = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

// ========================================================
// SERVICIO PRINCIPAL
// ========================================================

const sincronizarOdooCompletoRango = async (startDate, endDate) => {

  console.log("\n==================================================");
  console.log("🚀 INICIANDO SINCRONIZACIÓN ODOO");
  console.log("📅 Rango:", startDate, "→", endDate);
  console.log("==================================================\n");

  const syncRow = await SincronizacionVenta.create({
    desde_date: startDate,
    hasta_date: endDate,
    estado: "EN_PROCESO",
    total_registros: 0,
  });

  const idSync = syncRow.id_sync;

  let totalPedidos = 0;
  let totalFacturas = 0;
  let totalDetalles = 0;
  let totalClientes = 0; // Variable para contar clientes sincronizados

  const errores = [];

  try {

    const uid = await loginOdoo();
    console.log("🔐 Login Odoo correcto. UID:", uid);

    // =====================================================
    // PEDIDOS
    // =====================================================
    const pedidos = await odooExecute([
      process.env.ODOO_DB,
      uid,
      process.env.ODOO_API_KEY,
      "sale.order",
      "search_read",
      [[
        ["date_order", ">=", startDate],
        ["date_order", "<=", endDate]
      ]],
      {
        fields: [
          "id",
          "name",
          "date_order",
          "validity_date",
          "effective_date",
          "commitment_date",
          "partner_id",
          "partner_shipping_id",
          "user_id",
          "company_id",
          "warehouse_id",
          "carrier_id",
          "picking_policy",
          "currency_id",
          "currency_rate",
          "amount_total",
          "amount_untaxed",
          "amount_tax",
          "amount_unpaid",
          "state",
          "invoice_status",
          "delivery_status",
          "note",
          "payment_term_id"
        ]
      }
    ]);

    totalPedidos = pedidos.length;
    console.log("📦 Pedidos encontrados:", pedidos.length);

    for (const orden of pedidos) {

      let t = await sequelize.transaction();

      try {

        let cliente = null;
        let idCompany = null;
        let descripcionCompany = null;

        // =====================================================
        // CLIENTE
        // =====================================================
        if (orden.partner_id?.[0]) {

          const clienteOdoo = await odooExecute([
            process.env.ODOO_DB,
            uid,
            process.env.ODOO_API_KEY,
            "res.partner",
            "read",
            [[orden.partner_id[0]]],
            {
              fields: [
                "id",
                "name",
                "company_id",
                "vat",
                "email",
                "phone",
                "mobile",
                "street",
                "city",
                "country_id",
                "industry_id",
                "property_payment_term_id",
                "x_studio_ruta"
              ]
            }
          ]);

          cliente = clienteOdoo[0];

          if (Array.isArray(cliente.company_id)) {
            idCompany = cliente.company_id[0];
            descripcionCompany = cliente.company_id[1];
          }

          await Clientes.upsert({
            codigo_cliente: cliente.id,
            nombre_cliente: cliente.name,
            company_id: idCompany,
            descripcion_company: descripcionCompany,
            identificacion_cliente: cliente.vat,
            email_cliente: cliente.email,
            telefono_cliente: cliente.phone || cliente.mobile,
            direccion_cliente: cliente.street,
            ciudad_cliente: cliente.city,
            pais_cliente: cliente.country_id?.[1] || null,
            industria_cliente: cliente.industry_id?.[1] || null,
            metodo_pago_cliente: orden.payment_term_id?.[1] || null,
            condicion_pago_cliente: cliente.property_payment_term_id?.[1] || null,
            tiene_credito_cliente: !!cliente.property_payment_term_id,
            estado_cliente: 1
          }, { transaction: t });

          // =====================================================
          // DIRECCIONES HIJAS
          // =====================================================
          const direcciones = await odooExecute([
            process.env.ODOO_DB,
            uid,
            process.env.ODOO_API_KEY,
            "res.partner",
            "search_read",
            [[["parent_id", "=", cliente.id]]],
            {
              fields: [
                "id",
                "type",
                "street",
                "street2",
                "city",
                "zip",
                "phone",
                "email"
              ]
            }
          ]);

          for (const d of direcciones) {
            await DireccionCliente.upsert({
              codigo_cliente: cliente.id,
              codigo_direccion_cliente: d.id,
              descripcion_direccion_cliente: d.type,
              calle1_direccion_cliente: d.street,
              calle2_direccion_cliente: d.street2,
              ciudad_direccion_cliente: d.city,
              codigo_postal_direccion_cliente: d.zip,
              telefono_direccion_cliente: d.phone,
              email_direccion_cliente: d.email,
              estado_direccion_cliente: 1
            }, {
              transaction: t,
              conflictFields: ["codigo_cliente", "codigo_direccion_cliente"]
            });
          }
        }

        // =====================================================
        // ORDEN
        // =====================================================
        await Orden.upsert({
          code: orden.name,
          origen_sistema: "ODOO",
          type: 2,
          status:
            orden.state === "sale" || orden.state === "done" ? 2 :
              orden.state === "draft" || orden.state === "sent" ? 1 :
                orden.state === "cancel" ? 0 : null,
          fecha_creacion: orden.date_order || null,
          fecha_validez: orden.validity_date || null,
          fecha_compromiso: orden.commitment_date || null,
          fecha_entrega: orden.effective_date || null,
          campania_id: idCompany,
          descripcion_company: descripcionCompany,
          customer_code: orden.partner_id?.[0] || null,
          seller_code: orden.user_id?.[0] || null,
          route_code: cliente?.x_studio_ruta || null,
          customer_address_code: orden.partner_shipping_id?.[0] || null,
          moneda: orden.currency_id?.[1] || "USD",
          tasa_cambio: orden.currency_rate || 1,
          total: toNumber(orden.amount_total),
          subtotal: toNumber(orden.amount_untaxed),
          iva: toNumber(orden.amount_tax),
          monto_no_pagado: toNumber(orden.amount_unpaid),
          almacen_id: orden.warehouse_id?.[0] || null,
          transportista_id: orden.carrier_id?.[0] || null,
          politica_entrega: orden.picking_policy,
          notes: orden.note
        }, { transaction: t });

        // =====================================================
        // LINEAS
        // =====================================================
        const lineas = await odooExecute([
          process.env.ODOO_DB,
          uid,
          process.env.ODOO_API_KEY,
          "sale.order.line",
          "search_read",
          [[["order_id", "=", orden.id]]],
          {
            fields: [
              "product_id",
              "name",
              "product_uom_qty",
              "qty_delivered",
              "qty_invoiced",
              "price_unit",
              "discount",
              "price_subtotal",
              "price_total",
              "price_tax",
              "invoice_status",
              "is_downpayment",
              "is_delivery"
            ]
          }
        ]);

        await DetalleDocumento.destroy({
          where: { documento_code: orden.name },
          transaction: t
        });

        for (const linea of lineas) {

          if (linea.product_id?.[0]) {

            const productoOdoo = await odooExecute([
              process.env.ODOO_DB,
              uid,
              process.env.ODOO_API_KEY,
              "product.product",
              "read",
              [[linea.product_id[0]]],
              {
                fields: [
                  "id",
                  "name",
                  "default_code",
                  "barcode",
                  "categ_id",
                  "standard_price",
                  "list_price"
                ]
              }
            ]);

            const p = productoOdoo[0];

            await Producto.upsert({
              codigo_producto: p.id,
              nombre_producto: p.name,
              codigo_interno: p.default_code,
              codigo_barras: p.barcode,
              categoria_producto: p.categ_id?.[1] || null,
              costo: toNumber(p.standard_price),
              precio: toNumber(p.list_price),
              estado: 1
            }, { transaction: t });
          }

          await DetalleDocumento.create({
            documento_code: orden.name,
            codigo_producto: linea.product_id?.[0] || null,
            descripcion: linea.name,
            cantidad: toNumber(linea.product_uom_qty),
            cantidad_entregada: toNumber(linea.qty_delivered),
            cantidad_facturada: toNumber(linea.qty_invoiced),
            precio: toNumber(linea.price_unit),
            descuento_linea: toNumber(linea.discount),
            subtotal: toNumber(linea.price_subtotal),
            total: toNumber(linea.price_total),
            iva: toNumber(linea.price_tax),
            estado_facturacion_linea: linea.invoice_status,
            es_anticipo: linea.is_downpayment || false,
            es_envio: linea.is_delivery || false
          }, { transaction: t });
        }

        await t.commit();
        console.log("✅ Orden procesada:", orden.name);

      } catch (err) {
        await t.rollback();
        console.error("❌ Error en orden:", orden.name);
        console.error(err.message);
      }
    }

    //     await SincronizacionVenta.update(
    //       { estado: "SUCCESS" },
    //       { where: { id_sync: idSync } }
    //     );

    //   } catch (err) {

    //     await SincronizacionVenta.update(
    //       { estado: "FAILED", mensaje: err.message },
    //       { where: { id_sync: idSync } }
    //     );

    //     console.error("❌ ERROR GLOBAL:", err.message);
    //     throw err;
    //   }
    // };






    // // Obtener clientes con sus direcciones de una sola vez desde Odoo
    // const clientesConDirecciones = await odooExecute([
    //   process.env.ODOO_DB,
    //   uid,
    //   process.env.ODOO_API_KEY,
    //   "res.partner",
    //   "search_read",
    //   [
    //     [
    //       ["customer_rank", ">", 0], // Solo clientes
    //     ],
    //   ],
    //   {
    //     fields: [
    //       "id",
    //       "name",
    //       "company_id",
    //       "vat",
    //       "l10n_latam_identification_type_id",
    //       "email",
    //       "phone",
    //       "street",
    //       "street2",
    //       "city",
    //       "zip",
    //       "country_id",
    //       "customer_rank",
    //       "x_studio_frecuencia", // Condiciones de pago personalizadas
    //       "x_studio_email",
    //       "x_studio_ruta",
    //       "x_studio_ultima_fecha_factura", // Personalizado
    //       "create_date"
    //     ]
    //   }
    // ]);

    // totalClientes = clientesConDirecciones.length;
    // console.log("👥 Clientes con direcciones encontrados:", totalClientes);

    // for (const cliente of clientesConDirecciones) {
    //   let t;
    //   try {
    //     t = await sequelize.transaction();

    //     // Sincronizar cliente
    //     const existenteCliente = await Clientes.findOne({
    //       where: { codigo_cliente: String(cliente.id) },
    //       transaction: t,
    //     });



    //     // Verificar si l10n_latam_document_type_id es un arreglo
    //     let tipoDocumento = cliente.company_id;
    //     let idTipoCompania = null; // Variable para el ID
    //     let descripcionCompania = null; // Variable para la descripción

    //     console.log("tipo documento:", tipoDocumento);

    //     // Verificar si tipoDocumento es un arreglo y tiene dos elementos
    //     if (Array.isArray(tipoDocumento) && tipoDocumento.length === 2) {
    //       idTipoCompania = tipoDocumento[0]; // El ID del tipo de documento (primer valor)
    //       descripcionCompania = tipoDocumento[1]; // La descripción del tipo de documento (segundo valor)
    //     } else {
    //       // Si no es un arreglo con dos valores, asignamos null
    //       idTipoCompania = tipoDocumento || null;
    //       descripcionCompania = null; // Asignar null si no hay descripción disponible
    //     }


    //     console.log("ID tipo documento:", idTipoCompania);
    //     console.log("Descripción tipo documento:", descripcionCompania);




    //     let tipoidentificacionDocumento = cliente.l10n_latam_identification_type_id;

    //     let idTipoIdentificacion = null; // Variable para el ID
    //     let descripcionIdentificacion = null; // Variable para la descripción
    //     console.log("tipo de identificacacion:", tipoidentificacionDocumento)



    //     // Verificar si tipoDocumento es un arreglo y tiene dos elementos
    //     if (Array.isArray(tipoidentificacionDocumento) && tipoidentificacionDocumento.length === 2) {
    //       idTipoIdentificacion = tipoidentificacionDocumento[0]; // El ID del tipo de documento (primer valor)
    //       descripcionIdentificacion = tipoidentificacionDocumento[1]; // La descripción del tipo de documento (segundo valor)
    //     } else {
    //       // Si no es un arreglo con dos valores, asignamos null
    //       idTipoIdentificacion = tipoidentificacionDocumento || null;
    //       descripcionIdentificacion = null; // Asignar null si no hay descripción disponible
    //     }


    //     console.log("ID tipo documento:", idTipoIdentificacion);
    //     console.log("Descripción tipo documento:", descripcionIdentificacion);

    //     const datosCliente = {
    //       codigo_cliente: cliente.id,
    //       identificacion_cliente: cliente.vat || "Sin identificación",  // Si no tiene vat, asignamos un valor por defecto
    //       company_id: idTipoCompania,
    //       descripcion_company: descripcionCompania,
    //       nombre_cliente: cliente.name || null,
    //       contacto_cliente: cliente.phone || null,
    //       tipo_identificacion_cliente: descripcionIdentificacion,


    //       // x_studio_email: cliente.email || null,
    //       // calle1_direccion_cliente: cliente.street || null,
    //       // calle2_direccion_cliente: cliente.street2 || null,
    //       // ciudad_direccion_cliente: cliente.city || null,
    //       // codigo_postal_direccion_cliente: cliente.zip || null,
    //       // metodo_pago_cliente: cliente.x_studio_frecuencia || "Contado", // Default "Contado"
    //       // estado_cliente: cliente.customer_rank ? 1 : 0, // Si tiene ranking, es cliente activo
    //       fecha_creacion_cliente: cliente.create_date,
    //       // fecha_actualizacion_cliente: new Date(),
    //     };

    //     if (!existenteCliente) {
    //       console.log("🆕 Creando cliente nuevo:", cliente.name);
    //       await Clientes.create(datosCliente, { transaction: t });
    //     } else {
    //       console.log("🔄 Actualizando cliente:", cliente.name);
    //       await existenteCliente.update(datosCliente, { transaction: t });
    //     }

    //     // Sincronizar direcciones de clientes
    //     // const datosDireccion = {
    //     //   codigo_cliente: cliente.id,
    //     //   // descripcion_direccion_cliente: cliente.name || null
    //     //   // calle1_direccion_cliente: cliente.street || null,
    //     //   // calle2_direccion_cliente: cliente.street2 || null,
    //     //   // ciudad_direccion_cliente: cliente.city || null,
    //     //   // codigo_postal_direccion_cliente: cliente.zip || null,
    //     //   // telefono_direccion_cliente: cliente.phone || null,
    //     //   // email_direccion_cliente: cliente.email || null,
    //     //   // latitud_direccion_cliente: cliente.partner_latitude || null,
    //     //   // longitud_direccion_cliente: cliente.partner_longitude || null,
    //     //   // fecha_ultima_visita_direccion_cliente:
    //     //   //   cliente.x_studio_ultima_fecha_factura || null,
    //     //   // estado_direccion_cliente: 1, // Activa
    //     //   // fecha_creacion_direccion_cliente: new Date(),
    //     //   // fecha_actualizacion_direccion_cliente: new Date(),
    //     // };

    //     // const existenteDireccion = await DireccionCliente.findOne({
    //     //   where: { codigo_cliente: cliente.id },
    //     //   transaction: t,
    //     // });

    //     // if (!existenteDireccion) {
    //     //   console.log("🆕 Creando dirección nueva para el cliente:", cliente.name);
    //     //   await DireccionCliente.create(datosDireccion, { transaction: t });
    //     // } else {
    //     //   console.log("🔄 Actualizando dirección del cliente:", cliente.name);
    //     //   await existenteDireccion.update(datosDireccion, { transaction: t });
    //     // }

    //     await t.commit();
    //     console.log("✅ Cliente y dirección sincronizados correctamente:", cliente.name);
    //   } catch (err) {
    //     if (t) await t.rollback();
    //     console.error("❌ Error cliente o dirección:", cliente.name);
    //     console.error("Detalle error:", err.message);
    //     errores.push({
    //       cliente: cliente.name,
    //       error: err.message,
    //     });
    //   }
    // }



    // =====================================================
    // 2️⃣ FACTURAS
    // =====================================================

    // const facturasOdoo = await odooExecute([
    //   process.env.ODOO_DB,
    //   uid,
    //   process.env.ODOO_API_KEY,
    //   "account.move",
    //   "search_read",
    //   [
    //     [
    //       ["move_type", "=", "out_invoice"],
    //       ["invoice_date", ">=", startDate],
    //       ["invoice_date", "<=", endDate],
    //     ],
    //   ],
    //   {
    //     fields: [
    //       "id",
    //       "name",
    //       "move_type",
    //       "state",
    //       "payment_state",
    //       "invoice_date",
    //       "invoice_date_due",
    //       "partner_id",
    //       "partner_shipping_id",
    //       "invoice_user_id",
    //       "amount_total",
    //       "amount_untaxed",
    //       "amount_tax",
    //       "amount_residual",
    //       "currency_id",
    //       "l10n_ec_authorization_number",
    //       "l10n_ec_authorization_date",
    //       "l10n_latam_document_type_id",  // Este es el campo que quieres revisar
    //       "reversed_entry_id",
    //       "narration",
    //       "company_id",
    //     ],
    //   },
    // ]);

    // const totalFacturas = facturasOdoo.length;
    // console.log("🧾 Facturas encontradas:", totalFacturas);

    // for (const factura of facturasOdoo) {
    //   let t;
    //   try {
    //     if (DEBUG) console.log("🔄 Procesando factura:", factura.name);

    //     t = await sequelize.transaction();

    //     const existenteFactura = await Factura.findOne({
    //       where: { code: factura.name },
    //       transaction: t,
    //     });

    //     // Verificar si l10n_latam_document_type_id es un arreglo
    //     let tipoDocumento = factura.l10n_latam_document_type_id;
    //     let idTipoDocumento = null; // Variable para el ID
    //     let descripcionDocumento = null; // Variable para la descripción

    //     console.log("tipo documento:", tipoDocumento);

    //     // Verificar si tipoDocumento es un arreglo y tiene dos elementos
    //     if (Array.isArray(tipoDocumento) && tipoDocumento.length === 2) {
    //       idTipoDocumento = tipoDocumento[0]; // El ID del tipo de documento (primer valor)
    //       descripcionDocumento = tipoDocumento[1]; // La descripción del tipo de documento (segundo valor)
    //     } else {
    //       // Si no es un arreglo con dos valores, asignamos null
    //       idTipoDocumento = tipoDocumento || null;
    //       descripcionDocumento = null; // Asignar null si no hay descripción disponible
    //     }

    //     console.log("ID tipo documento:", idTipoDocumento);
    //     console.log("Descripción tipo documento:", descripcionDocumento);

    //     const datosFactura = {
    //       code: factura.name,
    //       type: idTipoDocumento,  // Asignamos el ID del tipo de documento al campo 'type'
    //       origen_sistema: "ODOO",
    //       move_type: factura.move_type || null,
    //       status:
    //         factura.state === "posted"
    //           ? 2
    //           : factura.state === "draft"
    //             ? 1
    //             : factura.state === "cancel"
    //               ? 0
    //               : null,
    //       estado_pago: factura.payment_state || null,
    //       fecha_creacion: factura.invoice_date || null,
    //       fecha_vencimiento: factura.invoice_date_due || null,
    //       fecha_autorizacion: factura.l10n_ec_authorization_date || null,
    //       fecha_entrega: factura.invoice_date_due || null,
    //       customer_code: factura.partner_id?.[0] || null,
    //       customer_address_code: factura.partner_shipping_id?.[0] || null,
    //       seller_code: factura.invoice_user_id?.[0] || null,
    //       total: toNumber(factura.amount_total),
    //       subtotal: toNumber(factura.amount_untaxed),
    //       iva: toNumber(factura.amount_tax),
    //       saldo_pendiente: toNumber(factura.amount_residual),
    //       tipo_documento: descripcionDocumento || null,  // Asignamos la descripción del tipo de documento al campo 'tipo_documento'
    //       moneda: factura.currency_id?.[1] || "USD",
    //       auth_code: factura.l10n_ec_authorization_number || null,
    //       reversed_entry_id: factura.reversed_entry_id?.[0] || null,
    //       notes: factura.narration || null,
    //       company_id: factura.company_id?.[0] || null,
    //     };
    //     if (!existenteFactura) {
    //       console.log("🆕 Creando factura nueva:", factura.name);
    //       await Factura.create(datosFactura, { transaction: t });
    //     } else {
    //       console.log("🔄 Actualizando factura existente:", factura.name);
    //       await existenteFactura.update(datosFactura, { transaction: t });
    //     }

    //     await t.commit();
    //     console.log("✅ Factura sincronizada:", factura.name);
    //   } catch (err) {
    //     if (t) await t.rollback();
    //     console.error("❌ Error factura:", factura.name, err.message);
    //     errores.push({ factura: factura.name, error: err.message });
    //   }
    // }

    // =====================================================
    // FINALIZAR
    // =====================================================

    await SincronizacionVenta.update({
      estado: errores.length ? "PARTIAL_SUCCESS" : "SUCCESS",
      total_registros: totalPedidos + totalFacturas,
      mensaje: `Pedidos:${totalPedidos} Facturas:${totalFacturas} Detalles:${totalDetalles} Errores:${errores.length}`
    }, { where: { id_sync: idSync } });

    if (errores.length) logErrorsToFile(errores);

    console.log("\n🎉 SINCRONIZACIÓN COMPLETADA");
    console.log("Clientes:", totalClientes);
    console.log("Pedidos:", totalPedidos);
    console.log("Facturas:", totalFacturas);
    console.log("Detalles:", totalDetalles);
    console.log("Errores:", errores.length);

    return {
      totalPedidos,
      totalClientes,
      totalFacturas,
      totalDetalles,
      errores
    };

  } catch (error) {

    console.error("❌ ERROR GLOBAL:", error.message);

    await SincronizacionVenta.update({
      estado: "FAILED",
      mensaje: error.message.substring(0, 500)
    }, { where: { id_sync: idSync } });

    throw error;
  }
};

module.exports = {
  sincronizarOdooCompletoRango
};