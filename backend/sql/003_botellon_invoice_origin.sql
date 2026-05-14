-- ====================================================================
-- BOTELLÓN — Soporte para clasificación del código 29 (LÍQUIDO/ENVASE)
--
-- ⚙ AUTO-EJECUCIÓN: este archivo se ejecuta automáticamente en cada
-- arranque del backend (ver utils/runStartupSql.js). Idempotente.
--
-- Motivo: el filtro tipoProducto del dashboard de botellón clasifica las
-- líneas del producto código 29 (BOTELLÓN 20L AQUA PREMIUM) según si su
-- factura tiene una NotCr con DISC asociada. El matching NC↔Factura se
-- hace por `invoice_origin`. Hasta este cambio la columna no se
-- persistía (solo se traía temporal de Odoo para resolver equipo_ventas).
--
-- Esta migración:
--   1. Asegura que existan las columnas necesarias en `facturas`.
--   2. Amplía invoice_origin a TEXT (Odoo a veces concatena varias
--      referencias y supera 255 chars → causaba error de sincronización).
--   3. Crea índices para que el EXISTS del filtro sea rápido.
-- ====================================================================

-- ── Columnas de facturas (idempotente) ─────────────────────────────────
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS odoo_id          INTEGER;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tipo_movimiento  VARCHAR(20);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS invoice_origin   TEXT;

-- ── Si invoice_origin ya existía como VARCHAR(n), ampliarla a TEXT ─────
ALTER TABLE facturas ALTER COLUMN invoice_origin TYPE TEXT;

-- ── Índices para acelerar el matching NC ↔ factura origen ──────────────
CREATE INDEX IF NOT EXISTS idx_facturas_invoice_origin
  ON facturas(invoice_origin)
  WHERE invoice_origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_reversed_entry
  ON facturas(reversed_entry_id)
  WHERE reversed_entry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_odoo_id
  ON facturas(odoo_id)
  WHERE odoo_id IS NOT NULL;

-- ── Índice parcial para localizar líneas DISC rápidamente ──────────────
CREATE INDEX IF NOT EXISTS idx_dd_codigo_interno_disc
  ON detalle_documento(producto_codigo_interno)
  WHERE producto_codigo_interno = 'DISC';
