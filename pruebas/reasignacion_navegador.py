"""EL RECORRIDO DE LA REASIGNACIÓN, de punta a punta, en las pantallas de verdad y con gente y parcelas INVENTADAS.
Siete trabajadores tienen plan para una parcela; llegan, checan y se les reparte ahí; a media mañana se descompone la
máquina y a cuatro se les cambia el plan y se les manda a otra parcela; salen; se cierra la jornada y lo que no se
terminó pasa a mañana.
Lo que se comprueba: el plan original se conserva; el cambio dice quién, a qué hora y por qué; la jornada enseña lo que
de verdad pasó; y NADA sale dos veces — ni trabajadores, ni horas, ni tareas, ni pendientes. Tampoco se crea ninguna
actividad, pago ni gasto.
Uso:  npx vite --port 5173 &   →   python3 pruebas/reasignacion_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""))
plano = lambda t: t.replace("\n", " | ")
HOY, MANANA = "2026-11-23", "2026-11-24"
NOMBRES = ["UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE"]
GENTE = [{"id": f"w{k + 1}", "nombre": f"{n} INVENTADO", "categoria": "jornalero", "sueldo_dia": 350, "pin": f"410{k + 1}"} for k, n in enumerate(NOMBRES)]
SE_VAN = GENTE[3:]
g["SEMILLA"].update({
    "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}],
    "parcelas": [{"id": "sf4", "nombre": "San Felipe 4", "ranchoId": "r1", "hectareas": 3, "emoji": "🌾"}, {"id": "p53", "nombre": "La 53", "ranchoId": "r1", "hectareas": 2, "emoji": "🌾"}],
    "trabajadores": GENTE,
    "indicaciones": [{"id": f"s{k + 1}", "tipo": "tarea", "estado": "mandada", "fecha": HOY, "asignadoA": p["id"], "parcelaId": "sf4", "hora": "07:00", "tareaId": "deshierbe-sf4",
                      "resumen": f"{NOMBRES[k].capitalize()}, a deshierbar San Felipe 4 con la desbrozadora.", "deQuien": "ENCARGADO DE PRUEBA"} for k, p in enumerate(GENTE)],
})
LEER = """() => new Promise(ok => { const r = indexedDB.open('agrogestion'); r.onsuccess = () => { try { const db = r.result, n = [...db.objectStoreNames].find(x => /evento/i.test(x)); if (!n) return ok(null);
  const q = db.transaction(n).objectStore(n).getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); } catch (e) { ok(null); } }; r.onerror = () => ok(null); })"""
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { ind: d.indicaciones, act: d.actividades.length, egr: d.egresos.length, nom: (d.nomina || []).length, ev: (d.eventos || []) }; }")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(500))
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(350)
def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(300)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:500])); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time=f"{HOY}T06:55:00-06:00"); g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    antes = datos(pg)

    # ── 1. 6:55 — llegan los siete y checan: cada quien ve a qué va ──
    ir(pg, "checador"); vistos = []
    for w in GENTE:
        teclea(pg, w["pin"]); vistos.append(plano(pg.locator(".chk-aviso").inner_text())); pg.clock.run_for(13000); pg.wait_for_timeout(150)
    caso("los siete checan su entrada y cada quien ve su tarea en San Felipe 4", all(w["nombre"] in v and "San Felipe 4" in v for w, v in zip(GENTE, vistos)), vistos[0])
    d = datos(pg)
    caso("checar sólo deja la marca: siete marcas y ninguna asignación real todavía", [e["tipo"] for e in d["ev"]].count("marca") == 7 and not [e for e in d["ev"] if e["tipo"] == "asignacion"], [e["tipo"] for e in d["ev"]])

    # ── 2. El encargado los reparte de verdad a San Felipe 4 ──
    ir(pg, "reparto")
    caso("los siete aparecen sin asignar hasta que el encargado los manda", pg.get_by_text("Sin asignar (7)").count() == 1)
    pg.get_by_role("button", name="Marcar todos").click()
    pg.get_by_label("Parcela").select_option("sf4"); pg.get_by_label("Qué van a hacer").select_option("Deshierbe")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)
    caso("una sola captura manda a los siete", pg.locator(".card", has_text="SAN FELIPE 4").locator(".rep-ficha").count() == 7 and pg.get_by_text("Sin asignar (").count() == 0)

    # ── 3. 10:00 — se descompone la máquina: se cambia el PLAN de cuatro, con motivo ──
    avanza(pg, 3)
    ir(pg, "eldia"); pg.locator(".tab-pill", has_text="Reparto").click(); pg.wait_for_timeout(300)
    for k, w in enumerate(SE_VAN):
        fila = pg.locator(".plan-renglon", has_text=f"{NOMBRES[3 + k].capitalize()}, a deshierbar")
        fila.get_by_role("button", name="Cambiar").click(); pg.wait_for_timeout(150)
        pg.get_by_label("Parcela").select_option("p53"); pg.get_by_label("Qué va a hacer ahora").fill(f"{NOMBRES[3 + k].capitalize()}, a regar La 53."); pg.get_by_label("Motivo del cambio").fill("Se descompuso la desbrozadora")
        pg.get_by_role("button", name="Guardar el cambio").click(); pg.wait_for_timeout(300)
    ind = datos(pg)["ind"]; viejas = [i for i in ind if i["id"] in ("s4", "s5", "s6", "s7")]; nuevas = [i for i in ind if i.get("cambioDe")]
    caso("el plan original de los cuatro se conserva tal cual, marcado como cambiado", len(ind) == 11 and all(i["estado"] == "cambiada" and i["parcelaId"] == "sf4" and "a deshierbar San Felipe 4" in i["resumen"] for i in viejas), [(i["id"], i["estado"], i["parcelaId"]) for i in viejas])
    caso("y cada renglón nuevo apunta al anterior, con quién lo cambió, cuándo y por qué", len(nuevas) == 4 and sorted(i["cambioDe"] for i in nuevas) == ["s4", "s5", "s6", "s7"] and all(i["parcelaId"] == "p53" and i["cambio"]["por"] == "ENCARGADO DE PRUEBA" and i["cambio"]["motivo"] == "Se descompuso la desbrozadora" and i["cambio"]["cuando"] for i in nuevas), nuevas[:1])
    t = plano(pg.locator(".plan-mandado").inner_text())
    caso("el plan mandado sigue siendo de siete tareas para siete personas", "7 tarea(s) para 7 persona(s)" in t and "4 cambio(s) guardado(s)" in t, t[:300])

    # ── 4. Y los manda de verdad a La 53 ──
    ir(pg, "reparto")
    for w in SE_VAN: pg.locator(".rep-ficha", has_text=w["nombre"]).click()
    pg.get_by_label("Parcela").select_option("p53"); pg.get_by_label("Qué van a hacer").select_option("Riego")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)
    caso("quedan tres en San Felipe 4 y cuatro en La 53: nadie en los dos lados", pg.locator(".card", has_text="SAN FELIPE 4").locator(".rep-ficha").count() == 3 and pg.locator(".card", has_text="LA 53").locator(".rep-ficha").count() == 4 and pg.locator(".rep-ficha").count() == 7, pg.locator(".rep-ficha").count())

    # ── 5. 15:00 — salen todos ──
    avanza(pg, 5)
    ir(pg, "checador")
    for w in GENTE: teclea(pg, w["pin"]); pg.clock.run_for(13000); pg.wait_for_timeout(150)
    d = datos(pg); tipos = [e["tipo"] for e in d["ev"]]
    caso("al final del día hay catorce marcas (entrada y salida de cada quien) y dos asignaciones reales", tipos.count("marca") == 14 and tipos.count("asignacion") == 2, {x: tipos.count(x) for x in set(tipos)})

    # ── 6. La jornada: lo que se planeó, lo que se cambió y lo que pasó ──
    ir(pg, "eldia"); pg.get_by_role("button", name="Jornada").click(); pg.wait_for_timeout(500)
    t = pg.locator(".jornada").inner_text()
    caso("la jornada cuenta siete tareas y dice que el plan tuvo cuatro cambios", "De 7 tarea(s) mandadas: 0 marcadas como hechas, 7 con trabajo registrado sin marcar terminada y 0 sin evidencia" in t and "El plan tuvo 4 cambio(s) en el día" in t, plano(t)[:420])
    filas = pg.locator(".jornada-tarea"); nombres = [f.locator("b").first.inner_text() for f in filas.all()]
    caso("cada trabajador sale UNA vez en lo planeado", filas.count() == 7 and sorted(nombres) == sorted(w["nombre"] for w in GENTE), nombres)
    cambios = pg.locator(".jornada-cambio"); tc = [plano(c.inner_text()) for c in cambios.all()]
    caso("los cuatro cambios salen con lo que decía el plan, a dónde van ahora, quién, hora y motivo", cambios.count() == 4 and all("a deshierbar San Felipe 4" in x and "Ahora va a La 53." in x and "Lo cambió ENCARGADO DE PRUEBA" in x and "«Se descompuso la desbrozadora»" in x for x in tc), tc[:1])
    caso("y dicen cuánto alcanzó a trabajar cada quien donde decía el plan original", all("Alcanzó a trabajar 3 h" in x and "en San Felipe 4" in x for x in tc), tc[:1])
    caso("lo trabajado en la parcela original NO sale como «fuera del plan»", "Se trabajó y no estaba en el plan" not in t, plano(t)[-500:])
    # Horas: lo que la jornada enseña de cada quien es una sola parcela, y las de los que se fueron no llevan las de la mañana.
    de = {f.locator("b").first.inner_text(): plano(f.inner_text()) for f in filas.all()}
    caso("las horas no se enciman: los que se quedaron traen sus 8 h en San Felipe 4; los que se fueron, 3 h allá (en el cambio) y 5 h en La 53", all("Tiene 8 h" in de[w["nombre"]] and "en San Felipe 4" in de[w["nombre"]] for w in GENTE[:3]) and all("Tiene 5 h" in de[w["nombre"]] and "en La 53" in de[w["nombre"]] and "a regar La 53" in de[w["nombre"]] for w in SE_VAN), [de[GENTE[0]["nombre"]][-130:], de[SE_VAN[0]["nombre"]][-130:]])

    # ── 7. Cierre: pasa a mañana sólo lo que corresponde ──
    for w in GENTE[:3]: pg.get_by_label(f"Pasa a mañana: {w['nombre']}").check()
    pg.get_by_label("Nota del cierre").fill("Se descompuso la desbrozadora a las 10"); pg.get_by_role("button", name="Cerrar la jornada").click(); pg.wait_for_timeout(500)
    d = datos(pg); cierre = [e for e in d["ev"] if e["tipo"] == "cierre_jornada"]
    caso("la jornada se cierra y la foto guarda los cuatro cambios y los tres pendientes", len(cierre) == 1 and len(cierre[0]["datos"]["cambios"]) == 4 and sorted(cierre[0]["datos"]["pasan"]) == ["s1", "s2", "s3"] and len(cierre[0]["datos"]["tareas"]) == 7, cierre[0]["datos"].get("pasan") if cierre else pg.locator(".jornada-dice").inner_text())
    pg.get_by_role("button", name="Poner en el plan de mañana lo que quedó (3)").click(); pg.wait_for_timeout(500)
    man = [i for i in datos(pg)["ind"] if i["fecha"] == MANANA]
    caso("a mañana pasan sólo los tres pendientes, uno por persona, y nada de los renglones cambiados", sorted(i["vieneDe"] for i in man) == ["s1", "s2", "s3"] and len({i["asignadoA"] for i in man}) == 3 and all(i["parcelaId"] == "sf4" and i["estado"] == "mandada" for i in man), man[:1])
    caso("y no se pueden pasar dos veces", pg.get_by_role("button", name="Poner en el plan de mañana").count() == 0 and len([i for i in datos(pg)["ind"] if i["fecha"] == MANANA]) == 3)
    d = datos(pg)
    caso("en todo el recorrido no se creó ninguna actividad, pago ni gasto", d["act"] == antes["act"] and d["egr"] == antes["egr"] and d["nom"] == antes["nom"], {k: d[k] for k in ("act", "egr", "nom")})
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
