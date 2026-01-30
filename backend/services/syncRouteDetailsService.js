require("dotenv").config();
const axios = require("axios");

const sequelize = require("../db");
const RutaPreventa = require("../models/rutaPreventa");
const RouteDetail = require("../models/routeDetail");

const { API_URL } = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

/* ===================== HELPERS ===================== */
const normalizeCode = (v) => {
  if (!v && v !== 0) return null;
  return String(v).trim().replace(/^0+/, "");
};

const inferTipoRuta = (codigo = "") => {
  const c = codigo.toUpperCase();
  if (c.startsWith("PV")) return "PREVENTA";
  if (c.includes("TELE")) return "TELEVENTA";
  if (c.includes("VIP")) return "VIP";
  return "OTRA";
};

/* ===================== SERVICIO ===================== */
const sincronizarRutasYDetalles = async () => {
  console.log("🚀 SINCRONIZANDO RUTAS Y PLANIFICACIÓN");

  const session_id = await obtenerSesionActual();
  if (!session_id) throw new Error("No hay sesión activa con MobilVendor");

  const transaction = await sequelize.transaction();

  try {
    /* ===================== RUTAS ===================== */
    const rutasResp = await axios.post(API_URL, {
      session_id,
      action: "get",
      schema: "routes",
    });

    const rutas = rutasResp.data?.records || [];

    for (const r of rutas) {
      const codigoRuta = normalizeCode(r.code);
      if (!codigoRuta) continue;

      await RutaPreventa.upsert(
        {
          codigo_ruta: codigoRuta,
          descripcion: r.description || null,
          tipo: inferTipoRuta(codigoRuta),
        },
        {
          transaction,
          conflictFields: ["codigo_ruta"], // 👈 CLAVE
        }
      );
    }

    /* ===================== ROUTE DETAILS ===================== */
    const detailsResp = await axios.post(API_URL, {
      session_id,
      action: "get",
      schema: "route_details",
    });

    const detalles = detailsResp.data?.records || [];

    // 🔥 FULL REFRESH
    await RouteDetail.destroy({
      where: {},
      transaction,
    });

    // 🔑 DEDUPLICACIÓN SEGÚN uq_route_plan
    const uniqueMap = new Map();

    for (const d of detalles) {
      const codigoRuta = normalizeCode(d.route_code);
      const codigoCliente = normalizeCode(d.customer_code);

      if (!codigoRuta || !codigoCliente) continue;

      const semana = Number(d.week ?? 0);
      const dia = Number(d.day ?? null);

      const key = `${codigoRuta}|${codigoCliente}|${semana}|${dia}`;

      if (uniqueMap.has(key)) continue;

      uniqueMap.set(key, {
        codigo_ruta: codigoRuta,
        codigo_cliente: codigoCliente,
        descripcion: d.description || null,
        codigo_direccion: d.customer_address_code || null,
        semana,
        dia,
        secuencia: Number(d.sequence ?? 0),
      });
    }

    const rows = Array.from(uniqueMap.values());

    await RouteDetail.bulkCreate(rows, {
      transaction,
      validate: false,
      hooks: false,
    });

    await transaction.commit();

    console.log("✅ SINCRONIZACIÓN COMPLETA");
    console.log("➡️ Rutas:", rutas.length);
    console.log("➡️ Route details:", rows.length);

    return {
      rutas: rutas.length,
      route_details: rows.length,
    };
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error sincronizando rutas:", error.message);
    throw error;
  }
};

module.exports = { sincronizarRutasYDetalles };
