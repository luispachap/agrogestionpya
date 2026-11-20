"""Cierre de mes en navegador real: la foto de los costos, los ajustes posteriores y las versiones.
Uso:  npx vite --port 5173 &   →   python3 pruebas/mes_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
S = g["SEMILLA"]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}, {"id": "p2", "ranchoId": "r1", "nombre": "PARCELA DOS", "hectareas": 1, "cicloFenologico": []}]
act = lambda i, p, f, c: {"id": i, "parcelaId": p, "fecha": f, "tipo": "Riego", "costoMO": c, "costoInsumos": 0, "costoMaq": 0, "costoTotal": c, "registradoPor": {"id": "admin", "tipo": "admin", "nombre": "ADMIN"}}
S["actividades"] = [act("a1", "p1", "2026-11-10", 1000), act("a2", "p2", "2026-11-12", 300), act("a3", "p1", "2026-12-01", 9999)]
S["egresos"] = [{"id": "e1", "parcelaId": "p2", "fecha": "2026-11-15", "monto": 100, "concepto": "GASTO DE PRUEBA"},
                {"id": "g1", "fecha": "2026-11-05", "monto": 900, "categoria": "servicios", "concepto": "LUZ DE PRUEBA"}, {"id": "g2", "fecha": "2026-11-20", "monto": 200, "categoria": "administrativo", "concepto": "PAPELERIA DE PRUEBA"},
                {"id": "g3", "fecha": "2026-11-08", "monto": 5000, "categoria": "insumos", "destinoInsumo": "inventario", "concepto": "Compra de insumo: UREA DE PRUEBA"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
plano = lambda t: t.replace("\n", " | ")
def abrir(pg):
    pg.evaluate("p => window.__agroIr(p)", "reportes"); pg.wait_for_timeout(400)
    pg.locator(".tab-pill", has_text="Cierre de mes").click(); pg.wait_for_timeout(400)
    return pg.locator(".card", has_text="Cierre de mes").last

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-12-02T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    c = abrir(pg); t = c.inner_text()
    caso("abre en el mes que acaba de terminar, con el costo de cada parcela y sólo lo de ese mes", pg.get_by_label("Mes que se cierra").input_value() == "2026-11" and "PARCELA UNO" in t and "$1,000" in t and "PARCELA DOS" in t and "$400" in t and "$1,400" in t and "9,999" not in t and "Abierto" in t, plano(t)[:300])
    caso("los gastos generales salen aparte, sin repartirse a las parcelas, y el total del rancho no cuenta nada dos veces", "Costo de producción (parcelas)" in t and "1. Costos directos de producción" in t and "2. Costos indirectos atribuibles a producción" in t and "3. Gastos generales de operación y administración" in t and "servicios $900" in t and "administrativo $200" in t and "$1,100" in t and "no se reparten a las parcelas ni suben su costo" in t and "Total de costos y gastos del rancho" in t and "$2,500" in t and "pendientes de distribuir" in t, plano(t)[200:700])
    caso("la compra para el almacén no se cuenta como gasto: se dice aparte", "Aparte se compraron $5,000 de insumos para el almacén" in t and "7,500" not in t)
    pg.get_by_label("Mes que se cierra").fill("2026-12"); pg.wait_for_timeout(300)
    abrir(pg).get_by_role("button", name="Cerrar el mes").click(); pg.wait_for_timeout(300)
    caso("un mes que no ha terminado no se cierra", "todavía no termina" in pg.locator(".card", has_text="Cierre de mes").last.inner_text() and len(de(pg, "cierre_mes")) == 0)
    pg.get_by_label("Mes que se cierra").fill("2026-11"); pg.wait_for_timeout(300)
    c = pg.locator(".card", has_text="Cierre de mes").last
    c.get_by_role("button", name="Cerrar el mes").click(); pg.wait_for_timeout(500)
    ev = de(pg, "cierre_mes"); t = c.inner_text()
    caso("cerrar guarda la foto: parcela por parcela, directo, indirecto y completo", len(ev) == 1 and ev[0]["datos"]["mes"] == "2026-11" and ev[0]["datos"]["completo"] == 1400 and ev[0]["datos"]["generales"]["total"] == 1100 and ev[0]["datos"]["rancho"] == 2500 and len(ev[0]["datos"]["renglones"]) == 2 and "Cerrado · versión 1" in t, plano(t)[:200])
    # Después del cierre aparece un gasto de noviembre que nadie había capturado.
    pg.evaluate("""() => { const k = 'agro_v8:local', d = JSON.parse(localStorage.getItem(k)); d.egresos.push({ id: 'e2', parcelaId: 'p1', fecha: '2026-11-28', monto: 250, concepto: 'FACTURA QUE LLEGO TARDE' }); localStorage.setItem(k, JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_timeout(800); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    c = abrir(pg); t = c.inner_text()
    caso("lo capturado después no cambia las cifras del cierre: sale como ajuste posterior", "Ajustes posteriores al cierre: $250" in t and "al cerrar eran $1,000, hoy son $1,250" in t and "$1,400" in t and de(pg, "cierre_mes")[0]["datos"]["completo"] == 1400, plano(t)[:400])
    c.get_by_role("button", name="Reabrir el mes").click(); pg.wait_for_timeout(300)
    caso("reabrir pide el motivo", "hay que decir por qué" in c.inner_text() and len(de(pg, "reapertura_mes")) == 0)
    pg.get_by_label("Por qué se reabre el mes").fill("FACTURA TARDIA"); c.get_by_role("button", name="Reabrir el mes").click(); pg.wait_for_timeout(400)
    caso("queda reabierto y dice que la versión 1 se conserva", "Reabierto por" in c.inner_text() and "FACTURA TARDIA" in c.inner_text() and "La versión 1 se conserva" in c.inner_text())
    pg.get_by_label("Qué cambió en este cierre de mes").fill("CON LA FACTURA"); c.get_by_role("button", name="Cerrar otra vez (versión 2)").click(); pg.wait_for_timeout(500)
    ev = de(pg, "cierre_mes"); t = c.inner_text()
    caso("el cierre nuevo es la versión 2 ($1,650) y ya no hay ajustes pendientes de ver", len(ev) == 2 and ev[1]["datos"]["completo"] == 1650 and ev[0]["datos"]["completo"] == 1400 and "Cerrado · versión 2" in t and "Ajustes posteriores" not in t, plano(t)[:200])
    c.get_by_role("button", name="Ver la versión 1").click(); pg.wait_for_timeout(300)
    caso("las cifras originales se pueden consultar siempre", "Versión 1" in c.inner_text() and "$1,400" in c.inner_text())
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
