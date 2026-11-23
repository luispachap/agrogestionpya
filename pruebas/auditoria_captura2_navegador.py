"""AUDITORÍA FUNCIONAL · LO QUE FALTABA DE LA CAPTURA DIARIA: trabajo de bodega de un cultivo, una cosecha con su
cantidad, «quién lo ordenó», capturar otro día; registro de varios con máquina, un encargado y un externo en la misma
captura (y la máquina cuando no va nadie de planta); indicaciones con prioridad, quién la dio por hecha, necesidades y
borrar; y los contadores del Resumen contra sus pantallas. Cuentas, 390 px, nube de imitación, recarga y otro teléfono.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_captura2_navegador.py"""
import datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"; AYER = "2026-11-18"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V},
                      "p2": {"id": "p2", "nombre": "PARCELA DOS", "rancho_id": "r1", "datos": {"hectareas": 3, "cultivo": "Ajo", **E}, "actualizado": V}}
nube.t["cultivos"] = {"c1": {"id": "c1", "nombre": "Ajo", "datos": E, "actualizado": V}}
nube.t["siembras"] = {"s1": {"id": "s1", "parcela_id": "p1", "cultivo_id": "c1", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2026-08-01", "superficie": 2, **E}, "actualizado": V}}
nube.t["maquinaria"] = {"m-1": {"id": "m-1", "nombre": "TRACTOR INVENTADO", "costo_hora": 100, "datos": {"tipo": "tractor", **E}, "actualizado": V}}
for i, n, pin, s in (("t-ana", "ANA INVENTADA", "4101", 400), ("t-beto", "BETO INVENTADO", "4102", 400)):
    nube.t.setdefault("trabajadores", {})[i] = {"nombre": n, "pin": pin, "id": i, "datos": {"categoria": "jornalero", "sueldo_dia": s, "historialSueldo": [{"desde": "2026-11-01", "sueldo_dia": s, "anterior": s}], **E}, "actualizado": V}
nube.t["encargados"] = {"e-capa": {"id": "e-capa", "nombre": "CAPATAZ INVENTADO", "pin": "5101", "datos": {"sueldo_dia": 500, "historialSueldo": [{"desde": "2026-11-01", "sueldo_dia": 500, "anterior": 500}], **E}, "actualizado": V}}
nube.t["externos"] = {"x-1": {"id": "x-1", "nombre": "EXTERNO INVENTADO", "estado": "activo", "datos": E, "actualizado": V}}
nube.t["inventario"] = {"i-cero": {"id": "i-cero", "nombre": "HERRAMIENTA SIN MINIMO", "cat": "herramienta", "unidad": "pieza", "existencia": 0, "costo_unit": 0, "minimo": 0, "datos": E, "actualizado": V},
                        "i-bajo": {"id": "i-bajo", "nombre": "UREA CON MINIMO", "cat": "fertilizante", "unidad": "bulto", "existencia": 2, "costo_unit": 100, "minimo": 5, "datos": E, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
costo_de = lambda pg, pid: sum(a.get("costoTotal") or 0 for a in datos(pg).get("actividadesContables", []) if a.get("parcelaId") == pid)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta, hh="09:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.siConfirma = True
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept("MOTIVO INVENTADO") if d.type == "prompt" else (d.accept() if pg.siConfirma or d.type == "alert" else d.dismiss())))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    B = aparato(ENC)
    def actividad(pg, quien, lugar, tipo, fecha=None, ordeno=None, cosecha=None):
        ir(pg, "registrar-actividad"); pg.get_by_text(quien).first.click(); pg.wait_for_timeout(400)
        pg.get_by_text(lugar).first.click(); pg.wait_for_timeout(400)
        pg.get_by_text(tipo, exact=True).first.click(); pg.wait_for_timeout(250)
        if cosecha: campo(pg, "Cantidad").fill(str(cosecha))
        if fecha: campo(pg, "Fecha").fill(fecha)
        if ordeno: pg.get_by_label("Quién lo ordenó").select_option(label=ordeno)
        pg.get_by_role("button", name="Continuar →").click(); pg.wait_for_timeout(500)
        t = cuerpo(pg); pg.get_by_role("button", name="✓ Registrar actividad").click(); pg.wait_for_timeout(3300); return t

    # ══ 1. Trabajo de bodega de un cultivo ══
    t = actividad(B, "ANA INVENTADA", "Bodega · ", "Empaque")
    a = [x for x in datos(B)["actividades"] if x["tipo"] == "Empaque"]
    caso("TRABAJO DE BODEGA: queda la actividad de Ana en la bodega del ajo, sin parcela", len(a) == 1 and a[0]["esBodega"] and a[0]["cultivoBodega"] == "Ajo" and a[0]["parcelaId"] == "", a)
    c = B.evaluate("() => window.__agroCuentas().costo({ mes: '2026-11' })")
    caso("su día ($400) es costo directo de la bodega del ajo y no se le carga a ninguna parcela", costo_de(B, "p1") == 0 and costo_de(B, "p2") == 0 and "400" in json.dumps(c.get("bodega")), json.dumps(c.get("bodega"))[:300])

    # ══ 2. Una cosecha con su cantidad, quién lo ordenó ══
    t = actividad(B, "BETO INVENTADO", "PARCELA UNO", "Cosecha", ordeno="ENCARGADO DE PRUEBA", cosecha=500)
    a = [x for x in datos(B)["actividades"] if x["tipo"] == "Cosecha"]; cos = datos(B).get("cosechas") or []
    caso("COSECHA: la actividad lleva sus 500 kg y la cosecha de la parcela uno queda con un registro de 500 ligado a esa actividad", len(a) == 1 and (a[0].get("cosecha") or {}).get("cantidad") == 500 and len(cos) == 1 and cos[0]["parcelaId"] == "p1" and [r.get("cantidad") for r in cos[0]["registros"]] == [500] and cos[0]["registros"][0].get("actividadId") == a[0]["id"], [a, cos])
    caso("QUIÉN LO ORDENÓ queda en la actividad, aparte de quién la hizo y quién la capturó", ((a[0].get("quienes") or {}).get("ordeno") or {}).get("nombre") == "ENCARGADO DE PRUEBA" and a[0]["registradoPor"]["id"] == "t-beto" and ((a[0].get("quienes") or {}).get("capturo") or {}).get("nombre") == "ENCARGADO DE PRUEBA", [a[0].get("ordenadoPor"), a[0].get("quienes")])

    # ══ 3. Capturar otro día ══
    t = actividad(B, "ANA INVENTADA", "PARCELA DOS", "Riego", fecha=AYER)
    a = [x for x in datos(B)["actividades"] if x["tipo"] == "Riego"]
    caso("CAPTURAR OTRO DÍA: la actividad queda con la fecha de ayer y la confirmación lo decía", len(a) == 1 and a[0]["fecha"] == AYER and AYER in t, [a, t[:300]])
    ac = {(x["tipo"], x["fecha"]): x.get("costoMO") for x in datos(B)["actividadesContables"] if x.get("registradoPor", {}).get("id") == "t-ana"}
    caso("ayer y hoy son dos días distintos de Ana: cada uno su día completo ($400 y $400)", ac == {("Empaque", HOY): 400, ("Riego", AYER): 400}, ac)

    # ══ 4. Registro de varios: tractor + un encargado + un externo + uno de planta ══
    ir(B, "registro-masivo"); campo(B, "Parcela").select_option("p2"); B.get_by_text("Deshierbe", exact=True).first.click(); campo(B, "Maquinaria").select_option("m-1")
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500)
    B.get_by_text("BETO INVENTADO").first.click(); B.get_by_text("CAPATAZ INVENTADO").first.click(); B.get_by_text("EXTERNO INVENTADO").first.click(); B.wait_for_timeout(300)
    ext = B.locator(".parcela-card", has_text="EXTERNO INVENTADO")
    ext.locator(".inp-row").first.locator("input").nth(0).fill("50"); ext.locator(".inp-row").first.locator("input").nth(1).fill("6"); B.wait_for_timeout(200)
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500); t = cuerpo(B)
    caso("la confirmación enseña a los tres y lo que cuesta cada uno (Beto $400, el capataz $500, el externo 6 × $50 = $300)", all(x in t for x in ("BETO INVENTADO", "CAPATAZ INVENTADO", "EXTERNO INVENTADO", "$400", "$500", "$300")), t[:900])
    B.get_by_role("button", name=re.compile("Registrar 3 actividades")).click(); B.wait_for_timeout(3300)
    a = sorted([x for x in datos(B)["actividades"] if x["tipo"] == "Deshierbe"], key=lambda x: x["registradoPor"]["tipo"])
    caso("quedan TRES actividades: encargado, externo y planta, cada una con su tipo de persona", [x["registradoPor"]["tipo"] for x in a] == ["encargado", "externo", "planta"], [(x["registradoPor"], x.get("costoMO")) for x in a])
    maq = [x for x in a if x.get("maquinariaId")]
    caso("el tractor va UNA sola vez (8 h × $100 = $800), no por persona", len(maq) == 1 and maq[0]["costoMaq"] == 800, [(x["registradoPor"]["tipo"], x.get("maquinariaId"), x.get("costoMaq")) for x in a])
    caso("la parcela dos carga Beto $200 (su día se reparte con la cosecha de la uno) + capataz $500 + externo $300 + tractor $800 + el riego de Ana de ayer $400 = $2,200", costo_de(B, "p2") == 2200, costo_de(B, "p2"))
    # Sin nadie de planta: antes el tractor se perdía
    ir(B, "registro-masivo"); campo(B, "Parcela").select_option("p1"); B.get_by_text("Transporte", exact=True).first.click(); campo(B, "Maquinaria").select_option("m-1")
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500)
    B.get_by_text("EXTERNO INVENTADO").first.click(); B.wait_for_timeout(300); ext = B.locator(".parcela-card", has_text="EXTERNO INVENTADO")
    ext.locator(".inp-row").first.locator("input").nth(0).fill("100"); ext.locator(".inp-row").first.locator("input").nth(1).fill("2")
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500); B.get_by_role("button", name=re.compile("Registrar 1 actividad")).click(); B.wait_for_timeout(3300)
    tr = [x for x in datos(B)["actividades"] if x["tipo"] == "Transporte"]
    caso("CON SÓLO UN EXTERNO Y EL TRACTOR: el tractor ya no se pierde, queda en esa actividad con sus 8 horas ($800)", len(tr) == 1 and tr[0].get("maquinariaId") == "m-1" and tr[0].get("costoMaq") == 800 and tr[0].get("costoTotal") == 1000, tr)
    subio(B)

    # ══ 5. Indicaciones: prioridad, hecha por quién, borrar con pregunta; y una necesidad ══
    ir(B, "tareas"); B.get_by_role("button", name=re.compile("Nueva|\\+")).first.click(); B.wait_for_timeout(300)
    campo(B, "Asignar a").select_option("t-ana"); campo(B, "¿Qué debe hacer?").fill("REGAR LA PARCELA DOS"); B.locator(".pill", has_text="Alta").first.click()
    B.get_by_role("button", name="Enviar indicación").click(); B.wait_for_timeout(500)
    B.get_by_role("button", name=re.compile("Nueva|\\+")).first.click(); B.wait_for_timeout(300)
    campo(B, "Asignar a").select_option("t-beto"); campo(B, "¿Qué debe hacer?").fill("LIMPIAR CANALES"); B.locator(".pill", has_text="Baja").first.click()
    B.get_by_role("button", name="Enviar indicación").click(); B.wait_for_timeout(500)
    ta = {x["titulo"]: x for x in datos(B)["tareas"]}
    caso("dos indicaciones con su prioridad (alta y baja)", ta.get("REGAR LA PARCELA DOS", {}).get("prioridad") == "alta" and ta.get("LIMPIAR CANALES", {}).get("prioridad") == "baja", {k: v.get("prioridad") for k, v in ta.items()})
    B.locator(".card", has_text="LIMPIAR CANALES").get_by_role("button", name="Marcar completada").click(); B.wait_for_timeout(500)
    tc = [x for x in datos(B)["tareas"] if x["titulo"] == "LIMPIAR CANALES"][0]
    caso("darla por hecha deja quién y cuándo", tc["estado"] == "completada" and (tc.get("completadaPor") or {}).get("nombre") == "ENCARGADO DE PRUEBA" and tc.get("completadaEn"), tc)
    B.siConfirma = False; n0 = len(B.dialogos); B.locator(".card", has_text="REGAR LA PARCELA DOS").get_by_label("Borrar la indicación").click(); B.wait_for_timeout(400)
    caso("borrar pregunta antes («ANA INVENTADA deja de verla») y si se dice que no, sigue ahí", any("deja de verla" in d and "ANA INVENTADA" in d for d in B.dialogos[n0:]) and any(x["titulo"] == "REGAR LA PARCELA DOS" for x in datos(B)["tareas"]), B.dialogos[n0:])
    B.siConfirma = True
    B.locator(".card", has_text="REGAR LA PARCELA DOS").get_by_label("Borrar la indicación").click(); B.wait_for_timeout(500)
    caso("si se dice que sí, la indicación se borra", not any(x["titulo"] == "REGAR LA PARCELA DOS" for x in datos(B)["tareas"]), [x["titulo"] for x in datos(B)["tareas"]])
    B.locator(".tab-pill", has_text="Incidencias y necesidades").click(); B.wait_for_timeout(300); B.locator(".top-bar .btn-accent, .btn-accent.btn-sm").first.click(); B.wait_for_timeout(300)
    B.get_by_text("Necesidad", exact=True).first.click(); campo(B, "Descripción").fill("SE NECESITAN MANGUERAS"); B.locator(".pill", has_text="Alta").last.click()
    B.get_by_role("button", name="Enviar reporte").click(); B.wait_for_timeout(500)
    inc = [x for x in datos(B)["incidencias"] if x.get("desc") == "SE NECESITAN MANGUERAS"]
    caso("NECESIDAD desde Tareas: queda como necesidad, pendiente, prioridad alta, a nombre del encargado", len(inc) == 1 and inc[0]["clase"] == "necesidad" and inc[0]["estado"] == "pendiente" and inc[0]["prioridad"] == "alta", inc)
    subio(B)

    # ══ 6. El Resumen contra sus pantallas, en el teléfono del administrador ══
    A = aparato(ADM, "10:00"); ir(A, "resumen"); t = cuerpo(A)
    caso("Resumen: 1 incidencia pendiente, ninguna indicación sin completar (la que quedaba se borró), y como stock bajo SÓLO la urea (la herramienta sin mínimo en cero no es alarma)", re.search(r"Incidencias pendientes \| 1", t) and "Tareas sin completar" not in t and re.search(r"Insumos con stock bajo \| 1", t), t[:900])
    ir(A, "inventario"); A.wait_for_timeout(300)
    est = lambda nombre: A.locator(".list-item", has_text=nombre).first.inner_text()
    caso("y el inventario dice lo mismo: la urea (2 de mínimo 5) Crítico, la herramienta sin mínimo en cero OK", "Crítico" in est("UREA CON MINIMO") and "OK" in est("HERRAMIENTA SIN MINIMO") and "Crítico" not in est("HERRAMIENTA SIN MINIMO"), [est("UREA CON MINIMO"), est("HERRAMIENTA SIN MINIMO")])
    ir(A, "nomina"); A.wait_for_timeout(500); t = cuerpo(A)
    caso("en Pagos: Ana $800 (ayer y hoy) y Beto $400 (la cosecha y el deshierbe son del mismo día: reparten UN día)", re.search(r"ANA INVENTADA \| [^|]+ \| \$800 \|", t) and re.search(r"BETO INVENTADO \| [^|]+ \| \$400 \|", t), t[300:1400])

    # ══ 7. Recargar y otro teléfono ══
    A.reload(); A.wait_for_timeout(3500)
    caso("al recargar el otro teléfono ve las 7 actividades, la cosecha y sólo la indicación hecha (la borrada no regresa)", len(datos(A)["actividades"]) == 7 and len(datos(A).get("cosechas") or []) == 1 and [x["estado"] for x in datos(A)["tareas"]] == ["completada"], [len(datos(A)["actividades"]), len(datos(A).get("cosechas") or []), [x["estado"] for x in datos(A)["tareas"]]])
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
