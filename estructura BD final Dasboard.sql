------------------------------------------------------------
-- TABLA: app_users
-- Tu SQL estaba incorrecto, ahora coincide CON TU MODELO Sequelize
-- Modelo usado: AppUser.js
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    usuario TEXT UNIQUE NOT NULL,
    clave TEXT NOT NULL,
    rol TEXT CHECK (rol IN ('ADMIN', 'VENDEDOR', 'DESPACHADOR', 'SUPERVISOR')) NOT NULL,
    rutas_asignadas TEXT[],
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_users_rol
    ON app_users(rol);


    -- ____________________--
    -- -------------------
-------------------------------------------------
-- Tabla: productos
-------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    codigo_producto VARCHAR(50) PRIMARY KEY,

    nombre_producto VARCHAR(255) NOT NULL,
    nombre_producto_completo TEXT,

    nombre_alterno VARCHAR(150),
    descripcion_venta TEXT,

    codigo_barras VARCHAR(100),

    codigo_marca VARCHAR(50),
    codigo_categoria VARCHAR(50),
    codigo_subcategoria VARCHAR(50),
    codigo_familia VARCHAR(50),

    codigo_unidad_medida VARCHAR(50),
    unidad_medida VARCHAR(50),
    unidad_medida_compra VARCHAR(50),

    codigo_tipo_inventario VARCHAR(50),

    costo NUMERIC(12,2),
    ultimo_costo NUMERIC(12,2),
    precio DECIMAL(12,2),

    peso DECIMAL(10,3) DEFAULT 0,
    volumen DECIMAL(10,3) DEFAULT 0,

    estado INTEGER,
    activo BOOLEAN DEFAULT TRUE,

    tipo_producto VARCHAR(50),

    origen_sistema VARCHAR(50),
    mobilvendor_id VARCHAR(100)
);

-------------------------------------------------
-- Índices
-------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_productos_categoria
    ON productos(codigo_categoria);

CREATE INDEX IF NOT EXISTS idx_productos_marca
    ON productos(codigo_marca);

CREATE INDEX IF NOT EXISTS idx_productos_estado
    ON productos(estado);

------------------------------------------------------------
-- TABLA: tipos_negocio
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_negocio (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    color VARCHAR(20),
    estado INT DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tipos_negocio_codigo
    ON tipos_negocio(codigo);



------------------------------------------------------------
-- TABLA: clientes
-- Modelo usado: clientes.js
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id_cliente SERIAL PRIMARY KEY,

  codigo_cliente VARCHAR(255) UNIQUE,

  company_id VARCHAR(20),
  descripcion_company VARCHAR(200),

  tipo_identificacion_cliente VARCHAR(50),
  identificacion_cliente VARCHAR(20),

  correo_cliente VARCHAR(255),

  nombre_cliente VARCHAR(255),
  nombre_comercial_cliente VARCHAR(255),

  -- RELACIÓN CON TIPO DE NEGOCIO
  codigo_tipo_negocio VARCHAR(50),

  contacto_cliente VARCHAR(255),

  codigo_moneda_cliente VARCHAR(3) DEFAULT 'USD',
  codigo_lista_precio_cliente VARCHAR(50),

  metodo_pago_cliente VARCHAR(50),
  condicion_pago_cliente VARCHAR(100),

  codigo_grupo_cliente VARCHAR(100),

  descuento_cliente DECIMAL(10,2) DEFAULT 0.00,
  objetivo_venta_cliente DECIMAL(10,2),

  saldo_cliente DECIMAL(10,2) DEFAULT 0.00,

  tiene_credito_cliente BOOLEAN DEFAULT FALSE,
  tiene_documentos_cliente BOOLEAN DEFAULT TRUE,

  estado VARCHAR(25),
  estado_cliente INT DEFAULT 0,
  estado_proceso_cliente INT DEFAULT 0,

  nacionalidad_cliente VARCHAR(100),

  codigo_usuario_asignado_cliente VARCHAR(50),

  -- CONTACTO
  email_cliente VARCHAR(255),
  telefono_cliente VARCHAR(100),

  -- DIRECCIÓN
  direccion_cliente TEXT,
  ciudad_cliente VARCHAR(150),
  pais_cliente VARCHAR(150),

  industria_cliente VARCHAR(150),

  -- GEOLOCALIZACIÓN
  latitud_cliente VARCHAR(100),
  longitud_cliente VARCHAR(100),

  -- FRECUENCIA Y VENDEDOR
  frecuencia_cliente VARCHAR(100),
  vendedor_asignado_cliente VARCHAR(100),

  comentario_cliente TEXT,

  -- SINCRONIZACIÓN ODOO
  id_odoo INTEGER,
  fecha_envio_odoo TIMESTAMP,

  -- ID DE MOBILVENDOR
  mobilvendor_id_cliente VARCHAR(100),

  fecha_creacion_cliente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion_cliente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- RELACIÓN CON TIPOS_NEGOCIO
  CONSTRAINT fk_clientes_tipo_negocio
    FOREIGN KEY (codigo_tipo_negocio)
    REFERENCES tipos_negocio(codigo)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

------------------------------------------------------------
-- ÍNDICES PARA RENDIMIENTO
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_cliente
    ON clientes(codigo_cliente);

CREATE INDEX IF NOT EXISTS idx_clientes_identificacion_cliente
    ON clientes(identificacion_cliente);

CREATE INDEX IF NOT EXISTS idx_clientes_estado_cliente
    ON clientes(estado_cliente);

CREATE INDEX IF NOT EXISTS idx_clientes_estado_proceso_cliente
    ON clientes(estado_proceso_cliente);

CREATE INDEX IF NOT EXISTS idx_clientes_codigo_usuario_asignado
    ON clientes(codigo_usuario_asignado_cliente);

CREATE INDEX IF NOT EXISTS idx_clientes_codigo_tipo_negocio
    ON clientes(codigo_tipo_negocio);


------------------------------------------------------------
-- TRIGGER PARA ACTUALIZAR TIMESTAMP AUTOMÁTICAMENTE
------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_cliente_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion_cliente = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cliente_timestamp ON clientes;

CREATE TRIGGER update_cliente_timestamp
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_cliente_timestamp();





------------------------------------------------------------
-- TABLA: direcciones_clientes
-- Modelo usado: direcciones_clientes.js
------------------------------------------------------------
CREATE TABLE direcciones_clientes (
  id_direccion_cliente SERIAL PRIMARY KEY,
  codigo_cliente VARCHAR(255) NOT NULL,
  descripcion_direccion_cliente VARCHAR(255),
  codigo_direccion_cliente VARCHAR(255),
  calle1_direccion_cliente VARCHAR(255),
  bloque_direccion_cliente VARCHAR(255),
  calle2_direccion_cliente VARCHAR(255),
  referencia_direccion_cliente VARCHAR(255),
  codigo_postal_direccion_cliente VARCHAR(50),
  telefono_direccion_cliente VARCHAR(50),
  fax_direccion_cliente VARCHAR(50),
  email_direccion_cliente VARCHAR(100),
  latitud_direccion_cliente DECIMAL(15, 8),
  longitud_direccion_cliente DECIMAL(15, 8),
  fecha_ultima_visita_direccion_cliente TIMESTAMP,
  estado_direccion_cliente INT DEFAULT 1,
  estado_ubicacion_direccion_cliente INT DEFAULT 3,
  fecha_creacion_direccion_cliente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion_direccion_cliente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (codigo_cliente)
    REFERENCES clientes(codigo_cliente)
    ON DELETE CASCADE,

  CONSTRAINT unique_cliente_direccion
    UNIQUE (codigo_cliente, codigo_direccion_cliente)
);

-- Añadir índices adicionales para mejorar rendimiento
CREATE INDEX idx_codigo_cliente ON direcciones_clientes(codigo_cliente);

ALTER TABLE direcciones_clientes
ADD CONSTRAINT unique_cliente_direccion
UNIQUE (codigo_cliente, codigo_direccion_cliente);

CREATE OR REPLACE FUNCTION update_direccion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion_direccion_cliente = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_direccion_timestamp
BEFORE UPDATE ON direcciones_clientes
FOR EACH ROW
EXECUTE FUNCTION update_direccion_timestamp();




-------------------------------------------------
--  Tabla: clientes_usuarios_ventas
-- Relación N a N entre clientes y vendedores
-------------------------------------------------
select * from clientes_usuarios_ventas;
select * from clientes cv ;

CREATE TABLE IF NOT EXISTS clientes_usuarios_ventas (
    id_relacion SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) NOT NULL,
    codigo_direccion_cliente VARCHAR(100) NOT NULL DEFAULT 'DEFAULT',
    seller_code VARCHAR(50) NOT NULL,
    ruta_code VARCHAR(50),
    tipo_atencion VARCHAR(20), -- PREVENTA / TELEVENTA / VIP
    ultima_atencion TIMESTAMP,

    CONSTRAINT uq_cliente_seller_direccion
    UNIQUE (codigo_cliente, seller_code, codigo_direccion_cliente)
);

CREATE INDEX IF NOT EXISTS idx_cuv_cliente
    ON clientes_usuarios_ventas(codigo_cliente);

CREATE INDEX IF NOT EXISTS idx_cuv_seller
    ON clientes_usuarios_ventas(seller_code);

CREATE INDEX IF NOT EXISTS idx_cuv_ruta
    ON clientes_usuarios_ventas(ruta_code);


-------------------------------------------------
--  Tabla: ordenes
-------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenes (
    id_orden SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type INT,
    status INT,

    -------------------------------------------------
    -- Fechas
    -------------------------------------------------
    fecha_creacion TIMESTAMP,
    fecha_entrega TIMESTAMP,
    fecha_validez TIMESTAMP,
    fecha_compromiso TIMESTAMP,

    -------------------------------------------------
    -- Cliente / Comercial
    -------------------------------------------------
    customer_code VARCHAR(50),
    customer_nombre VARCHAR(255),
    customer_address_code INTEGER,

    route_code VARCHAR(50),

    seller_code VARCHAR(50),
    seller_nombre VARCHAR(255),

    equipo_ventas VARCHAR(100),
    equipo_ventas_id INTEGER,
    equipo_ventas_nombre VARCHAR(255),

    campania_id INT,
    descripcion_company VARCHAR(60),
    medio_id INT,
    fuente_id INT,

    -------------------------------------------------
    -- Estados
    -------------------------------------------------
    estado_odoo VARCHAR(50),
    estado_facturacion VARCHAR(50),
    estado_entrega VARCHAR(50),

    -------------------------------------------------
    -- Monetario
    -------------------------------------------------
    moneda VARCHAR(10),
    tasa_cambio DECIMAL(18,6),

    subtotal DECIMAL(18,2),
    iva DECIMAL(18,2),
    discount DECIMAL(18,2),
    total DECIMAL(18,2),

    monto_no_pagado DECIMAL(18,2),
    costo_envio DECIMAL(18,2),
    mobilvendor_id VARCHAR(100),

    -------------------------------------------------
    -- Márgenes
    -------------------------------------------------
    margen DECIMAL(12,2) DEFAULT 0,
    margen_porcentaje DECIMAL(6,2) DEFAULT 0,

    -------------------------------------------------
    -- Pago
    -------------------------------------------------
    payment_term_id INTEGER,
    payment_term_nombre VARCHAR(255),

    -------------------------------------------------
    -- Logística
    -------------------------------------------------
    almacen_id INT,
    almacen_nombre VARCHAR(255),

    transportista_id INT,
    transportista_nombre VARCHAR(255),

    peso_total DECIMAL(10,3) DEFAULT 0,

    politica_entrega VARCHAR(50),

    -------------------------------------------------
    -- Otros
    -------------------------------------------------
    parent_id VARCHAR(50),
    source_document VARCHAR(255),

    latitude DECIMAL(12,8),
    longitude DECIMAL(12,8),

    concept_code VARCHAR(50),
    concept_origin VARCHAR(50),

    sequence_type VARCHAR(10),

    etiquetas TEXT,
    notes TEXT,

    origen_sistema VARCHAR(20)
);

-------------------------------------------------
-- Índices (optimización de consultas)
-------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orden_route
    ON ordenes(route_code);

CREATE INDEX IF NOT EXISTS idx_orden_customer
    ON ordenes(customer_code);

CREATE INDEX IF NOT EXISTS idx_orden_seller
    ON ordenes(seller_code);

CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_creacion
    ON ordenes(fecha_creacion);

CREATE INDEX IF NOT EXISTS idx_ordenes_seller_nombre
    ON ordenes(seller_nombre);

CREATE INDEX IF NOT EXISTS idx_ordenes_status
    ON ordenes(status);

CREATE INDEX IF NOT EXISTS idx_ordenes_type
    ON ordenes(type);


-------------------------------------------------
--  Tabla: facturas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,          -- Código único de la factura
    type INT,                                  -- Tipo de documento (factura, nota de crédito, etc.)
    status INT,                                -- Estado de la factura (ej. 'posted', 'draft', etc.)
    fecha_creacion TIMESTAMP,                  -- Fecha de creación de la factura
    fecha_autorizacion TIMESTAMP,              -- Fecha de autorización de la factura
    fecha_entrega TIMESTAMP,                   -- Fecha de entrega de la factura
    customer_code VARCHAR(30),                 -- Código del cliente
    customer_address_code VARCHAR(30),         -- Código de la dirección del cliente
    route_code VARCHAR(50),                    -- Código de la ruta de la venta
    seller_code VARCHAR(50),                   -- Código del vendedor (vendedor asociado)
    total DECIMAL(18,2),                       -- Monto total de la factura (total con impuestos)
    subtotal DECIMAL(18,2),                    -- Subtotal (sin impuestos)
    iva DECIMAL(18,2),                         -- Monto del IVA
    discount DECIMAL(18,2),                    -- Descuento aplicado a la factura
    parent_id VARCHAR(50),                     -- ID de la factura padre en caso de ser una nota de crédito o reverso
    auth_code VARCHAR(200),                    -- Código de autorización del documento en Odoo
    access_key VARCHAR(200),                   -- Clave de acceso (especialmente en Ecuador para la facturación electrónica)
    latitude DECIMAL(12,8),                    -- Latitud de la ubicación del cliente (en caso de ser relevante)
    longitude DECIMAL(12,8),                   -- Longitud de la ubicación del cliente (en caso de ser relevante)
    notes TEXT,                                -- Notas adicionales sobre la factura

    -- 🔵 CAMPOS NUEVOS AGREGADOS
    estado_pago VARCHAR(20) NULL,              -- Estado del pago: 'not_paid', 'partial', 'paid'
    saldo_pendiente DECIMAL(18,2) NULL,        -- Saldo pendiente de pago (amount_residual)
    fecha_vencimiento TIMESTAMP NULL,          -- Fecha de vencimiento de la factura (invoice_date_due)
    tipo_documento VARCHAR(20) NULL,           -- Tipo de documento fiscal (l10n_latam_document_type)
    moneda VARCHAR(10) NULL,                   -- Moneda de la factura (USD, EUR, etc.)
    company_id INT NULL,                       -- ID de la empresa a la que pertenece la factura (en caso de ser multicompañía)
    reversed_entry_id INT NULL ,                -- ID de la entrada contable reversada (en caso de una nota de crédito o factura anulada)
    origen_sistema VARCHAR(15)
);

CREATE INDEX IF NOT EXISTS idx_factura_route
    ON facturas(route_code);

CREATE INDEX IF NOT EXISTS idx_factura_customer
    ON facturas(customer_code);

CREATE INDEX IF NOT EXISTS idx_factura_parent
    ON facturas(parent_id);

CREATE INDEX IF NOT EXISTS idx_factura_seller
    ON facturas(seller_code);




------------------------------------------------
-- Detalle de documentos (ordenes y facturas)
-------------------------------------------------
-------------------------------------------------
-- Tabla: detalle_documento
-------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_documento (
    id_detalle SERIAL PRIMARY KEY,

    documento_code VARCHAR(50),

    codigo_producto VARCHAR(100),
    producto_codigo_interno VARCHAR(100),

    descripcion VARCHAR(300),
    producto_nombre VARCHAR(255),
    producto_categoria VARCHAR(255),

    -------------------------------------------------
    -- Cantidades
    -------------------------------------------------
    cantidad DECIMAL(18,2),
    cantidad_entregada DECIMAL(18,2),
    cantidad_facturada DECIMAL(18,2),
    cantidad_pendiente_entregar DECIMAL(18,2),
    cantidad_pendiente_facturar DECIMAL(18,2),

    -------------------------------------------------
    -- Precios
    -------------------------------------------------
    precio DECIMAL(18,2),
    descuento_linea DECIMAL(18,2),

    subtotal DECIMAL(18,2),
    total DECIMAL(18,2),
    iva DECIMAL(18,2),

    precio_con_impuesto DECIMAL(18,2),
    precio_sin_impuesto DECIMAL(18,2),

    impuesto_linea DECIMAL(18,2),

    -------------------------------------------------
    -- Márgenes
    -------------------------------------------------
    margen_linea DECIMAL(12,2) DEFAULT 0,
    margen_porcentaje_linea DECIMAL(6,2) DEFAULT 0,

    -------------------------------------------------
    -- Clasificación
    -------------------------------------------------
    unit_alias VARCHAR(100),
    unidad_medida VARCHAR(50),

    barcode VARCHAR(100),

    codigo_categoria VARCHAR(10),
    descripcion_categoria VARCHAR(100),

    -------------------------------------------------
    -- Estados
    -------------------------------------------------
    estado_facturacion_linea VARCHAR(50),
    estado_odoo_linea VARCHAR(50),

    -------------------------------------------------
    -- Orden de línea
    -------------------------------------------------
    secuencia INTEGER DEFAULT 0,

    -------------------------------------------------
    -- Flags
    -------------------------------------------------
    es_anticipo BOOLEAN DEFAULT FALSE,
    es_envio BOOLEAN DEFAULT FALSE
);

-------------------------------------------------
-- Índices
-------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_doc_code
    ON detalle_documento(documento_code);

CREATE INDEX IF NOT EXISTS idx_doc_producto
    ON detalle_documento(codigo_producto);

-------------------------------------------------
-- Restricciones únicas
-------------------------------------------------

ALTER TABLE detalle_documento
ADD CONSTRAINT unique_detalle_doc
UNIQUE (documento_code, codigo_producto, precio, cantidad);



------------------------------------------------
-- Tabla rutas
-------------------------------------------------

CREATE TABLE rutas (
    id SERIAL PRIMARY KEY,  -- Identificador único (auto-incrementable)
    codigo VARCHAR(100) NOT NULL,  -- Código de la ruta (code)
    descripcion VARCHAR(255),  -- Descripción de la ruta (description)
    codigo_cliente VARCHAR(30),
    codigo_direccion VARCHAR(40),
    tipo INT,  -- Tipo de ruta (type)
    estado INT,  -- Estado de la ruta (status)
    creado_por INT,  -- Usuario que creó la ruta (c)
    actualizado_por INT,  -- Usuario que actualizó la ruta (u)
    creado_por_id VARCHAR(255),  -- ID de quien creó la ruta (c_by)
    actualizado_por_id VARCHAR(255),  -- ID de quien actualizó la ruta (u_by)
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Fecha de creación (c)
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Fecha de actualización (u)

);
CREATE UNIQUE INDEX rutas_codigo_unique ON public.rutas (codigo);


------------------------------------------------
-- Tabla detalles_rutas
-------------------------------------------------
CREATE TABLE detalles_rutas (
    id SERIAL PRIMARY KEY,  -- Identificador único (auto-incrementable)
    codigo VARCHAR(100) NOT NULL,  -- Código del detalle de la ruta (code)
    codigo_ruta VARCHAR(100),  -- Código de la ruta (route_code)
    route_code VARCHAR(100), 
    codigo_cliente VARCHAR(100),  -- Código del cliente (customer_code)
    codigo_direccion_cliente VARCHAR(100),  -- Código de la dirección del cliente (customer_address_code)
    semana INT,  -- Semana de la ruta (week)
    dia INT,  -- Día de la ruta (day)
    secuencia INT,  -- Secuencia del detalle de la ruta (sequence)
    estado INT,  -- Estado del detalle de la ruta (status)
    datos JSONB,  -- Almacenamiento de datos adicionales (data)
    creado_por INT,  -- Usuario que creó el detalle (c)
    actualizado_por INT,  -- Usuario que actualizó el detalle (u)
    creado_por_id VARCHAR(255),  -- ID del usuario que creó (c_by)
    actualizado_por_id VARCHAR(255),  -- ID del usuario que actualizó (u_by)
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Fecha de creación (c)
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Fecha de actualización (u)
    ruta_codigo_lookup VARCHAR(255),  -- Descripción de la ruta (route_code_lookup)
    cliente_codigo_lookup VARCHAR(255),  -- Nombre del cliente (customer_code_lookup)
    direccion_codigo_lookup VARCHAR(255)  -- Código de dirección del cliente (customer_address_code_lookup)
);
ALTER TABLE detalles_rutas
ADD COLUMN customer_code VARCHAR(255);

ALTER TABLE detalles_rutas
ADD CONSTRAINT unique_codigo UNIQUE (codigo);


------------------------------------------------
-- Tabla sincronizaciones_ventas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS sincronizaciones_ventas (
    id_sync SERIAL PRIMARY KEY,
    fecha_sync TIMESTAMP DEFAULT NOW(),
    desde_date DATE,
    hasta_date DATE,
    total_registros INT,
    estado VARCHAR(20),
    mensaje VARCHAR(100)
);


select * from historial_visitas;
-- Crear la tabla historial_visitas si no existe
CREATE TABLE IF NOT EXISTS historial_visitas (
    id SERIAL PRIMARY KEY,  -- Identificador único de la visita
    fecha_visita TIMESTAMP,  -- Fecha de la visita (en formato timestamp)
    codigo_usuario VARCHAR(50),  -- Código del usuario que realizó la visita
    codigo_ruta VARCHAR(50),  -- Código de la ruta asociada
    codigo_cliente VARCHAR(50),  -- Código del cliente
    codigo_direccion_cliente VARCHAR(50),  -- Código de la dirección del cliente
    semana INT,  -- Semana de la visita
    dia INT,  -- Día de la semana (1-7)
    accion VARCHAR(50),  -- Tipo de acción (por ejemplo, "visit_start")
    codigo_comentario VARCHAR(50),  -- Código de comentario asociado
    comentario TEXT,  -- Comentario adicional sobre la visita
    monto DECIMAL(18, 2),  -- Monto asociado a la visita (si aplica)
    latitud DECIMAL(12, 8),  -- Latitud (para geolocalización)
    longitud DECIMAL(12, 8),  -- Longitud (para geolocalización)
    estado_proceso INT,  -- Estado del proceso (ejemplo: 0 = pendiente, 1 = completado)
    ruptura_secuencia INT,  -- Indica si hubo una ruptura de secuencia (1 = sí, 0 = no)
    nombre_cliente VARCHAR(250),  -- Nombre del cliente
    nombre_empresa_cliente VARCHAR(250),  -- Nombre de la empresa del cliente (si aplica)
    nombre_comercial_cliente VARCHAR(250),  -- Nombre comercial del cliente (si aplica)
    tipo_identificacion_cliente VARCHAR(10),  -- Tipo de identificación del cliente (ejemplo: "C" = cédula)
    numero_identificacion_cliente VARCHAR(20),  -- Número de identificación del cliente
    contacto_cliente VARCHAR(50),  -- Contacto del cliente
    comentario_cliente TEXT,  -- Comentario del cliente (si aplica)
    estado_cliente INT,  -- Estado del cliente (ejemplo: 0 = inactivo, 1 = activo)
    nombre_usuario VARCHAR(250),  -- Nombre del usuario que realizó la acción
    email_usuario VARCHAR(100),  -- Email del usuario
    email_notificacion_usuario VARCHAR(100),  -- Emails de notificación del usuario
    identidad_usuario VARCHAR(50),  -- Identidad del usuario (si aplica)
    tipo_identificacion_usuario VARCHAR(10),  -- Tipo de identificación del usuario
    sucursal_usuario VARCHAR(100),  -- Sucursal del usuario (si aplica)
    telefono_usuario VARCHAR(50),  -- Teléfono del usuario (si aplica)
    direccion_usuario VARCHAR(500),  -- Dirección del usuario (si aplica)
    marca_dispositivo_usuario VARCHAR(100),  -- Marca del dispositivo del usuario
    modelo_dispositivo_usuario VARCHAR(100),  -- Modelo del dispositivo del usuario
    numero_dispositivo_usuario VARCHAR(100),  -- Número de dispositivo del usuario
    codigo_almacen_usuario VARCHAR(50),  -- Código del almacenamiento predeterminado del usuario
    codigo_ruta_predeterminada_usuario VARCHAR(50),  -- Código de la ruta predeterminada del usuario
    codigo_rol_usuario VARCHAR(50)  -- Código del rol del usuario (ejemplo: "ADMIN", "VENDEDOR")
);

-- Crear un índice único para evitar duplicados basados en la combinación de codigo_cliente, codigo_ruta y fecha_visita
CREATE UNIQUE INDEX idx_historial_visitas_unique
ON historial_visitas (codigo_cliente, codigo_ruta, fecha_visita);

-- Crear índices no únicos para mejorar el rendimiento de las consultas
-- Índice en codigo_usuario para acelerar las búsquedas por usuario
CREATE INDEX idx_historial_visitas_codigo_usuario
ON historial_visitas (codigo_usuario);

-- Índice en accion para acelerar las búsquedas por tipo de acción
CREATE INDEX idx_historial_visitas_accion
ON historial_visitas (accion);

-- _________________________--
-- ----------------

CREATE TABLE metas_preventas (
  id_meta SERIAL PRIMARY KEY,  -- Usa SERIAL para el auto-incremento
  codigo_ruta VARCHAR(50) NOT NULL,
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  meta_unidades INT NOT NULL DEFAULT 0,
  meta_dolares FLOAT NOT NULL DEFAULT 0,
  CONSTRAINT unique_codigo_ruta_anio_mes UNIQUE (codigo_ruta, anio, mes)
);


-- ____________
-- -- Tipo de documento
-- __________-
CREATE TABLE tipo_documento_latam (
    id SERIAL PRIMARY KEY,
    secuencia VARCHAR(255),                -- "sequence" en inglés
    id_pais INT,                           -- "country_id" en inglés
    usuario_creacion INT,                  -- "create_uid" en inglés
    usuario_actualizacion INT,             -- "write_uid" en inglés
    nombre VARCHAR(255),                    -- "name" en inglés
    prefijo_codigo_documento VARCHAR(10),  -- "doc_code_prefix" en inglés
    codigo VARCHAR(10),                    -- "code" en inglés
    nombre_reporte VARCHAR(255),           -- "report_name" en inglés
    tipo_interno VARCHAR(50),              -- "internal_type" en inglés
    activo BOOLEAN,                        -- "active" en inglés
    fecha_creacion TIMESTAMP,              -- "create_date" en inglés
    fecha_actualizacion TIMESTAMP,         -- "write_date" en inglés
    verificar_formato_ecuador BOOLEAN      -- "l10n_ec_check_format" en inglés
);






CREATE OR REPLACE VIEW vw_clientes_analisis AS
WITH direccion_principal AS (
  SELECT DISTINCT ON (dc.codigo_cliente)
    dc.codigo_cliente,
    COALESCE(dc.descripcion_direccion_cliente, '-') AS direccion,
    dc.codigo_direccion_cliente
  FROM direcciones_clientes dc
  WHERE dc.estado_direccion_cliente = 1
  ORDER BY
    dc.codigo_cliente,
    dc.fecha_actualizacion_direccion_cliente DESC NULLS LAST,
    dc.id_direccion_cliente DESC
),
facturas_cliente AS (
  SELECT
    f.customer_code AS codigo_cliente,
    COUNT(DISTINCT f.code) AS total_facturas,
    COALESCE(SUM(f.total), 0) AS total_ventas,
    MAX(f.fecha_creacion) AS ultima_compra,
    MIN(f.fecha_creacion) AS primera_compra
  FROM facturas f
  GROUP BY f.customer_code
),
unidades_cliente AS (
  SELECT
    f.customer_code AS codigo_cliente,
    COALESCE(SUM(dd.cantidad), 0) AS total_unidades
  FROM facturas f
  LEFT JOIN detalle_documento dd
    ON dd.documento_code = f.code
  GROUP BY f.customer_code
)
SELECT
  c.codigo_cliente,
  c.nombre_cliente,
  c.identificacion_cliente,
  c.nombre_comercial_cliente,

  dp.direccion,

  -- vendedor asignado en clientes (tu campo)
  c.codigo_usuario_asignado_cliente AS seller_code,

  -- tipo negocio
  COALESCE(tn.descripcion, 'SIN CLASIFICAR') AS tipo_negocio,

  -- crédito / contado
  c.tiene_credito_cliente,
  CASE
    WHEN c.tiene_credito_cliente THEN 'CREDITO'
    ELSE 'CONTADO'
  END AS tipo_pago,

  -- métricas
  COALESCE(fc.total_facturas, 0) AS total_facturas,
  COALESCE(uc.total_unidades, 0) AS total_unidades,
  COALESCE(fc.total_ventas, 0) AS total_ventas,

  fc.ultima_compra,
  fc.primera_compra,

  CASE
    WHEN COALESCE(fc.total_facturas, 0) > 0
      THEN COALESCE(fc.total_ventas, 0) / fc.total_facturas
    ELSE 0
  END AS ticket_promedio,

  CASE
    WHEN fc.ultima_compra IS NULL THEN NULL
    ELSE CURRENT_DATE - DATE(fc.ultima_compra)
  END AS dias_sin_comprar,

  CASE
    WHEN fc.ultima_compra IS NULL THEN 'SIN COMPRAS'
    WHEN CURRENT_DATE - DATE(fc.ultima_compra) <= 30 THEN 'ACTIVO'
    WHEN CURRENT_DATE - DATE(fc.ultima_compra) <= 60 THEN 'RIESGO'
    ELSE 'INACTIVO'
  END AS estado_cliente

FROM clientes c
LEFT JOIN direccion_principal dp
  ON dp.codigo_cliente = c.codigo_cliente
LEFT JOIN tipos_negocio tn
  ON tn.codigo = c.codigo_tipo_negocio
LEFT JOIN facturas_cliente fc
  ON fc.codigo_cliente = c.codigo_cliente
LEFT JOIN unidades_cliente uc
  ON uc.codigo_cliente = c.codigo_cliente;



CREATE INDEX IF NOT EXISTS idx_facturas_customer_fecha
ON facturas(customer_code, fecha_creacion);

CREATE INDEX IF NOT EXISTS idx_detalle_documento_doc
ON detalle_documento(documento_code);

CREATE INDEX IF NOT EXISTS idx_direcciones_cliente_estado_fecha
ON direcciones_clientes(codigo_cliente, estado_direccion_cliente, fecha_actualizacion_direccion_cliente);

CREATE INDEX IF NOT EXISTS idx_facturas_customer_code
ON facturas(customer_code);

CREATE INDEX IF NOT EXISTS idx_facturas_fecha
ON facturas(fecha_creacion);

CREATE INDEX IF NOT EXISTS idx_detalle_documento_code
ON detalle_documento(documento_code);

CREATE INDEX IF NOT EXISTS idx_direcciones_cliente
ON direcciones_clientes(codigo_cliente);





CREATE TABLE IF NOT EXISTS clientes_categoria_relacion (
    categoria_id INTEGER NOT NULL,
    cliente_id   INTEGER NOT NULL,
    PRIMARY KEY (categoria_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_ccr_cliente   ON clientes_categoria_relacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ccr_categoria ON clientes_categoria_relacion(categoria_id);
