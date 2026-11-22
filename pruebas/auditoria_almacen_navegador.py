"""AUDITORÍA FUNCIONAL · ALMACÉN Y COMPRAS, usando la app como una persona desde un teléfono (390 px), con cuentas.
Inventario (alta y entrada) → Entregas (uso directo: ahí nace el costo) → Conteo a ciegas y mermas → Solicitud de compra →
registrar la compra → compra del personal (aprobar, recibir, valuar), y en cada paso: existencia, valor del inventario,
resultado y flujo de efectivo. Con recarga, segundo aparato y otros perfiles. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_almacen_navegador.py"""
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

    # ══ 1. Inventario: dar de alta un artículo y meterle una compra ══
    A = aparato(ADM)
    ir(A, "inventario"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(300)
    A.locator(".card.ab .btn-accent").last.click(); A.wait_for_timeout(400)
    caso("un artículo sin nombre no se da de alta, y dice qué falta", len(datos(A)["inventario"]) == 0 and "Falta el nombre" in A.locator(".card.ab").inner_text(), [a.get("nombre") for a in datos(A)["inventario"]])
    campo(A, "Nombre").fill("UREA INVENTADA"); campo(A, "Unidad").fill("bulto"); A.locator(".card.ab .btn-accent").last.click(); A.wait_for_timeout(500)
    u = art(A, "UREA INVENTADA")
    caso("se da de alta la urea, en ceros", u and (u.get("existencia") or 0) == 0, u)
    A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(300); campo(A, "Nombre").fill("urea  inventada"); campo(A, "Unidad").fill("kg"); A.locator(".card.ab .btn-accent").last.click(); A.wait_for_timeout(400)
    caso("otro artículo con el mismo nombre no se da de alta (partiría la existencia en dos)", len(datos(A)["inventario"]) == 1 and "Ya hay un artículo" in A.locator(".card.ab").inner_text(), [a.get("nombre") for a in datos(A)["inventario"]])
    def entrada(pg, cantidad, costo, prov="PROVEEDOR INVENTADO"):
        ir(pg, "inventario"); pg.locator(".top-bar .btn-outline").first.click(); pg.wait_for_timeout(300)
        campo(pg, "Insumo").select_option(index=1); campo(pg, "Cantidad").fill(str(cantidad)); campo(pg, "Proveedor").fill(prov)
        if costo is not None: campo(pg, "Costo total").fill(str(costo))
        pg.get_by_role("button", name="Registrar Entrada").click(); pg.wait_for_timeout(700)
    c0 = A.evaluate(CUENTAS)
    entrada(A, 10, 5000)
    u = art(A, "UREA INVENTADA"); c1 = A.evaluate(CUENTAS); en = de(A, "alm_entrada"); t = plano(A.locator("body").inner_text())
    caso("entran 10 bultos por $5,000: la existencia se calcula de un movimiento (nadie escribió el número)", u["existencia"] == 10 and len(en) == 1 and en[0]["datos"]["cantidad"] == 10 and en[0]["datos"].get("costoUnit") == 500, [u.get("existencia"), [e["datos"] for e in en]])
    caso("y se ve en pantalla: 10 bultos", "10 bulto" in t, t[:400])
    caso("comprar para el almacén NO es gasto: el resultado no cambia y el inventario vale $5,000", c1["egresos"] == c0["egresos"] and c1["inv"]["valor"] == 5000 and c1["inv"]["comprado"] == 5000, c1)
    caso("el dinero sí salió: el flujo cuenta $5,000 de compras para el almacén", c1["sale"] == 5000 and c1["detalle"].get("almacen") == 5000, c1["detalle"])

    # ══ 2. La misma compra, pagada de la caja chica: no se cuenta dos veces ══
    ir(A, "caja"); A.get_by_role("button", name="+ Movimiento").click(); A.wait_for_timeout(250)
    A.locator(".option-card", has_text="Entrada").first.click(); campo(A, "Concepto").fill("FONDO INVENTADO"); campo(A, "Monto").fill("8000"); A.get_by_role("button", name="Guardar movimiento").click(); A.wait_for_timeout(500)
    A.get_by_role("button", name="+ Movimiento").click(); A.wait_for_timeout(250)
    A.locator(".option-card", has_text="Salida").first.click(); campo(A, "Concepto").fill("UREA DEL PROVEEDOR INVENTADO"); A.get_by_label("Qué fue esta salida").select_option("inventario"); campo(A, "Monto").fill("5000")
    A.get_by_role("button", name="Guardar movimiento").click(); A.wait_for_timeout(700)
    c = A.evaluate(CUENTAS)
    caso("la salida de caja «para el almacén» deja su gasto ligado, que no es gasto del resultado", len(datos(A)["egresos"]) == 1 and c["egresos"] == c0["egresos"], [len(datos(A)["egresos"]), c["egresos"]])
    ir(A, "inventario"); tab(A, "Entradas"); t = plano(A.locator("body").inner_text())
    caso("Inventario avisa que esa entrada parece la misma compra que el gasto de caja, y deja decirlo", "misma compra" in t.lower(), t[:700])
    antes = c["sale"]
    if A.get_by_role("button", name="Es la misma compra").count():
        A.get_by_role("button", name="Es la misma compra").first.click(); A.wait_for_timeout(600)
    c2 = A.evaluate(CUENTAS)
    caso("dicho que es la misma, el dinero se cuenta UNA vez: salieron $5,000 y el inventario comprado es $5,000", c2["sale"] == 5000 and c2["inv"]["comprado"] == 5000 and c2["inv"]["valor"] == 5000, [antes, c2["sale"], c2["inv"]])
    caso("y la existencia no se movió: siguen 10 bultos", art(A, "UREA INVENTADA")["existencia"] == 10 and len(de(A, "alm_entrada")) == 1)

    # ══ 3. Usar: ahí nace el costo ══
    ir(A, "entregas"); tab(A, "Usar directo")
    A.get_by_label("Artículo").select_option(index=1); A.get_by_label("Cantidad").fill("3")
    A.get_by_role("button", name="Registrar el uso").click(); A.wait_for_timeout(300)
    caso("el uso directo exige decir en qué se usó", A.get_by_text("Falta decir en qué se usó").count() == 1 and len(de(A, "alm_consumo")) == 0)
    A.get_by_label("Para qué es").select_option("parcela"); A.get_by_label("Parcela", exact=True).select_option("p1"); A.get_by_label("Actividad").select_option("Fertilización")
    A.get_by_role("button", name="Registrar el uso").click(); A.wait_for_timeout(700)
    co = de(A, "alm_consumo"); c3 = A.evaluate(CUENTAS); u = art(A, "UREA INVENTADA")
    caso("se usan 3 bultos en la parcela, a su costo promedio de $500", len(co) == 1 and co[0]["datos"]["cantidad"] == 3 and co[0]["datos"]["costoUnit"] == 500 and u["existencia"] == 7, [u["existencia"], [e["datos"].get("costoUnit") for e in co]])
    caso("AHÍ nace el costo: el resultado sube $1,500 y el inventario baja a $3,500", c3["egresos"] == c0["egresos"] + 1500 and c3["inv"]["valor"] == 3500, [c3["egresos"], c3["inv"]])
    caso("usar no es otra salida de dinero: el flujo sigue en $5,000", c3["sale"] == 5000, c3["detalle"])
    ir(A, "contabilidad"); tab(A, "Resultados"); t = plano(A.locator("body").inner_text())
    caso("Finanzas lo enseña: insumos usados $1,500 como costo de producción", "$1,500" in t and "nsumos" in t, t[:900])

    # ══ 4. Conteo a ciegas y merma ══
    ir(A, "vales"); t = plano(A.locator("body").inner_text())
    caso("el conteo es a ciegas: la pantalla no enseña cuánto dice el sistema", "7 bulto" not in t and "(7" not in t, t[:400])
    A.get_by_label("Artículo").select_option(index=1); A.get_by_label("Lo que contaste").fill("6"); A.get_by_role("button", name="Comparar").click(); A.wait_for_timeout(300)
    t = plano(A.locator(".card.ab").inner_text())
    caso("sólo después de capturar lo contado dice que el sistema tenía 7", "el sistema dice 7" in t and "NO CUADRA" in t.upper(), t[:500])
    A.get_by_role("button", name="Registrar conteo").click(); A.wait_for_timeout(400)
    caso("un conteo que no cuadra no se registra sin causa", len(de(A, "alm_conteo")) == 0, plano(A.locator(".card.ab").inner_text())[-200:])
    A.get_by_label("¿Por qué no cuadra?").select_option(index=1); A.get_by_role("button", name="Registrar conteo").click(); A.wait_for_timeout(700)
    cn = de(A, "alm_conteo"); u = art(A, "UREA INVENTADA"); c4 = A.evaluate(CUENTAS)
    caso("el conteo deja la existencia en lo contado (6) con su causa", len(cn) == 1 and u["existencia"] == 6 and cn[0]["datos"].get("causa"), [u["existencia"], cn[0]["datos"] if cn else None])
    caso("el faltante vale $500: el inventario baja a $3,000 y no se vuelve salida de dinero", c4["inv"]["valor"] == 3000 and c4["sale"] == 5000, [c4["inv"], c4["sale"], c4["egresos"]])
    tab(A, "Mermas"); A.get_by_role("button", name="Registrar merma").click(); A.wait_for_timeout(300)
    caso("una merma sin artículo, cantidad ni causa no se registra", len(de(A, "alm_ajuste")) == 0, plano(A.locator(".card.ab").inner_text())[-200:])
    A.get_by_label("Artículo de la merma").select_option(index=1); A.get_by_label("Cuánto se perdió").fill("1"); A.get_by_role("button", name="Registrar merma").click(); A.wait_for_timeout(300)
    caso("ni sin causa", len(de(A, "alm_ajuste")) == 0)
    A.get_by_label("Causa de la merma").select_option(index=1); A.get_by_label("Nota de la merma").fill("SE MOJO INVENTADO"); A.get_by_role("button", name="Registrar merma").click(); A.wait_for_timeout(700)
    aj = de(A, "alm_ajuste"); u = art(A, "UREA INVENTADA"); t = plano(A.locator("body").inner_text())
    caso("la merma con causa baja la existencia a 5 y queda en la lista de mermas con su importe", len(aj) == 1 and u["existencia"] == 5 and "SE MOJO INVENTADO" in json.dumps(aj[0], ensure_ascii=False), [u["existencia"], t[-500:]])
    c5 = A.evaluate(CUENTAS)
    caso("el inventario vale 5 × $500 = $2,500", c5["inv"]["valor"] == 2500, c5["inv"])
    subio(A)

    # ══ 5. El encargado pide; el administrador registra la compra ══
    B = aparato(ENC, "10:00"); hora(B)
    caso("el encargado ve en su aparato los mismos 5 bultos", (art(B, "UREA INVENTADA") or {}).get("existencia") == 5, art(B, "UREA INVENTADA"))
    ir(B, "solicitudes"); B.get_by_role("button", name="+ Nueva solicitud").click(); B.wait_for_timeout(300)
    B.get_by_role("button", name="Enviar solicitud").click(); B.wait_for_timeout(300)
    caso("una solicitud sin productos no se manda", len(datos(B)["solicitudes_compra"]) == 0, B.dialogos[-1:])
    B.get_by_placeholder("Ej: Urea, Glifosato, semilla...").fill("UREA INVENTADA"); campo(B, "Cantidad").fill("4"); B.get_by_placeholder("kg, L, pza...").fill("bulto")
    B.get_by_role("button", name="+ Agregar a la lista").click(); B.wait_for_timeout(300); B.get_by_role("button", name="Enviar solicitud").click(); B.wait_for_timeout(600)
    so = datos(B)["solicitudes_compra"]
    caso("la solicitud queda pendiente, con quién la pidió; pedir no mueve existencias ni dinero", len(so) == 1 and so[0]["estado"] == "pendiente" and "ENCARGADO" in json.dumps(so[0]) and art(B, "UREA INVENTADA")["existencia"] == 5 and B.evaluate(CUENTAS)["sale"] == 5000, so)
    ir(B, "solicitudes"); B.get_by_text("UREA INVENTADA").first.click(); B.wait_for_timeout(400)
    caso("al encargado no se le ofrece registrar la compra", B.get_by_role("button", name="Confirmar compra y mover inventario").count() == 0)
    subio(B)
    recarga(A); ir(A, "solicitudes"); A.get_by_text("UREA INVENTADA").first.click(); A.wait_for_timeout(400)
    A.get_by_role("button", name="Confirmar compra y mover inventario").click(); A.wait_for_timeout(400)
    campo(A, "Costo total ($)").fill("2400"); campo(A, "Proveedor").fill("PROVEEDOR INVENTADO"); A.get_by_role("button", name="Confirmar e ingresar").click(); A.wait_for_timeout(1200)
    u = art(A, "UREA INVENTADA"); c6 = A.evaluate(CUENTAS); so = datos(A)["solicitudes_compra"]
    caso("registrada la compra: entran 4 bultos y hay 9; la solicitud queda comprada", u["existencia"] == 9 and so[0]["estado"] == "comprada", [u["existencia"], so[0]["estado"], [e["datos"] for e in de(A, "alm_entrada")]])
    caso("el dinero sale UNA vez: $2,400 más (van $7,400)", c6["sale"] == 7400 and c6["inv"]["comprado"] == 7400, [c6["sale"], c6["detalle"], c6["inv"]])
    caso("el inventario vale $2,500 + $2,400 = $4,900 exactos, y comprar más caro NO le cambia el importe a la merma ni al faltante de la mañana", c6["inv"]["valor"] == 4900 and c6["egresos"] == c5["egresos"], [c6["inv"], c6["egresos"], c5["egresos"]])
    A.wait_for_timeout(300); ir(A, "solicitudes"); A.get_by_text("UREA INVENTADA").first.click(); A.wait_for_timeout(400)
    caso("una solicitud ya comprada no se puede comprar otra vez", A.get_by_role("button", name="Confirmar compra y mover inventario").count() == 0)
    subio(A)

    # ══ 6. La compra de un trabajador: aprobar no la mete al almacén ══
    idU = art(A, "UREA INVENTADA")["id"]
    nube.t.setdefault("compras", {})["co1"] = {"id": "co1", "fecha": HOY, "monto": 1300, "estado": "pendiente", "datos": {"trabajadorId": "t-x", "tipoTrab": "trabajador", "descripcion": "DOS BULTOS Y FLETE INVENTADOS", "proveedor": "LA CENTRAL INVENTADA",
        "afectaInventario": True, "items": [{"nombre": "UREA INVENTADA", "insumoId": idU, "cantidad": 2}], **E}, "actualizado": nube.ahora() if hasattr(nube, "ahora") else "2026-11-19T17:00:00Z"}
    avanza(A, 6 / 60); recarga(A)
    cm = datos(A)["compras"]
    caso("al administrador le llega la compra del trabajador, pendiente", len(cm) == 1 and cm[0]["estado"] == "pendiente", cm)
    ir(A, "contabilidad"); tab(A, "Compras"); A.get_by_role("button", name="✓ Aprobar").click(); A.wait_for_timeout(600)
    c7 = A.evaluate(CUENTAS); u = art(A, "UREA INVENTADA")
    caso("aprobar valida el gasto y NO mete nada al almacén: siguen 9 bultos", u["existencia"] == 9 and datos(A)["compras"][0]["estado"] == "aprobada", u["existencia"])
    caso("el dinero de esa compra sale completo, una vez ($1,300)", c7["sale"] == 8700 and c7["detalle"].get("compras") == 1300, c7["detalle"])
    caso("y mientras no se reciba no es gasto ni inventario: está por valuar", c7["inv"].get("porValuar") == 1300 and c7["egresos"] == c6["egresos"], [c7["inv"], c7["egresos"]])
    A.get_by_role("button", name="Recibir UREA INVENTADA").click(); A.wait_for_timeout(700)
    u = art(A, "UREA INVENTADA"); c8 = A.evaluate(CUENTAS)
    caso("recibida sin precio: ya hay 11 bultos; los 2 nuevos no valen cero ni se valúan al promedio: están pendientes de valoración", u["existencia"] == 11 and c8["inv"]["valor"] == 4900 and c8["inv"].get("porValuar") == 1300 and c8["egresos"] == c6["egresos"], [u["existencia"], c8["inv"]])
    A.get_by_role("button", name="Recibir UREA INVENTADA").count() == 0
    A.get_by_label("Precio por valuar de UREA INVENTADA").fill("600"); A.get_by_role("button", name="Valuar UREA INVENTADA").click(); A.wait_for_timeout(700)
    c9 = A.evaluate(CUENTAS)
    caso("valuada a $600: $1,200 son inventario ($6,100 en total) y los $100 del flete son gasto", c9["inv"]["valor"] == 6100 and (c9["inv"].get("porValuar") or 0) == 0 and c9["egresos"] == c6["egresos"] + 100, [c9["inv"], c9["egresos"], c6["egresos"]])
    caso("y el flujo no cambió al recibir ni al valuar: $8,700", c9["sale"] == 8700, c9["detalle"])
    subio(A)

    # ══ 7. Recarga, otro aparato, otros perfiles ══
    recarga(A); cr = A.evaluate(CUENTAS); u = art(A, "UREA INVENTADA")
    caso("después de recargar: 11 bultos, inventario $6,100, flujo $8,700, mismo resultado", u["existencia"] == 11 and cr["inv"]["valor"] == 6100 and cr["sale"] == 8700 and cr["egresos"] == c9["egresos"], [u["existencia"], cr["inv"], cr["sale"]])
    avanza(B, 1); recarga(B); uB = art(B, "UREA INVENTADA")
    caso("el encargado ve lo mismo en su aparato: 11 bultos", uB and uB["existencia"] == 11, uB and uB.get("existencia"))
    D = aparato(DIR, "17:00"); hora(D); cD = D.evaluate(CUENTAS)
    caso("Dirección ve el mismo inventario, el mismo flujo y el mismo resultado", [cD["inv"]["valor"], cD["sale"], cD["egresos"]] == [6100, 8700, cr["egresos"]], [cD["inv"], cD["sale"], cD["egresos"]])
    # dos aparatos sin señal usan del mismo artículo: los dos usos cuentan
    nube.caida = True
    for pg, n in ((A, "2"), (B, "1")):
        ir(pg, "entregas"); tab(pg, "Usar directo"); pg.get_by_label("Artículo").select_option(index=1); pg.get_by_label("Cantidad").fill(n)
        pg.get_by_label("Para qué es").select_option("parcela"); pg.get_by_label("Parcela", exact=True).select_option("p1"); pg.get_by_label("Actividad").select_option("Fertilización")
        pg.get_by_role("button", name="Registrar el uso").click(); pg.wait_for_timeout(700)
    nube.caida = False
    for pg in (A, B): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, B): avanza(pg, 3 / 60); recarga(pg)
    uA = art(A, "UREA INVENTADA"); uB = art(B, "UREA INVENTADA")
    caso("dos aparatos sin señal usaron 2 y 1: al volver la señal quedan 8 en los dos, ninguno pisó al otro", uA["existencia"] == 8 and uB["existencia"] == 8, [uA["existencia"], uB["existencia"]])

    caso("la base no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
