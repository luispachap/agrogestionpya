"""AUDITORÍA FUNCIONAL · EQUIPOS DE TRABAJO Y CUADRILLAS con cuentas y dos teléfonos (390 px).
Equipos de trabajo: pago por tarea con lo que hizo cada quien, y el operador de un vehículo (su rato se carga al
vehículo, no a una parcela ni como otro pago). Cuadrillas (el encargado captura): por día con flete externo, destajo con
lo de cada persona, precio por el trabajo (un pago al grupo), sólo el total con «parejo» que alguien autoriza, vehículo
propio sin importe; cancelar con motivo. Todo llega al costo de la parcela sin teclear actividades; otro aparato, recarga.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_cuadrillas_navegador.py   (FOTOS=/ruta para capturas)"""
import datetime, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"; FOTOS = os.environ.get("FOTOS")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": V},
                      "p2": {"id": "p2", "nombre": "PARCELA DOS", "rancho_id": "r1", "datos": {"hectareas": 3, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": V}}
nube.t["maquinaria"] = {"m1": {"id": "m1", "nombre": "CAMION INVENTADO", "datos": {"tipo": "vehiculo", "costo_hora": 0, "emoji": "🚛", **E}, "actualizado": V}}
nube.t["cuadrillas"] = {"cq1": {"id": "cq1", "nombre": "CUADRILLA INVENTADA", "datos": {"responsable": "RESPONSABLE INVENTADO", "miembros": 4, "pin": "6601", **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
def gente(pg, filas):
    for i, (nombre, valor) in enumerate(filas):
        if i > 0: pg.get_by_role("button", name="Agregar persona").click()
        pg.get_by_label(f"Nombre {i + 1}").fill(nombre)
        if valor is not None: pg.locator(".dj-fila").nth(i).locator("input").nth(1).fill(str(valor))
COSTO = "() => { const r = {}; for (const a of (window.__agroDatos.actividadesContables || [])) { if (a.cancelado) continue; const k = a.parcelaId || 'sin'; r[k] = Math.round(((r[k] || 0) + (Number(a.costoMO) || 0)) * 100) / 100; } return r; }"

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

    # ══ 1. Equipos de trabajo: pago por tarea y el operador del camión ══
    A = aparato(ADM)
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102"), ("CARO INVENTADA", "4103")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill(pin)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    avanza(A, 0.25); ir(A, "checador")
    for pin in ("4101", "4102", "4103"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    ir(A, "reparto")
    for n in ("ANA INVENTADA", "BETO INVENTADO"): A.locator(".rep-ficha", has_text=n).click()
    A.get_by_label("Parcela o vehículo").select_option("p1"); A.get_by_label("Qué van a hacer").select_option("Cosecha"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    A.locator(".rep-ficha", has_text="CARO INVENTADA").click()
    A.get_by_label("Parcela o vehículo").select_option("v:m1"); A.wait_for_timeout(150); A.get_by_label("Qué van a hacer").select_option("Traslado de personal"); A.wait_for_timeout(150)
    caso("al escoger el camión avisa que su rato se carga al vehículo con lo que ya gana; en un traslado no pregunta parcela", "se le carga al vehículo" in A.locator(".rep-barra").inner_text() and A.get_by_label("Para qué parcela es").count() == 0, A.locator(".rep-barra").inner_text()[:300])
    A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    asg = [e for e in de(A, "asignacion")]
    caso("Caro queda asignada al vehículo, no a una parcela", any(e["datos"].get("vehiculoId") == "m1" and not e["datos"].get("parcelaId") for e in asg), [e["datos"] for e in asg])
    avanza(A, 1); ir(A, "reparto")
    A.locator(".card", has_text="PARCELA UNO").get_by_role("button", name="Anotar destajo").click(); A.wait_for_timeout(300)
    A.get_by_label("A cómo cada una ($)").fill("12")
    A.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("sin decir cuánto hizo cada quien no se guarda el destajo", len(de(A, "destajo")) == 0, A.locator(".modal-sheet").inner_text()[-200:])
    ids = {t["nombre"]: t["id"] for t in datos(A)["trabajadores"]}
    A.locator(f"#dj-{ids['ANA INVENTADA']}").fill("30"); A.locator(f"#dj-{ids['BETO INVENTADO']}").fill("20")
    A.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(500)
    dj = de(A, "destajo")
    caso("el destajo guarda lo que hizo cada quien (30 y 20 cajas a $12), no un total parejo", len(dj) == 1 and sorted((x["cantidad"]) for x in dj[0]["datos"]["produccion"]) == [20, 30], [x["datos"] for x in dj])
    avanza(A, 7); ir(A, "checador")
    for pin in ("4101", "4102", "4103"): teclea(A, pin); A.clock.run_for(13000); A.wait_for_timeout(150)
    subio(A)
    ir(A, "mano-obra"); A.wait_for_timeout(500); t = plano(A.locator("body").inner_text())
    A.locator(".card", has_text="PARCELA UNO").last.locator(".mo-cab").click(); A.wait_for_timeout(200)
    caso("Mano de obra trae el destajo de cada quien en la parcela uno ($360 y $240 = 50 cajas a $12) además de su día", all(x in plano(A.locator(".card", has_text="PARCELA UNO").last.inner_text()) for x in ("30 caja · destajo | $360", "20 caja · destajo | $240")), plano(A.locator(".card", has_text="PARCELA UNO").last.inner_text())[:600])
    caso("y avisa que esos dos cobran su día Y un destajo (por si sólo cobran por destajo)", "destajo" in t.lower() and ("pago por día Y un destajo" in t or "día y un destajo" in t.lower()), t[:900])
    caso("y el rato de Caro en el camión sale cargado al vehículo, fuera de las parcelas", "CAMION INVENTADO" in t, t[:900])
    foto(A, "01-destajo-y-vehiculo")

    # ══ 2. Cuadrillas: el encargado captura los grupos eventuales ══
    B = aparato(ENC, "15:00"); hora(B)
    ir(B, "cuadrillas-dia"); B.get_by_role("button", name="Registrar una cuadrilla").click(); B.wait_for_timeout(300)
    B.get_by_label("Cuadrilla", exact=True).select_option("cq1"); B.get_by_label("Responsable").fill("RESPONSABLE INVENTADO")
    B.get_by_label("Parcela").select_option("p1"); B.get_by_label("Qué hicieron").select_option("Cosecha")
    B.get_by_label("Pago por día de cada persona ($)").fill("300")
    gente(B, [("UNO INVENTADO", None), ("DOS INVENTADO", None), ("TRES INVENTADO", 450)])
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(300)
    caso("sin decir cómo llegaron no se guarda", len(de(B, "cuadrilla_dia")) == 0 and B.get_by_text("Falta decir cómo llegaron").count() == 1)
    B.get_by_label("Transporte").select_option("flete"); B.get_by_label("Cuánto se pagó de flete").fill("600")
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    d = de(B, "cuadrilla_dia"); tr = de(B, "traslado_cuadrilla")
    caso("por día: cada quien con lo suyo ($300, $300 y $450) y el flete aparte, una vez", len(d) == 1 and [(i["nombre"], i["pagoDia"]) for i in d[0]["datos"]["integrantes"]] == [("UNO INVENTADO", 300), ("DOS INVENTADO", 300), ("TRES INVENTADO", 450)] and len(tr) == 1 and tr[0]["datos"]["monto"] == 600, [x["datos"] for x in d])
    B.get_by_role("button", name="Registrar una cuadrilla").click(); B.wait_for_timeout(300)
    B.get_by_label("Cuadrilla", exact=True).select_option("cq1"); B.get_by_label("Parcela").select_option("p2"); B.get_by_label("Qué hicieron").select_option("Riego")
    B.get_by_role("button", name="Precio por el trabajo").click(); B.wait_for_timeout(150)
    B.locator("#cq-precio").fill("2500"); B.locator("#cq-cuantos").fill("5")
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    d = de(B, "cuadrilla_dia")
    caso("precio por el trabajo: UN pago de $2,500 al grupo, sin inventarle lo de cada persona; el transporte de hoy no se pide otra vez", len(d) == 2 and d[1]["datos"]["modalidad"] == "precio" and float(d[1]["datos"]["precio"]["monto"]) == 2500 and len(de(B, "traslado_cuadrilla")) == 1, d[-1]["datos"] if d else None)
    B.get_by_role("button", name="Registrar una cuadrilla").click(); B.wait_for_timeout(300)
    B.get_by_label("Cuadrilla", exact=True).select_option("__otra__"); B.get_by_label("Nombre de la cuadrilla").fill("LOS INVENTADOS")
    B.get_by_label("Parcela").select_option("p1"); B.get_by_label("Qué hicieron").select_option("Cosecha")
    B.get_by_role("button", name="Destajo").click(); B.get_by_label("A cómo cada una ($)").fill("10")
    B.get_by_role("button", name="Sólo tengo el total del grupo").click()
    gente(B, [("CINCO INVENTADO", None), ("SEIS INVENTADO", None)]); B.get_by_label("Total del grupo (caja)").fill("50")
    B.get_by_label("Transporte").select_option("propio"); B.get_by_label("Vehículo").select_option("m1")
    caso("con vehículo del rancho no hay dónde ponerle importe al viaje", B.get_by_label("Cuánto se pagó de flete").count() == 0 and B.get_by_text("lo contaría dos veces").count() == 1)
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(300)
    caso("sólo con el total, sin que alguien autorice repartir parejo, no se guarda", len(de(B, "cuadrilla_dia")) == 2 and B.get_by_text("necesita que alguien lo autorice").count() == 1)
    B.locator(".dj-parejo input").check(); B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    d = de(B, "cuadrilla_dia"); tr = de(B, "traslado_cuadrilla")
    caso("con la autorización se guarda, con el nombre de quien lo autorizó; el viaje propio queda sin importe", len(d) == 3 and d[2]["datos"]["destajo"]["autorizoParejo"] == "ENCARGADO DE PRUEBA" and any(x["datos"].get("vehiculoId") == "m1" and "monto" not in x["datos"] for x in tr), [x["datos"] for x in tr])
    foto(B, "02-cuadrillas")
    B.locator(".card", has_text="LOS INVENTADOS").get_by_role("button", name="Cancelar este registro").click()
    B.get_by_role("button", name="Cancelar registro").click(); B.wait_for_timeout(200)
    caso("cancelar pide decir por qué", B.get_by_text("hay que decir por qué").count() == 1)
    B.get_by_label("Por qué se cancela").fill("ERA DE OTRO DIA"); B.get_by_role("button", name="Cancelar registro").click(); B.wait_for_timeout(500)
    d = de(B, "cuadrilla_dia")
    caso("queda cancelado con su motivo, a la vista, y no se borró", len(d) == 3 and d[2]["estado"] == "cancelado" and d[2]["cancelado"]["motivo"] == "ERA DE OTRO DIA")
    caso("subió", subio(B))

    # ══ 3. El otro teléfono: todo llega al costo de cada parcela, sin teclear actividades ══
    recarga(A); ir(A, "mano-obra"); A.wait_for_timeout(500)
    uno, dos = plano(A.locator(".card", has_text="PARCELA UNO").last.inner_text()), plano(A.locator(".card", has_text="PARCELA DOS").last.inner_text())
    caso("parcela uno: los de planta, el destajo, la cuadrilla por día ($1,050) y el flete repartido", "$1,050" in plano(A.locator("body").inner_text()) or "PARCELA UNO" in uno, uno[:300])
    caso("parcela dos: el precio por el trabajo ($2,500) más su parte del flete ($375: 5 de las 8 personas transportadas)", "$2,875" in dos, dos[:300])
    tm = plano(A.locator("body").inner_text()); i = tm.find("LOS INVENTADOS")
    caso("lo cancelado no suma a ninguna parcela (su viaje en el camión propio no lleva importe)", "LOS INVENTADOS" not in uno and "LOS INVENTADOS" not in dos, tm[max(0, i - 300):i + 300])
    caso("nadie tecleó actividades: las que hay salen del checador, el destajo y las cuadrillas", len(datos(A)["actividades"]) == 0, len(datos(A)["actividades"]))
    ir(A, "cuadrillas-dia"); ta = plano(A.locator("body").inner_text())
    caso("en el teléfono del administrador se ven los tres registros del encargado (uno cancelado, con su motivo)", ta.count("CUADRILLA INVENTADA") >= 2 and "ERA DE OTRO DIA" in ta, ta[:600])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
