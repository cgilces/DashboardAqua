/* ============================================================
   📁 ARCHIVO: diagnostico_ventas.sql
   📌 CONSULTAS ORGANIZADAS PARA ANALISIS DE BD DE PREVENTAS
   ============================================================ */


/* ============================================================
   1. FACTURAS POR RANGO DE FECHAS
   ============================================================ */
-- 📌 Facturas creadas entre 01 y 30 de septiembre 2025
SELECT * 
FROM facturas  
WHERE fecha_creacion BETWEEN '2025-09-01' AND '2025-09-30';


delete from clientes_ventas ;
delete from detalle_documento  ;
delete from facturas  ;
delete from metas_preventas  ;
delete from ordenes  ;
delete from sincronizaciones_ventas  ;
delete from rutas_preventas  ;




/* ============================================================
   2. VER TODOS LOS CLIENTES
   ============================================================ */
-- 📌 Listado completo de clientes de ventas
SELECT * FROM clientes_ventas cv;



/* ============================================================
   3. TODAS LAS RUTAS DE PREVENTAS
   ============================================================ */
-- 📌 Listado de rutas preventas
SELECT * FROM rutas_preventas rp;



/* ============================================================
   4. DETALLE DOCUMENTOS (PV9) POR FECHA
   ============================================================ */
-- 📌 Detalle de documentos PV9 entre 01/09 y 01/10 con cantidad > 0
SELECT 
  product_code,
  product_name,
  article_description,
  article_alias,
  cantidad,
  total
FROM detalle_documentos
WHERE product_code IS NOT NULL
  AND cantidad > 0
  AND fecha_creacion BETWEEN '2025-09-01' AND '2025-10-01'
  AND product_code LIKE 'PV9%';



/* ============================================================
   5. UNIDADES VENDIDAS (RUTA PV2)
   ============================================================ */
-- 📌 Total de unidades vendidas por PV2 en septiembre 2025
SELECT 
    rp.nombre_ruta,
    SUM(dd.cantidad) AS total_unidades_vendidas
FROM ordenes o
JOIN detalle_documento dd ON dd.orden_id = o.id
JOIN ruta_preventa rp ON rp.id = o.ruta_preventa_id
WHERE rp.codigo = 'PV2'
  AND o.fecha_emision >= DATE '2025-09-01'
  AND o.fecha_emision <  DATE '2025-10-01'
GROUP BY rp.nombre_ruta;



/* ============================================================
   6. ÓRDENES COMPLETAS (RUTA PV2)
   ============================================================ */
-- 📌 Órdenes de PV2 entre 1 y 30 de septiembre 2025
SELECT 
    id_orden,
    code,
    customer_code,
    route_code,
    seller_code,
    fecha_creacion,
    fecha_entrega,
    total,
    subtotal,
    iva,
    discount,
    concept_code,
    concept_origin,
    notes
FROM ordenes
WHERE route_code = 'PV2'
  AND fecha_creacion >= '2025-09-01 00:00:00'
  AND fecha_creacion <= '2025-09-30 23:59:59.999'
ORDER BY fecha_creacion ASC;



/* ============================================================
   7. UNIDADES Y MONTOS (RUTA PV9)
   ============================================================ */
-- 📌 Resumen de unidades y montos vendidos por PV9 (septiembre)
SELECT 
    SUM(d.cantidad) AS unidades,
    SUM(d.total)    AS monto
FROM detalle_documento d
JOIN ordenes o ON d.documento_code = o.code
WHERE o.route_code = 'PV9'
  AND o.fecha_creacion >= '2025-09-01'::date
  AND o.fecha_creacion <  '2025-10-01'::date
  AND o.type = 2
  AND o.status IN (1, 2);



/* ============================================================
   8. ELIMINAR DATOS (RESET BD)
   ============================================================ */
-- ⚠️ Reset total de tablas (solo para pruebas)
DELETE FROM clientes_ventas;
DELETE FROM detalle_documento;
DELETE FROM facturas;
DELETE FROM metas_preventas;
DELETE FROM ordenes;
DELETE FROM rutas_preventas;
DELETE FROM sincronizaciones_ventas;



/* ============================================================
   9. ESTADO DE CAMPOS (FACTURAS)
   ============================================================ */
-- 📌 Conteo de campos completos y vacíos en facturas
SELECT
    COUNT(*) AS total_facturas,
    COUNT(fecha_creacion) AS con_fecha_creacion,
    COUNT(*) - COUNT(fecha_creacion) AS sin_fecha_creacion,
    COUNT(fecha_autorizacion) AS con_fecha_autorizacion,
    COUNT(*) - COUNT(fecha_autorizacion) AS sin_fecha_autorizacion,
    COUNT(fecha_entrega) AS con_fecha_entrega,
    COUNT(*) - COUNT(fecha_entrega) AS sin_fecha_entrega
FROM facturas;



/* ============================================================
   10. FACTURAS SIN FECHA
   ============================================================ */
-- 📌 Facturas con fecha_creacion nula o vacía
SELECT COUNT(*)
FROM facturas
WHERE fecha_creacion IS NULL OR fecha_creacion = '';



/* ============================================================
   11. FACTURAS OCTUBRE 2025
   ============================================================ */
-- 📌 Facturas creadas del 01 al 31 de octubre
SELECT COUNT(*) 
FROM facturas 
WHERE DATE(fecha_creacion) BETWEEN '2025-10-01' AND '2025-10-31';



/* ============================================================
   12. ÓRDENES OCTUBRE 2025
   ============================================================ */
-- 📌 Órdenes creadas del 01 al 31 de octubre
SELECT COUNT(*) 
FROM ordenes 
WHERE DATE(fecha_creacion) BETWEEN '2025-10-01' AND '2025-10-31';



/* ============================================================
   13. ÓRDENES SIN FECHA
   ============================================================ */
-- 📌 Órdenes con fecha_creacion nula
SELECT COUNT(*)
FROM ordenes
WHERE fecha_creacion IS NULL;



/* ============================================================
   14. CÓDIGOS DUPLICADOS EN ÓRDENES
   ============================================================ */
-- 📌 Detectar códigos duplicados
SELECT code, COUNT(*)
FROM ordenes
GROUP BY code
HAVING COUNT(*) > 1;



/* ============================================================
   15. RANGO DE FECHAS DE ÓRDENES
   ============================================================ */
-- 📌 Primera y última orden registrada
SELECT MIN(fecha_creacion), MAX(fecha_creacion)
FROM ordenes;



/* ============================================================
   16. ÓRDENES 1 DE OCTUBRE
   ============================================================ */
-- 📌 Órdenes creadas el 1 de octubre
SELECT COUNT(*)
FROM ordenes
WHERE fecha_creacion >= '2025-10-01'::date
  AND fecha_creacion <  '2025-10-02'::date;



/* ============================================================
   17. BUSCAR CLIENTE POR NOMBRE
   ============================================================ */
-- 📌 Buscar cliente exacto por nombre
SELECT * 
FROM clientes_ventas cv 
WHERE cv.nombre_cliente = 'ALVEAR FERNANDEZ EDMUNDO FRANCISCO';



/* ============================================================
   18. CLIENTES DUPLICADOS (NOMBRE + TELÉFONO)
   ============================================================ */
-- 📌 Mostrar información completa de clientes duplicados
SELECT *
FROM clientes_ventas
WHERE (nombre_cliente, telefono) IN (
    SELECT nombre_cliente, telefono
    FROM clientes_ventas
    GROUP BY nombre_cliente, telefono
    HAVING COUNT(*) > 1
)
ORDER BY nombre_cliente;



/* ============================================================
   19. FACTURAS CON FECHA VACÍA
   ============================================================ */
-- 📌 Facturas con fecha_creacion vacía
SELECT COUNT(*) 
FROM facturas 
WHERE fecha_creacion = '';



/* ============================================================
   20. ÓRDENES CON FECHA VACÍA
   ============================================================ */
-- 📌 Órdenes con fecha_creacion nula
SELECT COUNT(*) 
FROM ordenes 
WHERE fecha_creacion IS NULL;



/* ============================================================
   21. RESUMEN GENERAL DE DOCUMENTOS
   ============================================================ */
-- 🔍 Facturas del mes
SELECT COUNT(*) FROM facturas 
WHERE fecha_creacion BETWEEN '2025-10-01' AND '2025-10-31';

-- 🔍 Órdenes del mes
SELECT COUNT(*) FROM ordenes 
WHERE fecha_creacion BETWEEN '2025-10-01' AND '2025-10-31';

-- 🔍 Detalles totales
SELECT COUNT(*) FROM detalle_documento;

-- 🔍 Total de documentos (facturas + ordenes)
SELECT 
    (SELECT COUNT(*) FROM facturas) +
    (SELECT COUNT(*) FROM ordenes) AS total_docs;



/* ============================================================
   22. NOMBRES DE CLIENTES DUPLICADOS
   ============================================================ */
-- 📌 Mostrar nombres repetidos en clientes
SELECT nombre_cliente, COUNT(*) AS total
FROM clientes_ventas
GROUP BY nombre_cliente
HAVING COUNT(*) > 1;




SELECT
    SUM(dd.cantidad) AS total_unidades
FROM
    ordenes o
JOIN
    detalle_documento dd ON dd.documento_code = o.code
WHERE
    -- Solo PREVENTA, TELEVENTA, RURAL
    (o.route_code LIKE 'PV%' OR o.route_code LIKE 'T%' OR o.route_code LIKE 'R%')

    -- Estados que cuentan
    AND o.status IN (2, 4)

    -- Fechas (YA ES TIMESTAMP)
    AND o.fecha_entrega >= '2025-10-01 00:00:00'
    AND o.fecha_entrega <  '2025-11-01 00:00:00'

    -- Ruta específica (PV1)
    AND (o.route_code = 'PV1' OR o.seller_code = 'PV1');
    
    
    
    
    
    
    SELECT 
    o.code AS codigo_orden,
    o.customer_code,
    o.route_code,
    o.seller_code,
    o.status AS estado_orden,
    o.fecha_creacion,
    o.fecha_entrega,
    dd.codigo_producto,
    dd.descripcion,
    dd.cantidad,
    dd.precio,
    dd.total
FROM 
    ordenes o
JOIN 
    detalle_documento dd ON dd.documento_code = o.code
WHERE 
    -- Solo PV1
    (o.route_code = 'PV1' OR o.seller_code = 'PV1')

    -- ✅ CORRECCIÓN: Usar el operador IN para múltiples valores
    AND o.status IN (4, 5)    

    -- Rango Octubre 2025
    AND o.fecha_entrega >= '2025-10-01 00:00:00'
    AND o.fecha_entrega <  '2025-11-01 00:00:00'

ORDER BY 
    o.fecha_entrega ASC;



📌 – Órdenes PV1 con guía terminada en Octubre
SELECT 
    -- 1. Sumamos la columna 'cantidad' de todos los detalles
    SUM(dd.cantidad) AS total_unidades_vendidas
FROM 
    ordenes o
JOIN 
    detalle_documento dd ON dd.documento_code = o.code
WHERE 
    -- Solo PV1
    (o.route_code = 'PV1' OR o.seller_code = 'PV1')

    -- Solo órdenes con status 4 o 5 (asumidas como 'terminadas')
    AND o.status IN (4, 5)    

    -- Rango Octubre 2025
    AND o.fecha_entrega >= '2025-10-01 00:00:00'
    AND o.fecha_entrega <  '2025-11-01 00:00:00';


    
  
    
    
    
    
    
    SELECT 
    o.code AS orden,
    o.fecha_entrega,
    o.status,
    o.route_code,
    o.seller_code,
    SUM(dd.cantidad) AS unidades
FROM ordenes o
JOIN detalle_documento dd 
      ON dd.documento_code = o.code
WHERE 
    -- Grupos válidos: PREVENTA, TELEVENTA, RURAL
    (o.route_code LIKE 'PV%' OR 
     o.route_code LIKE 'T%'  OR 
     o.route_code LIKE 'R%')

    -- Estados válidos: envío, confirmado, terminado
    AND o.status IN (2, 4, 10)

    -- Rango Octubre 2025
    AND o.fecha_entrega >= '2025-10-01 00:00:00'
    AND o.fecha_entrega <  '2025-11-01 00:00:00'

    -- Preventa específica
    AND (o.route_code = 'PV1' OR o.seller_code = 'PV1')

GROUP BY 
    o.code, o.fecha_entrega, o.status, o.route_code, o.seller_code
ORDER BY 
    o.fecha_entrega;







select * from ordenes;


SELECT 
    SUM(dd.cantidad) AS total_unidades_pv1_octubre
FROM ordenes o
JOIN detalle_documento dd
    ON dd.documento_code = o.code
WHERE 
    -- Estados válidos que cuentan como venta efectiva
    o.status IN (4, 5)
    -- PV1 por ruta o vendedor
    AND (o.seller_code = 'PV1')
    -- Rango de fechas para Octubre 2025
    AND o.fecha_entrega   >= '2025-10-01 00:00:00'
    AND o.fecha_entrega  <  '2025-11-01 00:00:00';

	
    select * from ordenes where code ='PDPV1-003415';
    
    
    
    

SELECT 
    f.route_code AS ruta,
    SUM(d.cantidad) AS unidades_api,
    SUM(d.total) AS monto_api
FROM facturas f
JOIN detalle_documento d ON d.documento_code = f.code
WHERE DATE(f.fecha_autorizacion) BETWEEN '2025-10-01' AND '2025-10-31'
GROUP BY f.route_code
ORDER BY f.route_code;

