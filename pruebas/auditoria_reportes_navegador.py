"""AUDITORÍA FUNCIONAL · REPORTES Y TEMPORADAS CONTRA LAS MISMAS CIFRAS: el reporte de cada ciclo (por parcela) contra el
costo del periodo de Finanzas, el reporte por cultivo, el rendimiento (kg y kg/ha) y su costo por kilo; cerrar el mes en DOS
teléfonos (uno sin señal), reabrirlo con su porqué, lo que llega tarde y el cierre nuevo; y una temporada creada, editada,
cerrada y reabierta desde su pantalla. El mismo rancho inventado de auditoria_numeros, ya en diciembre.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_reportes_navegador.py"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-12-02"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); MIG = N.cuenta(2, "otro@prueba.invalid", "OTRO ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM, MIG]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
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
# Pendientes para el Resumen: una compra por aprobar, una incidencia, un insumo bajo su mínimo y una tarea.
# Lo cosechado en la parcela uno en esta temporada: 500 kg.
t["cosechas"] = {"cos-p1": {"id": "cos-p1", "parcela_id": "p1", "datos": {"unidad": "kg", "cultivo": "Ajo", "registros": [{"id": "cr1", "fecha": "2026-11-20", "cantidad": 500, "unidad": "kg", "siembraId": "s1"}], "ajustes": [], "usosSemilla": [], **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
renglon = lambda pg, periodo, pid: next((r for r in pg.evaluate("p => window.__agroCuentas().costo(p).renglones", periodo) if r["parcelaId"] == pid), {})
ESTADO_MES = "m => { const ev = window.__agroDatos.eventos.filter(e => e.datos && e.datos.mes === m); return { cierres: ev.filter(e => e.tipo === 'cierre_mes').length, reaperturas: ev.filter(e => e.tipo === 'reapertura_mes').length }; }"

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta, hh="10:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = ""
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)

    # ══ 1. El reporte de cada ciclo contra el costo del periodo de Finanzas ══
    ir(A, "reportes"); tx = cuerpo(A)
    caso("Por parcela: cada ciclo con su costo directo — Ajo actual de la uno $2,700, el de la temporada pasada $1,300, el de la dos $1,050", "$2,700" in tx and "$1,300" in tx and "$1,050" in tx, tx[:1200])
    r1 = renglon(A, {"desde": "2026-09-01", "hasta": HOY}, "p1"); r2 = renglon(A, {"desde": "2026-10-01", "hasta": HOY}, "p2")
    caso("y Finanzas, para las mismas fechas, dice lo mismo: parcela uno $2,700 desde su siembra, parcela dos $1,050", r1.get("directo") == 2700 and r2.get("directo") == 1050, [r1, r2])
    A.locator(".list-item", has_text="actual").first.click(); A.wait_for_timeout(500); tx = cuerpo(A)
    caso("el reporte del ciclo: $2,700 de costo, $5,000 de ingreso, utilidad $2,300, y 500 kg cosechados a $5.40 el kilo", "$2,700" in tx and "$5,000" in tx and "$2,300" in tx and "500" in tx and "$5.40" in tx, tx[:1500])
    caso("RENDIMIENTO del ciclo: 500 kg en 2 ha = 250 kg por hectárea", re.search(r"Rendimiento/ha \| 250 kg", tx), tx[tx.find("Cosecha y rendimiento"):][:300])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)
    A.locator(".tab-pill", has_text="Por cultivo").click(); A.wait_for_timeout(400); tx = cuerpo(A)
    caso("Por cultivo: el ajo suma los tres ciclos ($2,700 + $1,300 + $1,050 = $5,050)", "$5,050" in tx, tx[:900])

    # ══ 2. Cerrar noviembre en dos teléfonos, uno sin señal ══
    B = aparato(MIG, "10:05")
    nube.caida = True
    ir(B, "reportes"); B.locator(".tab-pill", has_text="Cierre de mes").click(); B.wait_for_timeout(400); B.get_by_label("Mes que se cierra").fill("2026-11"); B.wait_for_timeout(300)
    B.get_by_role("button", name="Cerrar el mes").click(); B.wait_for_timeout(700); tb = cuerpo(B)
    caso("SIN SEÑAL el otro teléfono cierra noviembre y lo enseña cerrado (por validar mientras no sube)", "Cerrado" in tb or "por validar" in tb.lower(), tb[:600])
    nube.caida = False
    ir(A, "reportes"); A.locator(".tab-pill", has_text="Cierre de mes").click(); A.wait_for_timeout(400); A.get_by_label("Mes que se cierra").fill("2026-11"); A.wait_for_timeout(300)
    A.get_by_role("button", name="Cerrar el mes").click(); A.wait_for_timeout(900); ta = cuerpo(A)
    caso("con señal, este teléfono también cierra noviembre: versión 1, quién y cuándo", "Cerrado · versión 1 · lo cerró ADMIN DE PRUEBA" in ta, ta[:700])
    subio(A); subio(B); A.reload(); A.wait_for_timeout(3500); B.reload(); B.wait_for_timeout(3500)
    caso("al juntarse quedan los DOS cierres (cada uno con lo que vio), ninguno se pierde", A.evaluate(ESTADO_MES, "2026-11")["cierres"] == 2 and B.evaluate(ESTADO_MES, "2026-11")["cierres"] == 2, [A.evaluate(ESTADO_MES, "2026-11"), B.evaluate(ESTADO_MES, "2026-11")])
    ir(A, "reportes"); A.locator(".tab-pill", has_text="Cierre de mes").click(); A.wait_for_timeout(400); A.get_by_label("Mes que se cierra").fill("2026-11"); A.wait_for_timeout(300); ta = cuerpo(A)
    caso("y la pantalla lo dice: versión 2, con la versión 1 a la vista", "versión 2" in ta and "la versión 1" in ta, ta[:800])

    # ══ 3. Reabrir con su porqué; lo que llega tarde; el cierre nuevo ══
    A.get_by_role("button", name="Reabrir el mes").click(); A.wait_for_timeout(500)
    caso("reabrir sin decir por qué no reabre", A.evaluate(ESTADO_MES, "2026-11")["reaperturas"] == 0, A.dialogos[-1:])
    A.get_by_label("Por qué se reabre el mes").fill("FALTÓ UNA ACTIVIDAD DEL 25"); A.get_by_role("button", name="Reabrir el mes").click(); A.wait_for_timeout(700)
    caso("con su porqué se reabre", A.evaluate(ESTADO_MES, "2026-11")["reaperturas"] == 1 and "FALTÓ UNA ACTIVIDAD DEL 25" in cuerpo(A), cuerpo(A)[:600])
    subio(A)
    # Lo que faltaba: Beto el 25 de noviembre en la parcela dos, capturado en el otro teléfono.
    ir(B, "registrar-actividad"); B.get_by_text("BETO INVENTADO").first.click(); B.wait_for_timeout(400); B.get_by_text("PARCELA DOS").first.click(); B.wait_for_timeout(400)
    B.get_by_text("Riego", exact=True).first.click(); campo(B, "Fecha").fill("2026-11-25"); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500)
    B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300); subio(B)
    A.reload(); A.wait_for_timeout(3500); ir(A, "reportes"); A.locator(".tab-pill", has_text="Cierre de mes").click(); A.wait_for_timeout(400); A.get_by_label("Mes que se cierra").fill("2026-11"); A.wait_for_timeout(300)
    caso("el reabierto ya cuenta lo nuevo: la parcela dos en noviembre pasa a $1,450", renglon(A, {"mes": "2026-11"}, "p2").get("directo") == 1450, renglon(A, {"mes": "2026-11"}, "p2"))
    A.get_by_role("button", name=re.compile("Cerrar otra vez")).click(); A.wait_for_timeout(500)
    caso("el cierre nuevo pide qué cambió", A.evaluate(ESTADO_MES, "2026-11")["cierres"] == 2, cuerpo(A)[:500])
    A.get_by_label("Qué cambió en este cierre de mes").fill("SE AGREGÓ EL RIEGO DEL 25"); A.get_by_role("button", name=re.compile("Cerrar otra vez")).click(); A.wait_for_timeout(800); ta = cuerpo(A)
    caso("y queda la versión 3 con su porqué; las anteriores no se tocan", A.evaluate(ESTADO_MES, "2026-11")["cierres"] == 3 and "versión 3" in ta and "SE AGREGÓ EL RIEGO DEL 25" in ta, ta[:800])
    subio(A); B.reload(); B.wait_for_timeout(3500); ir(B, "reportes"); B.locator(".tab-pill", has_text="Cierre de mes").click(); B.wait_for_timeout(400); B.get_by_label("Mes que se cierra").fill("2026-11"); B.wait_for_timeout(300)
    caso("el otro teléfono ve lo mismo: versión 3", "versión 3" in cuerpo(B), cuerpo(B)[:600])

    # ══ 4. Una temporada desde su pantalla ══
    ir(A, "ciclos"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(300)
    campo(A, "Nombre de la temporada").fill("AJO 2027 INVENTADA"); campo(A, "Fecha de inicio").fill("2026-09-01"); campo(A, "Fecha de fin").fill("2026-08-01")
    A.get_by_role("button", name="Crear temporada").click(); A.wait_for_timeout(400)
    caso("una temporada que termina antes de empezar no se crea", not any(c.get("nombre") == "AJO 2027 INVENTADA" for c in datos(A)["ciclos"]), A.dialogos[-1:])
    campo(A, "Fecha de fin").fill(""); A.get_by_role("button", name="Crear temporada").click(); A.wait_for_timeout(500)
    ci = [c for c in datos(A)["ciclos"] if c.get("nombre") == "AJO 2027 INVENTADA"]
    caso("se crea la temporada desde el 1 de septiembre, en curso", len(ci) == 1 and ci[0]["estado"] == "activo" and not ci[0].get("fechaFin"), ci)
    A.get_by_text("AJO 2027 INVENTADA").first.click(); A.wait_for_timeout(500); tx = cuerpo(A)
    caso("su resultado: $5,000 de ingreso contra $4,450 de costos y gastos (producción $4,150 y generales $300) = $550", "$5,000" in tx and "$4,450" in tx and "$550" in tx, tx[:1200])
    A.get_by_role("button", name="Editar datos de la temporada").click(); A.wait_for_timeout(300)
    campo(A, "Nombre").fill("AJO 2027"); A.get_by_role("button", name="Guardar cambios").click(); A.wait_for_timeout(500)
    caso("editarla cambia su nombre", any(c.get("nombre") == "AJO 2027" for c in datos(A)["ciclos"]), [c.get("nombre") for c in datos(A)["ciclos"]])
    if A.get_by_role("button", name="Cerrar temporada").count() == 0: A.get_by_text("AJO 2027").first.click(); A.wait_for_timeout(400)
    A.get_by_role("button", name="Cerrar temporada").click(); A.wait_for_timeout(500)
    ci = [c for c in datos(A)["ciclos"] if c.get("nombre") == "AJO 2027"][0]
    caso("CERRAR: queda cerrada, termina hoy y con quién la cerró", ci["estado"] == "cerrado" and ci["fechaFin"] == HOY and (ci.get("cierre") or {}).get("quien") == "ADMIN DE PRUEBA", ci)
    A.get_by_text("AJO 2027").first.click(); A.wait_for_timeout(400)
    A.respuesta = ""; A.get_by_role("button", name="Reabrir temporada").click(); A.wait_for_timeout(400)
    caso("reabrir sin porqué no la reabre", [c for c in datos(A)["ciclos"] if c.get("nombre") == "AJO 2027"][0]["estado"] == "cerrado")
    A.respuesta = "FALTA LA COSECHA DE DICIEMBRE"; A.get_by_role("button", name="Reabrir temporada").click(); A.wait_for_timeout(500)
    ci = [c for c in datos(A)["ciclos"] if c.get("nombre") == "AJO 2027"][0]; tx = cuerpo(A)
    caso("REABRIR con su porqué: vuelve a estar en curso (sin la fecha de fin que le puso el cierre) y el historial lo dice", ci["estado"] == "activo" and not ci.get("fechaFin") and [h["que"] for h in ci.get("historial") or []] == ["cerrada", "reabierta"] and "FALTA LA COSECHA DE DICIEMBRE" in tx, [ci, tx[:600]])
    subio(A); B.reload(); B.wait_for_timeout(3500)
    caso("el otro teléfono ve la temporada reabierta con su historial", any(c.get("nombre") == "AJO 2027" and c.get("estado") == "activo" and len(c.get("historial") or []) == 2 for c in datos(B)["ciclos"]), [c.get("nombre") for c in datos(B)["ciclos"]])

    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados and not nube.rechazos, [nube.ocupados[:3], nube.rechazos[:3]])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
