"""AUDITORÍA FUNCIONAL · LOS NÚMEROS CUADRAN ENTRE PANTALLAS: Finanzas → Resultados, Reportes → Cierre de mes, «¿Cómo vamos?»,
el panel del dueño, el Resumen semanal, las Temporadas y Mano de obra. Antes cada pantalla sumaba por su lado: la compra para
el almacén contaba como gasto (y otra vez al usarse), un insumo que nadie clasificó entraba como gasto, la semana tenía ocho
días, la parcela cargaba lo de su ciclo anterior y el mes se comparaba contra el anterior («650 % más»).
Un rancho inventado, con cuentas, 390 px, nube de imitación. Las cifras esperadas están hechas a mano, renglón por renglón.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_numeros_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import json, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"      # jueves
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); DIR = N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno")
nube = N.Nube([ADM, DIR]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
# La parcela dos tiene anotado «Maíz» (lo que se sembró antes), pero su ciclo de ahora es de ajo: el centro de costos de
# ContPAQi tiene que salir del ciclo de ese día, no de la etiqueta.
t["parcelas"] = {p: {"id": p, "nombre": n, "rancho_id": "r1", "cultivo": c, "datos": {"hectareas": h, "emoji": "🌾", **E}, "actualizado": V} for p, n, h, c in (("p1", "PARCELA UNO", 2, "Ajo"), ("p2", "PARCELA DOS", 3, "Maíz"))}
t["cultivos"] = {"cul_ajo": {"id": "cul_ajo", "nombre": "Ajo", "datos": {"emoji": "🌱", "duracionDias": 240, "unidadCosecha": "kg", "fenologia": [], "variedades": [], **E}, "actualizado": V}}
# Tres ciclos: el de la temporada pasada en la parcela uno (ya cosechado) y los dos de ahora. El de la parcela uno tiene presupuesto.
t["siembras"] = {"s0": {"id": "s0", "parcela_id": "p1", "cultivo_id": "cul_ajo", "estado": "cosechada", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2025-09-01", "fechaCosechaReal": "2026-05-30", "superficie": 2, **E}, "actualizado": V},
                 "s1": {"id": "s1", "parcela_id": "p1", "cultivo_id": "cul_ajo", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2026-09-01", "fechaCosechaEstimada": "2027-04-29", "superficie": 2, "presupuesto": 2000, **E}, "actualizado": V},
                 "s2": {"id": "s2", "parcela_id": "p2", "cultivo_id": "cul_ajo", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2026-10-01", "fechaCosechaEstimada": "2027-05-29", "superficie": 3, **E}, "actualizado": V}}
t["trabajadores"] = {i: {"id": i, "nombre": n, "pin": pin, "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2025-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}
                     for i, n, pin in (("t-ana", "ANA INVENTADA", "4101"), ("t-beto", "BETO INVENTADO", "4102"))}
# Actividades tecleadas (nadie checa en este rancho): $400 de mano de obra cada una; la del 10 de noviembre lleva además $250 de urea.
ACTS = (("a0", "2026-11-03", "t-ana", "p1", "Riego", 0), ("a1", "2026-11-04", "t-beto", "p2", "Deshierbe", 0), ("a2", "2026-11-10", "t-ana", "p2", "Fertilización", 250),
        ("a3", "2026-10-20", "t-beto", "p1", "Riego", 0), ("a4", "2026-11-17", "t-beto", "p1", "Riego", 0), ("a5", "2025-11-10", "t-ana", "p1", "Riego", 0))
t["actividades"] = {i: {"id": i, "parcela_id": p, "fecha": f, "tipo": tipo, "datos": {"registradoPor": {"tipo": "planta", "id": q}, "horas_trab": 8,
                        "insumos": [{"id": "i-urea", "nombre": "UREA INVENTADA", "cantidad": 1, "unidad": "bulto", "costo": ins}] if ins else [], "costoMO": 400, "costoMaq": 0, "costoInsumos": ins, "costoTotal": 400 + ins, "sueldoDia": 400, **E}, "actualizado": V}
                    for i, f, q, p, tipo, ins in ACTS}
t["egresos"] = {"e1": {"id": "e1", "fecha": "2026-11-05", "parcela_id": "p1", "datos": {"concepto": "RIEGO ELECTRICO INVENTADO", "monto": 1500, "categoria": "riego", **E}, "actualizado": V},
                "e2": {"id": "e2", "fecha": "2026-11-06", "parcela_id": None, "datos": {"concepto": "PAPELERIA INVENTADA", "monto": 300, "categoria": "administracion", **E}, "actualizado": V},
                "e3": {"id": "e3", "fecha": "2025-11-06", "parcela_id": "p1", "datos": {"concepto": "RIEGO DEL AÑO PASADO", "monto": 900, "categoria": "riego", **E}, "actualizado": V},
                "e4": {"id": "e4", "fecha": "2026-11-08", "parcela_id": None, "datos": {"concepto": "COMPRA DE UREA PARA EL ALMACEN", "monto": 5000, "categoria": "insumos", "destinoInsumo": "inventario", **E}, "actualizado": V},
                "e5": {"id": "e5", "fecha": "2026-11-18", "parcela_id": None, "datos": {"concepto": "INSUMOS QUE NADIE CLASIFICO", "monto": 200, "categoria": "insumos", **E}, "actualizado": V}}
t["ingresos"] = {"i1": {"id": "i1", "fecha": "2026-11-12", "datos": {"concepto": "VENTA INVENTADA", "monto": 5000, "categoria": "venta_cosecha", "parcelaId": "p1", **E}, "actualizado": V}}
t["ciclos"] = {"ci1": {"id": "ci1", "estado": "activo", "datos": {"nombre": "TEMPORADA INVENTADA", "fechaInicio": "2026-09-01", "fechaFin": "", **E}, "actualizado": V}}
# Lo esperado, hecho a mano:
#   2026 (1 ene–19 nov): actividades 400+400+650+400+400 = 2,250; gastos con parcela 1,500; generales 300 → 4,050. Ingresos 5,000 → +950.
#   La compra para el almacén (5,000) NO es costo: cuenta cuando se usa (la urea de la fertilización ya está en sus 250). El insumo
#   sin clasificar (200) tampoco, hasta que alguien diga qué fue.
#   Noviembre 1–19: 400+400+650+400 + 1,500 + 300 = 3,650.  Noviembre 1–19 de 2025: 400 + 900 = 1,300 → 2,350 más (181 %).
#   Octubre: 400.  Semana del 13 al 19: 400.  Todo (Finanzas): 4,050 + 1,300 = 5,350 → utilidad −350.
#   Ciclo s1 (parcela uno desde el 1 de sept.): 400+400+400 + 1,500 = 2,700 (lo de 2025 es del ciclo s0) → 700 sobre su presupuesto.
#   Ciclo s2: 400 + 650 = 1,050.  Temporada desde el 1 de sept.: 4,050.
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
costo = lambda pg, periodo: pg.evaluate("p => window.__agroCuentas().costo(p).rancho", periodo)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept())
        pg.clock.install(time=f"{HOY}T18:30:00-06:00")      # a las seis y media de la tarde: con toISOString() ya sería «mañana»
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)

    # ── 1 · Finanzas → Resultados: todo lo registrado ──
    r = A.evaluate("() => JSON.parse(JSON.stringify(window.__agroCuentas().resultado))")
    caso("Finanzas: costos y gastos de todo lo registrado = 5,350 (sin la compra para el almacén ni el insumo sin clasificar)", r["egresos"] == 5350 and r["utilidad"] == -350, (r["egresos"], r["utilidad"]))
    caso("Finanzas: la compra para el almacén queda como inventario y lo no clasificado aparte", r["inventario"]["comprado"] == 5000 and r["porClasificar"]["monto"] == 200, (r["inventario"]["comprado"], r["porClasificar"]))
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "01-finanzas-resultados")
    caso("Finanzas en pantalla: «Costos y gastos totales $5,350» y utilidad −$350", "Costos y gastos totales | $5,350" in tx and "-$350" in tx, tx[:500])

    # ── 2 · Reportes → Cierre de mes: los meses suman el año ──
    meses = [costo(A, {"mes": f"2026-{m:02d}"}) for m in range(1, 12)]
    caso("Cierre de mes: octubre 400 y noviembre 3,650", meses[9] == 400 and meses[10] == 3650, meses)
    caso("y los once meses suman exacto lo del año (4,050)", sum(meses) == 4050 == costo(A, {"desde": "2026-01-01", "hasta": HOY}), (sum(meses), costo(A, {"desde": "2026-01-01", "hasta": HOY})))
    caso("y todo lo registrado = 2025 + 2026: lo mismo que Finanzas", costo(A, {"desde": "2025-01-01", "hasta": HOY}) == r["egresos"], costo(A, {"desde": "2025-01-01", "hasta": HOY}))
    ir(A, "reportes"); A.locator(".tab-pill", has_text="Cierre de mes").first.click(); A.wait_for_timeout(400)
    A.get_by_label("Mes que se cierra").fill("2026-11"); A.wait_for_timeout(500); tx = cuerpo(A); foto(A, "02-cierre-noviembre")
    caso("Cierre de mes en pantalla: noviembre dice $3,650 de todo el rancho", "$3,650" in tx, tx[:700])

    # ── 3 · ¿Cómo vamos? ──
    ir(A, "panel-financiero"); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "03-como-vamos")
    caso("¿Cómo vamos?: resultado del año +$950 con costos y gastos $4,050 (antes sumaba la compra del almacén y el insumo sin clasificar)", "+$950" in tx and "Costos y gastos: $4,050" in tx, tx[:600])
    caso("la compra para el almacén se dice aparte: no es costo hasta que se usa", "Comprado para el almacén: $5,000" in tx, tx[:700])
    caso("y avisa de los $200 que nadie ha clasificado", "$200 en insumos que nadie ha dicho" in tx, tx[:800])
    caso("este mes contra el MISMO mes del año pasado: $3,650 contra $1,300, $2,350 más", "noviembre de 2026 | $3,650" in tx and "noviembre de 2025 | $1,300" in tx and "$2,350 más que en noviembre de 2025 (181 %)" in tx, tx[:1300])
    caso("ya no compara contra el mes anterior", "mes pasado" not in tx and "octubre" not in tx, tx[:1300])
    caso("presupuesto: el ciclo de la parcela uno lleva $2,700 de $2,000 (lo de la temporada pasada no cuenta)", "Presupuesto $2,000 · gastado $2,700" in tx and "+$700" in tx, tx[1000:2200])
    caso("invertido en cultivos sin cosechar: $2,700 + $1,050 = $3,750", "Total comprometido | $3,750" in tx, tx[1200:2600])

    # ── 4 · Resumen semanal: siete días ──
    ir(A, "resumen"); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "04-resumen-semanal")
    caso("Resumen semanal: del 13 al 19 (siete días, también a las seis y media de la tarde)", "Del 2026-11-13 al 2026-11-19" in tx, tx[:300])
    caso("y la semana costó $400: el insumo sin clasificar no entra", "Costos y gastos $400" in tx and "-$400" in tx, tx[:500])

    # ── 5 · Temporadas ──
    ir(A, "ciclos"); A.wait_for_timeout(400); tx = cuerpo(A)
    caso("Temporadas, en la lista: ingresos $5,000 · costos $4,050 · resultado $950", "Ingresos $5,000 · Costos $4,050" in tx and "$950" in tx, tx[:600])
    A.locator(".card", has_text="TEMPORADA INVENTADA").first.click(); A.wait_for_timeout(500); tx = cuerpo(A); foto(A, "05-temporada")
    caso("la temporada ya no suma la urea dos veces (la compra y su uso): total $4,050", "Total de costos y gastos | $4,050" in tx, tx[:1200])
    caso("y dice aparte lo comprado para el almacén y lo que falta clasificar", "Comprado para el almacén en la temporada: $5,000" in tx and "$200 en insumos por clasificar" in tx, tx[:1500])

    # ── 6 · Mano de obra: lo tecleado también es mano de obra ──
    ir(A, "mano-obra"); A.locator(".tab-pill", has_text="Esta semana").click(); A.wait_for_timeout(400); tx = cuerpo(A)
    caso("Mano de obra, esta semana: $400 (antes decía $0 porque nadie checa)", "lo que se ganó el personal en el periodo | $400" in tx.lower() and "capturado como actividad $400" in tx, tx[:700])
    A.locator(".tab-pill", has_text="Otras fechas").click(); A.wait_for_timeout(300); A.get_by_label("Desde").fill("2026-11-01"); A.wait_for_timeout(500); tx = cuerpo(A); foto(A, "06-mano-de-obra")
    caso("del 1 al 19 de noviembre: $1,600 de mano de obra (cuatro días), todo cargado a parcelas", "lo que se ganó el personal en el periodo | $1,600" in tx.lower() and "cargado a parcelas | $1,600" in tx.lower(), tx[:900])
    caso("y cada día capturado se ve con su actividad, su parcela y quién lo trabajó", "Fertilización · PARCELA DOS | 2026-11-10 · ANA INVENTADA" in tx and "Capturado como actividad" in tx, tx[:2000])

    # ── 7 · El panel del dueño ve lo mismo ──
    D = aparato(DIR); tx = cuerpo(D); foto(D, "07-panel-del-dueno")
    caso("Dirección: el resultado del año es el mismo +$950 con $4,050 de costos y gastos", "+$950" in tx and "Costos y gastos: $4,050" in tx, tx[:900])
    caso("y cada cultivo en curso con el costo de SU ciclo ($2,700 y $1,050)", "costo directo del ciclo $2,700" in tx and "costo directo del ciclo $1,050" in tx, tx[:1800])
    ir(D, "panel-financiero"); tx = cuerpo(D)
    caso("Dirección en ¿Cómo vamos?: las mismas cifras", "+$950" in tx and "$2,350 más que en noviembre de 2025" in tx, tx[:900])

    # ── 8 · ContPAQi: las pólizas cuadran y el centro de costos es el cultivo del ciclo de ese día ──
    ir(A, "contpaqi")
    for ph, v in (("Ej: 6000000000", "6000000000"), ("Ej: 1110000000", "1110000000"), ("Ej: 4000000000", "4000000000"), ("Ej: 1120000000", "1120000000"), ("Ej: 6000000100", "6000000100"), ("Ej: 2110000000", "2110000000")):
        A.get_by_placeholder(ph).fill(v)
    A.get_by_role("button", name="Guardar cuentas").click(); A.wait_for_timeout(300)
    A.locator(".form-group", has=A.locator("label", has_text="Desde")).locator("input").fill("2026-11-01"); A.wait_for_timeout(200)
    with A.expect_download() as dl: A.get_by_role("button", name="Generar Excel de pólizas").click()
    import openpyxl, tempfile; ruta = str(pathlib.Path(tempfile.mkdtemp()) / dl.value.suggested_filename); dl.value.save_as(ruta)
    caso("el archivo se llama por los días que trae", dl.value.suggested_filename == "polizas-contpaqi-2026-11-03_a_2026-11-18.xlsx", dl.value.suggested_filename)
    filas = [r for r in openpyxl.load_workbook(ruta).active.iter_rows(values_only=True)][1:]
    cargos, abonos = sum(r[6] or 0 for r in filas), sum(r[7] or 0 for r in filas)
    por = lambda cta, col: sum(r[col] or 0 for r in filas if str(r[4]) == cta)
    caso("ContPAQi: cada póliza cuadra (cargos = abonos = 13,600)", cargos == abonos == 13600, (cargos, abonos))
    caso("gastos 7,000 (con la compra para el almacén y lo por clasificar: ver nota), ventas 5,000, mano de obra 1,600 (lo tecleado)", por("6000000000", 6) == 7000 and por("4000000000", 7) == 5000 and por("6000000100", 6) == 1600, (por("6000000000", 6), por("4000000000", 7), por("6000000100", 6)))
    centros = sorted({str(r[8] or "") for r in filas})
    caso("el centro de costos sale del ciclo: la parcela dos dice «Maíz» pero ese día tenía ajo", "Maíz" not in centros and sum(r[6] or 0 for r in filas if str(r[4]) == "6000000100" and r[8] == "Ajo") == 1600, centros)
    caso("las cuentas quedan guardadas para la próxima vez", (datos_cfg := A.evaluate("() => (window.__agroDatos.config_contpaqi || [])[0] || {}")).get("cuentaManoObra") == "6000000100", datos_cfg)

    # ── 9 · Recargar no cambia nada ──
    A.reload(); A.wait_for_timeout(3500); ir(A, "panel-financiero"); tx = cuerpo(A)
    caso("después de recargar: las mismas cifras", "+$950" in tx and "Costos y gastos: $4,050" in tx and "$2,350 más" in tx, tx[:700])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
