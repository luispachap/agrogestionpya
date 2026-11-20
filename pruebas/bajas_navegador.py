"""Préstamos por etapas (solicitud, autorización, entrega, abono) y bajas del personal, en navegador real.
Uso:  npx vite --port 5173 &   →   python3 pruebas/bajas_navegador.py"""
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
                     {"id": "t-beto", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hist(400), "pin": "4822", "fechaIngreso": "2025-01-01"}]
S["encargados"] = [{"id": "enc-prueba", "nombre": "ENCARGADO DE PRUEBA", "pin": "5501", "categoria": "encargado", "sueldo_dia": 600, "historialSueldo": hist(600)}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
guardado = lambda pg, sec: pg.evaluate("s => JSON.parse(localStorage.getItem('agro_v8:local'))[s]", sec)
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).last
modal = lambda pg: pg.locator(".modal-sheet")
plano = lambda t: t.replace("\n", " | ")
def salir(pg):
    pg.evaluate("() => { const k = Object.keys(localStorage).find(x => x.startsWith('agro_sesion')); if (k) localStorage.removeItem(k); }"); pg.reload(); pg.wait_for_timeout(800)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City", accept_downloads=True)
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-19T09:00:00-06:00")
    g["sembrar"](pg)

    # ══ Préstamo: el encargado SOLICITA ══
    g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    ir(pg, "personal"); tab(pg, "Préstamos")
    pg.get_by_role("button", name="+ Solicitar").click()
    f = pg.locator(".card", has_text="Solicitar un préstamo")
    f.locator("select").first.select_option("t-ana"); f.locator("input[type=number]").fill("1000"); f.get_by_placeholder("Ej: Adelanto de quincena").fill("MEDICINAS DE PRUEBA")
    f.get_by_role("button", name="Mandar la solicitud").click(); pg.wait_for_timeout(400)
    t = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("el encargado solicita: queda «Solicitado», sin deuda y sin poder autorizarlo él", len(de(pg, "prestamo_solicitud")) == 1 and "Solicitado" in t and "Todavía no es deuda" in t and "Autorizar" not in t and "Registrar entrega" not in t and not guardado(pg, "prestamos"), plano(t)[:260])

    # ══ El administrador autoriza; autorizar todavía no es entregar ══
    salir(pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    ir(pg, "nomina")
    caso("una solicitud no le aparece como deuda en sus pagos", "Debe" not in pg.locator("body").inner_text())
    ir(pg, "personal"); tab(pg, "Préstamos")
    c = tarjeta(pg, "ANA DE PRUEBA"); c.get_by_role("button", name="Autorizar", exact=True).click()
    pg.get_by_label("Cuánto se autoriza ($)").fill("800"); c.get_by_role("button", name="Autorizar el préstamo").click(); pg.wait_for_timeout(200)
    caso("autorizar pide quién lo autoriza", "Falta quién lo autoriza" in c.inner_text() and len(de(pg, "prestamo_autorizacion")) == 0)
    pg.get_by_label("Quién autoriza el préstamo").fill("RODOLFO DE PRUEBA"); pg.get_by_label("Condiciones del préstamo").fill("ABONOS DE 200 POR SEMANA")
    c.get_by_role("button", name="Autorizar el préstamo").click(); pg.wait_for_timeout(400)
    t = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("autorizado por $800: todavía no se debe nada, falta entregar", len(de(pg, "prestamo_autorizacion")) == 1 and "Autorizado y sin entregar: $800" in t and "Eso todavía no se debe" in t and "ABONOS DE 200 POR SEMANA" in t and "Registrar abono" not in t, plano(t)[:400])
    c = tarjeta(pg, "ANA DE PRUEBA"); c.get_by_role("button", name="Registrar entrega del dinero").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("900"); c.get_by_role("button", name="Guardar la entrega").click(); pg.wait_for_timeout(200)
    caso("no se entrega más de lo autorizado", "quedan 800 por entregar" in c.inner_text() and len(de(pg, "prestamo_entrega")) == 0)
    pg.get_by_label("Cuánto se entregó ($)").fill("500"); c.get_by_role("button", name="Guardar la entrega").click(); pg.wait_for_timeout(400)
    t = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("con la entrega nace la deuda: debe $500 y quedan $300 autorizados sin entregar", len(de(pg, "prestamo_entrega")) == 1 and "Debe" in t and "Entregado el 2026-11-19: $500" in t and "Autorizado y sin entregar: $300" in t and "Registrar abono" in t, plano(t)[:500])
    c = tarjeta(pg, "ANA DE PRUEBA"); c.get_by_role("button", name="Registrar abono").click()
    c.get_by_placeholder("Monto del abono").fill("200"); c.get_by_role("button", name="✓").click(); pg.wait_for_timeout(400)
    t = tarjeta(pg, "ANA DE PRUEBA").inner_text(); ab = de(pg, "abono_prestamo")
    caso("el abono es un movimiento contra ese préstamo; el saldo es entregado menos abonado ($300)", len(ab) == 1 and ab[0]["datos"]["prestamoId"] == de(pg, "prestamo_solicitud")[0]["id"] and "$300" in t and not guardado(pg, "prestamos"), plano(t)[-260:])

    # ══ Baja: un despido sin causa justificada ══
    ir(pg, "nomina"); tab(pg, "Prestaciones")
    pg.get_by_label(re.compile("fecha de corte")).fill("2026-07-01"); pg.locator(".form-group", has_text="fecha de corte").get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    # ── El catálogo de salarios mínimos ──
    sm = pg.locator(".card", has_text="Salarios mínimos oficiales")
    t = sm.inner_text()
    caso("el catálogo trae el salario mínimo general vigente hoy con su publicación oficial; al rancho le toca el general", "Vigente hoy" in t and "$315.04" in t and "CONASAMI, DOF" in t and "General (resto del país)" in t and "frontera norte $440.87" in t, plano(t)[:300])
    sm.get_by_role("button", name="Agregar o corregir un año").click()
    caso("propone capturar el año que sigue", pg.get_by_label("Rige desde").input_value() == "2027-01-01")
    pg.get_by_label("Salario mínimo general por día ($)").fill("350"); pg.get_by_label("Zona Libre de la Frontera Norte por día ($)").fill("470")
    sm.get_by_role("button", name="Guardar en el catálogo").click(); pg.wait_for_timeout(200)
    caso("no se guarda un salario mínimo sin decir de qué publicación oficial sale", "publicación oficial" in sm.inner_text() and len(de(pg, "salario_minimo")) == 0)
    pg.get_by_label("Publicación oficial de donde sale").fill("RESOLUCIÓN DE PRUEBA, DOF 09/12/2026"); sm.get_by_role("button", name="Guardar en el catálogo").click(); pg.wait_for_timeout(200)
    caso("tampoco sin la evidencia: la liga oficial o la foto de la publicación", "Falta la evidencia" in sm.inner_text() and len(de(pg, "salario_minimo")) == 0)
    pg.get_by_label("Liga a la publicación en el Diario Oficial").fill("https://noticias.example.com/salario"); sm.get_by_role("button", name="Guardar en el catálogo").click(); pg.wait_for_timeout(200)
    caso("ni con una liga que no es de un sitio oficial", "sitio oficial" in sm.inner_text() and len(de(pg, "salario_minimo")) == 0)
    pg.get_by_label("Liga a la publicación en el Diario Oficial").fill("https://www.dof.gob.mx/nota_detalle.php?codigo=1"); sm.get_by_role("button", name="Guardar en el catálogo").click(); pg.wait_for_timeout(400)
    t = pg.locator(".card", has_text="Salarios mínimos oficiales").inner_text()
    caso("el año nuevo queda en el catálogo con quién lo capturó, y el de hoy sigue siendo el de 2026", len(de(pg, "salario_minimo")) == 1 and "Desde el 2027-01-01" in t and "lo capturó" in t and "$350" in t and t.index("Vigente hoy") < t.index("$315.04") < t.index("Desde el 2027-01-01"), plano(t)[:420])
    # ── Las percepciones de Beto cuentan para su salario integrado ──
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Condiciones").click(); pg.wait_for_timeout(200)
    modal(pg).get_by_role("button", name="Agregar una percepción").click()
    pg.get_by_label("Clase de la percepción 1").select_option("despensa"); pg.get_by_label("Importe de la percepción 1").fill("700")
    modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(200)
    caso("una percepción no se guarda sin decir cada cuánto se le da", "cada cuánto" in modal(pg).inner_text())
    pg.get_by_label("Cada cuánto la percepción 1").select_option("semana"); pg.get_by_label("Ya revisé sus percepciones").check()
    modal(pg).get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    beto = [t for t in guardado(pg, "trabajadores") if t["id"] == "t-beto"][0]
    caso("queda en su ficha con desde cuándo, y quién y cuándo la revisó", beto["percepciones"]["revisado"] == "2026-11-19" and beto["percepciones"]["lista"][0]["periodo"] == "semana" and beto["percepciones"]["lista"][0]["desde"] == "2025-01-01", beto.get("percepciones"))
    tarjeta(pg, "BETO DE PRUEBA").get_by_role("button", name="Dar de baja").click()
    pg.get_by_label("Causa de la terminación").select_option("despido_injustificado"); pg.wait_for_timeout(200)
    m = modal(pg).inner_text()
    caso("su salario integrado ya trae la despensa ($100 por día) y no sale como piso", "salario integrado (para indemnizaciones): $520.28" in m and "(piso" not in m and "700 por semana, entre 7" in m and "El salario integrado es un piso" not in m, [x for x in m.split("\n") if "integrado" in x][:3])
    modal(pg).get_by_role("button", name="No").click(); pg.wait_for_timeout(200)
    antes = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    tarjeta(pg, "ANA DE PRUEBA").get_by_role("button", name="Dar de baja").click()
    pg.get_by_label("Causa de la terminación").select_option("renuncia"); pg.wait_for_timeout(200)
    m = modal(pg).inner_text()
    caso("en una renuncia propone el finiquito: lo ya ganado, sin indemnizaciones ni prima de antigüedad", "Corresponde: finiquito" in m and "Aguinaldo proporcional" in m and "no procede en esta causa" in m and "15 años o más de servicio; lleva 2" in m and pg.get_by_label("Importe de Aguinaldo proporcional").input_value() == "2130" and pg.get_by_label("Importe de Indemnización de tres meses").count() == 0 and "salario mínimo de ese día: $315.04" in m, plano(m)[:500])
    pg.get_by_label("Causa de la terminación").select_option("despido_injustificado"); pg.wait_for_timeout(200)
    m = modal(pg).inner_text()
    caso("en un despido sin causa propone liquidación, con las indemnizaciones marcadas por revisar", "Corresponde: liquidación" in m and "hay que revisarlo" in m and "NO procede en todo despido" in m and "salario integrado (para indemnizaciones): $384 (piso: falta información)" in m and "otras percepciones fijas" in m and "El salario integrado es un piso" in m and pg.get_by_label("Importe de Indemnización de tres meses").input_value() == "34560" and "Pagos al personal" in m, plano(m)[:300])
    caso("los veinte días por año NO entran de entrada en un despido: quedan a la vista para marcarlos si proceden", not pg.get_by_label("Incluir Veinte días por año").is_checked() and pg.get_by_label("Importe de Veinte días por año").count() == 0 and pg.get_by_label("Incluir Indemnización de tres meses").is_checked())
    caso("la prima de antigüedad dice con qué salario mínimo oficial se calculó", "el salario mínimo general vigente el 2026-11-19 es 315.04" in m and pg.get_by_label("Importe de Prima de antigüedad").input_value() == "11928")
    pg.get_by_label("Importe de Aguinaldo proporcional").fill("2500")
    modal(pg).get_by_role("button", name="Registrar la baja").click(); pg.wait_for_timeout(200)
    caso("la baja pide quién la autoriza", "Falta quién lo autoriza" in modal(pg).inner_text() and len(de(pg, "baja_personal")) == 0)
    pg.get_by_label("Quién autoriza la baja").fill("RODOLFO DE PRUEBA"); modal(pg).get_by_role("button", name="Registrar la baja").click(); pg.wait_for_timeout(600)
    bj = de(pg, "baja_personal"); t = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    claves = [k["clave"] for k in bj[0]["datos"]["conceptos"]] if bj else []
    caso("queda la liquidación con lo confirmado, lo que propuso la app, su PDF, y sin los veinte días que se quitaron", len(bj) == 1 and bj[0]["datos"]["da"] == "liquidacion" and claves == ["aguinaldo", "vacaciones", "prima", "prima_antiguedad", "indemnizacion_3m"] and bj[0]["datos"]["conceptos"][0]["monto"] == 2500 and bj[0]["datos"]["conceptos"][0]["propuesto"] == 2130 and str(bj[0]["datos"].get("pdf", "")).startswith(("data:application/pdf", "archivo:")) and [bj[0]["datos"]["bases"][k] for k in ("salarioDia", "salarioIntegrado", "salarioMinimo", "integradoCompleto")] == [365, 384, 315.04, False] and len(bj[0]["datos"]["bases"]["partes"]) == 3, bj[0]["datos"].get("bases") if bj else claves)
    caso("de lo ya generado sólo va al costo la diferencia ($370 de aguinaldo); las indemnizaciones son costo nuevo", "Liquidación" in t and "despido sin causa justificada" in t and "ya generado $2,130 · al costo sólo $370" in t and "costo nuevo de ese día" in t and "sin documentos" in t, plano(t)[:600])
    total = bj[0]["datos"]["total"]
    tarjeta(pg, "ANA DE PRUEBA").get_by_role("button", name="Registrar pago de la baja").click()
    pg.get_by_label("Cuánto se entregó ($)").fill("10000"); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(400)
    t = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("el pago baja lo pendiente de la baja y no cambia el costo", len(de(pg, "pago_baja")) == 1 and "pagado $10,000" in t and "al costo sólo $370" in t, plano(t)[:300])
    caso("ya de baja, no se le ofrece determinar ni darla de baja otra vez", "Dar de baja" not in t and "Determinar" not in t)
    liga = tarjeta(pg, "ANA DE PRUEBA").get_by_role("link", name="Descargar el PDF de esta versión")
    if liga.count():
        with pg.expect_download() as d: liga.click()
        pdf = open(d.value.path(), "rb").read()
        texto = b" ".join(re.findall(rb"\((.*?)\) Tj", pdf))
        caso("el cálculo de la baja se conserva como PDF, con cada concepto, sus bases y lo que estaba por revisar", pdf.startswith(b"%PDF-") and b"ANA DE PRUEBA" in texto and b"marcado por revisar" in texto and b"LIQUIDACI" in texto and b"Bases del c" in texto and b"salario integrado $384 \\(piso" in texto and b"Salario integrado, por partes" in texto, texto[:300])
    else: caso("el cálculo de la baja se conserva como PDF", False)
    tab(pg, "Costo sin parcela")
    bc = pg.locator(".card", has_text="Terminaciones de la relación de trabajo")
    caso("la prima de antigüedad y la indemnización son gasto laboral general: ni a parcelas ni pendientes de distribuir", "Gasto laboral general" in bc.inner_text() and "$46,488" in bc.inner_text() and "Pendiente de distribuir" not in bc.inner_text() and "Repartido a parcelas" not in bc.inner_text(), plano(bc.inner_text())[:300])
    bc.get_by_role("button", name="Ver de dónde sale cada importe").click(); pg.wait_for_timeout(200)
    caso("cada importe conserva de quién es, la causa y la fecha", "ANA DE PRUEBA" in bc.inner_text() and "despido sin causa justificada" in bc.inner_text() and "2026-11-19" in bc.inner_text(), plano(bc.inner_text())[-300:])
    ir(pg, "reportes"); pg.locator(".tab-pill", has_text="Cierre de mes").first.click(); pg.wait_for_timeout(400)
    pg.get_by_label("Mes que se cierra").fill("2026-11"); pg.wait_for_timeout(400)
    cm = pg.locator(".card", has_text="Cierre de mes").first.inner_text()
    cc = pg.locator(".card", has_text="Conciliación de prestaciones y bajas")
    ct = cc.inner_text()
    caso("la conciliación del mes separa lo que fue costo, lo que se pagó y lo que se debe, y comprueba que nada está dos veces", "Entró al costo este mes" in ct and "costo nuevo por bajas $46,488" in ct and "Se pagó este mes" in ct and "$10,000" in ct and "Comprobado" in ct and "Nada está dos veces" in ct and "Por revisar" not in ct, plano(ct)[:700])
    cc.get_by_role("button", name="Por qué Baja (prima de antigüedad e indemnizaciones) de ANA DE PRUEBA").click(); pg.wait_for_timeout(200)
    ct = cc.inner_text()
    caso("explica por qué el importe cae en este mes y cómo se relaciona con su pago", "nace el último día de trabajo" in ct and "El pago NO es costo de 2026-11" in ct and "pago de la baja" in ct, plano(ct)[-700:])
    cc.get_by_role("button", name="Por qué Aguinaldo de ANA DE PRUEBA").click(); pg.wait_for_timeout(200)
    caso("y dice que lo ya generado pasó a la liquidación para no pagarse dos veces", "pasó a su liquidación: se paga ahí y no dos veces" in cc.inner_text())
    caso("en el cierre de noviembre la baja sale en los gastos generales y no sube el costo de ninguna parcela", "3. Gastos generales de operación y administración" in cm and "laborales por bajas (prima de antigüedad e indemnizaciones) $46,488" in cm and "$46,488" in cm.split("3. Gastos generales")[1] and "46,488" not in cm.split("3. Gastos generales")[0], plano(cm)[:900])
    ir(pg, "equipo")
    caso("quien está de baja ya no sale como activo, sin que se haya escrito en su ficha", [t for t in guardado(pg, "trabajadores") if t["id"] == "t-ana"][0].get("activo") is not False)
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
