------------------------------------------------------------
-- TABLA: app_users
-- Tu SQL estaba incorrecto, ahora coincide CON TU MODELO Sequelize
-- Modelo usado: AppUser.js
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id SERIAL PRIMARY KEY,
    usuario TEXT UNIQUE NOT NULL,
    clave TEXT NOT NULL,
    rol TEXT CHECK (rol IN ('ADMIN', 'VENDEDOR', 'DESPACHADOR')) NOT NULL,
    rutas_asignadas TEXT[],
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_users_rol
    ON app_users(rol);


    
CREATE TABLE productos (
    codigo_producto VARCHAR(50) PRIMARY KEY,
    nombre_producto VARCHAR(255) NOT NULL,
    nombre_alterno VARCHAR(150),
    codigo_barras VARCHAR(100),
    codigo_marca VARCHAR(50),
    codigo_categoria VARCHAR(50),
    codigo_subcategoria VARCHAR(50),
    codigo_familia VARCHAR(50),
    codigo_unidad_medida VARCHAR(50),
    codigo_tipo_inventario VARCHAR(50),
    costo NUMERIC(12,2),
    ultimo_costo NUMERIC(12,2),
    estado INTEGER, -- 1 = Activo, 0 = Inactivo
    tipo_producto INTEGER

);

CREATE INDEX idx_productos_categoria ON productos(codigo_categoria);
CREATE INDEX idx_productos_marca ON productos(codigo_marca);
CREATE INDEX idx_productos_estado ON productos(estado);


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
  codigo_cliente VARCHAR(255) UNIQUE NOT NULL,
  tipo_identificacion_cliente VARCHAR(50),
  identificacion_cliente VARCHAR(20) NOT NULL,
  nombre_cliente VARCHAR(255),
  nombre_comercial_cliente VARCHAR(255),

  -- NUEVO CAMPO
  codigo_tipo_negocio VARCHAR(50),

  contacto_cliente VARCHAR(255),
  codigo_moneda_cliente VARCHAR(3) DEFAULT 'USD',
  codigo_lista_precio_cliente VARCHAR(50),
  metodo_pago_cliente VARCHAR(50),
  codigo_grupo_cliente VARCHAR(50),
  descuento_cliente DECIMAL(10, 2) DEFAULT 0.00,
  objetivo_venta_cliente DECIMAL(10, 2),
  saldo_cliente DECIMAL(10, 2) DEFAULT 0.00,
  tiene_credito_cliente BOOLEAN DEFAULT FALSE,
  tiene_documentos_cliente BOOLEAN DEFAULT TRUE,
  estado_cliente INT DEFAULT 0,
  estado_proceso_cliente INT DEFAULT 0,
  nacionalidad_cliente VARCHAR(50),
  codigo_usuario_asignado_cliente VARCHAR(20),
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
-- VERIFICACIÓN
------------------------------------------------------------
SELECT * FROM clientes;


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
  codigo_postal_direccion_cliente VARCHAR(20),
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
    codigo_direccion_cliente VARCHAR(100);
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


-------------------------------------------------
--  Tabla: ordenes
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
--  Tabla: facturas
-------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    type INT,
    status INT,
    fecha_creacion TIMESTAMP,
    fecha_autorizacion TIMESTAMP,
    fecha_entrega TIMESTAMP,
    customer_code VARCHAR(30),
    customer_address_code VARCHAR(30),
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




------------------------------------------------
-- Detalle de documentos (ordenes y facturas)
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


delete from rutas;
delete from detalles_rutas ;
select * from detalles_rutas dr where dr.codigo = '1-182323-1-2' ;

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



ALTER TABLE clientes_usuarios_ventas ADD COLUMN codigo_direccion_cliente VARCHAR(100);



