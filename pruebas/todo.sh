#!/bin/sh
# Corre TODAS las pruebas, de la más barata a la más cara. Para si alguna falla.
# Uso: sh pruebas/todo.sh
set -e
cd "$(dirname "$0")/.."
echo "── 1/4 · cálculos, reglas y nombres sin definir"; npm test 2>&1 | grep -E "^# (pass|fail)"
echo "── 2/4 · la base armada desde cero y atacada directo"; npm run test:base > /tmp/agro-base.log 2>&1 || true; grep -E "^not ok|^# (pass|fail)" /tmp/agro-base.log; grep -q "^# fail 0" /tmp/agro-base.log || { echo "   (el detalle quedó en /tmp/agro-base.log)"; grep -A14 "^not ok" /tmp/agro-base.log | head -40; exit 1; }
echo "── 3/4 · compilación"; npm run build 2>&1 | grep -E "modules|built"
echo "── 4/4 · navegador real"
pkill -f "vite" 2>/dev/null || true
npx vite preview --port 4173 >/dev/null 2>&1 &
npx vite --port 5173 >/dev/null 2>&1 &
VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 >/dev/null 2>&1 &
python3 -c "import time; time.sleep(6)"
falla=0
for t in humo recorrido archivos campo arranque cuentas menu checador cuadrillas eventuales almacen dosaparatos pagos prestaciones sensibles; do
  printf "   %s: " "$t"; python3 pruebas/${t}_navegador.py | tail -1 || falla=1
done
pkill -f "vite" 2>/dev/null || true
exit $falla
