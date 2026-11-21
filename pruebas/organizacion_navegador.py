"""LA ORGANIZACIÓN (etapa 1), en la pantalla de verdad y con gente INVENTADA.
Lo que se comprueba: que la estructura provisional nace sin personas ni responsables; que nombrar, cambiar de
responsable y reorganizar dejan su historial y no reescriben lo anterior; que se puede ver «cómo estaba» otro día;
que nadie queda en un equipo ni con superior si no se captura; que sólo la captura un administrador; y que nada de
esto toca tareas, horas, pagos ni permisos.
Uso:  npx vite --port 5173 &   →   python3 pruebas/organizacion_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:600] if det else ""))
plano = lambda t: t.replace("\n", " | ")
HOY, MANANA = "2026-11-23", "2026-11-24"
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { act: d.actividades.length, egr: d.egresos.length, ind: (d.indicaciones || []).length, ev: (d.eventos || []).map(e => ({ tipo: e.tipo, datos: e.datos, estado: e.estado })) }; }")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(500))
unidad = lambda pg, nombre: pg.locator(".org-unidad").filter(has=pg.locator("b", has_text=nombre)).first

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:500])); pg.on("dialog", lambda x: x.accept("Se capturó por error"))
    pg.clock.install(time=f"{HOY}T09:00:00-06:00"); g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    antes = datos(pg)
    ir(pg, "organizacion")
    t = pg.locator(".organizacion").inner_text()
    caso("la pantalla dice desde el principio que el mapa no da permisos", "No da ni quita permisos en el sistema" in t and "Todavía no hay organización capturada" in t, plano(t)[:300])

    # ── 1. La estructura provisional ──
    pg.get_by_role("button", name="Crear la estructura provisional").click(); pg.wait_for_timeout(500)
    us = pg.locator(".org-unidad"); textos = [plano(u.inner_text()) for u in us.all()]
    caso("nacen las cuatro unidades de arranque, todas «por validar»", us.count() == 4 and [x.split(" | ")[0] for x in textos] == ["Dirección", "Operaciones agrícolas generales", "Operaciones agronómicas", "Riegos"] and all("Por validar" in x for x in textos), textos)
    caso("sin responsables y sin personas: nadie quedó asignado a nada", all("Sin responsable" in x and "0 persona(s)" in x for x in textos) and "Lo que falta decir (4)" in pg.locator(".organizacion").inner_text(), textos[0])
    d = datos(pg)
    caso("sólo se guardaron unidades: ni un responsable ni una persona", [e["tipo"] for e in d["ev"]] == ["org_unidad"] * 4 and not any("persona" in e["datos"] for e in d["ev"]), [e["tipo"] for e in d["ev"]])
    caso("y ya no se ofrece crearla otra vez", pg.get_by_role("button", name="Crear la estructura provisional").count() == 0)

    # ── 2. Responsable y gente, capturados a mano ──
    unidad(pg, "Riegos").locator("b").first.click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Nombrar responsable").click(); pg.get_by_label("Persona").select_option("agr-prueba"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    t = plano(unidad(pg, "Riegos").inner_text())
    caso("el responsable nace «por confirmar» y se avisa que no le da permisos", "Responde: AGRONOMO DE PRUEBA (por confirmar)" in t and "no le da permisos en el sistema" in pg.locator(".org-dice").inner_text(), pg.locator(".org-dice").inner_text())
    pg.get_by_role("button", name="Agregar persona").click(); pg.get_by_label("Persona").select_option("t-prueba"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="La gente").click(); pg.wait_for_timeout(300)
    per = {x.locator("b").first.inner_text(): plano(x.inner_text()) for x in pg.locator(".org-persona").all()}
    caso("el superior sale de la cadena: el trabajador depende del responsable de su equipo", "Equipo: Riegos" in per["TRABAJADOR DE PRUEBA"] and "Depende de: AGRONOMO DE PRUEBA, responsable de Riegos (por confirmar)" in per["TRABAJADOR DE PRUEBA"], per["TRABAJADOR DE PRUEBA"])
    caso("a quien nadie adscribió sale «sin equipo», y de quien no hay con qué decirlo no se supone superior", "Sin equipo" in per["ENCARGADO DE PRUEBA"] and "No tiene equipo: no hay con qué decir" in per["ENCARGADO DE PRUEBA"] and "Nadie responde por Operaciones agronómicas ni por Dirección" in per["AGRONOMO DE PRUEBA"], [per["ENCARGADO DE PRUEBA"], per["AGRONOMO DE PRUEBA"]])

    # ── 3. Cambio de responsable: pide motivo y conserva al anterior ──
    pg.get_by_role("button", name="El mapa").click(); pg.wait_for_timeout(300)   # Riegos sigue abierta
    pg.get_by_role("button", name="Confirmar o cambiar responsable").click(); pg.get_by_label("Persona").select_option("enc-prueba"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    caso("cambiar al responsable sin decir por qué no se puede", "Di por qué cambia el responsable (hoy es AGRONOMO DE PRUEBA)" in pg.locator(".org-dice").inner_text(), pg.locator(".org-dice").inner_text())
    pg.get_by_label("Desde").fill(MANANA); pg.get_by_label("Motivo").fill("El agrónomo pasa a otra área"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    caso("hoy sigue respondiendo el anterior: el cambio vale desde mañana", "Responde: AGRONOMO DE PRUEBA" in plano(unidad(pg, "Riegos").inner_text()))
    # ── 4. Reorganizar: Riegos pasa a depender de otra área, desde mañana ──
    pg.get_by_role("button", name="Cambiar", exact=True).click(); pg.get_by_label("Depende de").select_option("org-agricolas"); pg.get_by_label("Desde").fill(MANANA); pg.get_by_label("Motivo").fill("Riegos se coordina con campo"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    orden_hoy = [u.locator("b").first.inner_text() for u in pg.locator(".org-unidad").all()]
    pg.get_by_label("Fecha de la organización").fill(MANANA); pg.wait_for_timeout(400)
    orden_man = [u.locator("b").first.inner_text() for u in pg.locator(".org-unidad").all()]; t = plano(unidad(pg, "Riegos").inner_text())
    caso("la organización de hoy no cambió; la de mañana ya tiene a Riegos bajo la otra área y con el responsable nuevo", orden_hoy == ["Dirección", "Operaciones agrícolas generales", "Operaciones agronómicas", "Riegos"] and orden_man == ["Dirección", "Operaciones agrícolas generales", "Riegos", "Operaciones agronómicas"] and "Responde: ENCARGADO DE PRUEBA" in t and "1 persona(s)" in t, [orden_hoy, orden_man, t])
    caso("viendo otro día se avisa que no es hoy", "no la de hoy" in pg.locator(".organizacion").inner_text())
    pg.get_by_role("button", name="Historial").click(); pg.wait_for_timeout(300); h = plano(pg.locator(".organizacion").inner_text())
    caso("el historial dice qué cambió, desde cuándo, quién y por qué", "Riegos pasó a depender de Operaciones agrícolas generales (antes, de Operaciones agronómicas)" in h and "«Riegos se coordina con campo»" in h and "ENCARGADO DE PRUEBA quedó como responsable de Riegos, en lugar de AGRONOMO DE PRUEBA" in h and "«El agrónomo pasa a otra área»" in h and f"Vale desde el {MANANA}" in h, h[:700])
    # ── 5. Un hecho capturado por error se tacha, no se borra ──
    n = len(datos(pg)["ev"]); pg.locator(".org-hecho").first.get_by_role("button", name="Fue un error").click(); pg.wait_for_timeout(400)
    d = datos(pg); h = plano(pg.locator(".org-hecho").first.inner_text())
    caso("queda tachado con su motivo, sigue guardado y deja de contar", len(d["ev"]) == n and "Tachado por" in h and "«Se capturó por error»" in h and sum(1 for e in d["ev"] if e["estado"] == "cancelado") == 1, h)

    # ── 6. No tocó nada de la operación ni de los permisos ──
    caso("no se creó ninguna tarea, actividad ni gasto, y todos los hechos son de la organización", d["act"] == antes["act"] and d["egr"] == antes["egr"] and d["ind"] == antes["ind"] and all(e["tipo"].startswith("org_") for e in d["ev"]), {e["tipo"] for e in d["ev"]})
    ir(pg, "reparto"); caso("Equipos de trabajo sigue igual: el mapa no asignó a nadie a ningún lado", not g["trono"](pg) and pg.locator(".rep-ficha").count() == 0)
    # ── 7. Sólo un administrador ──
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400); ir(pg, "organizacion")
    caso("el encargado no tiene la pantalla de Organización", pg.locator(".organizacion").count() == 0 and pg.locator(".login-bg").count() == 0)
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
