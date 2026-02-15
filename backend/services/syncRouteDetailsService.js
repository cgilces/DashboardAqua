require("dotenv").config();
const axios = require("axios");

const sequelize = require("../db");
const Ruta = require("../models/Ruta");
const DetalleRuta = require("../models/DetalleRuta");

const { API_URL } = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

/* ===================== HELPERS ===================== */
const normalizeCode = (v) => {
  if (!v && v !== 0) return null;
  return String(v).trim().replace(/^0+/, "");
};


// Función para limpiar números con puntos y convertirlos a cadena
const limpiarNumero = (valor) => {
  return String(valor).replace(/\./g, ''); // Eliminar puntos
};

/* ===================== SERVICIO ===================== */
const sincronizarRutasYDetalles = async () => {
  console.log("🚀 INICIANDO SINCRONIZACIÓN DE RUTAS Y PLANIFICACIÓN");

  const session_id = await obtenerSesionActual();
  if (!session_id) throw new Error("No hay sesión activa con MobilVendor");

  // Iniciar transacción
  const transaction = await sequelize.transaction();

  let totalDetallesInsertados = 0; // Inicializar como número
  const detallesPorInsertar = [];  // Para almacenar los detalles a insertar en batch
  const erroresPorDocumento = [];
  let currentPage = 1;

  try {
    // ===================== RUTAS =====================
    const rutasResp = await axios.post(API_URL, {
      session_id,
      action: "get",
      schema: "routes",
    });

    const rutas = rutasResp.data?.records || [];
    console.log(`📊 Se han recuperado ${rutas.length} rutas.`);

    // Sincronizar rutas
    for (const r of rutas) {
      const codigoRuta = normalizeCode(r.code);
      if (!codigoRuta) continue;

      console.log(`Sincronizando ruta: ${codigoRuta}`);

      await Ruta.upsert(
        {
          codigo: codigoRuta,
          descripcion: r.description || null,
          tipo: r.type || "OTRA",  // Default "OTRA" si no se proporciona el tipo
          estado: r.status,
          creado_por: limpiarNumero(r.c),
          actualizado_por: limpiarNumero(r.u),
          creado_por_id: limpiarNumero(r.c_by),
          actualizado_por_id: limpiarNumero(r.u_by),
        },
        {
          transaction,
          conflictFields: ["codigo"], // Evita duplicados por codigo_ruta
        }
      );
    }

    // ===================== DETALLES DE RUTAS =====================
    const MAX_CONCURRENT_REQUESTS = 5; // Número máximo de solicitudes paralelas
    const BATCH_SIZE = 1000;  // Tamaño del batch para insertar detalles en bloque

    // Función para realizar las solicitudes y manejar la paginación
    const obtenerDetallesPorPagina = async (page) => {
      const bodyRouteDetails = {
        session_id,
        action: "get",
        schema: "route_details",
        page: page,
        limit: 1000,
      };

      try {
        const { data: routeDetailsData } = await axios.post(API_URL, bodyRouteDetails, {
          headers: { "Content-Type": "application/json" },
          timeout: 120000, // Timeout de 2 minutos
        });

        if (routeDetailsData.errors > 0) {
          console.log("⚠️ Error al obtener detalles de rutas:", routeDetailsData);
          return [];
        }

        // Devolver los detalles y el número total de páginas
        return { routeDetails: routeDetailsData.records || [], totalPages: routeDetailsData.pages || 1 };
      } catch (error) {
        console.log("❌ Error al obtener detalles de ruta:", error.message);
        return [];
      }
    };

    // Función para insertar detalles en batch
    const insertarDetallesEnBatch = async (detalles) => {
      try {
        console.log(`🌟 Insertando detalles en batch: ${detalles.length} registros`);

        const result = await DetalleRuta.bulkCreate(detalles, {
          updateOnDuplicate: [
            "codigo", "codigo_ruta", "codigo_cliente", "codigo_direccion_cliente", 
            "semana", "dia", "secuencia", "estado", "datos"
          ],
        });

        console.log(`✅ Se insertaron ${result.length} detalles de rutas`);

        // Actualizar el contador global de detalles insertados
        totalDetallesInsertados += result.length;
      } catch (error) {
        console.log("❌ Error al insertar detalles de rutas en batch:", error.message);
      }
    };

    // Ejecutar múltiples solicitudes en paralelo con un limitador de concurrencia
    while (true) {
      const { routeDetails, totalPages } = await obtenerDetallesPorPagina(currentPage);

      // Si no hay más detalles, salimos del ciclo
      if (routeDetails.length === 0) {
        console.log("No hay más detalles de rutas.");
        break;
      }

      console.log(`🔄 Recuperando detalles de rutas - Página ${currentPage}/${totalPages}...`);

      // Acumular detalles de rutas para insertar
      detallesPorInsertar.push(...routeDetails.map((detail) => ({
        codigo: detail.code,
        codigo_ruta: detail.route_code,
        codigo_cliente: detail.customer_code,
        codigo_direccion_cliente: detail.customer_address_code,
        semana: detail.week,
        dia: detail.day,
        secuencia: detail.sequence,
        estado: detail.status,
        datos: detail.data,
        creado_por: detail.c,
        actualizado_por: detail.u,
        creado_por_id: detail.c_by,
        actualizado_por_id: detail.u_by,
        ruta_codigo_lookup: detail.route_code_lookup,
        cliente_codigo_lookup: detail.customer_code_lookup,
        direccion_codigo_lookup: detail.customer_address_code_lookup,
      })));

      // Si el batch de detalles tiene suficientes registros (límite por batch), insertarlos
      if (detallesPorInsertar.length >= BATCH_SIZE) {
        await insertarDetallesEnBatch(detallesPorInsertar.splice(0, BATCH_SIZE)); // Insertar en batch y vaciar el arreglo
      }

      // Incrementar página para la siguiente solicitud
      currentPage++;

      // Si hemos recorrido todas las páginas, salimos del ciclo
      if (currentPage > totalPages) {
        break;
      }
    }

    // Insertar los detalles restantes si hay menos de BATCH_SIZE
    if (detallesPorInsertar.length > 0) {
      await insertarDetallesEnBatch(detallesPorInsertar);
    }

    // Confirmar la transacción
    await transaction.commit();

    console.log("✅ SINCRONIZACIÓN DE RUTAS Y DETALLES COMPLETA");
    console.log("➡️ Rutas sincronizadas:", rutas.length);
    console.log("➡️ Total de detalles insertados:", totalDetallesInsertados);

    return {
      rutas: rutas.length,
      route_details: totalDetallesInsertados,  // Devolver el valor total de detalles insertados
    };

  } catch (error) {
    console.error("❌ Error sincronizando rutas:", error.message);

    // Si ocurre un error, hacer rollback antes de devolver el error
    if (transaction) await transaction.rollback();

    throw error;
  }
};

module.exports = { sincronizarRutasYDetalles };
