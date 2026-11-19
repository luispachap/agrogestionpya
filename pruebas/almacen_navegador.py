"""Tres cosas en navegador real:
 1 · La misma cuadrilla capturada por la pantalla anterior Y por Cuadrillas cuesta UNA vez.
 2 · El operador del camión: su rato de traslado se le carga al vehículo, con lo que ya gana.
 3 · El almacén: entregar no es gastar; el costo nace al decir cuánto se usó.
Uso:  npx vite --port 5173 &   →   python3 pruebas/almacen_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
hist = lambda s: [{"desde": "2026-01-01", "sueldo_dia": s, "anterior": s}]
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4821"}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
S["cultivos"] = [{"id": "c1", "nombre": "AJO DE PRUEBA"}]
S["siembras"] = [{"id": "s1", "parcelaId": "p1", "cultivoId": "c1", "cultivoNombre": "AJO DE PRUEBA", "fechaSiembra": "2026-10-01", "fechaCosechaEstimada": "2027-03-01", "superficie": 2, "estado": "activa"}]
S["maquinaria"] = [{"id": "m-camion", "nombre": "CAMION AMARILLO DE PRUEBA"}]
S["inventario"] = [
    {"id": "i-urea", "nombre": "UREA DE PRUEBA", "unidad": "bulto", "existencia": 50, "costo_unit": 868},
    {"id": "i-diesel", "nombre": "DIESEL DE PRUEBA", "unidad": "L", "existencia": 400, "costo_unit": 24.5},
    {"id": "i-pala", "nombre": "PALA DE PRUEBA", "unidad": "pieza", "existencia": 6, "esHerramienta": True},
]
# La captura de ANTES: la cuadrilla registrada como actividad, con su costo tecleado.
S["actividades"] = [{"id": "a-vieja", "fecha": "2026-11-19", "parcelaId": "p1", "tipo": "Cosecha", "registradoPor": {"tipo": "cuadrilla", "id": "cq-prueba"},
                     "costoMO": 1500, "flete": 0, "costoInsumos": 0, "costoMaq": 0, "costoTotal": 1500, "modalidadPago": "jornal", "cuadrilla_personas": 5, "insumos": []}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
eventos = lambda pg: sorted(pg.evaluate(LEER), key=lambda e: e["capturado"])
de = lambda pg, tipo: [e for e in eventos(pg) if e["tipo"] == tipo]
catalogo = lambda pg: {a["id"]: a for a in json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))["inventario"]}
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(300)
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(300)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).click(); pg.wait_for_timeout(250)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; avisos = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: (avisos.append(d.message), d.accept()))
    pg.clock.install(time="2026-11-19T07:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)

    # ══ 1 · Una sola fuente para la cuadrilla ══
    ir(pg, "mano-obra")
    caso("antes de registrar en Cuadrillas, la captura anterior cuenta normal", pg.get_by_text("Capturas anteriores que ya no cuentan").count() == 0)
    ir(pg, "cuadrillas-dia"); pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("cq-prueba")
    caso("al escoger la cuadrilla avisa que ese día ya está capturado por la pantalla anterior, y por cuánto", pg.get_by_text("Ese día ya está capturado por la pantalla anterior").count() == 1 and "$1,500" in pg.locator(".card", has_text="pantalla anterior").inner_text())
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué hicieron").select_option("Cosecha")
    pg.locator(".tab-pill", has_text="Precio por el trabajo").click()
    pg.get_by_label("En cuánto se acordó todo el trabajo ($)").fill("1800"); pg.get_by_label("Cuántos vinieron").fill("5")
    pg.get_by_label("Hectáreas trabajadas").fill("2"); pg.get_by_label("Nota", exact=True).fill("NOTA DE PRUEBA")
    pg.get_by_label("Transporte").select_option("propio"); pg.get_by_label("Vehículo").select_option("m-camion")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    d = de(pg, "cuadrilla_dia")
    caso("el precio por el trabajo queda como UN pago al grupo, con hectáreas y nota", len(d) == 1 and d[0]["datos"]["modalidad"] == "precio" and d[0]["datos"]["precio"] == {"monto": 1800, "nombres": [], "personas": 5} and d[0]["datos"]["hectareas"] == 2 and d[0]["datos"]["nota"] == "NOTA DE PRUEBA", json.dumps(d[0]["datos"]) if d else "")
    ir(pg, "mano-obra")
    t = pg.locator(".card", has_text="Capturas anteriores que ya no cuentan")
    caso("la captura anterior deja de contar: $1,500 fuera, sin borrarla", t.count() == 1 and "$1,500" in t.inner_text())
    caso("y lo ganado por el personal es $1,800, no $3,300", "$1,800" in pg.locator(".card", has_text="Lo que se ganó el personal").inner_text() and pg.get_by_text("$3,300").count() == 0, pg.locator(".card", has_text="Lo que se ganó el personal").inner_text()[:90])
    datos = json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))
    caso("la actividad anterior sigue guardada tal cual", [a for a in datos["actividades"] if a["id"] == "a-vieja"][0]["costoMO"] == 1500)
    ir(pg, "registrar-actividad")
    caso("el registro de actividades del administrador ya no ofrece cuadrillas", pg.get_by_text("Las cuadrillas se registran en la pantalla Cuadrillas").count() == 1 and pg.locator(".parcela-card", has_text="CUADRILLA DE PRUEBA").count() == 0)
    ir(pg, "registro-masivo")
    caso("ninguna pantalla tronó hasta aquí", not g["trono"](pg) and not errs, errs[:1])

    # ══ 2 · El operador del camión ══
    ir(pg, "checador"); teclea(pg, "4821")
    ir(pg, "reparto"); pg.locator(".rep-ficha", has_text="ANA").click()
    pg.get_by_label("Parcela o vehículo").select_option("v:m-camion")
    caso("al escoger un vehículo propone 'Traslado de personal'", pg.get_by_label("Qué van a hacer").input_value() == "Traslado de personal")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)
    a = de(pg, "asignacion")
    caso("queda asignada al camión, no a una parcela", len(a) == 1 and a[0]["datos"].get("vehiculoId") == "m-camion" and a[0]["datos"]["parcelaId"] is None, json.dumps(a[0]["datos"]) if a else "")
    caso("la pantalla la enseña en el camión", pg.locator(".card", has_text="CAMION AMARILLO").locator(".rep-ficha").count() == 1)
    avanza(pg, 2)   # 09:00 — termina el traslado y se va a la parcela
    pg.locator(".rep-ficha", has_text="ANA").click()
    pg.get_by_label("Parcela o vehículo").select_option("p1"); pg.get_by_label("Qué van a hacer").select_option("Riego")
    pg.get_by_role("button", name="Asignar desde ahorita").click(); pg.wait_for_timeout(400)

    # ══ 3 · El almacén ══
    ir(pg, "entregas")
    pg.get_by_label("Artículo").select_option("i-urea"); pg.get_by_label("Cantidad").fill("10")
    pg.locator("button.btn-accent", has_text="Entregar").click(); pg.wait_for_timeout(250)
    caso("no entrega sin decir quién lo recibe", pg.get_by_text("Falta decir quién lo recibe").count() == 1 and len(de(pg, "alm_retiro")) == 0)
    pg.get_by_label("Quién lo recibe").select_option("trabajador|t-ana")
    pg.get_by_label("Para qué es").select_option("parcela"); pg.get_by_label("Parcela", exact=True).select_option("p1"); pg.get_by_label("Actividad").select_option("Fertilización")
    pg.locator("button.btn-accent", has_text="Entregar").click(); pg.wait_for_timeout(400)
    r = de(pg, "alm_retiro")
    caso("la entrega queda con su responsable y para qué es", len(r) == 1 and r[0]["datos"]["recibe"]["nombre"] == "ANA DE PRUEBA" and r[0]["datos"]["destino"]["id"] == "p1" and r[0]["datos"]["cantidad"] == 10)
    caso("el catálogo guardado NO cambió: lo que movió el evento no se guarda dos veces", catalogo(pg)["i-urea"]["existencia"] == 50)
    tab(pg, "Qué hay")
    urea = pg.locator(".card", has_text="UREA DE PRUEBA")
    caso("en el almacén quedan 40 y se ve quién trae los otros 10", "40 bulto" in urea.inner_text() and "Lo trae ANA DE PRUEBA" in urea.inner_text(), urea.inner_text()[:120])
    ir(pg, "inventario"); pg.wait_for_timeout(500)
    inv = pg.locator("body").inner_text(); tras = inv.split("UREA DE PRUEBA")[1][:90] if "UREA DE PRUEBA" in inv else "(no aparece)"
    caso("la pantalla de Inventario de siempre también ve 40", "40 bulto" in tras[:30], tras.replace("\n", " | "))
    ir(pg, "mano-obra")
    caso("entregar no generó ningún costo todavía", pg.get_by_text("$5,208").count() == 0)

    # una herramienta prestada
    ir(pg, "entregas")
    pg.get_by_label("Artículo").select_option("i-pala"); pg.get_by_label("Cantidad").fill("2"); pg.get_by_label("Quién lo recibe").select_option("trabajador|t-ana")
    caso("una herramienta no pregunta para qué: se presta", pg.get_by_label("Para qué es").count() == 0 and pg.get_by_text("se presta y se devuelve").count() == 1)
    pg.locator("button.btn-accent", has_text="Entregar").click(); pg.wait_for_timeout(300)
    # diésel directo al camión
    tab(pg, "Usar directo")
    pg.get_by_label("Artículo").select_option("i-diesel"); pg.get_by_label("Cantidad").fill("60")
    pg.get_by_role("button", name="Registrar el uso").click(); pg.wait_for_timeout(250)
    caso("el uso directo exige decir en qué se usó", pg.get_by_text("Falta decir en qué se usó").count() == 1)
    pg.get_by_label("Para qué es").select_option("vehiculo"); pg.get_by_label("Vehículo").select_option("m-camion")
    pg.get_by_role("button", name="Registrar el uso").click(); pg.wait_for_timeout(400)
    c = de(pg, "alm_consumo")
    caso("el diésel al tanque queda como consumo del camión, a su costo promedio", len(c) == 1 and c[0]["datos"]["destino"]["id"] == "m-camion" and c[0]["datos"]["costoUnit"] == 24.5 and "$1,470" in pg.locator(".card", has_text="Usado:").inner_text())

    # 15:00 — se cierra lo de Ana: usó 6, regresó 3, 1 se queda con ella; de las palas regresó 1 y rompió 1
    avanza(pg, 6)
    tab(pg, "Por cerrar")
    caso("la conciliación enseña sólo lo que sigue fuera: la urea y las palas", pg.locator(".tab-pill", has_text="Por cerrar (2)").count() == 1)
    u = pg.locator(".card", has_text="UREA DE PRUEBA"); u.get_by_role("button", name="Cerrar: se usó o regresó").click()
    pg.get_by_label("Se usó").fill("8"); pg.get_by_label("Regresó al almacén").fill("5")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(250)
    caso("no deja cerrar más de lo que traía", pg.get_by_text("Le quedaban 10").count() == 1 and len(de(pg, "alm_consumo")) == 1)
    pg.get_by_label("Se usó").fill("6"); pg.get_by_label("Regresó al almacén").fill("3")
    caso("y dice cuánto sigue con ella", pg.get_by_text("Lo demás (1 bulto) sigue con ANA DE PRUEBA").count() == 1)
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    cons = [e for e in de(pg, "alm_consumo") if e.get("origen")]
    caso("el consumo apunta a su entrega y lleva el costo promedio del momento", len(cons) == 1 and cons[0]["origen"] == r[0]["id"] and cons[0]["datos"]["cantidad"] == 6 and cons[0]["datos"]["costoUnit"] == 868 and len(de(pg, "alm_devolucion")) == 1)
    caso("lo usado hoy ya trae su costo: 6 × $868 = $5,208", "$5,208" in pg.locator(".card", has_text="Lo que se usó hoy").inner_text())
    pl = pg.locator(".card", has_text="PALA DE PRUEBA"); pl.get_by_role("button", name="Regresó o cambió de manos").click()
    caso("a una herramienta no se le pregunta cuánto se usó", pg.get_by_label("Se usó").count() == 0)
    pg.get_by_label("Regresó al almacén").fill("1"); pg.get_by_label("Se rompió, se perdió o se acabó").fill("1")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(250)
    caso("una baja sin causa no se guarda", pg.get_by_text("Falta decir por qué se da de baja").count() == 1)
    pg.get_by_label("Por qué se da de baja").select_option("otro"); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(250)
    caso("'otro caso' pide escribir qué pasó", pg.get_by_text("hay que escribir qué pasó").count() == 1)
    pg.get_by_label("Por qué se da de baja").select_option("accidente"); pg.get_by_label("Qué pasó, con detalle").fill("SE QUEBRO EL MANGO DE PRUEBA"); pg.get_by_label("Valor de cada pieza").fill("320")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    bj = de(pg, "alm_baja")
    caso("la pala rota queda como baja con causa, valor y qué pasó", len(bj) == 1 and bj[0]["datos"]["causa"] == "accidente" and bj[0]["datos"]["valorUnit"] == 320 and "MANGO" in bj[0]["datos"]["nota"])
    caso("la baja no generó ningún gasto ni descuento", len(json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')")).get("egresos", [])) == 0 and not [e for e in eventos(pg) if "descuento" in e["tipo"]])
    u = pg.locator(".card", has_text="UREA DE PRUEBA").first
    caso("el bulto que no se cerró sigue a cargo de Ana", "1 bulto" in u.inner_text() and pg.locator(".tab-pill", has_text="Por cerrar (1)").count() == 1, u.inner_text()[:80])
    u.get_by_role("button", name="Sigue con ANA").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Próxima revisión").fill("2026-11-25"); pg.get_by_role("button", name="Sigue en uso").click(); pg.wait_for_timeout(300)
    rv = de(pg, "alm_revision")
    caso("'sigue en uso' con fecha no es consumo ni devolución, y deja de preguntar hasta ese día", len(rv) == 1 and rv[0]["datos"].get("proxima") == "2026-11-25" and len(de(pg, "alm_devolucion")) == 2 and pg.locator(".tab-pill", has_text="Por cerrar").inner_text().strip() == "Por cerrar" and pg.get_by_text("se vuelve a preguntar el 2026-11-25").count() == 1)
    tab(pg, "Por revisar")
    caso("la baja queda esperando que un administrador decida, y dice que no descuenta nada", pg.locator(".tab-pill", has_text="Por revisar (1)").count() == 1 and pg.get_by_text("La baja no descuenta nada a nadie").count() == 1 and "la traía ANA DE PRUEBA" in pg.locator(".card", has_text="PALA DE PRUEBA").inner_text())
    pg.get_by_role("button", name="Dejar escrito qué se decidió").click(); pg.get_by_label("Qué se revisó o decidió").fill("ACCIDENTE, SIN RESPONSABILIDAD"); pg.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    caso("la decisión queda escrita aparte de la baja, con nombre", len(de(pg, "alm_resolucion")) == 1 and de(pg, "alm_resolucion")[0]["origen"] == bj[0]["id"] and pg.get_by_text("SIN RESPONSABILIDAD").count() == 1)
    tab(pg, "Qué hay")
    caso("existencias al final: urea 43, palas 5, diésel 340", "43 bulto" in pg.locator(".card", has_text="UREA DE PRUEBA").inner_text() and "5 pieza" in pg.locator(".card", has_text="PALA DE PRUEBA").inner_text() and "340 L" in pg.locator(".card", has_text="DIESEL DE PRUEBA").inner_text())
    pg.locator(".card", has_text="UREA DE PRUEBA").get_by_role("button", name="Su código").click(); pg.wait_for_timeout(300)
    caso("cada artículo tiene su código para pegar en el estante", pg.locator(".modal-sheet svg, .modal-sheet canvas, .modal-sheet img").count() >= 1)
    pg.locator(".modal-sheet").get_by_role("button", name="Cerrar").click()
    pg.locator(".card", has_text="UREA DE PRUEBA").get_by_role("button", name="Mover a otro lugar").click()
    pg.get_by_label("Cuánto se mueve").fill("20"); pg.get_by_label("A qué lugar").fill("BODEGA DOS DE PRUEBA"); pg.get_by_role("button", name="Mover", exact=True).click(); pg.wait_for_timeout(400)
    t = pg.locator(".card", has_text="UREA DE PRUEBA").inner_text()
    caso("mover a otra bodega no es gasto: 23 aquí y 20 allá", "23 bulto" in t and "En BODEGA DOS DE PRUEBA" in t and "20 bulto" in t, t[:140])

    # ══ Todo junto en Mano de obra ══
    ir(pg, "checador"); teclea(pg, "4821")      # 15:00 sale Ana: 2 h en el camión, 6 h en la parcela
    ir(pg, "mano-obra")
    v = pg.locator(".card", has_text="Lo que costaron los vehículos").inner_text()
    caso("el camión junta operador ($100 de 2 h) y diésel ($1,470), cada uno una vez", "CAMION AMARILLO" in v and "$100" in v and "$1,470" in v and "$1,570" in v, v[:200])
    caso("y aparece el viaje de la cuadrilla, sin importe propio", "1 viaje(s) con cuadrilla" in v)
    lo = pg.locator(".card", has_text="Lo que se ganó el personal").inner_text()
    caso("Ana sigue ganando su día ($400): manejar no fue un segundo pago", "Trabajadores de planta $400" in lo and "Operando vehículos" in lo, lo[:200])
    rv = pg.locator(".card", has_text="A qué benefició cada vehículo").inner_text()
    caso("ese costo del camión aparece repartido a la parcela donde trabajó la cuadrilla, como costo indirecto", "Repartido a parcelas" in rv and "$1,570" in rv and "PARCELA UNO" in rv, rv[:220].replace("\n", " | "))
    # ══ Los reportes de siempre: costo directo y costo completo ══
    ir(pg, "reportes"); pg.locator(".list-item", has_text="AJO DE PRUEBA 2027").first.click(); pg.wait_for_timeout(400)
    cuerpo = pg.locator("body").inner_text()
    dc = pg.locator(".card", has_text="Costo directo y costo completo")
    caso("el reporte de la temporada pone el costo completo como cifra principal y conserva el directo", cuerpo.count("$8,878") >= 2 and "$7,308" in pg.locator(".stat-card.wide").first.inner_text() and dc.count() == 1 and "Costo directo" in dc.inner_text() and "Indirecto: Vehículos y maquinaria" in dc.inner_text() and "$1,570" in dc.inner_text(), dc.inner_text()[:260].replace("\n", " | ") if dc.count() else cuerpo[:200])
    import re
    num = lambda t: float(re.sub(r"[^0-9.]", "", t))
    filas = {f.locator("span").first.inner_text().split("\n")[0]: num(f.locator("b").last.inner_text()) for f in dc.locator(".mo-act").all()}
    caso("costo completo = costo directo + lo indirecto, ni un peso más", abs(filas.get("Costo completo", 0) - filas.get("Costo directo", 0) - 1570) < 0.01 and filas.get("Costo directo", 0) > 0, json.dumps(filas, ensure_ascii=False))
    dc.get_by_role("button", name="Ver de dónde sale cada importe").click(); pg.wait_for_timeout(200)
    dc.locator("button.mo-act").first.click(); pg.wait_for_timeout(200)
    caso("cada importe indirecto se puede abrir: de qué vehículo, por qué criterio, y que no es un gasto más", "CAMION AMARILLO" in dc.inner_text() and "no es un gasto más" in dc.inner_text() and ("por horas de uso" in dc.inner_text() or "operador" in dc.inner_text()), dc.inner_text()[-260:].replace("\n", " | "))
    egr = json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')")).get("egresos", [])
    caso("repartir no creó ningún gasto nuevo", len(egr) == 0)
    ir(pg, "panel-parcelas"); ir(pg, "vales")
    caso("la pantalla de conteo ya no ofrece el vale de salida viejo", pg.get_by_text("Vale de salida").count() == 0 and pg.get_by_text("Conteo y mermas").count() >= 1)

    # ══ El insumo anotado en una actividad sale de lo que el trabajador trae: una sola fuente ══
    salir = "() => { for (const k of Object.keys(localStorage)) if (k.startsWith('agro_sesion')) localStorage.removeItem(k); sessionStorage.clear(); }"
    pg.evaluate(salir); pg.reload(); pg.wait_for_timeout(1200)
    entroT = g["entrar"](pg, "Trabajador", "4821"); pg.wait_for_timeout(400)
    caso("Ana entra y la app le recuerda lo que trae del almacén", entroT and "Traes del almacén" in pg.locator("body").inner_text() and "1 bulto de UREA DE PRUEBA" in pg.locator("body").inner_text())
    pg.locator(".parcela-card").first.click(); pg.wait_for_timeout(300)
    pg.locator(".act-card", has_text="Fertilización").click(); pg.wait_for_timeout(300)
    fila = pg.locator("select.inp", has=pg.locator("option[value='i-urea']")).first
    fila.select_option("i-urea"); pg.get_by_placeholder("Cant.").fill("1")
    pg.get_by_placeholder("Cant.").locator("xpath=following-sibling::button").first.click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Continuar →").click(); pg.wait_for_timeout(300)
    pg.locator("button.btn-accent", has_text="✓").click(); pg.wait_for_timeout(600)
    ca = [e for e in de(pg, "alm_consumo") if e["datos"].get("via") == "actividad"]
    caso("el insumo de su actividad queda como movimiento a su nombre, sin costo propio (el costo va en la actividad)", len(ca) == 1 and ca[0]["datos"]["usadoPor"]["id"] == "t-ana" and ca[0]["datos"]["cantidad"] == 1 and "costoUnit" not in ca[0]["datos"] and ca[0]["datos"]["destino"]["tipo"] == "parcela", json.dumps(ca[0]["datos"]) if ca else "")
    acts = json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))
    caso("la actividad lleva su costo de insumo ($868) y el catálogo sigue sin sobrescribirse", [a for a in acts["actividades"] if a.get("registradoPor", {}).get("id") == "t-ana"][-1]["costoInsumos"] == 868 and catalogo(pg)["i-urea"]["existencia"] == 50)
    pg.evaluate(salir); pg.reload(); pg.wait_for_timeout(1200); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    ir(pg, "entregas"); tab(pg, "Qué hay")
    t = pg.locator(".card", has_text="UREA DE PRUEBA").inner_text()
    caso("ese bulto salió de lo que ELLA traía: el almacén sigue en 23 y ya no trae nada", "23 bulto" in t and "Lo trae ANA" not in t, t[:140].replace("\n", " | "))
    tab(pg, "Por cerrar")
    caso("y su entrega quedó cerrada sola: no hay que capturarlo otra vez", pg.locator(".card", has_text="UREA DE PRUEBA").get_by_role("button", name="Cerrar: se usó o regresó").count() == 0)
    usado = pg.locator(".card", has_text="Lo que se usó hoy").inner_text()
    caso("lo usado hoy sigue sumando $6,678 (los 6 del cierre y el diésel): el bulto de la actividad no se cobra dos veces", "$6,678" in usado, usado[:80])

    # ══ La cuadrilla con su PIN ya no puede duplicar ══
    pg.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('agro_sesion')) localStorage.removeItem(k); sessionStorage.clear(); }")
    pg.reload(); pg.wait_for_timeout(1200)
    entro = g["entrar"](pg, "Cuadrilla", "5504"); pg.wait_for_timeout(400)
    caso("la cuadrilla entra con su PIN y ve que su día ya está registrado", entro and pg.get_by_text("Su trabajo de ese día ya está registrado por el encargado").count() == 1)
    antes = len(json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))["actividades"])
    pg.locator(".parcela-card").first.click(); pg.wait_for_timeout(300)
    pg.locator(".act-card", has_text="Cosecha").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Continuar →").click(); pg.wait_for_timeout(300)
    pg.locator("button.btn-accent", has_text="✓").click()
    pg.wait_for_timeout(400)
    despues = len(json.loads(pg.evaluate("() => localStorage.getItem('agro_v8:local')"))["actividades"])
    caso("y si intenta enviarlo por su pantalla, no se guarda otra vez y se le dice por qué", despues == antes and any("ya está registrado por el encargado" in a for a in avisos), f"{antes}→{despues} · {avisos[-1:]}")
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
