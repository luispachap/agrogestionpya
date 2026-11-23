#!/bin/sh
# Corre TODAS las pruebas, de la más barata a la más cara. Para si alguna falla.
# Uso: sh pruebas/todo.sh
set -e
cd "$(dirname "$0")/.."
echo "── 1/4 · cálculos, reglas y nombres sin definir"; npm test 2>&1 | grep -E "^# (pass|fail)"
echo "── 2/4 · la base armada desde cero y atacada directo"; npm run test:base > /tmp/agro-base.log 2>&1 || true; grep -E "^not ok|^# (pass|fail)" /tmp/agro-base.log; grep -q "^# fail 0" /tmp/agro-base.log || { echo "   (el detalle quedó en /tmp/agro-base.log)"; grep -A14 "^not ok" /tmp/agro-base.log | head -40; exit 1; }
printf "   la función del servidor que pide la lectura con IA (sin red, sin gasto): "; node --test pruebas/funcion_ia.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr "\n" " "; echo
printf "   el respaldo de punta a punta, en local (dos servidores de base de datos de verdad): "; if ls /usr/lib/postgresql/*/bin/initdb >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then sh pruebas/respaldo_local/ensayo.sh > /tmp/agro-ensayo.log 2>&1 && echo "$(grep -c "^PASA" /tmp/agro-ensayo.log) comprobaciones pasan" || { grep "^FALLA" /tmp/agro-ensayo.log; echo "   ^^^ FALLÓ el ensayo local del respaldo"; exit 1; }; else echo "no se corrió (esta máquina no tiene PostgreSQL)"; fi
echo "── 3/4 · compilación"; npm run build 2>&1 | grep -E "modules|built"
echo "── 4/4 · navegador real"
pkill -f "vite" 2>/dev/null || true
npx vite preview --port 4173 >/dev/null 2>&1 &
npx vite --port 5173 >/dev/null 2>&1 &
VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 >/dev/null 2>&1 &
python3 -c "import time; time.sleep(6)"
falla=0
for t in humo recorrido archivos campo arranque cuentas menu checador cuadrillas eventuales almacen dosaparatos pagos prestaciones sensibles mes bajas cruces decisiones importar entrada ia plan jornada reasignacion organizacion ejecutores entrega sinsenal auditoria_dinero auditoria_proveedores auditoria_bodega auditoria_pagos auditoria_almacen auditoria_semana auditoria_agronomo auditoria_identidad auditoria_entregas auditoria_cobros auditoria_ausencias auditoria_campo auditoria_captura auditoria_numeros auditoria_banco auditoria_papeles auditoria_control; do
  printf "   %s: " "$t"
  # El resultado es el de la prueba, no el de "tail": si truena a medias también cuenta como falla.
  if python3 pruebas/${t}_navegador.py > /tmp/agro_prueba.log 2>&1; then tail -1 /tmp/agro_prueba.log; else tail -3 /tmp/agro_prueba.log; echo "   ^^^ FALLÓ $t"; falla=1; fi
done
pkill -f "vite" 2>/dev/null || true
exit $falla
