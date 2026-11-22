"""AUDITORÍA FUNCIONAL · COMPRA Y APLICACIÓN DEL AGRÓNOMO, usando la app como una persona desde un teléfono (390 px).
Registrar compra (insumo nuevo y existente) → Aplicaciones (producto del inventario) → existencia, valor del inventario,
costo de la parcela y flujo de efectivo. Con recarga, el aparato del administrador y otro perfil. Datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_agronomo_navegador.py"""
import datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); AGR = N.cuenta(5, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")
ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, AGR, ENC])
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
  return JSON.parse(JSON.stringify({ sale: f.egresos, detalle: d, egresos: r.egresos, inv: r.inventario })); }"""
def art(pg, nombre): return next((a for a in datos(pg)["inventario"] if a["nombre"] == nombre), None)

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
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept()))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    def recarga(pg): hora(pg); pg.reload(); pg.wait_for_timeout(3500)

    # ══ 1. El agrónomo registra una compra de un insumo nuevo ══
    G = aparato(AGR)
    def compra(pg, cantidad, costo, nuevo=None):
        ir(pg, "compras-insumos")
        if pg.get_by_role("button", name="Registrar compra").count() == 0 and pg.locator(".top-bar .btn-accent").count(): pg.locator(".top-bar .btn-accent").click(); pg.wait_for_timeout(300)
        if nuevo: campo(pg, "Insumo").select_option("__nuevo__"); pg.wait_for_timeout(200); campo(pg, "Nombre del nuevo insumo").fill(nuevo); campo(pg, "Unidad").select_option("L")
        else: campo(pg, "Insumo").select_option(index=1)
        if cantidad is not None: campo(pg, "Cantidad").fill(str(cantidad))
        if costo is not None: campo(pg, "Costo total ($)").fill(str(costo))
        campo(pg, "Proveedor").fill("PROVEEDOR INVENTADO"); pg.get_by_role("button", name="Registrar compra").last.click(); pg.wait_for_timeout(800)
    compra(G, None, None, "FOLIAR INVENTADO")
    caso("una compra sin cantidad ni costo no se registra", len(datos(G)["inventario"]) == 0 and len(datos(G)["egresos"]) == 0, G.dialogos[-1:])
    compra(G, 20, 4000, "FOLIAR INVENTADO")
    f = art(G, "FOLIAR INVENTADO"); c1 = G.evaluate(CUENTAS)
    caso("compra de 20 L por $4,000: el insumo queda dado de alta con 20 L a $200", f and f["existencia"] == 20 and f["costo_unit"] == 200, f)
    caso("comprar no es gastar: el resultado sigue en $0, el inventario vale $4,000 y el dinero salió una vez", c1["egresos"] == 0 and c1["inv"]["valor"] == 4000 and c1["sale"] == 4000 and c1["inv"]["comprado"] == 4000, c1)
    compra(G, 5, 1000, "foliar  inventado")
    caso("el mismo insumo no se da de alta dos veces con otro nombre parecido", len(datos(G)["inventario"]) == 1 and "Ya hay un artículo" in (G.dialogos[-1] if G.dialogos else ""), G.dialogos[-1:])
    compra(G, 10, 2500)
    f = art(G, "FOLIAR INVENTADO"); c2 = G.evaluate(CUENTAS)
    caso("otra compra del mismo insumo: 30 L, y su costo promedio sube a $216.67", f["existencia"] == 30 and abs(f["costo_unit"] - 216.6667) < 0.01, f)
    caso("el inventario vale $6,500 exactos y han salido $6,500", c2["inv"]["valor"] == 6500 and c2["sale"] == 6500 and c2["egresos"] == 0, c2)

    # ══ 2. Una aplicación con ese producto ══
    ir(G, "aplicaciones"); G.get_by_role("button", name="+ Nueva").click(); G.wait_for_timeout(300)
    G.get_by_role("button", name="Guardar aplicación").click(); G.wait_for_timeout(300)
    caso("una aplicación sin parcela ni producto no se guarda", len(datos(G)["aplicaciones"]) == 0, G.dialogos[-1:])
    G.locator("select.inp").first.select_option("p1")
    campo(G, "Vincular a insumo del inventario").select_option(index=1); G.wait_for_timeout(200); campo(G, "Dosis").fill("3")
    G.get_by_role("button", name="+ Agregar a la lista").click(); G.wait_for_timeout(300)
    G.get_by_role("button", name="Guardar aplicación").click(); G.wait_for_timeout(500)
    t = plano(G.locator("body").inner_text())
    caso("sin decir quién aplicó, la pantalla lo advierte antes de guardar", len(datos(G)["aplicaciones"]) == 0 and G.get_by_role("button", name="Guardar sin aplicadores").count() == 1, t[-400:])
    G.get_by_role("button", name="Guardar sin aplicadores").click(); G.wait_for_timeout(900)
    ap = datos(G)["aplicaciones"]; f = art(G, "FOLIAR INVENTADO"); c3 = G.evaluate(CUENTAS); eg = [e for e in datos(G)["egresos"] if e.get("aplicacionId")]
    caso("la aplicación queda guardada, sin aplicadores identificados y con quién la registró", len(ap) == 1 and not ap[0].get("ejecutores") and ap[0].get("registradoPor"), ap[0] if ap else None)
    caso("se descontaron 6 L (3 L/ha × 2 ha): quedan 24", f["existencia"] == 24, f["existencia"])
    caso("su costo ($1,300) se cargó a la parcela, UNA vez", len(eg) == 1 and eg[0]["monto"] == 1300 and eg[0]["parcelaId"] == "p1" and c3["egresos"] == 1300, [eg, c3["egresos"]])
    caso("aplicar lo que ya estaba en el almacén no es dinero que sale otra vez: el flujo sigue en $6,500", c3["sale"] == 6500, c3["detalle"])
    caso("y el inventario baja a $5,200", c3["inv"]["valor"] == 5200, c3["inv"])
    ir(G, "aplicaciones"); t = plano(G.locator("body").inner_text())
    caso("el historial la enseña con su parcela y «Sin aplicadores identificados»", "PARCELA UNO" in t and "Sin aplicadores identificados" in t, t[:500])
    subio(G)

    # ══ 3. Recarga y el aparato del administrador ══
    recarga(G); cr = G.evaluate(CUENTAS); f = art(G, "FOLIAR INVENTADO")
    caso("después de recargar: 24 L, inventario $5,200, costo $1,300, flujo $6,500", f["existencia"] == 24 and [cr["inv"]["valor"], cr["egresos"], cr["sale"]] == [5200, 1300, 6500], [f["existencia"], cr])
    A = aparato(ADM, "12:00"); hora(A); cA = A.evaluate(CUENTAS); fA = art(A, "FOLIAR INVENTADO")
    caso("el administrador ve lo mismo en su aparato", fA and fA["existencia"] == 24 and [cA["inv"]["valor"], cA["egresos"], cA["sale"]] == [5200, 1300, 6500], [fA and fA["existencia"], cA])
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("Finanzas: $1,300 de costo de producción, inventario $5,200, comprado $6,500", "$1,300" in t and "$5,200" in t and "$6,500" in t, t[:900])
    A.locator(".tab-pill", has_text="Flujo de efectivo").click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("y el flujo dice que salieron $6,500, no $7,800", "$6,500" in t and "$7,800" not in t, t[:500])
    B = aparato(ENC, "12:30"); hora(B)
    ir(B, "compras-insumos"); B.wait_for_timeout(400)
    caso("el encargado no tiene «Registrar compra»", B.get_by_role("button", name="Registrar compra").count() == 0, plano(B.locator("body").inner_text())[:200])

    # ══ 4. Integridad histórica: comprar después, mucho más caro, no le cambia el costo a la aplicación ya hecha ══
    compra(G, 10, 9000)
    cz = G.evaluate(CUENTAS); eg = [e for e in datos(G)["egresos"] if e.get("aplicacionId")]; f = art(G, "FOLIAR INVENTADO")
    caso("el promedio de hoy ya es otro ($417.65 por litro)…", abs(f["costo_unit"] - (5200 + 9000) / 34) < 0.01 and f["existencia"] == 34, [f["existencia"], f["costo_unit"]])
    caso("…y la aplicación de la mañana sigue costando $1,300: lo ya registrado no se recalcula", len(eg) == 1 and eg[0]["monto"] == 1300 and cz["egresos"] == 1300, [eg[0]["monto"], cz["egresos"]])
    caso("el inventario vale lo que había más lo comprado: $14,200", cz["inv"]["valor"] == 14200, cz["inv"])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
