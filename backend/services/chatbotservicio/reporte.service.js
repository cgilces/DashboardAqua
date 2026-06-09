// services/chatbotservicio/reporte.service.js
// Genera PDFs y Excels profesionales para el ERP Grupo Aqua
// Instalar: npm install pdfkit exceljs

const PDFDocument = require("pdfkit");
const ExcelJS     = require("exceljs");

// ─── Paleta de colores Grupo Aqua ───────────────────
const COLORS = {
  verde:      "#014434",
  verdeClaro: "#025f4b",
  dorado:     "#D2B858",
  doradoOsc:  "#b89e3f",
  gris:       "#f5f5f5",
  grisMedio:  "#e0e0e0",
  texto:      "#1a1a1a",
  textoSuave: "#555555",
  blanco:     "#ffffff",
};

// ─── Tipos de reporte detectables ───────────────────
const TIPOS_REPORTE = [
  // Orden importa: los más específicos primero
  { id: "ventas_cliente",       keywords: ["reporte del cliente", "reporte de ventas del cliente", "reporte cliente", "ventas del cliente", "reporte de cliente", "del cliente", "reporte de ventas del"] },
  { id: "cartera_vencida",      keywords: ["cartera vencida", "deuda vencida", "facturas vencidas", "cuentas por cobrar", "cartera", "deudas vencidas"] },
  { id: "clientes_sin_comprar", keywords: ["clientes sin comprar", "clientes inactivos", "clientes en riesgo", "sin compras", "clientes que no compran", "clientes perdidos"] },
  { id: "nuevos_clientes",      keywords: ["nuevos clientes", "clientes nuevos", "primeras compras", "clientes recientes"] },
  { id: "efectividad_visitas",  keywords: ["efectividad de visitas", "efectividad visitas", "visitas con venta", "eficiencia visitas", "conversion visitas"] },
  { id: "cobertura_ruta",       keywords: ["cobertura de ruta", "cobertura ruta", "clientes visitados", "cobertura"] },
  { id: "cumplimiento_metas",   keywords: ["cumplimiento de meta", "cumplimiento meta", "avance de meta", "avance meta", "% meta", "porcentaje meta", "cumplimiento"] },
  { id: "kpi_dia",              keywords: ["kpi del dia", "kpi de hoy", "resumen del dia", "resumen ejecutivo", "indicadores del dia", "dashboard dia"] },
  { id: "ventas_categoria",     keywords: ["ventas por categoria", "categoria de productos", "categorias", "reporte categoria"] },
  { id: "margen_vendedor",      keywords: ["margen por vendedor", "margen vendedor", "margen de ganancia", "rentabilidad vendedor", "margen"] },
  { id: "comparativo_rutas",    keywords: ["comparativo rutas", "comparativo por ruta", "rutas comparativo", "comparativo ruta mes"] },
  { id: "ranking_clientes",     keywords: ["ranking clientes", "top clientes", "clientes mayor consumo", "mejores clientes", "reporte clientes"] },
  { id: "ventas_vendedor",      keywords: ["reporte por vendedor", "ventas por vendedor", "reporte vendedor", "comparativo vendedor"] },
  { id: "ventas_ruta",          keywords: ["reporte por ruta", "ventas por ruta", "reporte ruta"] },
  { id: "top_productos",        keywords: ["reporte productos", "top productos", "productos mas vendidos", "ranking productos"] },
  { id: "sincronizacion",       keywords: ["reporte sincronizacion", "reporte sync", "sincronizaciones"] },
  { id: "inventario",           keywords: ["reporte inventario", "stock", "existencias"] },
  { id: "visitas",              keywords: ["reporte visitas", "historial visitas", "visitas del dia"] },
  { id: "ventas_mes",           keywords: ["reporte ventas mes", "reporte mensual", "ventas del mes"] },
  { id: "ventas_semana",        keywords: ["reporte ventas semana", "reporte semanal", "ventas de la semana"] },
  { id: "ventas_fecha",         keywords: ["reporte ventas fecha", "reporte de ventas de fecha"] },
  { id: "ventas_dia",           keywords: ["reporte ventas hoy", "reporte de hoy", "ventas del dia", "reporte del dia"] },
];

/**
 * Detecta si el mensaje es una solicitud de reporte PDF.
 * @param {string} mensaje
 * @returns {string|null} tipo de reporte o null
 */
function detectarTipoReporte(mensaje) {
  const texto = mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const tipo of TIPOS_REPORTE) {
    if (tipo.keywords.some((k) => texto.includes(k))) {
      return tipo.id;
    }
  }

  // Detección genérica: "reporte/informe/pdf" + palabra de dominio
  const tieneTrigger =
    texto.includes("reporte") ||
    texto.includes("informe") ||
    texto.includes("pdf");

  const tieneDominio =
    texto.includes("venta") ||
    texto.includes("cliente") ||
    texto.includes("factura") ||
    texto.includes("producto") ||
    texto.includes("visita") ||
    texto.includes("fecha") ||
    texto.includes("criterio") ||
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(texto) ||
    /\d{4}/.test(texto);

  return tieneTrigger && tieneDominio ? "generico" : null;
}

/**
 * Suma segura de un campo numérico de un array de objetos.
 * Ignora valores nulos, undefined, NaN y strings no numéricos.
 * @param {Array} filas
 * @param {string} campo
 * @returns {number}
 */
function sumaSegura(filas, campo) {
  return filas.reduce((acc, d) => {
    const v = Number(d[campo]);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}

/**
 * Formatea número en estilo hispano: 1.250,50
 * @param {*} val
 * @param {number} decimals
 * @returns {string}
 */
function formatNum(val, decimals = 2) {
  if (val === null || val === undefined || val === "") return "0,00";
  const num = Number(val);
  if (isNaN(num)) return "0,00";
  return num
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Convierte un string con formato hispano (1.250,50 | 369 | 3,05) a número real,
 * para que en Excel las cifras sean numéricas (sumables) y no texto.
 * Si no parece un número, devuelve el valor original sin tocar.
 * @param {*} val
 * @returns {number|*}
 */
function aNumeroSiAplica(val) {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return val;
  const s = val.trim();
  if (s === "") return val;
  // 3.988,82 (miles con punto, decimal con coma) | 369 | 3,05 | -12,5 | +121,84
  if (/^[+\-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^[+\-]?\d+(,\d+)?$/.test(s)) {
    const num = Number(s.replace(/\./g, "").replace(",", "."));
    return isNaN(num) ? val : num;
  }
  return val;
}

/**
 * Valida la calidad de los datos antes de generar un PDF.
 * Evita producir reportes "vacíos" que son técnicamente filas pero sin información real.
 *
 * @param {Array<Object>} datos
 * @returns {{ valido: boolean, razon: string, pctLleno: number }}
 */
function validarCalidadDatos(datos) {
  if (!Array.isArray(datos) || datos.length === 0) {
    return { valido: false, razon: "No hay registros que mostrar en el reporte.", pctLleno: 0 };
  }

  const claves = Object.keys(datos[0] || {});
  if (claves.length === 0) {
    return { valido: false, razon: "Los registros no contienen información.", pctLleno: 0 };
  }

  // Contar celdas realmente "pobladas" (no null, no "", no 0 para numéricas)
  let totalCeldas = 0;
  let celdasPobladas = 0;
  datos.forEach((fila) => {
    claves.forEach((k) => {
      totalCeldas++;
      const v = fila[k];
      if (v == null) return;
      if (typeof v === "string" && v.trim() === "") return;
      // Valores 0 se cuentan como poblados (un KPI con 0 es un dato válido)
      celdasPobladas++;
    });
  });

  const pctLleno = totalCeldas > 0 ? (celdasPobladas / totalCeldas) * 100 : 0;

  // Menos del 20% de celdas con datos: reporte casi vacío
  if (pctLleno < 20) {
    return {
      valido: false,
      razon: `El reporte resultante está prácticamente vacío (${pctLleno.toFixed(0)}% de campos con información). Puedes reformular la consulta con criterios más específicos.`,
      pctLleno,
    };
  }

  return { valido: true, razon: "", pctLleno };
}

/**
 * Filtra claves/columnas que vienen con 100% de valores null o vacíos en todas las filas.
 * Se usa en modo "generico" para no dibujar columnas fantasma.
 *
 * @param {Array<Object>} datos
 * @returns {Array<string>} claves no vacías, en el orden original
 */
function filtrarClavesNoVacias(datos) {
  if (!datos || datos.length === 0) return [];
  const claves = Object.keys(datos[0]);
  return claves.filter((k) => {
    return datos.some((fila) => {
      const v = fila[k];
      if (v == null) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      return true;
    });
  });
}

/**
 * Formatea una fecha a string legible en español (EC).
 * @param {*} val
 * @returns {string}
 */
function formatFecha(val) {
  if (!val) return "-";
  try {
    const str = String(val);
    // Fecha pura YYYY-MM-DD: parsear manualmente para evitar el desfase UTC→local
    // new Date("2026-02-19") = medianoche UTC = 2026-02-18T19:00 en Ecuador (UTC-5)
    const soloFecha = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (soloFecha) {
      return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
    }
    // Timestamps completos: usar toLocaleDateString con zona Ecuador
    return new Date(str).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Guayaquil",
    });
  } catch {
    return String(val);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN DEL PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el PDF en un Buffer.
 * @param {Object} config - { titulo, subtitulo, columnas, filas, totales, tipo, generadoPor }
 * @returns {Promise<Buffer>}
 */
async function generarPDF(config) {
  return new Promise((resolve, reject) => {
    const {
      titulo       = "Reporte",
      subtitulo    = "",
      columnas     = [],
      filas        = [],
      totales      = null,
      generadoPor  = "Sistema",
      tipo         = "generico",
    } = config;

    // PDFDocument con bufferPages:true para poder iterar páginas al final
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title:   titulo,
        Author:  "Grupo Aqua ERP",
        Creator: "Sistema de Reportes Aqua",
      },
    });

    const chunks = [];
    doc.on("data",  (chunk) => chunks.push(chunk));
    doc.on("end",   ()      => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W   = doc.page.width - 80; // ancho útil (márgenes 40+40)
    const now = new Date();
    const fechaStr = now.toLocaleDateString("es-EC", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const horaStr = now.toLocaleTimeString("es-EC", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    // ── Helpers de dibujo ──────────────────────────────
    const rectFill = (x, y, w, h, color) =>
      doc.rect(x, y, w, h).fill(color);

    // ─────────────────────────────────────────────────
    // ENCABEZADO (primera página — se redibujaría en addPage si se usa callback)
    // ─────────────────────────────────────────────────
    const dibujarEncabezadoPagina = () => {
      rectFill(0, 0, doc.page.width, 110, COLORS.verde);
      rectFill(0, 108, doc.page.width, 4, COLORS.dorado);

      doc.fillColor(COLORS.dorado)
         .fontSize(22)
         .font("Helvetica-Bold")
         .text("GRUPO AQUA S.A.", 40, 20, { align: "left" });

      doc.fillColor(COLORS.blanco)
         .fontSize(9)
         .font("Helvetica")
         .text("Sistema ERP — Reportes Gerenciales", 40, 48);

      doc.fillColor(COLORS.grisMedio)
         .fontSize(8)
         .text(`Generado: ${fechaStr}`, 40, 68, { align: "right", width: W })
         .text(`Hora: ${horaStr}   |   Por: ${generadoPor}`, 40, 80, {
           align: "right",
           width: W,
         });
    };

    dibujarEncabezadoPagina();

    // ─────────────────────────────────────────────────
    // TÍTULO DEL REPORTE
    // ─────────────────────────────────────────────────
    const yTitulo = 125;

    doc.fillColor(COLORS.verde)
       .fontSize(16)
       .font("Helvetica-Bold")
       .text(titulo.toUpperCase(), 40, yTitulo, { align: "center", width: W });

    if (subtitulo) {
      doc.fillColor(COLORS.textoSuave)
         .fontSize(10)
         .font("Helvetica")
         .text(subtitulo, 40, yTitulo + 22, { align: "center", width: W });
    }

    const yLinea = yTitulo + (subtitulo ? 45 : 28);
    doc.moveTo(40, yLinea)
       .lineTo(40 + W, yLinea)
       .strokeColor(COLORS.dorado)
       .lineWidth(1.5)
       .stroke();

    // ─────────────────────────────────────────────────
    // CAJAS DE TOTALES (resumen destacado)
    // ─────────────────────────────────────────────────
    let yActual = yLinea + 15;

    if (totales && Object.keys(totales).length > 0) {
      const keys  = Object.keys(totales);
      const boxW  = Math.min(160, (W - (keys.length - 1) * 10) / keys.length);
      const totalAncho = keys.length * boxW + (keys.length - 1) * 10;
      let   xBox  = 40 + (W - totalAncho) / 2;

      keys.forEach((k) => {
        rectFill(xBox, yActual,      boxW, 48, COLORS.verde);
        rectFill(xBox, yActual + 44, boxW,  4, COLORS.dorado);

        doc.fillColor(COLORS.grisMedio)
           .fontSize(7.5)
           .font("Helvetica")
           .text(k.toUpperCase(), xBox + 4, yActual + 8, {
             width: boxW - 8, align: "center",
           });

        doc.fillColor(COLORS.dorado)
           .fontSize(13)
           .font("Helvetica-Bold")
           .text(String(totales[k]), xBox + 4, yActual + 22, {
             width: boxW - 8, align: "center",
           });

        xBox += boxW + 10;
      });

      yActual += 65;
    }

    // ─────────────────────────────────────────────────
    // TABLA DE DATOS
    // ─────────────────────────────────────────────────
    if (columnas.length > 0 && filas.length > 0) {
      const FONT_SIZE = 7.5;
      const PAD_X     = 5;
      const PAD_Y_TOP = 4;
      const MIN_ROW_H = 20;
      const LINE_H    = FONT_SIZE + 2;
      const HEADER_H  = 24;

      // ── Columna "#" ──────────────────────────────
      const columnasConNum = ["#", ...columnas];
      const filasConNum    = filas.map((fila, i) => {
        const valores = Array.isArray(fila) ? fila : Object.values(fila);
        return [String(i + 1), ...valores];
      });

      // ── Anchos proporcionales ────────────────────
      const NOMBRE_KEYWORDS = ["cliente", "nombre", "descripcion", "producto", "razon"];
      const esColumnaAncha  = (col) =>
        NOMBRE_KEYWORDS.some((k) => col.toLowerCase().includes(k));

      const NUM_COL_W  = 28;
      const Wrest      = W - NUM_COL_W;
      const colsResto  = columnasConNum.slice(1);
      const totalParts = colsResto.reduce(
        (sum, col) => sum + (esColumnaAncha(col) ? 3 : 1), 0
      );
      const colWidths = [
        NUM_COL_W,
        ...colsResto.map((col) =>
          Math.floor(Wrest * (esColumnaAncha(col) ? 3 : 1) / totalParts)
        ),
      ];
      // Compensar redondeo en última columna
      const sumaActual = colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += W - sumaActual;

      // Posiciones X acumuladas
      const colX = colWidths.reduce((acc, w, i) => {
        acc.push(i === 0 ? 40 : acc[i - 1] + colWidths[i - 1]);
        return acc;
      }, []);

      // ── Encabezado de tabla ──────────────────────
      const dibujarEncabezadoTabla = (y) => {
        rectFill(40, y, W, HEADER_H, COLORS.verdeClaro);
        columnasConNum.forEach((col, i) => {
          const alinear =
            i === 0 ? "center"
            : i === 1 || esColumnaAncha(col) ? "left"
            : "right";
          doc.fillColor(COLORS.blanco)
             .fontSize(FONT_SIZE)
             .font("Helvetica-Bold")
             .text(String(col).toUpperCase(), colX[i] + PAD_X, y + 8, {
               width:     colWidths[i] - PAD_X * 2,
               align:     alinear,
               lineBreak: false,
             });
        });
        return y + HEADER_H;
      };

      yActual = dibujarEncabezadoTabla(yActual);

      // ── Filas de datos ───────────────────────────
      filasConNum.forEach((fila, rowIdx) => {
        const valores = Array.isArray(fila) ? fila : Object.values(fila);

        // Altura dinámica por contenido
        const lineasPorCelda = valores.map((val, i) => {
          const texto       = val != null ? String(val) : "-";
          const anchoUtil   = colWidths[i] - PAD_X * 2;
          const charsPerLine = Math.max(1, Math.floor(anchoUtil / (FONT_SIZE * 0.52)));
          return Math.ceil(texto.length / charsPerLine);
        });
        const maxLineas = Math.max(...lineasPorCelda, 1);
        const rowH      = Math.max(MIN_ROW_H, PAD_Y_TOP * 2 + maxLineas * LINE_H);

        // Nueva página si no hay espacio (reservar 50px para pie)
        if (yActual + rowH > doc.page.height - 50) {
          doc.addPage();
          // Re-dibujar mini-encabezado en páginas secundarias
          rectFill(0, 0, doc.page.width, 30, COLORS.verde);
          rectFill(0, 28, doc.page.width, 3, COLORS.dorado);
          doc.fillColor(COLORS.dorado)
             .fontSize(10)
             .font("Helvetica-Bold")
             .text("GRUPO AQUA S.A.", 40, 8, { align: "left" });
          doc.fillColor(COLORS.blanco)
             .fontSize(7)
             .font("Helvetica")
             .text(`${titulo.toUpperCase()} (cont.)`, 40, 20, {
               align: "right", width: W,
             });
          yActual = 40;
          yActual = dibujarEncabezadoTabla(yActual);
        }

        // Fondo alternado
        if (rowIdx % 2 === 0) {
          rectFill(40, yActual, W, rowH, COLORS.gris);
        }

        // Línea separadora inferior
        doc.moveTo(40, yActual + rowH)
           .lineTo(40 + W, yActual + rowH)
           .strokeColor(COLORS.grisMedio)
           .lineWidth(0.3)
           .stroke();

        // Contenido de celdas
        valores.forEach((val, i) => {
          const texto  = val != null ? String(val) : "-";
          const esNum  = i === 0;
          const esIzq  = !esNum && (i === 1 || esColumnaAncha(columnasConNum[i]));
          const alinear = esNum ? "center" : esIzq ? "left" : "right";

          doc.fillColor(esNum ? COLORS.textoSuave : COLORS.texto)
             .fontSize(esNum ? 7 : FONT_SIZE)
             .font(esNum ? "Helvetica-Bold" : "Helvetica")
             .text(texto, colX[i] + PAD_X, yActual + PAD_Y_TOP, {
               width:     colWidths[i] - PAD_X * 2,
               height:    rowH - PAD_Y_TOP * 2,
               align:     alinear,
               lineBreak: !esNum,
               ellipsis:  false,
             });
        });

        yActual += rowH;
      });
    }

    // ─────────────────────────────────────────────────
    // PIE DE PÁGINA EN TODAS LAS PÁGINAS
    // Usar bufferPages:true + switchToPage para iterar al final
    // ─────────────────────────────────────────────────
    doc.flushPages(); // asegura que todas las páginas están en el buffer

    const range      = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);

      const pH = doc.page.height;
      rectFill(0, pH - 35, doc.page.width, 35, COLORS.verde);
      rectFill(0, pH - 37, doc.page.width,  2, COLORS.dorado);

      doc.fillColor(COLORS.grisMedio)
         .fontSize(7)
         .font("Helvetica")
         .text(
           "GRUPO AQUA S.A. — Sistema ERP — Documento generado automáticamente",
           40,
           pH - 22,
           { align: "left", width: W - 60 }
         )
         .text(
           `Pág. ${i + 1} / ${totalPages}`,
           40,
           pH - 22,
           { align: "right", width: W }
         );
    }

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DE CONFIGURACIÓN DE REPORTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye la configuración del reporte según el tipo y los datos SQL.
 * @param {string}   tipoReporte
 * @param {Array}    datos
 * @param {string}   usuario
 * @returns {Object}
 */
function construirConfigReporte(tipoReporte, datos, usuario) {
  const ahora    = new Date();
  const optsEC   = { timeZone: "America/Guayaquil" };
  const fechaHoy = ahora.toLocaleDateString("es-EC", {
    day: "2-digit", month: "long", year: "numeric", ...optsEC,
  });

  // ── Definición de configs por tipo ──────────────────
  const configs = {
    ventas_dia: {
      titulo:    "Reporte de Ventas del Día",
      subtitulo: `Fecha: ${fechaHoy}`,
      columnas:  ["Factura", "Cliente", "Vendedor", "Ruta", "Total ($)"],
      extractor: (d) => [
        d.code        || d.factura   || "-",
        d.nombre_cliente || d.cliente || d.customer_code || "-",
        d.seller_code || d.vendedor  || "-",
        d.route_code  || d.ruta      || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Facturas": filas.length,
        "Monto Total ($)": formatNum(sumaSegura(filas, "total")),
      }),
    },

    ventas_semana: {
      titulo:    "Reporte de Ventas Semanal",
      subtitulo: `Semana del ${fechaHoy}`,
      columnas:  ["Fecha", "Cliente", "Vendedor", "Total ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_creacion),
        d.nombre_cliente  || d.customer_code || "-",
        d.seller_code     || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Registros": filas.length,
        "Monto Total ($)": formatNum(sumaSegura(filas, "total")),
      }),
    },

    ventas_mes: {
      titulo:    "Reporte de Ventas Mensual",
      subtitulo: `Mes: ${ahora.toLocaleDateString("es-EC", { month: "long", year: "numeric", ...optsEC })}`,
      columnas:  ["Fecha", "Cliente", "Vendedor", "Total ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_creacion),
        d.nombre_cliente || d.customer_code || "-",
        d.seller_code    || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Ventas": filas.length,
        "Monto Total ($)": formatNum(sumaSegura(filas, "total")),
      }),
    },

    ventas_ruta: {
      titulo:    "Reporte de Ventas por Ruta",
      subtitulo: fechaHoy,
      columnas:  ["Ruta", "Total Ventas", "Monto ($)"],
      extractor: (d) => [
        d.route_code     || d.ruta   || "-",
        d.total_ventas   || d.count  || "-",
        formatNum(d.total ?? d.monto),
      ],
      totalesCalc: (filas) => ({
        "Rutas":     filas.length,
        "Total ($)": formatNum(sumaSegura(filas, "total") || sumaSegura(filas, "monto")),
      }),
    },

    ventas_vendedor: {
      titulo:    "Reporte de Ventas por Vendedor",
      subtitulo: fechaHoy,
      columnas:  ["Vendedor", "Total Ventas", "Monto ($)"],
      extractor: (d) => [
        d.seller_code  || d.vendedor || "-",
        d.total_ventas || d.count    || "-",
        formatNum(d.total ?? d.monto),
      ],
      totalesCalc: (filas) => ({
        "Vendedores": filas.length,
        "Total ($)":  formatNum(sumaSegura(filas, "total") || sumaSegura(filas, "monto")),
      }),
    },

    top_productos: {
      titulo:    "Reporte Top Productos Vendidos",
      subtitulo: fechaHoy,
      columnas:  ["Producto", "Categoría", "Unidades", "Total ($)"],
      extractor: (d) => [
        d.nombre_producto       || d.descripcion  || d.producto || "-",
        d.descripcion_categoria || d.categoria    || "-",
        formatNum(d.total_unidades || d.cantidad  || d.total_vendido || 0, 0),
        formatNum(d.monto_total    || d.total     || 0),
      ],
      totalesCalc: (filas) => ({
        "Productos": filas.length,
        "Unidades":  formatNum(
          sumaSegura(filas, "total_unidades") ||
          sumaSegura(filas, "cantidad")       ||
          sumaSegura(filas, "total_vendido"), 0
        ),
        "Total ($)": formatNum(
          sumaSegura(filas, "monto_total") || sumaSegura(filas, "total")
        ),
      }),
    },

    top_clientes: {
      titulo:    "Reporte Top Clientes",
      subtitulo: fechaHoy,
      columnas:  ["Cliente", "Tipo Negocio", "Compras", "Total ($)"],
      extractor: (d) => [
        d.nombre_cliente || d.nombre_comercial_cliente || "-",
        d.tipo_negocio   || d.codigo_tipo_negocio      || "-",
        d.total_compras  || d.count                    || "-",
        formatNum(d.total_ventas || d.total || d.monto),
      ],
      totalesCalc: (filas) => ({
        "Clientes":  filas.length,
        "Total ($)": formatNum(
          sumaSegura(filas, "total_ventas") || sumaSegura(filas, "total") || sumaSegura(filas, "monto")
        ),
      }),
    },

    visitas: {
      titulo:    "Reporte de Visitas",
      subtitulo: fechaHoy,
      columnas:  ["Fecha", "Usuario", "Cliente", "Acción", "Monto ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_visita),
        d.nombre_usuario  || d.codigo_usuario || "-",
        d.nombre_cliente  || "-",
        d.accion          || "-",
        formatNum(d.monto),
      ],
      totalesCalc: (filas) => ({
        "Total Visitas": filas.length,
        "Total ($)":     formatNum(sumaSegura(filas, "monto")),
      }),
    },

    sincronizacion: {
      titulo:    "Reporte de Sincronizaciones",
      subtitulo: fechaHoy,
      columnas:  ["Fecha Sync", "Desde", "Hasta", "Registros", "Estado"],
      extractor: (d) => [
        formatFecha(d.fecha_sync),
        d.desde_date      || "-",
        d.hasta_date      || "-",
        d.total_registros || "-",
        d.estado          || "-",
      ],
      totalesCalc: (filas) => ({
        "Total Syncs": filas.length,
        "Registros":   sumaSegura(filas, "total_registros"),
      }),
    },

    ventas_cliente: {
      titulo:    "Reporte de Ventas por Cliente",
      subtitulo: fechaHoy,
      columnas:  ["Factura", "Fecha", "Producto", "Cant.", "Total Línea ($)", "Vendedor", "Ruta", "Total Factura ($)"],
      extractor: (d) => {
        // Usar ?? (nullish) en lugar de || para que el valor 0 se muestre correctamente
        const totalLinea   = d.total_linea   ?? d.monto_total ?? null;
        // total_factura puede no venir en el SQL — intentar todos los alias posibles
        const totalFactura = d.total_factura ?? d.total       ?? totalLinea ?? null;
        return [
          d.factura         ?? d.code            ?? "-",
          formatFecha(d.fecha ?? d.fecha_creacion),
          d.producto        ?? d.producto_nombre ?? d.descripcion ?? d.nombre_producto ?? "-",
          formatNum(d.cantidad ?? d.total_unidades ?? 0, 0),
          formatNum(totalLinea   ?? 0),
          d.usuario         ?? d.seller_code     ?? "-",
          d.ruta            ?? d.route_code      ?? "-",
          formatNum(totalFactura ?? 0),
        ];
      },
      totalesCalc: (filas) => ({
        "Total Líneas":     filas.length,
        "Total Líneas ($)": formatNum(
          sumaSegura(filas, "total_linea") ||
          sumaSegura(filas, "monto_total") ||
          sumaSegura(filas, "total")
        ),
      }),
    },

    ventas_fecha: {
      titulo:    "Reporte de Ventas por Fecha",
      subtitulo: fechaHoy,
      columnas:  ["Fecha", "Cliente", "Vendedor", "Ruta", "Estado Pago", "Total ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_creacion),
        d.nombre_cliente  || d.customer_code || "-",
        d.seller_code     || "-",
        d.route_code      || "-",
        d.estado_pago     || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Facturas": filas.length,
        "Total ($)":      formatNum(sumaSegura(filas, "total")),
      }),
    },

    ranking_clientes: {
      titulo:    "Ranking de Clientes por Ventas",
      subtitulo: fechaHoy,
      columnas:  ["Cliente", "Nombre Comercial", "Facturas", "Total Ventas ($)"],
      extractor: (d) => [
        d.nombre_cliente             || d.customer_code || "-",
        d.nombre_comercial_cliente   || "-",
        String(d.total_facturas      || d.facturas || 0),
        formatNum(d.total_ventas     || d.total    || 0),
      ],
      totalesCalc: (filas) => ({
        "Clientes":  filas.length,
        "Total ($)": formatNum(sumaSegura(filas, "total_ventas") || sumaSegura(filas, "total")),
      }),
    },

    cartera_vencida: {
      titulo:    "Cartera Vencida",
      subtitulo: fechaHoy,
      columnas:  ["Cliente", "Vendedor", "Facturas Vencidas", "Deuda Total ($)", "Vencimiento más Antiguo"],
      extractor: (d) => [
        d.nombre_cliente             || d.nombre_comercial_cliente || d.customer_code || "-",
        d.seller_code                || "-",
        String(d.facturas_vencidas   || d.total_facturas || 0),
        formatNum(d.deuda_total      || d.saldo_pendiente || d.saldo_total || 0),
        formatFecha(d.vencimiento_mas_antiguo || d.fecha_vencimiento),
      ],
      totalesCalc: (filas) => ({
        "Clientes":       filas.length,
        "Deuda Total ($)": formatNum(sumaSegura(filas, "deuda_total") || sumaSegura(filas, "saldo_total")),
      }),
    },

    clientes_sin_comprar: {
      titulo:    "Clientes Sin Comprar",
      subtitulo: fechaHoy,
      columnas:  ["Cliente", "Nombre Comercial", "Vendedor", "Última Compra", "Días Sin Comprar", "Total Ventas ($)"],
      extractor: (d) => [
        d.nombre_cliente           || d.codigo_cliente  || "-",
        d.nombre_comercial_cliente || "-",
        d.seller_code              || "-",
        formatFecha(d.ultima_compra),
        String(d.dias_sin_comprar  || "-"),
        formatNum(d.total_ventas   || d.total || 0),
      ],
      totalesCalc: (filas) => ({
        "Clientes": filas.length,
      }),
    },

    nuevos_clientes: {
      titulo:    "Nuevos Clientes",
      subtitulo: fechaHoy,
      columnas:  ["Cliente", "Nombre Comercial", "Vendedor", "Ruta", "Primera Compra", "Total Comprado ($)"],
      extractor: (d) => [
        d.nombre_cliente           || "-",
        d.nombre_comercial_cliente || "-",
        d.seller_code              || "-",
        d.route_code               || d.ruta || "-",
        formatFecha(d.primera_compra),
        formatNum(d.total_comprado || d.total || 0),
      ],
      totalesCalc: (filas) => ({
        "Nuevos Clientes": filas.length,
        "Total ($)":       formatNum(sumaSegura(filas, "total_comprado") || sumaSegura(filas, "total")),
      }),
    },

    efectividad_visitas: {
      titulo:    "Efectividad de Visitas",
      subtitulo: fechaHoy,
      columnas:  ["Vendedor", "Total Visitas", "Clientes Visitados", "Con Venta", "Sin Venta", "Efectividad %", "Monto ($)"],
      extractor: (d) => [
        d.vendedor            || d.codigo_usuario || d.seller_code || "-",
        String(d.total_visitas        || 0),
        String(d.clientes_visitados   || 0),
        String(d.visitas_con_venta    || 0),
        String(d.visitas_sin_venta    || 0),
        formatNum(d.pct_efectividad   || 0) + "%",
        formatNum(d.monto_total       || d.monto || 0),
      ],
      totalesCalc: (filas) => ({
        "Vendedores":   filas.length,
        "Total Visitas": sumaSegura(filas, "total_visitas"),
        "Monto ($)":    formatNum(sumaSegura(filas, "monto_total") || sumaSegura(filas, "monto")),
      }),
    },

    cobertura_ruta: {
      titulo:    "Cobertura de Rutas",
      subtitulo: fechaHoy,
      columnas:  ["Ruta", "Clientes en Ruta", "Clientes Visitados", "Cobertura %"],
      extractor: (d) => [
        d.ruta                     || d.route_code || d.codigo_ruta || "-",
        String(d.clientes_en_ruta  || 0),
        String(d.clientes_visitados|| 0),
        formatNum(d.pct_cobertura  || 0) + "%",
      ],
      totalesCalc: (filas) => ({
        "Rutas":            filas.length,
        "Total Visitados":  sumaSegura(filas, "clientes_visitados"),
      }),
    },

    cumplimiento_metas: {
      titulo:    "Cumplimiento de Metas",
      subtitulo: fechaHoy,
      columnas:  ["Ruta", "Meta Unidades", "Real Unidades", "% Unidades", "Meta ($)", "Real ($)", "% Dólares"],
      extractor: (d) => [
        d.codigo_ruta             || d.ruta    || "-",
        formatNum(d.meta_unidades || 0, 0),
        formatNum(d.unidades_reales || 0, 0),
        formatNum(d.pct_unidades  || 0) + "%",
        formatNum(d.meta_dolares  || 0),
        formatNum(d.dolares_reales|| 0),
        formatNum(d.pct_dolares   || 0) + "%",
      ],
      totalesCalc: (filas) => ({
        "Rutas": filas.length,
        "Real Total ($)": formatNum(sumaSegura(filas, "dolares_reales")),
      }),
    },

    kpi_dia: {
      titulo:    "KPI del Día — Resumen Ejecutivo",
      subtitulo: fechaHoy,
      columnas:  ["Indicador", "Valor"],
      // El SQL de KPI devuelve UNA fila con múltiples columnas.
      // Convertimos cada columna en una fila indicador/valor.
      extractor: (d) => {
        // Este extractor se llama por cada fila del resultado.
        // Para KPI el resultado viene ya preprocesado como array de {indicador, valor}.
        return [
          String(d.indicador || d.nombre || Object.keys(d)[0] || "-"),
          String(d.valor     || Object.values(d)[0] || "-"),
        ];
      },
      totalesCalc: () => null,
    },

    ventas_categoria: {
      titulo:    "Ventas por Categoría de Producto",
      subtitulo: fechaHoy,
      columnas:  ["Categoría", "Código", "Unidades", "Documentos", "Total ($)"],
      extractor: (d) => [
        d.categoria            || d.descripcion_categoria || "SIN CATEGORÍA",
        d.codigo_categoria     || "-",
        formatNum(d.total_unidades || d.cantidad || 0, 0),
        String(d.total_documentos  || 0),
        formatNum(d.monto_total    || d.total    || 0),
      ],
      totalesCalc: (filas) => ({
        "Categorías": filas.length,
        "Unidades":   formatNum(sumaSegura(filas, "total_unidades") || sumaSegura(filas, "cantidad"), 0),
        "Total ($)":  formatNum(sumaSegura(filas, "monto_total") || sumaSegura(filas, "total")),
      }),
    },

    margen_vendedor: {
      titulo:    "Margen por Vendedor",
      subtitulo: fechaHoy,
      columnas:  ["Vendedor", "Ventas ($)", "Margen ($)", "Margen Promedio %"],
      extractor: (d) => [
        d.vendedor             || d.seller_code    || "-",
        formatNum(d.ventas_totales || d.total      || 0),
        formatNum(d.margen_total   || d.margen     || 0),
        formatNum(d.margen_promedio_pct || d.margen_porcentaje || 0) + "%",
      ],
      totalesCalc: (filas) => ({
        "Vendedores":   filas.length,
        "Ventas ($)":  formatNum(sumaSegura(filas, "ventas_totales") || sumaSegura(filas, "total")),
        "Margen ($)":  formatNum(sumaSegura(filas, "margen_total")   || sumaSegura(filas, "margen")),
      }),
    },

    comparativo_rutas: {
      titulo:    "Comparativo de Rutas — Mes Actual vs Anterior",
      subtitulo: fechaHoy,
      columnas:  ["Ruta", "Mes Actual ($)", "Mes Anterior ($)", "Variación ($)"],
      extractor: (d) => {
        const actual   = Number(d.mes_actual   || 0);
        const anterior = Number(d.mes_anterior || 0);
        const variacion = actual - anterior;
        return [
          d.ruta         || d.route_code    || d.codigo_ruta || "-",
          formatNum(actual),
          formatNum(anterior),
          (variacion >= 0 ? "+" : "") + formatNum(variacion),
        ];
      },
      totalesCalc: (filas) => ({
        "Rutas":            filas.length,
        "Total Actual ($)": formatNum(sumaSegura(filas, "mes_actual")),
        "Total Ant. ($)":   formatNum(sumaSegura(filas, "mes_anterior")),
      }),
    },

    generico: {
      titulo:      "Reporte General",
      subtitulo:   fechaHoy,
      columnas:    [],   // se calcula dinámicamente abajo
      extractor:   (d) => Object.values(d).map((v) => v != null ? String(v) : "-"),
      totalesCalc: (filas) => ({ "Total Registros": filas.length }),
    },
  };

  // ── Resolver configuración con fallback a generico ──
  let cfg = configs[tipoReporte];
  if (!cfg) {
    console.warn(`⚠️  Tipo de reporte desconocido: "${tipoReporte}", usando generico`);
    cfg = configs.generico;
    tipoReporte = "generico";
  }

  // ── Modo generico: columnas y extractor dinámicos ──
  if (tipoReporte === "generico" && datos.length > 0) {
    // Sólo incluir claves que tengan al menos UN valor no vacío en todo el dataset.
    // Esto evita dibujar columnas fantasma llenas de "-" cuando el SQL devuelve
    // campos que siempre vienen null (p.ej. fechas opcionales, contactos, etc.)
    const claves = filtrarClavesNoVacias(datos);
    cfg = { ...cfg }; // clonar para no mutar el objeto original

    cfg.columnas = claves.map((k) =>
      k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );

    cfg.extractor = (d) =>
      claves.map((k) => {
        const v = d[k];
        if (v == null) return "-";
        if (
          v instanceof Date ||
          (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
        ) {
          return formatFecha(v);
        }
        if (
          typeof v === "number" ||
          (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim() !== "")
        ) {
          return formatNum(v);
        }
        return String(v);
      });

    // Detectar la mejor columna para sumar: primero busca campos monetarios
    // conocidos, luego cae a la primera que contenga "total" en el nombre.
    const CAMPOS_MONTO = ["total_ventas", "monto_total", "total", "monto", "ventas", "valor", "saldo_total", "deuda_total"];
    const claveMonto = claves.find((k) => CAMPOS_MONTO.includes(k.toLowerCase())) ||
                       claves.find((k) => k.toLowerCase().includes("total") || k.toLowerCase().includes("monto"));
    if (claveMonto) {
      cfg.totalesCalc = (filas) => ({
        "Total Registros": filas.length,
        "Total ($)":       formatNum(sumaSegura(filas, claveMonto)),
      });
    }
  }

  // ── Ordenar por campo numérico solo para reportes de ranking ──
  // Para reportes cronológicos (ventas_dia, ventas_mes, etc.) se respeta el orden SQL
  const TIPOS_RANKING = ["top_productos", "top_clientes", "ventas_vendedor", "ventas_ruta", "generico"];
  const CAMPOS_ORDEN  = ["total", "monto", "total_ventas", "monto_total", "total_vendido"];
  const campoOrden    = TIPOS_RANKING.includes(tipoReporte)
    ? Object.keys(datos[0] || {}).find((k) => CAMPOS_ORDEN.some((c) => k.toLowerCase() === c))
    : null;
  const datosOrdenados = campoOrden
    ? [...datos].sort((a, b) => Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0))
    : datos;

  // ── Construir filas ──────────────────────────────
  const filas = datosOrdenados.map((d) => {
    try {
      return cfg.extractor(d);
    } catch {
      return Object.values(d).map((v) => (v != null ? String(v) : "-"));
    }
  });

  const totales = cfg.totalesCalc ? cfg.totalesCalc(datosOrdenados) : null;

  return {
    titulo:      cfg.titulo,
    subtitulo:   cfg.subtitulo,
    columnas:    cfg.columnas,
    filas,
    totales,
    generadoPor: usuario || "Sistema",
    tipo:        tipoReporte,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERACIÓN DEL EXCEL (.xlsx)
// Consume el MISMO config que generarPDF (titulo, subtitulo, columnas, filas,
// totales, generadoPor) para que ambos formatos salgan idénticos.
// ─────────────────────────────────────────────────────────────────────────────
async function generarExcel(config) {
  const {
    titulo      = "Reporte",
    subtitulo   = "",
    columnas    = [],
    filas       = [],
    totales     = null,
    generadoPor = "Sistema",
  } = config;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Grupo Aqua ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reporte");

  const headers = ["#", ...columnas];
  const nCols   = Math.max(headers.length, 1);

  // ── Título ──────────────────────────────────────────
  ws.mergeCells(1, 1, 1, nCols);
  const cTit = ws.getCell(1, 1);
  cTit.value = titulo.toUpperCase();
  cTit.font = { bold: true, size: 16, color: { argb: "FF014434" } };
  cTit.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  // ── Subtítulo ───────────────────────────────────────
  let fila = 2;
  if (subtitulo) {
    ws.mergeCells(2, 1, 2, nCols);
    const cSub = ws.getCell(2, 1);
    cSub.value = subtitulo;
    cSub.font = { size: 11, color: { argb: "FF555555" } };
    cSub.alignment = { horizontal: "center" };
    fila = 3;
  }

  // ── Línea de generado ──────────────────────────────
  ws.mergeCells(fila, 1, fila, nCols);
  const cInfo = ws.getCell(fila, 1);
  cInfo.value = `Generado: ${new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}  |  Por: ${generadoPor}`;
  cInfo.font = { size: 9, italic: true, color: { argb: "FF888888" } };
  cInfo.alignment = { horizontal: "right" };
  fila += 2; // fila en blanco de separación

  // ── Encabezado de tabla ─────────────────────────────
  const headerRowIdx = fila;
  const headerRow = ws.getRow(fila);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF025F4B" } };
    cell.alignment = { horizontal: i === 0 ? "center" : "left", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD2B858" } } };
  });
  headerRow.height = 20;
  fila++;

  // ── Filas de datos ──────────────────────────────────
  filas.forEach((f, idx) => {
    const valores = Array.isArray(f) ? f : Object.values(f);
    const rowData = [idx + 1, ...valores.map(aNumeroSiAplica)];
    const row = ws.getRow(fila);
    rowData.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      if (i === 0) {
        cell.alignment = { horizontal: "center" };
      } else if (typeof val === "number") {
        cell.numFmt = Number.isInteger(val) ? "#,##0" : "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      }
    });
    fila++;
  });

  // ── Totales al pie ──────────────────────────────────
  if (totales && Object.keys(totales).length > 0) {
    fila++; // separación
    Object.entries(totales).forEach(([k, v]) => {
      const cLabel = ws.getCell(fila, 1);
      cLabel.value = k;
      cLabel.font = { bold: true, color: { argb: "FF014434" } };
      const cVal = ws.getCell(fila, 2);
      cVal.value = aNumeroSiAplica(String(v));
      cVal.font = { bold: true };
      if (typeof cVal.value === "number") cVal.numFmt = "#,##0.00";
      fila++;
    });
  }

  // ── Anchos de columna automáticos ───────────────────
  ws.columns.forEach((col, i) => {
    let maxLen = headers[i] ? String(headers[i]).length : 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value != null ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 6), 45);
  });

  // Congelar título + encabezado
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  detectarTipoReporte,
  generarPDF,
  generarExcel,
  construirConfigReporte,
  validarCalidadDatos,
  filtrarClavesNoVacias,
};