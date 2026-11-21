"""«Dile a la app» por el camino común, en navegador real y con gente y parcelas INVENTADAS. Lo que se comprueba: que
lo que Miguel diría de un avance se entiende como UN avance (no como notas), con su unidad, su gente y lo pendiente;
que guardarlo NO le registra el día a nadie ni genera gasto; que lo que falta se pregunta; que un gasto no lo confirma
un encargado; que una sospecha no se guarda como hecho; que un préstamo dicho no nace como gasto; y que lo pendiente
aparece al día siguiente en «El día» como sugerencia.
Uso:  npx vite --port 5173 &   →   python3 pruebas/dicho_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""))
plano = lambda t: t.replace("\n", " | ")
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: [e for e in pg.evaluate(LEER) if e["tipo"] == tipo]
cuenta = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { act: d.actividades.length, egr: d.egresos.length, bit: (d.bitacora || []).length, inc: (d.incidencias || []).length, pre: (d.prestamos || []).length, ev: (d.eventos || []).map(e => e.tipo) }; }")
g["SEMILLA"].update({"ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}], "parcelas": [{"id": "sf4", "nombre": "San Felipe 4", "ranchoId": "r1", "hectareas": 3, "emoji": "🌾"}, {"id": "p53", "nombre": "La 53", "ranchoId": "r1", "hectareas": 2, "emoji": "🌾"}]})
def abrir(b, pin, hora):
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); pg.errs = []; pg.on("pageerror", lambda e: pg.errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time=hora); g["sembrar"](pg); g["entrar"](pg, "", pin); pg.wait_for_timeout(400)
    return pg
def decir(pg, texto):
    pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(250); pg.evaluate("p => window.__agroIr(p)", "dictado"); pg.wait_for_timeout(500)
    pg.locator("textarea").first.fill(texto); pg.get_by_role("button", name="Ver qué entendió").click(); pg.wait_for_timeout(400)
    return pg.locator("body").inner_text()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = abrir(b, "5501", "2026-11-20T18:00:00-06:00")   # el encargado, por la tarde
    t = decir(pg, "Hoy terminamos dos reguladores de deshierbe en San Felipe 4. Trabajaron siete personas y mañana tenemos que terminar lo que falta.")
    caso("lo que diría Miguel se entiende como UN avance, con unidad, gente y pendiente", "2 reguladores de deshierbe en San Felipe 4 · 7 persona(s) · quedó pendiente" in t and "Algo que se hizo · queda en Avances" in t and pg.locator("button[aria-label^='Guardar ']").count() == 1, plano(t)[-700:])
    caso("se dice que el avance no es pago ni porcentaje", "no le registra el día a nadie ni genera pago. No se calcula porcentaje" in t)
    antes = cuenta(pg); pg.locator("button[aria-label^='Guardar ']").first.click(); pg.wait_for_timeout(600); c = cuenta(pg); ev = de(pg, "avance_trabajo"); d = ev[0]["datos"] if ev else {}
    caso("guardar deja el avance y NADA más: ni actividades de siete personas, ni gasto", len(ev) == 1 and [d["cantidad"], d["unidad"], d["personas"], d["actividad"], d["parcelaId"]] == [2, "regulador", 7, "deshierbe", "sf4"] and c["act"] == antes["act"] and c["egr"] == antes["egr"] and "monto" not in d, d)
    caso("el avance guarda de qué frase salió y quién lo confirmó", d.get("origenDicho", {}).get("frase", "").startswith("Hoy terminamos dos reguladores") and d["origenDicho"]["confirmo"] == "ENCARGADO DE PRUEBA", d.get("origenDicho"))
    t = decir(pg, "Terminamos tres reguladores.")
    caso("lo que falta se pregunta y no se ofrece guardar", "¿En qué parcela?" in t and "¿De qué actividad es el avance" in t and pg.locator("button[aria-label^='Guardar ']").count() == 0, plano(t)[-420:])
    t = decir(pg, "Compramos doscientos litros de diésel, tres mil ochocientos pesos.")
    caso("un gasto dicho por el encargado no lo puede confirmar él", "Esto lo confirma un administrador o finanzas" in t and pg.locator("button[aria-label^='Guardar ']").count() == 0 and cuenta(pg)["egr"] == 0, plano(t)[-420:])
    t = decir(pg, "Creo que cosechamos como cien cajas de La 53.")
    caso("una sospecha se conserva como nota, no como cosecha", "Una sospecha (no confirmada)" in t and "no como algo ya hecho" in t and "queda en Bitácora" in t, plano(t)[-420:])
    pg.locator("button[aria-label^='Guardar ']").first.click(); pg.wait_for_timeout(400)
    bi = pg.evaluate("() => window.__agroDatos.bitacora.slice(-1)[0]")
    caso("la nota guarda su clase y a qué sonaba", bi["naturaleza"] == "hipotesis" and bi["sonabaA"] == "cosecha" and pg.evaluate("() => window.__agroDatos.cosechas.length") == 0, {k: bi.get(k) for k in ("naturaleza", "sonabaA", "nota")})
    t = decir(pg, "Hoy terminamos un regulador de riego en La 53. El tractor se descompuso, tira aceite. Vimos mucha hierba en San Felipe 4.")
    caso("un mensaje con tres cosas da tres propuestas, cada una con su clase", "1 regulador de riego en La 53" in t and "Un aviso · queda en Incidencias" in t and "Algo que se vio · queda en Bitácora" in t and pg.locator("button[aria-label^='Guardar ']").count() == 3, plano(t)[-900:])
    caso("nada tronó (encargado)", not g["trono"](pg) and not pg.errs, pg.errs[:2])
    # el administrador: un préstamo dicho no nace como gasto
    pg2 = abrir(b, "7391", "2026-11-20T19:00:00-06:00")
    t = decir(pg2, "Le presté quinientos pesos a Juan.")
    caso("un préstamo dicho no se guarda como gasto: se dice dónde se registra", "Un préstamo no es un gasto y no descuenta nada solo" in t and "queda en Bitácora" in t, plano(t)[-420:])
    pg2.locator("button[aria-label^='Guardar ']").first.click(); pg2.wait_for_timeout(400); c = cuenta(pg2)
    caso("al guardarlo sólo queda la nota: ni gasto ni préstamo", c["egr"] == 0 and c["pre"] == 0 and c["bit"] == 1, c)
    t = decir(pg2, "Compramos doscientos litros de diésel, tres mil ochocientos pesos.")
    pg2.locator("button[aria-label^='Guardar ']").first.click(); pg2.wait_for_timeout(400)
    e = pg2.evaluate("() => window.__agroDatos.egresos.slice(-1)[0]")
    caso("el administrador sí confirma el gasto, y queda de qué se dijo", e["monto"] == 3800 and e["origen"]["canal"] == "app" and e["origen"]["frase"].startswith("Compramos"), {k: e.get(k) for k in ("monto", "concepto")})
    caso("nada tronó (administrador)", not g["trono"](pg2) and not pg2.errs, pg2.errs[:2])
    # al día siguiente, lo pendiente aparece como sugerencia en «El día»
    pg.clock.set_fixed_time("2026-11-21T07:00:00-06:00"); pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(300); pg.evaluate("p => window.__agroIr(p)", "eldia"); pg.wait_for_timeout(800)
    t = pg.locator("body").inner_text()
    caso("al día siguiente «El día» recuerda lo pendiente y dice en qué se basa", "Quedó pendiente (1)" in t and "trabajaron 7 persona(s) en deshierbe en San Felipe 4: avanzaron 2 reguladores" in t and "No se dijo cuánto quedó pendiente" in t and "lo decide quien reparte el día" in t, plano(t)[:900])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
