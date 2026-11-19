"""Pagos al personal en navegador real: asistencia con causa, salidas que decide una persona,
lo que corresponde / entregado / pendiente, cuadrillas (al responsable), temporales y recibos con versiones.
Uso:  npx vite --port 5173 &   →   python3 pruebas/pagos_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
hist = lambda s: [{"desde": "2026-01-01", "sueldo_dia": s, "anterior": s}]
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4821"},
                     {"id": "t-beto", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4822"}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
eventos = lambda pg: sorted(pg.evaluate(LEER), key=lambda e: e["capturado"])
de = lambda pg, tipo: [e for e in eventos(pg) if e["tipo"] == tipo]
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(300)
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
def gente(pg, lista):
    for i, (nombre, valor) in enumerate(lista):
        if i > 0: pg.get_by_role("button", name="Agregar persona").click()
        pg.get_by_label(f"Nombre {i + 1}").fill(nombre)
        if valor is not None: pg.locator(".dj-fila").nth(i).locator("input[type=number]").fill(str(valor))
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).first
modal = lambda pg: pg.locator(".modal-sheet")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-19T07:00:00-06:00")     # jueves; la semana es del lunes 16 al domingo 22
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)

    # Ana checa a las 7, se le manda a la parcela y se va a las 11.
    ir(pg, "checador"); teclea(pg, "4821")
    ir(pg, "reparto"); pg.locator(".rep-ficha", has_text="ANA").click()
    pg.get_by_label("Parcela o vehículo").select_option("p1"); pg.get_by_label("Qué van a hacer").select_option("Riego")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(300)
    pg.clock.fast_forward(4 * 3600 * 1000); pg.wait_for_timeout(300)
    ir(pg, "checador"); teclea(pg, "4821")

    # ══ Salida anticipada: no hay descuento automático ══
    ir(pg, "nomina")
    ana = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("salió a las 4 horas y su día sigue completo: nada se descuenta solo", "$400" in ana and "LE CORRESPONDE" in ana.upper(), ana[:120].replace("\n", " | "))
    tab(pg, "Asistencia")
    por = pg.locator(".card", has_text="Salieron antes: por revisar")
    caso("el caso queda por revisar, diciendo que mientras tanto se paga completo", por.count() == 1 and "ANA DE PRUEBA" in por.inner_text() and "No hay descuento automático" in por.inner_text())
    por.get_by_role("button", name="Decidir").click()
    modal(pg).get_by_role("button", name="Guardar decisión").click(); pg.wait_for_timeout(200)
    caso("la decisión pide decir qué pasó", modal(pg).get_by_text("Falta decir qué pasó").count() == 1)
    pg.get_by_label("Qué pasó").select_option("abandono"); pg.get_by_label("Cómo se paga").select_option("medio")
    modal(pg).get_by_role("button", name="Guardar decisión").click(); pg.wait_for_timeout(200)
    caso("y el porqué, con nombre", modal(pg).get_by_text("Falta el porqué").count() == 1 and len(de(pg, "decision_jornada")) == 0)
    pg.get_by_label("Por qué se decide así").fill("SE FUE SIN AVISAR"); modal(pg).get_by_role("button", name="Guardar decisión").click(); pg.wait_for_timeout(400)
    dj = de(pg, "decision_jornada")
    caso("la decisión queda con quién la tomó y por qué", len(dj) == 1 and dj[0]["datos"]["situacion"] == "abandono" and dj[0]["datos"]["pago"] == "medio" and dj[0]["quien"]["rol"] == "admin" and "SIN AVISAR" in dj[0]["datos"]["motivo"])
    tab(pg, "Planta")
    caso("ahora sí le corresponde medio día: $200", "$200" in tarjeta(pg, "ANA DE PRUEBA").inner_text(), tarjeta(pg, "ANA DE PRUEBA").inner_text()[:100].replace("\n", " | "))
    ir(pg, "mano-obra")
    caso("y a la parcela le llega lo que de verdad se pagó ($200), no los $400", "$200" in pg.locator(".card", has_text="Lo que se ganó el personal").inner_text() and "$400" not in pg.locator(".card", has_text="Lo que se ganó el personal").inner_text())

    # ══ Ausencias: una pregunta, no una falta automática ══
    ir(pg, "nomina"); tab(pg, "Asistencia")
    sin = pg.locator(".card", has_text="No vinieron y nadie ha dicho por qué")
    caso("quien no vino aparece como pregunta, no como falta: Beto lunes a jueves y Ana lunes a miércoles", sin.count() == 1 and sin.inner_text().count("BETO DE PRUEBA") == 4 and sin.inner_text().count("ANA DE PRUEBA") == 3 and len(de(pg, "ausencia")) == 0, sin.inner_text()[:80].replace("\n", " | "))
    fila = lambda fecha: sin.locator(".mo-act", has_text="BETO DE PRUEBA").filter(has_text=fecha)
    fila("2026-11-16").get_by_role("button", name="Decir qué pasó").click()
    pg.get_by_label("Qué fue").select_option("permiso"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(200)
    caso("un permiso pide causa y quién lo autorizó", modal(pg).get_by_text("Falta decir quién lo autorizó").count() == 1)
    pg.get_by_label("Causa").fill("CITA MEDICA DE PRUEBA"); pg.get_by_label("Quién autorizó").fill("RODOLFO DE PRUEBA"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    fila("2026-11-17").get_by_role("button", name="Decir qué pasó").click()
    pg.get_by_label("Qué fue").select_option("falta"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    tab(pg, "Planta")
    beto = tarjeta(pg, "BETO DE PRUEBA").inner_text()
    caso("el permiso autorizado se paga y la falta no: a Beto le corresponden $400", "$400" in beto and "1 de permiso o descanso pagado" in beto and "1 sin pago" in beto, beto[:160].replace("\n", " | "))
    tab(pg, "Asistencia")
    pg.locator(".card", has_text="Ausencias de la semana").get_by_role("button", name="Justificar").click()
    pg.get_by_label("Justificación").fill("TRAJO RECETA DE PRUEBA"); pg.get_by_label("Quién la aceptó").fill("MIGUE DE PRUEBA"); pg.get_by_label("Se paga el día").select_option("si")
    modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    au = pg.evaluate(LEER); faltas = [e for e in au if e["tipo"] == "ausencia" and e["fecha"] == "2026-11-17"]
    caso("justificar después corrige con historial: la falta queda 'corregida' y nace el registro nuevo que apunta a ella", len(faltas) == 2 and sorted(e["estado"] for e in faltas) == ["corregido", "vigente"] and [e for e in faltas if e["estado"] == "vigente"][0]["origen"] == [e for e in faltas if e["estado"] == "corregido"][0]["id"])
    caso("y en pantalla dice que antes era falta", "corregida: antes era falta" in pg.locator(".card", has_text="Ausencias de la semana").inner_text())
    # Beto estudia los sábados
    cal = pg.locator(".card", has_text="Quién viene los sábados")
    cal.locator(".mo-act", has_text="BETO DE PRUEBA").get_by_role("button", name="Cambiar").click(); pg.wait_for_timeout(300)
    caso("el calendario es de cada quien: Beto de lunes a viernes, Ana de lunes a sábado", "lunes a viernes" in cal.locator(".mo-act", has_text="BETO DE PRUEBA").inner_text() and "lunes a sábado" in cal.locator(".mo-act", has_text="ANA DE PRUEBA").inner_text())

    # ══ Pago, pendiente y recibo de un trabajador de planta ══
    tab(pg, "Planta")
    b0 = tarjeta(pg, "BETO DE PRUEBA")
    caso("con la justificación, a Beto le corresponden $800 y no se le ha entregado nada", "$800" in b0.inner_text() and "Pendiente" in b0.inner_text())
    b0.get_by_role("button", name="Registrar pago").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("500"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    pagos = de(pg, "pago_personal")
    caso("el pago queda como entrega: a quién, de qué semana, cuánto y por qué medio", len(pagos) == 1 and pagos[0]["datos"]["a"]["id"] == "t-beto" and pagos[0]["datos"]["monto"] == 500 and pagos[0]["datos"]["desde"] == "2026-11-16" and pagos[0]["datos"]["medio"] == "efectivo")
    caso("avisa que quedó sin comprobante (no lo impide)", pg.get_by_text("Quedó sin comprobante").count() == 1)
    b1 = tarjeta(pg, "BETO DE PRUEBA").inner_text()
    caso("entregado $500, pendiente $300", "$500" in b1 and "$300" in b1, b1[-200:].replace("\n", " | "))
    datos = json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))
    caso("pagar no creó ningún gasto ni costo nuevo", len(datos.get("egresos", [])) == 0 and len(datos.get("actividades", [])) == 0)
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Recibo").click(); pg.wait_for_timeout(300)
    hoja = pg.locator(".printable").inner_text()
    caso("el recibo explica cada día, con sus autorizaciones, lo entregado y lo pendiente", "RECIBO INTERNO DE PAGO" in hoja and "CITA MEDICA DE PRUEBA" in hoja and "RODOLFO DE PRUEBA" in hoja and "$800" in hoja and "$500" in hoja and "$300" in hoja and "sin comprobante" in hoja, hoja[:200].replace("\n", " | "))
    caso("y dice que no es un CFDI de nómina", "No es un CFDI de nómina" in hoja and "SIN EMITIR" in hoja)
    pg.get_by_role("button", name="Emitir el recibo").click(); pg.wait_for_timeout(400)
    rc = de(pg, "recibo_personal")
    caso("al emitirlo queda guardado como versión 1, con la foto de ese momento", len(rc) == 1 and rc[0]["datos"]["version"] == 1 and rc[0]["datos"]["saldo"]["pendiente"] == 300 and "versión 1" in pg.locator(".printable").inner_text())
    pg.locator(".top-bar .btn-ghost").click(); pg.wait_for_timeout(300)
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Registrar pago").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("300"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Recibo").click(); pg.wait_for_timeout(300)
    caso("después de otro pago avisa que el recibo emitido ya no coincide, y NO lo cambia", pg.get_by_text("El recibo no se cambia").count() == 1 and "$300" in pg.locator(".printable").inner_text())
    pg.get_by_role("button", name="Como está hoy").click(); pg.get_by_role("button", name="Emitir una versión nueva").click(); pg.wait_for_timeout(200)
    caso("una versión nueva pide decir qué cambió", pg.get_by_text("hay que decir qué cambió").count() == 1 and len(de(pg, "recibo_personal")) == 1)
    pg.get_by_label("Qué cambió").fill("SE COMPLETO EL PAGO"); pg.get_by_role("button", name="Emitir una versión nueva").click(); pg.wait_for_timeout(400)
    rc = de(pg, "recibo_personal")
    caso("queda la versión 2 que sustituye a la 1, y la 1 sigue ahí tal como se emitió", len(rc) == 2 and rc[1]["datos"]["version"] == 2 and rc[1]["datos"]["sustituye"] == 1 and rc[0]["datos"]["saldo"]["pendiente"] == 300 and rc[1]["datos"]["saldo"]["pendiente"] == 0 and pg.get_by_role("button", name="Versión 1").count() == 1)
    pg.locator(".top-bar .btn-ghost").click(); pg.wait_for_timeout(300)

    # ══ Cuadrilla (al responsable) y temporal independiente (directo) ══
    ir(pg, "cuadrillas-dia"); pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("cq-prueba"); pg.get_by_label("Responsable").fill("DON CHUY DE PRUEBA")
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué hicieron").select_option("Cosecha")
    pg.get_by_label("Pago por día de cada persona ($)").fill("350"); gente(pg, [("UNO", None), ("DOS", None)])
    pg.get_by_label("Transporte").select_option("ninguno"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("__ind__")
    caso("a un temporal independiente no se le pide responsable ni se le ofrece 'precio por el trabajo'", pg.get_by_label("Responsable").count() == 0 and pg.locator(".tab-pill", has_text="Precio por el trabajo").count() == 0)
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué hicieron").select_option("Deshierbe")
    pg.get_by_label("Pago por día de cada persona ($)").fill("300"); gente(pg, [("CHEMA DE PRUEBA", None)])
    pg.get_by_label("Transporte").select_option("ninguno"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    cd = de(pg, "cuadrilla_dia")
    caso("quedan los dos registros, y el independiente marcado como tal", len(cd) == 2 and cd[1]["datos"].get("independiente") is True and not cd[0]["datos"].get("independiente"), [e["datos"].get("independiente") for e in cd])
    ir(pg, "nomina"); tab(pg, "Cuadrillas y temporales")
    cq = tarjeta(pg, "CUADRILLA DE PRUEBA"); ind = tarjeta(pg, "CHEMA DE PRUEBA")
    caso("la cuadrilla lleva UNA cuenta, la de su responsable, con quiénes vinieron", "$700" in cq.inner_text() and "se le entrega a DON CHUY DE PRUEBA" in cq.inner_text() and "UNO, DOS" in cq.inner_text(), cq.inner_text()[:160].replace("\n", " | "))
    caso("el temporal independiente lleva la suya, de pago directo", "$300" in ind.inner_text() and "se le paga directo" in ind.inner_text())
    cq.get_by_role("button", name="Registrar entrega").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("500"); pg.get_by_label("Responsable que recibió").fill("")
    modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(200)
    caso("la entrega a una cuadrilla exige el nombre del responsable que recibió", modal(pg).get_by_text("Falta el nombre del responsable").count() == 1)
    pg.get_by_label("Responsable que recibió").fill("DON CHUY DE PRUEBA"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    cq = tarjeta(pg, "CUADRILLA DE PRUEBA").inner_text()
    caso("entregado $500, pendiente $200, y avisa que eso no dice que cada integrante ya cobró", "$500" in cq and "$200" in cq and "no dice que cada integrante ya cobró" in cq, cq[-220:].replace("\n", " | "))
    tarjeta(pg, "CUADRILLA DE PRUEBA").get_by_role("button", name="Constancia de entrega").click(); pg.wait_for_timeout(300)
    hoja = pg.locator(".printable").inner_text()
    caso("el documento de la cuadrilla es una constancia de entrega al responsable, no un recibo individual", "CONSTANCIA DE ENTREGA AL RESPONSABLE" in hoja and "No acredita el pago individual" in hoja and "DON CHUY DE PRUEBA" in hoja and "UNO" in hoja)
    pg.locator(".top-bar .btn-ghost").click(); pg.wait_for_timeout(300)

    # ══ Horas adicionales ══
    tab(pg, "Horas adicionales")
    caso("las horas adicionales se consultan por semana, mes y año, y dice que registrarlas no las salda", pg.locator(".tab-pill", has_text="El año").count() == 1 and pg.get_by_text("ni las da por saldadas").count() == 1)
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
