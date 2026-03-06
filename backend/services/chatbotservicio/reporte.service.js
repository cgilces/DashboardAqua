// services/chatbotservicio/reporte.service.js
// Genera PDFs profesionales para el ERP Grupo Aqua
// Instalar: npm install pdfkit

const PDFDocument = require("pdfkit");

// ─── Paleta de colores Grupo Aqua ───────────────────
const COLORS = {
  verde:       "#014434",
  verdeClaro:  "#025f4b",
  dorado:      "#D2B858",
  doradoOsc:   "#b89e3f",
  gris:        "#f5f5f5",
  grisMedio:   "#e0e0e0",
  texto:       "#1a1a1a",
  textoSuave:  "#555555",
  blanco:      "#ffffff",
};

// ─── Tipos de reporte detectables ───────────────────
const TIPOS_REPORTE = [
  { id: "ventas_dia",       keywords: ["reporte ventas hoy", "reporte del dia", "reporte de hoy", "ventas del dia"] },
  { id: "ventas_semana",    keywords: ["reporte ventas semana", "reporte semanal", "ventas de la semana"] },
  { id: "ventas_mes",       keywords: ["reporte ventas mes", "reporte mensual", "ventas del mes"] },
  { id: "ventas_ruta",      keywords: ["reporte por ruta", "ventas por ruta", "reporte ruta"] },
  { id: "ventas_vendedor",  keywords: ["reporte por vendedor", "ventas por vendedor", "reporte vendedor"] },
  { id: "top_productos",    keywords: ["reporte productos", "top productos", "productos mas vendidos", "ranking productos"] },
  { id: "top_clientes",     keywords: ["reporte clientes", "top clientes", "clientes mayor consumo", "mejores clientes"] },
  { id: "inventario",       keywords: ["reporte inventario", "stock", "existencias"] },
  { id: "visitas",          keywords: ["reporte visitas", "historial visitas", "visitas del dia"] },
  { id: "sincronizacion",   keywords: ["reporte sincronizacion", "reporte sync", "sincronizaciones"] },
  // Reportes con cliente específico: "reporte del cliente X", "reporte de ventas del cliente X"
  { id: "ventas_cliente",   keywords: ["reporte del cliente", "reporte de ventas del cliente", "reporte cliente", "ventas del cliente", "reporte de cliente"] },
  // Reportes con fecha específica
  { id: "ventas_fecha",     keywords: ["reporte ventas fecha", "reporte de ventas de fecha", "ventas del dia", "reporte del dia"] },
];

/**
 * Detecta si el mensaje es una solicitud de reporte PDF
 * @returns {string|null} tipo de reporte o null
 */
function detectarTipoReporte(mensaje) {
  const texto = mensaje.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const tipo of TIPOS_REPORTE) {
    if (tipo.keywords.some(k => texto.includes(k))) {
      return tipo.id;
    }
  }
  // Detección genérica: si tiene "reporte" o "pdf" con alguna palabra de datos
  if ((texto.includes("reporte") || texto.includes("informe") || texto.includes("pdf")) &&
      (texto.includes("venta") || texto.includes("cliente") || texto.includes("factura") ||
       texto.includes("producto") || texto.includes("visita") || texto.includes("fecha") ||
       texto.includes("criterio") || texto.includes("marzo") || texto.includes("enero") ||
       texto.includes("febrero") || texto.includes("abril") || texto.includes("mayo") ||
       texto.includes("junio") || texto.includes("julio") || texto.includes("agosto") ||
       texto.includes("septiembre") || texto.includes("octubre") || texto.includes("noviembre") ||
       texto.includes("diciembre") || /\d{4}/.test(texto))) {
    return "generico";
  }
  return null;
}

/**
 * Formatea número en estilo hispano: 1.250,50
 */
function formatNum(val, decimals = 2) {
  if (val === null || val === undefined) return "0,00";
  return Number(val)
    .toFixed(decimals)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Genera el PDF en un Buffer
 * @param {Object} config - { titulo, subtitulo, columnas, filas, totales, tipo, generadoPor }
 * @returns {Promise<Buffer>}
 */
async function generarPDF(config) {
  return new Promise((resolve, reject) => {
    const {
      titulo = "Reporte",
      subtitulo = "",
      columnas = [],
      filas = [],
      totales = null,
      generadoPor = "Sistema",
      tipo = "generico",
    } = config;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: titulo,
        Author: "Grupo Aqua ERP",
        Creator: "Sistema de Reportes Aqua",
      },
    });

    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80; // ancho útil
    const now = new Date();
    const fechaStr = now.toLocaleDateString("es-EC", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const horaStr = now.toLocaleTimeString("es-EC", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    // ─────────────────────────────────────────────────
    // ENCABEZADO
    // ─────────────────────────────────────────────────
    // Fondo verde encabezado
    doc.rect(0, 0, doc.page.width, 110).fill(COLORS.verde);

    // Línea dorada decorativa
    doc.rect(0, 108, doc.page.width, 4).fill(COLORS.dorado);

    // Nombre empresa
    doc.fillColor(COLORS.dorado)
       .fontSize(22)
       .font("Helvetica-Bold")
       .text("GRUPO AQUA S.A.", 40, 20, { align: "left" });

    // Subtexto empresa
    doc.fillColor(COLORS.blanco)
       .fontSize(9)
       .font("Helvetica")
       .text("Sistema ERP — Reportes Gerenciales", 40, 48);

    // Fecha y hora (derecha)
    doc.fillColor(COLORS.grisMedio)
       .fontSize(8)
       .text(`Generado: ${fechaStr}`, 40, 68, { align: "right", width: W })
       .text(`Hora: ${horaStr}   |   Por: ${generadoPor}`, 40, 80, { align: "right", width: W });

    // ─────────────────────────────────────────────────
    // TÍTULO DEL REPORTE
    // ─────────────────────────────────────────────────
    doc.moveDown(0.5);
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

    // Línea divisora
    const yLinea = yTitulo + (subtitulo ? 45 : 28);
    doc.moveTo(40, yLinea).lineTo(40 + W, yLinea)
       .strokeColor(COLORS.dorado).lineWidth(1.5).stroke();

    // ─────────────────────────────────────────────────
    // RESUMEN (totales destacados si existen)
    // ─────────────────────────────────────────────────
    let yActual = yLinea + 15;

    if (totales && Object.keys(totales).length > 0) {
      const keys = Object.keys(totales);
      const boxW = Math.min(160, (W - (keys.length - 1) * 10) / keys.length);
      const totalAncho = keys.length * boxW + (keys.length - 1) * 10;
      let xBox = 40 + (W - totalAncho) / 2;

      keys.forEach(k => {
        // Caja de resumen
        doc.rect(xBox, yActual, boxW, 48)
           .fill(COLORS.verde);
        doc.rect(xBox, yActual + 44, boxW, 4)
           .fill(COLORS.dorado);

        doc.fillColor(COLORS.grisMedio)
           .fontSize(7.5)
           .font("Helvetica")
           .text(k.toUpperCase(), xBox + 4, yActual + 8, { width: boxW - 8, align: "center" });

        doc.fillColor(COLORS.dorado)
           .fontSize(13)
           .font("Helvetica-Bold")
           .text(String(totales[k]), xBox + 4, yActual + 22, { width: boxW - 8, align: "center" });

        xBox += boxW + 10;
      });

      yActual += 65;
    }

    // ─────────────────────────────────────────────────
    // TABLA DE DATOS — anchos proporcionales + altura dinámica
    // ─────────────────────────────────────────────────
    if (columnas.length > 0 && filas.length > 0) {
      const FONT_SIZE  = 7.5;
      const PAD_X      = 5;
      const PAD_Y_TOP  = 4;
      const MIN_ROW_H  = 22;
      const LINE_H     = FONT_SIZE + 2;
      const headerH    = 24;

      // ── Inyectar columna "#" al inicio ──
      const columnasConNum = ["#", ...columnas];
      const filasConNum    = filas.map((fila, i) => {
        const valores = Array.isArray(fila) ? fila : Object.values(fila);
        return [String(i + 1), ...valores];
      });

      // ── Anchos proporcionales ──
      const NOMBRE_KEYWORDS = ["cliente", "nombre", "descripcion", "producto", "razon"];
      const esColumnaAncha  = (nombre) =>
        NOMBRE_KEYWORDS.some(k => nombre.toLowerCase().includes(k));

      // "#" ocupa ancho fijo pequeño (30px), el resto proporcional
      const NUM_COL_W  = 30;
      const Wrest      = W - NUM_COL_W;
      const colsResto  = columnasConNum.slice(1); // sin "#"
      const totalParts = colsResto.reduce((sum, col) =>
        sum + (esColumnaAncha(col) ? 3 : 1), 0);
      const colWidths  = [
        NUM_COL_W,
        ...colsResto.map(col =>
          Math.floor(Wrest * (esColumnaAncha(col) ? 3 : 1) / totalParts)
        ),
      ];
      // Ajustar última columna para compensar redondeos
      const sumaActual = colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += W - sumaActual;

      // Posiciones X acumuladas
      const colX = colWidths.reduce((acc, w, i) => {
        acc.push(i === 0 ? 40 : acc[i - 1] + colWidths[i - 1]);
        return acc;
      }, []);

      // ── Encabezado ──
      const dibujarEncabezado = (y) => {
        doc.rect(40, y, W, headerH).fill(COLORS.verdeClaro);
        columnasConNum.forEach((col, i) => {
          doc.fillColor(COLORS.blanco)
             .fontSize(FONT_SIZE)
             .font("Helvetica-Bold")
             .text(
               String(col).toUpperCase(),
               colX[i] + PAD_X,
               y + 8,
               { width: colWidths[i] - PAD_X * 2, align: i === 0 ? "center" : (i === 1 || esColumnaAncha(col)) ? "left" : "right", lineBreak: false }
             );
        });
        return y + headerH;
      };

      yActual = dibujarEncabezado(yActual);

      // ── Filas ──
      filasConNum.forEach((fila, rowIdx) => {
        const valores = Array.isArray(fila) ? fila : Object.values(fila);

        // Altura dinámica según contenido más largo
        const lineasPorCelda = valores.map((val, i) => {
          const texto = val !== null && val !== undefined ? String(val) : "-";
          const anchoUtil = colWidths[i] - PAD_X * 2;
          const charsPerLine = Math.max(1, Math.floor(anchoUtil / (FONT_SIZE * 0.52)));
          return Math.ceil(texto.length / charsPerLine);
        });
        const maxLineas = Math.max(...lineasPorCelda, 1);
        const rowH = Math.max(MIN_ROW_H, PAD_Y_TOP * 2 + maxLineas * LINE_H);

        // Nueva página si no cabe
        if (yActual + rowH > doc.page.height - 60) {
          doc.addPage();
          yActual = 40;
          yActual = dibujarEncabezado(yActual);
        }

        // Fondo alternado
        if (rowIdx % 2 === 0) {
          doc.rect(40, yActual, W, rowH).fill(COLORS.gris);
        }

        // Línea inferior
        doc.moveTo(40, yActual + rowH)
           .lineTo(40 + W, yActual + rowH)
           .strokeColor(COLORS.grisMedio).lineWidth(0.3).stroke();

        // Texto de celdas
        valores.forEach((val, i) => {
          const texto = val !== null && val !== undefined ? String(val) : "-";
          const esNum  = i === 0; // columna "#"
          const esIzq  = i === 1 || esColumnaAncha(columnasConNum[i]);
          doc.fillColor(esNum ? COLORS.textoSuave : COLORS.texto)
             .fontSize(esNum ? 7 : FONT_SIZE)
             .font(esNum ? "Helvetica-Bold" : "Helvetica")
             .text(
               texto,
               colX[i] + PAD_X,
               yActual + PAD_Y_TOP,
               {
                 width:     colWidths[i] - PAD_X * 2,
                 height:    rowH - PAD_Y_TOP * 2,
                 align:     esNum ? "center" : esIzq ? "left" : "right",
                 lineBreak: !esNum,
                 ellipsis:  false,
               }
             );
        });

        yActual += rowH;
      });
    }

    // ─────────────────────────────────────────────────
    // PIE DE PÁGINA
    // ─────────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;

    const addFooter = (pageNum) => {
      doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill(COLORS.verde);
      doc.rect(0, doc.page.height - 37, doc.page.width, 2).fill(COLORS.dorado);

      doc.fillColor(COLORS.grisMedio)
         .fontSize(7)
         .font("Helvetica")
         .text(
           "GRUPO AQUA S.A. — Sistema ERP — Documento generado automáticamente",
           40,
           doc.page.height - 22,
           { align: "left", width: W - 80 }
         )
         .text(
           `Pág. ${pageNum}`,
           40,
           doc.page.height - 22,
           { align: "right", width: W }
         );
    };

    // Agregar pie en todas las páginas
    const range = doc.bufferedPageRange();
    if (range) {
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        addFooter(i + 1);
      }
    } else {
      addFooter(1);
    }

    doc.end();
  });
}

/**
 * Construye la configuración del reporte según el tipo y los datos SQL
 */
function construirConfigReporte(tipoReporte, datos, usuario) {
  const ahora = new Date();
  const fechaHoy = ahora.toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });

  const configs = {
    ventas_dia: {
      titulo: "Reporte de Ventas del Día",
      subtitulo: `Fecha: ${fechaHoy}`,
      columnas: ["Factura", "Cliente", "Vendedor", "Ruta", "Total ($)"],
      extractor: (d) => [d.code || d.factura, d.nombre_cliente || d.cliente, d.seller_code || d.vendedor, d.route_code || d.ruta, formatNum(d.total)],
      totalesKeys: ["Total Facturas", "Monto Total ($)"],
      totalesCalc: (filas) => ({
        "Total Facturas": filas.length,
        "Monto Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    ventas_semana: {
      titulo: "Reporte de Ventas Semanal",
      subtitulo: `Semana del ${fechaHoy}`,
      columnas: ["Fecha", "Cliente", "Vendedor", "Productos", "Total ($)"],
      extractor: (d) => [d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString("es-EC") : "-", d.nombre_cliente || d.customer_code, d.seller_code, d.cantidad || "-", formatNum(d.total)],
      totalesCalc: (filas) => ({
        "Total Registros": filas.length,
        "Monto Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    ventas_mes: {
      titulo: "Reporte de Ventas Mensual",
      subtitulo: `Mes: ${ahora.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}`,
      columnas: ["Fecha", "Cliente", "Vendedor", "Total ($)"],
      extractor: (d) => [d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString("es-EC") : "-", d.nombre_cliente || d.customer_code, d.seller_code, formatNum(d.total)],
      totalesCalc: (filas) => ({
        "Total Ventas": filas.length,
        "Monto Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    ventas_ruta: {
      titulo: "Reporte de Ventas por Ruta",
      subtitulo: fechaHoy,
      columnas: ["Ruta", "Total Ventas", "Monto ($)"],
      extractor: (d) => [d.route_code || d.ruta, d.total_ventas || d.count, formatNum(d.total || d.monto)],
      totalesCalc: (filas) => ({
        "Rutas": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)),
      }),
    },
    ventas_vendedor: {
      titulo: "Reporte de Ventas por Vendedor",
      subtitulo: fechaHoy,
      columnas: ["Vendedor", "Total Ventas", "Monto ($)"],
      extractor: (d) => [d.seller_code || d.vendedor, d.total_ventas || d.count, formatNum(d.total || d.monto)],
      totalesCalc: (filas) => ({
        "Vendedores": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)),
      }),
    },
    top_productos: {
      titulo: "Reporte Top Productos Vendidos",
      subtitulo: fechaHoy,
      columnas: ["Producto", "Categoría", "Unidades", "Total ($)"],
      extractor: (d) => [d.descripcion || d.nombre_producto, d.descripcion_categoria || d.categoria, formatNum(d.cantidad, 0), formatNum(d.total)],
      totalesCalc: (filas) => ({
        "Productos": filas.length,
        "Unidades": formatNum(filas.reduce((a, d) => a + Number(d.cantidad || 0), 0), 0),
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    top_clientes: {
      titulo: "Reporte Top Clientes",
      subtitulo: fechaHoy,
      columnas: ["Cliente", "Tipo Negocio", "Compras", "Total ($)"],
      extractor: (d) => [d.nombre_cliente || d.nombre_comercial_cliente, d.tipo_negocio || d.codigo_tipo_negocio, d.total_compras || d.count, formatNum(d.total || d.monto)],
      totalesCalc: (filas) => ({
        "Clientes": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || d.monto || 0), 0)),
      }),
    },
    visitas: {
      titulo: "Reporte de Visitas",
      subtitulo: fechaHoy,
      columnas: ["Fecha", "Usuario", "Cliente", "Acción", "Monto ($)"],
      extractor: (d) => [d.fecha_visita ? new Date(d.fecha_visita).toLocaleDateString("es-EC") : "-", d.nombre_usuario || d.codigo_usuario, d.nombre_cliente, d.accion, formatNum(d.monto)],
      totalesCalc: (filas) => ({
        "Total Visitas": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.monto || 0), 0)),
      }),
    },
    sincronizacion: {
      titulo: "Reporte de Sincronizaciones",
      subtitulo: fechaHoy,
      columnas: ["Fecha Sync", "Desde", "Hasta", "Registros", "Estado"],
      extractor: (d) => [d.fecha_sync ? new Date(d.fecha_sync).toLocaleDateString("es-EC") : "-", d.desde_date, d.hasta_date, d.total_registros, d.estado],
      totalesCalc: (filas) => ({
        "Total Syncs": filas.length,
        "Registros": filas.reduce((a, d) => a + Number(d.total_registros || 0), 0),
      }),
    },
    ventas_cliente: {
      titulo: "Reporte de Ventas por Cliente",
      subtitulo: fechaHoy,
      columnas: ["Fecha", "Factura", "Vendedor", "Producto", "Cantidad", "Total ($)"],
      extractor: (d) => [
        d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString("es-EC") : "-",
        d.code || d.factura || "-",
        d.seller_code || "-",
        d.descripcion || d.nombre_producto || "-",
        formatNum(d.cantidad, 0),
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Facturas": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    ventas_fecha: {
      titulo: "Reporte de Ventas por Fecha",
      subtitulo: fechaHoy,
      columnas: ["Fecha", "Cliente", "Vendedor", "Total ($)"],
      extractor: (d) => [
        d.fecha_creacion ? new Date(d.fecha_creacion).toLocaleDateString("es-EC") : "-",
        d.nombre_cliente || d.customer_code || "-",
        d.seller_code || "-",
        formatNum(d.total),
      ],
      totalesCalc: (filas) => ({
        "Total Ventas": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d.total || 0), 0)),
      }),
    },
    generico: {
      titulo: "Reporte General",
      subtitulo: fechaHoy,
      // columnas y extractor se calculan dinámicamente abajo
      columnas: [],
      extractor: (d) => Object.values(d).slice(0, 7).map(v => v !== null && v !== undefined ? String(v) : "-"),
      totalesCalc: (filas) => ({ "Total Registros": filas.length }),
    },
  };

  // Resolver configuración — con fallback robusto a generico
  let cfg = configs[tipoReporte];
  if (!cfg) {
    console.warn(`⚠️  Tipo de reporte desconocido: "${tipoReporte}", usando generico`);
    cfg = configs.generico;
  }

  // Para el tipo generico, detectar columnas y extractor dinámicamente
  if ((tipoReporte === "generico" || !configs[tipoReporte]) && datos.length > 0) {
    const claves = Object.keys(datos[0]).slice(0, 7);
    cfg.columnas = claves.map(k =>
      k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
    );
    cfg.extractor = (d) => claves.map(k => {
      const v = d[k];
      if (v === null || v === undefined) return "-";
      // Formatear fechas automáticamente
      if (v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))) {
        try { return new Date(v).toLocaleDateString("es-EC"); } catch { return String(v); }
      }
      // Formatear números con decimales
      if (typeof v === "number" || (typeof v === "string" && /^\d+\.\d+$/.test(v))) {
        return formatNum(v);
      }
      return String(v);
    });
    // Agregar totales si hay columna "total"
    const claveTotal = Object.keys(datos[0]).find(k => k.toLowerCase().includes("total"));
    if (claveTotal) {
      cfg.totalesCalc = (filas) => ({
        "Total Registros": filas.length,
        "Total ($)": formatNum(filas.reduce((a, d) => a + Number(d[claveTotal] || 0), 0)),
      });
    }
  }

  // ── Ordenar datos por campo total de mayor a menor ──
  const campoCampos = ["total", "monto", "total_ventas", "monto_total"];
  const campoOrden  = Object.keys(datos[0] || {}).find(k =>
    campoCampos.some(c => k.toLowerCase() === c)
  );
  const datosOrdenados = campoOrden
    ? [...datos].sort((a, b) => Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0))
    : datos;

  const filas = datosOrdenados.map(d => {
    try { return cfg.extractor(d); }
    catch { return Object.values(d).slice(0, cfg.columnas.length).map(v => v !== null ? String(v) : "-"); }
  });

  const totales = cfg.totalesCalc ? cfg.totalesCalc(datosOrdenados) : null;

  return {
    titulo: cfg.titulo,
    subtitulo: cfg.subtitulo,
    columnas: cfg.columnas,
    filas,
    totales,
    generadoPor: usuario || "Sistema",
    tipo: tipoReporte,
  };
}

module.exports = { detectarTipoReporte, generarPDF, construirConfigReporte };
