"""AUDITORÍA FUNCIONAL · PROVEEDORES Y DEUDAS, usando la app como una persona desde un teléfono (Pixel 7 y Galaxy S9+
imitados). Directorio, crédito recibido, abonos en dinero y en especie, cancelar un abono (no borrarlo), cancelar el
crédito, flujo de efectivo, bitácora, recargar, dos aparatos y uno de ellos sin señal, y otros perfiles.
Datos inventados, nube de imitación: no toca producción.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_proveedores_navegador.py"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
DIR = N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno"); FIN = N.cuenta(4, "finanzas@prueba.invalid", "FINANZAS DE PRUEBA", "finanzas")
nube = N.Nube([ADM, ENC, DIR, FIN])
E = {"_espacio": "localhost"}
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": "2026-11-01T00:00:00Z"}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", "emoji": "🌾", **E}, "actualizado": "2026-11-01T00:00:00Z"}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg):
    for _ in range(60):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
FLUJO = "() => { const f = window.__agroCuentas().flujo; const d = {}; for (const m of f.meses) for (const k in m.detalle) d[k] = Math.round(((d[k] || 0) + m.detalle[k]) * 100) / 100; return JSON.parse(JSON.stringify({ ingresos: f.ingresos, egresos: f.egresos, detalle: d })); }"
CRED = "() => JSON.parse(JSON.stringify(window.__agroDatos.creditos || []))"
def enNube(tabla): return [dict(v.get("datos") or {}, id=v["id"]) for v in nube.t.get(tabla, {}).values()]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def telefono(cuenta, modelo="Pixel 7"):
        ctx = b.new_context(**{k: v for k, v in p.devices[modelo].items() if k != "default_browser_type"}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.contesta = "Se capturó dos veces"
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.contesta) if d.type == "prompt" else d.accept()))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = telefono(ADM)

    # ── Directorio ──
    ir(A, "proveedores"); A.locator(".tab-pill", has_text="Directorio").click(); A.wait_for_timeout(300)
    A.locator(".top-bar button", has_text="+").click(); A.wait_for_timeout(300); A.get_by_role("button", name="Guardar", exact=True).click(); A.wait_for_timeout(300)
    caso("un proveedor sin nombre no se guarda y la app lo dice", len(A.evaluate("() => window.__agroDatos.proveedores || []")) == 0 and any("nombre" in d.lower() for d in A.dialogos), A.dialogos[-2:])
    campo(A, "Nombre / Razón social").fill("AGROQUIMICOS INVENTADOS"); campo(A, "Teléfono").fill("4490000000"); A.get_by_role("button", name="Guardar", exact=True).click(); A.wait_for_timeout(500)
    t = plano(A.locator("body").inner_text()); pv = A.evaluate("() => window.__agroDatos.proveedores")
    caso("el proveedor queda en el directorio con su teléfono", len(pv) == 1 and "AGROQUIMICOS INVENTADOS" in t and pv[0]["telefono"] == "4490000000", t[:300])

    # ── Crédito recibido ──
    f0 = A.evaluate(FLUJO)
    A.locator(".tab-pill", has_text="Créditos").click(); A.wait_for_timeout(300); A.locator(".top-bar button", has_text="+").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Registrar crédito").click(); A.wait_for_timeout(300)
    caso("un crédito sin proveedor ni monto no se guarda", len(A.evaluate(CRED)) == 0)
    campo(A, "Proveedor / Acreedor").select_option(pv[0]["id"]); campo(A, "Concepto").fill("FERTILIZANTE A CREDITO"); campo(A, "Monto del crédito").fill("10000")
    A.get_by_role("button", name="90 d").click(); A.get_by_role("button", name="Registrar crédito").click(); A.wait_for_timeout(600)
    cr = A.evaluate(CRED); t = plano(A.locator("body").inner_text()); f1 = A.evaluate(FLUJO)
    caso("el crédito de $10,000 queda con vencimiento a 90 días y la deuda total dice $10,000", len(cr) == 1 and cr[0]["monto"] == 10000 and cr[0].get("vencimiento") and "DEUDA TOTAL PENDIENTE | $10,000" in t.upper(), t[:300])
    caso("recibir un crédito pagadero en dinero entra al flujo como dinero recibido (+$10,000), no como venta", f1["detalle"].get("creditos") == 10000 and f1["detalle"].get("ventas") is None, f1)

    # ── Abonos ──
    A.locator(".card", has_text="FERTILIZANTE A CREDITO").first.click(); A.wait_for_timeout(400)
    def abonar(pg, monto, especie=False):
        pg.get_by_role("button", name="+ Registrar abono").click(); pg.wait_for_timeout(300)
        if especie: pg.locator(".option-card", has_text="especie").first.click(); campo(pg, "Cultivo entregado").fill("AJO"); campo(pg, "Cantidad").fill("100")
        campo(pg, "Valor del abono").fill(str(monto)); pg.get_by_role("button", name="Registrar abono", exact=True).click(); pg.wait_for_timeout(500)
    abonar(A, 0)
    caso("un abono de cero no se registra", len(A.evaluate(CRED)[0]["abonos"]) == 0)
    if A.get_by_role("button", name="Cancelar", exact=True).count(): A.get_by_role("button", name="Cancelar", exact=True).click(); A.wait_for_timeout(200)
    abonar(A, 3000); abonar(A, 2000)
    cr = A.evaluate(CRED)[0]; f2 = A.evaluate(FLUJO); t = plano(A.locator("body").inner_text())
    caso("dos abonos en dinero ($3,000 y $2,000): el saldo baja a $5,000 y el flujo dice que salieron $5,000", len(cr["abonos"]) == 2 and "$5,000" in t and f2["detalle"].get("abonos_creditos") == 5000, [t[:300], f2])
    abonar(A, 1000, especie=True)
    cr = A.evaluate(CRED)[0]; f3 = A.evaluate(FLUJO); ing = A.evaluate("() => window.__agroDatos.ingresos || []")
    caso("un abono en especie de $1,000 baja la deuda a $4,000, deja una venta de $1,000 y NO es dinero que sale ni que entra", len(cr["abonos"]) == 3 and len(ing) == 1 and ing[0]["monto"] == 1000 and ing[0].get("abonoId") and f3["detalle"].get("abonos_creditos") == 5000 and f3["ingresos"] == 10000, [ing[:1], f3])

    # ── Un abono no se borra: se cancela con motivo ──
    A.pg_antes = len(A.dialogos)
    A.get_by_label("Cancelar el abono de $2,000").click(); A.wait_for_timeout(600)
    cr = A.evaluate(CRED)[0]; f4 = A.evaluate(FLUJO); t = plano(A.locator("body").inner_text())
    ab = [a for a in cr["abonos"] if a["monto"] == 2000][0]
    caso("cancelar un abono pide el motivo y NO lo borra: sigue en el historial, tachado, con quién y por qué", len(cr["abonos"]) == 3 and ab.get("cancelado") and ab.get("motivoCancelacion") == "Se capturó dos veces" and "ADMIN DE PRUEBA" in str(ab.get("canceladoPor")) and "Cancelado por" in t, [ab, t[-300:]])
    caso("el saldo regresa a $6,000 y el flujo a $3,000 de abonos", "$6,000" in t and f4["detalle"].get("abonos_creditos") == 3000, [t[:300], f4])
    caso("ya no existe el botón de eliminar un abono", "Eliminar este abono" not in " ".join(A.dialogos) and A.get_by_label("Cancelar el abono de $2,000").count() == 0)
    A.get_by_label("Cancelar el abono de $1,000").click(); A.wait_for_timeout(600)
    ing = A.evaluate("() => window.__agroDatos.ingresos"); cr = A.evaluate(CRED)[0]
    caso("cancelar el abono en especie cancela también su venta: la deuda vuelve a $7,000 y la venta deja de contar", ing[0].get("cancelado") and A.evaluate("() => window.__agroCuentas().resultado.ingresos") == 0 and "$7,000" in plano(A.locator("body").inner_text()), ing[0])
    subio(A); bit = enNube("auditoria")
    caso("las dos cancelaciones quedaron en la bitácora de la nube con su motivo", sum("Se capturó dos veces" in json.dumps(x, ensure_ascii=False) for x in bit) >= 2, [json.dumps(x, ensure_ascii=False)[:200] for x in bit])
    ir(A, "bitacora"); t = plano(A.locator("body").inner_text())
    caso("la pantalla Bitácora las enseña", "Abono de $2,000" in t and "Se capturó dos veces" in t, t[:500])

    # ── Que siga ahí: recargar ──
    A.reload(); A.wait_for_timeout(3500); cr2 = A.evaluate(CRED)[0]
    caso("al recargar: el mismo crédito, los tres abonos (dos cancelados) y el mismo saldo", len(cr2["abonos"]) == 3 and sum(1 for a in cr2["abonos"] if a.get("cancelado")) == 2, cr2["abonos"])

    # ── Deudas (finanzas, otro teléfono): la misma deuda, y abonar desde ahí ──
    G = telefono(FIN, "Galaxy S9+"); ir(G, "deudas"); t = plano(G.locator("body").inner_text())
    caso("finanzas, en otro teléfono, ve el mismo crédito en Deudas", "FERTILIZANTE A CREDITO" in t, t[:300])
    G.locator(".card", has_text="FERTILIZANTE A CREDITO").first.click(); G.wait_for_timeout(400); t = plano(G.locator("body").inner_text())
    caso("y el mismo saldo de $7,000", "Saldo | $7,000" in t, t[:400])
    G.get_by_placeholder("Monto del abono").fill("500"); G.get_by_role("button", name="✓ Abonar").click(); G.wait_for_timeout(600); subio(G)
    fG = G.evaluate(FLUJO)
    caso("un abono capturado en Deudas ($500) también sale en el flujo de efectivo (antes no salía)", fG["detalle"].get("abonos_creditos") == 3500, fG)
    caso("y en Deudas tampoco se puede borrar un abono: sólo cancelarlo", G.get_by_label("Cancelar el abono de $500").count() == 1 and "🗑" not in G.locator("body").inner_text())

    # ── Dos aparatos, uno sin señal: ¿se pisan los abonos? ──
    A.reload(); A.wait_for_timeout(3500)
    n0 = len([a for a in enNube("creditos")[0]["abonos"]])
    A.context.set_offline(True)
    ir(A, "proveedores"); A.locator(".card", has_text="FERTILIZANTE A CREDITO").first.click(); A.wait_for_timeout(400); abonar(A, 111)
    G.get_by_placeholder("Monto del abono").fill("222"); G.get_by_role("button", name="✓ Abonar").click(); G.wait_for_timeout(600); subio(G)
    A.context.set_offline(False); A.wait_for_timeout(1000); subio(A); A.wait_for_timeout(1500)
    montos = sorted(a["monto"] for a in enNube("creditos")[0]["abonos"])
    caso("DOS APARATOS — un abono capturado sin señal ($111) y otro al mismo tiempo en otro teléfono ($222) quedan LOS DOS en la nube", 111 in montos and 222 in montos and len(montos) == n0 + 2, montos)

    # ── Perfiles ──
    H = telefono(ENC); H.evaluate("p => window.__agroIr(p)", "deudas"); H.wait_for_timeout(600)
    caso("al encargado no se le abre Deudas ni Proveedores (que la base no le da los créditos se prueba aparte, contra la base)", "FERTILIZANTE A CREDITO" not in H.locator("body").inner_text())
    H.evaluate("p => window.__agroIr(p)", "proveedores"); H.wait_for_timeout(600)
    caso("ni pidiendo Proveedores por su nombre", "Registrar crédito" not in H.locator("body").inner_text() and "DEUDA TOTAL" not in H.locator("body").inner_text().upper())
    # Banco, Socios y ¿Alcanza? no son del encargado (decisión de Luis, 22 nov). En la base se prueba aparte (hoja 54).
    H.evaluate("p => window.__agroIr(p)", "home"); H.wait_for_timeout(300); inicio = H.locator(".section-pad, .app").first.inner_text()
    H.locator(".bn-item", has_text="Menú").click(); H.wait_for_timeout(400); menu = plano(H.locator("body").inner_text())
    caso("el menú del encargado no ofrece Banco, Socios ni ¿Alcanza?: en Dinero sólo le quedan Caja chica y Papeles", "Banco" not in menu and "Socios" not in menu and "¿Alcanza?" not in menu and "Dinero | 2 |" in menu, menu[600:1500])
    abiertas = []
    for pag in ["banco", "socios", "aldia"]:
        H.evaluate("p => window.__agroIr(p)", "home"); H.wait_for_timeout(250); antes = H.locator("body").inner_text()
        H.evaluate("p => window.__agroIr(p)", pag); H.wait_for_timeout(500); t = H.locator("body").inner_text()
        if any(x in t for x in ["Estado de cuenta", "Subir estado", "Quién puso", "Titular", "NO SÉ TU SALDO", "alcanza"]) : abiertas.append(pag)
    caso("y aunque pida esas pantallas por su nombre, no se le abren", abiertas == [], abiertas)
    D = telefono(DIR, "iPhone 13"); D.evaluate("p => window.__agroIr(p)", "proveedores"); D.wait_for_timeout(600)
    caso("dirección (iPhone imitado) no tiene cómo registrar créditos ni abonos", D.get_by_role("button", name="Registrar crédito").count() == 0 and D.get_by_role("button", name="+ Registrar abono").count() == 0)
    A.wait_for_timeout(500); G.reload(); G.wait_for_timeout(3500); A.reload(); A.wait_for_timeout(3500)
    mA = sorted(a["monto"] for a in A.evaluate(CRED)[0]["abonos"]); mG = sorted(a["monto"] for a in G.evaluate(CRED)[0]["abonos"])
    caso("y los dos teléfonos acaban viendo los mismos abonos, con el mismo saldo", mA == mG and 111 in mA and 222 in mA, [mA, mG])
    caso("la base no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
