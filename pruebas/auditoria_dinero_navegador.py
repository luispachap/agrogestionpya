"""AUDITORÍA FUNCIONAL · DINERO BÁSICO, usando la app como una persona desde un teléfono Android (Pixel 7 imitado).
Finanzas (gastos e ingresos), Movimientos, Caja chica: capturar, comprobar la cifra en pantalla y en la nube, cancelar,
recargar, verlo en otro aparato y con otros perfiles. Datos inventados, nube de imitación: no toca producción.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_dinero_navegador.py"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); FIN = N.cuenta(4, "finanzas@prueba.invalid", "FINANZAS DE PRUEBA", "finanzas")
DIR = N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, FIN, DIR, ENC])
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
CUENTAS = "() => { const c = window.__agroCuentas(); const r = c.resultado; return JSON.parse(JSON.stringify({ ingresos: r.ingresos, egresos: r.egresos, utilidad: r.utilidad })); }"
def dinero(datos): return (datos or {}).get("monto")

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

    # ── Finanzas: un gasto general, un gasto de una parcela y una venta ──
    def egreso(pg, concepto, monto, parcela=None):
        ir(pg, "contabilidad"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(200); pg.locator(".option-card", has_text="Registrar Egreso").click(); pg.wait_for_timeout(300)
        campo(pg, "Concepto").fill(concepto); campo(pg, "Monto").fill(str(monto))
        if parcela: campo(pg, "Parcela / cultivo afectado").select_option(parcela)
        pg.locator("button.btn-accent", has_text="Guardar").last.click(); pg.wait_for_timeout(500)
    def ingreso(pg, concepto, monto):
        ir(pg, "contabilidad"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(200); pg.locator(".option-card", has_text="Registrar Ingreso").click(); pg.wait_for_timeout(300)
        campo(pg, "Concepto").fill(concepto); campo(pg, "Monto").fill(str(monto))
        pg.locator("button.btn-accent", has_text="Guardar").last.click(); pg.wait_for_timeout(500)
    egreso(A, "LUZ DEL POZO INVENTADA", 1500); egreso(A, "REFACCION DE BOMBA INVENTADA", 800, "p1"); ingreso(A, "VENTA DE AJO INVENTADA", 10000)
    d = A.evaluate("() => ({ eg: window.__agroDatos.egresos, ing: window.__agroDatos.ingresos })"); c = A.evaluate(CUENTAS)
    caso("se guardan dos gastos y una venta con sus importes", sorted(x["monto"] for x in d["eg"]) == [800, 1500] and [x["monto"] for x in d["ing"]] == [10000], [[x["concepto"], x["monto"], x.get("parcelaId")] for x in d["eg"]])
    caso("el resultado da $10,000 − $2,300 = $7,700", [c["ingresos"], c["egresos"], c["utilidad"]] == [10000, 2300, 7700], c)
    ir(A, "contabilidad"); t = plano(A.locator("body").inner_text())
    caso("Finanzas enseña el flujo: entró $10,000 y salió $2,300", "DINERO QUE ENTRÓ | $10,000" in t and "DINERO QUE SALIÓ | $2,300" in t, t[:400])
    A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("la pestaña Resultados da la misma utilidad, con el gasto de la parcela como costo de producción y la luz como gasto general", "Utilidad neta | $7,700" in t and "Gastos capturados a una parcela" in t and "Suma de costos de producción | $800" in t and "Suma de gastos generales | $1,500" in t, t[150:900])
    A.evaluate("p => window.__agroIr(p)", "home"); A.wait_for_timeout(500); t = plano(A.locator("body").inner_text())
    caso("y el inicio del administrador dice lo mismo: $7,700", "UTILIDAD NETA DEL RANCHO | $7,700" in t, t[:300])
    caso("subió a la nube una vez cada cosa", subio(A) and len(nube.t["egresos"]) == 2 and len(nube.t["ingresos"]) == 1 and sorted(dinero(x["datos"]) or x.get("monto") for x in nube.t["egresos"].values()) == [800, 1500], {k: len(v) for k, v in nube.t.items()})

    # ── Cancelar un gasto: no se borra, se tacha con su motivo y deja de contar ──
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Egresos").click(); A.wait_for_timeout(400)
    A.locator(".card, .list-row, div", has_text="LUZ DEL POZO INVENTADA").last.locator("xpath=ancestor-or-self::*[.//button[starts-with(@aria-label,'Cancelar')]][1]").locator("button[aria-label^='Cancelar']").first.click(); A.wait_for_timeout(600)
    d = A.evaluate("() => window.__agroDatos.egresos"); c = A.evaluate(CUENTAS); luz = [x for x in d if x["concepto"].startswith("LUZ")][0]
    caso("cancelar pide el motivo y NO borra: el gasto sigue ahí, cancelado, con quién y por qué", len(d) == 2 and luz.get("cancelado") and "Se capturó dos veces" in json.dumps(luz, ensure_ascii=False) and "ADMIN DE PRUEBA" in json.dumps(luz, ensure_ascii=False) and any("¿Por qué se cancela?" in m for m in A.dialogos), {k: v for k, v in luz.items() if "cancel" in k.lower()})
    caso("lo cancelado deja de contar: la utilidad sube a $9,200", [c["ingresos"], c["egresos"], c["utilidad"]] == [10000, 800, 9200], c)
    t = plano(A.locator("body").inner_text())
    caso("en la lista sigue a la vista, con su sello de cancelado", "LUZ DEL POZO INVENTADA" in t and "Se capturó dos veces" in t, t[:500])
    subio(A); aud = list(nube.t.get("auditoria", {}).values())
    caso("la cancelación quedó en la bitácora de la nube, con su motivo", len(aud) == 1 and "Se capturó dos veces" in json.dumps(aud[0], ensure_ascii=False), aud[:1])
    caso("y en la nube el gasto sigue existiendo, marcado como cancelado", len(nube.t["egresos"]) == 2 and any("cancelado" in json.dumps(x) for x in nube.t["egresos"].values()))
    ir(A, "bitacora"); t = plano(A.locator("body").inner_text())
    caso("la pantalla Bitácora lo enseña", "Se capturó dos veces" in t and "LUZ DEL POZO" in t, t[:400])
    ir(A, "movimientos"); t = plano(A.locator("body").inner_text())
    caso("Movimientos da los mismos totales del periodo: ingresos $10,000 y egresos $800", "INGRESOS DEL PERIODO | $10,000" in t and "EGRESOS DEL PERIODO | $800" in t, t[:500])

    # ── Caja chica ──
    def caja(pg, tipo, concepto, monto):
        ir(pg, "caja"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(250)
        pg.locator(".option-card, .pill, button, div", has_text=tipo).last.click(); campo(pg, "Concepto").fill(concepto); campo(pg, "Monto").fill(str(monto))
        pg.get_by_role("button", name="Guardar movimiento").click(); pg.wait_for_timeout(500)
    caja(A, "Recibí dinero", "FONDO INVENTADO", 2000); caja(A, "Gasté dinero", "DIESEL INVENTADO", 300)
    ir(A, "caja"); t = plano(A.locator("body").inner_text()); cj = A.evaluate("() => window.__agroDatos.cajachica"); c2 = A.evaluate(CUENTAS)
    caso("caja chica: recibí $2,000, gasté $300, quedan $1,700", "SALDO DISPONIBLE EN CAJA | $1,700" in t and "TOTAL RECIBIDO | $2,000" in t and "TOTAL GASTADO | $300" in t and len(cj) == 2, t[:300])
    caso("PENDIENTE DE DECISIÓN — un gasto de caja SIN parcela no llega al resultado (la utilidad sigue en $9,200 después de gastar $300)", c2 == c, [c2, c])
    # Con parcela sí: deja un gasto ligado que es costo de esa parcela
    ir(A, "caja"); A.get_by_role("button", name="+ Movimiento").click(); A.wait_for_timeout(250); A.locator(".option-card, .pill, button, div", has_text="Gasté dinero").last.click()
    campo(A, "Concepto").fill("MANGUERA INVENTADA"); campo(A, "¿Fue para una parcela?").select_option("p1"); campo(A, "Monto").fill("500"); A.get_by_role("button", name="Guardar movimiento").click(); A.wait_for_timeout(500)
    c4 = A.evaluate(CUENTAS); eg = A.evaluate("() => window.__agroDatos.egresos.filter(e => e.cajachicaId)")
    caso("un gasto de caja PARA una parcela deja un gasto ligado de $500 y la utilidad baja a $8,700", len(eg) == 1 and eg[0]["monto"] == 500 and eg[0]["parcelaId"] == "p1" and c4["utilidad"] == 8700, [c4, eg[:1]])
    ir(A, "caja"); t = plano(A.locator("body").inner_text())
    caso("y la caja queda en $1,200", "SALDO DISPONIBLE EN CAJA | $1,200" in t, t[:200])
    fila = A.locator("div", has_text="MANGUERA INVENTADA").last.locator("xpath=ancestor-or-self::*[.//button[starts-with(@aria-label,'Cancelar')]][1]")
    fila.locator("button").first.click(); A.wait_for_timeout(400); m = plano(A.locator(".modal-sheet").inner_text()) if A.locator(".modal-sheet").count() else ""
    caso("de un movimiento de caja sólo se puede corregir el concepto: ni el importe ni borrarlo", "CONCEPTO" in m.upper() and "MONTO" not in m.upper() and "Eliminar" not in m, m[:200])
    if A.locator(".modal-sheet").count(): A.locator(".modal-sheet").get_by_role("button", name="Cancelar").click(); A.wait_for_timeout(300)
    fila.locator("button[aria-label^='Cancelar']").first.click(); A.wait_for_timeout(600)
    c5 = A.evaluate(CUENTAS); eg = A.evaluate("() => window.__agroDatos.egresos.filter(e => e.cajachicaId)"); t = plano(A.locator("body").inner_text())
    caso("cancelar ese movimiento de caja cancela también su gasto ligado: la utilidad regresa a $9,200 y la caja a $1,700", c5["utilidad"] == 9200 and eg[0].get("cancelado") and "SALDO DISPONIBLE EN CAJA | $1,700" in t, [c5, eg[0].get("motivoCancelacion"), t[:120]])
    c2 = c5

    # ── Que siga ahí: recargar, otro aparato, otros perfiles ──
    subio(A); A.reload(); A.wait_for_timeout(3500); c3 = A.evaluate(CUENTAS)
    caso("al recargar, las mismas cifras", c3 == c2, [c3, c2])
    F = telefono(FIN, "Galaxy S9+"); cF = F.evaluate(CUENTAS); ir(F, "contabilidad"); t = plano(F.locator("body").inner_text())
    caso("finanzas, en otro teléfono, ve exactamente lo mismo", cF == c2 and "DINERO QUE ENTRÓ | $10,000" in t, [cF, t[:200]])
    D = telefono(DIR, "iPhone 13"); t = plano(D.locator("body").inner_text()); cD = D.evaluate(CUENTAS)
    caso("dirección (en iPhone imitado) ve la misma utilidad y no tiene cómo capturar movimientos", cD["utilidad"] == c2["utilidad"] and D.get_by_role("button", name="+ Movimiento").count() == 0, [cD, t[:200]])
    D.evaluate("p => window.__agroIr(p)", "contabilidad"); D.wait_for_timeout(500)
    caso("y aunque pida la pantalla de Finanzas por su nombre, no se le abre", D.get_by_role("button", name="+ Movimiento").count() == 0 and "Registrar Egreso" not in D.locator("body").inner_text())
    G = telefono(ENC); G.evaluate("p => window.__agroIr(p)", "contabilidad"); G.wait_for_timeout(500)
    caso("al encargado tampoco se le abre Finanzas", G.get_by_role("button", name="+ Movimiento").count() == 0 or "Finanzas" not in G.locator(".top-bar").first.inner_text())
    caso("nada quedó dos veces en la nube", len(nube.t["egresos"]) == 3 and len(nube.t["ingresos"]) == 1 and len(nube.t["cajachica"]) == 3 and len(nube.t["auditoria"]) == 3, {k: len(v) for k, v in nube.t.items() if v})
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
