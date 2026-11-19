"""Dos aparatos sin señal sobre el mismo artículo, que después se juntan en distinto orden.
La existencia no es un número que se pisa: es la suma de los movimientos de los dos.
Uso:  npx vite --port 5173 &   →   python3 pruebas/dosaparatos_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "pin": "4821"}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
S["inventario"] = [
    {"id": "i-urea", "nombre": "UREA DE PRUEBA", "unidad": "bulto", "existencia": 50, "costo_unit": 868, "minimo": 20},
    {"id": "i-diesel", "nombre": "DIESEL DE PRUEBA", "unidad": "L", "existencia": 400, "costo_unit": 24.5},
    {"id": "i-pala", "nombre": "PALA DE PRUEBA", "unidad": "pieza", "existencia": 6, "costo_unit": 320, "esHerramienta": True},
]
ABRIR = """const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };"""
LEER = "() => new Promise((ok) => { " + ABRIR + " r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; }; })"
METER = "(evs) => new Promise((ok) => { " + ABRIR + " r.onsuccess = () => { const tx = r.result.transaction('eventos', 'readwrite'); for (const e of evs) tx.objectStore('eventos').put(e); tx.oncomplete = () => { r.result.close(); ok(true); }; }; })"
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).click(); pg.wait_for_timeout(250)
def contar(pg, articulo, cuanto, causa, bodega=None):
    ir(pg, "vales"); pg.locator(".tab-pill", has_text="Conteo").click(); pg.wait_for_timeout(200)
    if bodega: pg.get_by_label("Bodega").select_option(bodega)
    pg.get_by_label("Artículo").select_option(articulo); pg.get_by_label("Lo que contaste").fill(str(cuanto))
    pg.get_by_role("button", name="Comparar").click(); pg.wait_for_timeout(250)
    visto = pg.locator(".card.ab .card").first.inner_text()
    if pg.get_by_label("¿Por qué no cuadra?").count(): pg.get_by_label("¿Por qué no cuadra?").select_option(causa)
    pg.get_by_role("button", name="Registrar conteo").click(); pg.wait_for_timeout(350)
    return visto
def que_hay(pg):
    ir(pg, "entregas"); tab(pg, "Qué hay")
    return {n: " | ".join(pg.locator(".card", has_text=n).first.inner_text().split("\n")[:8]) for n in ("UREA DE PRUEBA", "DIESEL DE PRUEBA", "PALA DE PRUEBA")}

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(hora):
        ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())   # sin señal: nada sale de este aparato
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
        pg.clock.install(time=f"2026-11-19T{hora}:00-06:00"); g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
        return pg
    A = aparato("09:00"); B = aparato("09:10")

    # ── Aparato A, en la bodega ──
    ir(A, "entregas")
    A.get_by_label("Artículo").select_option("i-urea"); A.get_by_label("Cantidad").fill("10"); A.get_by_label("Quién lo recibe").select_option("trabajador|t-ana")
    A.get_by_label("Para qué es").select_option("parcela"); A.get_by_label("Parcela", exact=True).select_option("p1")
    A.locator("button.btn-accent", has_text="Entregar").click(); A.wait_for_timeout(300)
    vistoA = contar(A, "i-diesel", 390, "merma")
    caso("A: el conteo es a ciegas y después enseña que faltan 10", "faltan 10" in vistoA, vistoA[:90])

    # ── Aparato B, en el campo, sin saber nada de A ──
    ir(B, "entregas"); tab(B, "Usar directo")
    B.get_by_label("Artículo").select_option("i-urea"); B.get_by_label("Cantidad").fill("5"); B.get_by_label("Para qué es").select_option("parcela"); B.get_by_label("Parcela", exact=True).select_option("p1")
    B.get_by_role("button", name="Registrar el uso").click(); B.wait_for_timeout(300)
    tab(B, "Qué hay")
    B.locator(".card", has_text="UREA DE PRUEBA").get_by_role("button", name="Mover a otro lugar").click()
    B.get_by_label("Cuánto se mueve").fill("20"); B.get_by_label("A qué lugar").fill("BODEGA DOS DE PRUEBA"); B.get_by_role("button", name="Mover", exact=True).click(); B.wait_for_timeout(300)
    contar(B, "i-diesel", 390, "no_se_sabe")
    ir(B, "entregas")
    B.get_by_label("Artículo").select_option("i-pala"); B.get_by_label("Cantidad").fill("8"); B.get_by_label("Quién lo recibe").select_option("trabajador|t-ana")
    B.locator("button.btn-accent", has_text="Entregar").click(); B.wait_for_timeout(300)
    caso("B: entregar 8 palas habiendo 6 se registra y avisa que queda una discrepancia", "discrepancia pendiente" in B.locator(".card", has_text="Entregado:").inner_text() and B.locator(".tab-pill", has_text="Por revisar (1)").count() == 1)

    antesA, antesB = que_hay(A), que_hay(B)
    caso("antes de juntarse cada aparato ve sólo lo suyo", "40 bulto" in antesA["UREA DE PRUEBA"] and "25 bulto" in antesB["UREA DE PRUEBA"], f"A: {antesA['UREA DE PRUEBA'][:40]} · B: {antesB['UREA DE PRUEBA'][:40]}")

    # ── Se juntan: a A le llega lo de B, y a B lo de A al revés y DOS veces (un reintento) ──
    evA, evB = A.evaluate(LEER), B.evaluate(LEER)
    A.evaluate(METER, evB); B.evaluate(METER, list(reversed(evA))); B.evaluate(METER, evA)
    for pg in (A, B):
        pg.reload(); pg.wait_for_timeout(1200)
        if pg.locator(".login-bg").count() > 0: g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    hayA, hayB = que_hay(A), que_hay(B)
    caso("los dos aparatos quedan diciendo exactamente lo mismo", hayA == hayB, json.dumps([hayA, hayB], ensure_ascii=False)[:300] if hayA != hayB else "")
    u = hayA["UREA DE PRUEBA"]
    caso("la urea es la suma de los movimientos de los dos: 50 − 10 − 5 − 20 = 15 aquí, 20 en la otra bodega, 10 con Ana", "15 bulto" in u and "En BODEGA DOS DE PRUEBA" in u and "20 bulto" in u and "Lo trae ANA DE PRUEBA" in u and "10 bulto" in u, u)
    caso("los dos contaron 390 L de diésel: queda en 390, no en 380", "390 L" in hayA["DIESEL DE PRUEBA"], hayA["DIESEL DE PRUEBA"][:60])
    n = len(A.evaluate(LEER))
    caso("el reintento no duplicó ningún movimiento", n == len(evA) + len(evB) and len(B.evaluate(LEER)) == n, f"{n} movimientos")
    caso("el catálogo guardado sigue en su punto de partida en los dos (nadie sobrescribió el número)", all(json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))["inventario"][0]["existencia"] == 50 for pg in (A, B)))

    # ── Lo que quedó a la vista para resolver ──
    tab(A, "Por revisar")
    t = A.locator("body").inner_text()
    caso("la entrega sin existencia sigue pendiente de revisar en los dos aparatos, con cuánto faltaba", "Salió sin que alcanzara la existencia" in t and "faltaban 2" in t and "En negativo ahorita" in t, t[-260:].replace("\n", " | "))
    A.get_by_role("button", name="Dejar escrito qué se revisó").click(); A.get_by_label("Qué se revisó o decidió").fill("HABIA 2 PALAS NUEVAS SIN CAPTURAR"); A.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    t = A.locator("body").inner_text()
    caso("explicarla la saca de pendientes pero NO corrige el número: sigue en negativo hasta capturar lo que faltó", "Ya revisado" in t and "En negativo ahorita" in t and A.locator(".tab-pill", has_text="Por revisar").inner_text().strip() == "Por revisar")
    ir(A, "vales"); tab(A, "Mermas")
    t = A.locator("body").inner_text()
    caso("el faltante de diésel se registró UNA vez (10 L = $245), no dos", "$245" in t and "$490" not in t, t[t.find("Faltantes"):][:200].replace("\n", " | "))

    # ── Contar la otra bodega ──
    A.clock.fast_forward(60 * 60 * 1000)   # ya pasó una hora: el conteo es posterior a todo lo de la mañana
    visto = contar(A, "i-urea", 18, "merma", bodega="BODEGA DOS DE PRUEBA")
    caso("el conteo también es por bodega: en la otra había 20 y se contaron 18", "sistema dice 20" in visto and "faltan 2" in visto, visto[:100])
    fin = que_hay(A)["UREA DE PRUEBA"]; caso("y esa bodega queda en 18 sin tocar el almacén principal", "18 bulto" in fin and "15 bulto" in fin, fin)

    # ── Las alertas de reposición ven los movimientos nuevos ──
    ir(A, "inventario"); A.wait_for_timeout(400)
    inv = A.locator("body").inner_text(); tras = inv.split("UREA DE PRUEBA")[1][:120] if "UREA DE PRUEBA" in inv else ""
    caso("Inventario marca la urea por debajo del mínimo (15 de 20) con la existencia calculada", "15 bulto" in tras and ("Crítico" in tras or "Bajo" in tras), tras.replace("\n", " | "))
    caso("ninguna pantalla tronó", not g["trono"](A) and not g["trono"](B) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
