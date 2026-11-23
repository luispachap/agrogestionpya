"""AUDITORÍA FUNCIONAL · CONTROL: Seguridad (PINs de dirección y la orden de recarga), Subir catálogos (sólo altas, sin
contraseñas ni PIN) y Arranque (conteo y saldo inicial, y lo que se ve de ellos en el almacén y en ¿Alcanza?). Con cuentas,
390 px, nube de imitación, dos teléfonos, sin señal y recarga.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_control_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import hashlib, json, os, pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
import openpyxl
URL = "http://localhost:5174/"; HOY = "2026-11-19"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}}
t["inventario"] = {"i-urea": {"id": "i-urea", "nombre": "UREA INVENTADA", "cat": "fertilizante", "unidad": "bulto", "existencia": 0, "costo_unit": 500, "minimo": 0, "datos": {"emoji": "📦", **E}, "actualizado": V}}
t["bolsas"] = {"b-caja": {"id": "b-caja", "datos": {"nombre": "CAJA DEL RANCHO", "tipo": "efectivo", "titularId": "x", **E}, "actualizado": V}}
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
# La plantilla VIEJA, como la tendría alguien: con la hoja Cuentas (contraseñas) y la columna PIN.
d = pathlib.Path(tempfile.mkdtemp()); xlsx = d / "catalogos.xlsx"
wb = openpyxl.Workbook(); wb.remove(wb.active)
for nombre, filas in {"Cuentas": [["Nombre", "Correo", "Contraseña inicial", "Rol"], ["PEPE INVENTADO", "pepe@prueba.invalid", "ClaveSecreta123!", "admin"]],
                      "Trabajadores": [["Nombre", "PIN", "Sueldo diario", "Categoría", "Teléfono", "Notas"], ["ANA INVENTADA", "9999", 999, "General", "", ""], ["BETO NUEVO", "4101", 380, "General", "", ""], ["CARO NUEVA", "5151", 420, "Tractorista", "", ""]],
                      "Parcelas": [["Nombre", "Ubicación", "Hectáreas", "Cultivo actual", "Emoji", "Notas"], ["PARCELA DE LA HOJA", "PH1", 4.5, "Ajo", "🌾", ""]],
                      "Proveedores": [["Nombre"], ["PROVEEDOR DE LA HOJA"]]}.items():
    ws = wb.create_sheet(nombre)
    for f in filas: ws.append(f)
wb.save(xlsx)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta, pin=None):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda dd: (pg.dialogos.append(dd.message), dd.accept()))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        if pin: pg.get_by_placeholder("Tu correo o tu PIN").fill(pin)
        else: pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
        pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)

    # ── 1 · Seguridad: los PINs de dirección ──
    ir(A, "seguridad"); campos = A.get_by_placeholder("Nuevo PIN (6 a 10 dígitos)")
    def poner(i, v): campos.nth(i).fill(v)
    guardar = lambda: (A.get_by_role("button", name="Guardar PINs nuevos").click(), A.wait_for_timeout(600))
    poner(1, "1234"); guardar(); tx = cuerpo(A)
    caso("un PIN de menos de 6 dígitos no se guarda", "de 6 a 10 dígitos" in tx and not (datos(A).get("config_seguridad") or []), tx[:400])
    poner(1, "246810"); poner(2, "246810"); guardar(); tx = cuerpo(A)
    caso("el mismo PIN a dos perfiles no se guarda (con un PIN repetido no entraría ninguno)", "mismo PIN a dos perfiles" in tx and not (datos(A).get("config_seguridad") or []), tx[:400])
    campos.nth(2).fill("")
    # un PIN de seis dígitos que ya usa alguien del personal
    t["trabajadores"]["t-ana"]["pin"] = "410141"; t["trabajadores"]["t-ana"]["actualizado"] = "2026-11-20T00:00:00Z"; A.reload(); A.wait_for_timeout(3500); ir(A, "seguridad"); campos = A.get_by_placeholder("Nuevo PIN (6 a 10 dígitos)")
    poner(1, "410141"); guardar(); tx = cuerpo(A)
    caso("un PIN que ya usa alguien del personal no se guarda", "ya lo usa alguien del personal" in tx and not (datos(A).get("config_seguridad") or []), tx[:400])
    poner(1, "246810"); guardar(); tx = cuerpo(A); foto(A, "01-seguridad")
    cfg = (datos(A).get("config_seguridad") or [{}])[0]
    caso("el PIN de Dirección se guarda cifrado: ni en el teléfono ni en la nube aparece el número", bool(cfg.get("pin_dueno")) and "246810" not in json.dumps(datos(A).get("config_seguridad")) and "246810" not in json.dumps(nube.t.get("config_seguridad", {})), cfg)
    caso("y la pantalla dice que Dirección ya tiene PIN propio", "pin propio configurado" in tx.lower(), tx[:600])
    caso("subió", subio(A))
    # El PIN de dirección sólo sirve donde ya se entró con una cuenta (ahí quedó cifrado): sin sesión, la base no deja leerlo.
    A.evaluate("() => window.__agroIr('home')"); A.wait_for_timeout(300); A.get_by_role("button", name="Salir").first.click(); A.wait_for_timeout(1500)
    A.get_by_placeholder("Tu correo o tu PIN").fill("246810"); A.get_by_role("button", name="Entrar").click(); A.wait_for_timeout(2500)
    caso("en el mismo teléfono, al salir, con ese PIN se entra como Dirección", A.locator(".login-bg").count() == 0 and "Dirección" in cuerpo(A), cuerpo(A)[:300])
    A.get_by_role("button", name="Salir").first.click(); A.wait_for_timeout(1500)
    A.get_by_placeholder("Tu correo o tu PIN").fill("135790"); A.get_by_role("button", name="Entrar").click(); A.wait_for_timeout(2000)
    caso("y con otro PIN no", A.locator(".login-bg").count() == 1 and "PIN incorrecto" in cuerpo(A), cuerpo(A)[:300])
    D = aparato(None, pin="246810"); tx = cuerpo(D)
    caso("en un teléfono nuevo el PIN no abre (la base no le da los PINs a nadie sin sesión): pide correo y contraseña", D.locator(".login-bg").count() == 1 and "entra con tu correo y tu contraseña" in tx, tx[:300])
    D.context.close()
    A.get_by_placeholder("Tu correo o tu PIN").fill(ADM["correo"]); A.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); A.get_by_role("button", name="Entrar").click(); A.wait_for_timeout(3500)

    # ── 2 · La orden de recarga no borra lo que un teléfono no ha subido ──
    campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
    B = aparato(ADM)
    # B se queda sin poder SUBIR (puede leer): así recibe la orden con un gasto todavía sin subir.
    def soloLeer(route):
        r = route.request
        if r.method in ("POST", "PATCH", "PUT", "DELETE") and "/rpc/" not in r.url and "/auth/" not in r.url: return route.abort()
        return nube(route)
    B.context.unroute(N.NUBE + "/**"); B.context.route(N.NUBE + "/**", soloLeer)
    ir(B, "contabilidad"); B.get_by_role("button", name="+ Movimiento").click(); B.wait_for_timeout(200); B.locator(".option-card", has_text="Registrar Egreso").click(); B.wait_for_timeout(300)
    campo(B, "Concepto").fill("GASTO CAPTURADO SIN SEÑAL"); campo(B, "Monto").fill("750"); B.locator("button.btn-accent", has_text="Guardar").last.click(); B.wait_for_timeout(1500)
    caso("sin poder subir, el gasto queda en el teléfono esperando", B.evaluate(COLA) > 0 and any(e["concepto"] == "GASTO CAPTURADO SIN SEÑAL" for e in datos(B)["egresos"]))
    ir(A, "seguridad"); A.get_by_role("button", name="Mandar orden de recarga a todos").click(); A.wait_for_timeout(600)
    caso("la orden de recarga sale (y avisa que un aparato con registros sin subir espera)", any("espera a subirlos" in x for x in A.dialogos[-1:]) and subio(A), A.dialogos[-1:])
    B.reload(); B.wait_for_timeout(5000)
    caso("el teléfono recibe la orden y NO borra el gasto que no ha subido", B.evaluate(COLA) > 0 and any(e["concepto"] == "GASTO CAPTURADO SIN SEÑAL" for e in datos(B)["egresos"]), B.evaluate(COLA))
    B.context.unroute(N.NUBE + "/**"); B.context.route(N.NUBE + "/**", nube)
    caso("al poder subir, el gasto sube", subio(B, 60) and any((r.get("datos") or {}).get("concepto") == "GASTO CAPTURADO SIN SEÑAL" for r in nube.t.get("egresos", {}).values()))
    B.reload(); B.wait_for_timeout(5000)
    caso("y ya con todo arriba, la recarga trae lo de la nube: el gasto sigue ahí, una sola vez", [e["concepto"] for e in datos(B)["egresos"]].count("GASTO CAPTURADO SIN SEÑAL") == 1, [e["concepto"] for e in datos(B)["egresos"]])
    B.context.close()

    # ── 3 · Subir catálogos: la plantilla vieja con contraseñas y PIN ──
    ir(A, "subir-nube"); A.locator("input[type=file]").first.set_input_files(str(xlsx)); A.wait_for_timeout(1200); tx = cuerpo(A); foto(A, "02-catalogos-revision")
    caso("la hoja «Cuentas» de una plantilla vieja no se lee: se avisa que las cuentas se invitan en Arranque", "La hoja «Cuentas» no se usa" in tx and "pepe@prueba.invalid" not in tx and "Copiar código SQL" not in tx, tx[:1200])
    caso("y se avisa que el personal entra sin PIN (se pone en Equipo)", "entran sin PIN" in tx, tx[:1200])
    A.get_by_role("button", name="Subir catálogos →").click(); A.wait_for_timeout(1500); tx = cuerpo(A)
    tr = {x["nombre"]: x for x in datos(A)["trabajadores"]}
    caso("sólo se dan de alta los que faltan: BETO y CARO nuevos, ANA ya estaba y no se tocó (su sueldo sigue en $400)", set(tr) == {"ANA INVENTADA", "BETO NUEVO", "CARO NUEVA"} and tr["ANA INVENTADA"].get("sueldo_dia") == 400, {k: v.get("sueldo_dia") for k, v in tr.items()})
    caso("nadie entra con un PIN de la hoja: los nuevos no traen PIN, y el 4101 repetido no se le pone a nadie", not tr["BETO NUEVO"].get("pin") and not tr["CARO NUEVA"].get("pin"), {k: v.get("pin") for k, v in tr.items()})
    caso("el sueldo de los nuevos vale desde hoy (con su historial)", (tr["CARO NUEVA"].get("historialSueldo") or [{}])[0].get("desde") == HOY, tr["CARO NUEVA"].get("historialSueldo"))
    pa = [x for x in datos(A)["parcelas"] if x["nombre"] == "PARCELA DE LA HOJA"]
    caso("la parcela de la hoja queda en el único rancho que hay, con un identificador nuevo", len(pa) == 1 and pa[0].get("ranchoId") == "r1" and pa[0]["id"] != "p_ph1", pa)
    caso("y el proveedor", any(x["nombre"] == "PROVEEDOR DE LA HOJA" for x in datos(A).get("proveedores") or []))
    caso("la contraseña de la hoja no está en ningún lado: ni en el teléfono ni en la nube", "ClaveSecreta123" not in A.evaluate("() => JSON.stringify(localStorage)") and "ClaveSecreta123" not in json.dumps(nube.t) and "ClaveSecreta123" not in json.dumps(nube.subidas, default=str), "")
    caso("todo subió", subio(A))
    caso("lo que subió lleva quién lo capturó y la marca de este espacio", all((r.get("datos") or {}).get("_espacio") == "localhost" for r in list(nube.t["trabajadores"].values()) + list(nube.t["parcelas"].values())), "")
    A.get_by_role("button", name="Cerrar").click(); A.wait_for_timeout(300)
    ir(A, "subir-nube"); A.locator("input[type=file]").first.set_input_files(str(xlsx)); A.wait_for_timeout(1200)
    A.get_by_role("button", name="Subir catálogos →").click(); A.wait_for_timeout(1500); tx = cuerpo(A)
    caso("subir el mismo archivo otra vez no duplica nada", len(datos(A)["trabajadores"]) == 3 and len([x for x in datos(A)["parcelas"] if x["nombre"] == "PARCELA DE LA HOJA"]) == 1 and "ya estaba" in tx, tx[:800])

    # ── 4 · Arranque: conteo y saldo inicial, y dónde se ven ──
    ir(A, "arranque"); tab(A, "Conteo")
    A.get_by_placeholder("Ej: Bodega del rancho").fill("BODEGA DEL RANCHO")
    A.get_by_label("Contado de UREA INVENTADA").fill("40"); A.get_by_role("button", name="Registrar conteo").click(); A.wait_for_timeout(800)
    caso("el conteo inicial deja la urea en 40 en el almacén", next(i for i in datos(A)["inventario"] if i["id"] == "i-urea")["existencia"] == 40, next(i for i in datos(A)["inventario"] if i["id"] == "i-urea").get("existencia"))
    tab(A, "Saldos"); A.get_by_label("Cuenta o caja").select_option(label="CAJA DEL RANCHO")
    A.locator(".form-group", has=A.locator("label", has_text="Fecha de corte")).locator("input").fill("2026-11-15")
    A.locator(".form-group", has=A.locator("label", has_text="Saldo a esa fecha")).locator("input").fill("8000")
    A.get_by_role("button", name="Guardar saldo inicial").click(); A.wait_for_timeout(800); tx = cuerpo(A); foto(A, "03-saldo-inicial")
    caso("el saldo inicial queda con su corte y dice que no trae evidencia (se pidió confirmar)", "CAJA DEL RANCHO: $8,000 al 2026-11-15" in tx and "SIN evidencia" in tx and any("evidencia" in x.lower() for x in A.dialogos[-2:]), tx[:900])
    ir(A, "aldia"); tx = cuerpo(A)
    caso("¿Alcanza? usa ese saldo con su fecha de corte", "CAJA DEL RANCHO: $8,000 al 2026-11-15, hace 4 día(s)" in tx, tx[:700])
    caso("subió", subio(A))
    C = aparato(ADM); d2 = C.evaluate("() => ({ ex: window.__agroDatos.inventario.find(i => i.id === 'i-urea').existencia, s: (window.__agroDatos.bolsas.find(b => b.id === 'b-caja').saldoInicial || {}).monto, t: window.__agroDatos.trabajadores.length })")
    caso("en otro teléfono: la urea en 40, la caja con $8,000 y los tres trabajadores", d2 == {"ex": 40, "s": 8000, "t": 3}, d2)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
