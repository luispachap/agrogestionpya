"""AUDITORÍA FUNCIONAL · IMPORTAR DOCUMENTOS con cuentas y dos teléfonos: una factura de después del arranque se
PROPONE como gasto y sólo entra al confirmarla (una vez, con su folio y de qué documento salió); la de antes del arranque
va al histórico y no a Finanzas; el mismo archivo no se recibe dos veces; otro teléfono ve la misma bandeja y el mismo gasto.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_importar_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import os, pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-30"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM], inicio="2026-11-20"); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
d = pathlib.Path(tempfile.mkdtemp())
def xml(nombre, fecha, uuid, total="1160.00"):
    (d / nombre).write_text(f'''<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="77" Fecha="{fecha}T10:00:00" SubTotal="1000.00" Moneda="MXN" Total="{total}" TipoDeComprobante="I" FormaPago="03">
<cfdi:Emisor Rfc="AGR010101AAA" Nombre="AGROQUIMICOS DE PRUEBA SA DE CV"/><cfdi:Receptor Rfc="XAXX010101000" Nombre="RANCHO DE PRUEBA"/>
<cfdi:Conceptos><cfdi:Concepto Cantidad="20" Unidad="BULTO" Descripcion="UREA DE PRUEBA" ValorUnitario="50.00" Importe="1000.00"/></cfdi:Conceptos>
<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="x" UUID="{uuid}"/></cfdi:Complemento></cfdi:Comprobante>''', encoding="utf8"); return str(d / nombre)
U1, U2 = "AAAAAAAA-1111-2222-3333-444444444444", "BBBBBBBB-1111-2222-3333-444444444444"
f_nueva, f_vieja = xml("factura nueva.xml", "2026-11-25", U1), xml("factura vieja.xml", "2025-08-12", U2, "580.00")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
de = lambda pg, tipo: pg.evaluate("t => (window.__agroDatos.eventos || []).filter(e => e.tipo === t)", tipo)
egresos = lambda pg: pg.evaluate("() => window.__agroDatos.egresos.filter(e => !e.cancelado)")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta_):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda x: x.accept("NO ERA DEL RANCHO"))
        pg.clock.install(time=f"{HOY}T09:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta_["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM); ir(A, "importar"); tx = plano(A.locator("body").inner_text())
    caso("la pantalla dice desde cuándo es operación (lo que diga la base) y que nada entra sin confirmar", "La operación arrancó el 2026-11-20" in tx and "nada entra a la operación hasta que tú lo confirmes" in tx, tx[:400])
    A.get_by_label("Escoger archivos para importar").set_input_files([f_nueva, f_vieja])
    A.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=60000); A.wait_for_timeout(800)
    rec = de(A, "doc_recibido"); lei = {e["datos"]["docId"]: e["datos"] for e in de(A, "doc_leido")}; nom = {e["id"]: e["datos"]["nombre"] for e in rec}; est = {nom[k]: v for k, v in lei.items()}
    caso("se reciben y leen las dos facturas: la de después del arranque como gasto, la de antes al histórico", len(rec) == 2 and est["factura nueva.xml"]["n"] == {"egresos": 1} and est["factura vieja.xml"]["n"] == {"historico": 1}, est)
    caso("mientras nadie confirma, no hay ningún gasto", len(egresos(A)) == 0)
    A.get_by_label("Escoger archivos para importar").set_input_files([f_nueva]); A.wait_for_timeout(1500)
    caso("el mismo archivo no se recibe dos veces", len(de(A, "doc_recibido")) == 2 and "ya se habían recibido antes" in A.locator("body").inner_text())
    A.get_by_label("Abrir factura nueva.xml").click(); A.wait_for_timeout(400); foto(A, "01-propuesta")
    A.get_by_role("button", name="Incorporar lo marcado").click(); A.wait_for_timeout(600)
    eg = egresos(A)
    caso("al confirmar queda UN gasto con su folio y de qué documento salió", len(eg) == 1 and eg[0]["monto"] == 1160 and eg[0]["uuid"] == U1 and eg[0]["_importado"]["documento"] == "factura nueva.xml", eg)
    A.locator(".tab-pill", has_text="Todos").first.click(); A.wait_for_timeout(300)
    A.get_by_label("Abrir factura vieja.xml").click(); A.wait_for_timeout(400); A.get_by_role("button", name="Incorporar lo marcado").click(); A.wait_for_timeout(600)
    r = A.evaluate("() => window.__agroCuentas().resultado")
    caso("la factura de antes del arranque entra al histórico y NO a Finanzas (ni gasto ni flujo)", len(de(A, "historico_lote")) == 1 and len(egresos(A)) == 1 and A.evaluate("() => window.__agroCuentas().flujo.egresos") == 1160, (len(de(A, "historico_lote")), r.get("egresos")))
    caso("subió", subio(A))
    B = aparato(ADM); ir(B, "importar"); tx = plano(B.locator("body").inner_text()); foto(B, "02-otro-telefono")
    caso("en otro teléfono: la misma bandeja (2 documentos), el mismo gasto y el histórico", len(de(B, "doc_recibido")) == 2 and len(egresos(B)) == 1 and len(de(B, "historico_lote")) == 1)
    B.get_by_label("Escoger archivos para importar").set_input_files([f_nueva]); B.wait_for_timeout(1500)
    caso("y desde el otro teléfono tampoco se recibe dos veces el mismo archivo", len(de(B, "doc_recibido")) == 2 and len(egresos(B)) == 1)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
