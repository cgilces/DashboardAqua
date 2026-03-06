const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generador profesional de SQL seguro para PostgreSQL
 * Grupo Aqua ERP — v4 schema completo y corregido
 */
async function generarSQL(pregunta, rol, sellerCode, sqlPrevioFallido = null, errorPrevio = null) {
  console.log("========== 🧠 GENERAR SQL ==========");
  console.log("Pregunta:", pregunta);
  console.log("Rol:", rol, "| SellerCode:", sellerCode);
  if (sqlPrevioFallido) console.log("🔁 Modo corrección activo");

  try {
    const filtroVendedor = rol === "VENDEDOR" && sellerCode
      ? `AND f.seller_code = '${sellerCode}'`
      : "";

    const contextoError = sqlPrevioFallido && errorPrevio ? `
=====================================================
⚠️  CORRECCIÓN REQUERIDA
=====================================================
El siguiente SQL fue ejecutado y falló con este error PostgreSQL:

ERROR: ${errorPrevio}

SQL fallido:
${sqlPrevioFallido}

Analiza el error y genera un SQL corregido y válido.
=====================================================
` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      top_p: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sql_response",
          schema: {
            type: "object",
            properties: { sql: { type: "string" } },
            required: ["sql"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: `
Eres un generador experto de SQL para PostgreSQL del ERP Grupo Aqua.
Tu única tarea es generar consultas SELECT válidas, seguras y optimizadas.

=====================================================
REGLAS CRÍTICAS (OBLIGATORIAS)
=====================================================

1) SOLO generar SELECT.
2) PROHIBIDO: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE.
3) SOLO usar tablas y columnas definidas en este prompt.
4) NO inventar columnas ni tablas.
5) Si la pregunta no es del dominio del sistema: SELECT 1 WHERE FALSE

=====================================================
⚠️  REGLA DE ORO — ALIAS OBLIGATORIOS
=====================================================

NUNCA referenciar un alias en SELECT/WHERE/JOIN
que no esté declarado en el FROM o en un JOIN.

Tabla                    → Alias OBLIGATORIO
─────────────────────────────────────────────
facturas                 → f
ordenes                  → o
detalle_documento        → d
clientes                 → c
rutas                    → r
detalles_rutas           → dr
historial_visitas        → hv
direcciones_clientes     → dc
clientes_usuarios_ventas → cuv
productos                → p
sincronizaciones_ventas  → sv
tipos_negocio            → tn
app_users                → u
tipo_documento_latam     → tdl

=====================================================
BÚSQUEDA POR NOMBRE DE CLIENTE  ← CRÍTICO
=====================================================

Cuando el usuario mencione un cliente por nombre
(ej: "TIA", "SUPERMAXI", "CORAL", "AKI", etc.):

SIEMPRE usar búsqueda parcial ILIKE (nunca = para nombres):

  LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
  WHERE (
    c.nombre_cliente           ILIKE '%TIA%'
    OR c.nombre_comercial_cliente ILIKE '%TIA%'
  )

NUNCA usar = para nombres de clientes.
El usuario puede escribir el nombre parcialmente o en minúsculas.

=====================================================
ESQUEMA COMPLETO DE TABLAS
=====================================================

─────────────────────────────────────────────────────
TABLA: app_users  (alias: u)
─────────────────────────────────────────────────────
id               SERIAL PK
usuario          TEXT UNIQUE
clave            TEXT
rol              TEXT  -- 'ADMIN' | 'VENDEDOR' | 'DESPACHADOR'
rutas_asignadas  TEXT[]
creado_en        TIMESTAMP
actualizado_en   TIMESTAMP

─────────────────────────────────────────────────────
TABLA: productos  (alias: p)
─────────────────────────────────────────────────────
codigo_producto        VARCHAR(50) PK
nombre_producto        VARCHAR(255)
nombre_alterno         VARCHAR(150)
codigo_barras          VARCHAR(100)
codigo_marca           VARCHAR(50)
codigo_categoria       VARCHAR(50)
codigo_subcategoria    VARCHAR(50)
codigo_familia         VARCHAR(50)
codigo_unidad_medida   VARCHAR(50)
codigo_tipo_inventario VARCHAR(50)
costo                  NUMERIC(12,2)
ultimo_costo           NUMERIC(12,2)
estado                 INTEGER   -- 1=Activo, 0=Inactivo
tipo_producto          INTEGER

─────────────────────────────────────────────────────
TABLA: tipos_negocio  (alias: tn)
─────────────────────────────────────────────────────
id                  SERIAL PK
codigo              VARCHAR(50) UNIQUE
descripcion         VARCHAR(150)
color               VARCHAR(20)
estado              INT          -- 1=Activo, 0=Inactivo
fecha_creacion      TIMESTAMP
fecha_actualizacion TIMESTAMP

─────────────────────────────────────────────────────
TABLA: clientes  (alias: c)
─────────────────────────────────────────────────────
id_cliente                      SERIAL PK
codigo_cliente                  VARCHAR(255) UNIQUE
company_id                      VARCHAR(10)
descripcion_company              VARCHAR(50)
tipo_identificacion_cliente     VARCHAR(50)
identificacion_cliente          VARCHAR(30)
nombre_cliente                  VARCHAR(255)
nombre_comercial_cliente        VARCHAR(255)
codigo_tipo_negocio             VARCHAR(50)   -- FK → tipos_negocio.codigo
contacto_cliente                VARCHAR(255)
codigo_moneda_cliente           VARCHAR(3)
codigo_lista_precio_cliente     VARCHAR(50)
metodo_pago_cliente             VARCHAR(50)
codigo_grupo_cliente            VARCHAR(50)
descuento_cliente               DECIMAL(10,2)
objetivo_venta_cliente          DECIMAL(10,2)
saldo_cliente                   DECIMAL(10,2)
tiene_credito_cliente           BOOLEAN
tiene_documentos_cliente        BOOLEAN
estado                          VARCHAR(25)
estado_cliente                  INT           -- 1=Activo, 0=Inactivo
estado_proceso_cliente          INT
nacionalidad_cliente            VARCHAR(50)
codigo_usuario_asignado_cliente VARCHAR(20)
fecha_creacion_cliente          TIMESTAMP
fecha_actualizacion_cliente     TIMESTAMP

─────────────────────────────────────────────────────
TABLA: direcciones_clientes  (alias: dc)
─────────────────────────────────────────────────────
id_direccion_cliente                  SERIAL PK
codigo_cliente                        VARCHAR(255)  -- FK → clientes
descripcion_direccion_cliente         VARCHAR(255)
codigo_direccion_cliente              VARCHAR(255)
calle1_direccion_cliente              VARCHAR(255)
bloque_direccion_cliente              VARCHAR(255)
calle2_direccion_cliente              VARCHAR(255)
referencia_direccion_cliente          VARCHAR(255)
codigo_postal_direccion_cliente       VARCHAR(20)
telefono_direccion_cliente            VARCHAR(50)
fax_direccion_cliente                 VARCHAR(50)
email_direccion_cliente               VARCHAR(100)
latitud_direccion_cliente             DECIMAL(15,8)
longitud_direccion_cliente            DECIMAL(15,8)
fecha_ultima_visita_direccion_cliente TIMESTAMP
estado_direccion_cliente              INT   -- 1=Activo
estado_ubicacion_direccion_cliente    INT   -- 3=Sin ubicar
fecha_creacion_direccion_cliente      TIMESTAMP
fecha_actualizacion_direccion_cliente TIMESTAMP

─────────────────────────────────────────────────────
TABLA: clientes_usuarios_ventas  (alias: cuv)
─────────────────────────────────────────────────────
id_relacion              SERIAL PK
codigo_cliente           VARCHAR(50)
codigo_direccion_cliente VARCHAR(100)
seller_code              VARCHAR(50)
ruta_code                VARCHAR(50)
tipo_atencion            VARCHAR(20)  -- 'PREVENTA' | 'TELEVENTA' | 'VIP'
ultima_atencion          TIMESTAMP

─────────────────────────────────────────────────────
TABLA: ordenes  (alias: o)
─────────────────────────────────────────────────────
id_orden             SERIAL PK
code                 VARCHAR(50) UNIQUE
type                 INT
status               INT
fecha_creacion       TIMESTAMP
fecha_entrega        TIMESTAMP
fecha_validez        TIMESTAMP
fecha_compromiso     TIMESTAMP
customer_code        VARCHAR(50)
route_code           VARCHAR(50)
seller_code          VARCHAR(50)
equipo_ventas        VARCHAR(100)
estado_odoo          VARCHAR(50)
estado_facturacion   VARCHAR(50)
estado_entrega       VARCHAR(50)
moneda               VARCHAR(10)
tasa_cambio          DECIMAL(18,6)
total                DECIMAL(18,2)
subtotal             DECIMAL(18,2)
iva                  DECIMAL(18,2)
discount             DECIMAL(18,2)
monto_no_pagado      DECIMAL(18,2)
costo_envio          DECIMAL(18,2)
parent_id            VARCHAR(50)
latitude             DECIMAL(12,8)
longitude            DECIMAL(12,8)
concept_code         VARCHAR(50)
concept_origin       VARCHAR(50)
sequence_type        VARCHAR(10)
notes                TEXT
origen_sistema       VARCHAR(20)

─────────────────────────────────────────────────────
TABLA: facturas  (alias: f)
─────────────────────────────────────────────────────
id_factura            SERIAL PK
code                  VARCHAR(30) UNIQUE
type                  INT
status                INT
fecha_creacion        TIMESTAMP
fecha_autorizacion    TIMESTAMP
fecha_entrega         TIMESTAMP
customer_code         VARCHAR(30)
customer_address_code VARCHAR(30)
route_code            VARCHAR(50)
seller_code           VARCHAR(50)
total                 DECIMAL(18,2)
subtotal              DECIMAL(18,2)
iva                   DECIMAL(18,2)
discount              DECIMAL(18,2)
parent_id             VARCHAR(50)
auth_code             VARCHAR(200)
access_key            VARCHAR(200)
latitude              DECIMAL(12,8)
longitude             DECIMAL(12,8)
notes                 TEXT
estado_pago           VARCHAR(20)   -- 'not_paid' | 'partial' | 'paid'
saldo_pendiente       DECIMAL(18,2)
fecha_vencimiento     TIMESTAMP
tipo_documento        VARCHAR(20)
moneda                VARCHAR(10)
company_id            INT
reversed_entry_id     INT
origen_sistema        VARCHAR(15)

─────────────────────────────────────────────────────
TABLA: detalle_documento  (alias: d)
─────────────────────────────────────────────────────
id_detalle                       SERIAL PK
documento_code                   VARCHAR(50)   -- FK → facturas.code o ordenes.code
codigo_producto                  VARCHAR(100)
descripcion                      VARCHAR(300)
cantidad                         DECIMAL(18,2)
cantidad_entregada               DECIMAL(18,2)
cantidad_facturada               DECIMAL(18,2)
cantidad_pendiente_entregar      DECIMAL(18,2)
cantidad_pendiente_facturar      DECIMAL(18,2)
precio                           DECIMAL(18,2)
descuento_linea                  DECIMAL(18,2)
subtotal                         DECIMAL(18,2)
total                            DECIMAL(18,2)
iva                              DECIMAL(18,2)
precio_con_impuesto              DECIMAL(18,2)
precio_sin_impuesto              DECIMAL(18,2)
impuesto_linea                   DECIMAL(18,2)
unit_alias                       VARCHAR(100)
barcode                          VARCHAR(100)
codigo_categoria                 VARCHAR(10)
descripcion_categoria            VARCHAR(100)
estado_facturacion_linea         VARCHAR(50)
estado_odoo_linea                VARCHAR(50)
es_anticipo                      BOOLEAN
es_envio                         BOOLEAN

─────────────────────────────────────────────────────
TABLA: rutas  (alias: r)
─────────────────────────────────────────────────────
id                   SERIAL PK
codigo               VARCHAR(100) UNIQUE
descripcion          VARCHAR(255)
codigo_cliente       VARCHAR(30)
codigo_direccion     VARCHAR(40)
tipo                 INT
estado               INT
creado_por           INT
actualizado_por      INT
creado_por_id        VARCHAR(255)
actualizado_por_id   VARCHAR(255)
fecha_creacion       TIMESTAMP
fecha_actualizacion  TIMESTAMP

─────────────────────────────────────────────────────
TABLA: detalles_rutas  (alias: dr)
─────────────────────────────────────────────────────
id                       SERIAL PK
codigo                   VARCHAR(100) UNIQUE
codigo_ruta              VARCHAR(100)
route_code               VARCHAR(100)
customer_code            VARCHAR(255)
codigo_cliente           VARCHAR(100)
codigo_direccion_cliente VARCHAR(100)
semana                   INT
dia                      INT
secuencia                INT
estado                   INT
datos                    JSONB
creado_por               INT
actualizado_por          INT
creado_por_id            VARCHAR(255)
actualizado_por_id       VARCHAR(255)
fecha_creacion           TIMESTAMP
fecha_actualizacion      TIMESTAMP
ruta_codigo_lookup       VARCHAR(255)
cliente_codigo_lookup    VARCHAR(255)
direccion_codigo_lookup  VARCHAR(255)

─────────────────────────────────────────────────────
TABLA: sincronizaciones_ventas  (alias: sv)
─────────────────────────────────────────────────────
id_sync          SERIAL PK
fecha_sync       TIMESTAMP
desde_date       DATE
hasta_date       DATE
total_registros  INT
estado           VARCHAR(20)
mensaje          VARCHAR(100)

─────────────────────────────────────────────────────
TABLA: historial_visitas  (alias: hv)
─────────────────────────────────────────────────────
id                                SERIAL PK
fecha_visita                      TIMESTAMP
codigo_usuario                    VARCHAR(50)
codigo_ruta                       VARCHAR(50)
codigo_cliente                    VARCHAR(50)
codigo_direccion_cliente          VARCHAR(50)
semana                            INT
dia                               INT
accion                            VARCHAR(50)
codigo_comentario                 VARCHAR(50)
comentario                        TEXT
monto                             DECIMAL(18,2)
latitud                           DECIMAL(12,8)
longitud                          DECIMAL(12,8)
estado_proceso                    INT    -- 0=pendiente, 1=completado
ruptura_secuencia                 INT    -- 1=sí, 0=no
nombre_cliente                    VARCHAR(250)
nombre_empresa_cliente            VARCHAR(250)
nombre_comercial_cliente          VARCHAR(250)
tipo_identificacion_cliente       VARCHAR(10)
numero_identificacion_cliente     VARCHAR(20)
contacto_cliente                  VARCHAR(50)
comentario_cliente                TEXT
estado_cliente                    INT
nombre_usuario                    VARCHAR(250)
email_usuario                     VARCHAR(100)
email_notificacion_usuario        VARCHAR(100)
identidad_usuario                 VARCHAR(50)
tipo_identificacion_usuario       VARCHAR(10)
sucursal_usuario                  VARCHAR(100)
telefono_usuario                  VARCHAR(50)
direccion_usuario                 VARCHAR(500)
marca_dispositivo_usuario         VARCHAR(100)
modelo_dispositivo_usuario        VARCHAR(100)
numero_dispositivo_usuario        VARCHAR(100)
codigo_almacen_usuario            VARCHAR(50)
codigo_ruta_predeterminada_usuario VARCHAR(50)
codigo_rol_usuario                VARCHAR(50)

─────────────────────────────────────────────────────
TABLA: tipo_documento_latam  (alias: tdl)
─────────────────────────────────────────────────────
id                            SERIAL PK
secuencia                     VARCHAR(255)
id_pais                       INT
nombre                        VARCHAR(255)
prefijo_codigo_documento      VARCHAR(10)
codigo                        VARCHAR(10)
nombre_reporte                VARCHAR(255)
tipo_interno                  VARCHAR(50)
activo                        BOOLEAN
fecha_creacion                TIMESTAMP
fecha_actualizacion           TIMESTAMP
verificar_formato_ecuador     BOOLEAN

=====================================================
JOINS CORRECTOS
=====================================================

facturas → detalle_documento  : f.code = d.documento_code
facturas → clientes            : f.customer_code = c.codigo_cliente
ordenes  → detalle_documento  : o.code = d.documento_code
ordenes  → clientes            : o.customer_code = c.codigo_cliente
detalles_rutas → clientes      : dr.codigo_cliente = c.codigo_cliente
                               ó dr.customer_code = c.codigo_cliente
detalles_rutas → rutas         : dr.codigo_ruta = r.codigo
clientes → tipos_negocio       : c.codigo_tipo_negocio = tn.codigo
clientes → direcciones         : c.codigo_cliente = dc.codigo_cliente
facturas → direcciones         : f.customer_address_code = dc.codigo_direccion_cliente
cuv → clientes                 : cuv.codigo_cliente = c.codigo_cliente

=====================================================
REGLAS DE DATOS
=====================================================

✔ type, status, estado, estado_cliente son INTEGER, no texto.
✔ estado_pago en facturas es texto: 'not_paid', 'partial', 'paid'
✔ tipo_atencion en cuv es texto: 'PREVENTA', 'TELEVENTA', 'VIP'
✔ Nunca usar c.nombre → usar c.nombre_cliente o c.nombre_comercial_cliente
✔ Para buscar cliente por nombre SIEMPRE ILIKE:
    c.nombre_cliente ILIKE '%TEXTO%'
    OR c.nombre_comercial_cliente ILIKE '%TEXTO%'
✔ Para historial_visitas buscar cliente por nombre:
    hv.nombre_cliente ILIKE '%TEXTO%'
    OR hv.nombre_comercial_cliente ILIKE '%TEXTO%'

=====================================================
MANEJO DE FECHAS
=====================================================

✔ Fecha exacta:
    DATE(f.fecha_creacion) = '2026-03-03'

✔ Rango de mes:
    DATE(f.fecha_creacion) BETWEEN '2026-03-01' AND '2026-03-31'

✔ Fecha dinámica:
    "hoy"        → CURRENT_DATE
    "ayer"        → CURRENT_DATE - INTERVAL '1 day'
    "esta semana" → DATE_TRUNC('week', CURRENT_DATE)
    "este mes"    → DATE_TRUNC('month', CURRENT_DATE)

✔ Traducciones de lenguaje natural:
    "3 de marzo 2026"   → '2026-03-03'
    "febrero 2026"      → BETWEEN '2026-02-01' AND '2026-02-29'
    "enero 2026"        → BETWEEN '2026-01-01' AND '2026-01-31'

=====================================================
AGREGACIONES CORRECTAS
=====================================================

✔ Total ventas:      COALESCE(SUM(f.total), 0)
✔ Total unidades:    COALESCE(SUM(d.cantidad), 0)
✔ Conteo facturas:   COUNT(f.id_factura)
✔ Conteo clientes:   COUNT(DISTINCT f.customer_code)
✔ Saldo pendiente:   COALESCE(SUM(f.saldo_pendiente), 0)

=====================================================
BÚSQUEDA DE PRODUCTOS
=====================================================

UPPER(d.descripcion) LIKE '%TEXTO%'

botellón  → '%BOTELL%'
galón     → '%GALON%'
pack      → '%PACK%'
hielo     → '%HIELO%'
servicio  → '%SERVICIO%'
agua      → '%AGUA%'

=====================================================
CONSULTAS FRECUENTES — PATRONES RECOMENDADOS
=====================================================

── Ventas de un cliente en una fecha ──
SELECT f.code, c.nombre_cliente, f.fecha_creacion,
       f.total, f.estado_pago
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE (c.nombre_cliente ILIKE '%TIA%' OR c.nombre_comercial_cliente ILIKE '%TIA%')
  AND DATE(f.fecha_creacion) = '2026-03-03'
ORDER BY f.fecha_creacion DESC

── Detalle de ventas de un cliente ──
SELECT f.code, d.descripcion, d.cantidad, d.precio, d.total
FROM facturas f
LEFT JOIN detalle_documento d ON f.code = d.documento_code
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE (c.nombre_cliente ILIKE '%TIA%' OR c.nombre_comercial_cliente ILIKE '%TIA%')
  AND DATE(f.fecha_creacion) = '2026-03-03'

── Clientes de una ruta ──
SELECT c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente,
       c.estado_cliente, cuv.tipo_atencion
FROM clientes c
LEFT JOIN clientes_usuarios_ventas cuv ON c.codigo_cliente = cuv.codigo_cliente
LEFT JOIN rutas r ON cuv.ruta_code = r.codigo
WHERE r.codigo = 'PV1' AND c.estado_cliente = 1

── Top vendedores ──
SELECT f.seller_code,
       COUNT(f.id_factura) AS total_facturas,
       COALESCE(SUM(f.total), 0) AS monto_total
FROM facturas f
WHERE DATE(f.fecha_creacion) = CURRENT_DATE
GROUP BY f.seller_code
ORDER BY monto_total DESC

── Facturas pendientes de pago ──
SELECT f.code, c.nombre_cliente, f.total,
       f.saldo_pendiente, f.fecha_vencimiento
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE f.estado_pago IN ('not_paid', 'partial')
ORDER BY f.fecha_vencimiento ASC

=====================================================
RANKINGS
=====================================================

Si piden top/ranking/mayor/más vendido:
ORDER BY ... DESC
LIMIT 20

=====================================================
FILTRO VENDEDOR (se aplica automáticamente según rol)
=====================================================

${filtroVendedor || "-- Sin filtro de vendedor (rol ADMIN/SUPERVISOR)"}

=====================================================
${contextoError}
SALIDA — RESPONDER SOLO EN JSON:
=====================================================

{ "sql": "SELECT ..." }
`
        },
        {
          role: "user",
          content: pregunta
        }
      ]
    });

    const response = completion.choices[0].message.content;
    if (!response) throw new Error("Respuesta vacía del modelo.");

    const parsed = JSON.parse(response);
    let query = parsed.sql.trim().replace(/;$/, "").trim();

    console.log("📜 SQL generado:", query);

    // Validaciones de seguridad
    const forbiddenPatterns = [
      /--/g,
      /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i,
      /\bDROP\b/i,   /\bALTER\b/i,  /\bTRUNCATE\b/i
    ];
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(query)) throw new Error("SQL contiene patrón prohibido.");
    }
    if (!query.toUpperCase().startsWith("SELECT")) {
      throw new Error("SQL inválido: no inicia con SELECT.");
    }

    console.log("✅ SQL validado.");
    console.log("====================================");
    return query;

  } catch (error) {
    console.error("❌ ERROR generando SQL:", error.message);
    throw error;
  }
}

module.exports = { generarSQL };