// services/chatbotservicio/generarSQL.js
// Generador profesional de SQL seguro para PostgreSQL
// Grupo Aqua ERP — v4 schema completo y corregido

const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generarSQL(
  pregunta,
  rol,
  sellerCode,
  sqlPrevioFallido = null,
  errorPrevio = null
) {
  console.log("========== 🧠 GENERAR SQL ==========");
  console.log("Pregunta:", pregunta);
  console.log("Rol:", rol, "| SellerCode:", sellerCode);
  if (sqlPrevioFallido) console.log("🔁 Modo corrección activo");

  // Fecha actual en hora Ecuador (America/Guayaquil = UTC-5)
  // toISOString() daría UTC y el día podría estar desfasado al no coincidir con CURRENT_DATE en PG
  const fechaHoy  = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" }); // YYYY-MM-DD
  const ayerDate  = new Date();
  ayerDate.setDate(ayerDate.getDate() - 1);
  const fechaAyer = ayerDate.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

  try {
    const filtroVendedor =
      rol === "VENDEDOR" && sellerCode
        ? `AND f.seller_code = '${sellerCode}'`
        : "";

    const contextoError =
      sqlPrevioFallido && errorPrevio
        ? `
=====================================================
CORRECCION REQUERIDA
=====================================================
El siguiente SQL fue ejecutado y fallo con este error PostgreSQL:

ERROR: ${errorPrevio}

SQL fallido:
${sqlPrevioFallido}

Analiza el error y genera un SQL corregido y valido.
=====================================================
`
        : "";

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
            required: ["sql"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `
Eres un generador experto de SQL para PostgreSQL del ERP Grupo Aqua.
Tu unica tarea es generar consultas SELECT validas, seguras y optimizadas.

=====================================================
FECHA DE REFERENCIA (HOY)
=====================================================

FECHA_HOY    = ${fechaHoy}
FECHA_AYER   = ${fechaAyer}

Cuando el usuario diga "hoy" usa CURRENT_DATE (= ${fechaHoy}).
Cuando diga "ayer" usa CURRENT_DATE - INTERVAL '1 day' (= ${fechaAyer}).
Cuando diga "esta semana" usa DATE_TRUNC('week', CURRENT_DATE).
Cuando diga "este mes" usa DATE_TRUNC('month', CURRENT_DATE).


=====================================================
REGLAS CRITICAS (OBLIGATORIAS)
=====================================================

1) SOLO generar SELECT.
2) PROHIBIDO: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC, EXECUTE.
3) SOLO usar tablas y columnas definidas en este prompt.
4) NO inventar columnas ni tablas.
5) Si la pregunta no es del dominio del sistema: SELECT 1 WHERE FALSE
6) PROHIBIDO incluir comentarios SQL de cualquier tipo.
   NO usar: -- comentario
   NO usar: /* comentario */
   Genera SQL limpio sin ningun comentario inline.

=====================================================
REGLA DE ORO - ALIAS OBLIGATORIOS
=====================================================

NUNCA referenciar un alias en SELECT/WHERE/JOIN
que no este declarado en el FROM o en un JOIN.

Tabla                       -> Alias OBLIGATORIO
facturas                    -> f
ordenes                     -> o
detalle_documento           -> d
clientes                    -> c
rutas                       -> r
detalles_rutas              -> dr
historial_visitas           -> hv
direcciones_clientes        -> dc
clientes_usuarios_ventas    -> cuv
productos                   -> p
sincronizaciones_ventas     -> sv
tipos_negocio               -> tn
app_users                   -> u
tipo_documento_latam        -> tdl
metas_preventas             -> mp
clientes_categoria_relacion -> ccr
vw_clientes_analisis        -> vca

=====================================================
BUSQUEDA POR NOMBRE DE CLIENTE - CRITICO
=====================================================

Cuando el usuario mencione un cliente por nombre
(ej: "TIA", "SUPERMAXI", "CORAL", "AKI", etc.):

SIEMPRE usar busqueda parcial ILIKE (nunca = para nombres):

  LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
  WHERE (
    c.nombre_cliente           ILIKE '%TIA%'
    OR c.nombre_comercial_cliente ILIKE '%TIA%'
  )

NUNCA usar = para nombres de clientes.
El usuario puede escribir el nombre parcialmente o en minusculas.

=====================================================
ESQUEMA COMPLETO DE TABLAS
=====================================================

TABLA: app_users  (alias: u)
id               SERIAL PK
usuario          TEXT UNIQUE
clave            TEXT
rol              TEXT
rutas_asignadas  TEXT[]
creado_en        TIMESTAMP
actualizado_en   TIMESTAMP

TABLA: productos  (alias: p)
codigo_producto           VARCHAR(50) PK
nombre_producto           VARCHAR(255)
nombre_producto_completo  TEXT
nombre_alterno            VARCHAR(150)
descripcion_venta         TEXT
codigo_barras             VARCHAR(100)
codigo_marca              VARCHAR(50)
codigo_categoria          VARCHAR(50)
codigo_subcategoria       VARCHAR(50)
codigo_familia            VARCHAR(50)
codigo_unidad_medida      VARCHAR(50)
unidad_medida             VARCHAR(50)
unidad_medida_compra      VARCHAR(50)
codigo_tipo_inventario    VARCHAR(50)
costo                     NUMERIC(12,2)
ultimo_costo              NUMERIC(12,2)
precio                    DECIMAL(12,2)
peso                      DECIMAL(10,3)
volumen                   DECIMAL(10,3)
estado                    INTEGER
activo                    BOOLEAN
tipo_producto             VARCHAR(50)
origen_sistema            VARCHAR(50)
mobilvendor_id            VARCHAR(100)

TABLA: tipos_negocio  (alias: tn)
id                  SERIAL PK
codigo              VARCHAR(50) UNIQUE
descripcion         VARCHAR(150)
color               VARCHAR(20)
estado              INT
fecha_creacion      TIMESTAMP
fecha_actualizacion TIMESTAMP

TABLA: clientes  (alias: c)
id_cliente                      SERIAL PK
codigo_cliente                  VARCHAR(255) UNIQUE
company_id                      VARCHAR(20)
descripcion_company             VARCHAR(200)
tipo_identificacion_cliente     VARCHAR(50)
identificacion_cliente          VARCHAR(20)
correo_cliente                  VARCHAR(255)
nombre_cliente                  VARCHAR(255)
nombre_comercial_cliente        VARCHAR(255)
codigo_tipo_negocio             VARCHAR(50)
contacto_cliente                VARCHAR(255)
codigo_moneda_cliente           VARCHAR(3)
codigo_lista_precio_cliente     VARCHAR(50)
metodo_pago_cliente             VARCHAR(50)
condicion_pago_cliente          VARCHAR(100)
codigo_grupo_cliente            VARCHAR(100)
descuento_cliente               DECIMAL(10,2)
objetivo_venta_cliente          DECIMAL(10,2)
saldo_cliente                   DECIMAL(10,2)
tiene_credito_cliente           BOOLEAN
tiene_documentos_cliente        BOOLEAN
estado                          VARCHAR(25)
estado_cliente                  INT
estado_proceso_cliente          INT
nacionalidad_cliente            VARCHAR(100)
codigo_usuario_asignado_cliente VARCHAR(50)
email_cliente                   VARCHAR(255)
telefono_cliente                VARCHAR(100)
direccion_cliente               TEXT
ciudad_cliente                  VARCHAR(150)
pais_cliente                    VARCHAR(150)
industria_cliente               VARCHAR(150)
latitud_cliente                 VARCHAR(100)
longitud_cliente                VARCHAR(100)
frecuencia_cliente              VARCHAR(100)
vendedor_asignado_cliente       VARCHAR(100)
comentario_cliente              TEXT
id_odoo                         INTEGER
fecha_envio_odoo                TIMESTAMP
mobilvendor_id_cliente          VARCHAR(100)
fecha_creacion_cliente          TIMESTAMP
fecha_actualizacion_cliente     TIMESTAMP

TABLA: direcciones_clientes  (alias: dc)
id_direccion_cliente                  SERIAL PK
codigo_cliente                        VARCHAR(255)
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
estado_direccion_cliente              INT
estado_ubicacion_direccion_cliente    INT
fecha_creacion_direccion_cliente      TIMESTAMP
fecha_actualizacion_direccion_cliente TIMESTAMP

TABLA: clientes_usuarios_ventas  (alias: cuv)
id_relacion              SERIAL PK
codigo_cliente           VARCHAR(50)
codigo_direccion_cliente VARCHAR(100)
seller_code              VARCHAR(50)
ruta_code                VARCHAR(50)
tipo_atencion            VARCHAR(20)
ultima_atencion          TIMESTAMP

TABLA: ordenes  (alias: o)
id_orden               SERIAL PK
code                   VARCHAR(50) UNIQUE
type                   INT
status                 INT
fecha_creacion         TIMESTAMP
fecha_entrega          TIMESTAMP
fecha_validez          TIMESTAMP
fecha_compromiso       TIMESTAMP
customer_code          VARCHAR(50)
customer_nombre        VARCHAR(255)
customer_address_code  INTEGER
route_code             VARCHAR(50)
seller_code            VARCHAR(50)
seller_nombre          VARCHAR(255)
equipo_ventas          VARCHAR(100)
equipo_ventas_id       INTEGER
equipo_ventas_nombre   VARCHAR(255)
campania_id            INT
descripcion_company    VARCHAR(60)
medio_id               INT
fuente_id              INT
estado_odoo            VARCHAR(50)
estado_facturacion     VARCHAR(50)
estado_entrega         VARCHAR(50)
moneda                 VARCHAR(10)
tasa_cambio            DECIMAL(18,6)
total                  DECIMAL(18,2)
subtotal               DECIMAL(18,2)
iva                    DECIMAL(18,2)
discount               DECIMAL(18,2)
monto_no_pagado        DECIMAL(18,2)
costo_envio            DECIMAL(18,2)
margen                 DECIMAL(12,2)
margen_porcentaje      DECIMAL(6,2)
payment_term_id        INTEGER
payment_term_nombre    VARCHAR(255)
almacen_id             INT
almacen_nombre         VARCHAR(255)
transportista_id       INT
transportista_nombre   VARCHAR(255)
peso_total             DECIMAL(10,3)
politica_entrega       VARCHAR(50)
parent_id              VARCHAR(50)
source_document        VARCHAR(255)
latitude               DECIMAL(12,8)
longitude              DECIMAL(12,8)
concept_code           VARCHAR(50)
concept_origin         VARCHAR(50)
sequence_type          VARCHAR(10)
etiquetas              TEXT
notes                  TEXT
mobilvendor_id         VARCHAR(100)
origen_sistema         VARCHAR(20)

TABLA: facturas  (alias: f)
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
estado_pago           VARCHAR(20)
saldo_pendiente       DECIMAL(18,2)
fecha_vencimiento     TIMESTAMP
tipo_documento        VARCHAR(20)
moneda                VARCHAR(10)
company_id            INT
reversed_entry_id     INT
origen_sistema        VARCHAR(15)

TABLA: detalle_documento  (alias: d)
id_detalle                       SERIAL PK
documento_code                   VARCHAR(50)
codigo_producto                  VARCHAR(100)
producto_codigo_interno          VARCHAR(100)
descripcion                      VARCHAR(300)
producto_nombre                  VARCHAR(255)
producto_categoria               VARCHAR(255)
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
margen_linea                     DECIMAL(12,2)
margen_porcentaje_linea          DECIMAL(6,2)
unit_alias                       VARCHAR(100)
unidad_medida                    VARCHAR(50)
barcode                          VARCHAR(100)
codigo_categoria                 VARCHAR(10)
descripcion_categoria            VARCHAR(100)
estado_facturacion_linea         VARCHAR(50)
estado_odoo_linea                VARCHAR(50)
secuencia                        INTEGER
es_anticipo                      BOOLEAN
es_envio                         BOOLEAN

TABLA: rutas  (alias: r)
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

TABLA: detalles_rutas  (alias: dr)
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

TABLA: sincronizaciones_ventas  (alias: sv)
id_sync          SERIAL PK
fecha_sync       TIMESTAMP
desde_date       DATE
hasta_date       DATE
total_registros  INT
estado           VARCHAR(20)
mensaje          VARCHAR(100)

TABLA: historial_visitas  (alias: hv)
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
estado_proceso                    INT
ruptura_secuencia                 INT
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

TABLA: tipo_documento_latam  (alias: tdl)
id                            SERIAL PK
secuencia                     VARCHAR(255)
id_pais                       INT
usuario_creacion              INT
usuario_actualizacion         INT
nombre                        VARCHAR(255)
prefijo_codigo_documento      VARCHAR(10)
codigo                        VARCHAR(10)
nombre_reporte                VARCHAR(255)
tipo_interno                  VARCHAR(50)
activo                        BOOLEAN
fecha_creacion                TIMESTAMP
fecha_actualizacion           TIMESTAMP
verificar_formato_ecuador     BOOLEAN

TABLA: metas_preventas  (alias: mp)
id_meta      SERIAL PK
codigo_ruta  VARCHAR(50)   -- ruta a la que aplica la meta
anio         INT           -- año (ej: 2026)
mes          INT           -- mes 1-12
meta_unidades INT          -- meta en unidades (botellones, etc.)
meta_dolares  FLOAT        -- meta en dólares
NOTA: UNIQUE (codigo_ruta, anio, mes)

TABLA: clientes_categoria_relacion  (alias: ccr)
categoria_id INTEGER  -- FK a tabla de categorías
cliente_id   INTEGER  -- FK a clientes.id_cliente
NOTA: PK compuesta (categoria_id, cliente_id)

VISTA: vw_clientes_analisis  (alias: vca)
-- Vista precalculada de análisis de clientes. Usar para consultas de métricas de clientes.
codigo_cliente       VARCHAR
nombre_cliente       VARCHAR
identificacion_cliente VARCHAR
nombre_comercial_cliente VARCHAR
direccion            VARCHAR
seller_code          VARCHAR   -- vendedor asignado
tipo_negocio         VARCHAR   -- descripcion del tipo de negocio
tiene_credito_cliente BOOLEAN
tipo_pago            VARCHAR   -- 'CREDITO' o 'CONTADO'
total_facturas       BIGINT    -- cantidad de facturas
total_unidades       NUMERIC   -- unidades compradas
total_ventas         NUMERIC   -- monto total comprado
ultima_compra        TIMESTAMP
primera_compra       TIMESTAMP
ticket_promedio      NUMERIC   -- ventas / facturas
dias_sin_comprar     INT       -- dias desde ultima compra
estado_cliente       VARCHAR   -- 'ACTIVO' (<= 30 dias), 'RIESGO' (<= 60), 'INACTIVO', 'SIN COMPRAS'

=====================================================
JOINS CORRECTOS
=====================================================

facturas -> detalle_documento       : f.code = d.documento_code
facturas -> clientes                : f.customer_code = c.codigo_cliente
ordenes  -> detalle_documento       : o.code = d.documento_code
ordenes  -> clientes                : o.customer_code = c.codigo_cliente
detalle_documento -> productos      : d.codigo_producto = p.codigo_producto
detalles_rutas -> clientes          : dr.codigo_cliente = c.codigo_cliente
                                    o dr.customer_code = c.codigo_cliente
detalles_rutas -> rutas             : dr.codigo_ruta = r.codigo
clientes -> tipos_negocio           : c.codigo_tipo_negocio = tn.codigo
clientes -> direcciones_clientes    : c.codigo_cliente = dc.codigo_cliente
facturas -> direcciones_clientes    : f.customer_address_code = dc.codigo_direccion_cliente
ordenes  -> direcciones_clientes    : o.customer_address_code = dc.id_direccion_cliente
cuv -> clientes                     : cuv.codigo_cliente = c.codigo_cliente
cuv -> rutas                        : cuv.ruta_code = r.codigo
historial_visitas -> clientes       : hv.codigo_cliente = c.codigo_cliente
historial_visitas -> rutas          : hv.codigo_ruta = r.codigo
historial_visitas -> app_users      : hv.codigo_usuario = u.usuario
metas_preventas -> rutas            : mp.codigo_ruta = r.codigo
clientes_categoria_relacion->clientes: ccr.cliente_id = c.id_cliente

=====================================================
REGLAS DE DATOS
=====================================================

type, status, estado, estado_cliente son INTEGER, no texto.
estado_pago en facturas es texto: 'not_paid', 'partial', 'paid'
tipo_atencion en cuv es texto: 'PREVENTA', 'TELEVENTA', 'VIP'
Nunca usar c.nombre -> usar c.nombre_cliente o c.nombre_comercial_cliente
Para buscar cliente por nombre SIEMPRE ILIKE:
    c.nombre_cliente ILIKE '%TEXTO%'
    OR c.nombre_comercial_cliente ILIKE '%TEXTO%'
Para historial_visitas buscar cliente por nombre:
    hv.nombre_cliente ILIKE '%TEXTO%'
    OR hv.nombre_comercial_cliente ILIKE '%TEXTO%'

=====================================================
REGLA CRITICA — FILTROS DE STATUS (facturas/ordenes)
=====================================================

NUNCA agregar filtros de f.status o o.status a menos que el usuario
lo pida EXPLICITAMENTE con palabras como:
  "activas", "sin canceladas", "solo confirmadas", "vigentes"

Si el usuario pide totales, ventas, montos sin ninguna calificacion:
  -> Incluir TODOS los registros sin importar su status.

RAZON: filtrar por status excluye facturas validas y produce totales
incorrectos distintos a los que el usuario ve en su sistema.

EJEMPLOS CORRECTOS:
  "cuanto vendio ROSADO en febrero"  -> SIN filtro de status
  "total de ventas del mes"          -> SIN filtro de status
  "facturas activas de hoy"          -> CON f.status = 1 (o el que corresponda)
  "ordenes confirmadas"              -> CON o.status especifico

=====================================================
MANEJO DE FECHAS
=====================================================

Fecha exacta:
    DATE(f.fecha_creacion) = '2026-03-08'

Rango de mes — PATRON OBLIGATORIO (NO usar BETWEEN con fin de mes manual):
    CORRECTO:   DATE(f.fecha_creacion) >= '2026-03-01' AND DATE(f.fecha_creacion) < '2026-04-01'
    INCORRECTO: BETWEEN '2026-03-01' AND '2026-03-31'   <- puede fallar en meses cortos
    INCORRECTO: BETWEEN '2026-02-01' AND '2026-02-29'   <- 2026 NO es bisiesto, causa error SQL

Fecha dinamica — SIEMPRE usar rango cerrado (>= inicio AND < inicio_siguiente):
    "hoy"          -> DATE(col) = CURRENT_DATE
    "ayer"         -> DATE(col) = CURRENT_DATE - INTERVAL '1 day'
    "esta semana"  -> DATE(col) >= DATE_TRUNC('week', CURRENT_DATE)
                      AND DATE(col) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
    "este mes"     -> DATE(col) >= DATE_TRUNC('month', CURRENT_DATE)
                      AND DATE(col) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    "mes pasado"   -> DATE(col) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND DATE(col) < DATE_TRUNC('month', CURRENT_DATE)

CRITICO — "este mes" DEBE incluir SIEMPRE el limite superior:
    CORRECTO:   DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
                AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    INCORRECTO: DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)   <- sin limite superior, incluye meses futuros

Traducciones de lenguaje natural — usar siempre el patron de rango seguro:
    "3 de marzo 2026"  -> DATE(col) = '2026-03-03'
    "marzo 2026"       -> DATE(col) >= '2026-03-01' AND DATE(col) < '2026-04-01'
    "febrero 2026"     -> DATE(col) >= '2026-02-01' AND DATE(col) < '2026-03-01'
    "enero 2026"       -> DATE(col) >= '2026-01-01' AND DATE(col) < '2026-02-01'
    "diciembre 2025"   -> DATE(col) >= '2025-12-01' AND DATE(col) < '2026-01-01'

Intervalos relativos (usar CURRENT_DATE como base):
    "ultimos 7 dias"   -> DATE(col) >= CURRENT_DATE - INTERVAL '7 days'
    "ultimos 15 dias"  -> DATE(col) >= CURRENT_DATE - INTERVAL '15 days'
    "ultimos 30 dias"  -> DATE(col) >= CURRENT_DATE - INTERVAL '30 days'
    "ultima semana"    -> DATE(col) >= CURRENT_DATE - INTERVAL '7 days'
    "ultimo trimestre" -> DATE(col) >= CURRENT_DATE - INTERVAL '3 months'
    "ultimo año"       -> DATE(col) >= CURRENT_DATE - INTERVAL '1 year'

Rangos personalizados (del X al Y):
    "del 1 al 15 de marzo 2026" -> DATE(col) >= '2026-03-01' AND DATE(col) <= '2026-03-15'

=====================================================
AGREGACIONES CORRECTAS
=====================================================

Total ventas:      COALESCE(SUM(f.total), 0)       <- SIEMPRE f.total, NUNCA f.subtotal
Total unidades:    COALESCE(SUM(d.cantidad), 0)
Conteo facturas:   COUNT(f.id_factura)
Conteo clientes:   COUNT(DISTINCT f.customer_code)
Saldo pendiente:   COALESCE(SUM(f.saldo_pendiente), 0)

CRITICO — CAMPO CORRECTO PARA TOTALES:
- Para "total de ventas", "cuanto vendio", "monto total" -> usar SIEMPRE f.total
- NUNCA usar f.subtotal (es el monto antes de impuestos, no el total real)
- NUNCA usar d.total como total del cliente (es solo el total de una linea de producto)
- f.total = total de la factura completa con IVA = el valor correcto para reportes de ventas

REGLA HAVING: En PostgreSQL NO puedes referenciar un alias del SELECT en el HAVING.
CORRECTO:   HAVING COALESCE(SUM(f.total), 0) > 0
INCORRECTO: HAVING monto_total > 0   <- alias no valido en HAVING

=====================================================
BUSQUEDA DE PRODUCTOS
=====================================================

UPPER(d.descripcion) LIKE '%TEXTO%'

botelon  -> '%BOTELL%'
galon    -> '%GALON%'
pack     -> '%PACK%'
hielo    -> '%HIELO%'
servicio -> '%SERVICIO%'
agua     -> '%AGUA%'

=====================================================
TERMINOS DEL NEGOCIO — DESCARTABLE Y PREVENTA (CRITICO)
=====================================================

"DESCARTABLE" / "envase descartable" / "botella descartable" / "no retornable"
NO es un nombre de producto. Es una CATEGORIA de productos.
Se identifica SIEMPRE por:  dd.codigo_categoria = '7'
PROHIBIDO buscar d.descripcion ILIKE '%DESCARTABLE%' -> ese texto no existe y da 0.

"PREVENTA" (ventas de los prevendedores PV1..PV14, PVM, TELEVENTA, etc.)
se calcula sobre la tabla ordenes (o), NUNCA sobre facturas:
  o.type = 2
  AND o.status = 5
  AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
       OR o.seller_code ILIKE 'TELEVENTA%')
  AND o.seller_code NOT ILIKE 'PVR%'
Para el rango de fechas de preventa usar o.fecha_entrega (NO fecha_creacion).
IMPORTANTE: usar SIEMPRE o.status = 5 (orden entregada/cerrada). Es el unico
status que cuadra con las cards del dashboard. NUNCA usar status IN (2,4,5).

REGLA DE PERIODO POR DEFECTO (CRITICO): Los datos de ordenes se sincronizan con
retraso; el mes calendario actual puede estar VACIO. Por eso, cuando el usuario
NO indica un mes/periodo, NO usar CURRENT_DATE: usar el ULTIMO MES CON DATOS,
anclado al MAX(o.fecha_entrega) existente. Solo usar un mes fijo si el usuario lo
pide explicitamente (ej: "en abril", "mayo 2026").

REGLA DE PERIODO EN EL RESULTADO (CRITICO): Toda consulta de preventa DEBE
devolver SIEMPRE columnas que identifiquen el periodo cubierto, para que la
respuesta nombre el mes correcto y NO lo invente:
  TO_CHAR(MIN(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_desde,
  TO_CHAR(MAX(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_hasta
NUNCA omitir estas dos columnas en consultas de preventa (total, descartable o ranking).

PATRON CANONICO OBLIGATORIO — "cuanto es la preventa de descartable" (sin mes -> ultimo mes con datos):
SELECT COALESCE(SUM(dd.total), 0)    AS dolares,
       COALESCE(SUM(dd.cantidad), 0) AS unidades,
       TO_CHAR(MIN(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_desde,
       TO_CHAR(MAX(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_hasta
FROM ordenes o
JOIN detalle_documento dd ON dd.documento_code = o.code
WHERE o.type = 2
  AND o.status = 5
  AND dd.codigo_categoria = '7'
  AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
       OR o.seller_code ILIKE 'TELEVENTA%')
  AND o.seller_code NOT ILIKE 'PVR%'
  AND o.fecha_entrega >= (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega))
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)
  AND o.fecha_entrega <  (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega)) + INTERVAL '1 month'
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)

PATRON CANONICO — "cuanto es la preventa" / "preventa total" (TODAS las categorias,
NO incluir el filtro dd.codigo_categoria; mismo rango "ultimo mes con datos"):
SELECT COALESCE(SUM(dd.total), 0)    AS dolares,
       COALESCE(SUM(dd.cantidad), 0) AS unidades,
       TO_CHAR(MIN(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_desde,
       TO_CHAR(MAX(o.fecha_entrega), 'YYYY-MM-DD') AS periodo_hasta
FROM ordenes o
JOIN detalle_documento dd ON dd.documento_code = o.code
WHERE o.type = 2
  AND o.status = 5
  AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
       OR o.seller_code ILIKE 'TELEVENTA%')
  AND o.seller_code NOT ILIKE 'PVR%'
  AND o.fecha_entrega >= (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega))
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)
  AND o.fecha_entrega <  (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega)) + INTERVAL '1 month'
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)

PATRON CANONICO — "ranking de preventa [de descartable] por prevendedor":
SELECT o.seller_code               AS prevendedor,
       COALESCE(SUM(dd.total), 0)    AS dolares,
       COALESCE(SUM(dd.cantidad), 0) AS unidades
FROM ordenes o
JOIN detalle_documento dd ON dd.documento_code = o.code
WHERE o.type = 2
  AND o.status = 5
  AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
       OR o.seller_code ILIKE 'TELEVENTA%')
  AND o.seller_code NOT ILIKE 'PVR%'
  AND o.fecha_entrega >= (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega))
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)
  AND o.fecha_entrega <  (
        SELECT DATE_TRUNC('month', MAX(o2.fecha_entrega)) + INTERVAL '1 month'
        FROM ordenes o2 WHERE o2.type = 2 AND o2.status = 5)
GROUP BY o.seller_code
ORDER BY dolares DESC
NOTA: para el ranking SOLO de descartable, agregar  AND dd.codigo_categoria = '7'.

NOTA GENERAL: Si el usuario SI pide un mes especifico (ej. "en abril",
"preventa de mayo 2026"), reemplazar las dos subconsultas de fecha por el rango
fijo de ese mes (ej. >= '2026-04-01' AND < '2026-05-01') en TODOS los patrones.

=====================================================
CONSULTAS FRECUENTES - PATRONES RECOMENDADOS
=====================================================

Ventas de un cliente en una fecha exacta:
SELECT f.code, c.nombre_cliente, f.fecha_creacion,
       f.total, f.estado_pago
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE (c.nombre_cliente ILIKE '%TIA%' OR c.nombre_comercial_cliente ILIKE '%TIA%')
  AND DATE(f.fecha_creacion) = CURRENT_DATE
ORDER BY f.fecha_creacion DESC

Total de ventas de un cliente en el mes actual — PATRON CANONICO (NO modificar):
SELECT COALESCE(SUM(f.total), 0) AS total_ventas
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE (c.nombre_cliente ILIKE '%ROSADO%' OR c.nombre_comercial_cliente ILIKE '%ROSADO%')
  AND DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'

Total de ventas de un cliente en un mes especifico (ej: febrero 2026) — PATRON CANONICO:
SELECT COALESCE(SUM(f.total), 0) AS total_ventas
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE (c.nombre_cliente ILIKE '%ROSADO%' OR c.nombre_comercial_cliente ILIKE '%ROSADO%')
  AND DATE(f.fecha_creacion) >= '2026-02-01'
  AND DATE(f.fecha_creacion) < '2026-03-01'

REGLA — Usar siempre JOIN (no LEFT JOIN) cuando hay WHERE sobre columnas de clientes.
Esto evita que records sin cliente coincidan y den resultados incorrectos.
SIEMPRE usar f.total (no f.subtotal) para calcular el total de ventas en dolares.

Detalle de ventas de un cliente en un mes (con agrupacion por producto — PATRON OBLIGATORIO):
SELECT
  COALESCE(p.nombre_producto, d.descripcion) AS producto,
  SUM(d.cantidad)                             AS total_unidades,
  COALESCE(SUM(d.total), 0)                   AS monto_total
FROM facturas f
JOIN  detalle_documento d ON f.code = d.documento_code
LEFT JOIN clientes  c ON f.customer_code    = c.codigo_cliente
LEFT JOIN productos p ON d.codigo_producto  = p.codigo_producto
WHERE (c.nombre_cliente ILIKE '%TIA%' OR c.nombre_comercial_cliente ILIKE '%TIA%')
  AND DATE(f.fecha_creacion) >= '2026-03-01'
  AND DATE(f.fecha_creacion) < '2026-04-01'
GROUP BY COALESCE(p.nombre_producto, d.descripcion)
ORDER BY monto_total DESC

REGLA CRITICA — CONSULTAS DE PRODUCTOS COMPRADOS POR UN CLIENTE:
Cuando el usuario pregunte "que productos compro", "que compro", "detalle de productos", etc.:
  -> SIEMPRE agrupa con GROUP BY producto para evitar filas duplicadas por factura.
  -> Usa SUM(d.cantidad) y SUM(d.total) para consolidar por producto.
  -> NUNCA uses SELECT sin GROUP BY en consultas de detalle de productos — genera miles de filas.
  -> El monto de d.total (linea de producto) NO es igual a f.total (total de factura con impuestos).
     NO presentes SUM(d.total) como el total del cliente en dolares.

REGLA CRITICA — CONSULTAS DE TOTAL EN DOLARES (cuanto compro / cuanto vendio):
Cuando el usuario pregunte "cuanto compro", "cuanto vendio", "total en dolares", "monto total",
"total de ventas", "ventas de [CLIENTE]", "compras de [CLIENTE]", "cuanto gasto", "cuanto pago":
  -> SOLO usar: SELECT COALESCE(SUM(f.total), 0) FROM facturas f JOIN clientes c ...
  -> NUNCA incluir JOIN con detalle_documento en consultas de total monetario
  -> NUNCA usar SUM(d.total) — es el total de UNA LINEA de producto, no el total de la factura
  -> NUNCA usar SUM(d.subtotal) ni SUM(d.precio) para totales de cliente
  -> SUM(d.total) sumado de todas las lineas NO es igual a SUM(f.total) por impuestos y ajustes

PATRON CANONICO OBLIGATORIO para "cuanto compro/vendio [CLIENTE] en [PERIODO]":
SELECT COALESCE(SUM(f.total), 0) AS total_ventas
FROM facturas f
JOIN clientes c ON c.codigo_cliente = f.customer_code
WHERE (c.nombre_cliente ILIKE '%NOMBRE%' OR c.nombre_comercial_cliente ILIKE '%NOMBRE%')
  AND DATE(f.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(f.fecha_creacion) < 'FECHA_FIN'

DISTINCION OBLIGATORIA entre tres tipos de consulta:
1. "cuanto compro / total en dolares"  -> solo facturas + clientes, usar f.total (sin detalle)
2. "que productos compro / detalle"    -> facturas + detalle_documento + clientes + productos, usar d.total agrupado por producto
3. "reporte de ventas con producto / usuario / ruta" -> facturas + detalle_documento + clientes, SIN GROUP BY (una fila por linea de producto)

PATRON CANONICO OBLIGATORIO para "reporte de ventas de [CLIENTE] en [FECHA] con producto, usuario y ruta":
SELECT
  f.code                                             AS factura,
  DATE(f.fecha_creacion)                             AS fecha,
  c.nombre_cliente,
  COALESCE(dd.producto_nombre, dd.descripcion)       AS producto,
  dd.cantidad,
  dd.precio,
  COALESCE(dd.total, 0)                              AS total_linea,
  f.seller_code                                      AS usuario,
  f.route_code                                       AS ruta,
  f.total                                            AS total_factura
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
JOIN detalle_documento dd ON dd.documento_code = f.code
WHERE (c.nombre_cliente ILIKE '%NOMBRE%' OR c.nombre_comercial_cliente ILIKE '%NOMBRE%')
  AND DATE(f.fecha_creacion) = 'FECHA'
ORDER BY f.code, producto

REGLA CRITICA — REPORTE DETALLADO (tipo 3):
Cuando el usuario pida "reporte de ventas de [CLIENTE]" mencionando producto, usuario o ruta:
  -> NUNCA usar GROUP BY — se necesita una fila por producto por factura
  -> NUNCA usar SUM(f.total) — usar f.total (total de la factura, se repite por cada linea)
  -> Usar COALESCE(dd.producto_nombre, dd.descripcion) para el nombre del producto
  -> Usar f.seller_code como usuario y f.route_code como ruta
  -> NUNCA agregar filtro de f.status a menos que el usuario lo pida
  -> SIEMPRE incluir f.total AS total_factura — es obligatorio en este patron
  -> SIEMPRE incluir COALESCE(dd.total, 0) AS total_linea — es obligatorio en este patron
  -> NUNCA omitir total_factura ni total_linea del SELECT

Clientes de una ruta:
SELECT c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente,
       c.estado_cliente, cuv.tipo_atencion
FROM clientes c
LEFT JOIN clientes_usuarios_ventas cuv ON c.codigo_cliente = cuv.codigo_cliente
LEFT JOIN rutas r ON cuv.ruta_code = r.codigo
WHERE r.codigo = 'PV1' AND c.estado_cliente = 1

Ultima factura:
SELECT f.code, c.nombre_cliente, f.fecha_creacion,
       f.total, f.estado_pago, f.seller_code
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
ORDER BY f.fecha_creacion DESC
LIMIT 1

Ultimas N facturas:
SELECT f.code, c.nombre_cliente, f.fecha_creacion,
       f.total, f.estado_pago
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
ORDER BY f.fecha_creacion DESC
LIMIT 10

Top vendedores:
SELECT f.seller_code,
       COUNT(f.id_factura) AS total_facturas,
       COALESCE(SUM(f.total), 0) AS monto_total
FROM facturas f
WHERE DATE(f.fecha_creacion) = CURRENT_DATE
GROUP BY f.seller_code
ORDER BY monto_total DESC

Facturas pendientes de pago:
SELECT f.code, c.nombre_cliente, f.total,
       f.saldo_pendiente, f.fecha_vencimiento
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE f.estado_pago IN ('not_paid', 'partial')
ORDER BY f.fecha_vencimiento ASC

TODAS las facturas de un dia (sin LIMIT):
SELECT f.code, c.nombre_cliente, f.fecha_creacion,
       f.total, f.estado_pago, f.seller_code, f.route_code
FROM facturas f
LEFT JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE DATE(f.fecha_creacion) = CURRENT_DATE
ORDER BY f.fecha_creacion ASC

Visitas del dia:
SELECT hv.fecha_visita, hv.nombre_usuario, hv.nombre_cliente,
       hv.nombre_comercial_cliente, hv.accion, hv.comentario, hv.monto
FROM historial_visitas hv
WHERE DATE(hv.fecha_visita) = CURRENT_DATE
ORDER BY hv.fecha_visita ASC

Meta vs real de una ruta en un mes:
SELECT mp.codigo_ruta, mp.meta_unidades, mp.meta_dolares,
       COALESCE(SUM(dd.cantidad), 0) AS unidades_reales,
       COALESCE(SUM(f.total), 0)     AS dolares_reales
FROM metas_preventas mp
LEFT JOIN facturas f ON f.route_code = mp.codigo_ruta
  AND DATE(f.fecha_creacion) >= '2026-02-01'
  AND DATE(f.fecha_creacion) < '2026-03-01'
LEFT JOIN detalle_documento dd ON dd.documento_code = f.code
WHERE mp.anio = 2026 AND mp.mes = 2
GROUP BY mp.codigo_ruta, mp.meta_unidades, mp.meta_dolares

Analisis de clientes inactivos (usar la vista):
SELECT vca.codigo_cliente, vca.nombre_cliente, vca.seller_code,
       vca.total_ventas, vca.dias_sin_comprar, vca.estado_cliente
FROM vw_clientes_analisis vca
WHERE vca.estado_cliente = 'INACTIVO'
ORDER BY vca.dias_sin_comprar DESC

Ticket promedio por tipo de negocio (usar la vista):
SELECT vca.tipo_negocio,
       COUNT(*) AS total_clientes,
       AVG(vca.ticket_promedio) AS ticket_promedio,
       SUM(vca.total_ventas)    AS ventas_totales
FROM vw_clientes_analisis vca
GROUP BY vca.tipo_negocio
ORDER BY ventas_totales DESC

-----------------------------------------------------
RANKING DE CLIENTES por ventas en un periodo:
-----------------------------------------------------
SELECT c.nombre_cliente,
       c.nombre_comercial_cliente,
       COUNT(DISTINCT f.code)     AS total_facturas,
       COALESCE(SUM(f.total), 0)  AS total_ventas
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE DATE(f.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(f.fecha_creacion) < 'FECHA_FIN'
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente
ORDER BY total_ventas DESC
LIMIT 20

-----------------------------------------------------
VENTAS RESUMIDAS POR RUTA en un periodo:
-----------------------------------------------------
SELECT f.route_code                  AS ruta,
       COUNT(DISTINCT f.code)        AS total_facturas,
       COUNT(DISTINCT f.customer_code) AS total_clientes,
       COALESCE(SUM(f.total), 0)     AS total_ventas,
       COALESCE(SUM(dd.cantidad), 0) AS total_unidades
FROM facturas f
LEFT JOIN detalle_documento dd ON dd.documento_code = f.code
WHERE DATE(f.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(f.fecha_creacion) < 'FECHA_FIN'
GROUP BY f.route_code
ORDER BY total_ventas DESC

-----------------------------------------------------
COMPARATIVO VENDEDOR: mes actual vs mes anterior:
-----------------------------------------------------
SELECT
  f.seller_code                                                     AS vendedor,
  COALESCE(SUM(CASE WHEN DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
                     AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                     THEN f.total END), 0)                          AS mes_actual,
  COALESCE(SUM(CASE WHEN DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                     AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE)
                     THEN f.total END), 0)                          AS mes_anterior
FROM facturas f
GROUP BY f.seller_code
ORDER BY mes_actual DESC

-----------------------------------------------------
CUMPLIMIENTO DE METAS — todas las rutas en un mes:
-----------------------------------------------------
SELECT
  mp.codigo_ruta,
  mp.meta_unidades,
  mp.meta_dolares,
  COALESCE(SUM(dd.cantidad), 0)                                     AS unidades_reales,
  COALESCE(SUM(f.total), 0)                                         AS dolares_reales,
  ROUND(COALESCE(SUM(dd.cantidad), 0) * 100.0 / NULLIF(mp.meta_unidades, 0), 2) AS pct_unidades,
  ROUND(COALESCE(SUM(f.total), 0)     * 100.0 / NULLIF(mp.meta_dolares,  0), 2) AS pct_dolares
FROM metas_preventas mp
LEFT JOIN facturas f ON f.route_code = mp.codigo_ruta
  AND DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
LEFT JOIN detalle_documento dd ON dd.documento_code = f.code
WHERE mp.anio = EXTRACT(YEAR FROM CURRENT_DATE)
  AND mp.mes  = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY mp.codigo_ruta, mp.meta_unidades, mp.meta_dolares
ORDER BY pct_dolares DESC

NOTA: Cuando el usuario pida "cumplimiento", "avance de meta", "% de meta" para un mes especifico,
sustituir DATE_TRUNC('month', CURRENT_DATE) por las fechas reales del mes pedido
y ajustar mp.anio / mp.mes a los valores correspondientes.

-----------------------------------------------------
CARTERA VENCIDA — clientes con facturas impagas vencidas:
-----------------------------------------------------
SELECT c.nombre_cliente,
       c.nombre_comercial_cliente,
       f.seller_code,
       COUNT(f.code)                    AS facturas_vencidas,
       COALESCE(SUM(f.saldo_pendiente), 0) AS deuda_total,
       MIN(f.fecha_vencimiento)         AS vencimiento_mas_antiguo
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE f.estado_pago IN ('not_paid', 'partial')
  AND f.fecha_vencimiento < CURRENT_DATE
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente, f.seller_code
ORDER BY deuda_total DESC

-----------------------------------------------------
CLIENTES CON CREDITO Y SALDO PENDIENTE (cartera activa):
-----------------------------------------------------
SELECT c.nombre_cliente,
       c.nombre_comercial_cliente,
       c.tiene_credito_cliente,
       COALESCE(SUM(f.saldo_pendiente), 0) AS saldo_total,
       COUNT(f.code)                        AS facturas_pendientes
FROM clientes c
JOIN facturas f ON f.customer_code = c.codigo_cliente
WHERE f.estado_pago IN ('not_paid', 'partial')
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente, c.tiene_credito_cliente
ORDER BY saldo_total DESC

-----------------------------------------------------
CLIENTES SIN COMPRAR en los ultimos N dias:
-----------------------------------------------------
SELECT vca.codigo_cliente,
       vca.nombre_cliente,
       vca.nombre_comercial_cliente,
       vca.seller_code,
       vca.total_ventas,
       vca.dias_sin_comprar,
       vca.ultima_compra
FROM vw_clientes_analisis vca
WHERE vca.dias_sin_comprar > 30
ORDER BY vca.dias_sin_comprar DESC

NOTA: Cambiar el numero 30 segun lo que pida el usuario (ej: 15, 60, 90 dias).
Si el usuario pide "clientes en riesgo" usar dias_sin_comprar BETWEEN 31 AND 60.
Si el usuario pide "clientes inactivos" usar dias_sin_comprar > 60.

-----------------------------------------------------
NUEVOS CLIENTES — primera compra en un periodo:
-----------------------------------------------------
SELECT c.nombre_cliente,
       c.nombre_comercial_cliente,
       f.seller_code,
       f.route_code,
       MIN(f.fecha_creacion) AS primera_compra,
       COALESCE(SUM(f.total), 0) AS total_comprado
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente,
         f.seller_code, f.route_code
HAVING MIN(f.fecha_creacion) >= 'FECHA_INICIO'
   AND MIN(f.fecha_creacion) <  'FECHA_FIN'
ORDER BY primera_compra ASC

-----------------------------------------------------
EFECTIVIDAD DE VISITAS por vendedor (visitas con venta vs sin venta):
-----------------------------------------------------
SELECT
  hv.codigo_usuario                                                     AS vendedor,
  COUNT(*)                                                              AS total_visitas,
  COUNT(DISTINCT hv.codigo_cliente)                                     AS clientes_visitados,
  COUNT(CASE WHEN hv.monto > 0 THEN 1 END)                             AS visitas_con_venta,
  COUNT(CASE WHEN hv.monto = 0 OR hv.monto IS NULL THEN 1 END)         AS visitas_sin_venta,
  ROUND(COUNT(CASE WHEN hv.monto > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS pct_efectividad,
  COALESCE(SUM(hv.monto), 0)                                           AS monto_total
FROM historial_visitas hv
WHERE DATE(hv.fecha_visita) >= 'FECHA_INICIO'
  AND DATE(hv.fecha_visita) <  'FECHA_FIN'
GROUP BY hv.codigo_usuario
ORDER BY pct_efectividad DESC

NOTA: Para "efectividad de hoy" usar DATE(hv.fecha_visita) = CURRENT_DATE.

-----------------------------------------------------
COBERTURA DE RUTA — cuantos clientes de la ruta fueron visitados:
-----------------------------------------------------
SELECT
  r.codigo                                                     AS ruta,
  COUNT(DISTINCT dr.codigo_cliente)                            AS clientes_en_ruta,
  COUNT(DISTINCT hv.codigo_cliente)                            AS clientes_visitados,
  ROUND(COUNT(DISTINCT hv.codigo_cliente) * 100.0 /
        NULLIF(COUNT(DISTINCT dr.codigo_cliente), 0), 2)       AS pct_cobertura
FROM rutas r
LEFT JOIN detalles_rutas dr ON dr.codigo_ruta = r.codigo
LEFT JOIN historial_visitas hv
       ON hv.codigo_cliente = dr.codigo_cliente
      AND hv.codigo_ruta    = r.codigo
      AND DATE(hv.fecha_visita) = CURRENT_DATE
GROUP BY r.codigo
ORDER BY pct_cobertura DESC

-----------------------------------------------------
VENDEDORES SIN VENTAS HOY (o en una fecha):
-----------------------------------------------------
SELECT u.usuario,
       u.rol
FROM app_users u
WHERE u.rol = 'VENDEDOR'
  AND u.usuario NOT IN (
    SELECT DISTINCT f.seller_code
    FROM facturas f
    WHERE DATE(f.fecha_creacion) = CURRENT_DATE
      AND f.seller_code IS NOT NULL
  )

-----------------------------------------------------
KPI DEL DIA — resumen ejecutivo (ventas + visitas + facturas):
-----------------------------------------------------
SELECT
  (SELECT COALESCE(SUM(f.total), 0)
   FROM facturas f WHERE DATE(f.fecha_creacion) = CURRENT_DATE)           AS ventas_dia,

  (SELECT COUNT(DISTINCT f.code)
   FROM facturas f WHERE DATE(f.fecha_creacion) = CURRENT_DATE)           AS facturas_dia,

  (SELECT COUNT(DISTINCT f.customer_code)
   FROM facturas f WHERE DATE(f.fecha_creacion) = CURRENT_DATE)           AS clientes_facturados,

  (SELECT COUNT(*)
   FROM historial_visitas hv WHERE DATE(hv.fecha_visita) = CURRENT_DATE)  AS visitas_dia,

  (SELECT COUNT(DISTINCT hv.codigo_cliente)
   FROM historial_visitas hv WHERE DATE(hv.fecha_visita) = CURRENT_DATE)  AS clientes_visitados

NOTA: Para KPI de otra fecha reemplazar CURRENT_DATE por la fecha exacta.

-----------------------------------------------------
VENTAS POR CATEGORIA DE PRODUCTO en un periodo:
-----------------------------------------------------
SELECT
  COALESCE(d.descripcion_categoria, 'SIN CATEGORIA') AS categoria,
  d.codigo_categoria,
  COALESCE(SUM(d.cantidad), 0)                        AS total_unidades,
  COALESCE(SUM(d.total), 0)                           AS monto_total,
  COUNT(DISTINCT d.documento_code)                    AS total_documentos
FROM detalle_documento d
JOIN facturas f ON d.documento_code = f.code
WHERE DATE(f.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(f.fecha_creacion) < 'FECHA_FIN'
GROUP BY d.descripcion_categoria, d.codigo_categoria
ORDER BY monto_total DESC

-----------------------------------------------------
MARGEN POR VENDEDOR en un periodo:
-----------------------------------------------------
SELECT f.seller_code                          AS vendedor,
       COALESCE(SUM(f.total), 0)              AS ventas_totales,
       COALESCE(SUM(f.margen), 0)             AS margen_total,
       ROUND(COALESCE(AVG(f.margen_porcentaje), 0), 2) AS margen_promedio_pct
FROM facturas f
WHERE DATE(f.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(f.fecha_creacion) < 'FECHA_FIN'
GROUP BY f.seller_code
ORDER BY ventas_totales DESC

NOTA: La tabla facturas no tiene columna margen. Para margen usar ordenes:
SELECT o.seller_code,
       COALESCE(SUM(o.total), 0)              AS ventas_totales,
       COALESCE(SUM(o.margen), 0)             AS margen_total,
       ROUND(COALESCE(AVG(o.margen_porcentaje), 0), 2) AS margen_promedio_pct
FROM ordenes o
WHERE DATE(o.fecha_creacion) >= 'FECHA_INICIO'
  AND DATE(o.fecha_creacion) < 'FECHA_FIN'
GROUP BY o.seller_code
ORDER BY ventas_totales DESC

-----------------------------------------------------
VENTAS DIARIAS DE UNA RUTA en el mes (evolucion dia a dia):
-----------------------------------------------------
SELECT DATE(f.fecha_creacion)              AS dia,
       COUNT(DISTINCT f.code)              AS facturas,
       COUNT(DISTINCT f.customer_code)     AS clientes,
       COALESCE(SUM(f.total), 0)           AS ventas,
       COALESCE(SUM(dd.cantidad), 0)       AS unidades
FROM facturas f
LEFT JOIN detalle_documento dd ON dd.documento_code = f.code
WHERE f.route_code = 'CODIGO_RUTA'
  AND DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY DATE(f.fecha_creacion)
ORDER BY dia ASC

-----------------------------------------------------
CLIENTES QUE COMPRARON EN EL MES PERO NO ESTA SEMANA:
-----------------------------------------------------
SELECT DISTINCT c.nombre_cliente,
       c.nombre_comercial_cliente,
       f.seller_code,
       f.route_code,
       MAX(f.fecha_creacion) AS ultima_compra
FROM facturas f
JOIN clientes c ON f.customer_code = c.codigo_cliente
WHERE DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  AND f.customer_code NOT IN (
    SELECT DISTINCT f2.customer_code
    FROM facturas f2
    WHERE DATE(f2.fecha_creacion) >= DATE_TRUNC('week', CURRENT_DATE)
      AND DATE(f2.fecha_creacion) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
  )
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente,
         f.seller_code, f.route_code
ORDER BY ultima_compra ASC

-----------------------------------------------------
RESUMEN DE SINCRONIZACIONES — estado de la ultima carga:
-----------------------------------------------------
SELECT sv.fecha_sync, sv.desde_date, sv.hasta_date,
       sv.total_registros, sv.estado, sv.mensaje
FROM sincronizaciones_ventas sv
ORDER BY sv.fecha_sync DESC
LIMIT 10

-----------------------------------------------------
CLIENTES SIN VISITAR en los ultimos N dias (estan en ruta pero no han sido visitados):
-----------------------------------------------------
SELECT c.nombre_cliente,
       c.nombre_comercial_cliente,
       dr.codigo_ruta                            AS ruta,
       MAX(hv.fecha_visita)                      AS ultima_visita,
       CURRENT_DATE - DATE(MAX(hv.fecha_visita)) AS dias_sin_visita
FROM detalles_rutas dr
JOIN clientes c ON c.codigo_cliente = dr.codigo_cliente
LEFT JOIN historial_visitas hv ON hv.codigo_cliente = dr.codigo_cliente
GROUP BY c.codigo_cliente, c.nombre_cliente, c.nombre_comercial_cliente, dr.codigo_ruta
HAVING MAX(hv.fecha_visita) IS NULL
    OR CURRENT_DATE - DATE(MAX(hv.fecha_visita)) > 7
ORDER BY dias_sin_visita DESC NULLS FIRST

NOTA: Cambiar el valor 7 segun lo que pida el usuario.

-----------------------------------------------------
COMPARATIVO TOP RUTAS — mes actual vs anterior:
-----------------------------------------------------
SELECT
  f.route_code AS ruta,
  COALESCE(SUM(CASE WHEN DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE)
                     AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                     THEN f.total END), 0)        AS mes_actual,
  COALESCE(SUM(CASE WHEN DATE(f.fecha_creacion) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                     AND DATE(f.fecha_creacion) < DATE_TRUNC('month', CURRENT_DATE)
                     THEN f.total END), 0)        AS mes_anterior
FROM facturas f
GROUP BY f.route_code
ORDER BY mes_actual DESC

=====================================================
RANKINGS Y LIMITES - CRITICO
=====================================================

Si piden top / ranking / mayor / mas vendido / los X mejores:
  -> Agregar: ORDER BY ... DESC  LIMIT <N solicitado, default 20>

Si piden LISTADO COMPLETO (todas las facturas, todos los clientes,
  reporte de un dia, reporte de un mes, etc.):
  -> NO agregar LIMIT. El sistema aplica su propio limite de seguridad.

Si el usuario especifica un numero ("dame las 50 ultimas facturas"):
  -> Usar ese numero exacto: LIMIT 50

Ejemplos de cuando NO poner LIMIT:
  "todas las facturas del 6 de marzo"  -> sin LIMIT
  "listado de clientes activos"         -> sin LIMIT
  "reporte de ventas del mes"           -> sin LIMIT
  "todas las visitas de hoy"            -> sin LIMIT

=====================================================
RANKING DE PRODUCTOS - PATRON OBLIGATORIO
=====================================================

Cuando el usuario pregunte por "producto mas vendido", "top productos",
"que producto se vende mas", etc.:

SIEMPRE agrupa por d.codigo_producto (NO por d.descripcion).
Haz JOIN con la tabla productos para obtener el nombre legible.

PATRON para ranking de productos:
SELECT
  p.nombre_producto,
  p.codigo_producto,
  COALESCE(SUM(d.cantidad), 0) AS total_vendido,
  COALESCE(SUM(d.total), 0)    AS monto_total
FROM detalle_documento d
JOIN facturas f ON d.documento_code = f.code
LEFT JOIN productos p ON d.codigo_producto = p.codigo_producto
GROUP BY p.codigo_producto, p.nombre_producto
ORDER BY total_vendido DESC
LIMIT 20

Si el usuario acota a un periodo, agrega el filtro de fecha correspondiente.

=====================================================
FILTRO VENDEDOR — OBLIGATORIO PARA ROL VENDEDOR
=====================================================

${filtroVendedor
  ? `ROL ACTIVO: VENDEDOR (seller_code = '${sellerCode}')

APLICA ESTOS FILTROS SEGUN LA TABLA PRINCIPAL DE LA CONSULTA:
- Si usas facturas (f):                   AND f.seller_code = '${sellerCode}'
- Si usas ordenes (o):                    AND o.seller_code = '${sellerCode}'
- Si usas historial_visitas (hv):         AND hv.codigo_usuario = '${sellerCode}'
- Si usas clientes_usuarios_ventas (cuv): AND cuv.seller_code = '${sellerCode}'

NUNCA omitir este filtro cuando el rol es VENDEDOR.`
  : "ROL ACTIVO: ADMIN — Sin restriccion de vendedor. Ver todos los datos."}

=====================================================
${contextoError}
SALIDA - RESPONDER SOLO EN JSON:
=====================================================

{ "sql": "SELECT ..." }
`,
        },
        {
          role: "user",
          content: pregunta,
        },
      ],
    });

    const response = completion.choices[0].message.content;
    if (!response) throw new Error("Respuesta vacía del modelo.");

    const parsed = JSON.parse(response);
    let query = parsed.sql.trim().replace(/;$/, "").trim();

    console.log("📜 SQL generado:", query);

    // ── Limpiar comentarios SQL antes de validar ──────────────────────────
    // Aunque el prompt los prohíbe, el LLM puede incluirlos igualmente.
    // Los eliminamos en lugar de rechazar el query completo.
    query = query
      .replace(/\/\*[\s\S]*?\*\//g, " ")  // /* comentarios de bloque */
      .replace(/--[^\n]*/g, " ")           // -- comentarios de línea
      .replace(/\s+/g, " ")               // normalizar espacios extra
      .trim();

    // ── Validaciones de seguridad ─────────────────────────────────────────
    const forbiddenPatterns = [
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\bDROP\b/i,
      /\bALTER\b/i,
      /\bTRUNCATE\b/i,
      /\bEXEC\b/i,
      /\bEXECUTE\b/i,
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