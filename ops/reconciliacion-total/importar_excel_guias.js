// ops/reconciliacion-total/importar_excel_guias.js
// Corre DENTRO del contenedor dashboard_backend (docker cp + docker exec).
//
// Importa el Excel "Reporte de detalles de Guías" de MobilVendor (exportado
// cerca de la fecha real de entrega) y corrige waybill_code/waybill_status
// en `ordenes` para los documentos que coincidan por Invoice —
// TRATANDO EL EXCEL COMO FUENTE DE VERDAD por encima del valor actual, sin
// condición. Esto es intencionalmente distinto del guard agregado al sync
// normal (ver TODO.md, "waybill_status se sobreescribía en cada resync"):
// el sync normal solo LLENA si está NULL (nunca pisa un valor ya
// capturado, porque no sabe si el valor "en vivo" es más confiable); este
// importador SÍ puede pisar, porque el Excel es una fuente más confiable
// que la API en vivo consultada semanas/meses después (el código de guía
// se reutiliza con el tiempo — la API solo devuelve el estado ACTUAL del
// código, no el que tenía en la fecha real de esta entrega).
//
// Formato esperado (columnas usadas, hay más que se ignoran): Invoice,
// Article, Quantity, Total, Waybill, Estado de Despacho ("Terminated"/
// "Shipping" — únicos dos valores vistos hasta ahora; si aparece un
// tercero, el script se detiene en vez de adivinar el mapeo).
//
// Uso: node importar_excel_guias.js <ruta_csv>
require("dotenv").config();
const fs = require("fs");
const fastcsv = require("fast-csv");
const sequelize = require("/app/db");

const MAP_ESTADO = { Terminated: "3", Shipping: "0" };

// El header trae columnas repetidas ("Comment"/"Name"/"Description" salen
// más de una vez — contacto, User y Dispatcher comparten el nombre "Name",
// por ejemplo) — fast-csv en modo `headers:true` no puede mapear eso a un
// objeto con claves únicas. Se parsea en modo array (headers:false) y se
// accede por POSICIÓN, confirmada a mano contra este export real:
// 0=Invoice, 34=Waybill, 36=Estado de Despacho.
const COL_INVOICE = 0;
const COL_WAYBILL = 34;
const COL_ESTADO_DESPACHO = 36;

async function leerCSV(path) {
  return new Promise((resolve, reject) => {
    const porInvoice = new Map();
    let esHeader = true;
    fs.createReadStream(path)
      .pipe(fastcsv.parse({ headers: false }))
      .on("error", reject)
      .on("data", (fila) => {
        if (esHeader) {
          esHeader = false;
          if (fila[COL_INVOICE] !== "Invoice" || fila[COL_WAYBILL] !== "Waybill" || fila[COL_ESTADO_DESPACHO] !== "Estado de Despacho") {
            throw new Error(
              `El header del CSV no calza con las posiciones esperadas (Invoice/Waybill/Estado de Despacho en columnas 0/34/36) — ` +
              `formato distinto al ya validado, revisar antes de continuar. Header visto: ${JSON.stringify(fila)}`
            );
          }
          return;
        }
        const invoice = fila[COL_INVOICE];
        if (!invoice) return;
        const waybill = fila[COL_WAYBILL] && fila[COL_WAYBILL] !== "nan" ? fila[COL_WAYBILL] : null;
        const estadoTexto = fila[COL_ESTADO_DESPACHO];
        const statusMapeado = MAP_ESTADO[estadoTexto];
        if (statusMapeado === undefined) {
          throw new Error(
            `Estado de Despacho desconocido: "${estadoTexto}" en invoice ${invoice} — mapeo incompleto (solo se conocen "Terminated"/"Shipping"), revisar antes de continuar.`
          );
        }
        // Todas las líneas de un mismo Invoice deben compartir waybill/estado
        // (son campos a nivel de guía, no de línea de producto) — si alguna
        // vez difieren dentro del mismo invoice, el supuesto ya no vale.
        const existente = porInvoice.get(invoice);
        if (existente && (existente.waybill_code !== waybill || existente.waybill_status !== statusMapeado)) {
          throw new Error(`Invoice ${invoice} tiene waybill/estado inconsistente entre sus líneas — revisar el CSV manualmente.`);
        }
        porInvoice.set(invoice, { waybill_code: waybill, waybill_status: statusMapeado });
      })
      .on("end", () => resolve(porInvoice));
  });
}

async function main() {
  const rutaCsv = process.argv[2];
  if (!rutaCsv) {
    console.error("Uso: node importar_excel_guias.js <ruta_csv>");
    process.exit(1);
  }
  if (!fs.existsSync(rutaCsv)) {
    console.error(`No existe el archivo: ${rutaCsv}`);
    process.exit(1);
  }

  const porInvoice = await leerCSV(rutaCsv);
  const codigos = [...porInvoice.keys()];
  console.log(`CSV leído: ${codigos.length} invoices únicos.`);

  const [enOrdenes] = await sequelize.query(
    "SELECT code, waybill_code, waybill_status FROM ordenes WHERE code = ANY($1::text[])",
    { bind: [codigos] }
  );
  const dbMap = new Map(enOrdenes.map((r) => [r.code, { waybill_code: r.waybill_code, waybill_status: r.waybill_status }]));

  const sinMatch = codigos.filter((c) => !dbMap.has(c));
  const aCorregir = [];
  let identicos = 0;

  for (const [invoice, excel] of porInvoice) {
    const actual = dbMap.get(invoice);
    if (!actual) continue;
    if (actual.waybill_code === excel.waybill_code && actual.waybill_status === excel.waybill_status) {
      identicos++;
    } else {
      aCorregir.push({ invoice, actual, excel });
    }
  }

  console.log(`Coinciden con \`ordenes\`: ${codigos.length - sinMatch.length} / ${codigos.length}`);
  console.log(`Sin match en \`ordenes\` (no se tocan, no es un bug — pueden ser otros grupos/documentos no-preventa): ${sinMatch.length}`);
  if (sinMatch.length) console.log("Ejemplos sin match:", JSON.stringify(sinMatch.slice(0, 20)));
  console.log(`Ya coincidían (sin cambio necesario): ${identicos}`);
  console.log(`A corregir: ${aCorregir.length}`);

  let corregidos = 0;
  for (const { invoice, excel } of aCorregir) {
    await sequelize.query("UPDATE ordenes SET waybill_code = $1, waybill_status = $2 WHERE code = $3", {
      bind: [excel.waybill_code, excel.waybill_status, invoice],
    });
    corregidos++;
  }
  console.log(`Corregidos: ${corregidos}`);

  console.log(
    JSON.stringify(
      { totalExcel: codigos.length, sinMatchOrdenes: sinMatch.length, identicos, corregidos },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
