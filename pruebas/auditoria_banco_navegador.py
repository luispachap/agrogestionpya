"""AUDITORÍA FUNCIONAL · SOCIOS Y BANCO: titulares y bolsas, marcar cada movimiento como del rancho o personal, la cuenta
entre socios, y el estado de cuenta del banco (uno que cuadra, uno que no, el mismo dos veces, conciliar y explicar).
Lo personal se marca y NO cuenta como costo del rancho en ninguna pantalla. Con cuentas, 390 px, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_banco_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "cultivo": "Ajo", "datos": {"hectareas": 2, **E}, "actualizado": V}}
t["egresos"] = {"e1": {"id": "e1", "fecha": "2026-11-05", "parcela_id": "p1", "datos": {"concepto": "RIEGO ELECTRICO INVENTADO", "proveedor": "CFE", "monto": 1500, "categoria": "riego", **E}, "actualizado": V},
                "e2": {"id": "e2", "fecha": "2026-11-07", "parcela_id": None, "datos": {"concepto": "DESPENSA DE LA CASA", "monto": 800, "categoria": "otro", **E}, "actualizado": V},
                # Una factura ya marcada como del rancho, a nombre del RFC de Rodolfo.
                "e6": {"id": "e6", "fecha": "2026-11-08", "parcela_id": "p1", "datos": {"concepto": "SERVICIO CON FACTURA", "monto": 1000, "categoria": "servicios", "uuid": "UUID-INVENTADO-0001", "rfcReceptor": "XAXX010101000", "destino": "rancho", **E}, "actualizado": V}}
t["ingresos"] = {"i1": {"id": "i1", "fecha": "2026-11-03", "datos": {"concepto": "VENTA INVENTADA", "cliente": "CLIENTE INVENTADO", "monto": 5000, "categoria": "venta_cosecha", **E}, "actualizado": V}}
BUENO = "Fecha,Concepto,Cargo,Abono,Saldo\n03/11/2026,DEPOSITO CLIENTE INVENTADO,,5000.00,15000.00\n05/11/2026,PAGO CFE,1500.00,,13500.00\n06/11/2026,COMISION POR MANEJO,15.00,,13485.00\n"
MALO = "Fecha,Concepto,Cargo,Abono,Saldo\n03/12/2026,DEPOSITO,,1000.00,14485.00\n05/12/2026,PAGO,200.00,,14200.00\n06/12/2026,COMISION,15.00,,14185.00\n"
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
tab = lambda pg, txt: (pg.locator(".tab-pill", has_text=txt).first.click(), pg.wait_for_timeout(400))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = "COMISION DEL BANCO, NO HAY FACTURA"
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)
    antes = A.evaluate("() => window.__agroCuentas().resultado.egresos")
    caso("antes de marcar nada, Finanzas cuenta los tres gastos (1,500 + 800 + 1,000)", antes == 3300, antes)

    # ── 1 · Titulares y bolsas ──
    ir(A, "socios"); tab(A, "Titulares y bolsas")
    for nombre, rfc in (("RODOLFO INVENTADO", "XAXX010101000"), ("MIGUE INVENTADO", "")):
        A.get_by_role("button", name="+ Titular").click(); A.wait_for_timeout(200)
        A.get_by_placeholder("Rodolfo, Migue, Fito…").fill(nombre)
        if rfc: A.locator(".form-group", has=A.locator("label", has_text="RFC")).locator("input").fill(rfc)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    for nombre, duenio in (("CUENTA DE RODOLFO", "RODOLFO INVENTADO"), ("TARJETA DE MIGUE", "MIGUE INVENTADO")):
        A.get_by_role("button", name="+ Bolsa").click(); A.wait_for_timeout(200)
        A.get_by_placeholder("Bajío de Rodolfo, Tarjeta de Migue, Caja de Zacatecas…").fill(nombre)
        A.locator(".form-group", has=A.locator("label", has_text="¿De quién es?")).locator("select").select_option(label=duenio)
        A.get_by_role("button", name="Guardar").last.click(); A.wait_for_timeout(300)
    tx = cuerpo(A); foto(A, "01-titulares-y-bolsas")
    caso("se dan de alta dos titulares y una bolsa de cada uno", "RODOLFO INVENTADO | XAXX010101000 | · CUENTA DE RODOLFO" in tx and "MIGUE INVENTADO | · TARJETA DE MIGUE" in tx, tx[:700])
    A.get_by_role("button", name="+ Bolsa").click(); A.wait_for_timeout(200); A.get_by_placeholder("Bajío de Rodolfo, Tarjeta de Migue, Caja de Zacatecas…").fill("BOLSA SIN DUEÑO")
    A.locator("button", has_text="Guardar").last.click(); A.wait_for_timeout(300)
    caso("una bolsa sin dueño no se guarda: cada bolsa tiene UN dueño", any("dueño" in x for x in A.dialogos) and len(datos(A).get("bolsas") or []) == 2, A.dialogos[-1:])

    # ── 2 · Marcar cada movimiento ──
    tab(A, "Por marcar"); tx = cuerpo(A)
    caso("por marcar: los tres movimientos, ninguno decidido de antemano", "Por marcar (3)" in tx, tx[:400])
    def marcar(concepto, bolsa, boton):
        c = A.locator(".card", has_text=concepto).first
        c.locator("select").select_option(label=bolsa); A.wait_for_timeout(400)
        A.locator(".card", has_text=concepto).first.get_by_role("button", name=boton).click(); A.wait_for_timeout(400)
    marcar("RIEGO ELECTRICO INVENTADO", "TARJETA DE MIGUE", "Es del rancho")
    marcar("DESPENSA DE LA CASA", "CUENTA DE RODOLFO", "Es personal")
    marcar("VENTA INVENTADA", "CUENTA DE RODOLFO", "Es del rancho")
    eg = {e["id"]: e for e in datos(A)["egresos"]}
    caso("cada marca guarda quién la puso, y la bolsa", eg["e1"].get("destino") == "rancho" and eg["e1"].get("marcadoPor") == "ADMIN DE PRUEBA" and eg["e2"].get("destino") == "personal" and bool(eg["e1"].get("bolsaId")), {k: (v.get("destino"), v.get("marcadoPor"), v.get("bolsaId")) for k, v in eg.items()})
    tab(A, "Cuenta entre socios"); tx = cuerpo(A); foto(A, "02-cuenta-entre-socios")
    caso("la cuenta entre socios: Migue puso $1,500 de su tarjeta y Rodolfo recibió $5,000 del rancho", "Puso de su bolsa $1,500" in tx and "recibió $5,000" in tx, tx[:1200])
    caso("lo personal no se borra: se excluye y se dice cuánto", "$800" in tx, tx[:1200])

    tab(A, "Comprobantes"); tx = cuerpo(A)
    caso("comprobantes: la factura quedó a nombre de Rodolfo por su RFC, y el riego sin factura se dice (no se esconde)", "RODOLFO INVENTADO · 1 factura(s) | $1,000" in tx and "$1,500" in tx, tx[:900])

    # ── 3 · Lo personal no es costo del rancho en ninguna pantalla ──
    r = A.evaluate("() => JSON.parse(JSON.stringify(window.__agroCuentas()))")
    caso("Finanzas: la despensa marcada como personal ya no es gasto del rancho (costos y gastos 2,500)", r["resultado"]["egresos"] == 2500, r["resultado"]["egresos"])
    sale = sum(m.get("egresos", 0) for m in r["flujo"]["meses"]) if isinstance(r["flujo"].get("meses"), list) else None
    caso("y tampoco sale del flujo de efectivo del rancho", r["flujo"].get("egresos") == 2500, (r["flujo"].get("egresos"), sale))
    caso("ni del cierre del mes", A.evaluate("() => window.__agroCuentas().costo({ mes: '2026-11' }).rancho") == 2500)
    ir(A, "panel-financiero"); tx = cuerpo(A)
    caso("¿Cómo vamos? dice lo mismo: costos y gastos $2,500", "Costos y gastos: $2,500" in tx, tx[:400])

    # ── 4 · El estado de cuenta del banco ──
    def subir(nombre, contenido):
        A.locator("input[type=file]").first.set_input_files({"name": nombre, "mimeType": "text/csv", "buffer": contenido.encode()}); A.wait_for_timeout(900)
    ir(A, "banco"); subir("noviembre.csv", BUENO)
    A.get_by_placeholder("BBVA, Banorte, Bajío, caja popular…").fill("BANCO INVENTADO"); A.get_by_placeholder("Los últimos 4 dígitos bastan").fill("0123456789")
    A.locator(".form-group", has=A.locator("label", has_text="¿De qué bolsa es?")).locator("select").select_option(label="CUENTA DE RODOLFO"); A.wait_for_timeout(300)
    tx = cuerpo(A); foto(A, "03-banco-cuadra")
    caso("un estado de cuenta que cuadra: «Cuadra: el estado se valida solo», con saldo inicial 10,000 y final 13,485 propuestos", "Cuadra: el estado se valida solo" in tx and A.get_by_label("Saldo inicial").input_value() in ("10000", "10000.00") and "3 movimientos" in tx, (tx[:900], A.get_by_label("Saldo inicial").input_value()))
    caso("de la cuenta sólo se guardan los últimos cuatro", "****6789" in tx or "6789" in tx, tx[:900])
    A.get_by_role("button", name="Guardar el estado de cuenta").click(); A.wait_for_timeout(600)
    est = datos(A).get("estados_cuenta") or []
    caso("se guarda, confiable, y el número completo no está en ningún lado", len(est) == 1 and est[0]["confiable"] and "0123456789" not in str(est), [(e.get("cuenta"), e.get("confiable")) for e in est])
    tab(A, "Subir estado"); subir("noviembre.csv", BUENO); A.get_by_placeholder("BBVA, Banorte, Bajío, caja popular…").fill("BANCO INVENTADO"); A.get_by_placeholder("Los últimos 4 dígitos bastan").fill("6789"); A.wait_for_timeout(300)
    tx = cuerpo(A)
    caso("el mismo estado otra vez: «Ya está cargado» y no se deja guardar", "Ya está cargado" in tx and A.get_by_role("button", name="Guardar el estado de cuenta").is_disabled(), tx[:900])
    A.get_by_role("button", name="Descartar").click(); A.wait_for_timeout(300)
    subir("diciembre.csv", MALO); A.get_by_placeholder("BBVA, Banorte, Bajío, caja popular…").fill("BANCO INVENTADO"); A.get_by_placeholder("Los últimos 4 dígitos bastan").fill("6789")
    A.wait_for_timeout(400)
    caso("el archivo nuevo trae su propio periodo y saldos (no los del que se descartó)", A.get_by_placeholder("2026-08").input_value() == "2026-12" and A.get_by_label("Saldo final").input_value() in ("14185", "14185.00"), (A.get_by_placeholder("2026-08").input_value(), A.get_by_label("Saldo final").input_value()))
    A.get_by_label("Saldo inicial").fill("13485"); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "04-banco-no-cuadra")
    caso("uno que no cuadra lo dice y señala el renglón donde se rompe la cadena", "NO CUADRA" in tx and "Ahí se rompe la cadena" in tx, tx[:1100])
    A.get_by_role("button", name="Guardar marcado NO CONFIABLE").click(); A.wait_for_timeout(600)
    est = datos(A).get("estados_cuenta") or []
    caso("guardarlo pide confirmación y queda NO CONFIABLE", any("NO CONFIABLE" in x for x in A.dialogos) and len(est) == 2 and sum(1 for e in est if not e["confiable"]) == 1, [e.get("confiable") for e in est])
    tab(A, "Cargados"); tx = cuerpo(A)
    caso("en la lista: uno «cuadra» y otro «NO CONFIABLE» que no alimenta ningún reporte", "cuadra" in tx and "NO CONFIABLE" in tx and "No alimenta ningún reporte" in tx, tx[:900])

    # ── 5 · Conciliar ──
    tab(A, "Conciliar"); tx = cuerpo(A)
    caso("a conciliar sólo van los tres movimientos del estado confiable", "Conciliar (3)" in tx and "DEPOSITO,," not in tx and "PAGO CFE" in tx, tx[:500])
    A.locator(".card", has_text="PAGO CFE").first.locator("button", has_text="conciliar").first.click(); A.wait_for_timeout(500)
    A.locator(".card", has_text="DEPOSITO CLIENTE INVENTADO").first.locator("button", has_text="conciliar").first.click(); A.wait_for_timeout(500)
    A.locator(".card", has_text="COMISION POR MANEJO").first.get_by_role("button", name="No hay nada capturado: explicarlo con palabras").click(); A.wait_for_timeout(500)
    tx = cuerpo(A); foto(A, "05-conciliado")
    movs = [m for e in datos(A)["estados_cuenta"] if e["confiable"] for m in e["movimientos"]]
    caso("conciliar une cada movimiento con su gasto o ingreso, y la comisión queda explicada con palabras", sorted(str(m.get("conciliadoCon") or m.get("explicacion")) for m in movs) == sorted(["e1", "i1", "COMISION DEL BANCO, NO HAY FACTURA"]), [(m.get("concepto"), m.get("conciliadoCon"), m.get("explicacion")) for m in movs])
    caso("y ninguno se queda sin nombre", "Todos los movimientos ya tienen nombre" in tx, tx[:500])
    caso("el banco es la verdad: ningún movimiento cambió su importe", [(m["cargo"], m["abono"]) for m in movs] == [(0, 5000), (1500, 0), (15, 0)], [(m["cargo"], m["abono"]) for m in movs])
    tab(A, "¿A dónde se fue?"); tx = cuerpo(A); foto(A, "06-a-donde-se-fue")
    caso("¿A dónde se fue cada peso? abre y no tiene movimientos sin explicación", "¿A dónde se fue cada peso?" in tx, tx[:900])

    # ── 6 · ¿Alcanza? con el saldo de cada bolsa ──
    ir(A, "aldia"); tx = cuerpo(A); foto(A, "07-alcanza-no-se")
    caso("¿Alcanza? se llama así (no «Cómo vamos», que es otra pantalla)", "¿Alcanza?" in A.locator(".top-bar h2").first.inner_text(), A.locator(".top-bar h2").first.inner_text())
    caso("con una bolsa sin saldo no contesta «alcanza»: NO SÉ TU SALDO, y dice cuál y de dónde salió el otro", "no sé tu saldo" in tx.lower() and "De TARJETA DE MIGUE no se sabe el saldo" in tx and "CUENTA DE RODOLFO: $13,485 al 2026-11-06, hace 13 día(s)" in tx, tx[:900])
    ir(A, "banco"); subir("tarjeta.csv", "Fecha,Concepto,Cargo,Abono,Saldo\n10/11/2026,PAGO A LA TARJETA,,500.00,2500.00\n12/11/2026,PAPELERIA,500.00,,2000.00\n")
    A.get_by_placeholder("BBVA, Banorte, Bajío, caja popular…").fill("TARJETA"); A.get_by_placeholder("Los últimos 4 dígitos bastan").fill("4321")
    A.locator(".form-group", has=A.locator("label", has_text="¿De qué bolsa es?")).locator("select").select_option(label="TARJETA DE MIGUE"); A.wait_for_timeout(300)
    A.get_by_role("button", name="Guardar el estado de cuenta").click(); A.wait_for_timeout(600)
    ir(A, "aldia"); A.get_by_label("Cuánto 1").fill("10000"); A.get_by_label("Cuánto 2").fill("2000"); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "08-alcanza")
    caso("con las dos bolsas al día: hay $15,485 y se necesitan $12,000 → ALCANZA, sobran $3,485", "| alcanza |" in tx.lower() and "Hay $15,485 y se necesitan $12,000: sobran $3,485" in tx, tx[:700])
    A.get_by_role("button", name="+ Agregar otro").click(); A.wait_for_timeout(200); A.get_by_label("Qué hay que pagar 3").fill("FERTILIZANTE"); A.get_by_label("Cuánto 3").fill("4000"); A.wait_for_timeout(400); tx = cuerpo(A)
    caso("agregar un pago más: $16,000 → FALTA $515, sin decir «no compres»", "| falta |" in tx.lower() and "Hay $15,485 y se necesitan $16,000: faltan $515" in tx and "no compres" not in tx.lower(), tx[:700])

    tab(A, "Dejó de aparecer"); tx = cuerpo(A)
    caso("dejó de aparecer: la captura de gastos lleva 11 días (cada 7), y lo que nunca se ha capturado va aparte", "La captura de gastos" in tx and "11" in tx and "Nunca se ha capturado" in tx and "La asistencia (pase de lista o checador)" in tx, tx[:900])
    tab(A, "Contra el año pasado"); tx = cuerpo(A)
    caso("contra el año pasado: noviembre contra noviembre; sin datos de 2025 no compara contra octubre", "2026-11: $2,500" in tx and "No hay datos de 2025-11 para comparar" in tx and "Gastos capturados" in tx, tx[:900])

    # ── 7 · Sube, recarga y otro teléfono ──
    caso("todo subió a la nube", subio(A))
    B = aparato(ADM); ir(B, "socios"); tx = cuerpo(B)
    caso("en otro teléfono: la misma cuenta entre socios", "Puso de su bolsa $1,500" in tx and "recibió $5,000" in tx, tx[:900])
    ir(B, "banco"); tab(B, "Conciliar"); tx = cuerpo(B)
    caso("y los mismos movimientos conciliados: sólo quedan por nombrar los dos de la tarjeta", "Conciliar (2)" in tx and "PAGO CFE" not in tx and "PAPELERIA" in tx, tx[:700])
    caso("y Finanzas, sin la despensa", B.evaluate("() => window.__agroCuentas().resultado.egresos") == 2500)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
