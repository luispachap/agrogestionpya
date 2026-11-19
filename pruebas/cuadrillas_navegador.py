"""Cuadrillas y mano de obra en navegador real, con el reloj en la mano:
  06:00 checan dos · se mandan juntos a una parcela con UNA captura
  10:00 uno se cambia de parcela y de labor
  14:00 checan salida
y sin teclear ninguna actividad, la app contesta quién, dónde, cuánto tiempo,
haciendo qué y cuánto costó. Además: la tableta cerrada en el checador y la
regla de los minutos que se cambia.
Uso:  npx vite --port 5173 &   →   python3 pruebas/cuadrillas_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
hist = lambda s: [{"desde": "2026-01-01", "sueldo_dia": s, "anterior": s}]
g["SEMILLA"]["trabajadores"] = [
    {"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4821"},
    {"id": "t-beto", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 360, "historialSueldo": hist(360), "pin": "9033"},
]
g["SEMILLA"]["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
g["SEMILLA"]["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}, {"id": "p2", "ranchoId": "r1", "nombre": "PARCELA DOS", "hectareas": 3, "cicloFenologico": []}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
eventos = lambda pg: sorted(pg.evaluate(LEER), key=lambda e: e["capturado"])
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(300)
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(300)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-19T06:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)

    # 06:00 — llegan
    ir(pg, "checador"); teclea(pg, "4821"); teclea(pg, "9033")
    ir(pg, "reparto")
    caso("quien checó aparece sin mandar", pg.get_by_text("Sin asignar (2)").count() == 1)
    pg.get_by_role("button", name="Marcar todos").click()
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué van a hacer").select_option("Deshierbe")
    pg.get_by_label("Nombre del equipo").fill("Equipo 1")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)
    asig = [e for e in eventos(pg) if e["tipo"] == "asignacion"]
    caso("con UNA captura quedan mandados los dos", len(asig) == 1 and sorted(asig[0]["datos"]["trabajadorIds"]) == ["t-ana", "t-beto"] and asig[0]["datos"]["parcelaId"] == "p1", len(asig))
    caso("y la pantalla enseña la cuadrilla en su parcela", pg.locator(".card", has_text="PARCELA UNO").locator(".rep-ficha").count() == 2 and pg.get_by_text("Sin asignar (").count() == 0)

    # 10:00 — Beto se cambia de parcela y de labor
    avanza(pg, 4)
    pg.locator(".rep-ficha", has_text="BETO").click()
    pg.get_by_label("Parcela").select_option("p2"); pg.get_by_label("Qué van a hacer").select_option("Riego")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)
    caso("cambiar de parcela es otra asignación, no una edición", len([e for e in eventos(pg) if e["tipo"] == "asignacion"]) == 2 and all(e["estado"] == "vigente" for e in eventos(pg)))
    caso("ahora hay dos cuadrillas, cada una con su gente", pg.locator(".card", has_text="PARCELA UNO").locator(".rep-ficha").count() == 1 and pg.locator(".card", has_text="PARCELA DOS").locator(".rep-ficha").count() == 1)

    # 13:00 — los de la parcela dos ya acabaron; se quedan una hora en el rancho sin asignar
    avanza(pg, 3)
    pg.locator(".card", has_text="PARCELA DOS").get_by_role("button", name="Ya acabaron").click(); pg.wait_for_timeout(300)
    caso("'ya acabaron' los regresa a sin asignar", pg.get_by_text("Sin asignar (1)").count() == 1)
    # 14:00 — salen
    avanza(pg, 1)
    ir(pg, "checador"); teclea(pg, "4821"); teclea(pg, "9033")
    m = [e["datos"]["sentido"] for e in eventos(pg) if e["tipo"] == "marca"]
    caso("a las 2 checan y es salida", m == ["entrada", "entrada", "salida", "salida"], m)

    # ── La tableta cerrada en el checador ──
    pg.get_by_role("button", name="Dejar cerrada").click()
    pg.get_by_label("Clave del checador").fill("2468"); pg.get_by_role("button", name="Cerrar", exact=True).click(); pg.wait_for_timeout(400)
    caso("cerrada: sin barra, sin menú, sin regresar y sin 'ver el día'", pg.locator(".bottom-nav").count() == 0 and pg.locator(".btn-ghost").count() == 0 and pg.get_by_role("button", name="Ver el día").count() == 0)
    pg.evaluate("() => window.__agroIr('contabilidad')"); pg.wait_for_timeout(500)
    caso("aunque se intente ir a otra pantalla, regresa al checador", pg.get_by_text("Acerca tu credencial").count() == 1 or pg.locator(".chk-aviso").count() == 1)
    pg.reload(); pg.wait_for_timeout(1500)
    if pg.locator(".login-bg").count(): g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(500)
    caso("apagar y prender no la abre", pg.locator(".bottom-nav").count() == 0 and pg.locator(".chk-teclas").count() == 1)
    pg.get_by_role("button", name="Abrir").click(); pg.get_by_label("Clave del checador").fill("1111"); pg.get_by_role("button", name="Abrir", exact=True).last.click(); pg.wait_for_timeout(300)
    caso("con una clave equivocada no abre", pg.get_by_text("Esa no es la clave").count() == 1 and pg.locator(".bottom-nav").count() == 0)
    pg.get_by_label("Clave del checador").fill("2468"); pg.get_by_role("button", name="Abrir", exact=True).last.click(); pg.wait_for_timeout(400)
    caso("con la clave buena vuelve todo", pg.locator(".bottom-nav").count() == 1)
    caso("la clave no quedó guardada en claro", "2468" not in json.dumps(pg.evaluate("() => Object.fromEntries(Object.entries(localStorage))")))

    # ── Quién, dónde, cuánto tiempo, haciendo qué y cuánto costó ──
    pg.locator(".bn-item").first.click(); pg.get_by_role("button", name="Salir").click(); pg.wait_for_timeout(500)
    g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(600)
    caso("no se tecleó ninguna actividad", pg.evaluate("() => (JSON.parse(localStorage.getItem('agro_v8:local')).actividades || []).length") == 0)
    caso("el costo de campo del inicio ya trae la mano de obra", "$715" in pg.locator(".stat-card", has_text="Costo de campo").inner_text(), pg.locator(".stat-card", has_text="Costo de campo").inner_text())
    ir(pg, "mano-obra")
    texto = pg.locator(".section-pad").inner_text()
    caso("devengado $760: los dos días completos", "$760" in texto, texto[:160])
    uno, dos = pg.locator(".card", has_text="PARCELA UNO"), pg.locator(".card", has_text="PARCELA DOS")
    caso("la parcela uno carga $580 (Ana completa + medio día de Beto) en 12 horas", "$580" in uno.inner_text() and "12 h 00 min" in uno.inner_text(), uno.inner_text())
    caso("la parcela dos carga $135 en 3 horas", "$135" in dos.inner_text() and "3 h 00 min" in dos.inner_text(), dos.inner_text())
    caso("la hora de Beto sin asignar NO se le cargó a ninguna parcela: quedó aparte, por aclarar", "$45" in pg.locator(".mo-act", has_text="Sin asignar, por aclarar").inner_text() and "1 h 00 min" in pg.locator(".mo-act", has_text="Sin asignar, por aclarar").inner_text())
    dos.locator(".mo-cab").click(); pg.wait_for_timeout(200)
    caso("dice haciendo qué", "Riego" in dos.inner_text() and "BETO" in dos.inner_text())
    dos.locator(".jor-fila").first.click(); pg.wait_for_timeout(300)
    rastro = pg.locator(".modal-sheet").inner_text()
    caso("cada importe enseña de qué salió: la entrada, la salida y a dónde lo mandaron", "entrada" in rastro and "salida" in rastro and "asignado a PARCELA DOS" in rastro and "ENCARGADO DE PRUEBA" in rastro, rastro[:300])
    pg.get_by_role("button", name="Cerrar").click()
    pg.get_by_role("button", name="Por persona").click(); pg.wait_for_timeout(200)
    caso("por persona: Ana $400 y Beto $360", "$400" in pg.locator(".card", has_text="ANA DE PRUEBA").inner_text() and "$360" in pg.locator(".card", has_text="BETO DE PRUEBA").inner_text())

    # ── Tiempo sin asignar: se aclara, no se da por perdido ──
    pg.get_by_role("button", name="Por parcela").click(); pg.wait_for_timeout(200)
    pg.locator(".card", has_text="Fuera de parcelas").last.locator(".mo-cab").click(); pg.wait_for_timeout(200)
    pg.locator(".card", has_text="Fuera de parcelas").last.locator(".jor-fila").first.click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Aclarar este tiempo").click()
    pg.get_by_label("¿Qué pasó en ese rato?").select_option("espera")
    pg.get_by_label("Nota de la aclaración").fill("esperando el camión")
    pg.get_by_role("button", name="Guardar aclaración").click(); pg.wait_for_timeout(400)
    ac = [e for e in eventos(pg) if e["tipo"] == "aclaracion"]
    caso("la aclaración es un evento aparte, con su causa y quién la puso", len(ac) == 1 and ac[0]["datos"]["causa"] == "espera" and ac[0]["quien"]["nombre"] == "Administrador")
    caso("ya no sale por aclarar: sale como espera, y sigue fuera de las parcelas", pg.get_by_text("Sin asignar, por aclarar").count() == 0 and pg.locator(".mo-act", has_text="Espera").count() >= 1 and "$580" in pg.locator(".card", has_text="PARCELA UNO").inner_text())
    caso("en pantalla no aparecen las palabras que no usamos", not any(w in pg.locator("body").inner_text().lower() for w in ["jornal", "faena", " labor"]))

    # ── La regla de los minutos se cambia, y queda quién la cambió ──
    ir(pg, "jornadas")
    pg.get_by_label("Minutos para tomar una segunda lectura como repetida").fill("5")
    pg.locator(".card", has_text="Reglas del rancho").get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    aj = [e for e in eventos(pg) if e["tipo"] == "ajuste"]
    caso("cambiar los 15 minutos queda como un evento, con quién lo cambió", len(aj) == 1 and aj[0]["datos"] == {"clave": "ventana_repetida_min", "valor": 5} and pg.get_by_text("Lo puso Administrador").count() == 1, json.dumps(aj[0]["datos"]) if aj else "")
    avanza(pg, 0.1); ir(pg, "checador"); teclea(pg, "4821")          # 6 minutos después de su salida: entra otra vez
    avanza(pg, 0.1); teclea(pg, "4821")             # 6 minutos después
    m = [e["datos"]["sentido"] for e in eventos(pg) if e["tipo"] == "marca" and e["datos"]["trabajadorId"] == "t-ana"]
    caso("con la regla en 5 minutos, a los 6 ya cuenta como salida", m == ["entrada", "salida", "entrada", "salida"], m)
    caso("ninguna pantalla tronó", not errs, errs)
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
