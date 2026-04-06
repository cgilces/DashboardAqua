require("dotenv").config();
const axios = require("axios");
const sequelize = require("../db");
const { QueryTypes } = require("sequelize");
const { API_URL } = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

/* ===================== HELPERS ===================== */
const parseUnixToDate = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000 - 5 * 60 * 60 * 1000);
};

const toFloat = (v) => parseFloat(v) || 0;
const toInt   = (v) => parseInt(v)   || 0;

/* ===================== BULK UPSERT ===================== */
const bulkUpsertHistorial = async (registros, transaction) => {
  if (!registros.length) return;

  // Construir placeholders: ($1,$2,...), ($N+1,...)
  const COLS = [
    "fecha_visita", "codigo_usuario", "codigo_ruta", "codigo_cliente",
    "codigo_direccion_cliente", "semana", "dia", "accion",
    "codigo_comentario", "comentario", "monto", "latitud", "longitud",
    "estado_proceso", "ruptura_secuencia", "nombre_cliente",
    "nombre_empresa_cliente", "nombre_comercial_cliente",
    "tipo_identificacion_cliente", "numero_identificacion_cliente",
    "contacto_cliente", "comentario_cliente", "estado_cliente",
    "nombre_usuario", "email_usuario", "email_notificacion_usuario",
    "identidad_usuario", "tipo_identificacion_usuario", "sucursal_usuario",
    "telefono_usuario", "direccion_usuario", "marca_dispositivo_usuario",
    "modelo_dispositivo_usuario", "numero_dispositivo_usuario",
    "codigo_almacen_usuario", "codigo_ruta_predeterminada_usuario",
    "codigo_rol_usuario",
  ];

  const NUM_COLS = COLS.length;
  const values   = [];
  const rows     = [];

  registros.forEach((item, i) => {
    const offset = i * NUM_COLS;
    rows.push(
      `(${COLS.map((_, j) => `$${offset + j + 1}`).join(", ")})`
    );
    values.push(
      parseUnixToDate(item.date),
      item.user_code                  || null,
      item.route_code                 || null,
      item.customer_code              || null,
      item.customer_address_code      || null,
      toInt(item.week),
      toInt(item.day),
      item.action                     || null,
      item.comment_code               || null,
      item.comment                    || null,
      toFloat(item.amount),
      toFloat(item.lat),
      toFloat(item.lon),
      toInt(item.process_status),
      toInt(item.is_sequence_break),
      item.customer_name              || null,
      item.customer_company_name      || null,
      item.customer_commercial_name   || null,
      item.customer_identity_type     || null,
      item.customer_identity          || null,
      item.customer_contact           || null,
      item.customer_comment           || null,
      toInt(item.customer_process_status),
      item.user_name                  || null,
      item.user_email                 || null,
      item.user_notify_emails         || null,
      item.user_identity              || null,
      item.user_identity_type         || null,
      item.user_branch                || null,
      item.user_phone                 || null,
      item.user_address               || null,
      item.user_device_mark           || null,
      item.user_device_model          || null,
      item.user_device_number         || null,
      item.user_default_storage_code  || null,
      item.user_default_route_code    || null,
      item.user_role_code             || null,
    );
  });

  // Columnas a actualizar en caso de conflicto (todas menos las 3 del UNIQUE)
  const UPDATE_COLS = COLS.filter(
    c => !["codigo_cliente", "codigo_ruta", "fecha_visita"].includes(c)
  );

  const sql = `
    INSERT INTO historial_visitas (${COLS.join(", ")})
    VALUES ${rows.join(", ")}
    ON CONFLICT (codigo_cliente, codigo_ruta, fecha_visita)
    DO UPDATE SET
      ${UPDATE_COLS.map(c => `${c} = EXCLUDED.${c}`).join(",\n      ")}
  `;

  await sequelize.query(sql, { bind: values, transaction, type: QueryTypes.INSERT });
};

/* ===================== SERVICIO PRINCIPAL ===================== */
const obtenerHistorialDeUsuarios = async (startDate, endDate) => {
  console.log(`\n🚀 SINCRONIZANDO HISTORIAL ${startDate} → ${endDate}`);

  const session_id = await obtenerSesionActual();
  if (!session_id) throw new Error("No hay sesión activa con MobilVendor");

  let totalGuardados = 0;
  let currentPage    = 1;
  let totalPages     = 1;

  while (currentPage <= totalPages) {
    console.log(`📦 PÁGINA ${currentPage} / ${totalPages}`);

    const { data } = await axios.post(
      API_URL,
      {
        session_id,
        action: "getUserHistory",
        filter: { start_date: startDate, end_date: endDate, limit: 1000, page: currentPage },
      },
      { headers: { "Content-Type": "application/json" }, timeout: 120_000 }
    );

    const registros = data?.records || [];
    totalPages      = data?.pages   || totalPages;

    console.log(`   → ${registros.length} registros`);
    if (!registros.length) break;

    // ── Una transacción por página ──────────────────────────────
    const t = await sequelize.transaction();
    try {
      await bulkUpsertHistorial(registros, t);
      await t.commit();
      totalGuardados += registros.length;
      console.log(`   ✅ Página ${currentPage} guardada`);
    } catch (err) {
      await t.rollback();
      console.error(`   ❌ Error página ${currentPage}:`, err.message);
      throw err;
    }

    currentPage++;
  }

  console.log(`\n✅ HISTORIAL COMPLETO — ${totalGuardados} registros guardados`);
  return { historial: totalGuardados };
};

module.exports = { obtenerHistorialDeUsuarios };