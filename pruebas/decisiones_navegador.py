"""Las cuatro decisiones del 20 nov 2026, en navegador real:
compras del personal que se reciben y se valúan (no entran en cero ni dos veces), insumos que cuentan al consumirse,
bonos dentro de Pagos al personal, y la maquinaria con su cuota aplicada contra su costo real.
Uso:  npx vite --port 5173 &   →   python3 pruebas/decisiones_navegador.py"""
import json, pathlib, sys, re
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
plano = lambda t: t.replace("\n", " | ")
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2020-01-01", "sueldo_dia": 400, "anterior": 400}], "pin": "4821"}]
S["encargados"] = [{"id": "enc-prueba", "nombre": "ENCARGADO DE PRUEBA", "pin": "5501"}]
S["ranchos"] = [{"id": "r1", "nombre": "RANCHO DE PRUEBA"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cicloFenologico": []}]
S["inventario"] = [{"id": "i-hilo", "nombre": "HILO DE PRUEBA", "unidad": "rollo", "existencia": 0, "categoria": "otros"}]
S["maquinaria"] = [{"id": "m-tractor", "nombre": "TRACTOR DE PRUEBA", "costo_hora": 100}]
S["actividades"] = [{"id": "a1", "fecha": "2026-11-10", "tipo": "Barbecho", "parcelaId": "p1", "registradoPor": {"tipo": "trabajador", "id": "t-ana"}, "maquinariaId": "m-tractor", "costoMO": 400, "costoMaq": 300, "costoInsumos": 0, "costoTotal": 700, "insumos": []}]
S["egresos"] = [{"id": "g1", "fecha": "2026-11-12", "monto": 200, "categoria": "mantenimiento", "concepto": "TALLER DE PRUEBA", "vehiculoId": "m-tractor"}]
S["compras"] = [{"id": "co1", "fecha": "2026-11-06", "trabajadorId": "t-ana", "tipoTrab": "trabajador", "descripcion": "HILO Y FLETE DE PRUEBA", "proveedor": "LA CENTRAL", "monto": 1500, "estado": "pendiente", "afectaInventario": True,
                 "items": [{"nombre": "HILO DE PRUEBA", "cantidad": 10, "insumoId": "i-hilo", "unidad": "rollo"}, {"nombre": "FLETE", "cantidad": 1, "insumoId": None}]}]
S["bonificaciones"] = [{"id": "b-vieja", "trabajadorId": "t-ana", "monto": 999, "anio": 2025, "concepto": "ANOTACION VIEJA DE PRUEBA"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(500)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(400)
hay_hilo = lambda pg: pg.evaluate("() => (window.__agroDatos.inventario.find(a => a.id === 'i-hilo') || {}).existencia")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-19T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(500)

    # ══ 1 · La compra del trabajador: aprobar no la mete al almacén ══
    ir(pg, "contabilidad"); tab(pg, "Compras")
    pg.get_by_role("button", name="✓ Aprobar").click(); pg.wait_for_timeout(500)
    rc = pg.locator(".card", has_text="Compras del personal para el almacén").first
    caso("aprobar el gasto no mete la mercancía al almacén: falta que alguien confirme que llegó", hay_hilo(pg) == 0 and len(de(pg, "alm_entrada")) == 0 and rc.count() == 1 and "Falta que alguien confirme que la mercancía llegó" in rc.inner_text() and "Falta confirmar que la mercancía llegó al almacén" in pg.locator("body").inner_text(), plano(rc.inner_text())[:300])
    caso("el flete no se recibe: no es mercancía", "FLETE" not in rc.inner_text().replace("HILO Y FLETE DE PRUEBA", ""))
    pg.get_by_label("Cantidad recibida de HILO DE PRUEBA").fill("10")
    pg.get_by_role("button", name="Recibir HILO DE PRUEBA").click(); pg.wait_for_timeout(600)
    ent = de(pg, "alm_entrada")
    rc = pg.locator(".card", has_text="Compras del personal para el almacén").first
    caso("recibida sin precio: ya está en el almacén y queda pendiente de valoración, no en cero", hay_hilo(pg) == 10 and len(ent) == 1 and ent[0]["id"] == "alm_entrada-compra-co1-0" and ent[0]["datos"].get("porValuar") is True and "costoUnit" not in ent[0]["datos"] and "Pendiente de valoración" in rc.inner_text(), plano(rc.inner_text())[:300])
    tab(pg, "Resultados")
    inv = pg.locator(".card", has_text="Inventario del almacén").first.inner_text()
    est = pg.locator(".card", has_text="Estado de resultados").first.inner_text()
    caso("mientras no se valúa, la compra no es gasto ni inventario: está por valuar, y el artículo sin precio se dice", "pendientes de recibir o de valuar" in inv and "$1,500" in inv and "con existencia y sin precio" in inv and "No valen cero" in inv and "Compras del personal que no son mercancía" not in est, plano(inv)[:500])
    tab(pg, "Compras")
    pg.get_by_label("Precio por valuar de HILO DE PRUEBA").fill("140")
    pg.get_by_role("button", name="Valuar HILO DE PRUEBA").click(); pg.wait_for_timeout(600)
    t = pg.locator("body").inner_text()
    caso("al ponerle precio queda valuada: lo que es mercancía al inventario y lo demás (el flete) a gasto", len(de(pg, "alm_valuacion")) == 1 and "Recibida y valuada: $1,400 al inventario y $100 de gasto" in t and pg.locator(".card", has_text="Compras del personal para el almacén").count() == 0, plano(t)[200:600])
    tab(pg, "Resultados")
    inv = pg.locator(".card", has_text="Inventario del almacén").first.inner_text()
    est = pg.locator(".card", has_text="Estado de resultados").first.inner_text()
    caso("la compra no es gasto: son $1,400 de inventario; a resultados sólo van los $100 que no eran mercancía", "$1,400" in inv and "pendientes de recibir" not in inv and "Compras del personal que no son mercancía" in est and "$100" in est and "$1,500" not in est, plano(est)[:600])
    tab(pg, "Flujo de efectivo")
    fl = pg.locator(".card", has_text="Estado de flujo de efectivo por mes").first.inner_text()
    caso("en el flujo la compra sale completa una sola vez, el día que se hizo", "compras del personal $1,500" in fl and fl.count("1,500") == 1 and "compras para el almacén" not in fl, plano(fl)[:400])

    # ══ 2 · La máquina: cuota aplicada contra costo real ══
    tab(pg, "Resultados")
    est = pg.locator(".card", has_text="Estado de resultados").first.inner_text()
    caso("la máquina cuenta una vez: $300 aplicados por cuota y −$100 de diferencia contra su costo real ($200 de taller)", "Maquinaria: aplicado por cuota por hora" in est and "$300" in est and "costo real fuera de la cuota" in est and "-$100" in est.replace("−", "-") and "Gastos capturados" not in est, plano(est)[:700])
    ir(pg, "reportes"); tab(pg, "Cierre de mes")
    pg.get_by_label("Mes que se cierra").fill("2026-11"); pg.wait_for_timeout(400)
    cm = pg.locator(".card", has_text="Cierre de mes").first.inner_text()
    caso("el cierre concilia la máquina: aplicado, real por partes, diferencia y su tratamiento", "lo aplicado por cuota contra lo que costó de verdad" in cm and "aplicado por cuota $300 · real $200" in cm and "mantenimiento $200" in cm and "la cuota aplicó de más: queda pendiente de distribuir" in cm, plano(cm.split("Maquinaria:")[1])[:500] if "Maquinaria:" in cm else plano(cm)[:300])

    # ══ 3 · Bonos, dentro de Pagos al personal ══
    ir(pg, "equipo")
    caso("la pantalla vieja de bonificaciones ya no existe como captura aparte", pg.locator(".tab-pill", has_text="Bonific").count() == 0)
    ir(pg, "nomina"); tab(pg, "Bonos")
    t = pg.locator("body").inner_text()
    caso("lo anotado antes se conserva a la vista, sin sumarse a nada", "Anotaciones anteriores" in t and "ANOTACION VIEJA DE PRUEBA" in t and "$999" in t and "no entran a los costos" in t)
    pg.get_by_role("button", name="Otorgar un bono").click()
    pg.get_by_label("A quién").select_option("t-ana"); pg.get_by_label("Importe ($)").fill("500"); pg.get_by_label("Motivo").fill("AGUINALDO DE PRUEBA")
    pg.get_by_label("Periodo que premia: desde").fill("2026-11-09"); pg.get_by_label("hasta").fill("2026-11-15"); pg.get_by_label("Quién lo autoriza").fill("RODOLFO DE PRUEBA")
    pg.get_by_role("button", name="Otorgar el bono").click(); pg.wait_for_timeout(200)
    caso("un aguinaldo no entra como bono: se manda a Prestaciones", "Eso no es un bono" in pg.locator("body").inner_text() and len(de(pg, "bono_personal")) == 0)
    pg.get_by_label("Motivo").fill("META DE CAJAS DE PRUEBA"); pg.get_by_role("button", name="Otorgar el bono").click(); pg.wait_for_timeout(500)
    bn = de(pg, "bono_personal"); t = pg.locator("body").inner_text()
    caso("el bono queda con importe, motivo, beneficiario, periodo, autorización, tratamiento de costo y estado de pago", len(bn) == 1 and bn[0]["datos"]["monto"] == 500 and bn[0]["datos"]["tratamiento"] == "actividades" and bn[0]["datos"]["integra"] is True and bn[0]["datos"]["autorizo"] == "RODOLFO DE PRUEBA" and "Por pagar" in t and "faltan $500" in t and "META DE CAJAS DE PRUEBA" in t, bn[0]["datos"] if bn else "")
    pg.get_by_role("button", name="Otorgar un bono").click()
    pg.get_by_label("A quién").select_option("t-ana"); pg.get_by_label("Importe ($)").fill("500"); pg.get_by_label("Motivo").fill("META DE CAJAS DE PRUEBA")
    pg.get_by_label("Periodo que premia: desde").fill("2026-11-09"); pg.get_by_label("hasta").fill("2026-11-15"); pg.get_by_label("Quién lo autoriza").fill("RODOLFO DE PRUEBA")
    pg.get_by_role("button", name="Otorgar el bono").click(); pg.wait_for_timeout(300)
    caso("el mismo bono no entra dos veces", "ya tiene ese mismo bono" in pg.locator("body").inner_text() and len(de(pg, "bono_personal")) == 1)
    pg.get_by_role("button", name="Cancelar").click()
    ind = pg.evaluate("() => window.__agroDatos.indirectos.partes.filter(p => p.fuente === 'bonos').map(p => [p.parcelaId, p.monto])")
    caso("su costo nace al otorgarlo y va a la parcela donde trabajó, sin haberse pagado", ind == [["p1", 500]], ind)
    pg.get_by_role("button", name="Registrar pago del bono de ANA DE PRUEBA").click()
    pg.get_by_role("button", name="Guardar el pago").click(); pg.wait_for_timeout(500)
    t = pg.locator("body").inner_text()
    ind2 = pg.evaluate("() => window.__agroDatos.indirectos.partes.filter(p => p.fuente === 'bonos').reduce((s, p) => s + p.monto, 0)")
    caso("pagarlo cambia su estado y no su costo", len(de(pg, "pago_bono")) == 1 and "Pagado" in t and "faltan $500" not in t and ind2 == 500)
    ir(pg, "contabilidad"); tab(pg, "Flujo de efectivo")
    fl = pg.locator(".card", has_text="Estado de flujo de efectivo por mes").first.inner_text()
    caso("y el dinero sale en el flujo el día que se pagó", "pagos de bonos $500" in fl, plano(fl)[:400])
    tab(pg, "Resultados")
    est = pg.locator(".card", has_text="Estado de resultados").first.inner_text()
    caso("en resultados el bono aparece una vez, como costo otorgado", "Bonos e incentivos otorgados" in est and est.count("$500") == 1, plano(est)[:700])
    ir(pg, "home")
    heroe = pg.locator(".stat-hero").first.inner_text()
    # costos: mano de obra 400 + cuota 300 − 100 de diferencia + bono 500 = 1,100; gastos: 100 del flete. Sin ingresos: −1,200
    caso("la utilidad del inicio es la misma cuenta: −$1,200", "1,200" in heroe, plano(heroe))
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
