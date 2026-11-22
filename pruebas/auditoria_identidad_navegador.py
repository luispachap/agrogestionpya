"""AUDITORÍA FUNCIONAL · IDENTIDAD ÚNICA Y DUPLICADOS ENTRE TELÉFONOS (Luis, 22 nov), como una persona, 390 px.
Dos teléfonos de la misma cuenta, los dos SIN SEÑAL, capturan lo mismo: un gasto, un pago, la recepción de una compra,
la compra de una solicitud, una aplicación. Al volver la señal: nada se pisa, lo que tiene identidad propia entra una
vez, y lo que no se puede saber si es lo mismo se AVISA. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_identidad_navegador.py"""
import datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det else ""), flush=True)
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
CUENTAS = """() => { const c = window.__agroCuentas(); const f = c.flujo, r = c.resultado; const d = {};
  for (const m of f.meses || []) for (const k in m.detalle) d[k] = Math.round(((d[k] || 0) + m.detalle[k]) * 100) / 100;
  return JSON.parse(JSON.stringify({ sale: f.egresos, entra: f.ingresos, detalle: d, egresos: r.egresos, utilidad: r.utilidad, inv: r.inventario })); }"""
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def art(pg, nombre): return next((a for a in datos(pg)["inventario"] if a["nombre"] == nombre), None)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)

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
    def egreso(pg, concepto, monto, doble=False):
        ir(pg, "contabilidad"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(200); pg.locator(".option-card", has_text="Registrar Egreso").click(); pg.wait_for_timeout(300)
        campo(pg, "Concepto").fill(concepto); campo(pg, "Monto").fill(str(monto))
        b_ = pg.locator("button.btn-accent", has_text="Guardar").last
        if doble: b_.dblclick()
        else: b_.click()
        pg.wait_for_timeout(500)

    # ══ 0. Lo que ya existe antes de quedarse sin señal ══
    A = aparato(ADM, "06:30")
    ir(A, "equipo"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre completo").fill("ANA INVENTADA"); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill("4101"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    avanza(A, 0.5); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    ir(A, "reparto"); A.locator(".rep-ficha", has_text="ANA INVENTADA").click()
    A.get_by_label("Parcela").select_option(label="PARCELA UNO"); A.get_by_label("Qué van a hacer").select_option("Riego"); A.get_by_role("button", name="Asignar desde ahorita").click(); A.wait_for_timeout(400)
    avanza(A, 8); ir(A, "checador"); teclea(A, "4101"); A.clock.run_for(13000)
    ir(A, "inventario"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(300)
    campo(A, "Nombre").fill("UREA INVENTADA"); campo(A, "Unidad").fill("bulto"); A.locator(".card.ab .btn-accent").last.click(); A.wait_for_timeout(500)
    A.locator(".top-bar .btn-outline").first.click(); A.wait_for_timeout(300)
    campo(A, "Insumo").select_option(index=1); campo(A, "Cantidad").fill("10"); campo(A, "Proveedor").fill("PROVEEDOR INVENTADO"); campo(A, "Costo total").fill("5000")
    A.get_by_role("button", name="Registrar Entrada").click(); A.wait_for_timeout(700)
    idU = art(A, "UREA INVENTADA")["id"]
    subio(A)
    nube.t.setdefault("compras", {})["co1"] = {"id": "co1", "fecha": HOY, "monto": 1200, "estado": "aprobada", "datos": {"trabajadorId": "t-x", "tipoTrab": "trabajador", "descripcion": "DOS BULTOS INVENTADOS", "proveedor": "LA CENTRAL INVENTADA",
        "afectaInventario": True, "items": [{"nombre": "UREA INVENTADA", "insumoId": idU, "cantidad": 2}], **E}, "actualizado": "2026-11-19T21:00:00Z"}
    nube.t.setdefault("solicitudes_compra", {})["so1"] = {"id": "so1", "fecha": HOY, "estado": "pendiente", "datos": {"notas": "", "items": [{"nombre": "UREA INVENTADA", "cantidad": 4, "unidad": "bulto"}], "creadaPor": {"rol": "encargado", "id": "x", "nombre": "ENCARGADO DE PRUEBA"}, **E}, "actualizado": "2026-11-19T21:00:00Z"}
    avanza(A, 6 / 60); recarga(A)
    C = aparato(ADM, "15:10"); hora(C); recarga(C)
    caso("los dos teléfonos arrancan iguales: 10 bultos, una compra aprobada y una solicitud", all(art(pg, "UREA INVENTADA")["existencia"] == 10 and len(datos(pg)["compras"]) == 1 and len(datos(pg)["solicitudes_compra"]) == 1 for pg in (A, C)), [datos(C)["solicitudes_compra"], len(datos(C)["compras"])])
    c0 = A.evaluate(CUENTAS)

    # ══ 1. Un doble toque no guarda dos veces ══
    egreso(A, "REFACCION INVENTADA", 300, doble=True)
    caso("un doble toque en Guardar deja UN gasto", len(datos(A)["egresos"]) == 1, [e["concepto"] for e in datos(A)["egresos"]])
    subio(A); avanza(C, 6 / 60); recarga(C)

    # ══ 2. Sin señal los dos, capturan lo mismo ══
    nube.caida = True
    for pg in (A, C):
        egreso(pg, "DIESEL INVENTADO", 700)
        ir(pg, "nomina"); pg.wait_for_timeout(400); pg.locator(".card", has_text="ANA INVENTADA").last.get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(300)
        pg.get_by_label("Cuánto se entregó ($)").fill("350"); pg.locator(".modal-sheet").get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(700)
        ir(pg, "contabilidad"); tab(pg, "Compras"); pg.get_by_role("button", name="Recibir UREA INVENTADA").click(); pg.wait_for_timeout(600)
        ir(pg, "solicitudes"); pg.get_by_text("UREA INVENTADA").first.click(); pg.wait_for_timeout(400)
        pg.get_by_role("button", name="Confirmar compra y mover inventario").click(); pg.wait_for_timeout(400)
        campo(pg, "Costo total ($)").fill("2400"); campo(pg, "Proveedor").fill("PROVEEDOR INVENTADO"); pg.get_by_role("button", name="Confirmar e ingresar").click(); pg.wait_for_timeout(900)
    caso("sin señal, cada teléfono ve lo suyo: 10 + 2 recibidos + 4 comprados = 16 bultos", all(art(pg, "UREA INVENTADA")["existencia"] == 16 for pg in (A, C)), [art(pg, "UREA INVENTADA")["existencia"] for pg in (A, C)])
    idsA = {e["id"] for e in datos(A)["egresos"]}; idsC = {e["id"] for e in datos(C)["egresos"]}
    nube.caida = False
    for pg in (A, C): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, C): avanza(pg, 6 / 60); recarga(pg)
    for pg in (A, C): avanza(pg, 3 / 60); recarga(pg)

    # ══ 3. Al volver la señal ══
    dA, dC = datos(A), datos(C); cA, cC = A.evaluate(CUENTAS), C.evaluate(CUENTAS)
    diesel = [e for e in dA["egresos"] if e["concepto"] == "DIESEL INVENTADO"]
    caso("los dos gastos de diésel existen con identificador distinto: ninguno pisó al otro", len(diesel) == 2 and len({e["id"] for e in diesel}) == 2 and len([e for e in dC["egresos"] if e["concepto"] == "DIESEL INVENTADO"]) == 2, [e["id"] for e in diesel])
    caso("la recepción de la MISMA compra entró una sola vez (tiene identidad propia): +2 bultos, no +4", len([e for e in dA["eventos"] if e["tipo"] == "alm_entrada" and "compra-co1" in e["id"]]) == 1, [e["id"] for e in dA["eventos"] if e["tipo"] == "alm_entrada"])
    caso("la compra de la MISMA solicitud entró una sola vez: +4 bultos, un gasto, una entrada", len([e for e in dA["eventos"] if "solicitud-so1" in e["id"]]) == 1 and len([e for e in dA["egresos"] if e.get("solicitudId") == "so1"]) == 1 and len([e for e in dA["entradas_inv"] if e["id"].startswith("ei-sol-so1")]) == 1, [[e["id"] for e in dA["egresos"]], [e["id"] for e in dA["entradas_inv"]]])
    caso("en los dos teléfonos quedan 16 bultos, no 22", art(A, "UREA INVENTADA")["existencia"] == 16 and art(C, "UREA INVENTADA")["existencia"] == 16, [art(A, "UREA INVENTADA")["existencia"], art(C, "UREA INVENTADA")["existencia"]])
    pagos = [e for e in dA["eventos"] if e["tipo"] == "pago_personal"]
    caso("los dos pagos a Ana existen, sellados, con identificador distinto", len(pagos) == 2 and len({e["id"] for e in pagos}) == 2 and all(e.get("_validacion") == "autorizado" for e in pagos), [[e["id"], e.get("_validacion")] for e in pagos])
    ir(A, "nomina"); A.wait_for_timeout(500); t = plano(A.locator(".card", has_text="ANA INVENTADA").last.inner_text())
    caso("y Pagos al personal lo dice sin esconderlo: se le entregaron $700 y le correspondían $350 (de más)", "$700" in t and ("de más" in t.lower() or "-$350" in t or "−$350" in t), t[:400])
    caso("los dos teléfonos dan las mismas cuentas", [cA["sale"], cA["egresos"], cA["inv"]["valor"]] == [cC["sale"], cC["egresos"], cC["inv"]["valor"]], [cA["sale"], cC["sale"], cA["inv"], cC["inv"]])
    caso("el dinero que salió: lo de antes + $300 + dos diésel + dos pagos + la de la solicitud ($2,400), cada cosa una vez; la compra recibida ya contaba desde que se aprobó ($1,200) y recibirla no la repite", cA["sale"] == c0["sale"] + 300 + 1400 + 700 + 2400 and c0["detalle"].get("compras") == 1200 and cA["detalle"].get("compras") == 1200, [c0["sale"], cA["sale"], cA["detalle"]])

    # ══ 4. Lo que no se puede saber si es lo mismo, se avisa; una persona decide ══
    ir(A, "contabilidad"); tab(A, "Resultados"); t = plano(A.locator("body").inner_text())
    caso("Finanzas avisa: el gasto de diésel parece capturado dos veces, y dice quién capturó cada uno", "Capturas que parecen repetidas (1)" in t and "DIESEL INVENTADO" in t and "2 veces" in t and "ADMIN DE PRUEBA" in t, t[t.find("Capturas que parecen"):][:500])
    caso("y no quitó nada solo: los dos siguen contando", cA["detalle"].get("gastos", 0) >= 1700, cA["detalle"])
    tab(A, "Egresos"); A.wait_for_timeout(300)
    A.locator(".card, .list-row, div", has_text="DIESEL INVENTADO").last.locator("xpath=ancestor-or-self::*[.//button[starts-with(@aria-label,'Cancelar')]][1]").locator("button[aria-label^='Cancelar']").first.click(); A.wait_for_timeout(900)
    c1 = A.evaluate(CUENTAS); tab(A, "Resultados"); t = plano(A.locator("body").inner_text())
    caso("cancelado el que sobraba (con motivo), cuenta uno y el aviso se va", c1["sale"] == cA["sale"] - 700 and "Capturas que parecen repetidas" not in t and len([e for e in datos(A)["egresos"] if e["concepto"] == "DIESEL INVENTADO"]) == 2, [c1["sale"], cA["sale"], A.dialogos[-2:]])
    egreso(A, "GARRAFON INVENTADO", 50); egreso(A, "GARRAFON INVENTADO", 50)
    ir(A, "contabilidad"); tab(A, "Resultados")
    caso("dos gastos iguales de verdad también se avisan…", A.get_by_role("button", name="Son distintos: GARRAFON INVENTADO").count() == 1)
    A.get_by_role("button", name="Son distintos: GARRAFON INVENTADO").click(); A.wait_for_timeout(700)
    c2 = A.evaluate(CUENTAS); g = [e for e in datos(A)["egresos"] if e["concepto"] == "GARRAFON INVENTADO"]
    caso("…y al decir «son distintos» el aviso se va, los dos siguen contando y queda quién lo dijo", "Capturas que parecen repetidas" not in A.locator("body").inner_text() and c2["sale"] == c1["sale"] + 100 and all((x.get("distintoPor") or {}).get("nombre") == "ADMIN DE PRUEBA" for x in g), [c2["sale"], c1["sale"], [x.get("distintoPor") for x in g]])
    subio(A); recarga(A)
    caso("después de recargar no vuelve a preguntar", "Capturas que parecen repetidas" not in (ir(A, "contabilidad"), tab(A, "Resultados"), A.locator("body").inner_text())[2])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
