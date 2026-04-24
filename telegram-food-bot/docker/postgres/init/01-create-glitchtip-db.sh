#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GLITCHTIP_DB:-}" ]]; then
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$GLITCHTIP_DB') THEN
    CREATE DATABASE "$GLITCHTIP_DB";
  END IF;
END
$$;
EOSQL
