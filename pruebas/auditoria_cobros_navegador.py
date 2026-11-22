"""AUDITORÍA FUNCIONAL · COBROS PARCIALES DE UN EMBARQUE DESDE DOS TELÉFONOS, con cuentas, 390 px.
Un embarque a consignación pendiente; dos teléfonos de administración cobran una parte cada uno, los dos sin señal.
Al volver la señal: los dos cobros están en el embarque, las dos ventas existen y el dinero cuadra. Datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_cobros_navegador.py"""
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


    nube.t.setdefault("embarques", {})["emb1"] = {"id": "emb1", "fecha": HOY, "datos": {"folio": "EMB-INVENTADO-1", "tipo": "cliente", "cliente": "CLIENTE INVENTADO", "cultivo": "Ajo", "totalNeto": 300, "totalCajas": 30,
        "tarimas": [], "estadoCobro": "pendiente", "liquidaciones": [], "montoCobrado": 0, **E}, "actualizado": "2026-11-19T12:00:00Z"}
    A = aparato(ADM, "09:00"); C = aparato(ADM, "09:00")
    def cobra(pg, monto, parcial=True):
        ir(pg, "consignaciones"); pg.get_by_role("button", name="Liquidar").first.click(); pg.wait_for_timeout(300)
        campo(pg, "Monto que pagó").fill(str(monto))
        if parcial: pg.get_by_text("Es pago parcial").click()
        pg.get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(800)
    emb = lambda pg: next(e for e in datos(pg)["embarques"] if e["id"] == "emb1")
    caso("los dos teléfonos ven el embarque pendiente de cobro", all(emb(pg)["estadoCobro"] == "pendiente" for pg in (A, C)))
    c0 = A.evaluate(CUENTAS)
    nube.caida = True
    cobra(A, 9000); cobra(C, 6000)
    caso("sin señal cada uno ve su cobro: $9,000 en uno y $6,000 en el otro", emb(A)["montoCobrado"] == 9000 and emb(C)["montoCobrado"] == 6000, [emb(A).get("montoCobrado"), emb(C).get("montoCobrado")])
    nube.caida = False
    for pg in (A, C): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, C): avanza(pg, 6 / 60); recarga(pg)
    for pg in (A, C): avanza(pg, 3 / 60); subio(pg); recarga(pg)
    eA, eC = emb(A), emb(C); n = nube.t["embarques"]["emb1"]
    caso("al volver la señal el embarque tiene LOS DOS cobros en los dos teléfonos: $15,000", [len(eA["liquidaciones"]), eA["montoCobrado"], len(eC["liquidaciones"]), eC["montoCobrado"]] == [2, 15000, 2, 15000], [[l["monto"] for l in eA["liquidaciones"]], eA["montoCobrado"], [l["monto"] for l in eC["liquidaciones"]], eC["montoCobrado"]])
    caso("y en la nube también", len((n.get("datos") or n).get("liquidaciones") or []) == 2, (n.get("datos") or n).get("liquidaciones"))
    ing = [i for i in datos(A)["ingresos"] if i.get("embarqueId") == "emb1"]; cA, cC = A.evaluate(CUENTAS), C.evaluate(CUENTAS)
    L = eA["liquidaciones"]; por_id = {i["id"]: i for i in datos(A)["ingresos"]}
    caso("cada cobro tiene identidad, importe, fecha, quién lo capturó y cuándo", len({l["id"] for l in L}) == 2 and all(l["monto"] in (9000, 6000) and l["fecha"] == HOY and (l.get("registradoPor") or {}).get("nombre") == "ADMIN DE PRUEBA" and (l.get("capturado") or "").startswith("2026-11-19T") for l in L), L)
    caso("y rastro propio: cada cobro apunta a SU venta y esa venta apunta de regreso a su cobro, con el mismo importe y autor", all(por_id.get(l["ingresoId"], {}).get("liquidacionId") == l["id"] and por_id[l["ingresoId"]]["monto"] == l["monto"] and (por_id[l["ingresoId"]].get("registradoPor") or {}).get("nombre") == "ADMIN DE PRUEBA" for l in L), [[l["id"], l.get("ingresoId")] for l in L])
    caso("los dos teléfonos tienen exactamente los mismos dos cobros", sorted(l["id"] for l in eA["liquidaciones"]) == sorted(l["id"] for l in eC["liquidaciones"]))
    caso("la base no tuvo que rechazar nada: no hubo identificadores encimados", nube.ocupados == [], nube.ocupados)
    caso("nacieron dos ventas, una por cobro, con identificador distinto, y suman lo cobrado", sorted(i["monto"] for i in ing) == [6000, 9000] and len({i["id"] for i in ing}) == 2, [[i["id"], i["monto"]] for i in ing])
    caso("entraron $15,000 al flujo, una vez, y los dos teléfonos dan la misma cuenta", cA["entra"] == c0["entra"] + 15000 and cA["entra"] == cC["entra"], [c0["entra"], cA["entra"], cC["entra"]])
    ir(A, "consignaciones"); t = plano(A.locator("body").inner_text())
    caso("Consignaciones dice lo que lleva cobrado: $15,000 en 2 pagos", "$15,000" in t and "2 pago" in t, t[:500])
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Resultados").click(); A.wait_for_timeout(400)
    caso("dos cobros distintos del mismo embarque NO se toman por una captura repetida", "Capturas que parecen repetidas" not in A.locator("body").inner_text())

    # Un doble toque al registrar un cobro deja UNO; y el último pago (no parcial) lo deja cobrado sin perder los anteriores.
    ir(A, "consignaciones"); A.get_by_role("button", name="Liquidar").first.click(); A.wait_for_timeout(300)
    campo(A, "Monto que pagó").fill("1000"); A.get_by_role("button", name="Registrar pago").dblclick(); A.wait_for_timeout(900)
    subio(A); eF = emb(A)
    caso("un doble toque registra UN cobro, y el embarque queda cobrado con sus tres pagos: $16,000", len(eF["liquidaciones"]) == 3 and eF["montoCobrado"] == 16000 and eF["estadoCobro"] == "cobrado" and len([i for i in datos(A)["ingresos"] if i.get("embarqueId") == "emb1"]) == 3, [[l["monto"] for l in eF["liquidaciones"]], eF["montoCobrado"], eF["estadoCobro"]])
    avanza(C, 6 / 60); recarga(C); eG = emb(C)
    caso("y el otro teléfono lo ve igual", [len(eG["liquidaciones"]), eG["montoCobrado"], eG["estadoCobro"]] == [3, 16000, "cobrado"], [len(eG["liquidaciones"]), eG["montoCobrado"], eG["estadoCobro"]])

    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
