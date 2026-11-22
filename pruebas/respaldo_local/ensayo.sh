#!/bin/sh
# ENSAYO LOCAL DEL RESPALDO — de punta a punta, con servidores de base de datos de verdad, SIN tocar Supabase.
# Arma un rancho inventado en un servidor («origen»), corre el respaldo de cada noche tal cual (respaldar.sh),
# lo restaura en otro servidor vacío («destino») con restaurar.sh y deja que éste compruebe todo. Además revisa
# la autoría evento por evento y que el destino se niegue cuando debe.
# NO sustituye el ensayo real contra un proyecto de Supabase: aquí la herramienta de copia es una imitación.
# Uso: sh pruebas/respaldo_local/ensayo.sh      (necesita PostgreSQL 16 instalado y el usuario «postgres»)
set -eu
AQUI=$(cd "$(dirname "$0")" && pwd); RAIZ=$(cd "$AQUI/../.." && pwd); H="$RAIZ/herramientas/respaldo"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
T=$(mktemp -d /tmp/ensayo-respaldo.XXXXXX); chmod 755 "$T"
PA=5541; PB=5542; SA=5561; SB=5562
A="postgresql://postgres@127.0.0.1:$PA/postgres"; B="postgresql://postgres@127.0.0.1:$PB/postgres"
res=0; paso() { if [ "$2" = "si" ]; then echo "PASA  $1"; else echo "FALLA $1 ${3:-}"; res=1; fi; }
cerrar() { [ -z "${DEJAR:-}" ] || { echo "(se deja en $T)"; return; }; for d in a b; do su postgres -c "$PGBIN/pg_ctl -D $T/$d -m immediate stop" >/dev/null 2>&1 || true; done; kill $K1 $K2 2>/dev/null || true; rm -rf "$T"; }
K1=0; K2=0; trap cerrar EXIT

for d in a b; do mkdir "$T/$d"; chown postgres "$T/$d"; done
su postgres -c "$PGBIN/initdb -D $T/a -A trust -U postgres -E UTF8 --locale=C" >/dev/null
su postgres -c "$PGBIN/initdb -D $T/b -A trust -U postgres -E UTF8 --locale=C" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $T/a -o '-p $PA -k $T/a -c listen_addresses=127.0.0.1' -l $T/a/log -w start" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $T/b -o '-p $PB -k $T/b -c listen_addresses=127.0.0.1' -l $T/b/log -w start" >/dev/null
export PATH="$AQUI/bin:$PGBIN:$PATH"

# ── El origen: la plataforma, las hojas del rancho y un rancho inventado capturado por las puertas de verdad ──
psql "$A" -X -q -v ON_ERROR_STOP=1 -f "$AQUI/plataforma.sql" >/dev/null
node "$AQUI/armar.mjs" "$T/rancho.sql"
psql "$A" -X -q -f "$T/rancho.sql" > "$T/armar.log" 2>&1 || { tail -5 "$T/armar.log"; echo "No se pudo armar el origen"; exit 1; }
psql "$A" -X -q -f "$AQUI/sembrar.sql" > "$T/sembrar.log" 2>&1 || { tail -8 "$T/sembrar.log"; echo "No se pudo sembrar el origen"; exit 1; }
# El origen queda sellado con su nombre, como producción: de ahí en adelante sólo acepta registros con esa marca.
psql "$A" -X -q -v ON_ERROR_STOP=1 -c "select sellar_espacio('origen-ensayo')" >/dev/null
mkdir -p "$T/almacen-a" "$T/almacen-b"
printf 'FOTO-DE-UN-TICKET-01' > "$T/almacen-a/comprobantes%2Farchivo%3Aaaa111.jpg"
printf 'PDF-DE-UN-ESTADO-DE-CTA1' > "$T/almacen-a/comprobantes%2Farchivo%3Abbb222.pdf"
printf 'AUDIO-DE-UNA-NOTA' > "$T/almacen-a/comprobantes%2Fc%2Fconv-1%2Fnota%20de%20voz.webm"
python3 "$AQUI/almacen_falso.py" $SA "$T/almacen-a" llave-origen & K1=$!
python3 "$AQUI/almacen_falso.py" $SB "$T/almacen-b" llave-destino & K2=$!
python3 -c "import time; time.sleep(1)"
# El destino: un proyecto «recién creado» — sólo la plataforma.
psql "$B" -X -q -v ON_ERROR_STOP=1 -f "$AQUI/plataforma.sql" >/dev/null

# ── 1 · El respaldo de cada noche, tal cual ──
mkdir "$T/respaldos"
if BASE_URL="$A" PROYECTO_URL="http://127.0.0.1:$SA" LLAVE_SERVICIO=llave-origen CLAVE_RESPALDO="una frase larga de mentira para el ensayo" \
   sh "$H/respaldar.sh" "$T/respaldos" > "$T/respaldar.log" 2>&1; then paso "el respaldo de la noche termina bien" si; else paso "el respaldo de la noche termina bien" no; tail -8 "$T/respaldar.log"; exit 1; fi
DIA=$(ls "$T/respaldos/base" | head -1 | cut -c1-10)
paso "lo guardado va cifrado: ni la base ni las fotos se pueden leer sin la clave" "$(grep -rqa -e 'JUAN INVENTADO' -e 'FOTO-DE-UN-TICKET' -e 'hash-inventado' "$T/respaldos/base" "$T/respaldos/archivos" && echo no || echo si)"
paso "el resumen legible no trae nombres ni importes" "$(grep -q -e 'INVENTAD' -e '10000' "$T/respaldos/ULTIMO.md" && echo no || echo si)"
paso "las llaves no aparecen en lo que el respaldo imprime" "$(grep -q -e 'llave-origen' -e 'frase larga' -e '127.0.0.1:5541' "$T/respaldar.log" && echo no || echo si)"
# La segunda noche no vuelve a bajar lo que ya tiene.
BASE_URL="$A" PROYECTO_URL="http://127.0.0.1:$SA" LLAVE_SERVICIO=llave-origen CLAVE_RESPALDO="una frase larga de mentira para el ensayo" sh "$H/respaldar.sh" "$T/respaldos" > "$T/respaldar2.log" 2>&1 || true
paso "la segunda noche no vuelve a bajar los archivos que ya tiene" "$(grep -q '"nuevos":0,"iguales":3' "$T/respaldos/ULTIMO.md" && echo si || echo no)" "$(grep Fotos "$T/respaldos/ULTIMO.md")"

# ── 2 · Lo que la restauración debe NEGAR ──
D="DESTINO_PROYECTO_URL=http://127.0.0.1:$SB DESTINO_LLAVE_SERVICIO=llave-destino"
if env $D DESTINO_BASE_URL="$A" BASE_URL="$A" CLAVE_RESPALDO="una frase larga de mentira para el ensayo" sh "$H/restaurar.sh" "$T/respaldos" > "$T/n1.log" 2>&1; then r=no; else r=si; fi
paso "se niega a restaurar sobre la misma base de donde salió" $r
if env $D DESTINO_BASE_URL="$A" CLAVE_RESPALDO="una frase larga de mentira para el ensayo" sh "$H/restaurar.sh" "$T/respaldos" > "$T/n2.log" 2>&1; then r=no; else r=$(grep -q 'ya tiene' "$T/n2.log" && echo si || echo no); fi
paso "se niega a restaurar sobre una base que ya tiene tablas" $r
if env $D DESTINO_BASE_URL="$B" PRODUCCION=127.0.0.1:$PB CLAVE_RESPALDO="una frase larga de mentira para el ensayo" sh "$H/restaurar.sh" "$T/respaldos" > "$T/n3.log" 2>&1; then r=no; else r=$(grep -q 'PRODUCCIÓN' "$T/n3.log" && echo si || echo no); fi
paso "se niega si el destino es producción" $r
if env $D DESTINO_BASE_URL="$B" CLAVE_RESPALDO="otra clave que no es la buena, larga" sh "$H/restaurar.sh" "$T/respaldos" > "$T/n4.log" 2>&1; then r=no; else r=si; fi
paso "con otra clave no se abre" $r
paso "y después de esos intentos el destino sigue vacío" "$([ "$(psql "$B" -XAtq -c "select count(*) from pg_tables where schemaname = 'public'")" = 0 ] && echo si || echo no)"

# ── 3 · La restauración de verdad, con sus propias comprobaciones ──
if env $D DESTINO_BASE_URL="$B" BASE_URL="$A" CLAVE_RESPALDO="una frase larga de mentira para el ensayo" GITHUB_STEP_SUMMARY="$T/informe.md" \
   sh "$H/restaurar.sh" "$T/respaldos" "$DIA" > "$T/restaurar.log" 2>&1; then paso "la restauración termina y sus comprobaciones pasan (huellas, archivos e intentos no autorizados)" si
else paso "la restauración termina y sus comprobaciones pasan" no; tail -12 "$T/restaurar.log"; cat "$T/informe.md" 2>/dev/null | tail -30; fi
cat "$T/informe.md" 2>/dev/null | sed 's/^/      /'

# ── 4 · Comprobaciones aparte, renglón por renglón (no se le cree a la restauración sin verla) ──
q() { psql "$1" -XAtq -F '|' -c "$2"; }
igual() { [ "$(q "$A" "$2")" = "$(q "$B" "$2")" ] && [ -n "$(q "$A" "$2")" ] && paso "$1" si || paso "$1" no "· origen: $(q "$A" "$2" | head -3) · copia: $(q "$B" "$2" | head -3)"; }
igual "AUTORÍA: cada evento conserva quién lo capturó, quién lo autorizó o rechazó, con qué perfil, cuándo, y su firma" "select id, estado, creado_por, subido_por, validacion, validacion_dice, validado_por, validado_rol, validado, recibido, sello_firma from eventos order by id"
paso "AUTORÍA: el pago del administrador sigue AUTORIZADO por él y el del encargado sigue RECHAZADO" "$([ "$(q "$B" "select string_agg(id || '=' || validacion || ':' || coalesce(validado_rol, ''), ' ' order by id) from eventos where tipo = 'pago_personal'")" = "ev-pago-1=autorizado:superadmin ev-pago-2=autorizado:superadmin ev-pago-sin-permiso=rechazado:encargado" ] && echo si || echo no)" "$(q "$B" "select id, validacion, validado_rol from eventos where tipo = 'pago_personal'")"
paso "AUTORÍA: nada quedó marcado como restaurado ni a nombre de quien restauró" "$([ "$(q "$B" "select count(*) from eventos where restaurado is not null or restaurado_por is not null")" = 0 ] && echo si || echo no)"
paso "AUTORÍA: en la copia, la firma de cada sello sigue comprobándose con la llave restaurada" "$([ "$(q "$B" "select count(*) filter (where sello_firma = firma_de_sello(id, tipo, estado, datos, validacion, validacion_dice, validado_por, validado_rol, validado, recibido)) || '/' || count(*) from eventos")" = "$(q "$B" "select count(*) || '/' || count(*) from eventos")" ] && echo si || echo no)" "$(q "$B" "select count(*) filter (where sello_firma = firma_de_sello(id, tipo, estado, datos, validacion, validacion_dice, validado_por, validado_rol, validado, recibido)), count(*) from eventos")"
igual "AUTORÍA: la bitácora, con quién y con qué cuenta" "select id, accion, quien, datos from auditoria order by id"
igual "CUENTAS: las mismas, con su contraseña cifrada" "select id, email, encrypted_password from auth.users order by id"
igual "PERMISOS: perfiles y permisos otorgados (quién, cuál y quién lo otorgó)" "select 'perfil', id::text, rol, '' from perfiles union all select 'permiso', usuario::text, operacion, otorgado_por::text from permisos_operacion order by 1, 2, 3"
igual "PERMISOS: lo que puede cada perfil en cada tabla" "select rol, tabla, leer, crear, editar, borrar from permisos_rol order by 1, 2"
igual "DINERO: gastos, ingresos, caja chica y créditos con sus abonos (también el cancelado)" "select 'e', id, datos::text from egresos union all select 'i', id, datos::text from ingresos union all select 'c', id, datos::text from cajachica union all select 'cr', id, datos::text from creditos order by 1, 2"
igual "LO CANCELADO sigue cancelado, con su motivo" "select id, estado, datos->'cancelado' from eventos where estado <> 'vigente'"
for f in "comprobantes%2Farchivo%3Aaaa111.jpg" "comprobantes%2Farchivo%3Abbb222.pdf" "comprobantes%2Fc%2Fconv-1%2Fnota%20de%20voz.webm"; do
  cmp -s "$T/almacen-a/$f" "$T/almacen-b/$f" || { paso "ARCHIVOS: cada uno llegó idéntico al almacén de la copia" no "$f"; f=""; break; }
done; [ -z "$f" ] || paso "ARCHIVOS: los tres llegaron idénticos, byte por byte, al almacén de la copia" si
# La copia sigue viva y sigue siendo del MISMO espacio: con la marca de antes se captura; con otra, no entra.
ev() { psql "$B" -X -q -c "select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false); set role authenticated; insert into eventos (id, tipo, fecha, estado, datos) values ('$1', 'pago_personal', '2026-11-23', 'vigente', '{\"_espacio\": \"$2\", \"cuando\": \"2026-11-23T18:00:00.000Z\", \"quien\": {\"id\": \"luis\"}, \"datos\": {\"a\": {\"tipo\": \"trabajador\", \"id\": \"t1\"}, \"monto\": 100, \"medio\": \"efectivo\"}}');" > "$T/vivo-$1.log" 2>&1 || true; }
ev ev-despues origen-ensayo; ev ev-de-otro-espacio proyecto-nuevo
paso "LA COPIA OPERA: un pago nuevo, con la marca del espacio de antes, queda autorizado y firmado por la base" "$([ "$(q "$B" "select validacion || ':' || (sello_firma is not null) from eventos where id = 'ev-despues'")" = "autorizado:true" ] && echo si || echo no)" "$(tail -2 "$T/vivo-ev-despues.log")"
paso "LA COPIA CONSERVA SU CANDADO: un registro marcado con otro espacio no entra" "$([ "$(q "$B" "select count(*) from eventos where id = 'ev-de-otro-espacio'")" = 0 ] && grep -q 'no es de esta operación' "$T/vivo-ev-de-otro-espacio.log" && echo si || echo no)" "$(tail -2 "$T/vivo-ev-de-otro-espacio.log")"
igual "el nombre del espacio y la fecha en que se selló vienen en la copia" "select espacio, sellado_el, inicio_operaciones from operacion"
paso "y al origen no se le cambió nada (el respaldo sólo lee)" "$([ "$(q "$A" "select count(*) from eventos")" = 4 ] && echo si || echo no)"

echo; [ $res = 0 ] && echo "ENSAYO LOCAL: todo pasa" || echo "ENSAYO LOCAL: HAY FALLAS"
exit $res
