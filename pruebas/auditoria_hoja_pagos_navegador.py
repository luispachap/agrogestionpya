"""AUDITORÍA FUNCIONAL · LA HOJA DE PAGOS QUE SE FIRMA, con cuentas y dos teléfonos (390 px).
Sale de la lista de nómina en papel del rancho (22 nov): sueldo, lo dispersado, el abono al préstamo, el efectivo, el
préstamo nuevo y lo que queda debiendo, con firma. Aquí: lo que ya se debía al arrancar (con fecha de corte, quién
responde y evidencia; se corrige con motivo y no se encima), el abono acordado que sólo se SUGIERE, el pago en dos partes
(transferencia + efectivo), prestar en un paso (quedan los tres hechos), la hoja para firmar, el encargado sin esas
puertas, recarga, aparato nuevo y un préstamo hecho sin señal. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_hoja_pagos_navegador.py   (FOTOS=/ruta para capturas)"""
import datetime, io, os, pathlib, random, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-21"; FOTOS = os.environ.get("FOTOS")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}
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
CUENTAS = "() => { const f = window.__agroCuentas().flujo; return JSON.parse(JSON.stringify({ entra: f.ingresos, sale: f.egresos })); }"
def de(pg, tipo, vivos=True): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo and (not vivos or e.get("estado", "vigente") == "vigente")]
def prestamos(pg, nombre=None):
    ids = {t["id"] for t in datos(pg)["trabajadores"] if not nombre or t["nombre"] == nombre}
    return [x for x in datos(pg)["prestamos"] if x["trabajadorId"] in ids]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)
tarjeta = lambda pg, nombre: pg.locator(".card", has=pg.locator(".font-bold", has_text=nombre)).last
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
def hoja_jpg():
    from PIL import Image
    random.seed(7); im = Image.frombytes("RGB", (500, 380), bytes(random.randrange(256) for _ in range(500 * 380 * 3))); b = io.BytesIO(); im.save(b, "jpeg"); return b.getvalue()

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

    # ══ 1. Dos trabajadores con un día trabajado (sueldo de la semana ÷ 6) ══
    A = aparato(ADM)
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("583.33"); campo(A, "PIN de acceso").fill(pin)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    # Carlos cobra por semana: $3,500 entre los 6 días de lunes a sábado (Luis, 22 nov).
    A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre completo").fill("CARLOS INVENTADO"); A.get_by_label("Sueldo por semana (si cobra por semana)").fill("3500"); A.wait_for_timeout(150)
    caso("al escribir el sueldo de la semana, el de por día sale solo ($583.33) y dice que la semana suma exacto", campo(A, "Sueldo/día").input_value() == "583.33" and "La semana completa suma exacto $3,500" in A.locator("body").inner_text(), campo(A, "Sueldo/día").input_value())
    campo(A, "PIN de acceso").fill("4103"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    ca = next((t for t in datos(A)["trabajadores"] if t["nombre"] == "CARLOS INVENTADO"), {})
    caso("su ficha guarda la semana, el promedio y su historial desde hoy", ca.get("sueldo_semana") == 3500 and ca.get("sueldo_dia") == 583.33 and (ca.get("historialSueldo") or [{}])[0].get("sueldo_semana") == 3500, {k: ca.get(k) for k in ("sueldo_semana", "sueldo_dia", "historialSueldo")})
    caso("y la lista lo enseña: $3,500/semana · $583.33/día", "$3,500/semana · $583.33/día" in A.locator("body").inner_text())
    avanza(A, 0.5); ir(A, "checador")
    for pin in ("4101", "4102", "4103"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "reparto")
    for n in ("ANA INVENTADA", "BETO INVENTADO", "CARLOS INVENTADO"): A.locator(".rep-ficha", has_text=n).click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 8); ir(A, "checador")
    for pin in ("4101", "4102", "4103"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "nomina"); A.wait_for_timeout(600); t = plano(A.locator("body").inner_text())
    caso("a cada quien le corresponde su día ($583.33)", t.count("Pendiente | $583.33") == 2, t[150:700])
    caso("a Carlos, que cobra por semana, el sábado le toca $583.35: el centavo que sobra de la semana va al último día", "Pendiente | $583.35" in plano(tarjeta(A, "CARLOS INVENTADO").inner_text()), plano(tarjeta(A, "CARLOS INVENTADO").inner_text())[:300])
    subio(A)

    # ══ 2. Lo que Ana ya debía al arrancar la app ══
    ir(A, "personal"); tab(A, "Préstamos"); A.get_by_role("button", name="Lo que ya debían").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Guardar lo que debía").click(); A.wait_for_timeout(300)
    caso("sin decir de quién es la deuda no se guarda, y lo dice", len(de(A, "prestamo_saldo_inicial")) == 0 and "Falta de quién es la deuda" in A.locator("body").inner_text())
    campo(A, "Trabajador").select_option(label="ANA INVENTADA"); campo(A, "Cuánto debía al corte").fill("1900"); campo(A, "Fecha de corte").fill("2026-11-14")
    campo(A, "Abono acordado por semana").fill("300")
    caso("quién responde viene con el nombre de quien captura (y se puede cambiar)", campo(A, "Quién responde").input_value() == "ADMIN DE PRUEBA", campo(A, "Quién responde").input_value())
    A.locator("#ant-e").set_input_files({"name": "hoja-firmada.jpg", "mimeType": "image/jpeg", "buffer": hoja_jpg()}); A.wait_for_timeout(500)
    A.get_by_role("button", name="Guardar lo que debía").click(); A.wait_for_timeout(1500)
    si = de(A, "prestamo_saldo_inicial"); pr = prestamos(A, "ANA INVENTADA"); t = plano(tarjeta(A, "ANA INVENTADA").inner_text()) if pr else ""
    caso("queda como deuda de antes de la app, sellada por la base: $1,900 al 14 de noviembre", len(si) == 1 and si[0].get("_validacion") == "autorizado" and len(pr) == 1 and pr[0]["monto"] == 1900 and pr[0].get("deAntes") and pr[0]["estado"] == "activo", [x.get("_validacion") for x in si])
    caso("la tarjeta lo dice: debía $1,900 al 2026-11-14, quién responde, abono acordado y la evidencia", "Debía $1,900 al 2026-11-14, antes de la app" in t and "responde ADMIN DE PRUEBA" in t and "Abono acordado: $300 por semana" in t and "Sin evidencia" not in t, t[:500])
    caso("la foto de la hoja no viaja dentro del registro", str(si[0]["datos"].get("evidencia", "")).startswith("archivo:") if si else False, str(si[0]["datos"].get("evidencia"))[:30] if si else "")
    c = A.evaluate(CUENTAS); caso("no es dinero que sale: salió antes de la app", c["sale"] == 0 and c["entra"] == 0, c)
    A.get_by_role("button", name="Lo que ya debían").click(); A.wait_for_timeout(300)
    campo(A, "Trabajador").select_option(label="ANA INVENTADA"); campo(A, "Cuánto debía al corte").fill("500"); A.get_by_role("button", name="Guardar lo que debía").click(); A.wait_for_timeout(500)
    caso("no se le encima otra cifra: dice que ya tiene una y que se corrige ésa", len(de(A, "prestamo_saldo_inicial")) == 1 and "ya tiene anotado" in A.locator("body").inner_text())
    A.locator(".top-bar").get_by_role("button", name="✕").click(); A.wait_for_timeout(300)
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Corregir la cifra").click(); A.wait_for_timeout(200)
    A.get_by_label("Cifra correcta de lo que debía").fill("2000"); A.get_by_role("button", name="Guardar la corrección").click(); A.wait_for_timeout(300)
    caso("sin motivo no se corrige", de(A, "prestamo_saldo_inicial")[0]["datos"]["monto"] == 1900)
    A.get_by_label("Por qué se corrige").fill("EN LA HOJA DECIA 2000"); A.get_by_role("button", name="Guardar la corrección").click(); A.wait_for_timeout(1500)
    si = de(A, "prestamo_saldo_inicial"); todos = de(A, "prestamo_saldo_inicial", vivos=False); pr = prestamos(A, "ANA INVENTADA")
    caso("corregida: un solo préstamo de $2,000, y la cifra anterior se queda como corregida", len(si) == 1 and si[0]["datos"]["monto"] == 2000 and len(todos) == 2 and len(pr) == 1 and pr[0]["monto"] == 2000, [(e.get("estado"), e["datos"]["monto"]) for e in todos])
    foto(A, "01-lo-que-ya-debia")
    subio(A)

    # ══ 3. Pagos al personal: el abono acordado se SUGIERE, el pago en dos partes ══
    ir(A, "nomina"); A.wait_for_timeout(500); t = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("la tarjeta de Ana enseña lo que debe y el abono acordado, sin descontarlo solo", "Debe $2,000 de préstamo" in t and "Abono acordado: $300 por semana" in t and "Neto a pagar | $583.33" in t and len(de(A, "abono_prestamo")) == 0, t[:600])
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Usarlo").click(); A.wait_for_timeout(200)
    caso("«Usarlo» sólo llena el descuento: todavía no abona", tarjeta(A, "ANA INVENTADA").get_by_placeholder("Descuento").input_value() == "300" and len(de(A, "abono_prestamo")) == 0)
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Abonar a préstamo").click(); A.wait_for_timeout(1500)
    ab = de(A, "abono_prestamo"); t = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("el abono de $300 queda en esa semana, sellado, y el neto baja a $283.33", len(ab) == 1 and ab[0].get("_validacion") == "autorizado" and ab[0]["datos"].get("semana") and "Neto a pagar | $283.33" in t, t[:500])
    tarjeta(A, "ANA INVENTADA").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(400)
    caso("el pago viene con lo pendiente ($283.33)", A.get_by_label("Cuánto se entregó ($)").input_value() == "283.33", A.get_by_label("Cuánto se entregó ($)").input_value())
    A.get_by_label("Otra parte ($)").fill("200"); A.wait_for_timeout(150)
    caso("al escribir lo dispersado, lo demás se ajusta solo a lo que falta ($83.33)", A.get_by_label("Cuánto se entregó ($)").input_value() == "83.33" and A.get_by_label("Medio de la otra parte").input_value() == "transferencia", A.get_by_label("Cuánto se entregó ($)").input_value())
    A.locator("input[aria-label='Comprobante del pago']").set_input_files({"name": "firma.jpg", "mimeType": "image/jpeg", "buffer": hoja_jpg()}); A.wait_for_timeout(400)
    foto(A, "02-pago-en-dos-partes")
    A.locator(".modal-sheet").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1800)
    pgs = de(A, "pago_personal"); t = plano(tarjeta(A, "ANA INVENTADA").inner_text())
    caso("quedan DOS pagos, cada uno con su medio: $200 por transferencia y $83.33 en efectivo", sorted((e["datos"]["medio"], e["datos"]["monto"]) for e in pgs) == [("efectivo", 83.33), ("transferencia", 200)] and all(e.get("_validacion") == "autorizado" for e in pgs), [(e["datos"]["medio"], e["datos"]["monto"]) for e in pgs])
    caso("y a Ana ya no se le debe nada de la semana", "Pendiente | $0" in t, t[:500])

    # ══ 4. Prestarle a Beto en un paso ══
    caso("a quien tiene los dos permisos se le ofrece «Prestarle»", tarjeta(A, "BETO INVENTADO").get_by_role("button", name="Prestarle").count() == 1)
    tarjeta(A, "BETO INVENTADO").get_by_role("button", name="Prestarle").click(); A.wait_for_timeout(250)
    A.get_by_role("button", name="Guardar el préstamo").click(); A.wait_for_timeout(300)
    caso("sin cuánto no se presta, y lo dice", len(de(A, "prestamo_solicitud")) == 0 and "Falta" in tarjeta(A, "BETO INVENTADO").inner_text())
    tarjeta(A, "BETO INVENTADO").get_by_label("Cuánto ($)").fill("1500"); tarjeta(A, "BETO INVENTADO").get_by_label("En cuántas semanas").fill("2"); tarjeta(A, "BETO INVENTADO").get_by_label("Para qué").fill("UN PENDIENTE INVENTADO")
    caso("antes de guardar dice el abono que se acuerda ($750 por semana)", "Abono acordado: $750 por semana" in tarjeta(A, "BETO INVENTADO").inner_text())
    A.get_by_role("button", name="Guardar el préstamo").click(); A.wait_for_timeout(1800)
    sol, aut, ent = de(A, "prestamo_solicitud"), de(A, "prestamo_autorizacion"), de(A, "prestamo_entrega"); prB = prestamos(A, "BETO INVENTADO"); t = plano(tarjeta(A, "BETO INVENTADO").inner_text())
    caso("quedan los TRES hechos (pedido, autorizado, entregado) a nombre de quien prestó, sellados por la base", len(sol) == 1 and len(aut) == 1 and len(ent) == 1 and aut[0].get("_validacion") == "autorizado" and ent[0].get("_validacion") == "autorizado" and aut[0]["quien"]["nombre"] == "ADMIN DE PRUEBA", [len(sol), len(aut), len(ent)])
    caso("Beto debe $1,500, con abono acordado de $750", len(prB) == 1 and prB[0]["monto"] == 1500 and prB[0]["estado"] == "activo" and prB[0]["autorizacion"]["abonoSemanal"] == 750, [(x.get("monto"), x.get("estado")) for x in prB])
    caso("su tarjeta dice el préstamo nuevo y le sigue correspondiendo su día completo", "Préstamo nuevo esta semana: $1,500 en efectivo · se paga en 2 semanas" in t and "Pendiente | $583.33" in t, t[:600])
    tarjeta(A, "BETO INVENTADO").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(400)
    A.locator(".modal-sheet").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1800)
    c = A.evaluate(CUENTAS)
    caso("salió el dinero una vez cada cosa: $283.33 + $1,500 + $583.33; el abono descontado no es dinero que entra", round(c["sale"], 2) == 2366.66 and c["entra"] == 0, c)
    subio(A)

    # ══ 5. La hoja para firmar ══
    A.get_by_role("button", name="Hoja para firmar").click(); A.wait_for_timeout(600)
    h = plano(A.locator(".printable").inner_text())
    fila = lambda nombre: plano(A.locator(".printable tr", has_text=nombre).first.inner_text())
    fa, fb = fila("ANA INVENTADA"), fila("BETO INVENTADO")
    caso("encabezados como la lista en papel: corresponde, abono, transferencia, efectivo, préstamo nuevo, le queda debiendo, firma", all(x in h for x in ("Le corresponde", "Abono a préstamo", "Transferencia", "Efectivo", "Préstamo nuevo", "Le queda debiendo", "Firma")), h[:300])
    caso("Ana: $583.33, − $300, $200 transferencia, $83.33 efectivo, sin préstamo nuevo, le quedan $1,700", all(x in fa for x in ("$583.33", "− $300", "$200", "$83.33", "$1,700")), fa)
    caso("Beto: $583.33 en efectivo, préstamo nuevo $1,500 a $750 por semana, le quedan $1,500", all(x in fb for x in ("$583.33", "$1,500 · $750/sem")) and fb.count("$1,500") >= 2, fb)
    fc = fila("CARLOS INVENTADO")
    caso("a Carlos no se le ha pagado: sale la columna «Falta por entregar» y su renglón dice $583.35", "Falta por entregar" in h and fc.rstrip().endswith("$583.35") and "Registra los pagos antes de imprimir" in A.locator("body").inner_text(), fc)
    caso("a Ana y a Beto no les falta nada", fa.count("—") >= 1 and "$583.33" in fb, [fa, fb])
    caso("dice que es control interno y que no sustituye el recibo de nómina timbrado", "no sustituye el recibo de nómina timbrado (CFDI)" in h)
    foto(A, "03-hoja-para-firmar")
    A.get_by_role("button", name="Volver").click(); A.wait_for_timeout(300)

    # ══ 6. El encargado no tiene esas puertas ══
    B = aparato(ENC, "15:10"); hora(B)
    ir(B, "personal"); tab(B, "Préstamos")
    caso("al encargado no se le ofrece anotar lo que ya debían", B.get_by_role("button", name="Lo que ya debían").count() == 0)
    ir(B, "nomina"); B.wait_for_timeout(500)
    caso("ni prestar en un paso", B.get_by_role("button", name="Prestarle").count() == 0)

    # ══ 7. Recargar y un aparato nuevo ven lo mismo ══
    def hoja_de(pg):
        ir(pg, "nomina"); pg.wait_for_timeout(500); pg.get_by_role("button", name="Hoja para firmar").click(); pg.wait_for_timeout(600)
        r = [plano(pg.locator(".printable tr", has_text=n).first.inner_text()) for n in ("ANA INVENTADA", "BETO INVENTADO")]
        pg.get_by_role("button", name="Volver").click(); pg.wait_for_timeout(300); return r
    antes = [fa, fb]
    recarga(A); caso("después de recargar, la hoja dice lo mismo", hoja_de(A) == antes, hoja_de(A))
    C = aparato(ADM, "16:00"); hora(C)
    caso("en un aparato nuevo, la misma hoja", hoja_de(C) == antes, hoja_de(C))

    # ══ 8. Un préstamo hecho sin señal: no cuenta hasta que la base lo valida, y luego sí ══
    nube.caida = True
    ir(C, "nomina"); C.wait_for_timeout(400)
    tarjeta(C, "ANA INVENTADA").get_by_role("button", name="Prestarle").click(); C.wait_for_timeout(250)
    tarjeta(C, "ANA INVENTADA").get_by_label("Cuánto ($)").fill("500"); tarjeta(C, "ANA INVENTADA").get_by_label("Para qué").fill("OTRO INVENTADO")
    C.get_by_role("button", name="Guardar el préstamo").click(); C.wait_for_timeout(800)
    caso("sin señal queda en la cola y todavía no es deuda (falta que la base la valide)", C.evaluate(COLA) >= 3 and all(x["monto"] != 500 or x["estado"] != "activo" for x in prestamos(C, "ANA INVENTADA")), [(x.get("monto"), x.get("estado")) for x in prestamos(C, "ANA INVENTADA")])
    nube.caida = False; avanza(C, 2 / 60)
    caso("vuelve la señal y sube solo", subio(C, 60))
    recarga(C); prA = sorted((x["monto"], x["estado"]) for x in prestamos(C, "ANA INVENTADA"))
    caso("ya validado, Ana debe además $500", prA == [(500, "activo"), (2000, "activo")], prA)
    recarga(A); fa2 = hoja_de(A)[0]
    caso("y en el otro teléfono su renglón trae el préstamo nuevo y le quedan $2,200", "$500" in fa2 and "$2,200" in fa2, fa2)

    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
