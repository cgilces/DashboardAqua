#!/bin/bash
# backend/sql/postgres-init/01_mcp_roles_y_pg_hba.sh
#
# Solo corre en la inicialización de un volumen NUEVO/VACÍO de Postgres —
# la imagen oficial ejecuta docker-entrypoint-initdb.d/* ÚNICAMENTE cuando
# PGDATA está vacío (primer arranque real, ej. disaster recovery), nunca en
# un restart/recreate normal contra un volumen ya inicializado. Por eso es
# seguro dejarlo montado siempre.
#
# Motivo (incidente 2026-09-17, ver TODO.md): los roles mcp_readonly/
# mcp_oauth y la regla de pg_hba.conf que necesitan vivían SOLO en la
# producción viva, provisionados a mano, sin ningún rastro en git — cuando
# Postgres se reinició, pg_hba.conf no tenía regla para esos roles y el MCP
# completo (ventas + OAuth) quedó caído hasta que se corrigió a mano. Este
# script reproduce exactamente ese estado (roles, GRANTs, esquema mcp_oauth,
# reglas de pg_hba) para que un volumen nuevo (disaster recovery real) quede
# funcional desde el primer arranque, sin depender de memoria humana.
#
# Contraseñas SIEMPRE desde variables de entorno — nunca hardcodeadas acá ni
# en git (ver .env en la raíz del repo, gitignored, + docker-compose.yml).
set -euo pipefail

: "${MCP_READONLY_DB_PASS:?falta MCP_READONLY_DB_PASS (ver .env en la raíz del repo)}"
: "${MCP_OAUTH_DB_PASS:?falta MCP_OAUTH_DB_PASS (ver .env en la raíz del repo)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=readonly_pass="$MCP_READONLY_DB_PASS" \
  --set=oauth_pass="$MCP_OAUTH_DB_PASS" <<-'EOSQL'

-- ============================================================
-- mcp_readonly — rol de solo lectura del servidor MCP (mcp-server/.env,
-- MCP_DB_USER). Solo el ROL se crea acá — el GRANT sobre las tablas de
-- ventas (clientes/ordenes/facturas/...) NO puede ir en este script: acá
-- corre en un volumen recién inicializado, ANTES de que el backend haya
-- creado esas tablas (backend/sql/000_schema.sql, al arrancar
-- dashboard_backend) — un GRANT sobre una tabla que no existe todavía
-- falla. Ver el bloque `DO $$ ... GRANT ...` al final de 000_schema.sql,
-- que sí puede otorgarlo porque ahí las tablas ya existen. Confirmado
-- probando este script contra un volumen vacío real (ver TODO.md,
-- 2026-09-17): sin este split, "GRANT SELECT ON clientes" falla con
-- "relation clientes does not exist".
-- ============================================================
CREATE ROLE mcp_readonly WITH LOGIN PASSWORD :'readonly_pass';

-- ============================================================
-- mcp_oauth — estado persistente de OAuth del servidor MCP
-- (mcp-server/src/auth/oauthDb.js + store.js). Esquema propio, SIN ningún
-- acceso a las tablas de ventas de arriba (dos roles, dos superficies de
-- riesgo separadas — ver comentario de oauthDb.js). DDL y GRANTs
-- reconstruidos a partir del esquema REAL en producción el 2026-09-17.
-- ============================================================
CREATE ROLE mcp_oauth WITH LOGIN PASSWORD :'oauth_pass';

CREATE SCHEMA mcp_oauth;
GRANT USAGE ON SCHEMA mcp_oauth TO mcp_oauth;

CREATE TABLE mcp_oauth.clients (
  client_id  text PRIMARY KEY,
  data       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mcp_oauth.refresh_tokens (
  token_hash text PRIMARY KEY,
  client_id  text NOT NULL,
  email      text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mcp_oauth.login_events (
  id         bigserial PRIMARY KEY,
  email      text,
  hd         text,
  allowed    boolean NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  mcp_oauth.clients,
  mcp_oauth.refresh_tokens,
  mcp_oauth.login_events
TO mcp_oauth;

GRANT USAGE ON SEQUENCE mcp_oauth.login_events_id_seq TO mcp_oauth;

EOSQL

# ============================================================
# pg_hba.conf — reglas que faltaban (incidente 2026-09-17): sin esto, ningún
# cliente puede conectar como mcp_readonly/mcp_oauth desde otro contenedor
# de la red Docker (aqua-network), aunque el rol/password sean correctos.
# Mismo patrón/alcance (172.18.0.0/16) que la regla ya existente del rol
# `postgres` para esta misma red.
# ============================================================
{
  echo "host    ${POSTGRES_DB}    mcp_readonly    172.18.0.0/16    scram-sha-256"
  echo "host    ${POSTGRES_DB}    mcp_oauth       172.18.0.0/16    scram-sha-256"
} >> "$PGDATA/pg_hba.conf"
