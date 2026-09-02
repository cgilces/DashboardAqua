// ops/reconciliacion-total/reconcile_amplio.js
// Corre DENTRO del contenedor dashboard_backend (docker cp + docker exec).
//
// Reemplaza a ops/backfill2025/reconcile.js como estándar del orquestador de
// backfill — MISMO esquema de salida (drop-in, run_resume.sh no necesita
// tocarse más que apuntar a este archivo). Motivo del reemplazo: un deadlock
// de Postgres (ver TODO.md, "Fix del deadlock de Postgres") pudo perder
// documentos de CUALQUIER cliente sin que la reconciliación angosta (solo
// El Rosado) lo detectara — así pasó con julio 2026 (-921 documentos,
// encontrado recién con un chequeo amplio, con El Rosado limpio todo el
// tiempo).
//
// v2 — chequeo por EXISTENCIA DE CÓDIGO, no por conteo día a día:
// la primera versión (conteo local vs Odoo por día) generaba falsos
// positivos en datos de 2025 backfilleados — verificado a mano en mayo
// 2025: documentos reales con `invoice_date` en Odoo corrido ±1 día respecto
// a `fecha_creacion` local (ej. FA001-065-000003776 creado localmente el
// 26-may pero con invoice_date=27-may en Odoo). El conteo por día castiga
// ese corrimiento aunque el documento SÍ existe — un falso "déficit" que no
// es pérdida real. La pregunta correcta no es "¿coincide el conteo de cada
// día?" sino "¿existe cada factura de Odoo en algún lado de `facturas`,
// sin importar bajo qué fecha exacta quedó?" — eso es inmune al corrimiento
// de fecha y detecta pérdida real (como julio) sin falsos positivos.
//
// Uso: node reconcile_amplio.js <desde YYYY-MM-DD> <hasta YYYY-MM-DD> <erroresPreviosCount>
// Salida: una sola línea JSON con el veredicto (mismo esquema que reconcile.js
// + codigosFaltantes extra).
require("dotenv").config();
const fs = require("fs");
const sequelize = require("/app/db");
const { object, loginOdoo } = require("/app/services/odooServicio/odooConexion");

const ADDRESSES_CONOCIDAS = ["277494", "284316"];
const UMBRAL_ERRORES_ALTOS = 30; // 3x el máximo visto en el backfill 2026 (10)

function odooCodigos(uid, desde, hasta) {
  return new Promise((resolve, reject) => {
    object.methodCall(
      "execute_kw",
      [
        process.env.ODOO_DB,
        uid,
        process.env.ODOO_API_KEY,
        "account.move",
        "search_read",
        [[
          ["move_type", "in", ["out_invoice", "out_refund"]],
          ["invoice_date", ">=", desde],
          ["invoice_date", "<=", hasta],
          ["state", "=", "posted"],
        ]],
        { fields: ["name"] },
      ],
      (err, res) => (err ? reject(err) : resolve(res.map((r) => r.name)))
    );
  });
}

async function main() {
  const [, , desde, hasta, erroresPreviosStr] = process.argv;
  const erroresPrevios = parseInt(erroresPreviosStr || "0", 10);

  const uid = await loginOdoo();
  const odooCodes = await odooCodigos(uid, desde, hasta);
  const odoo = odooCodes.length;

  // Ventana local ampliada ±2 días — el corrimiento de fecha observado en la
  // práctica es de ±1 día; +1 de margen. Solo importa si el CÓDIGO existe en
  // `facturas`, cualquier status/fecha — se busca por lotes de 5000 para no
  // mandar un IN gigante en una sola query.
  const desdeAmpliado = new Date(new Date(`${desde}T00:00:00Z`).getTime() - 2 * 86400000).toISOString().slice(0, 10);
  const hastaAmpliado = new Date(new Date(`${hasta}T00:00:00Z`).getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const localCodesSet = new Set();
  const [localRows] = await sequelize.query(
    `SELECT code FROM facturas WHERE fecha_creacion >= '${desdeAmpliado}' AND fecha_creacion < '${hastaAmpliado}'`
  );
  for (const r of localRows) localCodesSet.add(r.code);

  const codigosFaltantes = odooCodes.filter((c) => !localCodesSet.has(c));
  const ventasMv = odoo - codigosFaltantes.length; // "encontrados" — para mantener el mismo esquema de campos

  const reconciliaExacto = codigosFaltantes.length === 0;

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
    const esEstadoUbicacionConocido =
      msg.includes("invalid input syntax for type integer") && ADDRESSES_CONOCIDAS.includes(codigo);
    const esSesionSospechosaSana = /Documento: (SESION_SOSPECHOSA|CONFIRMADO_SIN_DATOS)_/.test(b);
    return esEstadoUbicacionConocido || esSesionSospechosaSana;
  });

  const erroresAltos = erroresNuevos.length > UMBRAL_ERRORES_ALTOS;

  const detenerse = !reconciliaExacto || !patronConocido || erroresAltos;
  let motivoDetencion = null;
  if (!reconciliaExacto)
    motivoDetencion = `Reconciliación AMPLIA por existencia de código: ${codigosFaltantes.length} facturas de Odoo (de ${odoo}) no existen en \`facturas\` local en ninguna fecha/status (ver codigosFaltantes)`;
  else if (erroresAltos) motivoDetencion = `${erroresNuevos.length} errores nuevos (umbral ${UMBRAL_ERRORES_ALTOS})`;
  else if (!patronConocido) motivoDetencion = "Error nuevo con patrón distinto al conocido (estado_ubicacion/277494/284316, o SESION_SOSPECHOSA/CONFIRMADO_SIN_DATOS)";

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
      codigosFaltantesCount: codigosFaltantes.length,
      codigosFaltantes: codigosFaltantes.slice(0, 50),
    })
  );
  process.exit(0);
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message, detenerse: true, motivoDetencion: `Error en reconcile_amplio.js: ${e.message}` }));
  process.exit(1);
});
