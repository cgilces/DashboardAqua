-- ====================================================================
-- AJUSTE DE COLUMNA: sincronizaciones_ventas.mensaje
--
-- ⚙ AUTO-EJECUCIÓN: este archivo se ejecuta automáticamente en cada
-- arranque del backend (ver utils/runStartupSql.js). Es idempotente:
-- ALTER COLUMN TYPE TEXT se puede aplicar repetidamente sin error.
--
-- Motivo: el modelo Sequelize SincronizacionVenta define `mensaje` como
-- TEXT, pero la columna real en BD era VARCHAR(100). Los mensajes de
-- sincronización (resumen de Pedidos/Facturas/POS/Clientes/etc. y los
-- errores) superan los 100 caracteres y rompían con:
--   "value too long for type character varying(100)"
-- ====================================================================

ALTER TABLE sincronizaciones_ventas
  ALTER COLUMN mensaje TYPE TEXT;
