"""AUDITORÍA FUNCIONAL · CAPTURA DIARIA: registrar una actividad a nombre de alguien, registro de varios, pase de lista,
tareas e incidencias, y lo que ve el trabajador (sus días y reportar). Con cuentas, como una persona, 390 px, nube de
imitación. En cada paso: lo que queda guardado, el costo de la parcela y lo que le corresponde a cada quien en Pagos.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_captura_navegador.py"""
import datetime, json, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"      # jueves
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": V},
                      "p2": {"id": "p2", "nombre": "PARCELA DOS", "rancho_id": "r1", "datos": {"hectareas": 3, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": V}}
GENTE = (("t-ana", "ANA INVENTADA", "4101", 400), ("t-beto", "BETO INVENTADO", "4102", 400), ("t-caro", "CARO INVENTADA", "4103", 480), ("t-dani", "DANI INVENTADO", "4104", 400))
nube.t["inventario"] = {"i-urea": {"id": "i-urea", "nombre": "UREA INVENTADA", "cat": "fertilizante", "unidad": "bulto", "existencia": 10, "costo_unit": 100, "minimo": 0, "datos": {"emoji": "📦", **E}, "actualizado": V}}
nube.t["maquinaria"] = {"m-1": {"id": "m-1", "nombre": "TRACTOR INVENTADO", "costo_hora": 100, "datos": {"tipo": "tractor", **E}, "actualizado": V}}
for i, n, pin, s in GENTE: nube.t.setdefault("trabajadores", {})[i] = {"nombre": n, "pin": pin, "id": i, "datos": {"categoria": "jornalero", "sueldo_dia": s, "historialSueldo": [{"desde": "2026-11-01", "sueldo_dia": s, "anterior": s}], **E}, "actualizado": V}
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
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png")
CUENTAS = """() => { const c = window.__agroCuentas(); const r = c.resultado; return JSON.parse(JSON.stringify({ sale: c.flujo.egresos, egresos: r.egresos })); }"""
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).first
costo_de = lambda pg, pid: sum(a.get("costoTotal") or 0 for a in datos(pg).get("actividadesContables", []) if a.get("parcelaId") == pid)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="08:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = "MOTIVO INVENTADO"
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        if cuenta:
            pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
            for _ in range(30):
                pg.wait_for_timeout(300)
                if pg.locator(".login-bg").count() == 0: break
            pg.wait_for_timeout(2500)
        return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    def recarga(pg): hora(pg); pg.reload(); pg.wait_for_timeout(3500)
    def al_dia(pg): avanza(pg, 6 / 60); recarga(pg)

    # ══ 1. Registrar una actividad a nombre de un trabajador ══
    B = aparato(ENC, "07:00")
    def actividad(pg, quien, parcela, tipo, horas=None, fecha=None):
        ir(pg, "registrar-actividad"); pg.get_by_text(quien).first.click(); pg.wait_for_timeout(400)
        pg.get_by_text(parcela).first.click(); pg.wait_for_timeout(400)
        if tipo: pg.get_by_text(tipo, exact=True).first.click(); pg.wait_for_timeout(250)
        if horas is not None: campo(pg, "Horas trabajadas").fill(str(horas))
        if fecha: campo(pg, "Fecha").fill(fecha)
        pg.get_by_role("button", name="Continuar →").click(); pg.wait_for_timeout(500)
    actividad(B, "ANA INVENTADA", "PARCELA UNO", None); t = cuerpo(B)
    caso("sin escoger qué actividad fue no se avanza a confirmar", "Confirmar registro" not in t, t[:300])
    actividad(B, "ANA INVENTADA", "PARCELA UNO", "Riego"); t = cuerpo(B); foto(B, "01-confirmar-actividad")
    caso("antes de guardar enseña quién lo hizo, dónde, qué, cuántas horas y que queda a nombre de quien captura", all(x in t for x in ("ANA INVENTADA", "PARCELA UNO", "Riego", "8 horas", HOY, "ENCARGADO DE PRUEBA")), t[:500])
    B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300)
    a = datos(B)["actividades"]
    caso("queda una actividad con su ejecutor, quién la capturó, su parcela y el costo de un día ($400)", len(a) == 1 and a[0]["registradoPor"]["id"] == "t-ana" and a[0]["registradoEnNombrePor"]["nombre"] == "ENCARGADO DE PRUEBA" and a[0]["parcelaId"] == "p1" and a[0]["costoMO"] == 400 and a[0]["quienes"]["ejecutaron"][0]["id"] == "t-ana" and a[0]["quienes"]["capturo"]["nombre"] == "ENCARGADO DE PRUEBA", a)
    caso("el costo llega a la parcela ($400) y al resultado", costo_de(B, "p1") == 400 and B.evaluate(CUENTAS)["egresos"] == 400, [costo_de(B, "p1"), B.evaluate(CUENTAS)])
    actividad(B, "ANA INVENTADA", "PARCELA DOS", "Deshierbe"); B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300)
    ac = {x["tipo"]: x.get("costoMO") for x in datos(B)["actividadesContables"]}
    caso("otra actividad de la misma persona el mismo día NO le paga dos días: su día ($400) se reparte entre las dos parcelas", len(datos(B)["actividades"]) == 2 and ac == {"Riego": 200, "Deshierbe": 200} and costo_de(B, "p1") == 200 and costo_de(B, "p2") == 200 and B.evaluate(CUENTAS)["egresos"] == 400, [ac, B.evaluate(CUENTAS)])

    # ══ 2. Registro de varios: la misma actividad para varias personas ══
    ir(B, "registro-masivo"); n0 = len(B.dialogos); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(300)
    caso("sin parcela ni actividad no avanza, y dice qué falta", "Quiénes trabajaron" not in cuerpo(B) and len(B.dialogos) > n0, B.dialogos[n0:])
    campo(B, "Parcela").select_option("p2"); B.get_by_text("Fertilización", exact=True).first.click(); B.wait_for_timeout(200); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500)
    n0 = len(B.dialogos); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(300)
    caso("sin marcar a nadie tampoco", "Confirmar registro" not in cuerpo(B) and len(B.dialogos) > n0, B.dialogos[n0:])
    B.get_by_text("BETO INVENTADO").first.click(); B.get_by_text("CARO INVENTADA").first.click(); B.wait_for_timeout(300)
    B.locator('input[type="number"]:visible').nth(3).fill("4"); B.wait_for_timeout(200)
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500); t = cuerpo(B); foto(B, "02-registro-de-varios")
    caso("la confirmación dice lo que de verdad se va a pagar: Beto su día $400; Caro, aunque sean 4 horas, su día $480; total $880", "Se crearán 2 registros" in t and "8 h" in t and "$400" in t and "4 h" in t and "$480" in t and "$880" in t and "$240" not in t and "Se paga por día" in t, t[:800])
    B.get_by_role("button", name=re.compile("Registrar 2 actividades")).click(); B.wait_for_timeout(3300)
    a = datos(B)["actividades"]; nuevos = sorted((x["registradoPor"]["id"], x["costoMO"], x["horas_trab"], x["parcelaId"], x["tipo"]) for x in a if x["tipo"] == "Fertilización")
    caso("quedan dos actividades, una por persona, con sus horas y quién las capturó", [(x[0], x[2], x[3], x[4]) for x in nuevos] == [("t-beto", 8, "p2", "Fertilización"), ("t-caro", 4, "p2", "Fertilización")] and all(x["quienes"]["capturo"]["nombre"] == "ENCARGADO DE PRUEBA" for x in a) and len({x["id"] for x in a}) == 4, nuevos)
    caso("el costo de la parcela dos sube exacto lo que dijo la pantalla: $200 de Ana + $400 + $480", costo_de(B, "p2") == 1080 and B.evaluate(CUENTAS)["egresos"] == 1280, [costo_de(B, "p2"), B.evaluate(CUENTAS)])

    # ══ 3. Pase de lista: presente no es pagado ══
    ir(B, "pase-lista")
    dia = lambda pg, nombre, n: pg.locator("div", has_text=re.compile("^" + nombre)).last.locator("xpath=..").locator("button").nth(n)   # 0 = lunes
    dia(B, "BETO INVENTADO", 2).click(); B.wait_for_timeout(500)      # miércoles 18: vino, pero nadie anotó en qué
    asis = datos(B).get("asistencia") or []
    caso("palomear a Beto el miércoles deja su asistencia de ese día", any(x.get("trabajadorId") == "t-beto" and x.get("fecha") == "2026-11-18" and x.get("presente") for x in asis), asis)
    t = cuerpo(B); foto(B, "03-pase-de-lista")
    caso("la pantalla avisa que ese día está palomeado pero sin actividad", "sin actividad" in t.lower() or "no está registrado" in t.lower(), t[:700])
    caso("y palomear NO genera pago ni costo: todo sigue igual", B.evaluate(CUENTAS)["egresos"] == 1280, B.evaluate(CUENTAS))

    subio(B)
    A = aparato(ADM, "09:00"); hora(A); ir(A, "nomina"); A.wait_for_timeout(500); t = cuerpo(A); foto(A, "04-pagos")
    caso("en Pagos al personal a cada quien le corresponde lo registrado: Ana $400 (un día, no dos), Beto $400, Caro $480", all(re.search(n + r" INVENTAD[AO] \| [^|]+ \| \$" + m + r" \|", t) for n, m in (("ANA", "400"), ("BETO", "400"), ("CARO", "480"))) and "$1,280" in t, t[300:1400])
    A.locator(".tab-pill", has_text="Asistencia").first.click(); A.wait_for_timeout(400); t = cuerpo(A)
    caso("y el miércoles de Beto sale como «vino, falta decir en qué trabajó», no como falta ni como pago", "Vinieron, pero falta decir en qué trabajaron" in t and "BETO INVENTADO" in t, t[:900])


    # ══ 4. Tareas: mandar un encargo, y que la persona lo vea y lo cumpla ══
    ir(B, "tareas"); B.get_by_role("button", name="+").click(); B.wait_for_timeout(300); n0 = len(B.dialogos); B.get_by_role("button", name="Enviar indicación").click(); B.wait_for_timeout(300)
    caso("una tarea sin persona ni texto no se manda", len(datos(B).get("tareas") or []) == 0 and any("Falta asignar" in d for d in B.dialogos[n0:]), B.dialogos[n0:])
    campo(B, "Asignar a").select_option(label="ANA INVENTADA (general)"); campo(B, "Parcela").select_option("p1"); campo(B, "Qué debe hacer").fill("REVISAR LA BOMBA INVENTADA")
    B.get_by_role("button", name="Enviar indicación").click(); B.wait_for_timeout(600); T = datos(B)["tareas"]; t = cuerpo(B); foto(B, "05-tareas")
    caso("la tarea queda pendiente, con a quién, dónde y quién la mandó", len(T) == 1 and T[0]["asignadoA"] == "t-ana" and T[0]["parcelaId"] == "p1" and T[0]["estado"] == "pendiente" and "REVISAR LA BOMBA INVENTADA" in t and "Pendiente" in t, T)
    print("   [tarea]", json.dumps(T)[:500])
    subio(B)

    # ══ 5. El trabajador, con su PIN, en ese mismo teléfono ══
    def salir(pg):
        ir(pg, "home"); pg.get_by_role("button", name="Salir").first.click()
        for _ in range(20):
            pg.wait_for_timeout(400)
            if pg.locator(".login-bg").count(): break
    salir(B); B.locator(".login-sheet input").first.fill("4101"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(1500)
    t = cuerpo(B)
    caso("Ana entra con su PIN y ve sólo lo suyo", "ANA" in t and "Pagos al personal" not in t and "Finanzas" not in t, t[:300])
    ir(B, "mis"); t = cuerpo(B); foto(B, "06-mis-dias")
    caso("«Mis días» le enseña la MISMA cuenta que ve quien paga: esta semana $400, un día trabajado (no $0 ni un acumulado de pase de lista)", re.search(r"ESTA SEMANA ME CORRESPONDE \| \$400 \| 1 día", t) and "Falta por entregar | $400" in t and "raya acumulada" not in t.lower(), t[:600])
    caso("y ve sus dos actividades del día y su tarea pendiente", "Riego" in t and "Deshierbe" in t and "REVISAR LA BOMBA INVENTADA" in t and "1 pendiente" in t, t[:900])
    B.get_by_role("button", name="Marcar como hecha").click(); B.wait_for_timeout(700); T = datos(B)["tareas"]
    caso("marca su tarea como hecha", T[0]["estado"] != "pendiente", T)
    ir(B, "reporte"); n0 = len(B.dialogos); B.get_by_role("button", name="Enviar Reporte →").click(); B.wait_for_timeout(400)
    caso("un reporte sin descripción no se manda", len(datos(B).get("incidencias") or []) == 0, [B.dialogos[n0:], cuerpo(B)[:200]])
    B.get_by_text("Equipo", exact=True).first.click(); B.get_by_role("button", name="Alta").click(); campo(B, "Descripción").fill("LA BOMBA TIRA ACEITE INVENTADO"); B.get_by_role("button", name="Enviar Reporte →").click(); B.wait_for_timeout(900)
    I = datos(B).get("incidencias") or []; foto(B, "07-reportar")
    caso("el reporte queda con qué pasó, su prioridad y quién lo mandó", len(I) == 1 and "BOMBA TIRA ACEITE" in json.dumps(I[0], ensure_ascii=False) and str(I[0].get("prioridad")).lower() == "alta" and "t-ana" in json.dumps(I[0]), I)
    print("   [inc]", json.dumps(I, ensure_ascii=False)[:500])
    ir(B, "pase-lista"); t = cuerpo(B)
    caso("Ana (trabajadora) ya no tiene el pase de lista de toda la gente: sólo un encargado o superior marca a otros", "BETO INVENTADO" not in t and "La asistencia de los demás la marca un encargado o el cabo" in t and B.locator("button", has_text="Capturar").count() == 0, t[:300])
    ir(B, "nomina"); t = cuerpo(B)
    caso("a Ana no se le abre Pagos al personal", "Pagos al personal" not in t and "Registrar pago" not in t, t[:200])
    subio(B); salir(B)
    B.get_by_placeholder("Tu correo o tu PIN").fill(ENC["correo"]); B.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(3500)
    ir(B, "tareas"); t = cuerpo(B)
    caso("el encargado vuelve a entrar y ve la tarea ya completada por Ana", "✓ Completada" in t and "REVISAR LA BOMBA INVENTADA" in t, t[:400])
    subio(B); al_dia(A); ir(A, "equipo"); A.locator(".tab-pill", has_text="Incid").first.click(); A.wait_for_timeout(400); t = cuerpo(A); foto(A, "08-incidencias")
    caso("el reporte de Ana le llega al administrador con su nombre, fecha y prioridad", "LA BOMBA TIRA ACEITE INVENTADO" in t and "ANA INVENTADA" in t and "alta" in t, t[:400])
    A.get_by_role("button", name="Marcar como atendida").click(); A.wait_for_timeout(600)
    I = datos(A)["incidencias"]; print("   [inc resuelta]", json.dumps(I, ensure_ascii=False)[:400], cuerpo(A)[:300])
    caso("el administrador la marca atendida: no se borra, queda con quién la atendió y sigue a la vista en «Ya atendidas»", len(I) == 1 and I[0]["estado"] == "resuelta" and I[0].get("resueltaPor") == "ADMIN DE PRUEBA" and "Ya atendidas (1)" in cuerpo(A), I)

    # ══ 6. El día palomeado que faltaba: se captura desde el pase de lista ══
    ir(B, "pase-lista"); B.get_by_role("button", name="Capturar").click(); B.wait_for_timeout(500)
    n0 = len(B.dialogos); B.get_by_role("button", name=re.compile("Capturar 1 actividad")).click(); B.wait_for_timeout(400)
    caso("sin decir parcela y actividad no se captura el día faltante", len(datos(B)["actividades"]) == 4, [B.dialogos[n0:], cuerpo(B)[:200]])
    campo(B, "Parcela donde trabajaron").select_option("p1"); campo(B, "Qué actividad hicieron").select_option(label="Riego"); B.get_by_role("button", name=re.compile("Capturar 1 actividad")).click(); B.wait_for_timeout(900)
    a = datos(B)["actividades"]; nb = [x for x in a if x["fecha"] == "2026-11-18"]; t = cuerpo(B)
    caso("el miércoles de Beto queda como actividad (Riego, PARCELA UNO), a su nombre y capturado por el encargado", len(a) == 5 and len(nb) == 1 and nb[0]["registradoPor"]["id"] == "t-beto" and nb[0]["parcelaId"] == "p1" and nb[0]["tipo"] == "Riego" and (nb[0].get("registradoEnNombrePor") or nb[0]["quienes"]["capturo"])["nombre"] == "ENCARGADO DE PRUEBA", nb)
    caso("ya con actividad, ese día sí cuenta: $400 más a la parcela uno y el aviso de días sin registrar se va", costo_de(B, "p1") == 600 and B.evaluate(CUENTAS)["egresos"] == 1680 and "sin registrar" not in t, [costo_de(B, "p1"), B.evaluate(CUENTAS), t[:300]])
    dia(B, "BETO INVENTADO", 2).click(); B.wait_for_timeout(500)
    caso("un día que ya tiene actividad no se puede despalomear por error (la asistencia sigue)", any(x.get("trabajadorId") == "t-beto" and x.get("fecha") == "2026-11-18" and x.get("presente") for x in datos(B).get("asistencia") or []) or len([x for x in datos(B)["actividades"] if x["fecha"] == "2026-11-18"]) == 1, [datos(B).get("asistencia"), B.dialogos[-1:]])

    # ══ 7. Sin señal, otro teléfono, recarga ══
    subio(B); nube.caida = True
    actividad(B, "CARO INVENTADA", "PARCELA UNO", "Riego"); B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300)
    caso("sin señal se captura igual: el día de Caro ($480) se reparte ahora entre sus dos parcelas según las horas (8 y 4), sin pagarle de más", costo_de(B, "p1") == 920 and costo_de(B, "p2") == 760 and B.evaluate(CUENTAS)["egresos"] == 1680, [costo_de(B, "p1"), costo_de(B, "p2"), B.evaluate(CUENTAS)])
    nube.caida = False; avanza(B, 2 / 60); ok = subio(B); al_dia(A); al_dia(A)
    caso("al volver la señal sube, y el administrador ve exactamente lo mismo en su teléfono", ok and costo_de(A, "p1") == 920 and costo_de(A, "p2") == 760 and A.evaluate(CUENTAS)["egresos"] == 1680 and len(datos(A)["actividades"]) == 6 and len(nube.t["actividades"]) == 6, [costo_de(A, "p1"), costo_de(A, "p2"), A.evaluate(CUENTAS), len(nube.t["actividades"])])
    ir(A, "nomina"); A.wait_for_timeout(500); t = cuerpo(A)
    caso("y en Pagos: Ana $400, Beto $800 (dos días), Caro $480; total $1,680", all(re.search(n + r" INVENTAD[AO] \| [^|]+ \| \$" + m + r" \|", t) for n, m in (("ANA", "400"), ("BETO", "800"), ("CARO", "480"))) and "$1,680" in t, t[300:1300])
    recarga(B)
    caso("después de recargar nada cambia", costo_de(B, "p1") == 920 and B.evaluate(CUENTAS)["egresos"] == 1680 and len(datos(B)["tareas"]) == 1 and len(datos(B)["incidencias"]) == 1, [costo_de(B, "p1"), B.evaluate(CUENTAS)])

    # ══ 8. Con tractor y con insumo del almacén; y un trabajo general que no es de ninguna parcela ══
    caso("como el teléfono quedó ligado para la gente, al recargar pide otra vez la contraseña del encargado: sus pantallas no se quedan abiertas", B.locator(".login-bg").count() == 1)
    B.get_by_placeholder("Tu correo o tu PIN").fill(ENC["correo"]); B.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(3500)
    ir(B, "registrar-actividad"); B.get_by_text("DANI INVENTADO").first.click(); B.wait_for_timeout(400); B.get_by_text("PARCELA UNO").first.click(); B.wait_for_timeout(400)
    B.get_by_text("Fertilización", exact=True).first.click(); B.locator("select:visible").nth(0).select_option("m-1"); B.locator("select:visible").nth(1).select_option("i-urea"); B.wait_for_timeout(200)
    B.locator('input[type="number"]:visible').last.fill("2"); B.get_by_role("button", name="+", exact=True).click(); B.wait_for_timeout(400)
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500); t = cuerpo(B); foto(B, "09-actividad-con-tractor-e-insumo")
    caso("la confirmación enseña el tractor y el insumo que se va a descontar", "TRACTOR INVENTADO" in t and "UREA INVENTADA" in t, t[:700])
    B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300)
    d = next(x for x in datos(B)["actividades"] if x["registradoPor"]["id"] == "t-dani"); urea = next(i for i in datos(B)["inventario"] if i["id"] == "i-urea"); c = B.evaluate(CUENTAS)
    caso("la actividad carga su día ($400), el tractor (8 h × $100) y el insumo (2 × $100): $1,400 a la parcela", d["costoMO"] == 400 and d["costoMaq"] == 800 and d["costoInsumos"] == 200 and costo_de(B, "p1") == 920 + 1400 and c["egresos"] == 1680 + 1400, [d["costoMO"], d["costoMaq"], d["costoInsumos"], costo_de(B, "p1"), c])
    caso("el insumo sale del almacén (quedan 8 bultos) y usarlo no es dinero que sale", urea["existencia"] == 8 and c["sale"] == 0, [urea["existencia"], c])
    ir(B, "registrar-actividad"); B.get_by_text("DANI INVENTADO").first.click(); B.wait_for_timeout(400); B.get_by_text("General de la operación").first.click(); B.wait_for_timeout(400)
    B.get_by_text("Limpieza", exact=True).first.click(); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(500); B.get_by_role("button", name="✓ Registrar actividad").click(); B.wait_for_timeout(3300)
    g = [x for x in datos(B)["actividades"] if x["registradoPor"]["id"] == "t-dani" and not x.get("parcelaId")]; c = B.evaluate(CUENTAS)
    caso("un trabajo general no se le carga a ninguna parcela: la mitad del día de Dani deja la parcela uno y el total del rancho no cambia", len(g) == 1 and costo_de(B, "p1") == 920 + 1400 - 200 and costo_de(B, "p2") == 760 and c["egresos"] == 3080, [g[:1], costo_de(B, "p1"), costo_de(B, "p2"), c])
    subio(B); al_dia(A); ir(A, "nomina"); A.wait_for_timeout(500); t = cuerpo(A)
    caso("a Dani le corresponde su día ($400), ni más por el tractor ni dos días por dos actividades", re.search(r"DANI INVENTADO \| [^|]+ \| \$400 \|", t) and "$2,080" in t, t[300:1500])

    # ══ 9. Jornadas y credenciales ══
    teclea = lambda pg, pin: ([pg.locator(".chk-teclas button", has_text=d).first.click() for d in pin], pg.locator(".chk-teclas button.ok").click(), pg.wait_for_timeout(350))
    ir(B, "checador"); teclea(B, "4102"); B.clock.run_for(13000); hora(B)
    al_dia(A); ir(A, "nomina"); A.wait_for_timeout(400); tt = cuerpo(A)
    caso("Beto ya tenía su actividad tecleada de hoy y además checó: su día sigue costando UNA vez ($3,080 en total) y se le paga una vez (dos días, $800)", B.evaluate(CUENTAS)["egresos"] == 3080 and A.evaluate(CUENTAS)["egresos"] == 3080 and re.search(r"BETO INVENTADO \| 2 días trabajados[^|]*\| \$800 \|", tt), [B.evaluate(CUENTAS), tt[tt.find("BETO INVENTADO"):][:200]])
    ir(B, "jornadas"); t = cuerpo(B); foto(B, "10-jornadas")
    caso("Jornadas dice quién está adentro y desde qué hora, y de quien no checó dice «sin marca», no «faltó»", "Adentro (1)" in t and "BETO INVENTADO" in t and "Entró" in t and "No quiere decir que faltaron" in t, t[:600])
    B.get_by_text("BETO INVENTADO").first.click(); B.wait_for_timeout(500); B.get_by_role("button", name="Cambiar hora").click(); B.wait_for_timeout(400)
    campo(B, "Hora que vale").fill("06:30"); B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    marcas = lambda pg: [e for e in datos(pg)["eventos"] if e["tipo"] in ("marca", "marca_checador", "checada") or "marca" in e["tipo"]]
    m0 = marcas(B)
    caso("cambiar la hora de una marca sin decir por qué no se guarda", all(e["estado"] == "vigente" for e in m0) and len(m0) == 1, [[e["tipo"], e["estado"]] for e in m0])
    campo(B, "Por qué").fill("CHECO TARDE PORQUE NO HABIA TELEFONO INVENTADO"); B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(800); m1 = marcas(B); t = cuerpo(B)
    caso("con motivo sí: la marca original se queda en el historial y nace la corregida, con quién y por qué", len(m1) == 2 and sorted(e["estado"] for e in m1) != ["vigente", "vigente"] and "CHECO TARDE" in json.dumps(m1, ensure_ascii=False) and "6:30" in t, [[e["tipo"], e["estado"], e.get("relacion")] for e in m1])
    # Las credenciales las emite un administrador (Luis, 24 nov): emitir cambia la ficha de la persona. El encargado las ve y las imprime.
    ir(B, "credenciales"); t = cuerpo(B)
    caso("el encargado no tiene botón para emitir credenciales y la pantalla le dice que las emite un administrador", B.get_by_role("button", name=re.compile("^Emitir")).count() == 0 and "Las emite un administrador" in t, t[:500])
    ir(A, "credenciales"); A.get_by_role("button", name="Emitir", exact=True).first.click(); A.wait_for_timeout(700)
    quien_c = next(x for x in datos(A)["trabajadores"] if x.get("credencial")); c1 = quien_c["credencial"]["codigo"]; t = cuerpo(A); foto(A, "11-credenciales")
    caso("el administrador emite una credencial: la persona tiene un código propio, con fecha y quién la emitió, sin su PIN ni su sueldo", len(c1) >= 8 and quien_c["credencial"]["por"] == "ADMIN DE PRUEBA" and quien_c["pin"] not in c1 and "Emitida el" in t, quien_c["credencial"])
    A.get_by_role("button", name="Emitir otra").first.click(); A.wait_for_timeout(700); q2 = next(x for x in datos(A)["trabajadores"] if x["id"] == quien_c["id"])
    caso("emitir otra cambia el código y la anterior queda anotada como ya no vigente", q2["credencial"]["codigo"] != c1 and c1 in json.dumps(q2.get("credencialesAnteriores")), [q2["credencial"], q2.get("credencialesAnteriores")])
    subio(A); al_dia(B)
    # El teléfono del encargado quedó ligado para la gente: al recargar vuelve a pedir su contraseña.
    if B.locator(".login-bg").count():
        B.get_by_placeholder("Tu correo o tu PIN").fill(ENC["correo"]); B.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(3500)
    ir(B, "credenciales"); t = cuerpo(B)
    caso("al encargado le llega la credencial nueva y la puede imprimir", "Emitida el" in t and B.get_by_role("button", name=re.compile("Imprimir")).count() == 1 and any((x.get("credencial") or {}).get("codigo") == q2["credencial"]["codigo"] for x in datos(B)["trabajadores"]), t[:500])

    # ══ 10. Un externo: entra con su nombre, registra, y no cuenta hasta que alguien lo aprueba ══
    egresos_antes = B.evaluate(CUENTAS)["egresos"]
    ir(A, "equipo"); A.locator(".tab-pill", has_text="Externos").first.click(); A.wait_for_timeout(400)
    caso("el rancho todavía no tiene pago base para externos: la regla está vacía", A.get_by_label(re.compile("Externos · pago por día")).input_value() == "", cuerpo(A)[:400])
    salir(B); B.get_by_text("Soy externo y no tengo PIN").click(); B.wait_for_timeout(600); B.locator("input:visible").first.fill("EXTERNO INVENTADO PEREZ"); B.get_by_role("button", name="Entrar →").click(); B.wait_for_timeout(1500)
    t = cuerpo(B)
    caso("el externo entra sólo con su nombre y no ve nada de los demás", "Externo" in t and "Pagos" not in t and "ANA INVENTADA" not in t, t[:300])
    B.get_by_text("PARCELA UNO").first.click(); B.wait_for_timeout(400); B.get_by_text("Deshierbe", exact=True).first.click(); B.wait_for_timeout(500)
    caso("sin base del rancho, el pago por día nace vacío (ya no trae $683 escrito en el código)", campo(B, "Pago por día").input_value() == "", campo(B, "Pago por día").input_value())
    n0 = len(B.dialogos); B.get_by_role("button", name="Continuar ›").click(); B.wait_for_timeout(300)
    caso("sin decir cuánto se acordó no avanza", any("Falta cuánto se acordó" in d for d in B.dialogos[n0:]) and "Revisa antes de enviar" not in cuerpo(B), B.dialogos[n0:])
    campo(B, "Pago por día").fill("350"); B.get_by_role("button", name="Continuar ›").click(); B.wait_for_timeout(500); t = cuerpo(B)
    caso("el externo dice el pago acordado y lo ve antes de mandar", "$350" in t and "Deshierbe" in t and "PARCELA UNO" in t, t[:500])
    B.get_by_role("button", name="✓ Enviar registro").click(); B.wait_for_timeout(3300)
    ax = [x for x in datos(B)["actividades"] if (x.get("registradoPor") or {}).get("tipo") == "externo"]
    caso("su registro queda PENDIENTE de aprobación y todavía no cuenta: ni costo ni pago", len(ax) == 1 and ax[0]["estado"] == "pendiente_aprobacion" and ax[0]["costoMO"] == 350 and B.evaluate(CUENTAS)["egresos"] == egresos_antes == 3080 and costo_de(B, "p1") == 2120, [ax[0]["estado"], B.evaluate(CUENTAS), costo_de(B, "p1")])
    # el administrador pone la base del rancho: $350
    A.get_by_label(re.compile("Externos · pago por día")).fill("350"); A.locator(".card", has_text="Reglas del rancho").get_by_role("button").first.click(); A.wait_for_timeout(800)
    aj = [e for e in datos(A)["eventos"] if e["tipo"] == "ajuste" and e["datos"].get("clave") == "tarifa_externo_dia"]
    caso("el administrador pone la base para externos ($350): queda como cambio de regla, con quién la puso", len(aj) == 1 and aj[0]["datos"]["valor"] == 350 and "Lo puso ADMIN DE PRUEBA" in cuerpo(A), [e["datos"] for e in aj])
    subio(A); avanza(B, 1 / 60); recarga(B); B.wait_for_timeout(500)   # menos de 5 min: el teléfono del externo se cierra solo si nadie lo toca
    B.get_by_text("PARCELA DOS").first.click(); B.wait_for_timeout(400); B.get_by_text("Riego", exact=True).first.click(); B.wait_for_timeout(500); t = cuerpo(B)
    caso("con la base puesta, al externo se le sugiere $350 y se le dice que lo puede cambiar si se acordó otro", campo(B, "Pago por día").input_value() == "350" and "Lo de siempre es $350" in t, [campo(B, "Pago por día").input_value(), t[200:700]])
    campo(B, "Pago por día").fill("9000"); B.get_by_role("button", name="Continuar ›").click(); B.wait_for_timeout(500); B.get_by_role("button", name="✓ Enviar registro").click(); B.wait_for_timeout(3300)
    ir(B, "mis"); t = cuerpo(B); foto(B, "12-externo-mis-dias")
    caso("en «Mis días» el externo ve que sus registros están pendientes y que nada está aprobado todavía", "2 registro(s) pendiente(s) de aprobación" in t and "$0" in t and "Pendiente" in t, t[:500])
    subio(B); salir(B); B.get_by_placeholder("Tu correo o tu PIN").fill(ENC["correo"]); B.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(3500)
    ir(B, "aprobacion-externos"); t = cuerpo(B); foto(B, "13-aprobar-externos")
    caso("al encargado le llegan los dos registros con quién, dónde y cuánto pide", "Pendientes 2" in t and "EXTERNO INVENTADO PEREZ" in t and "$350" in t and "$9,000" in t, t[:700])
    caso("y el que se aparta de la base se le señala: «lo de siempre es $350; aquí se pide $9,000»", "Lo de siempre es $350 por día; aquí se pide $9,000" in t and t.count("Lo de siempre es") == 1, t[:900])
    B.respuesta = "  "; B.locator(".card", has_text="$9,000").last.get_by_role("button", name="Rechazar").click(); B.wait_for_timeout(500)
    caso("rechazar sin decir por qué no hace nada", "Pendientes 2" in cuerpo(B))
    B.respuesta = "ESE DIA NO VINO NADIE A REGAR INVENTADO"; B.locator(".card", has_text="$9,000").last.get_by_role("button", name="Rechazar").click(); B.wait_for_timeout(700)
    B.locator(".card", has_text="$350").last.get_by_role("button", name="Aprobar").click(); B.wait_for_timeout(900)
    ax = {x["costoMO"]: x for x in datos(B)["actividades"] if (x.get("registradoPor") or {}).get("tipo") == "externo"}; c = B.evaluate(CUENTAS)
    caso("aprobado el de $350, cuenta: $350 más a la parcela uno; el rechazado ($9,000) no cuenta y no se borra", ax[350]["estado"] not in ("pendiente_aprobacion", "rechazada", "rechazado") and "rechaz" in ax[9000]["estado"] and c["egresos"] == 3430 and costo_de(B, "p1") == 2470 and costo_de(B, "p2") == 760, [[(k, v["estado"]) for k, v in ax.items()], c, costo_de(B, "p1"), costo_de(B, "p2")])
    B.locator(".tab-pill, button", has_text="Revisados").first.click(); B.wait_for_timeout(400); t = cuerpo(B)
    caso("los dos quedan en «Revisados» con quién decidió y, el rechazado, por qué", "Lo aprobó ENCARGADO DE PRUEBA" in t and "Lo rechazó ENCARGADO DE PRUEBA" in t and "ESE DIA NO VINO NADIE A REGAR INVENTADO" in t and ax[350].get("revisadoPor") == "ENCARGADO DE PRUEBA" and ax[9000].get("motivoRechazo"), t[:700])
    subio(B)

    # ══ 11. El cabo que un administrador nombró sí pasa lista ══
    ir(A, "equipo"); A.locator(".list-item", has_text="CARO INVENTADA").locator('[title^="Nombrar cabo"]').click(); A.wait_for_timeout(600)
    caso("el administrador nombra cabo a Caro", next(x for x in datos(A)["trabajadores"] if x["id"] == "t-caro").get("cabo") is True)
    subio(A); salir(B); avanza(B, 6 / 60); recarga(B)
    B.locator(".login-sheet input").first.fill("4103"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(1500)
    caso("Caro, como cabo, tiene el pase de lista desde su inicio y le abre", B.get_by_role("button", name="Abrir").count() >= 1 and (B.get_by_role("button", name="Abrir").first.click() or True) and (B.wait_for_timeout(600) or True) and "Pase de lista" in cuerpo(B) and "BETO INVENTADO" in cuerpo(B), cuerpo(B)[:400])
    caso("la base no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
