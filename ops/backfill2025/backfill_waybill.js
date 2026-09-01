// ops/backfill2025/backfill_waybill.js
// Backfill LIVIANO de waybill_code/waybill_status para lo ya sincronizado
// este año (enero-agosto 2026) — NO re-sincroniza nada más, solo trae el
// objeto `waybill` de MobilVendor (nunca capturado antes) y actualiza esas
// 2 columnas en `ordenes` para filas ya existentes, por `code`. Corre
// dentro de dashboard_backend (cwd /app), reusa su conexión y sesión.
//
// Uso: node backfill_waybill.js <desde YYYY-MM-DD> <hasta YYYY-MM-DD>
// NOTA: pasar <desde> con unos días de solape hacia atrás (ej. 10 días antes
// del 1 del mes, igual que DIAS_SOLAPE_MES_ANTERIOR en
// sincronizacionController.js) — una orden creada a fin de mes anterior pero
// ENTREGADA (fecha_entrega, el campo que filtra PREVENTA) en el mes que se
// está validando, si no, se queda sin guía.
require("dotenv").config();
const axios = require("axios");
const { API_URL } = require("/app/config/config");
const { obtenerSesionActual } = require("/app/utils/apiCliente");
const sequelize = require("/app/db");

const API_PAGE_LIMIT = 100;

async function main() {
  const [, , startDate, endDate] = process.argv;
  if (!startDate || !endDate) {
    console.error("Uso: node backfill_waybill.js <desde> <hasta>");
    process.exit(1);
  }

  const session_id = await obtenerSesionActual();
  if (!session_id) throw new Error("No hay sesión activa con MobilVendor.");

  let currentPage = 1;
  let totalPages = 1;
  let actualizados = 0;
  let vistos = 0;
  let reintentoPaginaActual = false;

  while (currentPage <= totalPages) {
    const { data } = await axios.post(
      API_URL,
      {
        session_id,
        action: "getInvoices",
        filter: {
          process_status: "0,1,2,3,4,5",
          type: "2", // solo pedidos (Orden) — facturas no participan de PREVENTA
          status: "0,1,2,5,10",
          start_date: startDate,
          end_date: endDate,
          limit: API_PAGE_LIMIT,
          page: currentPage,
        },
      },
      { headers: { "Content-Type": "application/json" }, timeout: 120_000 }
    );

    const headers = data.headers || data.invoices || [];
    const totalPagesRespuesta = data.pages || totalPages;

    // Misma protección que el fix de sincronizacionService.js: página vacía
    // dentro del rango esperado es sospechosa (sesión inválida), no fin real
    // de paginación.
    if (headers.length === 0 && !reintentoPaginaActual) {
      reintentoPaginaActual = true;
      console.warn(`⚠️  Página ${currentPage}/${totalPages} vacía — reintentando (sin forzar sesión nueva, este script es de un solo uso)`);
      continue;
    }
    reintentoPaginaActual = false;
    totalPages = totalPagesRespuesta;

    if (!headers.length) break;

    // UPDATE en lote (1 query por página, no 1 por documento) — la versión
    // original hacía un round-trip por fila y tardaba ~140 min para julio
    // solo; esto lo baja a un puñado de segundos por página.
    const filas = headers.map((h) => ({
      code: h.code,
      waybillCode: h.waybill?.code || null,
      waybillStatus: h.waybill ? String(h.waybill.status) : null,
    }));
    const values = filas
      .map((_, i) => `($${i * 3 + 1}::text, $${i * 3 + 2}::text, $${i * 3 + 3}::text)`)
      .join(", ");
    const bind = filas.flatMap((f) => [f.code, f.waybillCode, f.waybillStatus]);
    await sequelize.query(
      `UPDATE ordenes AS o
       SET waybill_code = v.waybill_code, waybill_status = v.waybill_status
       FROM (VALUES ${values}) AS v(code, waybill_code, waybill_status)
       WHERE o.code = v.code`,
      { bind }
    );
    vistos += headers.length;
    actualizados += headers.length;

    console.log(`Página ${currentPage}/${totalPages} — ${headers.length} registros procesados (vistos=${vistos})`);
    currentPage++;
  }

  console.log(`\nBackfill de waybill completo: ${startDate} → ${endDate}`);
  console.log(`Documentos vistos/actualizados (UPDATE ejecutado, exista o no la fila): ${actualizados}`);
  await sequelize.close();
  process.exit(0); // apiCliente.js programa renovación de sesión cada 30 min
  // (setTimeout persistente) — sin esto el proceso nunca termina solo.
}

main().catch((e) => {
  console.error("ERROR:", e.response?.data || e.message);
  process.exit(1);
});
