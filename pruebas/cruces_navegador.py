"""Que las pantallas digan lo mismo: una misma operación vista desde el inicio, Finanzas, Pagos y el cierre de mes.
Cada caso de aquí es una contradicción que la app tenía entre dos apartados (revisión integral del 19 nov 2026).
Uso:  npx vite --port 5173 &   →   python3 pruebas/cruces_navegador.py"""
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
S["cultivos"] = [{"id": "c1", "nombre": "Ajo"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2, "cultivo": "Ajo", "cicloFenologico": []}]
quien = {"tipo": "trabajador", "id": "t-ana"}
act = lambda id, fecha, mo, **mas: {"id": id, "fecha": fecha, "tipo": "Riego", "registradoPor": quien, "costoMO": mo, "costoMaq": 0, "costoInsumos": 0, "costoTotal": mo, "insumos": [], "parcelaId": "", **mas}
S["actividades"] = [act("a1", "2026-10-28", 400, parcelaId="p1"),                                   # trabajo de octubre, que se paga en noviembre
                    act("a2", "2026-11-10", 300, esBodega=True, cultivoBodega="Ajo", tipo="Selección"),
                    act("a3", "2026-11-11", 150, esBodega=True, cultivoBodega="__general__", tipo="Reparar techo")]
S["egresos"] = [{"id": "g1", "fecha": "2026-11-05", "monto": 900, "categoria": "servicios", "concepto": "LUZ DE PRUEBA"}]
S["compras"] = [{"id": "co1", "fecha": "2026-11-06", "monto": 300, "estado": "aprobada", "descripcion": "REFACCIONES DE PRUEBA", "items": []}]
S["ingresos"] = [{"id": "i1", "fecha": "2026-11-20", "monto": 10000, "concepto": "VENTA DE PRUEBA", "categoria": "venta_cosecha", "parcelaId": "p1"}]
S["asistencia"] = [{"id": "as1", "fecha": "2026-11-24", "trabajadorId": "t-ana", "presente": True, "registradoPor": "enc-prueba"}]
PAGO = {"id": "pago_personal-prueba-1", "tipo": "pago_personal", "estado": "vigente", "cuando": "2026-11-24T18:00:00.000Z", "fecha": "2026-11-24", "capturado": "2026-11-24T18:00:00.000Z", "quien": {"id": "admin", "nombre": "ADMIN DE PRUEBA", "rol": "admin"}, "origen": None, "relacion": None,
        "datos": {"a": {"tipo": "trabajador", "id": "t-ana", "nombre": "ANA DE PRUEBA"}, "desde": "2026-10-26", "hasta": "2026-11-01", "monto": 400, "medio": "efectivo", "recibe": "", "nota": ""}}
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(500)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(400)
dinero = lambda t: re.findall(r"-?\$[\d,]+(?:\.\d+)?", t)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time="2026-11-25T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(500)
    pg.evaluate("e => window.__agro.add('eventos', e)", PAGO); pg.wait_for_timeout(600)

    # ── 1 · La utilidad es la misma en el inicio y en Finanzas ──
    ir(pg, "home")
    heroe = pg.locator(".stat-hero").first.inner_text()
    ir(pg, "contabilidad"); tab(pg, "Resultados")
    res_t = pg.locator(".card", has_text="Estado de resultados").first.inner_text()
    # ingresos 10,000 − (mano de obra 400 + 300 + 150) − compra del personal 300 − luz 900 = 7,950
    caso("la utilidad del inicio es la misma que la de Finanzas", "$7,950" in heroe and "$7,950" in res_t, plano(heroe) + " /// " + plano(res_t)[:400])
    caso("el estado de resultados desglosa de dónde sale cada costo", "Mano de obra en parcelas y bodega" in res_t and "$850" in res_t and "Compras hechas por el personal" in res_t and "Otros gastos capturados" in res_t)
    cul = pg.locator(".card", has_text="Resultado por cultivo").first.inner_text()
    caso("el trabajo general de bodega no se le reparte a ningún cultivo: se dice aparte", "Los trabajos generales de bodega ($150) no se reparten entre los cultivos" in cul, plano(cul)[:300])
    costo_ajo = pg.evaluate("() => { const d = window.__agroDatos; return (d.actividadesContables || d.actividades).filter(a => a.parcelaId === 'p1' || (a.esBodega && a.cultivoBodega === 'Ajo')).reduce((s, a) => s + a.costoTotal, 0); }")
    caso("al cultivo sólo le cuenta lo suyo ($700): parcela y su bodega", costo_ajo == 700 and "$700" in cul and "$850" not in cul, plano(cul)[:300])

    # ── 2 · El flujo cuenta el dinero el día que se movió ──
    tab(pg, "Flujo de efectivo")
    fl = pg.locator(".card", has_text="Estado de flujo de efectivo por mes").first.inner_text()
    caso("el trabajo de octubre no sale como dinero en octubre: se pagó en noviembre", "Octubre" not in fl and "octubre" not in fl and "pagos al personal $400" in fl, plano(fl)[:400])
    arriba = pg.locator(".section-pad").last.inner_text()
    caso("el flujo dice que es dinero y no utilidad, y no usa la misma cifra", "dinero que salió" in arriba.lower() and "$1,600" in arriba and "no utilidad" in arriba and "$8,400" in arriba, plano(arriba)[:300])

    # ── 3 · El cierre de mes ya ve lo que no tiene parcela ──
    ir(pg, "reportes"); tab(pg, "Cierre de mes")
    pg.get_by_label("Mes que se cierra").fill("2026-11"); pg.wait_for_timeout(400)
    cm = pg.locator(".card", has_text="Cierre de mes").first.inner_text()
    caso("el trabajo de bodega de un cultivo entra como costo directo, sin subirle a ninguna parcela", "en bodega Ajo $300" in cm and "en parcelas $0" in cm, plano(cm)[:500])
    caso("el trabajo general de bodega y la compra del personal salen como gastos generales", "trabajos generales de bodega $150" in cm and "compras hechas por el personal $300" in cm and "servicios $900" in cm, plano(cm)[300:800])
    caso("el total del rancho de noviembre ya no sale corto: $1,650", "$1,650" in cm.split("Total de costos y gastos del rancho")[1][:80], plano(cm.split("Total de costos y gastos del rancho")[1])[:120])
    pg.get_by_label("Mes que se cierra").fill("2026-10"); pg.wait_for_timeout(400)
    cm = pg.locator(".card", has_text="Cierre de mes").first.inner_text()
    caso("el trabajo de octubre es costo de octubre aunque se haya pagado en noviembre", "PARCELA UNO" in cm and "$400" in cm.split("Total de costos y gastos del rancho")[1][:80])

    # ── 4 · Pagos no dice «no vino» de quien fue marcada presente ──
    ir(pg, "nomina"); tab(pg, "Asistencia")
    t = pg.locator("body").inner_text()
    vino = pg.locator(".card", has_text="Vinieron, pero falta decir en qué trabajaron")
    caso("quien fue marcada presente en el pase de lista sale como que vino, sin pago todavía", vino.count() == 1 and "ANA DE PRUEBA" in vino.inner_text() and "2026-11-24" in vino.inner_text(), plano(t)[:300])
    no = pg.locator(".card", has_text="No vinieron y nadie ha dicho por qué")
    caso("y ese día ya no aparece entre los que no vinieron", no.count() == 0 or "2026-11-24" not in no.inner_text())

    # ── 5 · Los avisos de doble captura ──
    ir(pg, "home"); ir(pg, "contabilidad")
    pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(200); pg.locator(".option-card", has_text="Registrar Egreso").click(); pg.wait_for_timeout(300)
    sel = pg.locator("select", has=pg.locator("option[value='mano_obra']")).first
    sel.select_option("mano_obra"); pg.wait_for_timeout(200)
    caso("al capturar un gasto de mano de obra avisa que el pago a la gente no va ahí", "lo cuenta dos veces" in pg.locator("body").inner_text())
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
