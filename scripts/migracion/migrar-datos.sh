#!/usr/bin/env bash
# Exporta los datos del Supabase en la nube (esquema public) con pg_dump y
# los importa al esquema trivia del Supabase self-hosted.
#
# Uso:
#   ORIGEN_DB_URL='postgresql://...nube...' \
#   DESTINO_DB_URL='postgresql://...vm...' \
#   scripts/migracion/migrar-datos.sh [--con-perfiles]
#
# - Por defecto migra categorías y preguntas.
# - --con-perfiles además migra perfiles, admins y mejores puntajes, pero
#   solo de usuarios que ya existan en el auth.users del destino.
# - El destino ya debe tener aplicado supabase/schema.sql.
# - Todo el import corre en una transacción: si algo falla, no se escribe nada.
# - pg_dump y psql corren en un contenedor postgres:17-alpine (solo hace falta Docker).
#
# Variables opcionales:
#   PG_IMAGEN   imagen con pg_dump/psql (por defecto postgres:17-alpine)
#   DOCKER_RED  red del contenedor (por defecto host, para llegar a localhost de la VM)

set -euo pipefail

CON_PERFILES=false
for argumento in "$@"; do
  case "$argumento" in
    --con-perfiles) CON_PERFILES=true ;;
    *) echo "Argumento desconocido: $argumento" >&2; exit 2 ;;
  esac
done

: "${ORIGEN_DB_URL:?Defina ORIGEN_DB_URL (conexión al Postgres de Supabase en la nube)}"
: "${DESTINO_DB_URL:?Defina DESTINO_DB_URL (conexión al Postgres del Supabase self-hosted)}"
PG_IMAGEN="${PG_IMAGEN:-postgres:17-alpine}"
DOCKER_RED="${DOCKER_RED:-host}"

DIRECTORIO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT

# Corre pg_dump/psql dentro de un contenedor efímero.
pg() {
  MSYS_NO_PATHCONV=1 docker run --rm -i --network "$DOCKER_RED" -e PGCONNECT_TIMEOUT=15 "$PG_IMAGEN" "$@"
}

TABLAS=(categorias preguntas)
if [ "$CON_PERFILES" = true ]; then
  TABLAS+=(perfiles mejores_puntajes)
fi

ARGUMENTOS_TABLAS=()
for tabla in "${TABLAS[@]}"; do
  ARGUMENTOS_TABLAS+=("--table=public.$tabla")
done

echo "==> Exportando de la nube: ${TABLAS[*]}"
pg pg_dump "$ORIGEN_DB_URL" --data-only --no-owner --no-privileges "${ARGUMENTOS_TABLAS[@]}" \
  > "$TEMPORAL/datos.sql"

# Los COPY apuntan a public.<tabla>: se redirigen al esquema temporal.
sed -E 's/^COPY public\./COPY trivia_importacion./' "$TEMPORAL/datos.sql" > "$TEMPORAL/datos_importacion.sql"

if grep -qE '^COPY public\.' "$TEMPORAL/datos_importacion.sql"; then
  echo "El volcado tiene COPY a public sin redirigir; se cancela." >&2
  exit 1
fi

{
  cat "$DIRECTORIO_SCRIPT/preparar.sql"
  cat "$TEMPORAL/datos_importacion.sql"
  # pg_dump vacía el search_path; se restaura para los pasos siguientes.
  echo "select pg_catalog.set_config('search_path', 'public', false);"
  cat "$DIRECTORIO_SCRIPT/fusionar.sql"
  if [ "$CON_PERFILES" = true ]; then
    cat "$DIRECTORIO_SCRIPT/fusionar-perfiles.sql"
  fi
  echo "drop schema trivia_importacion cascade;"
} > "$TEMPORAL/importar.sql"

echo "==> Importando al esquema trivia del destino (una sola transacción)"
pg psql "$DESTINO_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f - < "$TEMPORAL/importar.sql"

echo "==> Listo. Revise las preguntas en /admin/preguntas y el ranking en /ranking."
