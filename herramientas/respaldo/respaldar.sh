#!/bin/sh
# EL RESPALDO DE CADA NOCHE. Saca una copia completa de la base (cuentas, permisos, datos, reglas) y de las fotos y
# documentos nuevos, la cifra y la deja en la carpeta que se le diga (el repositorio privado de respaldos).
# Sólo LEE de producción. Lo corre GitHub Actions; las llaves llegan por variables y nunca se imprimen.
#   BASE_URL        cadena de conexión de la base (la del «Session pooler»)
#   PROYECTO_URL    https://<proyecto>.supabase.co
#   LLAVE_SERVICIO  llave secreta del proyecto (para bajar los archivos)
#   CLAVE_RESPALDO  la frase con que se cifra. SIN ELLA EL RESPALDO NO SE PUEDE ABRIR.
# Uso: sh respaldar.sh <carpeta-de-respaldos>
set -eu
AQUI=$(cd "$(dirname "$0")" && pwd)
SALE=${1:?Falta la carpeta donde se guardan los respaldos}
: "${BASE_URL:?Falta BASE_URL}" "${PROYECTO_URL:?Falta PROYECTO_URL}" "${LLAVE_SERVICIO:?Falta LLAVE_SERVICIO}" "${CLAVE_RESPALDO:?Falta CLAVE_RESPALDO}"
[ ${#CLAVE_RESPALDO} -ge 20 ] || { echo "La clave del respaldo es muy corta (menos de 20 caracteres). No se respalda con una clave débil."; exit 2; }

DIA=$(date -u +%F)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/copia" "$SALE/base" "$SALE/archivos"

# Lo que digan las herramientas no se enseña tal cual: si algo falla, se enseña sin nada que parezca una dirección con clave.
callado() {
  if ! "$@" > "$TMP/salida.txt" 2>&1; then
    sed -E 's#[a-zA-Z]+://[^ ]+#(dirección oculta)#g; s#(password|clave)[=:][^ ]+#\1=(oculta)#gi' "$TMP/salida.txt" | tail -20
    return 1
  fi
}

echo "1/5 · Copiando la base…"
callado supabase db dump --db-url "$BASE_URL" -f "$TMP/copia/roles.sql" --role-only
callado supabase db dump --db-url "$BASE_URL" -f "$TMP/copia/schema.sql"
callado supabase db dump --db-url "$BASE_URL" -f "$TMP/copia/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

echo "2/5 · Sacando las huellas (con qué se comprueba una restauración)…"
callado psql "$BASE_URL" -X -v ON_ERROR_STOP=1 -AtqF '|' -f "$AQUI/huellas.sql" -o "$TMP/copia/huellas.txt"
callado psql "$BASE_URL" -X -v ON_ERROR_STOP=1 -AtqF '|' -o "$TMP/lista.txt" -c \
  "select bucket_id, name, coalesce(updated_at, created_at)::text || '/' || coalesce(metadata->>'size', ''), coalesce(metadata->>'mimetype', '') from storage.objects order by 1, 2"
callado psql "$BASE_URL" -X -v ON_ERROR_STOP=1 -Atq -o "$TMP/copia/version.txt" -c "select version()"

# Un respaldo vacío no es un respaldo: antes de guardar se revisa que traiga lo que tiene que traer.
for f in roles.sql schema.sql data.sql huellas.txt; do
  [ -s "$TMP/copia/$f" ] || { echo "El respaldo salió incompleto: falta $f. No se guarda."; exit 1; }
done
grep -q 'COPY "public"."perfiles"' "$TMP/copia/data.sql" || { echo "El respaldo no trae la tabla de perfiles. No se guarda."; exit 1; }
grep -q 'COPY "auth"."users"' "$TMP/copia/data.sql" || { echo "El respaldo no trae las cuentas. No se guarda."; exit 1; }
grep -q '^estructura|reglas|' "$TMP/copia/huellas.txt" || { echo "Las huellas salieron incompletas. No se guarda."; exit 1; }

echo "3/5 · Bajando las fotos y documentos nuevos…"
node "$AQUI/archivos.mjs" bajar "$TMP/lista.txt" "$SALE/archivos" > "$TMP/archivos.json" || { echo "No se pudieron bajar todos los archivos:"; cat "$TMP/archivos.json"; exit 1; }

echo "4/5 · Cifrando…"
printf '%s' "$CLAVE_RESPALDO" > "$TMP/clave"; chmod 600 "$TMP/clave"
tar -czf - -C "$TMP/copia" . | gpg --batch --quiet --yes --pinentry-mode loopback --passphrase-file "$TMP/clave" \
  --symmetric --cipher-algo AES256 -o "$SALE/base/$DIA.tar.gz.gpg"
# Se comprueba que lo cifrado se puede abrir con esa misma clave, ahora y no el día que haga falta.
gpg --batch --quiet --yes --pinentry-mode loopback --passphrase-file "$TMP/clave" --decrypt "$SALE/base/$DIA.tar.gz.gpg" | tar -tzf - > "$TMP/dentro.txt"
grep -q 'data.sql' "$TMP/dentro.txt" || { echo "El respaldo cifrado no se pudo volver a abrir. No se guarda."; rm -f "$SALE/base/$DIA.tar.gz.gpg"; exit 1; }

echo "5/5 · Quitando los respaldos viejos (se conservan 30 días y el primero de cada mes)…"
ls "$SALE/base" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.gpg$' | sort -r | awk 'NR > 30' | while read -r f; do
  case "$f" in *-01.tar.gz.gpg) ;; *) rm -f "$SALE/base/$f" ;; esac
done

# Un resumen que se puede leer sin la clave: cuánto se respaldó, sin nombres ni importes.
TABLAS=$(grep -c '^datos|' "$TMP/copia/huellas.txt" || true)
RENGLONES=$(awk -F'|' '$1 == "datos" { s += $3 } END { print s + 0 }' "$TMP/copia/huellas.txt")
CUENTAS=$(awk -F'|' '$2 == "auth.users" { print $3 }' "$TMP/copia/huellas.txt")
cat > "$SALE/ULTIMO.md" <<FIN
# Último respaldo de AgroGestión

- **Día:** $DIA (hora universal)
- **Tablas:** $TABLAS · **renglones:** $RENGLONES · **cuentas:** ${CUENTAS:-0}
- **Fotos y documentos:** $(cat "$TMP/archivos.json")
- **Tamaño cifrado:** $(wc -c < "$SALE/base/$DIA.tar.gz.gpg") bytes

Para abrirlo hace falta la clave del respaldo. Cómo restaurar: \`docs/RESPALDO-AUTOMATICO.md\` del repositorio de la app.
FIN
echo "Listo: respaldo del $DIA · $TABLAS tablas · $RENGLONES renglones."
