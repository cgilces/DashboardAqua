-- ====================================================================
-- ÍNDICES PARA EL DASHBOARD DE CLIENTES
--
-- ⚙ AUTO-EJECUCIÓN: este archivo se ejecuta automáticamente en cada
-- arranque del backend (ver utils/runStartupSql.js). No requiere
-- ejecución manual. Es idempotente (CREATE INDEX IF NOT EXISTS).
--
-- Aceleran:
--   - Filtros por status + fecha en facturas
--   - Lookups de facturas por cliente
--   - JOINs con detalle_documento
--   - Filtros por ruta (codigo_usuario_asignado_cliente)
--   - Búsqueda por RUC
--   - Lookups de direcciones para el mapa
--   - Historial de contactos por cliente
-- ====================================================================

-- Acelera filtros por status + fecha en facturas (todos los endpoints lo usan)
CREATE INDEX IF NOT EXISTS idx_facturas_status_fecha
  ON facturas (status, fecha_creacion DESC)
  WHERE status IN (0,2,3,4,5);

-- Acelera lookup de facturas por cliente
CREATE INDEX IF NOT EXISTS idx_facturas_customer_fecha
  ON facturas (customer_code, fecha_creacion DESC)
  WHERE status IN (0,2,3,4,5);

-- Acelera join con detalle_documento
CREATE INDEX IF NOT EXISTS idx_detalle_documento_code
  ON detalle_documento (documento_code);

-- Acelera filtros por ruta (codigo_usuario_asignado_cliente)
CREATE INDEX IF NOT EXISTS idx_clientes_ruta
  ON clientes (UPPER(codigo_usuario_asignado_cliente))
  WHERE codigo_usuario_asignado_cliente IS NOT NULL;

-- Acelera búsqueda por RUC/identificación
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion
  ON clientes (identificacion_cliente)
  WHERE identificacion_cliente IS NOT NULL AND TRIM(identificacion_cliente) <> '';

-- Acelera lookup en direcciones_clientes (para mapa)
CREATE INDEX IF NOT EXISTS idx_direcciones_clientes_codigo
  ON direcciones_clientes (codigo_cliente);

-- Acelera consulta de contactos_recuperacion por cliente y fecha
CREATE INDEX IF NOT EXISTS idx_contactos_group_fecha
  ON contactos_recuperacion (group_key, fecha_contacto DESC);

-- Estadísticas para que el planner tome buenas decisiones
ANALYZE clientes;
ANALYZE facturas;
ANALYZE detalle_documento;
ANALYZE direcciones_clientes;
ANALYZE contactos_recuperacion;
