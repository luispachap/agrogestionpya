#!/bin/sh
# RESTAURAR UN RESPALDO EN OTRO PROYECTO, y comprobar que quedó igual. Sirve para dos cosas:
#   · el ENSAYO: restaurar en un proyecto aislado y demostrar que el respaldo sirve;
#   · la RECUPERACIÓN de verdad, si el proyecto de producción se pierde.
# NUNCA restaura sobre producción ni sobre una base que ya tenga tablas: se niega.
#   DESTINO_BASE_URL        cadena de conexión del proyecto NUEVO Y VACÍO (la del «Session pooler»)
#   DESTINO_PROYECTO_URL    https://<proyecto-nuevo>.supabase.co
#   DESTINO_LLAVE_SERVICIO  llave secreta del proyecto nuevo
#   CLAVE_RESPALDO          la misma frase con que se cifró
# Uso: sh restaurar.sh <carpeta-de-respaldos> [AAAA-MM-DD]     (sin fecha: el más reciente)
set -eu
AQUI=$(cd "$(dirname "$0")" && pwd)
SALE=${1:?Falta la carpeta donde están los respaldos}
: "${DESTINO_BASE_URL:?Falta DESTINO_BASE_URL}" "${DESTINO_PROYECTO_URL:?Falta DESTINO_PROYECTO_URL}" "${DESTINO_LLAVE_SERVICIO:?Falta DESTINO_LLAVE_SERVICIO}" "${CLAVE_RESPALDO:?Falta CLAVE_RESPALDO}"
PRODUCCION=${PRODUCCION:-cidgbfddrzoilvkqhszg}
INFORME=${GITHUB_STEP_SUMMARY:-/dev/stdout}

case "$DESTINO_BASE_URL$DESTINO_PROYECTO_URL" in *"$PRODUCCION"*) echo "El destino es PRODUCCIÓN. Esto no restaura sobre producción."; exit 2 ;; esac
[ -z "${BASE_URL:-}" ] || [ "$BASE_URL" != "$DESTINO_BASE_URL" ] || { echo "El destino es la misma base de donde sale el respaldo."; exit 2; }

DIA=${2:-$(ls "$SALE/base" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.gpg$' | sort | tail -1 | cut -c1-10)}
[ -f "$SALE/base/$DIA.tar.gz.gpg" ] || { echo "No hay respaldo del día «$DIA»."; exit 2; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/copia"
callado() {
  if ! "$@" > "$TMP/salida.txt" 2>&1; then
    sed -E 's#[a-zA-Z]+://[^ ]+#(dirección oculta)#g; s#(password|clave)[=:][^ ]+#\1=(oculta)#gi' "$TMP/salida.txt" | tail -30
    return 1
  fi
}

echo "1/6 · Revisando que el destino esté vacío…"
callado psql "$DESTINO_BASE_URL" -X -v ON_ERROR_STOP=1 -Atq -o "$TMP/hay.txt" -c \
  "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'"
[ "$(cat "$TMP/hay.txt")" = "0" ] || { echo "El destino ya tiene $(cat "$TMP/hay.txt") tablas. Sólo se restaura en un proyecto recién creado y vacío."; exit 2; }

echo "2/6 · Abriendo el respaldo del $DIA…"
printf '%s' "$CLAVE_RESPALDO" > "$TMP/clave"; chmod 600 "$TMP/clave"
gpg --batch --quiet --yes --pinentry-mode loopback --passphrase-file "$TMP/clave" --decrypt "$SALE/base/$DIA.tar.gz.gpg" | tar -xzf - -C "$TMP/copia" \
  || { echo "No se pudo abrir: la clave no es la misma con que se guardó."; exit 1; }

[ -s "$TMP/copia/privilegios.sql" ] || { echo "Este respaldo no trae sus permisos (es de antes del 22 nov). No se restaura a medias."; exit 1; }
echo "3/6 · Restaurando cuentas, reglas y datos…"
# Igual que lo indica Supabase: todo o nada, y con los candados dormidos mientras entran los datos tal como estaban
# (así nada se vuelve a sellar ni a firmar: lo restaurado conserva quién lo hizo, quién lo autorizó y cuándo).
callado psql --single-transaction --variable ON_ERROR_STOP=1 -X \
  --file "$TMP/copia/roles.sql" --file "$TMP/copia/schema.sql" \
  --command 'SET session_replication_role = replica' --file "$TMP/copia/data.sql" \
  --command 'SET session_replication_role = origin' --file "$TMP/copia/privilegios.sql" \
  --dbname "$DESTINO_BASE_URL"

echo "4/6 · Subiendo las fotos y documentos…"
export PROYECTO_URL="$DESTINO_PROYECTO_URL" LLAVE_SERVICIO="$DESTINO_LLAVE_SERVICIO"
SUBIDA=$(node "$AQUI/archivos.mjs" subir "$SALE/archivos") || { echo "No subieron todos los archivos: $SUBIDA"; exit 1; }
REVISION=$(node "$AQUI/archivos.mjs" comprobar "$SALE/archivos") || { echo "Hay archivos que no quedaron iguales: $REVISION"; exit 1; }

echo "5/6 · Comparando la copia contra el original…"
callado psql "$DESTINO_BASE_URL" -X -v ON_ERROR_STOP=1 -AtqF '|' -f "$AQUI/huellas.sql" -o "$TMP/huellas-copia.txt"
# El renglón del almacén se compara por nombres; su contenido ya se comparó archivo por archivo en el paso 4.
if diff "$TMP/copia/huellas.txt" "$TMP/huellas-copia.txt" > "$TMP/diferencias.txt"; then IGUAL=si; else IGUAL=no; fi
TOTAL=$(wc -l < "$TMP/copia/huellas.txt")
DISTINTAS=$(grep -c '^[<>]' "$TMP/diferencias.txt" || true)

echo "6/6 · Empujando la puerta de la copia (intentos no autorizados)…"
if psql "$DESTINO_BASE_URL" -X -v ON_ERROR_STOP=1 -q -f "$AQUI/ataques.sql" > "$TMP/ataques.txt" 2>&1 && grep -q 'INTENTOS_RECHAZADOS' "$TMP/ataques.txt"; then
  ATAQUES="todos rechazados ($(grep -o 'INTENTOS_RECHAZADOS [0-9]*' "$TMP/ataques.txt" | cut -d' ' -f2) intentos)"; CERRADA=si
else
  ATAQUES="ALGO PASÓ: $(grep -o 'LA COPIA DEJA PASAR.*' "$TMP/ataques.txt" | head -1)"; CERRADA=no
fi

{
  echo "# Restauración del respaldo del $DIA"
  echo
  echo "| Qué se comprobó | Resultado |"
  echo "|---|---|"
  echo "| Estructura (reglas, funciones, tablas, permisos, operaciones sensibles, puertas, candados) y datos de cada tabla | $([ "$IGUAL" = si ] && echo "IGUAL en las $TOTAL comparaciones" || echo "**DISTINTO en $DISTINTAS renglones de $TOTAL**") |"
  echo "| Cuentas | $(awk -F'|' '$2 == "auth.users" { print $3 }' "$TMP/huellas-copia.txt") restauradas |"
  echo "| Fotos y documentos | subida: \`$SUBIDA\` · comparación: \`$REVISION\` |"
  echo "| Intentos no autorizados contra la copia | $ATAQUES |"
  if [ "$IGUAL" = no ]; then
    echo; echo "## Lo que no quedó igual (sólo nombres de tabla y cuentas de renglones)"; echo; echo '```'
    grep '^[<>]' "$TMP/diferencias.txt" | cut -d'|' -f1-3 | head -60; echo '```'
  fi
} >> "$INFORME"

[ "$IGUAL" = si ] && [ "$CERRADA" = si ] || { echo "LA COPIA NO QUEDÓ IGUAL O NO QUEDÓ CERRADA. Ver el informe."; exit 1; }
echo "Listo: la copia quedó igual al original y cerrada."
