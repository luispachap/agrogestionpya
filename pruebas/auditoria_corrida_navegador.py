"""AUDITORÍA FUNCIONAL · LO QUE FALTABA DE BODEGA: la corrida en revoltura con dos tarimas de parcelas distintas, la
tarima limpiada hoy, los cortes con su ritmo (y quitar uno con su porqué), el muestreo de calidad y su tendencia, las
categorías aparte, estibas de re-limpia / alta individual / sin origen / cerrar una tarima con cajas, una salida con
varias tarimas (y cargar más de lo que hay), una salida a nuestra bodega, cobrar a cuenta de una deuda y varios
clientes. Dos teléfonos sin señal sobre el mismo lote de ajo terminado. Pixel 7 imitado, cuentas, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_corrida_navegador.py"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); MIG = N.cuenta(2, "otro@prueba.invalid", "OTRO ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM, MIG])
E = {"_espacio": "localhost"}; AHORA = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": AHORA}}
nube.t["parcelas"] = {p: {"id": p, "nombre": n, "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": AHORA} for p, n in [("p1", "PARCELA UNO"), ("p2", "PARCELA DOS")]}
nube.t["cultivos"] = {"c1": {"id": "c1", "nombre": "Ajo", "datos": E, "actualizado": AHORA}}
nube.t["siembras"] = {s: {"id": s, "parcela_id": p, "cultivo_id": "c1", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2026-10-01", "superficie": 2, **E}, "actualizado": AHORA} for s, p in [("s1", "p1"), ("s2", "p2")]}
def estiba(i, cod, cajas, p, s): return {"id": i, "datos": {"codigo": cod, "fase": "limpia", "cajas": cajas, "saldo": cajas, "cultivo": "Ajo", "parcelaId": p, "siembraId": s, "consumos": [], "estado": "activa", "fecha": "2026-11-20", **E}, "actualizado": AHORA}
nube.t["estibas"] = {"L1": estiba("L1", "AS-L-901", 50, "p1", "s1"), "L2": estiba("L2", "AS-L-902", 30, "p2", "s2"), "L3": estiba("L3", "AS-L-903", 20, "p1", "s1")}
nube.t["creditos"] = {"cr1": {"id": "cr1", "estado": "activo", "datos": {"concepto": "DEUDA CON CLIENTE DOS", "proveedor": "CLIENTE DOS", "monto": 10000, "fecha": "2026-11-01", "abonos": [], **E}, "actualizado": AHORA}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg):
    for _ in range(80):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
D = lambda pg, col: pg.evaluate("c => JSON.parse(JSON.stringify(window.__agroDatos[c] || []))", col)
saldo = lambda e: e["saldo"] if e.get("saldo") is not None else e["cajas"]
FLUJO = "() => { const f = window.__agroCuentas().flujo; return { ingresos: f.ingresos, sinDinero: f.ventasSinDinero }; }"
EXIST = "id => { const a = (window.__agroDatos.inventario || []).find(x => x.id === id); return a ? a.existencia : null; }"
lote8 = lambda pg: [x for x in D(pg, "terminados") if str(x.get("calibre")) == "8"]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def telefono(cuenta, modelo="Pixel 7"):
        ctx = b.new_context(**{k: v for k, v in p.devices[modelo].items() if k != "default_browser_type"}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = "Motivo de prueba"
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300]))
        def dialogo(d):
            pg.dialogos.append(d.message)
            if d.type == "prompt": d.dismiss() if pg.respuesta is None else d.accept(pg.respuesta)
            else: d.accept()
        pg.on("dialog", dialogo)
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = telefono(ADM)
    caso("llegan al teléfono las tres tarimas de limpio inventadas (dos de la parcela uno, una de la dos)", len(D(A, "estibas")) == 3, [e.get("codigo") for e in D(A, "estibas")])

    # ── 1 · REVOLTURA: se corre de dos tarimas a la vez y al cerrar se reparte por saldo ──
    ir(A, "corrida")
    A.get_by_role("button", name="Elegir tarimas").first.click(); A.wait_for_timeout(300)
    for c in ["AS-L-901", "AS-L-902"]: A.locator(".tarima-chip", has_text=c).first.click(); A.wait_for_timeout(150)
    A.get_by_role("button", name="✓ Listo").click(); A.wait_for_timeout(300)
    A.locator(".toggle-row", has_text="Precisa").click(); A.wait_for_timeout(300); t = plano(A.locator("body").inner_text())
    caso("el modo revoltura se prende y dice que se reparte por saldo", "Revoltura" in t and "se reparte por saldo" in t, t[t.find("Origen"):][:300])
    campo(A, "Responsable").fill("ENCARGADO DE BODEGA INVENTADO")
    fila = lambda cal: A.locator("xpath=//span[normalize-space(.)='%s']/ancestor::div[.//button[contains(., 'cerrar estiba')]][1]" % cal)
    etq = A.evaluate("() => [...document.querySelectorAll('span.font-bold')].map(x => x.innerText).filter(x => /\\d/.test(x)).slice(0, 12)")
    cal8 = [x for x in etq if "8" in x][0]
    for _ in range(2): fila(cal8).get_by_role("button", name="+10").click()
    fila(cal8).get_by_role("button", name="cerrar estiba").click(); A.wait_for_timeout(300)
    campo(A, "Peso bruto (kg)").fill("210"); campo(A, "Tara (kg)").fill("10")
    A.get_by_role("button", name="Cerrar y generar folio").click(); A.wait_for_timeout(900)
    if A.get_by_role("button", name="Volver a la corrida").count(): A.get_by_role("button", name="Volver a la corrida").click(); A.wait_for_timeout(400)
    c8 = [e for e in D(A, "estibas") if e["fase"] == "calibre"]
    cons = {x["id"]: x["cajas"] for x in (c8[0].get("consumos") or [])} if c8 else {}
    caso("REVOLTURA: la estiba de 20 cajas del 8 se reparte entre las dos tarimas según su saldo (50 y 30 → 13 y 7)", len(c8) == 1 and cons == {"L1": 13, "L2": 7}, cons)
    est = {e["id"]: e for e in D(A, "estibas")}
    caso("cerrar calibre no le resta a las tarimas de limpio (cajas de otro tamaño): siguen en 50 y 30", saldo(est["L1"]) == 50 and saldo(est["L2"]) == 30, [saldo(est["L1"]), saldo(est["L2"])])

    # ── 2 · TARIMA LIMPIADA HOY: entra a la mesa en ese momento ──
    A.get_by_role("button", name="Elegir tarimas").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Tarima limpiada hoy").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Meter a la mesa").click(); A.wait_for_timeout(300)
    caso("sin cajas no se mete nada y la app pregunta cuántas trae", len(D(A, "estibas")) == 4 and "cajas" in (A.dialogos[-1] if A.dialogos else "").lower(), A.dialogos[-1:])
    A.locator(".card", has_text="Tarima limpiada ahora").last.locator(".form-group", has_text="Cajas").locator("input").fill("15")
    A.locator(".card", has_text="Tarima limpiada ahora").last.locator("select").select_option("p1")
    A.get_by_role("button", name="Meter a la mesa").click(); A.wait_for_timeout(700)
    nueva = [e for e in D(A, "estibas") if (e.get("nota") or "").startswith("Alta rápida")]
    t = plano(A.locator("body").inner_text())
    caso("nace una tarima de limpio de 15 cajas de la parcela uno, ya en la mesa", len(nueva) == 1 and nueva[0]["cajas"] == 15 and nueva[0].get("parcelaId") == "p1" and nueva[0]["codigo"] in t, [(e.get("codigo"), e.get("cajas"), e.get("parcelaId")) for e in nueva])
    caso("y su limpio queda anotado como entrada a la corrida, con su hora", "Limpio que ha entrado (95 cajas)" in t, t[t.find("Limpio que ha entrado"):][:200])

    # ── 3 · CORTES Y RITMO; quitar un corte pide el porqué ──
    A.get_by_role("button", name="alto", exact=True).click(); A.wait_for_timeout(150)
    A.get_by_role("button", name="Tomar corte ahora").click(); A.wait_for_timeout(300)
    t = plano(A.locator("body").inner_text())
    caso("el corte queda con su total (20 cajas) y el ritmo al que iba (alto)", "ritmo alto" in t and "20 cajas" in t.split("Corte ")[-1][:120], t[t.find("Corte "):][:200])
    caso("después del corte la app sugiere tomar una muestra de calidad (no la obliga)", "Ahora toma una muestra de calidad" in t, "")
    fila(cal8).get_by_role("button", name="+5").click(); A.wait_for_timeout(150)
    A.get_by_role("button", name="Tomar corte ahora").click(); A.wait_for_timeout(300)
    cortes = A.locator("div.flex-b").filter(has=A.locator("span", has_text="Corte "))
    caso("van dos cortes", cortes.count() == 2, cortes.count())
    A.respuesta = None; cortes.nth(1).locator("button").click(); A.wait_for_timeout(300)
    caso("si no se dice por qué, el corte NO se quita", A.locator("div.flex-b").filter(has=A.locator("span", has_text="Corte ")).count() == 2)
    A.respuesta = "SE TOMÓ DOS VECES"; A.locator("div.flex-b").filter(has=A.locator("span", has_text="Corte ")).nth(1).locator("button").click(); A.wait_for_timeout(400)
    t = plano(A.locator("body").inner_text()); q = A.locator("[aria-label='Quitado de la corrida']")
    caso("con su porqué sí se quita, y queda a la vista qué se quitó, a qué hora y por qué", A.locator("div.flex-b").filter(has=A.locator("span", has_text="Corte ")).count() == 1 and q.count() == 1 and "SE TOMÓ DOS VECES" in q.inner_text() and "corte de 25 cajas" in q.inner_text(), q.inner_text() if q.count() else t[:300])
    A.respuesta = "Motivo de prueba"

    # ── 4 · CALIDAD: dos muestras; la app enseña la tendencia y NO ordena ──
    A.get_by_role("button", name="Ir a calidad").click(); A.wait_for_timeout(400)
    A.get_by_role("button", name="Guardar muestreo").click(); A.wait_for_timeout(300)
    caso("un muestreo sin total de cabezas no se guarda", len([c for c in D(A, "control_corrida") if c.get("tipo") == "calidad"]) == 0)
    def muestra(total, **malos):
        campo(A, "Total de cabezas").fill(str(total))
        for k, v in malos.items(): campo(A, k).fill(str(v))
        A.get_by_role("button", name="Guardar muestreo").click(); A.wait_for_timeout(500)
    muestra(100, Abierto=2, Hongo=3)
    caso("la primera muestra: 95% de bueno, con el ritmo al que se iba", any(abs((c.get("pctBueno") or 0) - 0.95) < 1e-9 and c.get("ritmo") == "alto" for c in D(A, "control_corrida")), [(c.get("pctBueno"), c.get("ritmo"), c.get("hora")) for c in D(A, "control_corrida")])
    A.wait_for_timeout(1200); muestra(100, Calavereado=12)
    t = plano(A.locator("body").inner_text())
    caso("con la segunda (88%) la app dice que EMPEORÓ, de 95.0% a 88.0%, e ibas a ritmo alto", "Empeorando" in t and "de 95.0% a 88.0%" in t and "ibas a ritmo" in t and "alto" in t.lower(), t[t.find("Empeor") - 20 if "Empeor" in t else 0:][:300])
    caso("informa, no manda: deja la decisión a quien corre", "Tú decides" in t and "Sube el ritmo" not in t and "Baja el ritmo" not in t, "")

    # ── 5 · CATEGORÍAS APARTE: un artículo por categoría y lo que entra es un movimiento ──
    A.get_by_role("button", name="Categorías aparte").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Registrar y sumar a inventario").click(); A.wait_for_timeout(300)
    caso("sin cajas ni kilos no se registra nada", len([c for c in D(A, "control_corrida") if c.get("tipo") == "aparte"]) == 0)
    def aparte(pg, cat, cajas):
        pg.locator(".form-group", has=pg.locator("label", has_text="Categoría")).locator("select").select_option(cat)
        pg.locator(".form-group", has=pg.locator("label", has_text="Cajas")).locator("input").first.fill(str(cajas))
        pg.get_by_role("button", name="Registrar y sumar a inventario").click(); pg.wait_for_timeout(600)
    aparte(A, "Corona", 6); aparte(A, "Corona", 4)
    inv = [a for a in D(A, "inventario") if (a.get("nombre") or "").lower() == "ajo corona"]
    entradas = [e for e in D(A, "eventos") if e.get("tipo") == "alm_entrada" and (e.get("datos") or {}).get("articuloId") == "art-ajo-corona"]
    caso("la corona queda en UN artículo «Ajo Corona» con 10 cajas", len(inv) == 1 and inv[0]["id"] == "art-ajo-corona" and A.evaluate(EXIST, "art-ajo-corona") == 10, [(a.get("id"), a.get("existencia")) for a in inv])
    caso("y esas 10 cajas son dos entradas al almacén con fecha y quién (nadie escribió la existencia)", len(entradas) == 2 and sorted((e["datos"]["cantidad"]) for e in entradas) == [4, 6] and all(e.get("quien") for e in entradas), [(e["datos"].get("cantidad"), e.get("quien")) for e in entradas])

    # ── 6 · Recargar a media corrida conserva lo quitado ──
    subio(A); A.reload(); A.wait_for_timeout(3500); ir(A, "corrida"); t = plano(A.locator("body").inner_text())
    q = A.locator("[aria-label='Quitado de la corrida']")
    caso("RECARGAR: se retoma la corrida con la tarima de hoy en la mesa y lo quitado con su porqué", "Se retomó la corrida de hoy" in t and q.count() == 1 and "SE TOMÓ DOS VECES" in q.inner_text() and nueva[0]["codigo"] in t, t[:300])

    # ── 7 · ESTIBAS: re-limpia, alta individual, sin origen y cerrar una tarima con cajas ──
    ir(A, "estibas")
    A.locator(".tab-pill", has_text="Calibre").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="rastrear").first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("rastrear la estiba de revoltura llega a las DOS parcelas", "PARCELA UNO" in t and "PARCELA DOS" in t, t[:500])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)
    A.locator(".tab-pill", has_text="Re-limpia").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Nueva estiba").click(); A.wait_for_timeout(300)
    A.locator("label", has_text="AS-L-903").locator("input[type=checkbox]").check(); A.wait_for_timeout(200)
    A.locator("button:text-is('todo')").first.click(); A.wait_for_timeout(200)
    A.get_by_role("button", name="Crear estiba y generar código").click(); A.wait_for_timeout(800)
    rl = [e for e in D(A, "estibas") if e["fase"] == "relimpia"]
    caso("RE-LIMPIA: nace una estiba AS-R de 20 cajas que viene de la tarima AS-L-903 (y ésa queda en 0)", len(rl) == 1 and rl[0]["codigo"].startswith("AS-R") and rl[0]["cajas"] == 20 and [c["id"] for c in rl[0].get("consumos") or []] == ["L3"] and saldo([e for e in D(A, "estibas") if e["id"] == "L3"][0]) == 0, [(e.get("codigo"), e.get("cajas"), e.get("consumos")) for e in rl])
    if A.get_by_role("button", name="Listo").count(): A.get_by_role("button", name="Listo").click(); A.wait_for_timeout(300)
    A.locator(".tab-pill", has_text="Barbecho").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Nueva estiba").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Crear estiba y generar código").click(); A.wait_for_timeout(300)
    caso("una estiba de barbecho sin parcela no se crea", len([e for e in D(A, "estibas") if e["fase"] == "barbecho"]) == 0)
    campo(A, "Parcela / siembra de origen").select_option("s2"); campo(A, "Número de cajas").fill("25")
    A.get_by_role("button", name="Crear estiba y generar código").click(); A.wait_for_timeout(800)
    bb = [e for e in D(A, "estibas") if e["fase"] == "barbecho"]
    caso("ALTA INDIVIDUAL: una estiba de barbecho AS-B de 25 cajas de la parcela dos", len(bb) == 1 and bb[0]["codigo"].startswith("AS-B") and bb[0]["cajas"] == 25 and bb[0].get("parcelaId") == "p2", [(e.get("codigo"), e.get("cajas"), e.get("parcelaId")) for e in bb])
    if A.get_by_role("button", name="Listo").count(): A.get_by_role("button", name="Listo").click(); A.wait_for_timeout(300)
    A.locator(".tab-pill", has_text="Limpio").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Nueva estiba").click(); A.wait_for_timeout(300)
    campo(A, "Cajas de la estiba nueva").fill("10"); n0 = len(A.dialogos)
    A.get_by_role("button", name="Crear estiba y generar código").click(); A.wait_for_timeout(800)
    so = [e for e in D(A, "estibas") if e["fase"] == "limpia" and (e.get("cajasSinOrigen") or 0) > 0 and e["id"] not in ("L1", "L2", "L3")]
    caso("SIN ORIGEN: avisa que quedará sin trazabilidad y, si se acepta, la estiba dice que sus 10 cajas no tienen origen", any("SIN estiba de origen" in d for d in A.dialogos[n0:]) and len(so) == 1 and so[0]["cajas"] == 10 and so[0]["cajasSinOrigen"] == 10, [(e.get("codigo"), e.get("cajasSinOrigen")) for e in so])
    if A.get_by_role("button", name="Listo").count(): A.get_by_role("button", name="Listo").click(); A.wait_for_timeout(300)
    renglon = A.locator(".list-item", has_text=nueva[0]["codigo"])
    A.respuesta = None; renglon.get_by_role("button", name="cerrar").click(); A.wait_for_timeout(400)
    tr = [e for e in D(A, "estibas") if e["id"] == nueva[0]["id"]][0]
    caso("CERRAR una tarima que todavía trae 15 cajas sin decir por qué: no se cierra", tr.get("estado") == "activa" and any("todavía trae 15 cajas" in d for d in A.dialogos[-2:]), [tr.get("estado"), A.dialogos[-1:]])
    A.respuesta = "SE MEZCLÓ CON OTRA"; renglon.get_by_role("button", name="cerrar").click(); A.wait_for_timeout(600); A.respuesta = "Motivo de prueba"
    tr = [e for e in D(A, "estibas") if e["id"] == nueva[0]["id"]][0]
    caso("con su porqué sí: queda cerrada con sus 15 cajas, el motivo, quién y cuándo", tr.get("estado") == "consumida" and tr.get("saldoAlCerrar") == 15 and (tr.get("cerrada") or {}).get("motivo") == "SE MEZCLÓ CON OTRA" and ((tr.get("cerrada") or {}).get("quien") or {}).get("nombre") == "ADMIN DE PRUEBA" and (tr.get("cerrada") or {}).get("cuando"), tr.get("cerrada"))
    subio(A)

    # ── 8 · DOS TELÉFONOS SIN SEÑAL sobre el mismo lote del calibre 8 (25 cajas) ──
    B = telefono(MIG)
    caso("el otro teléfono baja el lote del 8 con sus 20 cajas (las 5 contadas después no se cerraron en estiba) y el ajo corona con 10", [x.get("cajas") for x in lote8(B)] == [20] and B.evaluate(EXIST, "art-ajo-corona") == 10, [(x.get("id"), x.get("cajas")) for x in lote8(B)])
    nube.caida = True
    ir(B, "terminados"); B.get_by_role("button", name="+ Registrar entrada (encajado)").click(); B.wait_for_timeout(300)
    campo(B, "Calibre").select_option(index=[i for i, o in enumerate(campo(B, "Calibre").locator("option").all_inner_texts()) if "8" in o][0]); campo(B, "Cajas").fill("5"); campo(B, "Kilos").fill("50")
    B.get_by_role("button", name="Guardar entrada").click(); B.wait_for_timeout(600)
    ir(B, "corrida"); B.get_by_role("button", name="Categorías aparte").click(); B.wait_for_timeout(300); aparte(B, "Corona", 3)
    # A, sin señal también: una salida de camión con DOS tarimas del 8 que suman más de lo que hay (12 + 18 = 30 de 20)
    ir(A, "embarque")
    def tarima(pg, cal, cajas, bruto, tara, precio):
        campo(pg, "Calibre").select_option(index=[i for i, o in enumerate(campo(pg, "Calibre").locator("option").all_inner_texts()) if cal in o][0])
        campo(pg, "Número de cajas").fill(str(cajas)); campo(pg, "Precio por caja").fill(str(precio)); campo(pg, "Peso bruto (kg)").fill(str(bruto)); campo(pg, "Tara pallet (kg)").fill(str(tara))
        pg.get_by_role("button", name="+ Agregar tarima al camión").click(); pg.wait_for_timeout(400)
    n0 = len(A.dialogos); tarima(A, "8", 12, 130, 10, 400); tarima(A, "8", 18, 190, 10, 400)
    caso("CARGAR MÁS DE LO QUE HAY: la segunda tarima avisa que el inventario sólo muestra 8 (no bloquea)", any("solo muestra 8 disponibles" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    campo(A, "Cliente / comprador").fill("CLIENTE DOS"); campo(A, "Destino").fill("CIUDAD INVENTADA"); campo(A, "Chofer").fill("CHOFER INVENTADO"); campo(A, "Placas").fill("ZZZ-000")
    A.get_by_role("button", name="Guardar embarque y generar formato").click(); A.wait_for_timeout(1000)
    emb = [e for e in D(A, "embarques") if e.get("cliente") == "CLIENTE DOS"]
    caso("VARIAS TARIMAS: el embarque lleva las dos tarimas, 30 cajas y 300 kg netos", len(emb) == 1 and emb[0]["totalTarimas"] == 2 and emb[0]["totalCajas"] == 30 and emb[0]["totalNeto"] == 300, {k: emb[0].get(k) for k in ["totalTarimas", "totalCajas", "totalNeto"]} if emb else emb)
    ir(A, "terminados"); t = plano(A.locator("body").inner_text())
    caso("sin señal, en este teléfono el lote del 8 queda en −10 A LA VISTA (antes se recortaba en cero y la diferencia desaparecía)", [x.get("cajas") for x in lote8(A)] == [-10] and "Salieron 10 más de las registradas: por explicar" in t, [x.get("cajas") for x in lote8(A)])
    ir(A, "corrida"); A.get_by_role("button", name="Categorías aparte").click(); A.wait_for_timeout(300); aparte(A, "Corona", 2)
    nube.caida = False
    caso("vuelve la señal: los dos teléfonos suben todo", subio(A) and subio(B), [A.evaluate(COLA), B.evaluate(COLA)])
    A.reload(); A.wait_for_timeout(3500); B.reload(); B.wait_for_timeout(3500); subio(A); subio(B); A.reload(); A.wait_for_timeout(3500); B.reload(); B.wait_for_timeout(3500)
    nube8 = [v for v in nube.t.get("terminados", {}).values() if str((v.get("datos") or {}).get("calibre")) == "8"]
    caso("en la nube hay UN lote del 8 con los TRES movimientos (la entrada de la corrida, la del otro teléfono y la salida)", len(nube8) == 1 and len((nube8[0].get("datos") or {}).get("movimientos") or []) == 3, [(v["id"], len((v.get("datos") or {}).get("movimientos") or [])) for v in nube8])
    caso("y los dos teléfonos dicen lo mismo: 20 + 5 − 30 = −5 cajas del 8, por explicar", [x.get("cajas") for x in lote8(A)] == [-5] and [x.get("cajas") for x in lote8(B)] == [-5], [[x.get("cajas") for x in lote8(A)], [x.get("cajas") for x in lote8(B)]])
    caso("el ajo corona de los dos teléfonos es un solo artículo con 15 cajas (10 + 3 + 2)", [a["id"] for a in D(A, "inventario") if "corona" in (a.get("nombre") or "").lower()] == ["art-ajo-corona"] and A.evaluate(EXIST, "art-ajo-corona") == 15 and B.evaluate(EXIST, "art-ajo-corona") == 15, [A.evaluate(EXIST, "art-ajo-corona"), B.evaluate(EXIST, "art-ajo-corona")])

    # ── 9 · A NUESTRA BODEGA: sale del inventario, no es venta ni se cobra ──
    ir(A, "terminados"); A.get_by_role("button", name="+ Registrar entrada (encajado)").click(); A.wait_for_timeout(300)
    campo(A, "Calibre").select_option(index=[i for i, o in enumerate(campo(A, "Calibre").locator("option").all_inner_texts()) if "8" in o][0]); campo(A, "Cajas").fill("6"); campo(A, "Kilos").fill("60")
    A.get_by_role("button", name="Guardar entrada").click(); A.wait_for_timeout(600)
    ir(A, "embarque"); A.locator(".tab-pill", has_text="A nuestra bodega").click(); A.wait_for_timeout(300)
    tarima(A, "8", 2, 30, 10, 0)
    A.get_by_role("button", name="Guardar embarque y generar formato").click(); A.wait_for_timeout(1000)
    bod = [e for e in D(A, "embarques") if e.get("tipo") == "bodega"]
    caso("la salida a nuestra bodega queda sin cobro (no es consignación)", len(bod) == 1 and bod[0]["estadoCobro"] == "na", [(e.get("tipo"), e.get("estadoCobro")) for e in bod])
    caso("y sale del ajo terminado: −5 + 6 − 2 = −1 del 8", [x.get("cajas") for x in lote8(A)] == [-1], [x.get("cajas") for x in lote8(A)])

    # ── 10 · COBRAR: a cuenta de una deuda (no es dinero que entra) y en dinero; y otro cliente ──
    f0 = A.evaluate(FLUJO)
    ir(A, "consignaciones"); t = plano(A.locator("body").inner_text())
    caso("Consignaciones enseña el embarque de CLIENTE DOS y NO el de nuestra bodega", "CLIENTE DOS" in t and bod[0]["folio"] not in t, t[:300])
    A.get_by_role("button", name="Liquidar").first.click(); A.wait_for_timeout(300)
    campo(A, "Monto que pagó").fill("4000"); campo(A, "¿Cómo pagó?").select_option("deuda"); A.locator("label", has_text="Es pago parcial").locator("input").check()
    A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(400)
    caso("a cuenta de una deuda sin decir cuál no se registra", len(D(A, "ingresos")) == 0)
    campo(A, "¿A qué deuda se abona?").select_option("cr1"); A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(900)
    e2 = [e for e in D(A, "embarques") if e.get("cliente") == "CLIENTE DOS"][0]; ing = D(A, "ingresos"); cr = [c for c in D(A, "creditos") if c["id"] == "cr1"][0]
    caso("PAGO A CUENTA DE DEUDA: el embarque sigue pendiente por el resto, con $4,000 cobrados", e2["estadoCobro"] == "pendiente" and e2.get("montoCobrado") == 4000, [e2.get("estadoCobro"), e2.get("montoCobrado")])
    caso("nace la venta de $4,000 marcada «contra deuda» y la deuda con ese cliente baja a $6,000", len(ing) == 1 and ing[0]["metodo"] == "contra deuda" and ing[0]["monto"] == 4000 and A.evaluate("() => { const c = window.__agroDatos.creditos.find(x => x.id === 'cr1'); return (c.abonos || []).reduce((s, a) => s + a.monto, 0); }") == 4000, [ing, cr.get("abonos")])
    f1 = A.evaluate(FLUJO)
    caso("esa venta cuenta en el resultado pero NO en el flujo: no entró dinero", A.evaluate("() => window.__agroCuentas().resultado.ingresos") == 4000 and f1["ingresos"] == f0["ingresos"] and f1["sinDinero"] - (f0["sinDinero"] or 0) == 4000, [f0, f1])
    A.get_by_role("button", name="Liquidar").first.click(); A.wait_for_timeout(300)
    campo(A, "Monto que pagó").fill("5000"); A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(900)
    e2 = [e for e in D(A, "embarques") if e.get("cliente") == "CLIENTE DOS"][0]; f2 = A.evaluate(FLUJO)
    caso("el resto en transferencia: el embarque queda cobrado con $9,000 y entran $5,000 al flujo", e2["estadoCobro"] == "cobrado" and e2.get("montoCobrado") == 9000 and f2["ingresos"] - f1["ingresos"] == 5000, [e2.get("estadoCobro"), e2.get("montoCobrado"), f2])
    ir(A, "embarque"); tarima(A, "8", 2, 25, 5, 300); campo(A, "Cliente / comprador").fill("CLIENTE TRES")
    A.get_by_role("button", name="Guardar embarque y generar formato").click(); A.wait_for_timeout(900)
    ir(A, "consignaciones"); A.get_by_role("button", name="Liquidar").first.click(); A.wait_for_timeout(300); campo(A, "Monto que pagó").fill("1000"); A.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(900)
    ir(A, "comercializacion"); t = plano(A.locator("body").inner_text())
    caso("VARIOS CLIENTES: Comercialización enseña a CLIENTE DOS y a CLIENTE TRES con lo suyo", "CLIENTE DOS" in t and "CLIENTE TRES" in t, t[:900])

    # ── 11 · Que quede bien ──
    subio(A); A.reload(); A.wait_for_timeout(3500)
    caso("al recargar: tres ventas, tres embarques, un lote por calibre", len(D(A, "ingresos")) == 3 and len(D(A, "embarques")) == 3 and len(lote8(A)) == 1, [len(D(A, "ingresos")), len(D(A, "embarques")), len(lote8(A))])
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
