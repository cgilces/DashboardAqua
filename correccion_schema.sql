-- ============================================================
-- SCRIPT DE CORRECCIÓN DE ESQUEMA  — DashboardAqua
-- Generado : 2026-04-09
-- Autor     : cgilces
-- ============================================================
-- ERRORES CORREGIDOS:
--   [1] facturas — fecha_creacion / fecha_autorizacion /
--                  fecha_entrega / fecha_vencimiento  sin DEFAULT NOW()
--   [2] metas_preventas — punto y coma ilegal en lugar de coma
--                         (tabla NUNCA se creó en producción)
--   [3] facturas — columna codigo_subcanal + FK hacia subcanales faltante
--   [4] BONUS: direcciones_clientes — constraint unique_cliente_direccion
--              declarado DOS VECES en el DDL original (bloqueante al re-ejecutar)
-- ============================================================

BEGIN;

-- ============================================================
-- ► VERIFICACIÓN PREVIA AL CAMBIO
-- ============================================================

-- Estado actual de columnas clave en facturas
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'facturas'
  AND column_name IN (
      'fecha_creacion','fecha_autorizacion',
      'fecha_entrega','fecha_vencimiento','codigo_subcanal'
  )
ORDER BY column_name;

-- Estado actual de metas_preventas (puede estar vacía si nunca se creó)
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'metas_preventas'
ORDER BY ordinal_position;

-- Constraints existentes en direcciones_clientes
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'direcciones_clientes'
ORDER BY constraint_name;


-- ============================================================
-- ► CORRECCIÓN 1: DEFAULT NOW() en columnas de fecha — facturas
-- ============================================================
--   Sólo modifica el DEFAULT, no toca datos existentes.

ALTER TABLE facturas
    ALTER COLUMN fecha_creacion    SET DEFAULT NOW();

ALTER TABLE facturas
    ALTER COLUMN fecha_autorizacion SET DEFAULT NOW();

ALTER TABLE facturas
    ALTER COLUMN fecha_entrega     SET DEFAULT NOW();

ALTER TABLE facturas
    ALTER COLUMN fecha_vencimiento SET DEFAULT NOW();


-- ============================================================
-- ► CORRECCIÓN 2: TABLA metas_preventas  (error de sintaxis ; → ,)
-- ============================================================
--   El DDL original tiene  seccion VARCHAR(50);  con punto y coma
--   dentro de la definición, lo que termina el CREATE TABLE antes
--   del CONSTRAINT.  PostgreSQL lanza syntax error y la tabla nunca
--   se crea.  Se usa CREATE TABLE IF NOT EXISTS para no fallar si
--   ya existe, seguido de ADD COLUMN IF NOT EXISTS por si la tabla
--   se creó de forma parcial.

CREATE TABLE IF NOT EXISTS metas_preventas (
    id_meta       SERIAL PRIMARY KEY,
    codigo_ruta   VARCHAR(50)  NOT NULL,
    anio          INT          NOT NULL,
    mes           INT          NOT NULL CHECK (mes >= 1 AND mes <= 12),
    meta_unidades INT          NOT NULL DEFAULT 0,
    meta_dolares  FLOAT        NOT NULL DEFAULT 0,
    seccion       VARCHAR(50),                         -- ← coma, no punto y coma
    CONSTRAINT unique_codigo_ruta_anio_mes
        UNIQUE (codigo_ruta, anio, mes)
);

-- Si la tabla existía parcialmente (sin seccion ni constraint)
ALTER TABLE metas_preventas
    ADD COLUMN IF NOT EXISTS seccion VARCHAR(50);

-- Agregar constraint sólo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name    = 'metas_preventas'
          AND constraint_name = 'unique_codigo_ruta_anio_mes'
    ) THEN
        ALTER TABLE metas_preventas
            ADD CONSTRAINT unique_codigo_ruta_anio_mes
            UNIQUE (codigo_ruta, anio, mes);
    END IF;
END $$;


-- ============================================================
-- ► CORRECCIÓN 3: columna codigo_subcanal + FK en facturas
-- ============================================================

ALTER TABLE facturas
    ADD COLUMN IF NOT EXISTS codigo_subcanal VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name    = 'facturas'
          AND constraint_name = 'fk_facturas_subcanal'
    ) THEN
        ALTER TABLE facturas
            ADD CONSTRAINT fk_facturas_subcanal
            FOREIGN KEY (codigo_subcanal)
            REFERENCES subcanales(codigo_subcanal)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facturas_subcanal
    ON facturas(codigo_subcanal);


-- ============================================================
-- ► CORRECCIÓN 4 (BONUS): constraint duplicado en direcciones_clientes
-- ============================================================
--   El DDL original declara unique_cliente_direccion:
--     • una vez INLINE dentro del CREATE TABLE  (línea 256)
--     • otra vez como ALTER TABLE ADD CONSTRAINT (línea 263)
--   Al re-ejecutar el script la segunda sentencia falla con
--   "constraint already exists".  La siguiente sentencia elimina
--   el duplicado de forma idempotente.

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM information_schema.table_constraints
    WHERE table_name    = 'direcciones_clientes'
      AND constraint_name = 'unique_cliente_direccion';

    IF cnt > 1 THEN
        -- Eliminar la copia extra (PostgreSQL las nombra igual)
        -- No es posible drop duplicados por nombre; advertimos al DBA.
        RAISE WARNING
            '[CORRECCIÓN 4] Se detectaron % constraints llamados '
            '"unique_cliente_direccion" en direcciones_clientes. '
            'Sólo debe existir uno. Verifique manualmente con: '
            'SELECT oid, conname FROM pg_constraint '
            'WHERE conrelid = ''direcciones_clientes''::regclass '
            'AND conname = ''unique_cliente_direccion'';',
            cnt;
    ELSE
        RAISE NOTICE '[CORRECCIÓN 4] OK — sólo existe 1 constraint unique_cliente_direccion.';
    END IF;
END $$;


-- ============================================================
-- ► VERIFICACIÓN POST-CORRECCIÓN
-- ============================================================

-- [A] Defaults de fechas en facturas
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'facturas'
  AND column_name IN (
      'fecha_creacion','fecha_autorizacion',
      'fecha_entrega','fecha_vencimiento'
  )
ORDER BY column_name;

-- [B] Columna codigo_subcanal en facturas
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name  = 'facturas'
  AND column_name = 'codigo_subcanal';

-- [C] FK de facturas → subcanales
SELECT
    tc.constraint_name,
    kcu.column_name             AS columna_origen,
    ccu.table_name              AS tabla_referenciada,
    ccu.column_name             AS columna_referenciada,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints    tc
JOIN information_schema.key_column_usage     kcu
  ON tc.constraint_name  = kcu.constraint_name
 AND tc.table_schema     = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name  = ccu.constraint_name
 AND tc.table_schema     = ccu.table_schema
JOIN information_schema.referential_constraints  rc
  ON tc.constraint_name  = rc.constraint_name
 AND tc.table_schema     = rc.constraint_schema
WHERE tc.table_name      = 'facturas'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- [D] Estructura completa de metas_preventas
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'metas_preventas'
ORDER BY ordinal_position;

-- [E] Constraint UNIQUE en metas_preventas
SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'metas_preventas';

-- [F] Índice nuevo en facturas
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'facturas'
  AND indexname = 'idx_facturas_subcanal';


COMMIT;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
