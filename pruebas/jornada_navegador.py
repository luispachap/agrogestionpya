"""La jornada de trabajo, de la planeación al cierre, en navegador real y con gente y parcelas INVENTADAS.
Lo que se comprueba: que la pestaña junta lo planeado con lo registrado sin dar nada por hecho, que no se puede cerrar
sin decir por qué no se hizo cada cosa, que el cierre queda como foto, que lo que queda se pasa al plan de mañana una
sola vez, que reabrir pide motivo, y que nada de esto crea actividades ni gastos.
Uso:  npx vite --port 5173 &   →   python3 pruebas/jornada_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:600] if det else ""))
plano = lambda t: t.replace("\n", " | ")
HOY, MANANA = "2026-11-23", "2026-11-24"
tarea = lambda i, quien, parcela, texto, **extra: {"id": i, "tipo": "tarea", "fecha": HOY, "asignadoA": quien, "parcelaId": parcela, "resumen": texto, "estado": "mandada", "deQuien": "ENCARGADO DE PRUEBA", **extra}
g["SEMILLA"].update({
    "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}],
    "parcelas": [{"id": "sf4", "nombre": "San Felipe 4", "ranchoId": "r1", "hectareas": 3, "emoji": "🌾"}, {"id": "p53", "nombre": "La 53", "ranchoId": "r1", "hectareas": 2, "emoji": "🌾"}],
    "indicaciones": [tarea("i1", "t-prueba", "sf4", "Regar San Felipe 4", respuesta="hecha"), tarea("i2", "t-prueba", "p53", "Deshierbar La 53"), tarea("i3", "cq-prueba", "p53", "Cortar en La 53"), tarea("i0", "t-prueba", "p53", "Quitada", estado="cancelada")],
    "incidencias": [{"id": "inc1", "fecha": HOY, "desc": "La bomba del pozo tira aceite", "tipo": "maquinaria", "prioridad": "alta"}],
})
cuenta = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { act: d.actividades.length, egr: d.egresos.length, ind: d.indicaciones.length, ev: (d.eventos || []).map(e => e.tipo) }; }")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time=f"{HOY}T18:00:00-06:00"); g["sembrar"](pg); g["entrar"](pg, "", "5501"); pg.wait_for_timeout(400)
    antes = cuenta(pg)
    pg.evaluate("p => window.__agroIr(p)", "eldia"); pg.wait_for_timeout(600)
    pg.get_by_role("button", name="Jornada").click(); pg.wait_for_timeout(400)
    t = pg.locator(".jornada").inner_text()
    caso("la jornada dice cuántas tareas se mandaron y qué se sabe de ellas", "De 3 tarea(s) mandadas: 1 marcadas como hechas, 0 con trabajo registrado sin marcar terminada y 2 sin evidencia" in t and "No registra horas, pagos ni costos" in t, plano(t)[:500])
    filas = pg.locator(".jornada-tarea")
    caso("cada tarea dice su estado y con qué se sabe; lo quitado del plan no sale", filas.count() == 3 and "Hecha" in filas.nth(0).inner_text() and "No checó entrada" in filas.nth(1).inner_text() and "No tiene entrada en el checador" in filas.nth(1).inner_text() and "No hay con qué saberlo" in filas.nth(2).inner_text() and "no checa" in filas.nth(2).inner_text(), plano(filas.nth(1).inner_text() + " // " + filas.nth(2).inner_text()))
    caso("las incidencias del día salen en la jornada", "La bomba del pozo tira aceite" in t and "abierta" in t)
    pg.get_by_role("button", name="Cerrar la jornada").click(); pg.wait_for_timeout(300)
    caso("no se cierra sin decir por qué no se hizo cada cosa", "Falta decir por qué no se hizo" in pg.locator(".jornada-dice").inner_text() and "cierre_jornada" not in cuenta(pg)["ev"], pg.locator(".jornada-dice").inner_text())
    pg.get_by_label("Por qué no se hizo: TRABAJADOR DE PRUEBA").select_option("no_vino")
    pg.get_by_label("Por qué no se hizo: CUADRILLA DE PRUEBA").select_option("falta_insumo"); pg.get_by_label("Nota: CUADRILLA DE PRUEBA").fill("No llegaron las cajas")
    filas.nth(2).get_by_label("Pasa a mañana").check(); filas.nth(1).get_by_label("Pasa a mañana").check()
    pg.get_by_label("Nota del cierre").fill("Día corto"); pg.get_by_role("button", name="Cerrar la jornada").click(); pg.wait_for_timeout(500)
    t = pg.locator(".jornada").inner_text(); c = cuenta(pg)
    caso("al cerrar queda la foto: quién, cuándo, y por qué no se hizo cada cosa", "cerrada (versión 1)" in t and "La cerró ENCARGADO DE PRUEBA" in t and "Al cerrar se dijo: Faltó insumo, herramienta o agua — No llegaron las cajas · pasa a mañana" in t and c["ev"].count("cierre_jornada") == 1, plano(t)[-700:])
    caso("cerrar la jornada no crea actividades, gastos ni tareas", c["act"] == antes["act"] and c["egr"] == antes["egr"] and c["ind"] == antes["ind"], c)
    pg.get_by_role("button", name="Poner en el plan de mañana lo que quedó (2)").click(); pg.wait_for_timeout(500)
    ind = pg.evaluate("f => window.__agroDatos.indicaciones.filter(i => i.fecha === f)", MANANA)
    caso("lo que quedó pasa al plan de mañana cuando la persona lo pide, apuntando a la tarea de hoy", sorted(i["vieneDe"] for i in ind) == ["i2", "i3"] and all(i["tipo"] == "tarea" and i["estado"] == "mandada" and "quedó de ayer" in i["resumen"] for i in ind) and "Lo que quedó ya está en el plan del día siguiente" in pg.locator(".jornada").inner_text(), ind)
    caso("y no se puede pasar dos veces", pg.get_by_role("button", name="Poner en el plan de mañana").count() == 0)
    pg.get_by_role("button", name="Reparto").click(); pg.wait_for_timeout(300); pg.get_by_role("button", name="Mañana").first.click(); pg.wait_for_timeout(400)
    caso("y se ve en el plan mandado de mañana, en Reparto", "Deshierbar La 53 (quedó de ayer: la persona no vino)" in pg.locator("body").inner_text(), plano(pg.locator("body").inner_text())[-500:])
    pg.get_by_role("button", name="Jornada").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Reabrir la jornada").click(); pg.get_by_role("button", name="Reabrir", exact=True).click(); pg.wait_for_timeout(300)
    caso("reabrir pide motivo", "Di por qué se reabre" in pg.locator(".jornada-dice").inner_text())
    pg.get_by_label("Motivo para reabrir").fill("Faltó anotar un avance"); pg.get_by_role("button", name="Reabrir", exact=True).click(); pg.wait_for_timeout(400)
    t = pg.locator(".jornada").inner_text()
    caso("reabierta, dice quién y por qué, y la foto anterior se conserva", "Reabierta por ENCARGADO DE PRUEBA: «Faltó anotar un avance». Ya tuvo 1 cierre(s)" in t and cuenta(pg)["ev"].count("cierre_jornada") == 1 and "reapertura_jornada" in cuenta(pg)["ev"], plano(t)[-400:])
    # Quien no es administrador ni encargado no la cierra (el agrónomo no tiene «El día»; se prueba con el administrador que sí).
    g["sembrar"](pg); g["entrar"](pg, "", "7391"); pg.wait_for_timeout(400); pg.evaluate("p => window.__agroIr(p)", "eldia"); pg.wait_for_timeout(600); pg.get_by_role("button", name="Jornada").click(); pg.wait_for_timeout(300)
    caso("el administrador también ve y puede cerrar la jornada", pg.get_by_role("button", name="Cerrar la jornada").count() == 1)
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
