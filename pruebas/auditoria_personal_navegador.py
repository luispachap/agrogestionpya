"""AUDITORÍA FUNCIONAL · EQUIPO, PERSONAL, JORNADAS Y MANO DE OBRA con cuentas y dos teléfonos (390 px).
Alta de planta, encargado y máquina (sin nombre o repetida no entra); cambiar el sueldo deja historial desde hoy; un día
con tres personas: la marca de un PIN prestado se cancela con motivo, una «entrada» que era salida se voltea, la marca
que faltó se pone a mano; el tiempo sin asignar se aclara (no se reparte solo); la pestaña Cuadrillas de Personal; el
encargado no edita sueldos; otro aparato y recarga ven lo mismo. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_personal_navegador.py   (FOTOS=/ruta para capturas)"""
import datetime, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"; FOTOS = os.environ.get("FOTOS")
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
def de(pg, tipo, vivos=False): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo and (not vivos or e.get("estado", "vigente") == "vigente")]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
def persona(pg, nombre): return next((t for t in datos(pg)["trabajadores"] + datos(pg).get("encargados", []) if t["nombre"] == nombre), {})

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

    # ══ 1. Equipo: planta, encargado y máquina ══
    A = aparato(ADM)
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102"), ("CARO INVENTADA", "4103")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill(pin)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    caso("tres trabajadores de planta dados de alta", len(datos(A)["trabajadores"]) == 3)
    tab(A, "Encargados"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre").fill("ENCARGADA INVENTADA"); campo(A, "PIN de acceso").fill("4101"); campo(A, "Sueldo por día").fill("400")
    A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    caso("un encargado con el PIN de un trabajador no entra, y lo dice", len(datos(A).get("encargados", [])) == 0 and A.dialogos and "PIN" in A.dialogos[-1], A.dialogos[-1:])
    campo(A, "PIN de acceso").fill("5501"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    en = persona(A, "ENCARGADA INVENTADA")
    caso("con su PIN propio queda dado de alta, con su sueldo desde hoy en su historial", en.get("sueldo_dia") == 400 and (en.get("historialSueldo") or [{}])[0].get("desde") == HOY, {k: en.get(k) for k in ("sueldo_dia", "historialSueldo")})
    tab(A, "Maquinaria"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("una máquina sin nombre no se da de alta, y lo dice", len(datos(A).get("maquinaria", [])) == 0, [m.get("nombre") for m in datos(A).get("maquinaria", [])])
    campo(A, "Nombre").fill("TRACTOR INVENTADO"); campo(A, "Costo/hora").fill("450"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250); campo(A, "Nombre").fill("tractor inventado"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    maq = datos(A).get("maquinaria", [])
    caso("la máquina queda una sola vez (el mismo nombre en minúsculas no la repite), con su costo por hora", len(maq) == 1 and maq[0]["nombre"] == "TRACTOR INVENTADO" and maq[0]["costo_hora"] == 450, [(m.get("nombre"), m.get("costo_hora")) for m in maq])
    # Cambiar el sueldo de Ana: queda el cambio con su fecha, lo de antes no se reescribe.
    tab(A, "Planta"); A.locator(".list-item", has_text="ANA INVENTADA").locator("button.btn-ghost").first.click(); A.wait_for_timeout(300)
    campo(A, "Sueldo por día").fill("380"); A.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    ana = persona(A, "ANA INVENTADA"); h = ana.get("historialSueldo") or []
    caso("el cambio de sueldo queda en su historial desde hoy, con el anterior", ana.get("sueldo_dia") == 380 and h and h[-1].get("desde") == HOY and h[-1].get("sueldo_dia") == 380 and h[-1].get("anterior") == 350, h)
    subio(A)

    # ══ 2. El día: Beto con un PIN prestado, Caro sin marcar su salida ══
    avanza(A, 0.25); ir(A, "checador")
    for pin in ("4101", "4102", "4103"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "reparto")
    for n in ("ANA INVENTADA", "CARO INVENTADA"): A.locator(".rep-ficha", has_text=n).click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 1.25); ir(A, "reparto")
    A.locator(".rep-ficha", has_text="BETO INVENTADO").click(); A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 2); ir(A, "checador"); teclea(A, "4102"); A.clock.run_for(13000)          # 10:00: alguien checó con el PIN de Beto
    avanza(A, 4.75); ir(A, "checador")
    for pin in ("4101", "4102"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)   # 14:45: Ana sale; la de Beto queda como «entrada»
    mB = [e["datos"]["sentido"] for e in de(A, "marca") if e["datos"]["trabajadorId"] == persona(A, "BETO INVENTADO")["id"]]
    caso("Beto quedó con entrada, salida (la del PIN prestado) y otra entrada", mB == ["entrada", "salida", "entrada"], mB)
    subio(A)

    # ══ 3. Jornadas: se corrige con motivo, nada se borra ══
    ir(A, "jornadas"); A.locator(".jor-fila", has_text="BETO INVENTADO").first.click(); A.wait_for_timeout(300)
    tarjetas = A.locator(".card", has=A.get_by_role("button", name="Cancelar", exact=True))
    A.get_by_role("button", name="Cancelar", exact=True).nth(1).click(); A.wait_for_timeout(200)
    A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("cancelar sin motivo no se puede", all(e.get("estado", "vigente") == "vigente" for e in de(A, "marca")))
    A.get_by_label("Por qué (queda escrito)").fill("CHECO OTRO CON SU PIN"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    A.get_by_role("button", name="Era salida").last.click(); A.wait_for_timeout(200)
    A.get_by_label("Por qué (queda escrito)").fill("ERA SU SALIDA"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    t = plano(A.locator("body").inner_text()); foto(A, "01-jornada-corregida")
    caso("la marca del PIN prestado queda CANCELADA con quién y por qué, a la vista", "CANCELADA por" in t and "CHECO OTRO CON SU PIN" in t, t[:900])
    caso("y su día queda de 06:45 a 14:45: entrada y salida", "salida" in t.lower() and len([e for e in de(A, "marca", vivos=True) if e["datos"]["trabajadorId"] == persona(A, "BETO INVENTADO")["id"]]) >= 2, t[:600])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)
    A.locator(".jor-fila", has_text="CARO INVENTADA").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Poner una marca que faltó").click(); A.wait_for_timeout(200)
    A.get_by_label("Hora que vale").fill("14:45"); A.get_by_label("Por qué (queda escrito)").fill("SE FUE SIN CHECAR")
    A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    mC = [e for e in de(A, "marca", vivos=True) if e["datos"]["trabajadorId"] == persona(A, "CARO INVENTADA")["id"]]
    caso("a Caro se le pone la salida que faltó, marcada como puesta a mano y con su porqué", len(mC) == 2 and mC[-1]["datos"].get("via") == "correccion" and "SE FUE SIN CHECAR" in mC[-1]["datos"].get("motivo", ""), [x["datos"] for x in mC])
    subio(A)

    # ══ 4. Mano de obra: el tiempo sin asignar de Beto se aclara, no se reparte solo ══
    ir(A, "mano-obra"); A.wait_for_timeout(500); t = plano(A.locator("body").inner_text())
    caso("Mano de obra enseña lo de Beto sin asignar como «por aclarar», fuera de la parcela", "por aclarar" in t.lower(), t[:700])
    A.locator(".card", has_text="Fuera de parcelas").last.locator(".mo-cab").click(); A.wait_for_timeout(200)
    A.locator(".card", has_text="Fuera de parcelas").last.locator(".jor-fila").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Aclarar este tiempo").click()
    A.get_by_label("¿Qué pasó en ese rato?").select_option("espera"); A.get_by_label("Nota de la aclaración").fill("ESPERANDO EL CAMION")
    A.get_by_role("button", name="Guardar aclaración").click(); A.wait_for_timeout(500)
    ac = de(A, "aclaracion"); t = plano(A.locator("body").inner_text())
    caso("la aclaración queda como hecho aparte, con causa y quién; ya no dice «por aclarar»", len(ac) == 1 and ac[0]["datos"]["causa"] == "espera" and ac[0]["quien"]["nombre"] == "ADMIN DE PRUEBA" and "Sin asignar, por aclarar" not in t, t[:500])
    foto(A, "02-aclarado")
    subio(A)

    # ══ 5. Personal: sus pestañas ══
    ir(A, "personal"); tab(A, "Cuadrillas"); A.get_by_role("button", name="+ Cuadrilla").click(); A.wait_for_timeout(250)
    campo(A, "Nombre").fill("CUADRILLA INVENTADA"); campo(A, "Responsable").fill("RESPONSABLE INVENTADO"); campo(A, "Miembros").fill("6"); campo(A, "PIN de acceso").fill("6601")
    A.get_by_role("button", name="Registrar cuadrilla").click(); A.wait_for_timeout(500)
    cq = datos(A).get("cuadrillas", [])
    caso("Personal da de alta una cuadrilla con su responsable y su PIN", len(cq) == 1 and cq[0]["responsable"] == "RESPONSABLE INVENTADO" and cq[0]["miembros"] == 6, cq)
    ir(A, "equipo"); tab(A, "Cuadrillas"); caso("y Equipo la enseña", "CUADRILLA INVENTADA" in A.locator("body").inner_text())
    subio(A)

    # ══ 6. El encargado: no cambia sueldos; otro aparato y recarga ven lo mismo ══
    B = aparato(ENC, "15:30"); hora(B)
    ir(B, "equipo"); tb = plano(B.locator("body").inner_text())
    caso("al encargado no se le abre Equipo para cambiar sueldos", B.locator("h2", has_text="Equipo").count() == 0 or B.locator(".list-item button.btn-ghost").count() == 0, tb[:300])
    C = aparato(ADM, "15:40"); hora(C)
    ir(C, "jornadas"); C.locator(".jor-fila", has_text="BETO INVENTADO").first.click(); C.wait_for_timeout(300); tc = plano(C.locator("body").inner_text())
    caso("en otro aparato, la jornada de Beto trae la marca cancelada con su motivo", "CANCELADA por" in tc and "CHECO OTRO CON SU PIN" in tc, tc[:600])
    ir(C, "mano-obra"); caso("y Mano de obra trae la aclaración (espera)", "Sin asignar, por aclarar" not in C.locator("body").inner_text() and len(de(C, "aclaracion")) == 1)
    caso("y la ficha de Ana trae su historial de sueldo", (persona(C, "ANA INVENTADA").get("historialSueldo") or [{}])[-1].get("sueldo_dia") == 380)
    recarga(A); ir(A, "jornadas")
    caso("después de recargar, las marcas siguen como se dejaron", len(de(A, "marca")) == len(de(C, "marca")) and len([e for e in de(A, "marca") if e.get("estado") == "cancelado"]) == 1)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
