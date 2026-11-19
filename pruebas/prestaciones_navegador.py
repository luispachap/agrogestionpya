"""Prestaciones, costo de personal sin parcela, encargados y cierre de la semana, en navegador real.
Uso:  npx vite --port 5173 &   →   python3 pruebas/prestaciones_navegador.py"""
import json, pathlib, sys, re
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
hist = lambda s: [{"desde": "2020-01-01", "sueldo_dia": s, "anterior": s}]
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 365, "historialSueldo": hist(365), "pin": "4821", "fechaIngreso": "2024-03-01"},
                     {"id": "t-beto", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4822"},
                     {"id": "t-dora", "nombre": "DORA DE PRUEBA", "categoria": "jornalero", "modalidadPago": "destajo", "sueldo_dia": 0, "pin": "4823", "fechaIngreso": "2025-01-01"}]
S["encargados"] = [{"id": "enc-prueba", "nombre": "ENCARGADO DE PRUEBA", "pin": "5501", "categoria": "encargado", "sueldo_dia": 600, "historialSueldo": hist(600)}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
S["cultivos"] = [{"id": "c1", "nombre": "AJO DE PRUEBA"}]
S["siembras"] = [{"id": "s1", "parcelaId": "p1", "cultivoId": "c1", "cultivoNombre": "AJO DE PRUEBA", "fechaSiembra": "2026-10-01", "fechaCosechaEstimada": "2027-03-01", "superficie": 2, "estado": "activa"}]
S["prestamos"] = [{"id": "pr1", "trabajadorId": "t-beto", "fecha": "2026-10-01", "monto": 1000, "abonado": 0, "estado": "activo", "concepto": "PRESTAMO DE PRUEBA"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
eventos = lambda pg: sorted(pg.evaluate(LEER), key=lambda e: e["capturado"])
de = lambda pg, tipo: [e for e in eventos(pg) if e["tipo"] == tipo]
guardado = lambda pg, sec: pg.evaluate("s => JSON.parse(localStorage.getItem('agro_v8:local'))[s]", sec)
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(300)
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).last
modal = lambda pg: pg.locator(".modal-sheet")
plano = lambda t: t.replace("\n", " | ")
def ausencia(pg, quien, dia, clase, causa=None, autorizo="RODOLFO DE PRUEBA"):
    pg.get_by_role("button", name="Registrar permiso, descanso, vacaciones o falta").click()
    pg.get_by_label("De quién").select_option(quien); pg.get_by_label("Desde").fill(dia); pg.get_by_label("Hasta").fill(dia); pg.get_by_label("Qué fue").select_option(clase)
    if causa: pg.get_by_label("Causa").fill(causa)
    if clase != "falta": pg.get_by_label("Quién autorizó").fill(autorizo)
    modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City", accept_downloads=True)
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-19T07:00:00-06:00")     # jueves; la semana es del lunes 16 al domingo 22
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)

    # Ana y Beto checan a las 7, van a la parcela y salen a las 5: diez horas.
    ir(pg, "checador"); teclea(pg, "4821"); teclea(pg, "4822")
    ir(pg, "reparto")
    for n in ["ANA", "BETO"]: pg.locator(".rep-ficha", has_text=n).click()
    pg.get_by_label("Parcela o vehículo").select_option("p1"); pg.get_by_label("Qué van a hacer").select_option("Riego")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(300)
    pg.clock.fast_forward(10 * 3600 * 1000); pg.wait_for_timeout(300)
    ir(pg, "checador"); teclea(pg, "4821"); teclea(pg, "4822")

    # ══ Horas adicionales, con datos que de verdad las generan ══
    ir(pg, "nomina"); tab(pg, "Horas adicionales")
    ha = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("una jornada de 10 horas deja 2 horas adicionales registradas, sin tratar", "2 h 00 min" in ha and "Sin tratar" in ha and "1 día(s)" in ha, plano(ha)[:160])
    tab(pg, "Planta")
    caso("y registrarlas no cambió el pago: su día sigue siendo $365", "$365" in tarjeta(pg, "ANA DE PRUEBA").inner_text())

    # ══ Un permiso pagado es costo de personal, no una actividad en la parcela ══
    tab(pg, "Asistencia"); ausencia(pg, "t-beto", "2026-11-18", "permiso", "CITA DE PRUEBA")
    ausencia(pg, "enc-prueba", "2026-11-18", "descanso", "DESCANSO DE PRUEBA")
    caso("a un encargado también se le registran permisos, descansos y faltas", len(de(pg, "ausencia")) == 2 and de(pg, "ausencia")[1]["datos"]["trabajadorId"] == "enc-prueba")
    tab(pg, "Planta")
    caso("al encargado le corresponde su descanso pagado ($600)", "$600" in tarjeta(pg, "ENCARGADO DE PRUEBA").inner_text() and "encargado" in tarjeta(pg, "ENCARGADO DE PRUEBA").inner_text())
    tab(pg, "Costo sin parcela")
    per = pg.locator(".card", has_text="Días y ratos pagados sin actividad en parcela")
    caso("el permiso de Beto se reparte según sus actividades del mes; el descanso del encargado queda pendiente", "Repartido a parcelas" in per.inner_text() and "$400" in per.inner_text() and "Pendiente de distribuir" in per.inner_text() and "$600" in per.inner_text(), plano(per.inner_text())[:260])
    per.get_by_role("button", name="Ver de dónde sale cada importe").click(); pg.wait_for_timeout(200)
    t = per.inner_text()
    caso("cada importe dice de quién es, qué fue, su causa, y por qué no se repartió el que no", "BETO DE PRUEBA · Permiso pagado del 2026-11-18 (CITA DE PRUEBA)" in t and "PARCELA UNO" in t and "ENCARGADO DE PRUEBA · Descanso pagado" in t and "no tiene actividades en parcelas en 2026-11" in t, plano(t)[-300:])
    ir(pg, "reportes"); pg.locator(".list-item", has_text="AJO DE PRUEBA 2027").first.click(); pg.wait_for_timeout(400)
    dc = pg.locator(".card", has_text="Costo directo y costo completo")
    num = lambda x: float(re.sub(r"[^0-9.]", "", x))
    filas = {f.locator("span").first.inner_text().split("\n")[0]: num(f.locator("b").last.inner_text()) for f in dc.locator(".mo-act").all()} if dc.count() else {}
    caso("en el reporte de la temporada el permiso entra al costo completo y NO al directo ($765 de los dos días trabajados)", filas.get("Costo directo") == 765 and "Indirecto: Personal: pagado sin actividad en parcela" in dc.inner_text() and filas.get("Costo completo", 0) > 765 + 400 - 0.01, json.dumps(filas, ensure_ascii=False))

    # ══ Encargado: asistencia por calendario, y checador si quiere ══
    ir(pg, "equipo"); tab(pg, "Encargados")
    pg.get_by_role("button", name="Pagar por calendario").click(); pg.wait_for_timeout(200)
    caso("activar el pago por calendario pide la fecha de inicio, encargado por encargado", pg.get_by_label("Desde qué día se le paga por calendario").count() == 1 and not guardado(pg, "encargados")[0].get("calendario"))
    pg.get_by_label("Desde qué día se le paga por calendario").fill("2026-11-19"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    enc = guardado(pg, "encargados")[0]; cal = (enc.get("calendario") or [{}])[0]
    caso("queda con su fecha de inicio y quién lo activó; no se le inventan días de antes", cal.get("desde") == "2026-11-19" and cal.get("activo", {}).get("el") == "2026-11-19" and bool(cal.get("activo", {}).get("por")) and pg.get_by_text("Lo activó").count() == 1, enc.get("calendario"))
    ir(pg, "nomina")
    e = tarjeta(pg, "ENCARGADO DE PRUEBA").inner_text()
    caso("le corresponden su descanso y el día de hoy por calendario ($1,200), sin horario inventado", "$1,200" in e and "1 por calendario" in e, plano(e)[:160])
    tab(pg, "Costo sin parcela")
    caso("y ese día sin actividad registrada queda como costo de personal pendiente, no en una parcela", "$1,200" in pg.locator(".card", has_text="Días y ratos pagados sin actividad en parcela").inner_text())
    ir(pg, "checador"); teclea(pg, "5501")
    m = [x for x in de(pg, "marca") if x["datos"]["trabajadorId"] == "enc-prueba"]
    caso("el encargado también puede checar con su PIN", len(m) == 1 and m[0]["datos"]["sentido"] == "entrada" and pg.get_by_text("ENCARGADO DE PRUEBA").count() >= 1)
    ir(pg, "nomina")
    caso("y checar no le paga dos veces el día: siguen siendo $1,200", "$1,200" in tarjeta(pg, "ENCARGADO DE PRUEBA").inner_text(), plano(tarjeta(pg, "ENCARGADO DE PRUEBA").inner_text())[:140])

    # ══ Abono a préstamo: ligado a la semana, aunque el pago se haya registrado antes ══
    bt = tarjeta(pg, "BETO DE PRUEBA")
    caso("a Beto le corresponden $800 (su día y su permiso) y debe $1,000", "$800" in bt.inner_text() and "Debe $1,000" in bt.inner_text())
    bt.get_by_role("button", name="Registrar pago").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("500"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    bt = tarjeta(pg, "BETO DE PRUEBA"); bt.get_by_placeholder("Descuento").fill("200"); bt.get_by_role("button", name="Abonar a préstamo").click(); pg.wait_for_timeout(400)
    bt = tarjeta(pg, "BETO DE PRUEBA").inner_text(); pr = guardado(pg, "prestamos")[0]
    caso("el abono hecho DESPUÉS del pago cuenta en la misma semana: neto $600, entregado $500, pendiente $100", "$600" in bt and "$500" in bt and "$100" in bt and "abonado esta semana $200" in bt, plano(bt)[:300])
    ab = de(pg, "abono_prestamo")
    caso("el abono es un movimiento propio, con su préstamo y su semana; el préstamo guardado no se sobrescribe y el pago no lleva el descuento", len(ab) == 1 and ab[0]["datos"]["prestamoId"] == "pr1" and ab[0]["datos"]["monto"] == 200 and ab[0]["datos"]["semana"] == {"desde": "2026-11-16", "hasta": "2026-11-22"} and pr["abonado"] == 0 and "abonos" not in pr and "descuento" not in de(pg, "pago_personal")[0]["datos"], ab[0]["datos"] if ab else pr)
    ir(pg, "personal"); tab(pg, "Préstamos")
    pt = pg.locator("body").inner_text()
    caso("en Préstamos el saldo sale calculado de sus abonos ($200 de $1,000)", "$200" in pt and "$800" in pt, plano(pt)[:300])
    ir(pg, "nomina")

    # ══ El recibo se conserva también como archivo PDF ══
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Recibo").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Emitir el recibo").click(); pg.wait_for_timeout(600)
    rc = de(pg, "recibo_personal")
    caso("al emitir, el recibo guarda su PDF junto con su contenido", len(rc) == 1 and str(rc[0]["datos"].get("pdf", "")).startswith(("data:application/pdf", "archivo:")) and rc[0]["datos"]["saldo"]["pendiente"] == 100, str(rc[0]["datos"].get("pdf", ""))[:40] if rc else "")
    liga = pg.get_by_role("link", name="Descargar el PDF de esta versión")
    caso("y se puede descargar el PDF de esa versión", liga.count() == 1)
    if liga.count():
        with pg.expect_download() as d: liga.click()
        ruta = d.value.path(); cab = open(ruta, "rb").read()
        caso("lo descargado es un PDF de verdad, con el nombre, el pendiente y la leyenda de que no sustituye un CFDI", cab.startswith(b"%PDF-") and b"BETO DE PRUEBA" in cab and b"Pendiente: $100" in cab and b"No es un CFDI" in cab, cab[:20])
    pg.locator(".top-bar .btn-ghost").click(); pg.wait_for_timeout(300)

    # ══ Cierre de la semana, y aparte la confirmación de los pagos ══
    ci = lambda: pg.locator(".card", has_text=re.compile("Semana abierta|Cálculo cerrado|Semana reabierta")).first
    caso("la semana empieza abierta, con el total de lo calculado ($2,365)", "Semana abierta" in ci().inner_text() and "$2,365" in ci().inner_text(), plano(ci().inner_text())[:120])
    ci().get_by_role("button", name="Cerrar el cálculo de la semana").click(); pg.wait_for_timeout(400)
    c1 = de(pg, "cierre_semana")
    caso("cerrar guarda la foto del cálculo de cada persona, y NO confirma ningún pago", len(c1) == 1 and c1[0]["datos"]["total"] == 2365 and len(c1[0]["datos"]["renglones"]) == 3 and "versión 1" in ci().inner_text() and "todavía no se han confirmado" in ci().inner_text() and len(de(pg, "confirmacion_pagos")) == 0, plano(ci().inner_text())[:200])
    ci().get_by_role("button", name="Confirmar los pagos de la semana").click(); pg.wait_for_timeout(300)
    caso("confirmar los pagos con dinero pendiente pide anotar por qué", "hay que anotar por qué" in ci().inner_text() and len(de(pg, "confirmacion_pagos")) == 0)
    pg.get_by_label("Nota de la confirmación").fill("EL RESTO EL SABADO"); ci().get_by_role("button", name="Confirmar los pagos de la semana").click(); pg.wait_for_timeout(400)
    cf = de(pg, "confirmacion_pagos")
    caso("la confirmación queda aparte, con lo entregado y lo que falta", len(cf) == 1 and cf[0]["datos"]["entregado"] == 500 and cf[0]["datos"]["pendiente"] > 0 and cf[0]["datos"]["cierre"] == c1[0]["id"] and "Pagos confirmados por" in ci().inner_text())
    tab(pg, "Asistencia")
    caso("en una semana cerrada avisa que lo nuevo saldrá como diferencia", pg.get_by_text("Esta semana ya está cerrada").count() == 1)
    ausencia(pg, "t-ana", "2026-11-17", "permiso", "TRAMITE DE PRUEBA")
    tab(pg, "Planta")
    caso("lo registrado después del cierre se ve como diferencia, y la foto del cierre no cambia", "Después del cierre cambió $365" in ci().inner_text() and "al cerrar eran $365, hoy son $730" in ci().inner_text() and de(pg, "cierre_semana")[0]["datos"]["total"] == 2365, plano(ci().inner_text())[:260])
    ci().get_by_role("button", name="Reabrir la semana").click(); pg.wait_for_timeout(300)
    caso("reabrir pide el motivo", "hay que decir por qué" in ci().inner_text() and len(de(pg, "reapertura_semana")) == 0)
    pg.get_by_label("Por qué se reabre").fill("PERMISO QUE FALTABA"); ci().get_by_role("button", name="Reabrir la semana").click(); pg.wait_for_timeout(400)
    caso("queda reabierta, diciendo quién, por qué, y que la versión 1 se conserva", "Semana reabierta" in ci().inner_text() and "PERMISO QUE FALTABA" in ci().inner_text() and "La versión 1 se conserva" in ci().inner_text())
    ci().get_by_role("button", name="Cerrar otra vez (versión 2)").click(); pg.wait_for_timeout(300)
    caso("el cierre nuevo pide decir qué cambió", "hay que decir qué cambió" in ci().inner_text() and len(de(pg, "cierre_semana")) == 1)
    pg.get_by_label("Qué cambió en este cierre").fill("CON EL PERMISO DE ANA"); ci().get_by_role("button", name="Cerrar otra vez (versión 2)").click(); pg.wait_for_timeout(400)
    cs = de(pg, "cierre_semana")
    caso("queda la versión 2 y la 1 sigue guardada tal cual; los pagos de la versión nueva se confirman otra vez", len(cs) == 2 and cs[0]["datos"]["total"] == 2365 and cs[1]["datos"]["total"] == 2730 and cs[1]["origen"] == cs[0]["id"] and "versión 2" in ci().inner_text() and "todavía no se han confirmado" in ci().inner_text(), [x["datos"]["total"] for x in cs])
    ci().get_by_role("button", name="Ver historial del cierre").click(); pg.wait_for_timeout(200)
    h = ci().inner_text()
    caso("el historial enseña los dos cierres, la reapertura y la confirmación", "Cierre versión 1: $2,365" in h and "Cierre versión 2: $2,730" in h and "Reapertura: PERMISO QUE FALTABA" in h and "Confirmación de pagos" in h)

    # ══ Prestaciones ══
    tab(pg, "Prestaciones")
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); bt = tarjeta(pg, "BETO DE PRUEBA").inner_text(); do = tarjeta(pg, "DORA DE PRUEBA").inner_text()
    caso("mientras no se declare la fecha de corte, lo dice y toma el primer día con registros", pg.get_by_text("Todavía no se ha declarado la fecha de corte").count() == 1 and "generado después $45" in a, plano(a)[:200])
    pg.get_by_label(re.compile("fecha de corte")).fill("2026-07-01"); pg.locator(".form-group", has_text="fecha de corte").get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(500)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("con la fecha de corte declarada, Ana lleva $2,130 de aguinaldo generados después; lo de antes es sólo una referencia", pg.get_by_text("Fecha de corte: 2026-07-01").count() == 1 and "2 años cumplidos" in a and "saldo inicial $0 · generado después $2,130" in a and "se habrían generado $2,715" in a and "no es saldo mientras nadie lo capture" in a, plano(a)[:360])
    caso("corre su tercer año de servicio (16 días) y no se inventa cuántos días traía", "corre su año 3" in a and "son 16 días" in a and "No se sabe cuántos días traía" in a)
    caso("de Beto no se calcula nada: falta su fecha de ingreso, y eso no es un cero", "Pendiente de revisión: falta la fecha de ingreso" in bt and "no quiere decir que sea cero" in bt)
    caso("Dora cobra por destajo: no se le inventa un sueldo; queda pendiente de revisión, no en cero", "cobra por lo que hace" in do and "Pendiente de revisión" in do and "no hay días trabajados registrados" in do and "No vale cero" in do, plano(do)[:300])
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Poner fecha de ingreso").click()
    modal(pg).get_by_label("Fecha de ingreso").fill("2026-01-01"); pg.get_by_label("Días de aguinaldo por año", exact=True).fill("30")
    pg.get_by_label("Relación de trabajo").select_option("temporada"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    bt = tarjeta(pg, "BETO DE PRUEBA").inner_text(); fb = [t for t in guardado(pg, "trabajadores") if t["id"] == "t-beto"][0]
    caso("con su fecha de ingreso, su relación de trabajo y sus 30 días de aguinaldo ya genera", "Pendiente de revisión" not in bt and fb["fechaIngreso"] == "2026-01-01" and fb["prestaciones"]["aguinaldoDias"] == 30 and fb["relacionLaboral"] == "temporada" and "De temporada" in bt, plano(bt)[:200])
    # Saldo inicial: lo que ya traía al corte
    tarjeta(pg, "ANA DE PRUEBA").get_by_role("button", name="Saldo inicial").click()
    pg.get_by_label("De qué es el saldo").select_option("aguinaldo"); pg.get_by_label("Periodo del saldo").select_option("2026"); pg.get_by_label("Importe ($)").fill("2700")
    modal(pg).get_by_role("button", name="Guardar saldo inicial").click(); pg.wait_for_timeout(200)
    caso("el saldo inicial pide en qué se funda el cálculo y quién responde", "Falta decir en qué se funda" in modal(pg).inner_text() and len(de(pg, "prestacion_saldo_inicial")) == 0)
    pg.get_by_label("En qué se funda el cálculo").fill("CALCULO DE PRUEBA DEL DESPACHO"); pg.get_by_label("Quién responde por este saldo").fill("LUIS DE PRUEBA")
    modal(pg).get_by_role("button", name="Guardar saldo inicial").click(); pg.wait_for_timeout(400)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); si = de(pg, "prestacion_saldo_inicial")
    caso("queda el saldo inicial con su fundamento y su responsable, aparte de lo generado después; se le deben $4,830", len(si) == 1 and si[0]["datos"]["monto"] == 2700 and si[0]["datos"]["corte"] == "2026-06-30" and "saldo inicial $2,700 · generado después $2,130" in a and "$4,830" in a and "CALCULO DE PRUEBA DEL DESPACHO" in a and "responde LUIS DE PRUEBA" in a and "sin evidencia" in a, plano(a)[:400])
    tarjeta(pg, "ANA DE PRUEBA").get_by_role("button", name="Determinar").click()
    pg.get_by_label("Qué prestación").select_option("aguinaldo"); pg.get_by_label("De qué periodo").select_option("2026")
    caso("al determinar propone la cifra con su cuenta a la vista, y no la impone", "saldrían $4,845" in modal(pg).inner_text() and "15 días por año completo" in modal(pg).inner_text(), plano(modal(pg).inner_text())[:300])
    pg.get_by_label("Importe determinado ($)").fill("5000"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(200)
    caso("determinar pide quién lo autoriza", "Falta quién lo autoriza" in modal(pg).inner_text())
    pg.get_by_label("Quién lo autoriza").fill("RODOLFO DE PRUEBA"); modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); dt = de(pg, "prestacion_determinada")
    caso("queda determinado en $5,000 y al costo sólo se agrega el ajuste de $170 (5,000 − 2,700 de saldo inicial − 2,130 ya generados)", len(dt) == 1 and dt[0]["datos"]["monto"] == 5000 and "determinado $5,000" in a and "ajustes $170" in a, plano(a)[:400])
    tarjeta(pg, "ANA DE PRUEBA").locator(".mo-act", has_text="año 2026: $5,000").get_by_role("button", name="Pagar").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("3000"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("el pago baja lo que se debe (de $5,000 a $2,000) y no cambia lo generado ni el ajuste", "pagado $3,000" in a and "$2,000" in a and "ajustes $170" in a and "generado después $2,130" in a and len(de(pg, "pago_prestacion")) == 1, plano(a)[:400])
    tab(pg, "Asistencia"); ausencia(pg, "t-ana", "2026-11-16", "vacaciones")
    tab(pg, "Prestaciones")
    caso("un día de vacaciones se descuenta de sus días", "Ha tomado 1" in tarjeta(pg, "ANA DE PRUEBA").inner_text())
    tab(pg, "Costo sin parcela")
    per = pg.locator(".card", has_text="Días y ratos pagados sin actividad en parcela").inner_text(); prs = pg.locator(".card", has_text="Aguinaldo, vacaciones y prima que se van generando")
    caso("las vacaciones NO entran como día pagado sin actividad (ya se generaron como prestación)", "$765" in per and "$1,130" not in per, plano(per)[:200])
    prs.get_by_role("button", name="Ver de dónde sale cada importe").click(); pg.wait_for_timeout(200)
    caso("el saldo inicial no aparece en el costo de ninguna parcela", "$2,700" not in prs.inner_text() and "2,700" not in pg.locator(".card", has_text="Días y ratos pagados sin actividad en parcela").inner_text())
    caso("las prestaciones se reparten a la parcela donde trabajó cada quien, con el ajuste identificado", "Repartido a parcelas" in prs.inner_text() and "PARCELA UNO" in prs.inner_text() and "ajuste al determinar" in prs.inner_text() and "÷ 365" in prs.inner_text(), plano(prs.inner_text())[:300])
    ir(pg, "reportes"); pg.locator(".list-item", has_text="AJO DE PRUEBA 2027").first.click(); pg.wait_for_timeout(400)
    dc = pg.locator(".card", has_text="Costo directo y costo completo")
    filas = {f.locator("span").first.inner_text().split("\n")[0]: num(f.locator("b").last.inner_text()) for f in dc.locator(".mo-act").all()} if dc.count() else {}
    caso("el reporte sigue con el mismo costo directo ($765) y ahora suma las prestaciones al completo", filas.get("Costo directo") == 765 and "Indirecto: Prestaciones" in dc.inner_text(), json.dumps(filas, ensure_ascii=False))
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
