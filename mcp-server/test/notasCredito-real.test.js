// test/notasCredito-real.test.js
// Prueba de regresión con datos reales para `solo_notas_credito` en
// ventasCliente — ver el comentario grande de ventasCliente.js para la
// investigación completa. Caso real que motivó la extensión: CORPORACIÓN
// EL ROSADO, dirección "CD COMISARIATO" (codigo_direccion 113138 del
// codigo_cliente 110470), rango 2026-01-01 a 2026-09-16 — el neto normal
// muestra esa dirección en -$316,261.45 (confirmado llamando la tool real
// antes de construir nada), resultado de ~222 notas de crédito de ese
// período acumuladas contra las ventas normales de esa dirección.
require("dotenv").config();
const { ventasCliente } = require("../src/tools/ventasCliente");
const { pool } = require("../src/db");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

const CODIGOS = ["110470", "112892", "109880"];
const INICIO = "2026-01-01";
const FIN = "2026-09-16";
const CD_COMISARIATO = "113138";

async function main() {
  // 1) Regresión: sin solo_notas_credito, el flujo normal debe seguir dando
  //    EXACTO lo mismo de siempre — el neto (ventas - notas) es correcto y
  //    esta extensión no debe tocarlo.
  const normal = await ventasCliente({ codigo_cliente: CODIGOS, fecha_inicio: INICIO, fecha_fin: FIN });
  const dirNormal = normal.por_direccion.find((d) => d.codigo_direccion === CD_COMISARIATO);
  asegurar(!!dirNormal, "CD COMISARIATO aparece en por_direccion del flujo normal");
  asegurar(
    Math.abs(dirNormal.dolares - -316261.45) < 0.01,
    `CD COMISARIATO en el flujo normal sigue en -$316,261.45 (llegó: ${dirNormal.dolares}) — no se tocó el neto`
  );

  // 2) solo_notas_credito=true: mismos parámetros, ahora las notas como
  //    movimientos propios.
  const notas = await ventasCliente({
    codigo_cliente: CODIGOS,
    fecha_inicio: INICIO,
    fecha_fin: FIN,
    solo_notas_credito: true,
  });
  asegurar(notas.solo_notas_credito === true, "la respuesta confirma solo_notas_credito=true");
  asegurar(notas.notas_credito.length > 0, `hay notas de crédito en el período (llegaron: ${notas.notas_credito.length})`);
  asegurar(
    notas.notas_credito.every((n) => n.dolares >= 0),
    "todas las notas vienen con monto CRUDO positivo (no neteado/negado)"
  );
  asegurar(
    Math.abs(notas.total_notas_credito.dolares - notas.notas_credito.reduce((a, n) => a + n.dolares, 0)) < 0.01,
    "total_notas_credito.dolares == suma de notas_credito[].dolares"
  );

  // 3) Consistencia matemática con el flujo normal: ventas brutas de CD
  //    COMISARIATO = neto + notas de esa dirección (el neto ya las resta).
  const notasEnDireccion = notas.notas_credito.filter((n) => n.codigo_direccion === CD_COMISARIATO);
  const sumaNotasDireccion = notasEnDireccion.reduce((a, n) => a + n.dolares, 0);
  const ventasBrutasImplicitas = dirNormal.dolares + sumaNotasDireccion;
  asegurar(
    ventasBrutasImplicitas > 0,
    `neto (${dirNormal.dolares}) + notas de esa dirección (${sumaNotasDireccion.toFixed(2)}) da ventas brutas positivas (${ventasBrutasImplicitas.toFixed(2)}) — coherente con que las notas superan a las ventas ahí`
  );
  asegurar(
    notasEnDireccion.length >= 200 && notasEnDireccion.length <= 250,
    `~222 notas de crédito reales en CD COMISARIATO en el período (llegaron: ${notasEnDireccion.length})`
  );

  // 4) por_compania (multi-empresa): mismo criterio que el flujo normal —
  //    siempre presente cuando se consulta más de un codigo_cliente.
  asegurar(Array.isArray(notas.por_compania) && notas.por_compania.length === 3, "por_compania trae las 3 compañías");
  const sumaPorCompania = notas.por_compania.reduce((a, c) => a + c.dolares, 0);
  asegurar(
    Math.abs(sumaPorCompania - notas.total_notas_credito.dolares) < 0.01,
    `suma de por_compania (${sumaPorCompania.toFixed(2)}) == total_notas_credito.dolares (${notas.total_notas_credito.dolares})`
  );

  // 5) Cada nota multi-empresa trae codigo_cliente (para saber de qué
  //    compañía es); ninguna trae HTML crudo sin limpiar en el comentario.
  asegurar(
    notas.notas_credito.every((n) => "codigo_cliente" in n),
    "cada nota trae codigo_cliente (consulta multi-compañía)"
  );
  asegurar(
    notas.notas_credito.every((n) => n.comentario === null || (!n.comentario.includes("<") && !n.comentario.includes("&nbsp;"))),
    "ningún comentario trae HTML/entidades sin limpiar"
  );

  // 6) categoria/producto se ignoran en este modo (documentado) — no debe
  //    crashear ni cambiar el resultado.
  const notasConCategoria = await ventasCliente({
    codigo_cliente: ["110470"],
    fecha_inicio: INICIO,
    fecha_fin: FIN,
    categoria: "BOTELLÓN",
    solo_notas_credito: true,
  });
  const notasSinCategoria = await ventasCliente({
    codigo_cliente: ["110470"],
    fecha_inicio: INICIO,
    fecha_fin: FIN,
    solo_notas_credito: true,
  });
  asegurar(
    notasConCategoria.total_notas_credito.dolares === notasSinCategoria.total_notas_credito.dolares,
    "categoria no afecta el resultado de solo_notas_credito (se ignora, documentado)"
  );

  // 7) Single-company: sin por_compania, sin codigo_cliente por nota (sería
  //    redundante con un solo cliente resuelto).
  asegurar(notasSinCategoria.por_compania === undefined, "sin multicompañía, no se agrega por_compania");
  asegurar(
    notasSinCategoria.notas_credito.every((n) => !("codigo_cliente" in n)),
    "sin multicompañía, las notas no traen codigo_cliente redundante"
  );

  await pool.end();
  console.log("\nNOTAS CREDITO REAL TEST OK");
}

main().catch((err) => {
  console.error("\nNOTAS CREDITO REAL TEST FALLÓ:", err);
  process.exit(1);
});
