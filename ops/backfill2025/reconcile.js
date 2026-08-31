// ops/backfill2025/reconcile.js
// Corre DENTRO del contenedor dashboard_backend (docker cp + docker exec).
// Verifica un mes ya sincronizado: reconciliación exacta contra Odoo para
// El Rosado (110470, status=2 vs state=posted) + si los errores NUEVOS desde
// el checkpoint anterior siguen siendo el mismo patrón ya diferido
// (estado_ubicacion_direccion_cliente="UNKNOWN", direcciones 277494/284316).
// Nunca decide "seguir" ante algo que no reconoce — el default es detenerse.
//
// Uso: node reconcile.js <desde YYYY-MM-DD> <hasta YYYY-MM-DD> <erroresPreviosCount>
// Salida: una sola línea JSON con el veredicto.
require("dotenv").config();
const fs = require("fs");
const sequelize = require("/app/db");
const { object, loginOdoo } = require("/app/services/odooServicio/odooConexion");

const ADDRESSES_CONOCIDAS = ["277494", "284316"];
const UMBRAL_ERRORES_ALTOS = 30; // 3x el máximo visto en el backfill 2026 (10)

function odooCount(model, domain) {
  return new Promise((resolve, reject) => {
    loginOdoo()
      .then((uid) => {
        object.methodCall(
          "execute_kw",
          [process.env.ODOO_DB, uid, process.env.ODOO_API_KEY, model, "search_count", [domain]],
          (err, res) => (err ? reject(err) : resolve(res))
        );
      })
      .catch(reject);
  });
}

async function main() {
  const [, , desde, hasta, erroresPreviosStr] = process.argv;
  const erroresPrevios = parseInt(erroresPreviosStr || "0", 10);
  const finExclusivo = new Date(new Date(`${hasta}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);

  const [rowsFact] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM facturas WHERE customer_code='110470' AND fecha_creacion >= '${desde}' AND fecha_creacion < '${finExclusivo}' AND status=2`
  );
  const ventasMv = parseInt(rowsFact[0].n, 10);

  const odoo = await odooCount("account.move", [
    ["partner_id", "=", 110470],
    ["move_type", "in", ["out_invoice", "out_refund"]],
    ["invoice_date", ">=", desde],
    ["invoice_date", "<=", hasta],
    ["state", "=", "posted"],
  ]);

  const reconciliaExacto = ventasMv === odoo;

  let bloques = [];
  try {
    const content = fs.readFileSync("/app/services/errores_sync.txt", "utf8");
    bloques = content
      .split("────────────────────────────────────────────────────────────")
      .filter((b) => b.trim());
  } catch (e) {
    /* el archivo puede no existir todavía si nunca hubo errores */
  }
  const erroresNuevos = bloques.slice(erroresPrevios);

  const patronConocido = erroresNuevos.every((b) => {
    const msg = b.match(/"message": "([^"]+)"/)?.[1] || "";
    const codigo = b.match(/'(\d{5,6})'/)?.[1] || "";
    return msg.includes("invalid input syntax for type integer") && ADDRESSES_CONOCIDAS.includes(codigo);
  });

  const erroresAltos = erroresNuevos.length > UMBRAL_ERRORES_ALTOS;

  const detenerse = !reconciliaExacto || !patronConocido || erroresAltos;
  let motivoDetencion = null;
  if (!reconciliaExacto) motivoDetencion = `Reconciliación no exacta: ventas_mv=${ventasMv} vs Odoo=${odoo}`;
  else if (erroresAltos) motivoDetencion = `${erroresNuevos.length} errores nuevos (umbral ${UMBRAL_ERRORES_ALTOS})`;
  else if (!patronConocido) motivoDetencion = "Error nuevo con patrón distinto al conocido (estado_ubicacion / 277494 / 284316)";

  console.log(
    JSON.stringify({
      desde,
      hasta,
      ventasMv,
      odoo,
      reconciliaExacto,
      erroresNuevosCount: erroresNuevos.length,
      totalErroresAcumulados: bloques.length,
      patronConocido,
      detenerse,
      motivoDetencion,
    })
  );
  process.exit(0);
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message, detenerse: true, motivoDetencion: `Error en reconcile.js: ${e.message}` }));
  process.exit(1);
});
