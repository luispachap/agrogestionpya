"""Las cuadrillas eventuales en navegador real: quién vino, cómo cobran (por día
o destajo, con lo que hizo cada quien), cómo llegaron (flete externo repartido,
o vehículo del rancho sin importe), y que todo llega solo al costo de la parcela.
Uso:  npx vite --port 5173 &   →   python3 pruebas/eventuales_navegador.py"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
g["SEMILLA"]["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
g["SEMILLA"]["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}, {"id": "p2", "ranchoId": "r1", "nombre": "PARCELA DOS", "hectareas": 3, "cicloFenologico": []}]
g["SEMILLA"]["maquinaria"] = [{"id": "m-camion", "nombre": "CAMION AMARILLO DE PRUEBA"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
eventos = lambda pg: sorted(pg.evaluate(LEER), key=lambda e: e["capturado"])
de = lambda pg, tipo: [e for e in eventos(pg) if e["tipo"] == tipo]
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(400)
def gente(pg, filas):
    for i, (nombre, valor) in enumerate(filas):
        if i > 0: pg.get_by_role("button", name="Agregar persona").click()
        pg.get_by_label(f"Nombre {i + 1}").fill(nombre)
        if valor is not None: pg.locator(".dj-fila").nth(i).locator("input").nth(1).fill(str(valor))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)

    # ── 1 · Por día, cada quien con su pago, y flete externo ──
    ir(pg, "cuadrillas-dia"); pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("cq-prueba"); pg.get_by_label("Responsable").fill("RESPONSABLE DE PRUEBA")
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué hicieron").select_option("Cosecha")
    pg.get_by_label("Pago por día de cada persona ($)").fill("300")
    gente(pg, [("UNO", None), ("DOS", None), ("TRES", 450)])
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    caso("no deja guardar sin decir cómo llegaron", pg.get_by_text("Falta decir cómo llegaron").count() == 1 and len(de(pg, "cuadrilla_dia")) == 0)
    pg.get_by_label("Transporte").select_option("flete"); pg.get_by_label("Cuánto se pagó de flete").fill("600")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    d = de(pg, "cuadrilla_dia")
    caso("queda quién vino y cuánto cobra cada persona, aunque no cobren igual", len(d) == 1 and [(i["nombre"], i["pagoDia"]) for i in d[0]["datos"]["integrantes"]] == [("UNO", 300), ("DOS", 300), ("TRES", 450)] and d[0]["datos"]["responsable"] == "RESPONSABLE DE PRUEBA", json.dumps(d[0]["datos"]["integrantes"]) if d else "")
    t = de(pg, "traslado_cuadrilla")
    caso("el flete externo queda aparte, una sola vez", len(t) == 1 and t[0]["datos"]["tipo"] == "flete" and t[0]["datos"]["monto"] == 600)
    caso("la lista del día enseña a cada persona con lo suyo", "$1,050" in pg.locator(".card", has_text="CUADRILLA DE PRUEBA").inner_text() and "$450" in pg.locator(".mo-act", has_text="TRES").inner_text())

    # ── 2 · La misma cuadrilla en otra parcela, a destajo con lo que hizo cada quien ──
    pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("cq-prueba")
    caso("la app se acuerda de quiénes vinieron", pg.get_by_role("button", name="Los de la vez pasada (3)").count() == 1)
    caso("y no vuelve a pedir el transporte de hoy", pg.get_by_text("ya está registrado").count() == 1)
    pg.get_by_label("Parcela").select_option("p2"); pg.get_by_label("Qué hicieron").select_option("Riego")
    pg.get_by_role("button", name="Destajo").click()
    pg.get_by_label("A cómo cada una ($)").fill("10")
    gente(pg, [("CUATRO", 40)])
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    caso("el destajo guarda la producción de cada persona", len(de(pg, "cuadrilla_dia")) == 2 and de(pg, "cuadrilla_dia")[1]["datos"]["destajo"]["produccion"] == [{"nombre": "CUATRO", "cantidad": 40}] and len(de(pg, "traslado_cuadrilla")) == 1)

    # ── 3 · Sólo el total del grupo: parejo únicamente si alguien lo autoriza; vehículo propio sin importe ──
    pg.get_by_role("button", name="Registrar una cuadrilla").click()
    pg.get_by_label("Cuadrilla", exact=True).select_option("__otra__"); pg.get_by_label("Nombre de la cuadrilla").fill("LOS DE PRUEBA")
    pg.get_by_label("Parcela").select_option("p1"); pg.get_by_label("Qué hicieron").select_option("Cosecha")
    pg.get_by_role("button", name="Destajo").click(); pg.get_by_label("A cómo cada una ($)").fill("10")
    pg.get_by_role("button", name="Sólo tengo el total del grupo").click()
    gente(pg, [("CINCO", None), ("SEIS", None)])
    pg.get_by_label("Total del grupo (caja)").fill("50")
    pg.get_by_label("Transporte").select_option("propio"); pg.get_by_label("Vehículo").select_option("m-camion")
    caso("con vehículo del rancho no hay dónde ponerle importe", pg.get_by_label("Cuánto se pagó de flete").count() == 0 and pg.get_by_text("lo contaría dos veces").count() == 1)
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    caso("sin autorización no se reparte parejo", pg.get_by_text("necesita que alguien lo autorice").count() == 1 and len(de(pg, "cuadrilla_dia")) == 2)
    pg.locator(".dj-parejo input").check()
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    d = de(pg, "cuadrilla_dia")
    caso("con autorización sí, y queda quién lo autorizó", len(d) == 3 and d[2]["datos"]["destajo"]["parejo"] is True and d[2]["datos"]["destajo"]["autorizoParejo"] == "ENCARGADO DE PRUEBA")
    t = de(pg, "traslado_cuadrilla")
    caso("el viaje en vehículo propio queda ligado al vehículo, sin importe", len(t) == 2 and t[1]["datos"]["vehiculoId"] == "m-camion" and "monto" not in t[1]["datos"])

    # ── 4 · Todo llega solo al costo de cada parcela ──
    pg.locator(".btn-ghost").first.click(); pg.get_by_role("button", name="Salir").click(); pg.wait_for_timeout(500)
    g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(600)
    caso("el costo de campo del inicio ya trae cuadrillas y flete, sin teclear actividades", "$2,550" in pg.locator(".stat-card", has_text="Costo directo de campo").inner_text() and pg.evaluate("() => (JSON.parse(localStorage.getItem('agro_v8:local')).actividades || []).length") == 0, pg.locator(".stat-card", has_text="Costo directo de campo").inner_text())
    ir(pg, "mano-obra")
    uno, dos = pg.locator(".card", has_text="PARCELA UNO").last, pg.locator(".card", has_text="PARCELA DOS").last
    caso("parcela uno: $1,050 por día + $500 de destajo + $450 de flete = $2,000", "$2,000" in uno.inner_text(), uno.inner_text()[:80])
    caso("parcela dos: $400 de destajo + $150 de flete = $550", "$550" in dos.inner_text(), dos.inner_text()[:80])
    dos.locator(".mo-cab").click(); pg.wait_for_timeout(200)
    dos.locator(".jor-fila", has_text="Flete externo").click(); pg.wait_for_timeout(300)
    rastro = pg.locator(".modal-sheet").inner_text()
    caso("el flete dice con qué criterio se repartió y de qué registros sale", "Entre las personas transportadas" in rastro and "Flete externo de $600" in rastro and "PARCELA DOS" in rastro, rastro[:260])
    pg.get_by_role("button", name="Cerrar").click()
    caso("el vehículo propio sale sin importe y dice por qué", pg.locator(".card", has_text="Transporte de cuadrillas").get_by_text("CAMION AMARILLO DE PRUEBA").count() == 1 and pg.get_by_text("No lleva importe aquí").count() == 1)

    # ── 5 · Cancelar con motivo: sale del costo y se queda en el historial ──
    ir(pg, "cuadrillas-dia")
    pg.locator(".card", has_text="LOS DE PRUEBA").get_by_role("button", name="Cancelar este registro").click()
    pg.get_by_role("button", name="Cancelar registro").click(); pg.wait_for_timeout(200)
    caso("cancelar pide decir por qué", pg.get_by_text("hay que decir por qué").count() == 1)
    pg.get_by_label("Por qué se cancela").fill("se capturó en la parcela equivocada")
    pg.get_by_role("button", name="Cancelar registro").click(); pg.wait_for_timeout(400)
    d = de(pg, "cuadrilla_dia")
    caso("queda cancelado, con su motivo, y no se borró", len(d) == 3 and d[2]["estado"] == "cancelado" and d[2]["cancelado"]["motivo"].startswith("se capturó") and pg.get_by_text("CANCELADO por Administrador").count() == 1)
    pg.locator(".btn-ghost").first.click(); pg.wait_for_timeout(400)
    caso("y su costo salió solo de la parcela", "$2,050" in pg.locator(".stat-card", has_text="Costo directo de campo").inner_text(), pg.locator(".stat-card", has_text="Costo directo de campo").inner_text())
    caso("ninguna pantalla tronó", not errs, errs)
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
