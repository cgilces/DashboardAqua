// services/chatbotservicio/reporte.service.js
// Genera PDFs profesionales para el ERP Grupo Aqua
// Instalar: npm install pdfkit

const PDFDocument = require("pdfkit");

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
  { id: "ventas_cliente",  keywords: ["reporte del cliente", "reporte de ventas del cliente", "reporte cliente", "ventas del cliente", "reporte de cliente"] },
  { id: "ventas_vendedor", keywords: ["reporte por vendedor", "ventas por vendedor", "reporte vendedor"] },
  { id: "ventas_ruta",     keywords: ["reporte por ruta", "ventas por ruta", "reporte ruta"] },
  { id: "top_productos",   keywords: ["reporte productos", "top productos", "productos mas vendidos", "ranking productos"] },
  { id: "top_clientes",    keywords: ["reporte clientes", "top clientes", "clientes mayor consumo", "mejores clientes"] },
  { id: "sincronizacion",  keywords: ["reporte sincronizacion", "reporte sync", "sincronizaciones"] },
  { id: "inventario",      keywords: ["reporte inventario", "stock", "existencias"] },
  { id: "visitas",         keywords: ["reporte visitas", "historial visitas", "visitas del dia"] },
  { id: "ventas_mes",      keywords: ["reporte ventas mes", "reporte mensual", "ventas del mes"] },
  { id: "ventas_semana",   keywords: ["reporte ventas semana", "reporte semanal", "ventas de la semana"] },
  // ventas_dia al final para no capturar antes que ventas_fecha
  { id: "ventas_fecha",    keywords: ["reporte ventas fecha", "reporte de ventas de fecha"] },
  { id: "ventas_dia",      keywords: ["reporte ventas hoy", "reporte de hoy", "ventas del dia", "reporte del dia"] },
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
 * Formatea una fecha a string legible en español (EC).
 * @param {*} val
 * @returns {string}
 */
function formatFecha(val) {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
  const fechaHoy = ahora.toLocaleDateString("es-EC", {
    day: "2-digit", month: "long", year: "numeric",
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
        "Monto Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || 0), 0)
        ),
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
        "Monto Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || 0), 0)
        ),
      }),
    },

    ventas_mes: {
      titulo:    "Reporte de Ventas Mensual",
      subtitulo: `Mes: ${ahora.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}`,
      columnas:  ["Fecha", "Cliente", "Vendedor", "Total ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_creacion),
        d.nombre_cliente || d.customer_code || "-",
        d.seller_code    || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Ventas": filas.length,
        "Monto Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || 0), 0)
        ),
      }),
    },

    ventas_ruta: {
      titulo:    "Reporte de Ventas por Ruta",
      subtitulo: fechaHoy,
      columnas:  ["Ruta", "Total Ventas", "Monto ($)"],
      extractor: (d) => [
        d.route_code     || d.ruta   || "-",
        d.total_ventas   || d.count  || "-",
        formatNum(d.total || d.monto),
      ],
      totalesCalc: (filas) => ({
        "Rutas":     filas.length,
        "Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)
        ),
      }),
    },

    ventas_vendedor: {
      titulo:    "Reporte de Ventas por Vendedor",
      subtitulo: fechaHoy,
      columnas:  ["Vendedor", "Total Ventas", "Monto ($)"],
      extractor: (d) => [
        d.seller_code  || d.vendedor || "-",
        d.total_ventas || d.count    || "-",
        formatNum(d.total || d.monto),
      ],
      totalesCalc: (filas) => ({
        "Vendedores": filas.length,
        "Total ($)":  formatNum(
          filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)
        ),
      }),
    },

    top_productos: {
      titulo:    "Reporte Top Productos Vendidos",
      subtitulo: fechaHoy,
      columnas:  ["Producto", "Categoría", "Unidades", "Total ($)"],
      extractor: (d) => [
        d.nombre_producto     || d.descripcion          || "-",
        d.descripcion_categoria || d.categoria           || "-",
        formatNum(d.cantidad  || d.total_vendido || 0, 0),
        formatNum(d.total     || d.monto_total   || 0),
      ],
      totalesCalc: (filas) => ({
        "Productos": filas.length,
        "Unidades":  formatNum(
          filas.reduce((a, d) => a + Number(d.cantidad || d.total_vendido || 0), 0), 0
        ),
        "Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || d.monto_total || 0), 0)
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
        formatNum(d.total || d.monto),
      ],
      totalesCalc: (filas) => ({
        "Clientes":  filas.length,
        "Total ($)": formatNum(
          filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)
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
        "Total ($)":     formatNum(
          filas.reduce((a, d) => a + Number(d.monto || 0), 0)
        ),
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
        "Registros":   filas.reduce((a, d) => a + Number(d.total_registros || 0), 0),
      }),
    },

    ventas_cliente: {
      titulo:    "Reporte de Ventas por Cliente",
      subtitulo: fechaHoy,
      columnas:  ["Fecha", "Factura", "Vendedor", "Producto", "Cantidad", "Total ($)"],
      extractor: (d) => [
        formatFecha(d.fecha_creacion),
        d.code            || d.factura        || "-",
        d.seller_code     || "-",
        d.descripcion     || d.nombre_producto || "-",
        formatNum(d.cantidad || 0, 0),
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Facturas": filas.length,
        "Total ($)":      formatNum(
          filas.reduce((a, d) => a + Number(d.total || 0), 0)
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
        "Total ($)":      formatNum(
          filas.reduce((a, d) => a + Number(d.total || 0), 0)
        ),
      }),
    },

    generico: {
      titulo:      "Reporte General",
      subtitulo:   fechaHoy,
      columnas:    [],   // se calcula dinámicamente abajo
      extractor:   (d) => Object.values(d).slice(0, 7).map((v) => v != null ? String(v) : "-"),
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
    const claves = Object.keys(datos[0]).slice(0, 7);
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
          (typeof v === "string" && /^\d+\.\d+$/.test(v))
        ) {
          return formatNum(v);
        }
        return String(v);
      });

    const claveTotal = claves.find((k) => k.toLowerCase().includes("total"));
    if (claveTotal) {
      cfg.totalesCalc = (filas) => ({
        "Total Registros": filas.length,
        "Total ($)":       formatNum(
          filas.reduce((a, d) => a + Number(d[claveTotal] || 0), 0)
        ),
      });
    }
  }

  // ── Ordenar por campo numérico principal de mayor a menor ──
  const CAMPOS_ORDEN = ["total", "monto", "total_ventas", "monto_total", "total_vendido"];
  const campoOrden   = Object.keys(datos[0] || {}).find((k) =>
    CAMPOS_ORDEN.some((c) => k.toLowerCase() === c)
  );
  const datosOrdenados = campoOrden
    ? [...datos].sort((a, b) => Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0))
    : datos;

  // ── Construir filas ──────────────────────────────
  const filas = datosOrdenados.map((d) => {
    try {
      return cfg.extractor(d);
    } catch {
      return Object.values(d)
        .slice(0, cfg.columnas.length)
        .map((v) => (v != null ? String(v) : "-"));
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

module.exports = { detectarTipoReporte, generarPDF, construirConfigReporte };