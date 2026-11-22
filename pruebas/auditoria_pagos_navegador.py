"""AUDITORÍA FUNCIONAL · EL DINERO DEL PERSONAL, usando la app como una persona desde un teléfono (390 px).
Alta → checar → reparto → Pagos al personal → préstamo (solicitud, autorización, entrega, abonos) → Caja chica ligada →
flujo de efectivo. Con recarga, segundo aparato, dos abonos sin señal y otros perfiles. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_pagos_navegador.py"""
import datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
DIR = N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno"); FIN = N.cuenta(4, "finanzas@prueba.invalid", "FINANZAS DE PRUEBA", "finanzas")
nube = N.Nube([ADM, ENC, DIR, FIN])
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
CUENTAS = """() => { const c = window.__agroCuentas(); const f = c.flujo, r = c.resultado; const por = {};
  for (const m of f.meses || []) for (const lado of ['ingresos', 'egresos']) for (const [k, v] of Object.entries((m.detalle || m.por || {})[lado] || {})) por[k] = (por[k] || 0) + v;
  return JSON.parse(JSON.stringify({ entra: f.ingresos, sale: f.egresos, neto: f.neto, por, meses: f.meses, egresos: r.egresos, ingresos: r.ingresos, utilidad: r.utilidad })); }"""
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def prestamo(pg): return [x for x in datos(pg)["prestamos"]]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="06:30"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.ctx = ctx
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

    # ══ 1. Alta, asistencia y lo que corresponde ══
    A = aparato(ADM)
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill(pin)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    caso("se dan de alta dos trabajadores", len(datos(A)["trabajadores"]) == 2, [t["nombre"] for t in datos(A)["trabajadores"]])
    avanza(A, 0.5); ir(A, "checador")
    for pin in ("4101", "4102"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "reparto")
    for n in ("ANA INVENTADA", "BETO INVENTADO"): A.locator(".rep-ficha", has_text=n).click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 8); ir(A, "checador")
    for pin in ("4101", "4102"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "nomina"); A.wait_for_timeout(600); t = plano(A.locator("body").inner_text())
    caso("Pagos al personal: a cada quien le corresponden $350 por su día, $700 en total, nada entregado", "TOTAL A PAGAR | $700" in t and t.count("Pendiente | $350") == 2, t[150:650])
    c0 = A.evaluate(CUENTAS)
    caso("el día trabajado ya es costo ($700) y todavía no ha salido dinero", c0["sale"] == 0 and c0["entra"] == 0, c0)
    subio(A)

    # ══ 2. El encargado SOLICITA un préstamo: no es deuda ══
    B = aparato(ENC, "15:10"); hora(B)
    ir(B, "personal"); tab(B, "Préstamos"); B.get_by_role("button", name="+ Solicitar").click(); B.wait_for_timeout(300)
    B.get_by_role("button", name="Mandar la solicitud").click(); B.wait_for_timeout(300)
    caso("sin trabajador ni monto la solicitud no se manda, y lo dice", len(de(B, "prestamo_solicitud")) == 0 and "Falta" in (B.dialogos[-1] if B.dialogos else ""), B.dialogos[-1:])
    campo(B, "Trabajador").select_option(label="ANA INVENTADA"); campo(B, "Monto del préstamo").fill("1000"); campo(B, "Motivo").fill("ADELANTO INVENTADO")
    B.get_by_role("button", name="Mandar la solicitud").click(); B.wait_for_timeout(600)
    pr = prestamo(B); t = plano(B.locator("body").inner_text())
    caso("la solicitud queda registrada como SOLICITUD: no es deuda (entregado $0, saldo $0)", len(de(B, "prestamo_solicitud")) == 1 and len(pr) == 1 and pr[0]["estado"] == "solicitado" and (pr[0].get("monto") or 0) == 0, [[x.get("estado"), x.get("monto"), x.get("solicitado")] for x in pr])
    caso("y la pantalla lo dice: «Solicitado», falta autorizar, todavía no es deuda", "Solicitado" in t and "Todavía no es deuda" in t and "Solicitó ENCARGADO DE PRUEBA: $1,000" in t, t[:500])
    caso("al encargado no se le ofrece autorizar ni entregar", B.get_by_role("button", name="Autorizar").count() == 0 and B.get_by_role("button", name="Registrar entrega del dinero").count() == 0)
    cB = B.evaluate(CUENTAS); caso("pedir un préstamo no mueve el dinero", cB["sale"] == 0 and cB["entra"] == 0, cB)
    subio(B)

    # ══ 3. El administrador autoriza MENOS de lo pedido, y luego entrega ══
    recarga(A); ir(A, "personal"); tab(A, "Préstamos"); t = plano(A.locator("body").inner_text())
    caso("al administrador le llega la solicitud, en otro aparato", "ANA INVENTADA" in t and "Solicitado" in t and "$1,000" in t, t[:400])
    A.get_by_role("button", name="Autorizar", exact=True).click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se autoriza ($)").fill("800"); A.get_by_role("button", name="Autorizar el préstamo").click(); A.wait_for_timeout(400)
    dijo = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text())
    caso("sin decir quién autoriza no se autoriza", len(de(A, "prestamo_autorizacion")) == 0, dijo[-260:])
    A.get_by_label("Quién autoriza el préstamo").fill("DIRECCION INVENTADA"); A.get_by_label("Condiciones del préstamo").fill("CIEN POR SEMANA")
    A.get_by_role("button", name="Autorizar el préstamo").click(); A.wait_for_timeout(1500)
    pr = prestamo(A); t = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text()); au = de(A, "prestamo_autorizacion")
    caso("autorizado por $800 (no los $1,000 pedidos), sellado por la base", len(au) == 1 and au[0].get("_validacion") == "autorizado" and pr[0]["estado"] == "autorizado" and pr[0].get("autorizado") == 800, [au[0].get("_validacion") if au else None, pr[0].get("estado"), pr[0].get("autorizado")])
    caso("autorizado y sin entregar TODAVÍA no es deuda", (pr[0].get("monto") or 0) == 0 and "Autorizado y sin entregar: $800" in t and "Saldo pendiente | $0" in t, t[:600])
    A.get_by_role("button", name="Registrar entrega del dinero").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("900"); A.get_by_role("button", name="Guardar la entrega").click(); A.wait_for_timeout(500)
    t = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text())
    caso("no se puede entregar más de lo autorizado", len(de(A, "prestamo_entrega")) == 0, t[-300:])
    A.get_by_label("Cuánto se entregó ($)").fill("800"); A.get_by_role("button", name="Guardar la entrega").click(); A.wait_for_timeout(1500)
    pr = prestamo(A); en = de(A, "prestamo_entrega"); t = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text()); c1 = A.evaluate(CUENTAS)
    caso("con la entrega nace la deuda: $800, sellada por la base", len(en) == 1 and en[0].get("_validacion") == "autorizado" and pr[0]["monto"] == 800 and pr[0]["estado"] == "activo", [pr[0].get("monto"), pr[0].get("estado")])
    caso("y se ve: entregado $800, saldo $800", "Entregado | $800" in t and "Saldo pendiente | $800" in t and "Debe" in t, t[:700])
    caso("el flujo cuenta los $800 que salieron, UNA vez; el resultado no cambia (prestar no es gasto)", c1["sale"] == 800 and c1["egresos"] == c0["egresos"] and c1["utilidad"] == c0["utilidad"], c1)
    caso("ya no se ofrece entregar otra vez", A.get_by_role("button", name="Registrar entrega del dinero").count() == 0)

    # ══ 4. El dinero salió de la caja chica: se liga, no se cuenta dos veces ══
    def caja(pg, tipo, concepto, monto=None, clase=None, liga=None):
        ir(pg, "caja"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(300)
        pg.locator(".option-card", has_text=tipo).first.click(); campo(pg, "Concepto").fill(concepto)
        if clase: pg.get_by_label("Qué fue esta salida").select_option(clase); pg.wait_for_timeout(200)
        if liga is not None: pg.get_by_label("Registro al que se liga").select_option(index=liga); pg.wait_for_timeout(200)
        if monto is not None: campo(pg, "Monto").fill(str(monto))
        pg.get_by_role("button", name="Guardar movimiento").click(); pg.wait_for_timeout(600)
    caja(A, "Entrada", "FONDO INVENTADO", 3000)
    c = A.evaluate(CUENTAS); caso("el fondo que entra a la caja no es ingreso ni gasto", c["sale"] == 800 and c["entra"] == 0 and c["ingresos"] == c0["ingresos"], c)
    caja(A, "Salida", "PRESTAMO A ANA", clase="prestamo", liga=1)
    cc = datos(A)["cajachica"]; sal = [x for x in cc if x["tipo"] == "salida"]; c = A.evaluate(CUENTAS); t = plano(A.locator("body").inner_text())
    caso("la salida de caja se liga a la entrega y toma su importe ($800)", len(sal) == 1 and sal[0].get("eventoId") == en[0]["id"] and float(sal[0]["monto"]) == 800, sal)
    caso("el mismo dinero NO se cuenta dos veces: siguen saliendo $800", c["sale"] == 800, c)
    caso("la caja queda en $2,200 y no creó ningún gasto ni otro préstamo", "$2,200" in t and len(datos(A)["egresos"]) == 0 and len(prestamo(A)) == 1, t[:300])
    caja(A, "Salida", "OTRA VEZ EL PRESTAMO", 800, clase="prestamo")
    sal = [x for x in datos(A)["cajachica"] if x["tipo"] == "salida"]; ir(A, "caja")
    opciones = A.locator("select[aria-label='Ligar OTRA VEZ EL PRESTAMO'] option").all_inner_texts() if A.locator("select[aria-label='Ligar OTRA VEZ EL PRESTAMO']").count() else []
    c = A.evaluate(CUENTAS); t = plano(A.locator("body").inner_text())
    caso("una segunda salida «por el mismo préstamo» no encuentra a qué ligarse: la entrega ya está tomada", len(sal) == 2 and not sal[-1].get("eventoId") and len(opciones) <= 1, opciones)
    caso("y no desaparece: queda POR LIGAR, a la vista, y el flujo la cuenta aparte ($1,600 en total)", c["sale"] == 1600 and "por ligar" in t.lower(), [c["sale"], t[:400]])
    ir(A, "contabilidad"); tab(A, "Resultados"); t = plano(A.locator("body").inner_text())
    caso("Finanzas también avisa de la salida de caja sin ligar", "sin ligar" in t and "$800" in t, t[t.find("Caja chica"):][:400])

    # ══ 5. Pago de la semana y abono ══
    ir(A, "nomina"); A.wait_for_timeout(500); t = plano(A.locator(".card", has_text="ANA INVENTADA").last.inner_text())
    caso("tener un préstamo no le descuenta nada sola: le siguen correspondiendo $350", "Pendiente | $350" in t, t[:300])
    caso("su renglón ENSEÑA lo que debe del préstamo, y el descuento lo escribe una persona (viene vacío)", "$800" in t and "réstamo" in t, t[:700])
    A.locator(".card", has_text="ANA INVENTADA").last.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(400)
    A.get_by_label("Cuánto se entregó ($)").fill("350"); A.locator(".modal-sheet").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1800)
    pg_ = de(A, "pago_personal"); ab = de(A, "abono_prestamo"); c2 = A.evaluate(CUENTAS); t = plano(A.locator(".card", has_text="ANA INVENTADA").last.inner_text())
    caso("pago completo de $350, sin abono que nadie pidió", len(pg_) == 1 and pg_[0].get("_validacion") == "autorizado" and len(ab) == 0 and "Pendiente | $0" in t, [len(pg_), len(ab), t[:200]])
    caso("pagar es dinero que sale ($350 más) y no es costo nuevo", c2["sale"] == 1950 and c2["egresos"] == c0["egresos"], c2)
    caja(A, "Salida", "PAGO A ANA", clase="pago_personal", liga=1)
    sal = [x for x in datos(A)["cajachica"] if x["tipo"] == "salida"]; c = A.evaluate(CUENTAS)
    caso("la salida de caja del pago se liga al pago y no lo duplica", sal[-1].get("eventoId") == pg_[0]["id"] and float(sal[-1]["monto"]) == 350 and c["sale"] == 1950, [sal[-1], c["sale"]])
    ir(A, "personal"); tab(A, "Préstamos")
    A.get_by_role("button", name="Registrar abono").click(); A.wait_for_timeout(200); A.get_by_placeholder("Monto del abono").fill("300"); A.locator(".inp-row .btn-accent").click(); A.wait_for_timeout(1500)
    pr = prestamo(A); ab = de(A, "abono_prestamo"); c3 = A.evaluate(CUENTAS); t = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text())
    caso("un abono de $300 baja el saldo a $500, sellado por la base", len(ab) == 1 and ab[0].get("_validacion") == "autorizado" and "Saldo pendiente | $500" in t and "Abonado | $300" in t, t[-300:])
    caso("el abono aparte es dinero que entra ($300) y no es ingreso del rancho", c3["entra"] == 300 and c3["ingresos"] == c0["ingresos"] and c3["sale"] == 1950, c3)
    subio(A)

    # ══ 6. Recargar, y el otro aparato ══
    antes = A.evaluate(CUENTAS); prA = prestamo(A)[0]
    recarga(A); c = A.evaluate(CUENTAS); prR = prestamo(A)[0]
    caso("después de recargar todo sigue igual: saldo, flujo y resultado", [c["sale"], c["entra"], c["utilidad"]] == [antes["sale"], antes["entra"], antes["utilidad"]] and [prR["monto"], prR.get("abonado")] == [prA["monto"], prA.get("abonado")], [c["sale"], c["entra"], prR.get("abonado")])
    recarga(B); ir(B, "personal"); tab(B, "Préstamos"); t = plano(B.locator(".card", has_text="ANA INVENTADA").first.inner_text()); prB = prestamo(B)[0]
    caso("el encargado ve en su aparato el mismo préstamo con el mismo saldo", [prB["monto"], prB.get("abonado")] == [prR["monto"], prR.get("abonado")] and "Autorizó DIRECCION INVENTADA" in t, t[:500])
    saldoAntes = prR["monto"] - (prR.get("abonado") or 0)

    # ══ 7. Dos aparatos sin señal abonan al mismo préstamo: ninguno pisa al otro ══
    if saldoAntes >= 150:
        C = aparato(ADM, "16:00"); hora(C); recarga(C)
        nube.caida = True
        for pg, monto in ((A, "100"), (C, "50")):
            ir(pg, "personal"); tab(pg, "Préstamos"); pg.get_by_role("button", name="Registrar abono").click(); pg.wait_for_timeout(200)
            pg.get_by_placeholder("Monto del abono").fill(monto); pg.locator(".inp-row .btn-accent").click(); pg.wait_for_timeout(800)
        nube.caida = False
        for pg in (A, C): avanza(pg, 2 / 60); subio(pg)
        for pg in (A, C): recarga(pg)
        sA = prestamo(A)[0]; sC = prestamo(C)[0]
        caso("los dos abonos sin señal cuentan, en los dos aparatos: el saldo baja $150", sA["monto"] - sA.get("abonado", 0) == saldoAntes - 150 and sC["monto"] - sC.get("abonado", 0) == saldoAntes - 150, [saldoAntes, sA.get("abonado"), sC.get("abonado")])
        caso("y la base selló los dos", all(e.get("_validacion") == "autorizado" for e in de(A, "abono_prestamo")), [e.get("_validacion") for e in de(A, "abono_prestamo")])
    else: caso("dos abonos sin señal (no se pudo: el saldo quedó en menos de $150)", False, saldoAntes)

    # ══ 8. El encargado, que no tiene permiso, no puede abonar aunque lo intente ══
    ir(B, "personal"); tab(B, "Préstamos"); recarga(B); ir(B, "personal"); tab(B, "Préstamos")
    n0 = len(de(B, "abono_prestamo")); boton = B.get_by_role("button", name="Registrar abono")
    if boton.count():
        boton.click(); B.wait_for_timeout(200); B.get_by_placeholder("Monto del abono").fill("10"); B.locator(".inp-row .btn-accent").click(); B.wait_for_timeout(1500)
    vig = [e for e in de(B, "abono_prestamo") if e.get("_validacion") == "autorizado"]
    sB = prestamo(B)[0]
    caso("el abono de quien no tiene permiso no cuenta (la app no lo deja o la base lo rechaza)", len(vig) == n0 and sB["monto"] - sB.get("abonado", 0) == saldoAntes - 150, [n0, len(de(B, "abono_prestamo")), B.dialogos[-1:], sB.get("abonado")])

    # ══ 8b. Abonar más de lo que debe ══
    recarga(A); ir(A, "personal"); tab(A, "Préstamos")
    A.get_by_role("button", name="Registrar abono").click(); A.wait_for_timeout(200); A.get_by_placeholder("Monto del abono").fill("5000"); A.locator(".inp-row .btn-accent").click(); A.wait_for_timeout(1500)
    pr = prestamo(A); ab = de(A, "abono_prestamo"); t = plano(A.locator(".card", has_text="ANA INVENTADA").first.inner_text())
    caso("un abono mayor que lo que debe sólo abona lo que debía, y lo dice: el saldo queda en $0, no en negativo", pr[0]["monto"] - pr[0].get("abonado", 0) == 0 and pr[0]["estado"] == "pagado" and any("Sobraron" in d for d in A.dialogos[-2:]) and "Pagado" in t, [pr[0].get("abonado"), pr[0].get("estado"), A.dialogos[-2:]])
    subio(A)

    # ══ 9. Otros perfiles ══
    D = aparato(DIR, "17:00"); hora(D); c = D.evaluate(CUENTAS)
    caso("Dirección ve el mismo flujo que el administrador", [c["sale"], c["utilidad"]] == [A.evaluate(CUENTAS)["sale"], A.evaluate(CUENTAS)["utilidad"]], [c["sale"], c["entra"]])
    F = aparato(FIN, "17:05"); hora(F); ir(F, "nomina"); F.wait_for_timeout(500); t = plano(F.locator("body").inner_text())
    caso("Finanzas (sin permiso otorgado) ve Pagos al personal y no se le ofrece pagar", "ANA INVENTADA" in t and F.get_by_role("button", name="Registrar pago").count() == 0, t[:300])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
