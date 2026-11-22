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

    # ── Caja chica: no toda salida es gasto (decisión de Luis, 21 nov) ──
    FLUJO = "() => { const f = window.__agroCuentas().flujo; const d = {}; for (const m of f.meses) for (const k in m.detalle) d[k] = Math.round(((d[k] || 0) + m.detalle[k]) * 100) / 100; return JSON.parse(JSON.stringify({ ingresos: f.ingresos, egresos: f.egresos, detalle: d })); }"
    INV = "() => window.__agroCuentas().resultado.inventario.comprado"
    LIGADOS = "() => window.__agroDatos.egresos.filter(e => e.cajachicaId)"
    def caja(pg, tipo, concepto, monto, clase=None, parcela=None):
        ir(pg, "caja"); pg.get_by_role("button", name="+ Movimiento").click(); pg.wait_for_timeout(250)
        pg.locator(".option-card", has_text=tipo).first.click(); campo(pg, "Concepto").fill(concepto)
        if clase: campo(pg, "¿Qué fue esta salida?").select_option(clase)
        if parcela: campo(pg, "¿De qué parcela?").select_option(parcela)
        campo(pg, "Monto").fill(str(monto)); pg.get_by_role("button", name="Guardar movimiento").click(); pg.wait_for_timeout(500)
    def saldo(pg): ir(pg, "caja"); return plano(pg.locator("body").inner_text())
    f0 = A.evaluate(FLUJO); i0 = A.evaluate(INV)
    caja(A, "Fondo que recibí", "FONDO INVENTADO", 2000)
    caso("recibir el fondo de la caja no es ingreso ni gasto: ni los resultados ni el flujo se mueven", A.evaluate(CUENTAS) == c and A.evaluate(FLUJO) == f0, [A.evaluate(CUENTAS), A.evaluate(FLUJO)])
    caja(A, "Salió dinero", "SIN DECIR QUE FUE", 10)
    caso("una salida no se guarda sin decir qué fue, y la pantalla lo dice", len(A.evaluate("() => window.__agroDatos.cajachica")) == 1 and "qué fue" in A.locator("[role=alert]").first.inner_text(), A.locator("[role=alert]").all_inner_texts()[:2])
    caja(A, "Salió dinero", "DIESEL INVENTADO", 300, "gasto_general")
    t = saldo(A); c2 = A.evaluate(CUENTAS); f2 = A.evaluate(FLUJO); eg = A.evaluate(LIGADOS)
    caso("caja chica: entraron $2,000, salieron $300, quedan $1,700", "SALDO DISPONIBLE EN CAJA | $1,700" in t and "TOTAL RECIBIDO | $2,000" in t and "TOTAL QUE SALIÓ | $300" in t, t[:300])
    caso("un gasto general de caja llega a Resultados SIN inventarle parcela: la utilidad baja de $9,200 a $8,900", c2["utilidad"] == 8900 and len(eg) == 1 and not eg[0].get("parcelaId") and eg[0]["monto"] == 300, [c2, eg])
    caso("y sale en el flujo de efectivo una sola vez (+$300)", round(f2["egresos"] - f0["egresos"], 2) == 300, [f0, f2])
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("en Finanzas → Resultados aparece entre los gastos generales, no en los de una parcela", "Suma de gastos generales | $300" in t and "Suma de costos de producción | $800" in t, t[150:900])
    caja(A, "Salió dinero", "GASTO SIN PARCELA", 20, "gasto_parcela")
    caso("un «gasto de una parcela» sin parcela no se guarda: dice que entonces es gasto general", len(A.evaluate("() => window.__agroDatos.cajachica")) == 2 and "gasto general" in A.locator("[role=alert]").first.inner_text())
    caja(A, "Salió dinero", "MANGUERA INVENTADA", 500, "gasto_parcela", "p1")
    c4 = A.evaluate(CUENTAS); eg = A.evaluate(LIGADOS); t = saldo(A)
    caso("un gasto de caja PARA una parcela deja un gasto ligado de $500 con su parcela; la utilidad baja a $8,400 y la caja a $1,200", len(eg) == 2 and any(x["monto"] == 500 and x.get("parcelaId") == "p1" for x in eg) and c4["utilidad"] == 8400 and "SALDO DISPONIBLE EN CAJA | $1,200" in t, [c4, eg, t[:120]])
    caja(A, "Salió dinero", "UREA INVENTADA", 200, "inventario")
    c5 = A.evaluate(CUENTAS); f5 = A.evaluate(FLUJO)
    caso("una compra para el almacén pagada de caja NO es gasto (utilidad igual), es inventario (+$200) y sí sale en el flujo", c5 == c4 and round(A.evaluate(INV) - i0, 2) == 200 and round(f5["egresos"] - f2["egresos"], 2) == 700, [c5, A.evaluate(INV), f5])
    caja(A, "Salió dinero", "PRESTAMO INVENTADO", 100, "prestamo")
    c6 = A.evaluate(CUENTAS); f6 = A.evaluate(FLUJO); t = saldo(A)
    caso("un préstamo que salió de caja no es gasto ni crea un préstamo; sin ligar sigue en el flujo, con su nombre, y la pantalla lo pide", c6 == c4 and f6["detalle"].get("caja_por_ligar") == 100 and len(A.evaluate("() => window.__agroDatos.prestamos || []")) == 0 and "Por ligar a su préstamo" in t, [c6, f6, t[:300]])
    caja(A, "Salió dinero", "DEVOLUCION A ADMINISTRACION", 150, "traspaso")
    c7 = A.evaluate(CUENTAS); f7 = A.evaluate(FLUJO); t = saldo(A)
    caso("un traspaso de fondos no es gasto ni salida de dinero del rancho, pero sí baja la caja (queda en $750)", c7 == c4 and f7 == f6 and "SALDO DISPONIBLE EN CAJA | $750" in t, [c7, f7, t[:120]])
    caja(A, "Salió dinero", "NO SE QUE FUE", 50, "otro")
    c8 = A.evaluate(CUENTAS); f8 = A.evaluate(FLUJO); t = saldo(A)
    caso("lo que nadie sabe qué fue NO desaparece: sale en el flujo como «por clasificar» y no entra a los resultados", c8 == c4 and f8["detalle"].get("caja_por_clasificar") == 50 and round(f8["egresos"] - f7["egresos"], 2) == 50 and "Por clasificar" in t, [c8, f8])
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400); t = plano(A.locator("body").inner_text())
    caso("Finanzas avisa lo de caja que falta resolver, con sus importes", "Caja chica por resolver" in t and "$50" in t and "$100" in t, t[-900:])
    ir(A, "caja"); A.get_by_label("Qué fue NO SE QUE FUE").select_option("gasto_general"); A.wait_for_timeout(200); A.get_by_role("button", name="Guardar qué fue").click(); A.wait_for_timeout(500)
    c9 = A.evaluate(CUENTAS); f9 = A.evaluate(FLUJO); eg = A.evaluate(LIGADOS); mov = [x for x in A.evaluate("() => window.__agroDatos.cajachica") if x["concepto"] == "NO SE QUE FUE"][0]
    caso("clasificarla después la vuelve gasto general (utilidad $8,350) sin cambiarle importe ni fecha y sin contarla dos veces en el flujo", c9["utilidad"] == 8350 and f9["egresos"] == f8["egresos"] and not f9["detalle"].get("caja_por_clasificar") and mov["monto"] == 50 and mov.get("clasificadoPor") and len(eg) == 4, [c9, f9, mov])
    t = saldo(A)
    caso("la caja cuadra: $2,000 − 300 − 500 − 200 − 100 − 150 − 50 = $700", "SALDO DISPONIBLE EN CAJA | $700" in t and "TOTAL QUE SALIÓ | $1,300" in t, t[:300])
    fila = A.locator("div", has_text="MANGUERA INVENTADA").last.locator("xpath=ancestor-or-self::*[.//button[starts-with(@aria-label,'Cancelar')]][1]")
    fila.locator("button").first.click(); A.wait_for_timeout(400); m = plano(A.locator(".modal-sheet").inner_text()) if A.locator(".modal-sheet").count() else ""
    caso("de un movimiento de caja sólo se puede corregir el concepto: ni el importe ni borrarlo", "CONCEPTO" in m.upper() and "MONTO" not in m.upper() and "Eliminar" not in m, m[:200])
    if A.locator(".modal-sheet").count(): A.locator(".modal-sheet").get_by_role("button", name="Cancelar").click(); A.wait_for_timeout(300)
    fila.locator("button[aria-label^='Cancelar']").first.click(); A.wait_for_timeout(600)
    c5 = A.evaluate(CUENTAS); eg = A.evaluate(LIGADOS); t = plano(A.locator("body").inner_text())
    caso("cancelar ese movimiento de caja cancela también su gasto ligado: la utilidad sube $500 y la caja regresa a $1,200", c5["utilidad"] == 8850 and [x for x in eg if x["monto"] == 500][0].get("cancelado") and "SALDO DISPONIBLE EN CAJA | $1,200" in t, [c5, t[:120]])
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
    caso("nada quedó dos veces en la nube", len(nube.t["egresos"]) == 6 and len(nube.t["ingresos"]) == 1 and len(nube.t["cajachica"]) == 7 and len(nube.t["auditoria"]) == 3, {k: len(v) for k, v in nube.t.items() if v})
    caso("la base no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
