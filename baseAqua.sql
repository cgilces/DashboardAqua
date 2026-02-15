

-------------------------------------------------
-- 3. Tabla: clientes
-------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
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
    ON clientes(ruta_asignada);

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






-------------------------------------------------
-- 9. Tabla: clientes_usuarios_ventas
-- Relación N a N entre clientes y vendedores
-------------------------------------------------
select * from clientes_usuarios_ventas;
select * from clientes cv ;

CREATE TABLE IF NOT EXISTS clientes_usuarios_ventas (
    id_relacion SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) NOT NULL,
    seller_code VARCHAR(50) NOT NULL,
    ruta_code VARCHAR(50),
    tipo_atencion VARCHAR(20), -- PREVENTA / TELEVENTA / VIP
    ultima_atencion TIMESTAMP,

    UNIQUE (codigo_cliente, seller_code)
);

CREATE INDEX IF NOT EXISTS idx_cuv_cliente
    ON clientes_usuarios_ventas(codigo_cliente);

CREATE INDEX IF NOT EXISTS idx_cuv_seller
    ON clientes_usuarios_ventas(seller_code);

CREATE INDEX IF NOT EXISTS idx_cuv_ruta
    ON clientes_usuarios_ventas(ruta_code);








-- =================================================
-- CONFIGURACIÓN DE ZONA HORARIA (RECOMENDADO)
-- =================================================
SET TIME ZONE 'America/Guayaquil';

-- =================================================
-- FUNCIÓN GENÉRICA PARA updated_at
-- =================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =================================================
-- TABLA: rutas_preventas
-- =================================================
CREATE TABLE rutas (
    codigo_ruta VARCHAR(255) PRIMARY KEY NOT NULL,  -- Código único para la ruta
    descripcion VARCHAR(255),                      -- Descripción de la ruta
    tipo VARCHAR(50) NOT NULL,                     -- Tipo de ruta (PREVENTA, TELEVENTA, etc.)
    status VARCHAR(255),
    c INT,                                         -- Creado por (usuario)
    u INT,                                         -- Actualizado por (usuario)
    c_by VARCHAR(15),                                      -- ID del creador
    u_by VARCHAR(15),                                       -- ID de quien actualiza
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Fecha de creación
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Fecha de actualización
);
-- Crear función para el trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que ejecutará la función en cada UPDATE
CREATE TRIGGER update_rutas_updated_at
  BEFORE UPDATE ON rutas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- =================================================
-- TABLA: route_details (planificación de rutas)
-- =================================================


CREATE TABLE route_details (
    id SERIAL PRIMARY KEY,                          -- Identificador único para cada detalle de ruta
    codigo_ruta VARCHAR(255) NOT NULL,               -- Código de la ruta
    codigo_cliente VARCHAR(255) NOT NULL,            -- Código del cliente
    descripcion VARCHAR(255),                        -- Descripción del detalle
    codigo_direccion VARCHAR(255),                   -- Código de dirección del cliente
    semana INT NOT NULL,                             -- Semana de la ruta
    dia INT NOT NULL,                                -- Día de la semana
    secuencia INT DEFAULT 0,                         -- Secuencia de la ruta
    status VARCHAR(50),                              -- Estado de la ruta (0, 1, etc.)
    c INT,                                           -- Creado por (usuario)
    u INT,                                           -- Actualizado por (usuario)
    c_by VARCHAR(15),                                      -- ID del creador
    u_by VARCHAR(15),                                          -- ID de quien actualiza
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Fecha de creación
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Fecha de actualización
    route_code_lookup VARCHAR(255),                  -- Descripción de la ruta (lookup)
    customer_code_lookup VARCHAR(255),               -- Descripción del cliente (lookup)
    customer_address_code_lookup VARCHAR(255),       -- Descripción de la dirección (lookup)
    CONSTRAINT fk_ruta FOREIGN KEY (codigo_ruta) REFERENCES rutas(codigo_ruta),  -- Relación con la tabla rutas
    UNIQUE (codigo_ruta, codigo_cliente, semana, dia)  -- Clave única compuesta
);
-- Crear función para el trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que ejecutará la función en cada UPDATE
CREATE TRIGGER update_route_details_updated_at
  BEFORE UPDATE ON route_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- =================================================
-- ÍNDICES PARA PERFORMANCE
-- =================================================
CREATE INDEX IF NOT EXISTS idx_route_details_ruta
  ON route_details(codigo_ruta);

CREATE INDEX IF NOT EXISTS idx_route_details_cliente
  ON route_details(codigo_cliente);

CREATE INDEX IF NOT EXISTS idx_route_details_semana_dia
  ON route_details(semana, dia);

-- Trigger updated_at route_details
DROP TRIGGER IF EXISTS trg_route_details_updated ON route_details;
CREATE TRIGGER trg_route_details_updated
BEFORE UPDATE ON route_details
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =================================================
-- FIN DEL SCRIPT
-- =================================================
