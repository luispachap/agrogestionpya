"""AUDITORÍA FUNCIONAL · LA TABLA POR CORTES COMO SUCESORA DE «REGISTRO DE VARIOS» Y DEL REPARTO (Luis, 23 nov: «pásale
sus funciones, que no se pierda nada»). Un día de antes sin checador (agregar a la persona, pintarla, ponerle entrada y
salida por lo pintado con motivo, su avance con lo que quedó pendiente), y hoy: lo pendiente vuelve como pincel, quién lo ha
hecho antes (sólo informa), pintar como el plan, el operador en un vehículo para una parcela, destajo del personal y de un
externo, la comida como descanso, y el otro teléfono ve lo mismo. Cuentas, 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_cortes2_navegador.py          (URL=… para otro puerto; FOTOS=/ruta para capturas)"""
import datetime, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = os.environ.get("URL", "http://localhost:5174/"); HOY = "2026-11-19"; AYER = "2026-11-18"; FOTOS = os.environ.get("FOTOS")
MOTIVO = "ese rancho no tiene checador (prueba)"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
t["parcelas"] = {p: {"id": p, "nombre": n, "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V} for p, n in (("p1", "PARCELA UNO"), ("p2", "PARCELA DOS"))}
H = [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}]
t["trabajadores"] = {i: {"id": i, "nombre": n, "pin": pin, "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": H, **E}, "actualizado": V} for i, n, pin in (("t-ana", "ANA INVENTADA", "4101"), ("t-beto", "BETO INVENTADO", "4102"), ("t-caro", "CARO INVENTADA", "4103"), ("t-dani", "DANI INVENTADA", "4104"))}
t["maquinaria"] = {"m1": {"id": "m1", "nombre": "TRACTOR INVENTADO", "costo_hora": 0, "datos": {"tipo": "tractor", **E}, "actualizado": V}}
t["externos"] = {"x1": {"id": "x1", "nombre": "DON EXTERNO INVENTADO", "estado": "activo", "datos": E, "actualizado": V}}
tarea = lambda i, quien, parcela, que: {"id": i, "fecha": HOY, "tipo": "tarea", "estado": "mandada", "parcela_id": parcela, "asignado_a": quien, "datos": {"resumen": f"{que} en la parcela", "que": que, "deQuien": "ENCARGADO DE PRUEBA", **E}, "actualizado": V}
t["indicaciones"] = {"i1": tarea("i1", "t-ana", "p1", "deshierbe"), "i2": tarea("i2", "t-beto", "p2", "riego")}
# Lo que Ana ya había hecho antes (tecleado): para «quién lo ha hecho antes».
t["actividades"] = {i: {"id": i, "parcela_id": "p1", "fecha": f, "tipo": "Deshierbe", "datos": {"registradoPor": {"tipo": "planta", "id": "t-ana"}, "horas_trab": 8, "insumos": [], "costoMO": 400, "costoMaq": 0, "costoInsumos": 0, "costoTotal": 400, **E}, "actualizado": V} for i, f in (("a-viejo-1", "2026-11-10"), ("a-viejo-2", "2026-11-12"))}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
evs = lambda pg, tipo: [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
costo_de = lambda pg, pid, f=None: round(sum(a.get("costoTotal") or 0 for a in datos(pg).get("actividadesContables", []) if a.get("parcelaId") == pid and (f is None or a.get("fecha") == f)), 2)
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def dialogo(d): d.accept(MOTIVO) if d.type == "prompt" else d.accept()
    def aparato(cuenta, hh="07:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", dialogo)
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); hora(pg); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    teclea = lambda pg, pin: ([pg.locator(".chk-teclas button", has_text=d).first.click() for d in pin], pg.locator(".chk-teclas button.ok").click(), pg.wait_for_timeout(400), pg.clock.run_for(13000), hora(pg))
    def tabla(pg): ir(pg, "eldia"); pg.get_by_role("button", name="Por cortes").click(); pg.wait_for_timeout(500)
    def dia(pg, f): pg.get_by_label("Día de la tabla").fill(f); pg.wait_for_timeout(500)
    celda = lambda pg, nom, corte: pg.get_by_label(re.compile(f"{nom}, {corte}:")).first.get_attribute("aria-label")
    def pincel(pg, donde, actividad, para=None):
        pg.get_by_label("Parcela del pincel nuevo").select_option(label=donde); pg.wait_for_timeout(150)
        pg.get_by_label("Actividad del pincel nuevo").select_option(actividad)
        if para: pg.get_by_label("Para qué parcela es").select_option(label=para)
        pg.get_by_role("button", name="+ Pincel nuevo").click(); pg.wait_for_timeout(300)

    B = aparato(ENC, "07:05")
    ir(B, "checador"); teclea(B, "4101"); teclea(B, "4102"); teclea(B, "4103")
    # ══ AYER, sin checador: lo que hacía «Registro de varios» ══
    tabla(B); dia(B, AYER)
    caso("un día de antes sin nadie checado la tabla dice que se puede agregar a la gente a mano", "agrégalo arriba" in cuerpo(B) and B.get_by_label("Agregar a alguien a este día").count() == 1, cuerpo(B)[:600])
    B.get_by_label("Agregar a alguien a este día").select_option(label="ANA INVENTADA"); B.wait_for_timeout(400)
    pincel(B, "PARCELA UNO", "Deshierbe")
    B.get_by_label("Pintar el día de ANA INVENTADA").click(); B.wait_for_timeout(600)
    caso("se agrega a Ana a ese día y se pinta su día completo (los tres cortes)", all("Deshierbe en PARCELA UNO" in celda(B, "ANA INVENTADA", c) for c in ("7–10", "10–13", "14–17")), [celda(B, "ANA INVENTADA", c) for c in ("7–10", "10–13", "14–17")])
    caso("pintada y sin checar no cuenta horas todavía (no se inventa su día) y se dice", costo_de(B, "p1", AYER) == 0 and "está pintado y no checó" in cuerpo(B), [costo_de(B, "p1", AYER), cuerpo(B)[-500:]])
    B.get_by_role("button", name="Ponerle entrada y salida por lo pintado").click(); B.wait_for_timeout(700)
    marcas = [e for e in evs(B, "marca") if e["fecha"] == AYER]
    caso("«ponerle entrada y salida por lo pintado» deja dos marcas a mano (7 y 17), con el motivo y quién", len(marcas) == 2 and all(m["datos"]["via"] == "correccion" and m["datos"]["motivo"] == MOTIVO and m["quien"]["nombre"] == "ENCARGADO DE PRUEBA" for m in marcas)
         and sorted(m["datos"]["sentido"] for m in marcas) == ["entrada", "salida"], [(m["cuando"], m["datos"]) for m in marcas])
    caso("con eso su día cuenta: 9 de sus 10 horas a la uno ($360); la comida queda aparte", abs(costo_de(B, "p1", AYER) - 360) < 1, costo_de(B, "p1", AYER))
    B.get_by_role("button", name=re.compile("La comida")).click(); B.wait_for_timeout(500)
    acl = [e for e in evs(B, "aclaracion") if e["fecha"] == AYER]
    caso("«la comida fue descanso» la aclara como descanso autorizado (13 a 14), lo dice una persona", len(acl) == 1 and acl[0]["datos"]["causa"] == "descanso_autorizado" and acl[0]["datos"]["trabajadorId"] == "t-ana", [e["datos"] for e in acl])
    B.get_by_role("button", name="Anotar avance").click(); B.wait_for_timeout(300)
    B.get_by_label("Cuánto se avanzó").fill("12"); B.get_by_label("En qué").select_option("surco"); B.get_by_label("Quedó pendiente (cuánto)").fill("8")
    B.get_by_role("button", name="Guardar avance").click(); B.wait_for_timeout(500)
    av = evs(B, "avance_trabajo")
    caso("el avance (lo que hacían las hectáreas de «Registro de varios») queda con su parcela, actividad, personas y lo pendiente; no es pago", len(av) == 1 and av[0]["datos"]["parcelaId"] == "p1" and av[0]["datos"]["cantidad"] == 12 and av[0]["datos"]["pendiente"]["cantidad"] == 8 and av[0]["datos"]["personas"] == 1 and av[0]["fecha"] == AYER, [e["datos"] for e in av])
    # ══ HOY ══
    dia(B, HOY); t0 = cuerpo(B)
    caso("hoy aparece lo que quedó pendiente ayer, en qué se basa, y se vuelve pincel con un toque", "Lo que quedó pendiente, como pincel" in t0 and "quedó pendiente 8 surcos" in t0, t0[:900])
    B.get_by_label("Hacer pincel: Deshierbe en PARCELA UNO").click(); B.wait_for_timeout(300)
    exp = B.get_by_label("Quién lo ha hecho antes").inner_text()
    caso("con el pincel escogido dice quién lo ha hecho antes (Ana: 3 días, lo tecleado y lo de ayer) y que sólo informa", "ANA INVENTADA 3 días" in exp and "Sólo informa" in exp and "BETO" not in exp, exp)
    caso("cada renglón enseña lo que le toca según el plan", "Plan: Deshierbe en PARCELA UNO" in (B.get_by_label("Plan de ANA INVENTADA").inner_text()) and "Riego en PARCELA DOS" in B.get_by_label("Plan de BETO INVENTADO").inner_text())
    B.get_by_role("button", name="Pintar como el plan").click(); B.wait_for_timeout(600)
    caso("PINTAR COMO EL PLAN: el corte que ya empezó (7–10) queda como dice el plan, y el de las 10 todavía no", "Deshierbe en PARCELA UNO" in celda(B, "ANA INVENTADA", "7–10") and "Riego en PARCELA DOS" in celda(B, "BETO INVENTADO", "7–10") and "sin pintar" in celda(B, "ANA INVENTADA", "10–13"),
         [celda(B, "ANA INVENTADA", "7–10"), celda(B, "BETO INVENTADO", "7–10"), celda(B, "ANA INVENTADA", "10–13")])
    # Dani no checó (no trae credencial): se agrega, se pinta su corte de 7 y se le pone la entrada; la salida, cuando acabe
    B.get_by_label("Agregar a alguien a este día").select_option(label="DANI INVENTADA"); B.wait_for_timeout(300)
    B.locator("button[aria-label='Pincel Riego en PARCELA DOS']").click(); B.get_by_label(re.compile("DANI INVENTADA, 7–10")).click(); B.wait_for_timeout(400)
    B.get_by_role("button", name="Ponerle entrada y salida por lo pintado").click(); B.wait_for_timeout(500)
    md = [e for e in evs(B, "marca") if e["datos"]["trabajadorId"] == "t-dani"]
    caso("a media mañana sólo se le pone la ENTRADA (su corte acaba a las 10) y se dice cuándo poner la salida", len(md) == 1 and md[0]["datos"]["sentido"] == "entrada" and "La salida se pone cuando acabe su último corte" in cuerpo(B), [(m["datos"]["sentido"], m["cuando"]) for m in md])
    # Destajo del personal y de un externo con el pincel de Deshierbe
    B.locator("button[aria-label='Pincel Deshierbe en PARCELA UNO']").click(); B.wait_for_timeout(200)
    B.get_by_role("button", name="Anotar destajo").click(); B.wait_for_timeout(300)
    B.get_by_label("Se paga por").fill("surco"); B.get_by_label("A cómo cada una ($)").fill("15"); B.locator("#tc-t-ana").fill("10")
    B.get_by_role("checkbox", name="DON EXTERNO INVENTADO").check(); B.get_by_label("A cómo, DON EXTERNO INVENTADO").fill("20"); B.get_by_label("Unidades, DON EXTERNO INVENTADO").fill("5")
    B.get_by_role("button", name="Guardar destajo").click(); B.wait_for_timeout(600)
    dj = evs(B, "destajo"); ext = [a for a in datos(B)["actividades"] if (a.get("registradoPor") or {}).get("tipo") == "externo"]
    caso("DESTAJO: a Ana lo suyo (10 surcos a $15) y al externo su renglón de siempre ($100 en la uno, destajo)", len(dj) == 1 and dj[0]["datos"]["produccion"] == [{"trabajadorId": "t-ana", "cantidad": 10}] and dj[0]["datos"]["tarifa"] == 15
         and len(ext) == 1 and ext[0]["costoTotal"] == 100 and ext[0]["parcelaId"] == "p1" and ext[0]["modalidadPago"] == "destajo" and ext[0]["tipo"] == "Deshierbe", [[e["datos"] for e in dj], ext])
    # Caro se queda esperando media hora y la asignan en Equipos de trabajo (la otra pantalla), a las 7:35
    avanza(B, 0.5); ir(B, "reparto"); B.locator(".rep-ficha", has_text="CARO").click()
    B.get_by_label("Parcela o vehículo").select_option("p2"); B.get_by_label("Qué van a hacer").select_option("Riego")
    B.get_by_role("button", name="Asignar desde ahorita").click(); B.wait_for_timeout(400); tabla(B)
    caso("lo asignado en Equipos de trabajo se ve en la tabla (punteado) y no sale «checó y no está pintado»", "Riego en PARCELA DOS (asignado en Equipos de trabajo" in celda(B, "CARO INVENTADA", "7–10") and "CARO INVENTADA: checó y no está pintado" not in cuerpo(B), [celda(B, "CARO INVENTADA", "7–10"), cuerpo(B)[-400:]])
    # El operador: un pincel de vehículo para una parcela
    pincel(B, "TRACTOR INVENTADO", "Preparación de suelo", para="PARCELA DOS")
    caso("el pincel de vehículo dice para qué parcela es", B.locator("button[aria-label='Pincel Preparación de suelo en TRACTOR INVENTADO → PARCELA DOS']").count() == 1)
    # La tarde: salen a las 17:00 y se termina de pintar
    avanza(B, 9.5); ir(B, "checador"); teclea(B, "4101"); teclea(B, "4102"); teclea(B, "4103"); tabla(B)
    pincel(B, "TRACTOR INVENTADO", "Preparación de suelo", para="PARCELA DOS")   # un pincel que no se usó no se guarda al salir
    B.get_by_label(re.compile("BETO INVENTADO, 10–13")).click(); B.wait_for_timeout(400)
    asig = [e for e in evs(B, "asignacion") if e["datos"].get("vehiculoId")]
    caso("BETO en el tractor de 10 a 13: el rato va al VEHÍCULO (no a una parcela) y dice que fue para la dos", len(asig) == 1 and asig[0]["datos"]["parcelaId"] is None and asig[0]["datos"]["beneficiaId"] == "p2" and asig[0]["datos"]["vehiculo"] == "TRACTOR INVENTADO", [e["datos"] for e in asig])
    B.get_by_role("button", name="Ponerle su salida por lo pintado").click(); B.wait_for_timeout(500)
    md = [e for e in evs(B, "marca") if e["datos"]["trabajadorId"] == "t-dani"]
    caso("en la tarde, «ponerle su salida por lo pintado» le pone la salida a las 10 (lo que acabó su corte)", sorted(m["datos"]["sentido"] for m in md) == ["entrada", "salida"] and [m for m in md if m["datos"]["sentido"] == "salida"][0]["cuando"].startswith("2026-11-19T16:00"), [(m["datos"]["sentido"], m["cuando"]) for m in md])
    B.get_by_role("button", name="Repetir en 10–13 lo de 7–10").click(); B.wait_for_timeout(400)
    B.get_by_role("button", name="Repetir en 14–17 lo de 10–13").click(); B.wait_for_timeout(400)
    caso("repetir no le pinta nada a quien ya se fue (Dani salió a las 10)", "sin pintar" in celda(B, "DANI INVENTADA", "10–13") and "sin pintar" in celda(B, "DANI INVENTADA", "14–17"), [celda(B, "DANI INVENTADA", "10–13"), celda(B, "DANI INVENTADA", "14–17")])
    caso("repetir respeta lo ya pintado: Ana sigue en deshierbe, Beto en el tractor de 10 a 13 y en el tractor también a la tarde", "Deshierbe en PARCELA UNO" in celda(B, "ANA INVENTADA", "14–17") and "TRACTOR INVENTADO" in celda(B, "BETO INVENTADO", "10–13") and "TRACTOR INVENTADO" in celda(B, "BETO INVENTADO", "14–17"),
         [celda(B, "ANA INVENTADA", "14–17"), celda(B, "BETO INVENTADO", "10–13"), celda(B, "BETO INVENTADO", "14–17")])
    B.get_by_role("button", name=re.compile("La comida")).click(); B.wait_for_timeout(500)
    acl = [e for e in evs(B, "aclaracion") if e["fecha"] == HOY]
    caso("la comida de hoy se aclara para los dos pintados antes y después (Caro, de Equipos de trabajo, no: no se le supone)", sorted(e["datos"]["trabajadorId"] for e in acl) == ["t-ana", "t-beto"], [e["datos"] for e in acl])
    caso("lo de Caro sigue hasta su salida: la tarde también dice Equipos de trabajo", "Equipos de trabajo" in celda(B, "CARO INVENTADA", "14–17"), celda(B, "CARO INVENTADA", "14–17"))
    caso("y una segunda vez no la duplica", (B.get_by_role("button", name=re.compile("La comida")).click(), B.wait_for_timeout(400), len([e for e in evs(B, "aclaracion") if e["fecha"] == HOY]) == 2)[2], cuerpo(B)[-300:])
    hoy_p1 = costo_de(B, "p1", HOY)
    # Ana entró a las 7:05 (no a las 7): de sus 10 h en el rancho, 8 h 55 min fueron en la uno ≈ $357; más su destajo ($150, lo
    # suyo) y el del externo ($100). El tractor no se suma a la parcela: va al vehículo.
    caso("el costo de hoy en la uno: el rato de Ana (≈$357, entró 7:05), su destajo ($150) y el del externo ($100); el tractor no", 350 < hoy_p1 - 250 < 360, hoy_p1)
    foto(B, "01-tabla-completa")
    subio(B)
    # ══ El otro teléfono ══
    A = aparato(ADM, "18:00"); tabla(A)
    caso("el administrador ve la misma tabla: el plan, el tractor y el deshierbe", "TRACTOR INVENTADO" in celda(A, "BETO INVENTADO", "10–13") and "Deshierbe en PARCELA UNO" in celda(A, "ANA INVENTADA", "14–17") and A.get_by_label("Plan de ANA INVENTADA").count() == 1)
    caso("y los mismos eventos: avance, destajo, aclaraciones y marcas a mano", len(evs(A, "avance_trabajo")) == 1 and len(evs(A, "destajo")) == 1 and len(evs(A, "aclaracion")) == 3 and len([e for e in evs(A, "marca") if e["datos"].get("via") == "correccion"]) == 4,
         [len(evs(A, x)) for x in ("avance_trabajo", "destajo", "aclaracion")])
    ir(A, "mano-obra"); A.wait_for_timeout(600)
    ind = A.get_by_label("Tiempo esperando tarea"); ti = plano(ind.inner_text()) if ind.count() else ""
    if FOTOS and ind.count(): ind.scroll_into_view_if_needed(); ind.screenshot(path=f"{FOTOS}/02-espera.png")
    # Caro entró 7:05 y la asignaron 7:35: 30 min esperando su primera tarea, de 10 h en el rancho ($400): ≈ $20.
    caso("TIEMPO ESPERANDO TAREA: Caro, 30 min al llegar (≈$20); la comida aclarada y lo de después de la última tarea no cuentan", re.search(r"Al llegar, antes de su primera tarea \| 1 vez \| 0 h 30 min", ti) is not None and re.search(r"podría ahorrar \| 0 h 30 min \| \$(19\.9\d|20)", ti) is not None and "2 h 00 min con otra causa" in ti and "CARO INVENTADA" in ti and "No cambia pagos ni costos" in ti, ti)
    ir(A, "nomina"); A.wait_for_timeout(500); tn = cuerpo(A)
    caso("en Pagos le corresponde a Ana su día de ayer (con sus marcas a mano), el de hoy y su destajo: $950", re.search(r"ANA INVENTADA \| [^|]+ \| \$950 \|", tn) is not None, tn[300:1300])
    # ══ Sin señal: se pinta igual, sube al volver y el otro teléfono lo ve ══
    B.context.set_offline(True); B.get_by_role("button", name="Borrar", exact=True).click(); B.wait_for_timeout(200)
    B.get_by_label(re.compile("ANA INVENTADA, 14–17")).click(); B.wait_for_timeout(500)
    caso("SIN SEÑAL se pinta igual (se borra la tarde de Ana) y queda guardado en el teléfono", "sin pintar" in celda(B, "ANA INVENTADA", "14–17") and B.evaluate(COLA) > 0, [celda(B, "ANA INVENTADA", "14–17"), B.evaluate(COLA)])
    B.context.set_offline(False)
    ok = subio(B); A.reload(); A.wait_for_timeout(3500); tabla(A)
    caso("al volver la señal sube sola y el administrador lo ve", ok and "sin pintar" in celda(A, "ANA INVENTADA", "14–17"), celda(A, "ANA INVENTADA", "14–17"))
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
