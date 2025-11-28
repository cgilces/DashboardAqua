-- YA ESTÁS EN ventas_mv
-- NO CREAR BASE, NO USE !!

-------------------------------------------------
-- 2. Tabla: rutas_preventas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS rutas_preventas (
    id_ruta SERIAL PRIMARY KEY,
    codigo_ruta VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    tipo VARCHAR(50)
);

-------------------------------------------------
-- 3. Tabla: clientes_ventas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes_ventas (
    id_cliente SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) NOT NULL UNIQUE,
    nombre_cliente VARCHAR(250),
    direccion_entrega VARCHAR(500),
    telefono VARCHAR(50),
    email VARCHAR(100),
    latitud DECIMAL(12,8),
    longitud DECIMAL(12,8),
    ruta_asignada VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_cliente_ruta
    ON clientes_ventas(ruta_asignada);

-------------------------------------------------
-- 4. Tabla: ordenes
-------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenes (
    id_orden SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type INT,
    status INT,
    fecha_creacion TIMESTAMP,
    fecha_entrega TIMESTAMP,
    customer_code VARCHAR(50),
    route_code VARCHAR(50),
    seller_code VARCHAR(50),
    total DECIMAL(18,2),
    subtotal DECIMAL(18,2),
    iva DECIMAL(18,2),
    discount DECIMAL(18,2),
    parent_id VARCHAR(50),
    latitude DECIMAL(12,8),
    longitude DECIMAL(12,8),
    concept_code VARCHAR(50),
    concept_origin VARCHAR(50),
    sequence_type VARCHAR(10),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_orden_route
    ON ordenes(route_code);

CREATE INDEX IF NOT EXISTS idx_orden_customer
    ON ordenes(customer_code);

CREATE INDEX IF NOT EXISTS idx_orden_seller
    ON ordenes(seller_code);

-------------------------------------------------
-- 5. Tabla: facturas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type INT,
    status INT,
    fecha_creacion TIMESTAMP,
    fecha_autorizacion TIMESTAMP,
    fecha_entrega TIMESTAMP,
    customer_code VARCHAR(50),
    route_code VARCHAR(50),
    seller_code VARCHAR(50),
    total DECIMAL(18,2),
    subtotal DECIMAL(18,2),
    iva DECIMAL(18,2),
    discount DECIMAL(18,2),
    parent_id VARCHAR(50),
    auth_code VARCHAR(200),
    access_key VARCHAR(200),
    latitude DECIMAL(12,8),
    longitude DECIMAL(12,8),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_factura_route
    ON facturas(route_code);

CREATE INDEX IF NOT EXISTS idx_factura_customer
    ON facturas(customer_code);

CREATE INDEX IF NOT EXISTS idx_factura_parent
    ON facturas(parent_id);

CREATE INDEX IF NOT EXISTS idx_factura_seller
    ON facturas(seller_code);

-------------------------------------------------
-- 6. Tabla: detalle_documento
-------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_documento (
    id_detalle SERIAL PRIMARY KEY,
    documento_code VARCHAR(50),
    codigo_producto VARCHAR(100),
    descripcion VARCHAR(300),
    cantidad DECIMAL(18,2),
    precio DECIMAL(18,2),
    subtotal DECIMAL(18,2),
    total DECIMAL(18,2),
    iva DECIMAL(18,2),
    unit_alias VARCHAR(100),
    barcode VARCHAR(100),
    codigo_categoria VARCHAR(10),
    descripcion_categoria VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_doc_code
    ON detalle_documento(documento_code);

CREATE INDEX IF NOT EXISTS idx_doc_producto
    ON detalle_documento(codigo_producto);

-------------------------------------------------
-- 7. Tabla metas_preventas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_preventas (
    id_meta SERIAL PRIMARY KEY,
    codigo_ruta VARCHAR(50),
    anio INT,
    mes INT,
    meta_unidades INT,
    meta_dolares DECIMAL(18,2),
    UNIQUE (codigo_ruta, anio, mes)
);

-------------------------------------------------
-- 8. Tabla sincronizaciones_ventas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS sincronizaciones_ventas (
    id_sync SERIAL PRIMARY KEY,
    fecha_sync TIMESTAMP DEFAULT NOW(),
    desde_date DATE,
    hasta_date DATE,
    total_registros INT,
    estado VARCHAR(20),
    mensaje TEXT
);
