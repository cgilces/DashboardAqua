const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generador profesional de SQL seguro para PostgreSQL
 * Grupo Aqua ERP
 */
async function generarSQL(pregunta, rol, sellerCode) {
   console.log("========== 🧠 GENERAR SQL ==========");
   console.log("Pregunta:", pregunta);
   console.log("Rol:", rol);
   console.log("SellerCode:", sellerCode);

   try {

      // 🔹 Filtro dinámico para vendedor (solo si aplica)
      const filtroVendedor = rol === "VENDEDOR" && sellerCode
         ? `AND f.seller_code = '${sellerCode}'`
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
                  properties: {
                     sql: { type: "string" }
                  },
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
2) PROHIBIDO usar INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE.
3) SOLO usar tablas definidas abajo.
4) NO inventar columnas.
5) NO inventar tablas.
6) NO acortar nombres de columnas.
7) Si la pregunta no está relacionada al esquema:
   devolver EXACTAMENTE:
   SELECT 1 WHERE FALSE

=====================================================
TABLAS Y COLUMNAS EXACTAS DEL SISTEMA
=====================================================

-----------------------------------------------------
TABLA: app_users
-----------------------------------------------------
id
usuario
clave
rol
rutas_asignadas
creado_en
actualizado_en

-----------------------------------------------------
TABLA: productos
-----------------------------------------------------
codigo_producto
nombre_producto
nombre_alterno
codigo_barras
codigo_marca
codigo_categoria
codigo_subcategoria
codigo_familia
codigo_unidad_medida
codigo_tipo_inventario
costo
ultimo_costo
estado
tipo_producto

-----------------------------------------------------
TABLA: tipos_negocio
-----------------------------------------------------
id
codigo
descripcion
color
estado
fecha_creacion
fecha_actualizacion

-----------------------------------------------------
TABLA: clientes
-----------------------------------------------------
id_cliente
codigo_cliente
tipo_identificacion_cliente
identificacion_cliente
nombre_cliente
nombre_comercial_cliente
codigo_tipo_negocio
contacto_cliente
codigo_moneda_cliente
codigo_lista_precio_cliente
metodo_pago_cliente
codigo_grupo_cliente
descuento_cliente
objetivo_venta_cliente
saldo_cliente
tiene_credito_cliente
tiene_documentos_cliente
estado_cliente
estado_proceso_cliente
nacionalidad_cliente
codigo_usuario_asignado_cliente
fecha_creacion_cliente
fecha_actualizacion_cliente

-----------------------------------------------------
TABLA: direcciones_clientes
-----------------------------------------------------
id_direccion_cliente
codigo_cliente
descripcion_direccion_cliente
codigo_direccion_cliente
calle1_direccion_cliente
bloque_direccion_cliente
calle2_direccion_cliente
referencia_direccion_cliente
codigo_postal_direccion_cliente
telefono_direccion_cliente
fax_direccion_cliente
email_direccion_cliente
latitud_direccion_cliente
longitud_direccion_cliente
fecha_ultima_visita_direccion_cliente
estado_direccion_cliente
estado_ubicacion_direccion_cliente
fecha_creacion_direccion_cliente
fecha_actualizacion_direccion_cliente

-----------------------------------------------------
TABLA: clientes_usuarios_ventas
-----------------------------------------------------
id_relacion
codigo_cliente
codigo_direccion_cliente
seller_code
ruta_code
tipo_atencion
ultima_atencion

-----------------------------------------------------
TABLA: ordenes
-----------------------------------------------------
id_orden
code
type
status
fecha_creacion
fecha_entrega
customer_code
route_code
seller_code
total
subtotal
iva
discount
parent_id
latitude
longitude
concept_code
concept_origin
sequence_type
notes

-----------------------------------------------------
TABLA: facturas
-----------------------------------------------------
id_factura
code
type
status
fecha_creacion
fecha_autorizacion
fecha_entrega
customer_code
customer_address_code
route_code
seller_code
total
subtotal
iva
discount
parent_id
auth_code
access_key
latitude
longitude
notes

-----------------------------------------------------
TABLA: detalle_documento
-----------------------------------------------------
id_detalle
documento_code
codigo_producto
descripcion
cantidad
precio
subtotal
total
iva
unit_alias
barcode
codigo_categoria
descripcion_categoria

-----------------------------------------------------
TABLA: rutas
-----------------------------------------------------
id
codigo
descripcion
tipo
estado
creado_por
actualizado_por
creado_por_id
actualizado_por_id
fecha_creacion
fecha_actualizacion

-----------------------------------------------------
TABLA: detalles_rutas
-----------------------------------------------------
id
codigo
codigo_ruta
route_code
codigo_cliente
customer_code
codigo_direccion_cliente
semana
dia
secuencia
estado
datos
creado_por
actualizado_por
creado_por_id
actualizado_por_id
fecha_creacion
fecha_actualizacion
ruta_codigo_lookup
cliente_codigo_lookup
direccion_codigo_lookup

-----------------------------------------------------
TABLA: sincronizaciones_ventas
-----------------------------------------------------
id_sync
fecha_sync
desde_date
hasta_date
total_registros
estado
mensaje

-----------------------------------------------------
TABLA: historial_visitas
-----------------------------------------------------
id
fecha_visita
codigo_usuario
codigo_ruta
codigo_cliente
codigo_direccion_cliente
semana
dia
accion
codigo_comentario
comentario
monto
latitud
longitud
estado_proceso
ruptura_secuencia
nombre_cliente
nombre_empresa_cliente
nombre_comercial_cliente
tipo_identificacion_cliente
numero_identificacion_cliente
contacto_cliente
comentario_cliente
estado_cliente
nombre_usuario
email_usuario
email_notificacion_usuario
identidad_usuario
tipo_identificacion_usuario
sucursal_usuario
telefono_usuario
direccion_usuario
marca_dispositivo_usuario
modelo_dispositivo_usuario
numero_dispositivo_usuario
codigo_almacen_usuario
codigo_ruta_predeterminada_usuario
codigo_rol_usuario

=====================================================
ESTRUCTURA OBLIGATORIA
=====================================================

Usar alias:

facturas f
detalle_documento d
clientes c
rutas r
historial_visitas hv

Formato recomendado:

SELECT ...
FROM ...
LEFT JOIN ... ON ...
WHERE 1=1
${filtroVendedor}
GROUP BY ...
ORDER BY ...
LIMIT ...

=====================================================
REGLAS IMPORTANTES
=====================================================

✔ NO asumir que columnas type o status son texto (son INTEGER).
✔ Siempre usar nombres EXACTOS definidos arriba.
✔ Nunca usar c.nombre (usar nombre_cliente o nombre_comercial_cliente).
✔ Para fechas usar:
  DATE(f.fecha_creacion)

✔ Para ventas:
  COALESCE(SUM(f.total), 0)

✔ Para unidades:
  COALESCE(SUM(d.cantidad), 0)

✔ Para unir:
  f.code = d.documento_code
  f.customer_code = c.codigo_cliente

=====================================================
REGLAS PRODUCTOS
=====================================================

Usar:
UPPER(d.descripcion) LIKE '%TEXTO%'

botellón → '%BOTELL%'
galón → '%GALON%'
pack → '%PACK%'
hielo → '%HIELO%'
servicio → '%SERVICIO%'

=====================================================
RANKING
=====================================================

Si piden top, ranking o mayor:
ORDER BY ... DESC
LIMIT 10

=====================================================
SALIDA
=====================================================

Responder SOLO en JSON:

{
  "sql": "SELECT ..."
}
`
            },
            {
               role: "user",
               content: pregunta
            }
         ]
      });

      let response = completion.choices[0].message.content;

      if (!response) {
         throw new Error("Respuesta vacía del modelo.");
      }

      const parsed = JSON.parse(response);
      let query = parsed.sql.trim();

      console.log("📜 SQL generado:", query);

      // ===============================
      // LIMPIEZA Y VALIDACIONES
      // ===============================

      // Quitar punto y coma final si existe
      query = query.replace(/;$/, "").trim();

      const forbiddenPatterns = [
         /--/g,
         /\bINSERT\b/i,
         /\bUPDATE\b/i,
         /\bDELETE\b/i,
         /\bDROP\b/i,
         /\bALTER\b/i,
         /\bTRUNCATE\b/i
      ];

      for (const pattern of forbiddenPatterns) {
         if (pattern.test(query)) {
            throw new Error("SQL contiene patrón prohibido.");
         }
      }

      if (!query.toUpperCase().startsWith("SELECT")) {
         throw new Error("SQL inválido: no inicia con SELECT.");
      }

      console.log("✅ SQL validado correctamente.");
      console.log("====================================");

      return query;

   } catch (error) {
      console.error("❌ ERROR generando SQL:", error.message);
      throw error;
   }
}

module.exports = { generarSQL };