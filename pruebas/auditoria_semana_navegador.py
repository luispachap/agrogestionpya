"""AUDITORÍA FUNCIONAL · LA SEMANA DEL PERSONAL, usando la app como una persona desde un teléfono (390 px), con cuentas.
Cuadrillas (el día de un grupo eventual) → su cuenta por responsable → entrega → bono (otorgar y pagar) → recibo →
cerrar la semana y confirmar los pagos, mirando en cada paso el costo, el flujo y lo que sella la base. Con recarga, segundo
aparato y un perfil sin permiso. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_semana_navegador.py"""
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
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept("Se capturó mal") if d.type == "prompt" else d.accept()))
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

    # ══ 1. Un trabajador de planta con su día, y una cuadrilla que llegó a cosechar ══
    A = aparato(ADM, "06:30")
    ir(A, "equipo"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre completo").fill("ANA INVENTADA"); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill("4101"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    avanza(A, 0.5); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    ir(A, "reparto"); A.locator(".rep-ficha", has_text="ANA INVENTADA").click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 8); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    c0 = A.evaluate(CUENTAS)
    ir(A, "cuadrillas-dia"); A.get_by_role("button", name="Registrar una cuadrilla").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("el día de una cuadrilla no se guarda vacío", len(de(A, "cuadrilla_dia")) == 0, plano(A.locator("body").inner_text())[-300:])
    A.get_by_label("Cuadrilla", exact=True).select_option("__otra__"); A.wait_for_timeout(200)
    A.get_by_label("Nombre de la cuadrilla").fill("CUADRILLA INVENTADA")
    if A.get_by_label("Responsable").count(): A.get_by_label("Responsable").fill("DON CHUY INVENTADO")
    A.get_by_label("Parcela").select_option("p1"); A.get_by_label("Qué hicieron").select_option("Cosecha")
    A.get_by_label("Pago por día de cada persona ($)").fill("300")
    for i, nombre in enumerate(("UNO INVENTADO", "DOS INVENTADO")):
        if i > 0: A.get_by_role("button", name="Agregar persona").click()
        A.get_by_label(f"Nombre {i + 1}").fill(nombre)
    A.get_by_label("Transporte").select_option("ninguno"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(700)
    cd = de(A, "cuadrilla_dia"); c1 = A.evaluate(CUENTAS)
    caso("queda el día de la cuadrilla: dos personas a $300, con su responsable", len(cd) == 1 and len(cd[0]["datos"].get("integrantes") or []) == 2 and cd[0]["datos"].get("responsable") == "DON CHUY INVENTADO", cd[0]["datos"] if cd else plano(A.locator("body").inner_text())[-400:])
    caso("su trabajo es costo de la parcela ($600 más) y todavía no salió dinero", c1["egresos"] == c0["egresos"] + 600 and c1["sale"] == 0, [c0["egresos"], c1["egresos"], c1["sale"]])

    # ══ 2. Pagos al personal: una cuenta por responsable ══
    ir(A, "nomina"); tab(A, "Cuadrillas y temporales"); A.wait_for_timeout(400)
    cq = tarjeta(A, "DON CHUY INVENTADO"); t = plano(cq.inner_text())
    caso("la cuadrilla lleva UNA cuenta, la de su responsable: $600, con quiénes vinieron", "$600" in t and "DON CHUY INVENTADO" in t and "UNO INVENTADO" in t, t[:400])
    cq.get_by_role("button", name="Registrar entrega").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("400"); A.get_by_label("Responsable que recibió").fill(""); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    caso("la entrega a una cuadrilla exige el nombre de quien recibió", len(de(A, "pago_personal")) == 0 and "Falta el nombre del responsable" in modal(A).inner_text())
    A.get_by_label("Responsable que recibió").fill("DON CHUY INVENTADO"); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1600)
    pp = de(A, "pago_personal"); c2 = A.evaluate(CUENTAS); t = plano(tarjeta(A, "DON CHUY INVENTADO").inner_text())
    caso("entregados $400, pendientes $200, sellado por la base; y no dice que cada integrante ya cobró", len(pp) == 1 and pp[0].get("_validacion") == "autorizado" and "$400" in t and "$200" in t and "no dice que cada integrante ya cobró" in t, t[-300:])
    caso("pagarle a la cuadrilla es dinero que sale ($400) y no es costo otra vez", c2["sale"] == 400 and c2["egresos"] == c1["egresos"], c2)

    # ══ 3. Bono: el costo nace al otorgarlo; pagarlo no es costo ══
    tab(A, "Bonos"); A.get_by_role("button", name="Otorgar un bono").click(); A.wait_for_timeout(300)
    A.get_by_label("A quién").select_option(index=1); A.get_by_label("Importe ($)").fill("500"); A.get_by_label("Motivo").fill("AGUINALDO INVENTADO")
    A.get_by_label("Periodo que premia: desde").fill("2026-11-16"); A.get_by_label("hasta").fill("2026-11-19"); A.get_by_label("Quién lo autoriza").fill("DIRECCION INVENTADA")
    A.get_by_role("button", name="Otorgar el bono").click(); A.wait_for_timeout(400)
    caso("un aguinaldo no entra como bono: eso es de Prestaciones", len(de(A, "bono_personal")) == 0 and "Eso no es un bono" in A.locator("body").inner_text())
    A.get_by_label("Motivo").fill("META DE CAJAS INVENTADA"); A.get_by_role("button", name="Otorgar el bono").click(); A.wait_for_timeout(1600)
    bn = de(A, "bono_personal"); c3 = A.evaluate(CUENTAS); t = plano(A.locator("body").inner_text())
    caso("el bono queda otorgado y sellado por la base, por pagar", len(bn) == 1 and bn[0].get("_validacion") == "autorizado" and "faltan $500" in t, [bn[0].get("_validacion") if bn else None, t[-500:]])
    caso("su costo nace al otorgarlo ($500 más) sin que haya salido dinero", c3["egresos"] == c2["egresos"] + 500 and c3["sale"] == 400, [c2["egresos"], c3["egresos"], c3["sale"]])
    A.get_by_role("button", name="Registrar pago del bono de ANA INVENTADA").click(); A.wait_for_timeout(300); A.get_by_role("button", name="Guardar el pago").click(); A.wait_for_timeout(1600)
    pb = de(A, "pago_bono"); c4 = A.evaluate(CUENTAS)
    caso("pagarlo es dinero que sale ($500) y no cambia el costo", len(pb) == 1 and pb[0].get("_validacion") == "autorizado" and c4["sale"] == 900 and c4["egresos"] == c3["egresos"], c4)

    # ══ 4. Pago y recibo de la trabajadora de planta ══
    tab(A, "Planta"); t = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("el bono no se mezcla con su semana: le corresponden $350 por su día", "Pendiente | $350" in t, t[:300])
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("200"); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1600)
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Recibo").click(); A.wait_for_timeout(400)
    hoja = A.locator(".printable").inner_text()
    caso("el recibo dice lo que corresponde, lo entregado y lo pendiente, y que NO es un CFDI de nómina", "$350" in hoja and "$200" in hoja and "$150" in hoja and "No es un CFDI de nómina" in hoja, plano(hoja)[:400])
    A.get_by_role("button", name="Emitir el recibo").click(); A.wait_for_timeout(1600)
    rc = de(A, "recibo_personal")
    caso("emitido queda como versión 1, sellado por la base", len(rc) == 1 and rc[0]["datos"]["version"] == 1 and rc[0].get("_validacion") == "autorizado", [r.get("_validacion") for r in rc])
    A.locator(".top-bar .btn-ghost").click(); A.wait_for_timeout(300)

    # ══ 5. Cerrar la semana y confirmar los pagos ══
    tab(A, "Planta"); t = plano(ci(A).inner_text())
    caso("la semana está abierta, con su total calculado", "Semana abierta" in t, t[:200])
    ci(A).get_by_role("button", name="Cerrar el cálculo de la semana").click(); A.wait_for_timeout(1600)
    cs = de(A, "cierre_semana"); t = plano(ci(A).inner_text())
    caso("cerrar guarda la foto del cálculo, sellada por la base, y NO confirma ningún pago", len(cs) == 1 and cs[0].get("_validacion") == "autorizado" and "versión 1" in t and len(de(A, "confirmacion_pagos")) == 0, t[:300])
    ci(A).get_by_role("button", name="Confirmar los pagos de la semana").click(); A.wait_for_timeout(500)
    caso("confirmar con dinero pendiente pide anotar por qué", len(de(A, "confirmacion_pagos")) == 0 and "hay que anotar por qué" in ci(A).inner_text(), plano(ci(A).inner_text())[:300])
    A.get_by_label("Nota de la confirmación").fill("EL RESTO EL SABADO"); ci(A).get_by_role("button", name="Confirmar los pagos de la semana").click(); A.wait_for_timeout(1600)
    cf = de(A, "confirmacion_pagos"); c5 = A.evaluate(CUENTAS)
    caso("la confirmación queda aparte del cierre, sellada, y ni cerrar ni confirmar movieron dinero ni costo", len(cf) == 1 and cf[0].get("_validacion") == "autorizado" and c5["sale"] == 1100 and c5["egresos"] == c4["egresos"], [c5["sale"], c5["egresos"], c4["egresos"]])
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("150"); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1600)
    t = plano(ci(A).inner_text())
    caso("un pago después del cierre no cambia la foto: se enseña como diferencia", de(A, "cierre_semana")[0]["datos"] == cs[0]["datos"] and len(de(A, "pago_personal")) == 3, t[:400])
    subio(A)

    # ══ 6. Recarga y el otro aparato ══
    antes = A.evaluate(CUENTAS); recarga(A); c6 = A.evaluate(CUENTAS)
    caso("después de recargar: mismo flujo ($1,250) y mismo costo", c6["sale"] == 1250 and [c6["sale"], c6["egresos"]] == [antes["sale"], antes["egresos"]], [c6["sale"], c6["egresos"], c6["detalle"]])
    caso("cada salida de dinero está una vez: cuadrilla $400 + bono $500 + Ana $350", c6["detalle"].get("pagos_personal") == 750 and c6["detalle"].get("pagos_bonos") == 500, c6["detalle"])
    B = aparato(ENC, "17:30"); hora(B); cB = B.evaluate(CUENTAS)
    caso("el encargado ve en su aparato los mismos importes", [cB["sale"], cB["egresos"]] == [c6["sale"], c6["egresos"]], [cB["sale"], cB["egresos"]])
    ir(B, "nomina"); B.wait_for_timeout(500); t = plano(B.locator("body").inner_text())
    caso("el encargado no tiene Pagos al personal: la pantalla no le abre", "Pagos al personal" not in t and B.get_by_role("button", name="Registrar pago").count() == 0 and B.locator(".tab-pill", has_text="Bonos").count() == 0, t[:300])

    # ══ 7. Reabrir pide motivo y deja la versión anterior ══
    ir(A, "nomina"); A.wait_for_timeout(400)
    ci(A).get_by_role("button", name="Reabrir la semana").click(); A.wait_for_timeout(300)
    if ci(A).get_by_role("button", name="Reabrir la semana").count(): ci(A).get_by_role("button", name="Reabrir la semana").click(); A.wait_for_timeout(400)
    caso("reabrir la semana pide el motivo", len(de(A, "reapertura_semana")) == 0, plano(ci(A).inner_text())[:300])
    A.get_by_label("Por qué se reabre").fill("FALTABA UN PERMISO INVENTADO"); ci(A).get_by_role("button", name="Reabrir la semana").click(); A.wait_for_timeout(1600)
    ra = de(A, "reapertura_semana")
    caso("reabierta con motivo, sellada; el cierre anterior sigue guardado", len(ra) == 1 and ra[0].get("_validacion") == "autorizado" and len(de(A, "cierre_semana")) == 1 and "Semana reabierta" in ci(A).inner_text(), plano(ci(A).inner_text())[:300])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
