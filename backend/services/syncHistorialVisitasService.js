require("dotenv").config();
const axios = require("axios");
const sequelize = require("../db");
const HistorialVisitas = require("../models/HistorialVisitas"); // Asumiendo que tienes un modelo para la tabla historial_visitas
const { API_URL } = require("../config/config");
const { obtenerSesionActual } = require("../utils/apiCliente");

/* ===================== HELPERS ===================== */
const normalizeCode = (v) => {
  if (!v && v !== 0) return null;
  return String(v).trim().replace(/^0+/, "");
};

const parseUnixToDate = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date((n * 1000) - (5 * 60 * 60 * 1000)); // Ajusta a la hora de Ecuador (UTC-5)
};

/* ===================== SERVICIO ===================== */
const obtenerHistorialDeUsuarios = async (startDate, endDate) => {
  console.log("🚀 INICIANDO OBTENCIÓN DE HISTORIAL DE USUARIOS");

  const session_id = await obtenerSesionActual();
  if (!session_id) throw new Error("No hay sesión activa con MobilVendor");

  // Iniciar transacción
  const transaction = await sequelize.transaction();

  try {
    let historial = [];
    let currentPage = 1;
    let totalPages = 1; // Se asume que al menos una página existe.

    // Solicitar el número total de páginas primero
    const historialResp = await axios.post(API_URL, {
      session_id,
      action: "getUserHistory",
      page: currentPage.toString(),
      limit: 1000,  // Intentamos obtener más registros por página
      // filter: {
      //   day_start: startDate,
      //   day_end: endDate,
      // },

      filter: {
          // process_status: "0,1,2,3,4,5",
          // type: "1,2",
          // status: "0,1,2,5,10",
          start_date: startDate,
          end_date: endDate,
          limit: 1000,
          page: currentPage,
        },
    });

    const totalPagesData = historialResp.data?.pages || 1;
    totalPages = totalPagesData;

    console.log(`📊 Total de páginas a recorrer: ${totalPages}`);

    // Recorrer todas las páginas
    while (currentPage <= totalPages) {
      console.log(`📦 Solicitando página ${currentPage} de ${totalPages}`);

      // Solicitar historial de usuarios para la página actual
      const historialResp = await axios.post(API_URL, {
        session_id,
        action: "getUserHistory",
        page: currentPage.toString(),
        limit: 1000,  // Mantener el límite de 1000 por página
        filter: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      const data = historialResp.data;
      const currentHistorial = data?.records || [];
      totalPages = data.pages || totalPages; // Actualizar el número total de páginas si cambia

      console.log(`📊 Se han recuperado ${currentHistorial.length} registros de la página ${currentPage}`);

      // Concatenar los registros obtenidos
      historial = historial.concat(currentHistorial);

      // Incrementar la página para la siguiente iteración
      currentPage++;

      // Si no hay más registros, salir del ciclo
      if (currentHistorial.length === 0) {
        console.log("🏁 No hay más registros.");
        break;
      }
    }

    console.log(`📊 Total de registros obtenidos: ${historial.length}`);

    // Insertar los registros en la base de datos
    for (const item of historial) {
      await HistorialVisitas.upsert(
        {
          fecha_visita: parseUnixToDate(item.date),  // Convertir a timestamp
          codigo_usuario: item.user_code,
          codigo_ruta: item.route_code,
          codigo_cliente: item.customer_code,
          codigo_direccion_cliente: item.customer_address_code,
          semana: item.week,
          dia: item.day,
          accion: item.action,
          codigo_comentario: item.comment_code,
          comentario: item.comment || null,
          monto: parseFloat(item.amount) || 0,
          latitud: parseFloat(item.lat) || 0,
          longitud: parseFloat(item.lon) || 0,
          estado_proceso: item.process_status || 0,
          ruptura_secuencia: item.is_sequence_break || 0,
          nombre_cliente: item.customer_name || null,
          nombre_empresa_cliente: item.customer_company_name || null,
          nombre_comercial_cliente: item.customer_commercial_name || null,
          tipo_identificacion_cliente: item.customer_identity_type || null,
          numero_identificacion_cliente: item.customer_identity || null,
          contacto_cliente: item.customer_contact || null,
          comentario_cliente: item.customer_comment || null,
          estado_cliente: item.customer_process_status || 0,
          nombre_usuario: item.user_name || null,
          email_usuario: item.user_email || null,
          email_notificacion_usuario: item.user_notify_emails || null,
          identidad_usuario: item.user_identity || null,
          tipo_identificacion_usuario: item.user_identity_type || null,
          sucursal_usuario: item.user_branch || null,
          telefono_usuario: item.user_phone || null,
          direccion_usuario: item.user_address || null,
          marca_dispositivo_usuario: item.user_device_mark || null,
          modelo_dispositivo_usuario: item.user_device_model || null,
          numero_dispositivo_usuario: item.user_device_number || null,
          codigo_almacen_usuario: item.user_default_storage_code || null,
          codigo_ruta_predeterminada_usuario: item.user_default_route_code || null,
          codigo_rol_usuario: item.user_role_code || null,
        },
        {
          transaction,
          conflictFields: ["codigo_cliente", "codigo_ruta", "fecha_visita"],  // Evita duplicados
        }
      );
    }

    // Confirmar la transacción
    await transaction.commit();
    console.log("✅ HISTORIAL DE USUARIOS OBTENIDO Y GUARDADO CORRECTAMENTE");

    return {
      historial: historial.length,
    };

  } catch (error) {
    console.error("❌ Error obteniendo historial de usuarios:", error.message);

    // Si ocurre un error, hacer rollback antes de devolver el error
    if (transaction) await transaction.rollback();

    throw error;
  }
};

module.exports = { obtenerHistorialDeUsuarios };
