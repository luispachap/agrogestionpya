"""Lo que era «Dile a la app», ahora en Mensajes → AgroGestión, por el camino común, en navegador real y con gente y parcelas INVENTADAS. Lo que se comprueba: que
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
    pg = ctx.new_page(); pg.errs = []; pg.on("pageerror", lambda e: pg.errs.append(str(e))); pg.on("dialog", lambda x: x.accept("no era eso"))
    pg.clock.install(time=hora); g["sembrar"](pg); g["entrar"](pg, "", pin); pg.wait_for_timeout(400)
    return pg
def decir(pg, texto):
    """Se llega por la dirección vieja de «Dile a la app»: debe caer en la conversación con AgroGestión."""
    pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(250); pg.evaluate("p => window.__agroIr(p)", "dictado"); pg.wait_for_timeout(600)
    pg.get_by_label("Mensaje", exact=True).fill(texto); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(600)
    bur = pg.locator(".msj-burbuja.mio", has_text=texto[:45]).first
    return bur, bur.inner_text()
guardar = lambda bur: bur.locator("button[aria-label^='Guardar ']")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = abrir(b, "5501", "2026-11-20T18:00:00-06:00")   # el encargado, por la tarde
    # ── Dónde quedó: un solo acceso, y AgroGestión fijada arriba en Mensajes ──
    caso("el botón flotante ya es Mensajes y no queda ningún «Dile a la app»", pg.get_by_role("button", name="Mensajes").count() >= 1 and "Dile a la app" not in pg.locator("body").inner_text())
    pg.locator(".ai-fab").click(); pg.wait_for_timeout(500)
    filas = pg.locator(".msj-conv"); t = filas.first.inner_text()
    caso("en Mensajes, la primera conversación es AgroGestión, marcada como asistente", "AgroGestión" in t and "ASISTENTE" in t.upper() and "General del rancho" in filas.nth(1).inner_text() and pg.locator(".msj-conv-asistente").count() == 1, t)
    filas.first.click(); pg.wait_for_timeout(500); t = pg.locator(".msj-pantalla").inner_text()
    caso("al abrirla dice que es el asistente del sistema, que no es una persona y que sólo la ve uno", "Asistente del sistema · sólo tú ves esta conversación" in t and "No es una persona y no participa en los grupos" in t and "Nada se guarda hasta que tú lo confirmas" in t, plano(t)[:600])
    caso("tiene la misma barra de mensajes: adjuntar, cámara y micrófono", all(pg.get_by_role("button", name=n).count() == 1 for n in ["Adjuntar", "Cámara", "Grabar audio"]))
    pg.locator(".msj-atras").click(); pg.wait_for_timeout(300)

    bur, t = decir(pg, "Hoy terminamos dos reguladores de deshierbe en San Felipe 4. Trabajaron siete personas y mañana tenemos que terminar lo que falta.")
    caso("la dirección vieja de «Dile a la app» cae en la conversación con AgroGestión", "AgroGestión" in pg.locator(".msj-cabeza h2").inner_text())
    caso("lo que diría Miguel se entiende como UN avance, con unidad, gente y pendiente", "2 reguladores de deshierbe en San Felipe 4 · 7 persona(s) · quedó pendiente" in t and "Algo que se hizo · queda en Avances" in t and guardar(bur).count() == 1 and "nota · por confirmar" not in t, plano(t)[-700:])
    caso("se dice que el avance no es pago ni porcentaje", "no le registra el día a nadie ni genera pago. No se calcula porcentaje" in t)
    r = pg.locator(".msj-burbuja.asistente").last.inner_text()
    caso("AgroGestión contesta en la conversación, con su nombre, y dice que falta confirmar", r.startswith("AgroGestión") and "falta que lo confirmes" in r, plano(r))
    antes = cuenta(pg); guardar(bur).first.click(); pg.wait_for_timeout(600); c = cuenta(pg); ev = de(pg, "avance_trabajo"); d = ev[0]["datos"] if ev else {}
    caso("guardar deja el avance y NADA más: ni actividades de siete personas, ni gasto", len(ev) == 1 and [d["cantidad"], d["unidad"], d["personas"], d["actividad"], d["parcelaId"]] == [2, "regulador", 7, "deshierbe", "sf4"] and c["act"] == antes["act"] and c["egr"] == antes["egr"] and "monto" not in d, d)
    caso("el avance guarda de qué frase salió y quién lo confirmó", d.get("origenDicho", {}).get("frase", "").startswith("Hoy terminamos dos reguladores") and d["origenDicho"]["confirmo"] == "ENCARGADO DE PRUEBA", d.get("origenDicho"))
    caso("lo ya guardado queda marcado y no se puede guardar dos veces", "guardado" in bur.inner_text() and guardar(bur).count() == 0, plano(bur.inner_text())[-200:])
    cv = de(pg, "conversacion")
    caso("la conversación nació con el primer mensaje: es de clase asistente y su único integrante es la persona", len(cv) == 1 and cv[0]["datos"]["clase"] == "asistente" and [m["nombre"] for m in cv[0]["datos"]["miembros"]] == ["ENCARGADO DE PRUEBA"], cv[0]["datos"] if cv else None)
    bur, t = decir(pg, "Terminamos tres reguladores.")
    caso("lo que falta se pregunta y no se ofrece guardar", "¿En qué parcela?" in t and guardar(bur).count() == 0, plano(t)[-420:])
    bur, t = decir(pg, "Compramos doscientos litros de diésel, tres mil ochocientos pesos.")
    caso("un gasto dicho por el encargado no lo puede confirmar él", "Esto lo confirma un administrador o finanzas" in t and "sólo la ves tú" in t and guardar(bur).count() == 0 and cuenta(pg)["egr"] == 0, plano(t)[-420:])
    bur, t = decir(pg, "Creo que cosechamos como cien cajas de La 53.")
    caso("una sospecha se conserva como nota, no como cosecha", "Una sospecha (no confirmada)" in t and "no como algo ya hecho" in t and "queda en Bitácora" in t, plano(t)[-420:])
    guardar(bur).first.click(); pg.wait_for_timeout(400)
    bi = pg.evaluate("() => window.__agroDatos.bitacora.slice(-1)[0]")
    caso("la nota guarda su clase y a qué sonaba", bi["naturaleza"] == "hipotesis" and bi["sonabaA"] == "cosecha" and pg.evaluate("() => window.__agroDatos.cosechas.length") == 0, {k: bi.get(k) for k in ("naturaleza", "sonabaA", "nota")})
    bur, t = decir(pg, "Hoy terminamos un regulador de riego en La 53. El tractor se descompuso, tira aceite. Vimos mucha hierba en San Felipe 4.")
    caso("un mensaje con tres cosas da tres propuestas, cada una con su clase", "1 regulador de riego en La 53" in t and "Un aviso · queda en Incidencias" in t and "Algo que se vio · queda en Bitácora" in t and guardar(bur).count() == 3, plano(t)[-900:])
    n = cuenta(pg)["inc"]; bur.get_by_role("button", name="Descartar", exact=False).nth(1).click(); pg.wait_for_timeout(400)
    caso("lo que no va se descarta con su motivo, y no se registra", "descartado" in bur.inner_text() and cuenta(pg)["inc"] == n and guardar(bur).count() == 2, plano(bur.inner_text())[-300:])
    pg.locator(".msj-atras").click(); pg.wait_for_timeout(300); t = pg.locator(".msj-conv").first.inner_text()
    caso("en la lista, AgroGestión enseña lo último y cuánto espera confirmación, sin contarlo como mensajes sin leer", "por confirmar" in t and pg.locator(".msj-conv").first.locator(".msj-nuevos").count() == 0, plano(t))
    pg.locator(".msj-conv", has_text="General del rancho").click(); pg.wait_for_timeout(400)
    caso("lo dicho a AgroGestión NO aparece en la conversación general", "reguladores" not in pg.locator(".msj-hilo").inner_text() and pg.locator(".msj-bienvenida").count() == 0)
    pg.locator(".msj-atras").click(); pg.wait_for_timeout(300)
    caso("nada tronó (encargado)", not g["trono"](pg) and not pg.errs, pg.errs[:2])
    # el administrador: un préstamo dicho no nace como gasto
    pg2 = abrir(b, "7391", "2026-11-20T19:00:00-06:00")
    bur, t = decir(pg2, "Le presté quinientos pesos a Juan.")
    caso("un préstamo dicho no nace como gasto ni como deuda: queda como solicitud y pregunta a quién", "todavía no es deuda y no descuenta nada" in t and "¿A quién se le prestó?" in t and cuenta(pg2)["egr"] == 0, plano(t)[-420:])
    bur, t = decir(pg2, "Compramos tres kilos de clavos.")
    bur.get_by_label("Respuesta").fill("20 pesos el kilo"); bur.get_by_role("button", name="Contestar").click(); pg2.wait_for_timeout(500)
    t = bur.inner_text()
    caso("«20 pesos el kilo» se contesta ahí mismo y se entiende dentro de la compra: $60", "Gasto de $60" in t and "$20 por unidad × 3 kilos = $60" in t and "¿Cuánto costó?" not in t, plano(t)[-500:])
    guardar(bur).first.click(); pg2.wait_for_timeout(400)
    e = pg2.evaluate("() => window.__agroDatos.egresos")
    caso("y el gasto guardado conserva lo dicho primero y la aclaración", len(e) == 1 and e[0]["monto"] == 60 and e[0]["origen"]["frase"] == "Compramos tres kilos de clavos." and e[0]["origen"]["aclaraciones"][0]["texto"] == "20 pesos el kilo", e)
    bur, t = decir(pg2, "Compramos un rollo de manguera.")
    pg2.get_by_label("Mensaje", exact=True).fill("ochocientos pesos"); pg2.get_by_role("button", name="Mandar").click(); pg2.wait_for_timeout(600)
    caso("la respuesta también se puede escribir como un mensaje normal: completa la MISMA compra", "$800" in bur.inner_text() and pg2.locator(".msj-burbuja.mio", has_text="Compramos un rollo").first.locator(".msj-dicha").count() == 1 and pg2.locator(".msj-burbuja.mio").last.locator(".msj-dicha").count() == 0, plano(bur.inner_text())[-300:])
    bur, t = decir(pg2, "Compramos doscientos litros de diésel, tres mil ochocientos pesos.")
    guardar(bur).first.click(); pg2.wait_for_timeout(400)
    e = pg2.evaluate("() => window.__agroDatos.egresos.slice(-1)[0]")
    caso("el administrador sí confirma el gasto, y queda de qué mensaje salió", e["monto"] == 3800 and e["origen"]["canal"] == "chat" and e["origen"]["mensaje"].startswith("msj") and e["origen"]["frase"].startswith("Compramos"), {k: e.get(k) for k in ("monto", "concepto", "origen")})
    # 24 nov, la demostración con teléfonos de verdad: esto salió como un gasto de $28 y una nota suelta.
    bur, t = decir(pg2, "Compramos diésel a 28 pesos... fueron 1000 litros")
    caso("«a 28 pesos… fueron 1000 litros» es UN gasto de $28,000 y enseña la cuenta antes de firmar", "Gasto de $28,000 (1,000 litros × $28)" in t and guardar(bur).count() == 1 and "nota · por confirmar" not in t, plano(t)[-500:])
    guardar(bur).first.click(); pg2.wait_for_timeout(400)
    e = pg2.evaluate("() => window.__agroDatos.egresos.slice(-1)[0]")
    caso("y el gasto guardado lleva el total, el precio por litro y la cantidad", [e["monto"], e.get("precioUnitario"), e.get("cantidad")] == [28000, 28, 1000] and "1000 litros" in e["concepto"], {k: e.get(k) for k in ("monto", "precioUnitario", "cantidad", "unidad", "concepto")})
    bur, t = decir(pg2, "jajaja")
    antes = cuenta(pg2)["bit"]
    if bur.get_by_role("button", name="Dejar tal cual en la bitácora").count():
        bur.get_by_role("button", name="Dejar tal cual en la bitácora").click(); pg2.wait_for_timeout(400)
        caso("lo que no se pudo clasificar se puede dejar tal cual en la bitácora", cuenta(pg2)["bit"] == antes + 1 and "Guardado en la bitácora" in bur.inner_text())
    else:
        caso("lo que no reconoce queda como nota por confirmar (no se pierde)", guardar(bur).count() == 1 and "Bitácora" in t, plano(t))
    caso("el administrador tiene SU conversación con AgroGestión: no ve lo que dijo el encargado", "reguladores" not in pg2.locator(".msj-hilo").inner_text())
    caso("nada tronó (administrador)", not g["trono"](pg2) and not pg2.errs, pg2.errs[:2])
    # al día siguiente, lo pendiente aparece como sugerencia en «El día»
    pg.clock.set_fixed_time("2026-11-21T07:00:00-06:00"); pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(300); pg.evaluate("p => window.__agroIr(p)", "eldia"); pg.wait_for_timeout(800)
    t = pg.locator("body").inner_text()
    caso("al día siguiente «El día» recuerda lo pendiente y dice en qué se basa", "Quedó pendiente (1)" in t and "trabajaron 7 persona(s) en deshierbe en San Felipe 4: avanzaron 2 reguladores" in t and "No se dijo cuánto quedó pendiente" in t and "lo decide quien reparte el día" in t, plano(t)[:900])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
