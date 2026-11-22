"""AUDITORÍA FUNCIONAL · ASISTENCIA: SALIDAS ANTES DE TIEMPO Y AUSENCIAS, con cuentas, como una persona, 390 px.
Una trabajadora sale a media jornada (no se descuenta nada solo; una persona decide, con motivo) y otro no viene (es una
pregunta, no una falta; un permiso autorizado se paga). En cada paso: lo que corresponde pagar, el costo de la parcela y
lo que sella la base. Con recarga, otro aparato y dos teléfonos decidiendo lo mismo sin señal. Datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_ausencias_navegador.py"""
import datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"      # jueves; la semana es del lunes 16 al domingo 22
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC])
E = {"_espacio": "localhost"}
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": "2026-11-01T00:00:00Z"}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": "2026-11-01T00:00:00Z"}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
CUENTAS = """() => { const c = window.__agroCuentas(); const f = c.flujo, r = c.resultado; const d = {};
  for (const m of f.meses || []) for (const k in m.detalle) d[k] = Math.round(((d[k] || 0) + m.detalle[k]) * 100) / 100;
  return JSON.parse(JSON.stringify({ sale: f.egresos, entra: f.ingresos, detalle: d, egresos: r.egresos, utilidad: r.utilidad })); }"""
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).first
modal = lambda pg: pg.locator(".modal-sheet")
ci = lambda pg: pg.locator(".card", has_text=re.compile("Semana abierta|Cálculo cerrado|Semana reabierta")).first

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="08:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept())); pg.respuesta = "Se capturó mal"
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    def recarga(pg): hora(pg); pg.reload(); pg.wait_for_timeout(3500)
    def teclea(pg, pin):
        for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
        pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(350)


    # ══ 1. Ana trabaja medio día y se va; Beto no viene ══
    A = aparato(ADM, "06:30")
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("400"); campo(A, "PIN de acceso").fill(pin); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    avanza(A, 0.5); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    ir(A, "reparto"); A.locator(".rep-ficha", has_text="ANA INVENTADA").click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 4); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    ir(A, "nomina"); A.wait_for_timeout(500); t = plano(tarjeta(A, "ANA INVENTADA").inner_text()); c0 = A.evaluate(CUENTAS)
    caso("salió a las 4 horas y su día sigue completo: nada se descuenta solo ($400, y $400 de costo en la parcela)", "$400" in t and c0["egresos"] == 400, [t[:200], c0["egresos"]])
    tab(A, "Asistencia"); por = A.locator(".card", has_text="Salieron antes: por revisar")
    caso("el caso queda por revisar, diciendo que mientras tanto se paga completo", por.count() == 1 and "ANA INVENTADA" in por.inner_text() and "No hay descuento automático" in por.inner_text(), plano(A.locator("body").inner_text())[:400])
    subio(A)
    C = aparato(ADM, "11:20"); hora(C)

    # ══ 2. Los dos teléfonos deciden ESE MISMO día sin señal, y deciden distinto ══
    def decide(pg, pago, motivo):
        ir(pg, "nomina"); tab(pg, "Asistencia"); pg.locator(".card", has_text="Salieron antes: por revisar").get_by_role("button", name="Decidir").click(); pg.wait_for_timeout(300)
        pg.get_by_label("Qué pasó").select_option("abandono"); pg.get_by_label("Cómo se paga").select_option(pago); pg.get_by_label("Por qué se decide así").fill(motivo)
        modal(pg).get_by_role("button", name="Guardar decisión").click(); pg.wait_for_timeout(700)
    ir(A, "nomina"); tab(A, "Asistencia"); A.locator(".card", has_text="Salieron antes: por revisar").get_by_role("button", name="Decidir").click(); A.wait_for_timeout(300)
    modal(A).get_by_role("button", name="Guardar decisión").click(); A.wait_for_timeout(300)
    caso("la decisión pide decir qué pasó y por qué", len(de(A, "decision_jornada")) == 0 and modal(A).get_by_text("Falta decir qué pasó").count() == 1)
    modal(A).locator(".btn-ghost, button", has_text="Cancelar").first.click() if modal(A).locator("button", has_text="Cancelar").count() else A.keyboard.press("Escape"); A.wait_for_timeout(300)
    if modal(A).count(): A.reload(); A.wait_for_timeout(3000)
    nube.caida = True
    decide(A, "medio", "SE FUE SIN AVISAR INVENTADO"); avanza(C, 0.2); decide(C, "completo", "TENIA PERMISO INVENTADO")
    caso("sin señal, cada teléfono ve su decisión por validar: todavía no cuenta (sigue en $400)", all(pg.evaluate(CUENTAS)["egresos"] == 400 for pg in (A, C)), [A.evaluate(CUENTAS)["egresos"], C.evaluate(CUENTAS)["egresos"]])
    nube.caida = False
    for pg in (A, C): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, C): avanza(pg, 6 / 60); recarga(pg)
    for pg in (A, C): avanza(pg, 3 / 60); recarga(pg)
    dj = de(A, "decision_jornada"); cA, cC = A.evaluate(CUENTAS), C.evaluate(CUENTAS)
    caso("las dos decisiones existen, selladas por la base, cada una con quién y por qué", len(dj) == 2 and all(e.get("_validacion") == "autorizado" for e in dj) and len({e["id"] for e in dj}) == 2, [[e["datos"].get("pago"), e["datos"].get("motivo"), e.get("_validacion")] for e in dj])
    caso("los dos teléfonos aplican LA MISMA (la última que se tomó) y dan el mismo costo", cA["egresos"] == cC["egresos"] and cA["egresos"] in (200, 400), [cA["egresos"], cC["egresos"]])
    ir(A, "nomina"); A.wait_for_timeout(400); tA = plano(tarjeta(A, "ANA INVENTADA").inner_text()); ir(C, "nomina"); C.wait_for_timeout(400); tC = plano(tarjeta(C, "ANA INVENTADA").inner_text())
    caso("y lo que le corresponde a Ana es lo mismo en los dos, igual que el costo de la parcela", (("$400" in tA) == ("$400" in tC)) and (f"${cA['egresos']:,}" in tA), [tA[:160], tC[:160]])
    tab(A, "Asistencia"); t = plano(A.locator("body").inner_text())
    enc = A.locator(".card", has_text="Dos decisiones distintas para el mismo día"); te = plano(enc.inner_text()) if enc.count() else ""
    caso("las dos decisiones quedan a la vista con quién y por qué, y se dice cuál se está aplicando", "SE FUE SIN AVISAR INVENTADO" in te and "TENIA PERMISO INVENTADO" in te and "es la que se está aplicando" in te and "ADMIN DE PRUEBA" in te, te[:700])
    caso("y de cada una se dice cuándo se tomó", te.count("2026-11-19,") >= 2, te[:400])
    caso("con las dos vigentes nunca hay dos pagos ni dos cargos: un solo día para Ana y un solo importe en la parcela (jamás $600)", cA["egresos"] != 600 and "$600" not in tA and len([x for x in A.evaluate("() => window.__agroDatos.actividadesContables || []") if x.get("trabajadorId") and x.get("fecha") == HOY]) <= 1, [cA["egresos"], tA[:120]])
    A.respuesta = "  "; enc.get_by_role("button", name="Cancelar la decisión de ADMIN DE PRUEBA").last.click(); A.wait_for_timeout(800)
    caso("cancelar sin decir el motivo no cancela nada", all(e["estado"] == "vigente" for e in de(A, "decision_jornada")) and any("Por qué se cancela" in d for d in A.dialogos), A.dialogos[-2:])
    A.respuesta = "Se capturó mal"
    enc.get_by_role("button", name="Cancelar la decisión de ADMIN DE PRUEBA").last.click(); A.wait_for_timeout(1500)
    cX = A.evaluate(CUENTAS); dj = de(A, "decision_jornada")
    caso("cancelada (con motivo) la que no valía, se aplica la otra: medio día, $200 a Ana y $200 a la parcela, y el aviso se va", cX["egresos"] == 200 and sorted(e["estado"] for e in dj) == ["cancelado", "vigente"] and A.locator(".card", has_text="Dos decisiones distintas para el mismo día").count() == 0, [cX["egresos"], [[e["estado"], e["datos"]["pago"]] for e in dj]])
    cA = cX; subio(A)
    h = A.locator(".card", has_text="Decisiones sobre salidas antes de tiempo"); th = plano(h.inner_text()) if h.count() else ""
    can = [e for e in dj if e["estado"] == "cancelado"]
    caso("el historial conserva las dos: la vigente («es la que se está aplicando») y la cancelada, con quién la canceló, cuándo y por qué", "Es la que se está aplicando" in th and "Cancelada por ADMIN DE PRUEBA" in th and "Se capturó mal" in th and "TENIA PERMISO INVENTADO" in th and "SE FUE SIN AVISAR INVENTADO" in th, th[:700])
    caso("la decisión cancelada sigue guardada íntegra (lo que decía no se tocó) con su sello de cancelación", len(can) == 1 and can[0]["datos"]["motivo"] == "TENIA PERMISO INVENTADO" and can[0]["cancelado"]["motivo"] == "Se capturó mal" and can[0]["cancelado"]["por"]["nombre"] == "ADMIN DE PRUEBA", can[0].get("cancelado") if can else None)

    # ══ 3. Beto no vino: es una pregunta, no una falta ══
    sin = A.locator(".card", has_text="No vinieron y nadie ha dicho por qué")
    caso("quien no vino aparece como pregunta y sin ninguna falta registrada", sin.count() == 1 and "BETO INVENTADO" in sin.inner_text() and len(de(A, "ausencia")) == 0, plano(sin.inner_text())[:200] if sin.count() else "")
    ir(A, "nomina"); A.wait_for_timeout(300); t = plano(tarjeta(A, "BETO INVENTADO").inner_text())
    caso("mientras nadie diga qué pasó, a Beto no le corresponde nada ni se le marca falta", "$400" not in t, t[:200])
    tab(A, "Asistencia"); sin = A.locator(".card", has_text="No vinieron y nadie ha dicho por qué")
    sin.locator(".mo-act", has_text="BETO INVENTADO").filter(has_text=HOY).get_by_role("button", name="Decir qué pasó").click(); A.wait_for_timeout(300)
    A.get_by_label("Qué fue").select_option("permiso"); modal(A).get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("un permiso pide causa y quién lo autorizó", modal(A).get_by_text("Falta decir quién lo autorizó").count() == 1 and len(de(A, "ausencia")) == 0)
    A.get_by_label("Causa").fill("CITA MEDICA INVENTADA"); A.get_by_label("Quién autorizó").fill("DIRECCION INVENTADA"); modal(A).get_by_role("button", name="Guardar").click(); A.wait_for_timeout(1200)
    au = de(A, "ausencia"); c3 = A.evaluate(CUENTAS); tab(A, "Planta"); t = plano(tarjeta(A, "BETO INVENTADO").inner_text())
    caso("el permiso queda registrado con su causa, quién lo autorizó y quién lo capturó", len(au) == 1 and "CITA MEDICA" in json.dumps(au[0], ensure_ascii=False) and "DIRECCION INVENTADA" in json.dumps(au[0], ensure_ascii=False) and au[0]["quien"]["nombre"] == "ADMIN DE PRUEBA", au[0]["datos"] if au else None)
    caso("el permiso autorizado se paga: a Beto le corresponden $400", "$400" in t and "permiso" in t.lower(), t[:260])
    caso("ese día pagado sin trabajar es costo del rancho ($400 más)…", c3["egresos"] == cA["egresos"] + 400, [cA["egresos"], c3["egresos"]])
    tab(A, "Costo sin parcela"); A.get_by_text("Ver de dónde sale cada importe").first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("…pero NO de la parcela: sale como costo sin parcela, con su persona y su causa", "$400" in t and "ermiso" in t and "BETO INVENTADO" in t, t[500:1300])
    tab(A, "Planta")
    subio(A); avanza(C, 6 / 60); recarga(C); ir(C, "nomina"); C.wait_for_timeout(400)
    caso("el otro teléfono ve lo mismo de Beto", "$400" in tarjeta(C, "BETO INVENTADO").inner_text(), plano(tarjeta(C, "BETO INVENTADO").inner_text())[:200])
    recarga(A); cR = A.evaluate(CUENTAS)
    caso("después de recargar nada cambia", cR["egresos"] == c3["egresos"] and cR["sale"] == c3["sale"], [cR["egresos"], cR["sale"]])

    # ══ 4. Ya pagado y ya cerrado: una decisión nueva no cambia calladamente ni lo pagado ni lo cerrado ══
    ir(A, "nomina"); A.wait_for_timeout(400)
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("200"); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1600)
    pago0 = de(A, "pago_personal"); c4 = A.evaluate(CUENTAS); subio(A)
    caso("a Ana se le entregan sus $200 (pago sellado por la base)", len(pago0) == 1 and pago0[0].get("_validacion") == "autorizado" and c4["sale"] == cR["sale"] + 200, [len(pago0), c4["sale"], cR["sale"]])
    tab(A, "Asistencia"); A.respuesta = "SE REVISO DESPUES INVENTADO"
    A.locator(".card", has_text="Decisiones sobre salidas antes de tiempo").get_by_role("button", name=re.compile("^Cancelar la decisión")).first.click(); A.wait_for_timeout(1500)
    pago1 = de(A, "pago_personal"); c5 = A.evaluate(CUENTAS); tab(A, "Planta"); t = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("cancelar la decisión DESPUÉS de pagar no toca el pago: siguen entregados $200 y el dinero que salió es el mismo", pago1 == pago0 and c5["sale"] == c4["sale"], [c5["sale"], c4["sale"]])
    caso("y la diferencia queda a la vista: le corresponden $400, entregado $200, pendiente $200", "$400" in t and re.search(r"Entregado \| \$200", t) and re.search(r"Pendiente \| \$200", t), t[:300])
    tab(A, "Asistencia"); decide(A, "medio", "SE CONFIRMA MEDIO DIA INVENTADO"); subio(A)
    avanza(C, 6 / 60); recarga(C); avanza(C, 3 / 60); recarga(C)
    caso("vuelta a decidir (medio día), los dos teléfonos quedan en lo mismo y sin pendiente", A.evaluate(CUENTAS)["egresos"] == C.evaluate(CUENTAS)["egresos"] == 600 and len([e for e in de(C, "decision_jornada") if e["estado"] == "vigente"]) == 1, [A.evaluate(CUENTAS)["egresos"], C.evaluate(CUENTAS)["egresos"]])
    ir(A, "nomina"); A.wait_for_timeout(400); ci(A).get_by_role("button", name="Cerrar el cálculo de la semana").click(); A.wait_for_timeout(1600)
    cs = de(A, "cierre_semana"); subio(A); cC0 = A.evaluate(CUENTAS)
    caso("la semana se cierra (foto sellada)", len(cs) == 1 and cs[0].get("_validacion") == "autorizado", plano(ci(A).inner_text())[:200])
    tab(A, "Asistencia"); antes = de(A, "decision_jornada"); n0 = len(A.dialogos)
    A.locator(".card", has_text="Decisiones sobre salidas antes de tiempo").get_by_role("button", name=re.compile("^Cancelar la decisión")).first.click(); A.wait_for_timeout(900)
    caso("con la semana cerrada no se deja cancelar ni cambiar una decisión: pide reabrirla, con motivo", de(A, "decision_jornada") == antes and any("ya está cerrada" in d and "reabrirla" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    # el otro teléfono, sin señal y sin saber del cierre, sí la cancela: llega DESPUÉS del cierre
    nube.caida = True; avanza(C, 1); ir(C, "nomina"); tab(C, "Asistencia"); C.respuesta = "CANCELADA SIN SABER DEL CIERRE INVENTADO"
    C.locator(".card", has_text="Decisiones sobre salidas antes de tiempo").get_by_role("button", name=re.compile("^Cancelar la decisión")).first.click(); C.wait_for_timeout(1200)
    nube.caida = False
    avanza(C, 2 / 60); subio(C); avanza(A, 1.2); recarga(A); avanza(A, 3 / 60); recarga(A)
    ir(A, "nomina"); A.wait_for_timeout(500); t = plano(ci(A).inner_text()); cs2 = de(A, "cierre_semana"); c6 = A.evaluate(CUENTAS)
    caso("lo que llegó después del cierre NO cambia la foto del cierre ni el pago hecho", cs2[0]["datos"] == cs[0]["datos"] and de(A, "pago_personal") == pago0 and c6["sale"] == cC0["sale"], [c6["sale"], cC0["sale"]])
    caso("y no pasa callado: el cierre dice cuánto cambió, quién lo cambió y por qué", "Después del cierre cambió $200" in t and "canceló una decisión" in t and "CANCELADA SIN SABER DEL CIERRE INVENTADO" in t and "ADMIN DE PRUEBA" in t, t[:700])
    ci(A).get_by_role("button", name="Reabrir la semana").click(); A.wait_for_timeout(300)
    if ci(A).get_by_role("button", name="Reabrir la semana").count() and len(de(A, "reapertura_semana")) == 0 and A.get_by_label("Por qué se reabre").count():
        A.get_by_label("Por qué se reabre").fill("LLEGO UNA DECISION DESPUES INVENTADO"); ci(A).get_by_role("button", name="Reabrir la semana").click(); A.wait_for_timeout(1600)
    ra = de(A, "reapertura_semana")
    caso("para que el cambio entre al cierre hay que reabrir, con motivo y con permiso (sellado por la base); el cierre anterior se queda", len(ra) == 1 and ra[0].get("_validacion") == "autorizado" and "LLEGO UNA DECISION" in json.dumps(ra[0], ensure_ascii=False) and len(de(A, "cierre_semana")) == 1 and de(A, "cierre_semana")[0]["datos"] == cs[0]["datos"], plano(ci(A).inner_text())[:300])
    subio(A)

    # ══ 5. Volver a entrar en un aparato nuevo: todo sigue igual ══
    D = aparato(ADM, "18:30"); hora(D); D.wait_for_timeout(1500)
    dD = de(D, "decision_jornada"); cD = D.evaluate(CUENTAS); recarga(A); cA2 = A.evaluate(CUENTAS)
    ir(D, "nomina"); tab(D, "Asistencia"); th = plano(D.locator(".card", has_text="Decisiones sobre salidas antes de tiempo").inner_text())
    caso("un aparato recién entrado trae las tres decisiones con su historia completa (ninguna perdida ni repetida)", len(dD) == 3 and len({e["id"] for e in dD}) == 3 and sorted(e["estado"] for e in dD) == ["cancelado"] * 3 and all(e["cancelado"]["motivo"] and e["cancelado"]["por"]["nombre"] for e in dD), [[e["estado"], e["datos"]["pago"], (e.get("cancelado") or {}).get("motivo")] for e in dD])
    caso("y enseña cada cancelación con quién y por qué", th.count("Cancelada por ADMIN DE PRUEBA") == 3 and "CANCELADA SIN SABER DEL CIERRE INVENTADO" in th and "SE REVISO DESPUES INVENTADO" in th and "Se capturó mal" in th, th[:900])
    caso("las cuentas son las mismas en el aparato nuevo y en el de siempre, y el pago sigue siendo uno", cD["egresos"] == cA2["egresos"] and cD["sale"] == cA2["sale"] and len(de(D, "pago_personal")) == 1, [cD["egresos"], cA2["egresos"], cD["sale"], cA2["sale"]])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
