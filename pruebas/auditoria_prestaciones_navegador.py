"""AUDITORÍA FUNCIONAL · HORAS ADICIONALES, PRESTACIONES Y BAJAS con cuentas y dos teléfonos (390 px).
Una jornada larga deja horas registradas que NO cambian el pago; reconocerlas lo decide alguien con permiso (sellado por
la base). Prestaciones: fecha de corte, saldo inicial con fundamento y responsable, determinar con quién autoriza, pagar
(no es costo). Baja: propone el finiquito, pide quién autoriza, sellada por la base; el pago no es costo; ya de baja no
se ofrece otra vez. El encargado y Finanzas no tienen esas puertas. Otro aparato y recarga ven lo mismo.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_prestaciones_navegador.py   (FOTOS=/ruta para capturas)"""
import datetime, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"; FOTOS = os.environ.get("FOTOS")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado"); FIN = N.cuenta(4, "finanzas@prueba.invalid", "FINANZAS DE PRUEBA", "finanzas")
nube = N.Nube([ADM, ENC, FIN]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": V}}
t["trabajadores"] = {
  "t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 350, "fechaIngreso": "2024-11-01", "historialSueldo": [{"desde": "2024-11-01", "sueldo_dia": 350, "anterior": 350}], **E}, "actualizado": V},
  "t-beto": {"id": "t-beto", "nombre": "BETO INVENTADO", "pin": "4102", "datos": {"categoria": "jornalero", "sueldo_dia": 350, "fechaIngreso": "2025-11-01", "historialSueldo": [{"desde": "2025-11-01", "sueldo_dia": 350, "anterior": 350}], **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).last
modal = lambda pg: pg.locator(".modal-sheet")
CUENTAS = "() => { const c = window.__agroCuentas(); return JSON.parse(JSON.stringify({ sale: c.flujo.egresos, costo: c.resultado.egresos })); }"
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="06:30"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept()))
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

    # ══ 1. Una jornada de 10 horas: las horas adicionales se registran y no cambian el pago ══
    A = aparato(ADM)
    avanza(A, 0.25); ir(A, "checador")
    for pin in ("4101", "4102"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "reparto")
    for n in ("ANA INVENTADA", "BETO INVENTADO"): A.locator(".rep-ficha", has_text=n).click()
    A.get_by_label("Parcela o vehículo").select_option("p1"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 10); ir(A, "checador")
    for pin in ("4101", "4102"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "nomina"); tab(A, "Horas adicionales"); ha = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("10 horas dejan 2 horas adicionales registradas, sin tratar", "2 h 00 min" in ha and "Sin tratar" in ha, ha[:300])
    tab(A, "Planta"); caso("y registrarlas no cambió el pago: su día sigue siendo $350", "Pendiente | $350" in plano(tarjeta(A, "ANA INVENTADA").inner_text()), plano(tarjeta(A, "ANA INVENTADA").inner_text())[:300])
    tab(A, "Horas adicionales"); tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Reconocer horas").click(); A.wait_for_timeout(200)
    A.get_by_label("Horas que se reconocen").fill("2"); A.get_by_label("Qué se hace con ellas").fill("SE PAGAN EL SABADO")
    A.get_by_role("button", name="Guardar").last.click(); A.wait_for_timeout(300)
    caso("reconocerlas pide quién lo autoriza", len(de(A, "horas_reconocidas")) == 0)
    A.get_by_label("Quién autoriza las horas").fill("DIRECCION INVENTADA"); A.get_by_role("button", name="Guardar").last.click(); A.wait_for_timeout(1500)
    hr = de(A, "horas_reconocidas")
    caso("quedan reconocidas, con quién autorizó, selladas por la base (registrar ≠ reconocer ≠ pagar)", len(hr) == 1 and hr[0].get("_validacion") == "autorizado" and hr[0]["datos"].get("autorizo") == "DIRECCION INVENTADA", [x.get("_validacion") for x in hr])
    tab(A, "Planta"); caso("reconocerlas tampoco cambió solo el pago de la semana", "Pendiente | $350" in plano(tarjeta(A, "ANA INVENTADA").inner_text()))
    subio(A)

    # ══ 2. Prestaciones: corte, saldo inicial, determinar y pagar ══
    tab(A, "Prestaciones")
    A.get_by_label(re.compile("fecha de corte")).fill("2026-07-01"); A.locator(".form-group", has_text="fecha de corte").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(800)
    caso("la fecha de corte queda declarada (como regla, con quién)", A.get_by_text("Fecha de corte: 2026-07-01").count() == 1)
    a = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("Ana ya genera aguinaldo desde el corte, con su cuenta a la vista", "generado después" in a and "aguinaldo" in a.lower(), a[:400])
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Saldo inicial").click()
    A.get_by_label("De qué es el saldo").select_option("aguinaldo"); A.get_by_label("Periodo del saldo").select_option("2026"); A.get_by_label("Importe ($)").fill("2700")
    modal(A).get_by_role("button", name="Guardar saldo inicial").click(); A.wait_for_timeout(200)
    caso("el saldo inicial pide en qué se funda y quién responde", "Falta decir en qué se funda" in modal(A).inner_text() and len(de(A, "prestacion_saldo_inicial")) == 0)
    A.get_by_label("En qué se funda el cálculo").fill("CALCULO DEL DESPACHO INVENTADO"); A.get_by_label("Quién responde por este saldo").fill("LUIS INVENTADO")
    modal(A).get_by_role("button", name="Guardar saldo inicial").click(); A.wait_for_timeout(1500)
    si = de(A, "prestacion_saldo_inicial")
    caso("queda el saldo inicial de $2,700 con fundamento y responsable, sellado por la base", len(si) == 1 and si[0]["datos"]["monto"] == 2700 and si[0].get("_validacion") == "autorizado")
    c0 = A.evaluate(CUENTAS)
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Determinar").click()
    A.get_by_label("Qué prestación").select_option("aguinaldo"); A.get_by_label("De qué periodo").select_option("2026")
    caso("al determinar propone la cifra con su cuenta, sin imponerla", "saldrían" in modal(A).inner_text(), plano(modal(A).inner_text())[:300])
    A.get_by_label("Importe determinado ($)").fill("5000"); modal(A).get_by_role("button", name="Guardar").click(); A.wait_for_timeout(200)
    caso("determinar pide quién lo autoriza", "Falta quién lo autoriza" in modal(A).inner_text())
    A.get_by_label("Quién lo autoriza").fill("RODOLFO INVENTADO"); modal(A).get_by_role("button", name="Guardar").click(); A.wait_for_timeout(1500)
    dt = de(A, "prestacion_determinada"); a = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("queda determinado en $5,000, sellado; al costo sólo va el ajuste (no los $5,000 otra vez)", len(dt) == 1 and dt[0].get("_validacion") == "autorizado" and "determinado $5,000" in a and "ajustes $" in a, a[:500])
    tarjeta(A, "ANA INVENTADA").locator(".mo-act", has_text="año 2026: $5,000").get_by_role("button", name="Pagar").click()
    A.get_by_label("Cuánto se entregó ($)").fill("3000"); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1500)
    a = plano(tarjeta(A, "ANA INVENTADA").inner_text()); c1 = A.evaluate(CUENTAS)
    caso("el pago baja lo que se debe (queda $2,000) y está sellado", "pagado $3,000" in a and "$2,000" in a and de(A, "pago_prestacion")[0].get("_validacion") == "autorizado", a[:400])
    caso("pagar es dinero que sale ($3,000) y NO es costo nuevo", round(c1["sale"] - c0["sale"], 2) == 3000 and round(c1["costo"] - c0["costo"], 2) < 3000, [c0, c1])
    foto(A, "01-prestaciones")
    subio(A)

    # ══ 3. La baja de Beto: propone el finiquito y pide quién autoriza ══
    tarjeta(A, "BETO INVENTADO").get_by_role("button", name="Dar de baja").click()
    A.get_by_label("Causa de la terminación").select_option("renuncia"); A.wait_for_timeout(200)
    m = plano(modal(A).inner_text())
    caso("en una renuncia propone el finiquito: lo ya ganado, sin indemnizaciones", "Corresponde: finiquito" in m and "no procede en esta causa" in m, m[:500])
    modal(A).get_by_role("button", name="Registrar la baja").click(); A.wait_for_timeout(200)
    caso("la baja pide quién la autoriza", "Falta quién lo autoriza" in modal(A).inner_text() and len(de(A, "baja_personal")) == 0)
    A.get_by_label("Quién autoriza la baja").fill("RODOLFO INVENTADO"); modal(A).get_by_role("button", name="Registrar la baja").click(); A.wait_for_timeout(1500)
    bj = de(A, "baja_personal"); bt = plano(tarjeta(A, "BETO INVENTADO").inner_text())
    caso("queda la baja (finiquito) sellada por la base, con quién autorizó", len(bj) == 1 and bj[0]["datos"]["da"] == "finiquito" and bj[0].get("_validacion") == "autorizado", [x["datos"].get("da") for x in bj])
    total = bj[0]["datos"]["total"] if bj else 0
    tarjeta(A, "BETO INVENTADO").get_by_role("button", name="Registrar pago de la baja").click()
    A.get_by_label("Cuánto se entregó ($)").fill(str(total)); modal(A).get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1500)
    bt = plano(tarjeta(A, "BETO INVENTADO").inner_text())
    caso("el pago de la baja queda sellado y ya de baja no se ofrece determinar ni otra baja", len(de(A, "pago_baja")) == 1 and de(A, "pago_baja")[0].get("_validacion") == "autorizado" and "Dar de baja" not in bt and "Determinar" not in bt, bt[:300])
    beto = next(x for x in datos(A)["trabajadores"] if x["id"] == "t-beto")
    caso("Beto queda inactivo por cálculo (no se borró su ficha)", beto.get("_porBaja") or beto.get("activo") is False, {k: beto.get(k) for k in ("activo", "_porBaja")})
    foto(A, "02-baja")
    subio(A)

    # ══ 4. Encargado y Finanzas no tienen esas puertas; otro aparato y recarga ══
    B = aparato(ENC, "18:00"); hora(B); ir(B, "nomina")
    caso("el encargado no tiene Pagos al personal (ni determinar, ni bajas)", B.get_by_role("button", name="Determinar").count() == 0 and B.get_by_role("button", name="Dar de baja").count() == 0)
    F = aparato(FIN, "18:05"); hora(F); ir(F, "nomina"); tab(F, "Prestaciones")
    caso("Finanzas ve las prestaciones pero no se le ofrece determinar, pagar ni dar de baja", F.get_by_role("button", name="Determinar").count() == 0 and F.get_by_role("button", name="Dar de baja").count() == 0 and F.get_by_role("button", name="Pagar").count() == 0)
    C = aparato(ADM, "18:10"); hora(C); ir(C, "nomina"); tab(C, "Prestaciones"); cc = plano(C.locator("body").inner_text())
    caso("en otro aparato: lo determinado, lo pagado y la baja, iguales", "determinado $5,000" in cc and "pagado $3,000" in cc and "Finiquito" in cc, cc[:600])
    recarga(A); ir(A, "nomina"); tab(A, "Prestaciones"); caso("después de recargar, igual", "determinado $5,000" in plano(A.locator("body").inner_text()))
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
