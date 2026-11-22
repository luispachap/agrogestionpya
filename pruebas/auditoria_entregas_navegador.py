"""AUDITORÍA FUNCIONAL · ENTREGAS DEL ALMACÉN A UNA PERSONA Y SU CIERRE, con cuentas, como una persona, 390 px.
El encargado entrega a una trabajadora para una parcela → nadie gasta todavía → se cierra (usó / regresó) → ahí nace el
costo. Y lo difícil: los dos teléfonos cierran LA MISMA entrega sin señal. Datos inventados, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_entregas_navegador.py"""
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


    def elige(pg, etiqueta, texto):
        sel = pg.get_by_label(etiqueta, exact=True) if etiqueta == "Parcela" else pg.get_by_label(etiqueta)
        v = sel.evaluate("(s, t) => [...s.options].find(o => o.textContent.includes(t))?.value", texto); sel.select_option(v); return v
    def cierra(pg, uso, regreso):
        ir(pg, "entregas"); pg.locator(".tab-pill", has_text="Por cerrar").first.click(); pg.wait_for_timeout(400)
        u = pg.locator(".card", has_text="UREA INVENTADA").first; u.get_by_role("button", name="Cerrar: se usó o regresó").click(); pg.wait_for_timeout(300)
        pg.get_by_label("Se usó").fill(str(uso)); pg.get_by_label("Regresó al almacén").fill(str(regreso)); pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(700)

    # ══ 0. Lo que hay ══
    A = aparato(ADM, "06:30")
    ir(A, "equipo"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre completo").fill("ANA INVENTADA"); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill("4101"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    ir(A, "inventario"); A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(300)
    campo(A, "Nombre").fill("UREA INVENTADA"); campo(A, "Unidad").fill("bulto"); A.locator(".card.ab .btn-accent").last.click(); A.wait_for_timeout(500)
    A.locator(".top-bar .btn-outline").first.click(); A.wait_for_timeout(300)
    campo(A, "Insumo").select_option(index=1); campo(A, "Cantidad").fill("10"); campo(A, "Proveedor").fill("PROVEEDOR INVENTADO"); campo(A, "Costo total").fill("5000")
    A.get_by_role("button", name="Registrar Entrada").click(); A.wait_for_timeout(700)
    subio(A); c0 = A.evaluate(CUENTAS)

    # ══ 1. El encargado entrega a una persona ══
    B = aparato(ENC, "07:00"); hora(B)
    ir(B, "entregas"); elige(B, "Artículo", "UREA INVENTADA"); B.get_by_label("Cantidad").fill("6")
    B.locator("button.btn-accent", has_text="Entregar").click(); B.wait_for_timeout(300)
    caso("no se entrega sin decir quién lo recibe", B.get_by_text("Falta decir quién lo recibe").count() == 1 and len(de(B, "alm_retiro")) == 0)
    elige(B, "Quién lo recibe", "ANA INVENTADA"); B.get_by_label("Para qué es").select_option("parcela"); elige(B, "Parcela", "PARCELA UNO"); B.get_by_label("Actividad").select_option("Fertilización")
    B.locator("button.btn-accent", has_text="Entregar").click(); B.wait_for_timeout(700)
    r = de(B, "alm_retiro"); c1 = B.evaluate(CUENTAS)
    caso("la entrega queda a cargo de Ana, para la parcela, con quién la entregó", len(r) == 1 and r[0]["datos"]["recibe"]["nombre"] == "ANA INVENTADA" and r[0]["datos"]["cantidad"] == 6 and r[0]["quien"]["nombre"] == "ENCARGADO DE PRUEBA", r[0]["datos"] if r else None)
    caso("entregar no es gastar: el resultado no cambia, no sale dinero y el inventario sigue valiendo $5,000", c1["egresos"] == c0["egresos"] and c1["sale"] == c0["sale"] and c1["inv"]["valor"] == 5000, c1)
    B.locator(".tab-pill", has_text="Qué hay").first.click(); B.wait_for_timeout(300); t = plano(B.locator(".card", has_text="UREA INVENTADA").first.inner_text())
    caso("en el almacén quedan 4 y se ve quién trae los otros 6", "4 bulto" in t and "ANA INVENTADA" in t, t[:200])
    subio(B)
    avanza(A, 0.6); recarga(A); ir(A, "entregas"); A.locator(".tab-pill", has_text="Por cerrar").first.click(); A.wait_for_timeout(400)
    caso("el administrador lo ve por cerrar en su aparato", "UREA INVENTADA" in A.locator("body").inner_text() and "ANA INVENTADA" in A.locator("body").inner_text(), plano(A.locator("body").inner_text())[:300])

    # ══ 2. Los dos cierran LA MISMA entrega sin señal ══
    avanza(A, 6); avanza(B, 6.6)
    nube.caida = True
    cierra(B, 4, 2); cierra(A, 4, 2)
    caso("sin señal, cada teléfono ve su cierre: se usaron 4 y regresaron 2 (quedan 6 en el almacén)", all(art(pg, "UREA INVENTADA")["existencia"] == 6 for pg in (A, B)), [art(pg, "UREA INVENTADA")["existencia"] for pg in (A, B)])
    nube.caida = False
    for pg in (A, B): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, B): avanza(pg, 6 / 60); recarga(pg)
    for pg in (A, B): avanza(pg, 3 / 60); recarga(pg)
    cA, cB = A.evaluate(CUENTAS), B.evaluate(CUENTAS); uA, uB = art(A, "UREA INVENTADA"), art(B, "UREA INVENTADA")
    consumos = [e for e in datos(A)["eventos"] if e["tipo"] == "alm_consumo" and e.get("estado", "vigente") == "vigente"]
    caso("los dos teléfonos dan la misma cuenta", [cA["egresos"], cA["inv"]["valor"], uA["existencia"]] == [cB["egresos"], cB["inv"]["valor"], uB["existencia"]], [[cA["egresos"], cA["inv"], uA["existencia"]], [cB["egresos"], cB["inv"], uB["existencia"]]])
    caso("lo usado se le carga a la parcela UNA vez: 4 bultos a $500 = $2,000 (no $4,000)", cA["egresos"] == c0["egresos"] + 2000, [c0["egresos"], cA["egresos"], [[e["id"], e["datos"].get("cantidad"), e.get("origen")] for e in consumos]])
    caso("y en el almacén hay 6 bultos, que valen $3,000: no 8, ni 2", uA["existencia"] == 6 and cA["inv"]["valor"] == 3000, [uA["existencia"], cA["inv"]])
    ir(A, "entregas"); A.locator(".tab-pill", has_text="Por cerrar").first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("la entrega ya no está por cerrar, y el cierre doble no se esconde: queda «por revisar» para que una persona lo vea", "Nadie trae nada del almacén" in t and "Por revisar (2)" in t, t[:500])
    A.locator(".tab-pill", has_text="Por revisar").first.click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("y «Por revisar» dice qué pasó con esa entrega", "UREA INVENTADA" in t, t[:700])
    caso("usar no fue salida de dinero", cA["sale"] == c0["sale"], [c0["sale"], cA["sale"]])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
