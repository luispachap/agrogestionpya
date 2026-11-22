"""AUDITORÍA FUNCIONAL · BODEGA Y AJO: una corrida de ajo SIMULADA completa, usando la app como una persona desde un
teléfono Android imitado (Pixel 7). Recepción (estibas de barbecho desde la parcela) → limpia → corrida por calibre
(conteo, cierre de estiba con peso, etiqueta) → ajo terminado → salida de camión → consignación → cobro, y su llegada
a ventas, flujo y trazabilidad. Recargar, otro teléfono y otros perfiles. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_bodega_navegador.py"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
DIR = N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno")
nube = N.Nube([ADM, ENC, DIR])
E = {"_espacio": "localhost"}; AHORA = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": AHORA}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": AHORA}}
nube.t["cultivos"] = {"c1": {"id": "c1", "nombre": "Ajo", "datos": E, "actualizado": AHORA}}
nube.t["siembras"] = {"s1": {"id": "s1", "parcela_id": "p1", "cultivo_id": "c1", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "variedad": "MORADO INVENTADO", "fechaSiembra": "2026-10-01", "superficie": 2, **E}, "actualizado": AHORA}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg):
    for _ in range(80):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
D = lambda pg, col: pg.evaluate("c => JSON.parse(JSON.stringify(window.__agroDatos[c] || []))", col)
def enNube(tabla): return [dict(v.get("datos") or {}, id=v["id"]) for v in nube.t.get(tabla, {}).values()]
FLUJO = "() => { const f = window.__agroCuentas().flujo; return { ingresos: f.ingresos, egresos: f.egresos, sinDinero: f.ventasSinDinero }; }"

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def telefono(cuenta, modelo="Pixel 7"):
        ctx = b.new_context(**{k: v for k, v in p.devices[modelo].items() if k != "default_browser_type"}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept("Motivo de prueba") if d.type == "prompt" else d.accept()))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = telefono(ADM)
    caso("la siembra inventada llegó al teléfono (de ahí sale la trazabilidad)", len(D(A, "siembras")) == 1 and D(A, "siembras")[0].get("parcelaId") == "p1", D(A, "siembras"))

    # ── 1 · RECEPCIÓN: tres estibas de barbecho que llegan de la parcela (alta masiva) ──
    ir(A, "estibas"); t = plano(A.locator("body").inner_text())
    caso("Estibas abre en Barbecho, vacía", "Estibas y trazabilidad" in t and len(D(A, "estibas")) == 0, t[:300])
    A.get_by_role("button", name="Alta masiva").click() if A.get_by_role("button", name="Alta masiva").count() else A.locator("button.btn-outline").first.click()
    A.wait_for_timeout(300)
    A.get_by_role("button", name="Dar de alta todas").click(); A.wait_for_timeout(300)
    caso("el alta masiva sin datos no crea nada y dice qué falta", len(D(A, "estibas")) == 0 and len(A.dialogos) >= 1, A.dialogos[-1:])
    campo(A, "Parcela / siembra de origen").select_option("s1"); campo(A, "¿Cuántas estibas?").fill("3"); campo(A, "Cajas c/u").fill("40")
    A.get_by_role("button", name="Dar de alta todas").click(); A.wait_for_timeout(900)
    est = D(A, "estibas"); t = plano(A.locator("body").inner_text())
    caso("entran 3 estibas de barbecho de 40 cajas, con código AS-B y su parcela", len(est) == 3 and all(e["fase"] == "barbecho" and e["cajas"] == 40 and e["codigo"].startswith("AS-B") and e.get("parcelaId") == "p1" for e in est) and len(set(e["codigo"] for e in est)) == 3, [(e.get("codigo"), e.get("cajas"), e.get("parcelaId")) for e in est])
    caso("la app enseña las estibas creadas para imprimir sus etiquetas", "Estibas creadas" in t, t[:200])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)

    # ── 2 · LIMPIA: una estiba de limpio que sale de dos de barbecho ──
    A.locator(".tab-pill", has_text="Limpio").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Nueva estiba").click() if A.get_by_role("button", name="Nueva estiba").count() else A.locator("button.btn-accent", has_text="estiba").first.click()
    A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    marcas = A.locator("input[type=checkbox]")
    caso("al crear limpio ofrece las tres estibas de barbecho con su saldo", marcas.count() == 3 and t.count("40 cajas disp.") == 3, t[:500])
    marcas.nth(0).check(); marcas.nth(1).check(); A.wait_for_timeout(200)
    for boton in A.locator("button:text-is('todo')").all(): boton.click()
    A.wait_for_timeout(200)
    campo(A, "Cajas de la estiba nueva").fill("70")
    A.get_by_role("button", name="Crear estiba y generar código").click(); A.wait_for_timeout(900)
    est = D(A, "estibas"); limpio = [e for e in est if e["fase"] == "limpia"]; barb = sorted([e for e in est if e["fase"] == "barbecho"], key=lambda e: e["codigo"])
    saldo = lambda e: e["saldo"] if e.get("saldo") is not None else e["cajas"]
    caso("nace una estiba de limpio AS-L de 70 cajas que apunta a sus dos estibas de barbecho", len(limpio) == 1 and limpio[0]["cajas"] == 70 and limpio[0]["codigo"].startswith("AS-L") and len(limpio[0].get("consumos") or []) == 2, limpio)
    caso("las dos de barbecho quedan consumidas (saldo 0) y la tercera intacta con 40", sorted(saldo(e) for e in barb) == [0, 0, 40], [(e["codigo"], saldo(e), e.get("estado")) for e in barb])
    if A.get_by_role("button", name="Listo").count(): A.get_by_role("button", name="Listo").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="rastrear").first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("rastrear la estiba de limpio llega hasta la parcela", "Trazabilidad" in t and "PARCELA UNO" in t, t[:500])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)

    # ── 3 · CORRIDA: de la tarima de limpio salen calibres; se cierran dos estibas con su peso ──
    ir(A, "corrida"); t = plano(A.locator("body").inner_text())
    caso("la corrida abre con el tablero de calibres 5 a 11 y sin calibre 12", "Tablero de calibres" in t and "Calibre 12" not in t and "12 |" not in t.split("Tablero de calibres")[1][:400], t[:300])
    A.get_by_role("button", name="Elegir tarimas").first.click(); A.wait_for_timeout(300)
    A.locator(".tarima-chip", has_text=limpio[0]["codigo"]).first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="✓ Listo").click(); A.wait_for_timeout(300)
    A.locator(".tarima-chip", has_text=limpio[0]["codigo"]).first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("la tarima de limpio entra a la mesa con sus 70 cajas y queda corriendo", "corriendo" in t.lower() and "70 cajas disponibles" in t and "PARCELA UNO" in t, t[t.find("Origen de la corrida"):][:400])
    campo(A, "Responsable").fill("MIGUEL INVENTADO")
    filas = A.locator("div", has=A.locator("button.btn-num")).filter(has_text="cerrar estiba")
    def fila(cal): return A.locator("xpath=//span[normalize-space(.)='%s']/ancestor::div[.//button[contains(., 'cerrar estiba')]][1]" % cal)
    etiquetas = A.evaluate("() => [...document.querySelectorAll('span.font-bold')].map(x => x.innerText).filter(x => /\\d/.test(x)).slice(0, 12)")
    cal7 = [x for x in etiquetas if "7" in x][0]; cal8 = [x for x in etiquetas if "8" in x][0]
    for _ in range(3): fila(cal7).get_by_role("button", name="+10").click()
    for _ in range(2): fila(cal8).get_by_role("button", name="+10").click()
    fila(cal8).get_by_role("button", name="+5").click(); fila(cal8).get_by_role("button", name="−").click()
    A.wait_for_timeout(300); t = plano(A.locator("body").inner_text())
    caso("el conteo por calibre suma y resta: 30 cajas del 7 y 24 del 8", "30 cajas" in t and "24 cajas" in t, t[t.find("Tablero de calibres"):][:500])
    def cerrar(cal, bruto, tara):
        fila(cal).get_by_role("button", name="cerrar estiba").click(); A.wait_for_timeout(300)
        campo(A, "Peso bruto (kg)").fill(str(bruto)); campo(A, "Tara (kg)").fill(str(tara))
        A.get_by_role("button", name="Cerrar y generar folio").click(); A.wait_for_timeout(900)
        if A.get_by_role("button", name="Volver a la corrida").count(): A.get_by_role("button", name="Volver a la corrida").click(); A.wait_for_timeout(400)
    cerrar(cal7, 320, 20); cerrar(cal8, 262, 22)
    est = D(A, "estibas"); calib = sorted([e for e in est if e["fase"] == "calibre"], key=lambda e: e.get("calibre")); term = D(A, "terminados"); lim = [e for e in est if e["fase"] == "limpia"][0]
    caso("se cierran dos estibas de calibre AS-C con folio, peso neto (300 y 240 kg) y su origen en la tarima de limpio", len(calib) == 2 and [e["cajas"] for e in calib] == [30, 24] and [e.get("neto") for e in calib] == [300, 240] and all(e["codigo"].startswith("AS-C") and (e.get("consumos") or []) for e in calib), [(e.get("codigo"), e.get("calibre"), e.get("cajas"), e.get("neto"), e.get("consumos")) for e in calib])
    caso("cerrar calibre NO le resta cajas a la tarima de limpio (son cajas de otro tamaño): sigue en 70 hasta que se cuente", saldo(lim) == 70, [lim.get("saldo"), lim.get("cajas")])
    caso("cada estiba cerrada entra sola al inventario de ajo terminado: 30 cajas del 7 y 24 del 8, con sus kilos", sorted((int(x.get("calibre")), x.get("cajas"), x.get("kg")) for x in term) == [(7, 30, 300), (8, 24, 240)], term)
    t = plano(A.locator("body").inner_text())
    caso("la corrida enseña sus estibas cerradas y el total (54 cajas, 540 kg)", "Estibas cerradas en esta corrida (2)" in t and "540" in t, t[t.find("Estibas cerradas"):][:400])
    # Conteo físico a media corrida: recalibra la proporción; el saldo de la tarima se ajusta al terminar el día.
    A.get_by_placeholder("Cajas de limpio que quedan ahora").fill("10"); A.get_by_role("button", name="Contar").click(); A.wait_for_timeout(500); t = plano(A.locator("body").inner_text())
    caso("el conteo físico a media corrida queda anotado (quedan 10 de limpio) y la proporción deja de ser estimada", "Último conteo real: 10 cajas" in t, t[t.find("conteo"):][:300])
    # Salir de la pantalla a media corrida y volver: ¿qué se conserva?
    fila(cal8).get_by_role("button", name="+10").click(); A.wait_for_timeout(200)
    ir(A, "estibas"); ir(A, "corrida"); t = plano(A.locator("body").inner_text())
    A.conserva = {"cerradas": "Estibas cerradas en esta corrida (2)" in t, "contador": "10 cajas" in t.split("Tablero de calibres")[-1][:600], "conteo": "Último conteo real: 10" in t, "tarima": "corriendo" in t.lower()}
    caso("SALIR Y VOLVER A MEDIA CORRIDA: se conservan las estibas cerradas, las cajas contadas sin cerrar, el conteo físico y la tarima en la mesa", all(A.conserva.values()), A.conserva)
    subio(A); A.reload(); A.wait_for_timeout(3500); ir(A, "corrida"); t = plano(A.locator("body").inner_text())
    caso("RECARGAR A MEDIA CORRIDA: también se retoma igual, y lo dice", "Se retomó la corrida de hoy" in t and "Estibas cerradas en esta corrida (2)" in t and "10 cajas" in t.split("Tablero de calibres")[-1][:600] and "corriendo" in t.lower(), t[:300])
    if not A.conserva["tarima"]:
        A.get_by_role("button", name="Elegir tarimas").first.click(); A.wait_for_timeout(300); A.locator(".tarima-chip", has_text=limpio[0]["codigo"]).first.click(); A.wait_for_timeout(200)
        A.get_by_role("button", name="✓ Listo").click(); A.wait_for_timeout(200); A.locator(".tarima-chip", has_text=limpio[0]["codigo"]).first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Terminar corrida del día").click(); A.wait_for_timeout(500); t = plano(A.locator("body").inner_text())
    caso("al terminar el día pregunta cuántas cajas de limpio quedaron en la tarima", "¿Cuántas cajas de limpio quedaron?" in t.replace("¿CUÁNTAS CAJAS DE LIMPIO QUEDARON?", "¿Cuántas cajas de limpio quedaron?"), t[:400])
    if A.locator(".form-group", has_text="quedaron").count(): A.locator(".form-group", has_text="quedaron").locator("input").first.fill("10")
    if A.get_by_role("button", name="Guardar y terminar").count(): A.get_by_role("button", name="Guardar y terminar").click(); A.wait_for_timeout(800)
    lim = [e for e in D(A, "estibas") if e["fase"] == "limpia"][0]
    caso("y ese conteo es el que ajusta la tarima: queda en 10 cajas, activa", saldo(lim) == 10 and lim.get("estado") == "activa", [lim.get("saldo"), lim.get("estado")])
    ir(A, "corrida"); t = plano(A.locator("body").inner_text())
    caso("terminada la corrida, al volver a entrar empieza una nueva en limpio (no revive la de antes)", "Se retomó" not in t and "Estibas cerradas en esta corrida" not in t, t[:300])
    corr = D(A, "corridas")
    caso("terminar la corrida deja UN solo reporte del día, con su responsable y sus 54 cajas", len(corr) == 1 and corr[0].get("estado") == "terminada" and "MIGUEL INVENTADO" in json.dumps(corr, ensure_ascii=False) and "54" in json.dumps(corr), corr[:1])
    subio(A)
    caso("todo subió a la nube una sola vez: 6 estibas, 2 lotes de terminado", len(nube.t.get("estibas", {})) == 6 and len(nube.t.get("terminados", {})) == 2, {k: len(v) for k, v in nube.t.items() if v})

    # ── 4 · AJO TERMINADO ──
    ir(A, "terminados"); t = plano(A.locator("body").inner_text())
    caso("Ajo terminado enseña 30 cajas del calibre 7 y 24 del 8", "30" in t and "24" in t and "Ajo" in t, t[:500])

    A.get_by_role("button", name="+ Registrar entrada (encajado)").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Guardar entrada").click(); A.wait_for_timeout(300)
    caso("una entrada manual sin cajas ni kilos no se guarda", len(D(A, "terminados")) == 2)
    campo(A, "Calibre").select_option(index=[i for i, o in enumerate(campo(A, "Calibre").locator("option").all_inner_texts()) if "9" in o][0]); campo(A, "Cajas").fill("5"); campo(A, "Kilos").fill("50")
    A.get_by_role("button", name="Guardar entrada").click(); A.wait_for_timeout(600)
    term = D(A, "terminados")
    caso("una entrada manual de 5 cajas del calibre 9 se suma al inventario", sorted((int(x.get("calibre")), x.get("cajas")) for x in term) == [(7, 30), (8, 24), (9, 5)], [(x.get("calibre"), x.get("cajas")) for x in term])
    fila9 = A.locator("xpath=//button[normalize-space(.)='ajustar']").nth([i for i, x in enumerate(sorted(term, key=lambda x: int(x.get("calibre")))) if int(x.get("calibre")) == 9][0])
    fila9.click(); A.wait_for_timeout(300); campo(A, "Cajas reales").fill("4"); A.get_by_role("button", name="Guardar ajuste").click(); A.wait_for_timeout(400)
    t9 = [x for x in D(A, "terminados") if int(x.get("calibre")) == 9][0]
    caso("ajustar el inventario SIN motivo no cambia nada y la app lo dice", t9["cajas"] == 5 and any("motivo" in d.lower() for d in A.dialogos[-2:]), [t9.get("cajas"), A.dialogos[-1:]])
    campo(A, "Motivo").fill("CONTEO FISICO INVENTADO"); A.get_by_role("button", name="Guardar ajuste").click(); A.wait_for_timeout(600)
    t9 = [x for x in D(A, "terminados") if int(x.get("calibre")) == 9][0]
    caso("con motivo sí: quedan 4 cajas y el ajuste queda en el historial del lote con quién y por qué", t9["cajas"] == 4 and "CONTEO FISICO INVENTADO" in json.dumps(t9, ensure_ascii=False) and "ADMIN DE PRUEBA" in json.dumps(t9, ensure_ascii=False), t9)

    # ── 5 · SALIDA DE CAMIÓN: se embarca el calibre 7 completo a un cliente ──
    ir(A, "embarque"); f0 = A.evaluate(FLUJO)
    A.get_by_role("button", name="Guardar embarque y generar formato").click() if A.get_by_role("button", name="Guardar embarque y generar formato").count() else None
    A.wait_for_timeout(300)
    caso("un embarque sin tarimas no se guarda", len(D(A, "embarques")) == 0)
    campo(A, "Calibre").select_option(index=[i for i, o in enumerate(campo(A, "Calibre").locator("option").all_inner_texts()) if "7" in o][0])
    campo(A, "Número de cajas").fill("30"); campo(A, "Precio por caja").fill("500"); campo(A, "Peso bruto (kg)").fill("320"); campo(A, "Tara pallet (kg)").fill("20")
    A.get_by_role("button", name="+ Agregar tarima al camión").click(); A.wait_for_timeout(400)
    campo(A, "Cliente / comprador").fill("CLIENTE INVENTADO"); campo(A, "Destino").fill("CIUDAD INVENTADA"); campo(A, "Chofer").fill("CHOFER INVENTADO"); campo(A, "Placas").fill("ZZZ-000")
    A.get_by_role("button", name="Guardar embarque y generar formato").click(); A.wait_for_timeout(1000)
    emb = D(A, "embarques"); term = D(A, "terminados"); t = plano(A.locator("body").inner_text())
    caso("el embarque queda con folio, 30 cajas, 300 kg netos, su cliente y PENDIENTE de cobro", len(emb) == 1 and emb[0]["totalCajas"] == 30 and emb[0]["totalNeto"] == 300 and emb[0]["cliente"] == "CLIENTE INVENTADO" and emb[0]["estadoCobro"] == "pendiente" and emb[0].get("folio"), {k: emb[0].get(k) for k in ["folio", "totalCajas", "totalNeto", "cliente", "estadoCobro"]} if emb else emb)
    caso("y sale del inventario de terminado: del calibre 7 quedan 0 cajas y el 8 sigue en 24", sorted((int(x.get("calibre")), x.get("cajas")) for x in term) == [(7, 0), (8, 24), (9, 4)], [(x.get("calibre"), x.get("cajas"), x.get("kg")) for x in term])
    caso("embarcar a consignación todavía NO es venta ni dinero: resultados y flujo no se mueven", A.evaluate("() => window.__agroCuentas().resultado.ingresos") == 0 and A.evaluate(FLUJO) == f0, A.evaluate(FLUJO))
    caso("la app genera el formato de salida con el folio y el cliente", emb and emb[0]["folio"] in t and "CLIENTE INVENTADO" in t, t[:400])

    # ── 6 · CONSIGNACIÓN: el cliente paga después ──
    ir(A, "consignaciones"); t = plano(A.locator("body").inner_text())
    caso("Consignaciones enseña el embarque como pendiente de cobro", emb and emb[0]["folio"] in t and "CLIENTE INVENTADO" in t, t[:400])
    A.get_by_role("button", name="Liquidar").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    caso("liquidar sin monto no registra nada", len(D(A, "ingresos")) == 0 and D(A, "embarques")[0]["estadoCobro"] == "pendiente")
    campo(A, "Monto que pagó").fill("15000"); A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(900)
    emb = D(A, "embarques"); ing = D(A, "ingresos"); f1 = A.evaluate(FLUJO)
    caso("al cobrar $15,000 el embarque queda COBRADO y nace UNA venta de $15,000 ligada al embarque", emb[0]["estadoCobro"] == "cobrado" and emb[0].get("montoCobrado") == 15000 and len(ing) == 1 and ing[0]["monto"] == 15000 and emb[0]["folio"] in ing[0]["concepto"], [emb[0].get("estadoCobro"), ing])
    caso("esa venta llega a Resultados y al flujo de efectivo ($15,000 que entraron)", A.evaluate("() => window.__agroCuentas().resultado.ingresos") == 15000 and f1["ingresos"] - f0["ingresos"] == 15000, f1)
    ir(A, "contabilidad"); t = plano(A.locator("body").inner_text())
    caso("Finanzas enseña el dinero que entró", "DINERO QUE ENTRÓ | $15,000" in t, t[:300])
    ir(A, "comercializacion"); t = plano(A.locator("body").inner_text())
    caso("Comercialización enseña la venta con su cliente y el precio por kilo ($50)", "CLIENTE INVENTADO" in t and "$50" in t, t[:600])

    # ── 7 · Que siga ahí: recargar, otro teléfono, otros perfiles ──
    subio(A); A.reload(); A.wait_for_timeout(3500)
    caso("al recargar: 6 estibas, 3 lotes, 1 embarque cobrado, 1 venta; nada repetido", [len(D(A, c)) for c in ["estibas", "terminados", "embarques", "ingresos"]] == [6, 3, 1, 1] and D(A, "embarques")[0]["estadoCobro"] == "cobrado", [len(D(A, c)) for c in ["estibas", "terminados", "embarques", "ingresos"]])
    caso("y en la nube lo mismo, una sola vez", [len(nube.t.get(c, {})) for c in ["estibas", "terminados", "embarques", "ingresos"]] == [6, 3, 1, 1], {k: len(v) for k, v in nube.t.items() if v})
    G = telefono(ENC); ir(G, "estibas"); G.locator(".tab-pill", has_text="Calibre").click(); G.wait_for_timeout(400); t = plano(G.locator("body").inner_text())
    caso("el encargado, en otro teléfono, ve las mismas estibas de calibre", all(e["codigo"] in t for e in calib) or len([e for e in D(G, "estibas") if e["fase"] == "calibre"]) == 2, t[:400])
    G.evaluate("p => window.__agroIr(p)", "consignaciones"); G.wait_for_timeout(500)
    caso("al encargado no se le abre Consignaciones (cobrar no es suyo)", G.get_by_role("button", name="Liquidar").count() == 0 and "Registrar pago" not in G.locator("body").inner_text())
    H = telefono(DIR, "iPhone 13"); H.evaluate("p => window.__agroIr(p)", "embarque"); H.wait_for_timeout(500)
    caso("dirección (iPhone imitado) no tiene cómo embarcar ni cerrar estibas", H.get_by_role("button", name="+ Agregar tarima al camión").count() == 0)
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
