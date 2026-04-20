-- =========================================================================
-- ESTRUCTURA DE BASE DE DATOS — DASHBOARD AQUA
-- Versión: 2026-04-18
-- Motor: PostgreSQL 12+
-- -------------------------------------------------------------------------
-- Este archivo es IDEMPOTENTE: puede ejecutarse cuantas veces sea necesario
-- en el mismo entorno sin producir errores. Está diseñado para:
--   • Crear cualquier tabla / índice / constraint / trigger faltante.
--   • Añadir columnas nuevas a tablas existentes sin romper datos.
--   • Reemplazar funciones / vistas sin pérdida de dependencias.
-- -------------------------------------------------------------------------
-- Las tablas están sincronizadas con los modelos Sequelize ubicados en:
--   backend/models/
-- Cualquier campo añadido en los modelos debe reflejarse aquí antes del
-- despliegue a producción.
-- =========================================================================


-- =========================================================================
-- SECCIÓN 1 — USUARIOS DE LA APLICACIÓN (app_users)
-- Modelo: backend/models/AppUser.js
-- Usuarios internos que acceden al dashboard (roles: ADMIN, VENDEDOR,
-- DESPACHADOR, SUPERVISOR). Las rutas asignadas se guardan como array.
-- =========================================================================
CREATE TABLE IF NOT EXISTS app_users (
    id              SERIAL PRIMARY KEY,
    usuario         TEXT UNIQUE NOT NULL,
    clave           TEXT NOT NULL,
    rol             TEXT NOT NULL CHECK (rol IN ('ADMIN', 'VENDEDOR', 'DESPACHADOR', 'SUPERVISOR')),
    rutas_asignadas TEXT[] DEFAULT '{}',
    token_version   INTEGER DEFAULT 0,
    creado_en       TIMESTAMP DEFAULT NOW(),
    actualizado_en  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS token_version   INTEGER DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS rutas_asignadas TEXT[] DEFAULT '{}';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS creado_en       TIMESTAMP DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_app_users_rol ON app_users(rol);


-- =========================================================================
-- SECCIÓN 2 — TIPOS DE NEGOCIO (tipos_negocio)
-- Modelo: backend/models/tipos_negocio.js
-- Catálogo maestro de clasificación comercial (TIENDAS, MAYORISTA, VIP,
-- RURAL, EMPRESAS, etc.). Referenciado por clientes, ordenes y facturas.
-- =========================================================================
CREATE TABLE IF NOT EXISTS tipos_negocio (
    id                   SERIAL PRIMARY KEY,
    codigo               VARCHAR(50) UNIQUE NOT NULL,
    descripcion          VARCHAR(150) NOT NULL,
    color                VARCHAR(20),
    estado               INT DEFAULT 1,
    fecha_creacion       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tipos_negocio ADD COLUMN IF NOT EXISTS color               VARCHAR(20);
ALTER TABLE tipos_negocio ADD COLUMN IF NOT EXISTS estado              INT DEFAULT 1;
ALTER TABLE tipos_negocio ADD COLUMN IF NOT EXISTS fecha_creacion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tipos_negocio ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tipos_negocio_codigo ON tipos_negocio(codigo);


-- =========================================================================
-- SECCIÓN 3 — SUBCANALES (subcanales)
-- Modelo: backend/models/Subcanal.js
-- Subclasificación dentro de un tipo de negocio (ej. TIENDAS → BARRIO,
-- MINIMARKET, etc.). Permite análisis más granular del canal comercial.
-- =========================================================================
CREATE TABLE IF NOT EXISTS subcanales (
    id_subcanal          SERIAL PRIMARY KEY,
    codigo_subcanal      VARCHAR(50) UNIQUE NOT NULL,
    descripcion_subcanal VARCHAR(255),
    codigo_tipo_negocio  VARCHAR(50),
    estado               INTEGER DEFAULT 1,
    fecha_creacion       TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE subcanales ADD COLUMN IF NOT EXISTS codigo_tipo_negocio VARCHAR(50);
ALTER TABLE subcanales ADD COLUMN IF NOT EXISTS estado              INTEGER DEFAULT 1;
ALTER TABLE subcanales ADD COLUMN IF NOT EXISTS fecha_creacion      TIMESTAMP DEFAULT NOW();
ALTER TABLE subcanales ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subcanales_codigo        ON subcanales(codigo_subcanal);
CREATE INDEX IF NOT EXISTS idx_subcanales_tipo_negocio  ON subcanales(codigo_tipo_negocio);

-- Trigger idempotente: actualiza fecha_actualizacion en cada UPDATE
CREATE OR REPLACE FUNCTION update_subcanales_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_subcanales ON subcanales;
CREATE TRIGGER trg_update_subcanales
BEFORE UPDATE ON subcanales
FOR EACH ROW
EXECUTE FUNCTION update_subcanales_timestamp();


-- =========================================================================
-- SECCIÓN 4 — PRODUCTOS (productos)
-- Modelo: backend/models/Producto.js
-- Catálogo maestro de productos (botellones, hielo, etc.). La PK es
-- codigo_producto (string) para mantener compatibilidad con MobilVendor.
-- =========================================================================
CREATE TABLE IF NOT EXISTS productos (
    codigo_producto          VARCHAR(50) PRIMARY KEY,
    nombre_producto          VARCHAR(255) NOT NULL,
    nombre_producto_completo TEXT,
    nombre_alterno           VARCHAR(150),
    descripcion_venta        TEXT,
    codigo_barras            VARCHAR(100),
    codigo_marca             VARCHAR(50),
    codigo_categoria         VARCHAR(50),
    codigo_subcategoria      VARCHAR(50),
    codigo_familia           VARCHAR(50),
    codigo_unidad_medida     VARCHAR(50),
    unidad_medida            VARCHAR(50),
    unidad_medida_compra     VARCHAR(50),
    codigo_tipo_inventario   VARCHAR(50),
    costo                    NUMERIC(12,2),
    ultimo_costo             NUMERIC(12,2),
    precio                   DECIMAL(12,2),
    peso                     DECIMAL(10,3) DEFAULT 0,
    volumen                  DECIMAL(10,3) DEFAULT 0,
    estado                   INTEGER,
    activo                   BOOLEAN DEFAULT TRUE,
    tipo_producto            VARCHAR(50),
    origen_sistema           VARCHAR(50),
    mobilvendor_id           VARCHAR(100)
);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS nombre_producto_completo TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion_venta        TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad_medida            VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad_medida_compra     VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio                   DECIMAL(12,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS peso                     DECIMAL(10,3) DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS volumen                  DECIMAL(10,3) DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo                   BOOLEAN DEFAULT TRUE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_producto            VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS origen_sistema           VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS mobilvendor_id           VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(codigo_categoria);
CREATE INDEX IF NOT EXISTS idx_productos_marca     ON productos(codigo_marca);
CREATE INDEX IF NOT EXISTS idx_productos_estado    ON productos(estado);


-- =========================================================================
-- SECCIÓN 5 — CLIENTES (clientes)
-- Modelo: backend/models/clientes.js
-- Maestro de clientes unificado (Odoo + MobilVendor). La PK codigo_cliente
-- se mantiene como string para interoperabilidad multi-sistema.
-- =========================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente                       SERIAL PRIMARY KEY,
    codigo_cliente                   VARCHAR(255) UNIQUE,

    -- Identificación corporativa
    company_id                       VARCHAR(20),
    descripcion_company              VARCHAR(200),

    -- Identificación fiscal
    tipo_identificacion_cliente      VARCHAR(50),
    identificacion_cliente           VARCHAR(30),

    -- Datos comerciales
    nombre_cliente                   VARCHAR(255),
    nombre_comercial_cliente         VARCHAR(255),
    contacto_cliente                 VARCHAR(255),

    -- Clasificación comercial
    codigo_tipo_negocio              VARCHAR(50),
    codigo_subcanal                  VARCHAR(50),

    -- Configuración financiera
    codigo_moneda_cliente            VARCHAR(3) DEFAULT 'USD',
    codigo_lista_precio_cliente      VARCHAR(50),
    metodo_pago_cliente              VARCHAR(50),
    condicion_pago_cliente           VARCHAR(100),
    codigo_grupo_cliente             VARCHAR(100),
    descuento_cliente                DECIMAL(10,2) DEFAULT 0.00,
    objetivo_venta_cliente           DECIMAL(10,2),
    saldo_cliente                    DECIMAL(10,2) DEFAULT 0.00,
    tiene_credito_cliente            BOOLEAN DEFAULT FALSE,
    tiene_documentos_cliente         BOOLEAN DEFAULT TRUE,

    -- Estados
    estado                           VARCHAR(25),
    estado_cliente                   INT DEFAULT 0,
    estado_proceso_cliente           INT DEFAULT 0,

    -- Ubicación
    nacionalidad_cliente             VARCHAR(100),
    codigo_usuario_asignado_cliente  VARCHAR(50),
    email_cliente                    VARCHAR(500),
    telefono_cliente                 VARCHAR(100),
    direccion_cliente                TEXT,
    ciudad_cliente                   VARCHAR(150),
    pais_cliente                     VARCHAR(150),
    industria_cliente                VARCHAR(150),

    -- Correo comercial alternativo
    correo_cliente                   VARCHAR(255),

    -- Geolocalización (antes TEXT; migrado a DECIMAL para cálculos espaciales)
    latitud_cliente                  DECIMAL(12,8),
    longitud_cliente                 DECIMAL(12,8),

    -- Relación comercial
    frecuencia_cliente               VARCHAR(100),
    vendedor_asignado_cliente        VARCHAR(100),
    comentario_cliente               TEXT,

    -- Integraciones externas
    id_odoo                          INTEGER,
    fecha_envio_odoo                 TIMESTAMP,
    mobilvendor_id_cliente           VARCHAR(100),

    -- Auditoría
    fecha_creacion_cliente           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion_cliente      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Añadir columnas faltantes si la tabla ya existía
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_subcanal                 VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS correo_cliente                  VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS descripcion_company             VARCHAR(200);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS id_odoo                         INTEGER;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_envio_odoo                TIMESTAMP;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mobilvendor_id_cliente          VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS frecuencia_cliente              VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vendedor_asignado_cliente       VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS comentario_cliente              TEXT;

-- FK: clientes → tipos_negocio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_clientes_tipo_negocio'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT fk_clientes_tipo_negocio
      FOREIGN KEY (codigo_tipo_negocio)
      REFERENCES tipos_negocio(codigo)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: clientes → subcanales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_clientes_subcanal'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT fk_clientes_subcanal
      FOREIGN KEY (codigo_subcanal)
      REFERENCES subcanales(codigo_subcanal)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_cliente           ON clientes(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion_cliente   ON clientes(identificacion_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_estado_cliente           ON clientes(estado_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_estado_proceso_cliente   ON clientes(estado_proceso_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_usuario_asignado  ON clientes(codigo_usuario_asignado_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_tipo_negocio      ON clientes(codigo_tipo_negocio);
CREATE INDEX IF NOT EXISTS idx_clientes_subcanal                 ON clientes(codigo_subcanal);

-- Trigger idempotente para fecha_actualizacion_cliente
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


-- =========================================================================
-- SECCIÓN 6 — DIRECCIONES DE CLIENTES (direcciones_clientes)
-- Modelo: backend/models/DireccionCliente.js
-- Un cliente puede tener múltiples direcciones de entrega. La combinación
-- (codigo_cliente, codigo_direccion_cliente) debe ser única.
-- =========================================================================
CREATE TABLE IF NOT EXISTS direcciones_clientes (
    id_direccion_cliente                   SERIAL PRIMARY KEY,
    codigo_cliente                         VARCHAR(255) NOT NULL,
    descripcion_direccion_cliente          VARCHAR(255),
    codigo_direccion_cliente               VARCHAR(255),
    calle1_direccion_cliente               VARCHAR(255),
    bloque_direccion_cliente               VARCHAR(255),
    calle2_direccion_cliente               VARCHAR(255),
    referencia_direccion_cliente           VARCHAR(255),
    codigo_postal_direccion_cliente        VARCHAR(50),
    telefono_direccion_cliente             VARCHAR(50),
    fax_direccion_cliente                  VARCHAR(50),
    email_direccion_cliente                VARCHAR(100),
    latitud_direccion_cliente              DECIMAL(15,8),
    longitud_direccion_cliente             DECIMAL(15,8),
    fecha_ultima_visita_direccion_cliente  TIMESTAMP,
    estado_direccion_cliente               INT DEFAULT 1,
    estado_ubicacion_direccion_cliente     INT DEFAULT 3,
    fecha_creacion_direccion_cliente       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion_direccion_cliente  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FK: direcciones_clientes → clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_direcciones_clientes'
  ) THEN
    ALTER TABLE direcciones_clientes
      ADD CONSTRAINT fk_direcciones_clientes
      FOREIGN KEY (codigo_cliente)
      REFERENCES clientes(codigo_cliente)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Unique compuesto cliente + codigo_direccion (evita duplicados lógicos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_cliente_direccion'
  ) THEN
    ALTER TABLE direcciones_clientes
      ADD CONSTRAINT unique_cliente_direccion
      UNIQUE (codigo_cliente, codigo_direccion_cliente);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_codigo_cliente ON direcciones_clientes(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_direcciones_cliente_estado_fecha
    ON direcciones_clientes(codigo_cliente, estado_direccion_cliente, fecha_actualizacion_direccion_cliente);

-- Trigger idempotente para fecha_actualizacion_direccion_cliente
CREATE OR REPLACE FUNCTION update_direccion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion_direccion_cliente = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_direccion_timestamp ON direcciones_clientes;
CREATE TRIGGER update_direccion_timestamp
BEFORE UPDATE ON direcciones_clientes
FOR EACH ROW
EXECUTE FUNCTION update_direccion_timestamp();


-- =========================================================================
-- SECCIÓN 7 — RELACIÓN CLIENTE ↔ VENDEDOR (clientes_usuarios_ventas)
-- Modelo: backend/models/ClienteUsuarioVenta.js
-- Tabla de asignación N a N. Un cliente puede ser atendido por múltiples
-- vendedores (PREVENTA, TELEVENTA, VIP). Cada fila representa el vínculo
-- cliente + dirección + vendedor.
-- =========================================================================
CREATE TABLE IF NOT EXISTS clientes_usuarios_ventas (
    id_relacion              SERIAL PRIMARY KEY,
    codigo_cliente           VARCHAR(50) NOT NULL,
    codigo_direccion_cliente TEXT NOT NULL DEFAULT 'DEFAULT',
    seller_code              VARCHAR(50) NOT NULL,
    ruta_code                VARCHAR(50),
    tipo_atencion            VARCHAR(20),
    ultima_atencion          TIMESTAMP
);

ALTER TABLE clientes_usuarios_ventas ADD COLUMN IF NOT EXISTS ruta_code                VARCHAR(50);
ALTER TABLE clientes_usuarios_ventas ADD COLUMN IF NOT EXISTS tipo_atencion            VARCHAR(20);
ALTER TABLE clientes_usuarios_ventas ADD COLUMN IF NOT EXISTS ultima_atencion          TIMESTAMP;
ALTER TABLE clientes_usuarios_ventas ADD COLUMN IF NOT EXISTS codigo_direccion_cliente TEXT NOT NULL DEFAULT 'DEFAULT';

-- Unique: cliente + vendedor + dirección (evita duplicar asignaciones)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_cliente_seller_direccion'
  ) THEN
    ALTER TABLE clientes_usuarios_ventas
      ADD CONSTRAINT uq_cliente_seller_direccion
      UNIQUE (codigo_cliente, seller_code, codigo_direccion_cliente);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuv_cliente ON clientes_usuarios_ventas(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_cuv_seller  ON clientes_usuarios_ventas(seller_code);
CREATE INDEX IF NOT EXISTS idx_cuv_ruta    ON clientes_usuarios_ventas(ruta_code);


-- =========================================================================
-- SECCIÓN 8 — ÓRDENES DE VENTA (ordenes)
-- Modelo: backend/models/orden.js
-- Órdenes provenientes de Odoo y MobilVendor. Incluye la orden completa
-- con clasificación, estado, montos, logística y rentabilidad. Es el
-- núcleo del dashboard comercial.
-- =========================================================================
CREATE TABLE IF NOT EXISTS ordenes (
    id_orden              SERIAL PRIMARY KEY,
    code                  VARCHAR(50) NOT NULL UNIQUE,
    type                  INT,
    status                INT,

    -- Clasificación comercial
    codigo_tipo_negocio   VARCHAR(50),
    codigo_subcanal       VARCHAR(50),

    -- Fechas operativas
    fecha_creacion        TIMESTAMP,
    fecha_entrega         TIMESTAMP,
    fecha_validez         TIMESTAMP,
    fecha_compromiso      TIMESTAMP,

    -- Cliente
    customer_code         VARCHAR(50),
    customer_nombre       VARCHAR(255),
    customer_address_code VARCHAR(100),

    -- Comercial
    route_code            VARCHAR(50),
    seller_code           VARCHAR(50),
    seller_nombre         VARCHAR(255),
    equipo_ventas         VARCHAR(100),
    equipo_ventas_id      INTEGER,
    equipo_ventas_nombre  VARCHAR(255),
    campania_id           INT,
    descripcion_company   VARCHAR(60),
    medio_id              INT,
    fuente_id             INT,

    -- Estados de flujo Odoo
    estado_odoo           VARCHAR(50),
    estado_facturacion    VARCHAR(50),
    estado_entrega        VARCHAR(50),

    -- Monetario
    moneda                VARCHAR(10),
    tasa_cambio           DECIMAL(18,6),
    subtotal              DECIMAL(18,2),
    iva                   DECIMAL(18,2),
    discount              DECIMAL(18,2),
    total                 DECIMAL(18,2),
    monto_no_pagado       DECIMAL(18,2),
    costo_envio           DECIMAL(18,2),

    -- Rentabilidad
    margen                DECIMAL(12,2) DEFAULT 0,
    margen_porcentaje     DECIMAL(6,2) DEFAULT 0,

    -- Pago
    payment_term_id       INTEGER,
    payment_term_nombre   VARCHAR(255),

    -- Logística
    almacen_id            INT,
    almacen_nombre        VARCHAR(255),
    transportista_id      INT,
    transportista_nombre  VARCHAR(255),
    peso_total            DECIMAL(10,3) DEFAULT 0,
    politica_entrega      VARCHAR(50),

    -- Trazabilidad
    parent_id             VARCHAR(50),
    source_document       VARCHAR(255),
    latitude              DECIMAL(12,8),
    longitude             DECIMAL(12,8),
    concept_code          VARCHAR(50),
    concept_origin        VARCHAR(50),
    sequence_type         VARCHAR(10),
    etiquetas             TEXT,
    notes                 TEXT,

    -- Integraciones
    origen_sistema        VARCHAR(20),
    mobilvendor_id        VARCHAR(100)
);

-- Sincronización con modelo Sequelize (añade campos nuevos si faltan)
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS codigo_tipo_negocio   VARCHAR(50);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS codigo_subcanal       VARCHAR(50);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS equipo_ventas         VARCHAR(100);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS equipo_ventas_id      INTEGER;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS equipo_ventas_nombre  VARCHAR(255);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS campania_id           INT;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS descripcion_company   VARCHAR(60);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS medio_id              INT;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fuente_id             INT;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS margen                DECIMAL(12,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS margen_porcentaje     DECIMAL(6,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS payment_term_id       INTEGER;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS payment_term_nombre   VARCHAR(255);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS almacen_nombre        VARCHAR(255);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS transportista_nombre  VARCHAR(255);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS peso_total            DECIMAL(10,3) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS source_document       VARCHAR(255);
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS etiquetas             TEXT;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mobilvendor_id        VARCHAR(100);

-- FK: ordenes → tipos_negocio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ordenes_tipo_negocio'
  ) THEN
    ALTER TABLE ordenes
      ADD CONSTRAINT fk_ordenes_tipo_negocio
      FOREIGN KEY (codigo_tipo_negocio)
      REFERENCES tipos_negocio(codigo)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: ordenes → subcanales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ordenes_subcanal'
  ) THEN
    ALTER TABLE ordenes
      ADD CONSTRAINT fk_ordenes_subcanal
      FOREIGN KEY (codigo_subcanal)
      REFERENCES subcanales(codigo_subcanal)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Índices críticos para consultas del dashboard
CREATE INDEX IF NOT EXISTS idx_orden_route            ON ordenes(route_code);
CREATE INDEX IF NOT EXISTS idx_orden_customer         ON ordenes(customer_code);
CREATE INDEX IF NOT EXISTS idx_orden_seller           ON ordenes(seller_code);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_creacion ON ordenes(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_ordenes_seller_nombre  ON ordenes(seller_nombre);
CREATE INDEX IF NOT EXISTS idx_ordenes_status         ON ordenes(status);
CREATE INDEX IF NOT EXISTS idx_ordenes_type           ON ordenes(type);
CREATE INDEX IF NOT EXISTS idx_ordenes_subcanal       ON ordenes(codigo_subcanal);
CREATE INDEX IF NOT EXISTS idx_ordenes_tipo_negocio   ON ordenes(codigo_tipo_negocio);


-- =========================================================================
-- SECCIÓN 9 — FACTURAS (facturas)
-- Modelo: backend/models/factura.js
-- Documentos fiscales emitidos. Incluye notas de crédito y reversos.
-- Es la fuente oficial de dólares facturados. PK: code (string único).
-- =========================================================================
CREATE TABLE IF NOT EXISTS facturas (
    id_factura             SERIAL PRIMARY KEY,
    code                   VARCHAR(30) NOT NULL UNIQUE,

    -- Tipo y estado
    type                   INT,
    status                 INT,

    -- Fechas fiscales
    fecha_creacion         TIMESTAMP,
    fecha_autorizacion     TIMESTAMP,
    fecha_entrega          TIMESTAMP,
    fecha_vencimiento      TIMESTAMP,

    -- Cliente
    customer_code          VARCHAR(30),
    customer_address_code  VARCHAR(30),

    -- Clasificación comercial
    codigo_tipo_negocio    VARCHAR(50),
    codigo_subcanal        VARCHAR(50),

    -- Comercial / logística
    route_code             VARCHAR(50),
    seller_code            VARCHAR(50),

    -- Monetario
    total                  DECIMAL(18,2),
    subtotal               DECIMAL(18,2),
    iva                    DECIMAL(18,2),
    discount               DECIMAL(18,2),
    saldo_pendiente        DECIMAL(18,2),

    -- Estado de pago y tipo
    estado_pago            VARCHAR(20),
    tipo_documento         VARCHAR(20),
    moneda                 VARCHAR(10),

    -- Autorización fiscal (Ecuador)
    auth_code              VARCHAR(200),
    access_key             VARCHAR(200),

    -- Geolocalización
    latitude               DECIMAL(12,8),
    longitude              DECIMAL(12,8),

    -- Trazabilidad
    parent_id              VARCHAR(50),
    company_id             INT,
    reversed_entry_id      INT,
    origen_sistema         VARCHAR(15),
    notes                  TEXT
);

-- Sincronización con modelo Sequelize (añade campos nuevos si faltan)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS codigo_tipo_negocio VARCHAR(50);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS codigo_subcanal     VARCHAR(50);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS estado_pago         VARCHAR(20);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS saldo_pendiente     DECIMAL(18,2);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_vencimiento   TIMESTAMP;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tipo_documento      VARCHAR(20);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS moneda              VARCHAR(10);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS company_id          INT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS reversed_entry_id   INT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS origen_sistema      VARCHAR(15);

-- FK: facturas → tipos_negocio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_tipo_negocio'
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT fk_facturas_tipo_negocio
      FOREIGN KEY (codigo_tipo_negocio)
      REFERENCES tipos_negocio(codigo)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: facturas → subcanales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_subcanal'
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT fk_facturas_subcanal
      FOREIGN KEY (codigo_subcanal)
      REFERENCES subcanales(codigo_subcanal)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Índices críticos
CREATE INDEX IF NOT EXISTS idx_factura_route           ON facturas(route_code);
CREATE INDEX IF NOT EXISTS idx_factura_customer        ON facturas(customer_code);
CREATE INDEX IF NOT EXISTS idx_factura_parent          ON facturas(parent_id);
CREATE INDEX IF NOT EXISTS idx_factura_seller          ON facturas(seller_code);
CREATE INDEX IF NOT EXISTS idx_facturas_customer_fecha ON facturas(customer_code, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha          ON facturas(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_facturas_customer_code  ON facturas(customer_code);
CREATE INDEX IF NOT EXISTS idx_facturas_subcanal       ON facturas(codigo_subcanal);
CREATE INDEX IF NOT EXISTS idx_facturas_tipo_negocio   ON facturas(codigo_tipo_negocio);


-- =========================================================================
-- SECCIÓN 10 — DETALLE DE DOCUMENTOS (detalle_documento)
-- Modelo: backend/models/detalleDocumento.js
-- Líneas de detalle de órdenes y facturas. El campo documento_code
-- referencia tanto a ordenes.code como a facturas.code. Se desnormalizan
-- campos (producto_nombre, producto_categoria) para evitar JOINs en el
-- dashboard.
-- =========================================================================
CREATE TABLE IF NOT EXISTS detalle_documento (
    id_detalle                  SERIAL PRIMARY KEY,

    documento_code              VARCHAR(50),

    -- Producto
    codigo_producto             VARCHAR(100),
    producto_codigo_interno     VARCHAR(100),
    descripcion                 VARCHAR(300),
    producto_nombre             VARCHAR(255),
    producto_categoria          VARCHAR(255),

    -- Cantidades
    cantidad                    DECIMAL(18,2),
    cantidad_entregada          DECIMAL(18,2),
    cantidad_facturada          DECIMAL(18,2),
    cantidad_pendiente_entregar DECIMAL(18,2),
    cantidad_pendiente_facturar DECIMAL(18,2),

    -- Precios
    precio                      DECIMAL(18,2),
    descuento_linea             DECIMAL(18,2),
    subtotal                    DECIMAL(18,2),
    total                       DECIMAL(18,2),
    iva                         DECIMAL(18,2),
    precio_con_impuesto         DECIMAL(18,2),
    precio_sin_impuesto         DECIMAL(18,2),
    impuesto_linea              DECIMAL(18,2),

    -- Rentabilidad
    margen_linea                DECIMAL(12,2) DEFAULT 0,
    margen_porcentaje_linea     DECIMAL(6,2) DEFAULT 0,

    -- Clasificación
    unit_alias                  VARCHAR(100),
    unidad_medida               VARCHAR(50),
    barcode                     VARCHAR(100),
    codigo_categoria            VARCHAR(10),
    descripcion_categoria       VARCHAR(100),

    -- Estados
    estado_facturacion_linea    VARCHAR(50),
    estado_odoo_linea           VARCHAR(50),

    -- Orden y flags
    secuencia                   INTEGER DEFAULT 0,
    es_anticipo                 BOOLEAN DEFAULT FALSE,
    es_envio                    BOOLEAN DEFAULT FALSE
);

ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS producto_nombre          VARCHAR(255);
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS producto_categoria       VARCHAR(255);
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS producto_codigo_interno  VARCHAR(100);
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS margen_linea             DECIMAL(12,2) DEFAULT 0;
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS margen_porcentaje_linea  DECIMAL(6,2) DEFAULT 0;
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS unidad_medida            VARCHAR(50);
ALTER TABLE detalle_documento ADD COLUMN IF NOT EXISTS secuencia                INTEGER DEFAULT 0;

-- Unique: evita duplicar la misma línea en un mismo documento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_detalle_doc'
  ) THEN
    ALTER TABLE detalle_documento
      ADD CONSTRAINT unique_detalle_doc
      UNIQUE (documento_code, codigo_producto, precio, cantidad);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doc_code              ON detalle_documento(documento_code);
CREATE INDEX IF NOT EXISTS idx_doc_producto          ON detalle_documento(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_detalle_documento_doc ON detalle_documento(documento_code);


-- =========================================================================
-- SECCIÓN 11 — RUTAS (rutas)
-- Modelo: backend/models/Ruta.js
-- Catálogo de rutas de distribución (A01, E01, U01, etc.). La PK lógica
-- es `codigo` aunque existe `id` SERIAL adicional.
-- =========================================================================
CREATE TABLE IF NOT EXISTS rutas (
    id                   SERIAL PRIMARY KEY,
    codigo               VARCHAR(100) NOT NULL,
    descripcion          VARCHAR(255),
    codigo_cliente       VARCHAR(30),
    codigo_direccion     VARCHAR(40),
    tipo                 INT,
    estado               INT,
    creado_por           INT,
    actualizado_por      INT,
    creado_por_id        VARCHAR(255),
    actualizado_por_id   VARCHAR(255),
    fecha_creacion       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS rutas_codigo_unique ON rutas(codigo);


-- =========================================================================
-- SECCIÓN 12 — DETALLE DE RUTAS (detalles_rutas)
-- Modelo: backend/models/DetalleRuta.js
-- Define la agenda semanal de visitas por ruta (cliente + dirección
-- + día + secuencia). Permite construir el plan de ruta para cada
-- vendedor.
-- =========================================================================
CREATE TABLE IF NOT EXISTS detalles_rutas (
    id                       SERIAL PRIMARY KEY,
    codigo                   VARCHAR(100) NOT NULL,
    codigo_ruta              VARCHAR(100),
    route_code               VARCHAR(100),
    codigo_cliente           VARCHAR(100),
    customer_code            VARCHAR(255),
    codigo_direccion_cliente VARCHAR(100),
    semana                   INT,
    dia                      INT,
    secuencia                INT,
    estado                   INT,
    datos                    JSONB,
    creado_por               INT,
    actualizado_por          INT,
    creado_por_id            VARCHAR(255),
    actualizado_por_id       VARCHAR(255),
    fecha_creacion           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ruta_codigo_lookup       VARCHAR(255),
    cliente_codigo_lookup    VARCHAR(255),
    direccion_codigo_lookup  VARCHAR(255)
);

ALTER TABLE detalles_rutas ADD COLUMN IF NOT EXISTS customer_code VARCHAR(255);
ALTER TABLE detalles_rutas ADD COLUMN IF NOT EXISTS route_code    VARCHAR(100);

-- Unique: evita duplicar un mismo código de detalle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_codigo'
  ) THEN
    ALTER TABLE detalles_rutas
      ADD CONSTRAINT unique_codigo UNIQUE (codigo);
  END IF;
END $$;


-- =========================================================================
-- SECCIÓN 13 — HISTORIAL DE VISITAS (historial_visitas)
-- Modelo: backend/models/HistorialVisitas.js
-- Registro cronológico de visitas realizadas por vendedores a clientes.
-- Sirve para trazabilidad de gestión comercial y análisis de adherencia
-- a ruta.
-- =========================================================================
CREATE TABLE IF NOT EXISTS historial_visitas (
    id                              SERIAL PRIMARY KEY,
    fecha_visita                    TIMESTAMP,
    codigo_usuario                  VARCHAR(50),
    codigo_ruta                     VARCHAR(50),
    codigo_cliente                  VARCHAR(50),
    codigo_direccion_cliente        VARCHAR(50),
    semana                          INT,
    dia                             INT,
    accion                          VARCHAR(50),
    codigo_comentario               VARCHAR(50),
    comentario                      TEXT,
    monto                           DECIMAL(18,2),
    latitud                         DECIMAL(12,8),
    longitud                        DECIMAL(12,8),
    estado_proceso                  INT,
    ruptura_secuencia               INT,

    -- Datos desnormalizados del cliente (snapshot en el momento de la visita)
    nombre_cliente                  VARCHAR(250),
    nombre_empresa_cliente          VARCHAR(250),
    nombre_comercial_cliente        VARCHAR(250),
    tipo_identificacion_cliente     VARCHAR(10),
    numero_identificacion_cliente   VARCHAR(20),
    contacto_cliente                VARCHAR(50),
    comentario_cliente              TEXT,
    estado_cliente                  INT,

    -- Datos desnormalizados del usuario / vendedor
    nombre_usuario                  VARCHAR(250),
    email_usuario                   VARCHAR(100),
    email_notificacion_usuario      VARCHAR(100),
    identidad_usuario               VARCHAR(50),
    tipo_identificacion_usuario     VARCHAR(10),
    sucursal_usuario                VARCHAR(100),
    telefono_usuario                VARCHAR(50),
    direccion_usuario               VARCHAR(500),
    marca_dispositivo_usuario       VARCHAR(100),
    modelo_dispositivo_usuario      VARCHAR(100),
    numero_dispositivo_usuario      VARCHAR(100),
    codigo_almacen_usuario          VARCHAR(50),
    codigo_ruta_predeterminada_usuario VARCHAR(50),
    codigo_rol_usuario              VARCHAR(50)
);

-- Unique: una visita por combinación cliente + ruta + fecha
CREATE UNIQUE INDEX IF NOT EXISTS idx_historial_visitas_unique
    ON historial_visitas(codigo_cliente, codigo_ruta, fecha_visita);

CREATE INDEX IF NOT EXISTS idx_historial_visitas_codigo_usuario
    ON historial_visitas(codigo_usuario);

CREATE INDEX IF NOT EXISTS idx_historial_visitas_accion
    ON historial_visitas(accion);


-- =========================================================================
-- SECCIÓN 14 — METAS DE PREVENTA (metas_preventas)
-- Modelo: backend/models/metaPreventa.js
-- Metas mensuales por ruta para preventistas. Una meta única por
-- (codigo_ruta, anio, mes). Usa `seccion` para agrupar por tipo (PREVENTA,
-- TELEVENTA, VIP, etc.).
-- =========================================================================
CREATE TABLE IF NOT EXISTS metas_preventas (
    id_meta        SERIAL PRIMARY KEY,
    codigo_ruta    VARCHAR(50) NOT NULL,
    anio           INT NOT NULL,
    mes            INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    meta_unidades  INT NOT NULL DEFAULT 0,
    meta_dolares   FLOAT NOT NULL DEFAULT 0,
    seccion        VARCHAR(50) DEFAULT 'PREVENTA'
);

ALTER TABLE metas_preventas ADD COLUMN IF NOT EXISTS seccion VARCHAR(50) DEFAULT 'PREVENTA';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_codigo_ruta_anio_mes'
  ) THEN
    ALTER TABLE metas_preventas
      ADD CONSTRAINT unique_codigo_ruta_anio_mes
      UNIQUE (codigo_ruta, anio, mes);
  END IF;
END $$;


-- =========================================================================
-- SECCIÓN 15 — METAS DE BOTELLONES (metas_botellones)
-- Modelo: backend/models/metaBotellon.js
-- Metas mensuales específicas por canal botellón. Permite definir metas
-- separadas para TELEVENTA_VIP, TIENDAS, MAYORISTA, RURAL, etc. dentro
-- de la misma ruta.
-- =========================================================================
CREATE TABLE IF NOT EXISTS metas_botellones (
    id_meta        SERIAL PRIMARY KEY,
    codigo_ruta    VARCHAR(50) NOT NULL,
    seccion        VARCHAR(30) NOT NULL,
    anio           INT NOT NULL,
    mes            INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    meta_unidades  INT NOT NULL DEFAULT 0,
    meta_dolares   FLOAT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_metas_botellones'
  ) THEN
    ALTER TABLE metas_botellones
      ADD CONSTRAINT uq_metas_botellones
      UNIQUE (codigo_ruta, seccion, anio, mes);
  END IF;
END $$;


-- =========================================================================
-- SECCIÓN 16 — AJUSTE MENSUAL COTTSA (cottsa_extra_mes)
-- Modelo: backend/models/CottsaExtraMes.js
-- Registro de ventas adicionales manuales que deben sumarse al total
-- del mes (normalmente ventas a empresas externas procesadas fuera del
-- flujo estándar). Una fila por (anio, mes).
-- =========================================================================
CREATE TABLE IF NOT EXISTS cottsa_extra_mes (
    id               SERIAL PRIMARY KEY,
    anio             INT NOT NULL,
    mes              INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    unidades         FLOAT NOT NULL DEFAULT 0,
    dolares          FLOAT NOT NULL DEFAULT 0,
    facturas         INT NOT NULL DEFAULT 0,
    actualizado_por  VARCHAR(100),
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_cottsa_extra_mes'
  ) THEN
    ALTER TABLE cottsa_extra_mes
      ADD CONSTRAINT uq_cottsa_extra_mes
      UNIQUE (anio, mes);
  END IF;
END $$;


-- =========================================================================
-- SECCIÓN 17 — SINCRONIZACIONES DE VENTAS (sincronizaciones_ventas)
-- Modelo: backend/models/SincronizacionVenta.js
-- Bitácora de ejecuciones del proceso de sincronización Odoo → DB local.
-- Cada fila representa una corrida con su rango de fechas y resultado.
-- =========================================================================
CREATE TABLE IF NOT EXISTS sincronizaciones_ventas (
    id_sync         SERIAL PRIMARY KEY,
    fecha_sync      TIMESTAMP DEFAULT NOW(),
    desde_date      DATE,
    hasta_date      DATE,
    total_registros INT,
    estado          VARCHAR(20),
    mensaje         TEXT
);

ALTER TABLE sincronizaciones_ventas ALTER COLUMN mensaje TYPE TEXT;


-- =========================================================================
-- SECCIÓN 18 — TIPOS DE DOCUMENTO LATAM (tipo_documento_latam)
-- Modelo: backend/models/TipoDocumentoLatam.js
-- Catálogo de tipos de documento fiscal para la región (facturas, notas
-- de crédito, liquidaciones, etc.). Importado desde Odoo.
-- =========================================================================
CREATE TABLE IF NOT EXISTS tipo_documento_latam (
    id                          SERIAL PRIMARY KEY,
    secuencia                   VARCHAR(255),
    id_pais                     INT,
    usuario_creacion            INT,
    usuario_actualizacion       INT,
    nombre                      VARCHAR(255) NOT NULL,
    prefijo_codigo_documento    VARCHAR(10),
    codigo                      VARCHAR(10),
    nombre_reporte              VARCHAR(255),
    tipo_interno                VARCHAR(50),
    activo                      BOOLEAN DEFAULT TRUE,
    fecha_creacion              TIMESTAMP,
    fecha_actualizacion         TIMESTAMP,
    verificar_formato_ecuador   BOOLEAN
);


-- =========================================================================
-- SECCIÓN 19 — RELACIÓN CLIENTE ↔ CATEGORÍA (clientes_categoria_relacion)
-- Tabla puente N a N entre clientes y categorías comerciales ad-hoc.
-- Permite tagging flexible de clientes sin alterar el maestro.
-- =========================================================================
CREATE TABLE IF NOT EXISTS clientes_categoria_relacion (
    categoria_id INTEGER NOT NULL,
    cliente_id   INTEGER NOT NULL,
    PRIMARY KEY (categoria_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_ccr_cliente   ON clientes_categoria_relacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ccr_categoria ON clientes_categoria_relacion(categoria_id);


-- =========================================================================
-- SECCIÓN 20 — VISTA ANALÍTICA DE CLIENTES (vw_clientes_analisis)
-- Vista calculada para el dashboard de clientes. Combina:
--   • Dirección principal (más reciente activa)
--   • Totales de facturación (facturas, dólares, unidades)
--   • Clasificación de estado (ACTIVO / RIESGO / INACTIVO / SIN COMPRAS)
--   • Ticket promedio y días sin comprar
-- IMPORTANTE: reconstruir con CREATE OR REPLACE cada vez que cambie el
-- esquema de facturas o clientes.
-- =========================================================================
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
  c.codigo_usuario_asignado_cliente AS seller_code,
  COALESCE(tn.descripcion, 'SIN CLASIFICAR') AS tipo_negocio,
  c.tiene_credito_cliente,
  CASE
    WHEN c.tiene_credito_cliente THEN 'CREDITO'
    ELSE 'CONTADO'
  END AS tipo_pago,
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
LEFT JOIN direccion_principal dp ON dp.codigo_cliente = c.codigo_cliente
LEFT JOIN tipos_negocio     tn   ON tn.codigo         = c.codigo_tipo_negocio
LEFT JOIN facturas_cliente  fc   ON fc.codigo_cliente = c.codigo_cliente
LEFT JOIN unidades_cliente  uc   ON uc.codigo_cliente = c.codigo_cliente;


-- =========================================================================
-- FIN DEL ARCHIVO
-- Para añadir una nueva tabla: crea una nueva sección siguiendo el patrón
-- (CREATE TABLE IF NOT EXISTS → ALTER TABLE ADD COLUMN IF NOT EXISTS →
-- constraints dentro de DO blocks → índices → triggers idempotentes).
-- =========================================================================
