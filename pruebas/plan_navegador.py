"""El plan del día, el checador y el chat por el camino común, en navegador real y con gente y parcelas INVENTADAS.
Lo que se comprueba:
  1. Se planea la víspera («mañana…») y eso NO sale como plan de hoy.
  2. Al checar su entrada, cada quien ve a qué va, dónde, con quién y quién lo indicó; quien no está en el plan lo sabe.
  3. El plan se cambia y se quita sin borrar lo anterior, y al checar sale lo nuevo.
  4. Planear y checar NO crean actividades, pagos ni costos: sólo la marca de entrada.
  5. En el chat, un gasto no lo confirma el encargado (no queda firmado ni guardado) y lo que sí puede confirmar
     queda con el mensaje de donde salió.
Uso:  npx vite --port 5173 &   →   python3 pruebas/plan_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""))
plano = lambda t: t.replace("\n", " | ")
HOY, MANANA = "2026-11-23", "2026-11-24"
g["SEMILLA"].update({
    "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}],
    "parcelas": [{"id": "pa", "nombre": "Parcela Uno", "ranchoId": "r1", "hectareas": 3, "emoji": "🌾"}, {"id": "pb", "nombre": "Parcela Dos", "ranchoId": "r1", "hectareas": 2, "emoji": "🌾"}],
    "trabajadores": [
        {"id": "t-ana", "nombre": "ANA INVENTADA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4821"},
        {"id": "t-beto", "nombre": "BETO INVENTADO", "categoria": "jornalero", "sueldo_dia": 350, "pin": "9033"},
        {"id": "t-caro", "nombre": "CARO INVENTADA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "7711"},
        {"id": "t-dani", "nombre": "DANI INVENTADO", "categoria": "jornalero", "sueldo_dia": 350, "pin": "6642"}],
    "indicaciones": [
        {"id": "i-ana", "tipo": "tarea", "estado": "mandada", "fecha": HOY, "asignadoA": "t-ana", "parcelaId": "pa", "resumen": "Ana, te vas a la Parcela Uno a deshierbar.", "deQuien": "ENCARGADO DE PRUEBA", "tareaId": "ta1"},
        {"id": "i-beto", "tipo": "tarea", "estado": "mandada", "fecha": HOY, "asignadoA": "t-beto", "parcelaId": "pa", "resumen": "Beto, te vas a la Parcela Uno a deshierbar.", "deQuien": "ENCARGADO DE PRUEBA", "tareaId": "ta1"},
        {"id": "i-caro", "tipo": "tarea", "estado": "mandada", "fecha": MANANA, "asignadoA": "t-caro", "parcelaId": "pb", "resumen": "Caro, mañana riegas la Parcela Dos.", "deQuien": "ENCARGADO DE PRUEBA", "tareaId": "ta2"}],
})
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { ind: d.indicaciones, act: d.actividades.length, egr: d.egresos.length, inc: d.incidencias || [], nom: (d.nomina || []).length, ev: (d.eventos || []).map(e => e.tipo) }; }")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(500))
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:600])); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time="2026-11-23T13:30:00Z"); g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    antes = datos(pg)

    # ── 1. Planear la víspera ──
    ir(pg, "eldia"); pg.locator(".tab-pill", has_text="Reparto").click(); pg.wait_for_timeout(300)
    t = plano(pg.locator(".plan-mandado").inner_text())
    caso("el plan mandado de hoy sale con sus dos personas y avisa que no es asistencia ni pago", "2 tarea(s) para 2 persona(s)" in t and "ANA INVENTADA" in t and "BETO INVENTADO" in t and "CARO" not in t and "no genera pagos ni costos" in t, t)
    pg.locator("textarea").first.fill("Mañana Dani se va a la Parcela Dos a regar."); pg.get_by_role("button", name="Ver el reparto").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Mandarla").first.click(); pg.wait_for_timeout(400)
    nuevas = [i for i in datos(pg)["ind"] if i.get("asignadoA") == "t-dani"]
    caso("lo dicho para mañana se guarda con la fecha de mañana", len(nuevas) == 1 and nuevas[0]["fecha"] == MANANA and nuevas[0]["parcelaId"] == "pb", nuevas)
    t = plano(pg.locator(".plan-mandado").inner_text())
    caso("y no aparece en el plan de hoy", "DANI" not in t, t)
    pg.locator(".plan-mandado .tab-pill", has_text="Mañana").click(); pg.wait_for_timeout(300)
    t = plano(pg.locator(".plan-mandado").inner_text())
    caso("aparece en el plan de mañana, junto con lo que ya estaba", "DANI INVENTADO" in t and "CARO INVENTADA" in t and "ANA" not in t, t)

    # ── 2. Checar: cada quien ve a qué va ──
    ir(pg, "checador"); teclea(pg, "4821")
    t = plano(pg.locator(".chk-aviso").inner_text())
    caso("al checar su entrada, Ana ve a qué va, con quién y quién lo indicó", "ANA INVENTADA" in t and "ENTRADA" in t and "Hoy te toca:" in t.replace("HOY TE TOCA:", "Hoy te toca:") and "Parcela Uno a deshierbar" in t and "Con BETO INVENTADO" in t and "Lo indicó ENCARGADO DE PRUEBA" in t, t)
    pg.clock.run_for(13000); pg.wait_for_timeout(200)
    teclea(pg, "7711")
    t = plano(pg.locator(".chk-aviso").inner_text())
    caso("Caro tiene plan para mañana: hoy se le dice que no tiene nada asignado y a quién preguntar", "CARO INVENTADA" in t and "ENTRADA" in t and "No tienes nada asignado" in t and "riegas" not in t, t)
    pg.clock.run_for(13000); pg.wait_for_timeout(200)
    d = datos(pg)
    caso("checar con plan sólo deja la marca de entrada: ni actividades, ni pagos, ni gastos", d["ev"].count("marca") == 2 and set(d["ev"]) == {"marca"} and d["act"] == antes["act"] and d["egr"] == antes["egr"] and d["nom"] == antes["nom"], {k: d[k] for k in ("ev", "act", "egr", "nom")})

    # ── 3. Cambiar el plan ──
    ir(pg, "eldia"); pg.locator(".tab-pill", has_text="Reparto").click(); pg.wait_for_timeout(300)
    fila = pg.locator(".plan-renglon", has_text="Beto, te vas")
    fila.get_by_role("button", name="Quitar").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Quitar del plan").click(); pg.wait_for_timeout(300)
    caso("quitar del plan sin decir por qué no se puede", "Di por qué se quita" in pg.locator(".plan-dice").inner_text() and len([i for i in datos(pg)["ind"] if i["id"] == "i-beto" and i["estado"] == "mandada"]) == 1, pg.locator(".plan-dice").inner_text())
    pg.get_by_role("button", name="Dejarlo como estaba").click(); pg.wait_for_timeout(200)
    fila.get_by_role("button", name="Cambiar").click(); pg.wait_for_timeout(200)
    pg.get_by_label("Parcela").select_option("pb"); pg.get_by_label("Motivo del cambio").fill("la uno amaneció mojada")
    pg.get_by_role("button", name="Guardar el cambio").click(); pg.wait_for_timeout(400)
    ind = datos(pg)["ind"]; vieja = [i for i in ind if i["id"] == "i-beto"][0]; nueva = [i for i in ind if i.get("cambioDe") == "i-beto"]
    caso("cambiar de parcela deja lo anterior guardado y lo nuevo apuntando a lo anterior, con quién y por qué", vieja["estado"] == "cambiada" and vieja["parcelaId"] == "pa" and len(nueva) == 1 and nueva[0]["parcelaId"] == "pb" and nueva[0]["cambio"]["por"] == "ENCARGADO DE PRUEBA" and nueva[0]["cambio"]["motivo"] == "la uno amaneció mojada", {"vieja": vieja.get("estado"), "nueva": nueva})
    t = plano(pg.locator(".plan-mandado").inner_text())
    caso("la pantalla enseña el cambio y cuenta que hubo uno", "CAMBIO: ahora en Parcela Dos" in t and "1 cambio(s) guardado(s)" in t, t)
    ir(pg, "checador"); teclea(pg, "9033")
    t = plano(pg.locator(".chk-aviso").inner_text())
    caso("Beto, al checar, ve el plan ya cambiado y ya no sale como compañero de Ana", "BETO INVENTADO" in t and "CAMBIO: ahora en Parcela Dos" in t and "Con ANA" not in t, t)
    pg.clock.run_for(13000); pg.wait_for_timeout(200)

    # ── 4. El chat por el camino común ──
    ir(pg, "chat")
    pg.locator("textarea").first.fill("Compramos un kilo de clavos, 350 pesos."); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(600)
    tarjeta = pg.locator(".card", has_text="Monto").last
    tarjeta.get_by_role("button", name="Sí").click(); pg.wait_for_timeout(400)
    d = datos(pg)
    caso("en el chat, un gasto no lo confirma el encargado: se le dice quién sí y no se guarda ni se firma", d["egr"] == antes["egr"] and pg.locator(".chat-nose").count() == 1 and "lleva las cuentas" in pg.locator(".chat-nose").inner_text() and pg.get_by_text("Firmó").count() == 0, pg.locator(".chat-nose").all_inner_texts())
    pg.locator("textarea").first.fill("Se descompuso la bomba del pozo."); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(600)
    pg.locator(".card", has_text="Se descompuso la bomba").last.get_by_role("button", name="Sí").click(); pg.wait_for_timeout(400)
    d = datos(pg); inc = d["inc"]
    caso("lo que sí le toca confirmar queda guardado con el mensaje de donde salió, quién lo dijo y quién lo confirmó", len(inc) == 1 and inc[0]["origen"]["canal"] == "chat" and inc[0]["origen"]["mensaje"].startswith("msj") and inc[0]["origen"]["confirmo"] == "ENCARGADO DE PRUEBA" and "Firmó ENCARGADO DE PRUEBA" in pg.locator("body").inner_text(), inc)
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
