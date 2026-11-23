"""AUDITORÍA FUNCIONAL · PAPELES (el buzón): una factura en XML se lee exacta y gratis, se confirma, se aplica UNA vez como
gasto y lo comprado entra al almacén con su costo; la misma factura otra vez se avisa; una foto sin lectura con IA se guarda
igual (nunca se pierde evidencia) y se captura a mano. En Finanzas la compra queda como inventario, no como gasto, y sale
una vez del flujo. Con cuentas, 390 px, nube de imitación, otro teléfono.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_papeles_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import base64, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["inventario"] = {"i-urea": {"id": "i-urea", "nombre": "UREA DE PRUEBA", "cat": "fertilizante", "unidad": "bulto", "existencia": 0, "costo_unit": 0, "minimo": 0, "datos": {"emoji": "📦", **E}, "actualizado": V}}
UUID = "AAAAAAAA-1111-2222-3333-444444444444"
XML = f'''<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="77" Fecha="2026-11-18T10:00:00" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" FormaPago="03">
<cfdi:Emisor Rfc="AGR010101AAA" Nombre="AGROQUIMICOS DE PRUEBA SA DE CV"/><cfdi:Receptor Rfc="XAXX010101000" Nombre="RANCHO DE PRUEBA"/>
<cfdi:Conceptos><cfdi:Concepto Cantidad="20" Unidad="BULTO" Descripcion="UREA DE PRUEBA" ValorUnitario="50.00" Importe="1000.00"/></cfdi:Conceptos>
<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="x" UUID="{UUID}"/></cfdi:Complemento></cfdi:Comprobante>'''
# Una foto cualquiera (un cuadro gris de 300×400): sin lectura con IA instalada, no se puede leer.
import struct, zlib
def png(w=600, h=800):
    import random; random.seed(7)   # con ruido, para que pese como una foto de verdad
    raw = b"".join(b"\x00" + bytes(random.randrange(256) for _ in range(3 * w)) for _ in range(h))
    ch = lambda k, d: struct.pack(">I", len(d)) + k + d + struct.pack(">I", zlib.crc32(k + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
tab = lambda pg, txt: (pg.locator(".tab-pill", has_text=txt).first.click(), pg.wait_for_timeout(400))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.cancelar = False
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.dismiss() if pg.cancelar and d.type == "confirm" else d.accept()))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)
    subir = lambda pg, nombre, mime, contenido: (pg.locator("input[type=file]").first.set_input_files({"name": nombre, "mimeType": mime, "buffer": contenido}), pg.wait_for_timeout(1500))

    # ── 1 · La factura en XML: exacta, gratis, sin IA ──
    ir(A, "papeles"); subir(A, "factura.xml", "text/xml", XML.encode()); tx = cuerpo(A); foto(A, "01-xml-leido")
    vals = " ".join(A.locator("input").evaluate_all("els => els.map(e => e.value)"))
    caso("el XML se lee exacto: emisor, total $1,160 y folio fiscal, sin IA", "Del XML del CFDI — exacto, gratis y sin señal" in tx and "AGROQUIMICOS DE PRUEBA" in vals and "1160" in vals and UUID in vals, vals[:400])
    A.get_by_role("button", name="Confirmar y aplicar").click(); A.wait_for_timeout(800); tx = cuerpo(A); foto(A, "02-al-almacen")
    eg = [e for e in datos(A)["egresos"] if not e.get("cancelado")]
    caso("aplicar pregunta antes y deja UN gasto de $1,160 con su folio fiscal, ligado al papel", len(eg) == 1 and eg[0]["monto"] == 1160 and eg[0].get("uuid") == UUID and bool(eg[0].get("origenLectura")) and any("EGRESO de $1,160" in x for x in A.dialogos), (eg, A.dialogos[-1:]))
    caso("y pregunta qué de lo comprado entró al almacén, con la urea ya enganchada", "¿Qué de esto entró al almacén?" in tx and "UREA DE PRUEBA" in tx, tx[:1500])
    A.get_by_role("button", name="Cargar al almacén").click(); A.wait_for_timeout(800)
    inv = {i["id"]: i for i in datos(A)["inventario"]}
    prom = A.evaluate("() => { const p = window.__agroDatos.almacen.promedios.get('i-urea'); return p == null ? null : Number(p); }")
    caso("la urea entra al almacén: 20 bultos, con su costo de la factura ($1,160 ÷ 20 = $58 con IVA, o $50 sin IVA)", inv["i-urea"]["existencia"] == 20 and prom in (50, 58), (inv["i-urea"].get("existencia"), prom))
    r = A.evaluate("() => JSON.parse(JSON.stringify(window.__agroCuentas()))")
    caso("en Finanzas la compra es inventario, no gasto (costos 0) y no queda «por clasificar»", r["resultado"]["egresos"] == 0 and r["resultado"]["porClasificar"]["monto"] == 0 and r["resultado"]["inventario"]["comprado"] == 1160, (r["resultado"]["egresos"], r["resultado"]["porClasificar"], r["resultado"]["inventario"]["comprado"]))
    caso("y sale UNA vez del flujo de efectivo ($1,160)", r["flujo"]["egresos"] == 1160, r["flujo"]["egresos"])
    lec = datos(A)["lecturas"]
    caso("el papel queda aplicado: no se puede aplicar dos veces", len(lec) == 1 and (lec[0].get("aplicado") or {}).get("id") == eg[0]["id"], [(l.get("estado"), l.get("aplicado")) for l in lec])

    # ── 2 · La misma factura otra vez ──
    tab(A, "Subir papel"); subir(A, "la misma factura.xml", "text/xml", XML.encode()); A.cancelar = True
    A.get_by_role("button", name="Confirmar y aplicar").click(); A.wait_for_timeout(800); A.cancelar = False
    caso("la misma factura otra vez: antes de registrar avisa que ese folio fiscal ya está, y si se dice que no, no entra", any(UUID[:8] in x or "folio" in x.lower() for x in A.dialogos[-2:]) and len([e for e in datos(A)["egresos"] if not e.get("cancelado")]) == 1, A.dialogos[-2:])

    # ── 3 · Una foto sin lectura con IA: se guarda igual ──
    tab(A, "Subir papel"); subir(A, "ticket.png", "image/png", png()); A.wait_for_timeout(1500); tx = cuerpo(A); foto(A, "03-foto-sin-ia")
    caso("una foto sin la lectura con IA no truena: lo dice y ofrece capturarla a mano", "Revisa y corrige" in tx or "Falta este dato" in tx, tx[:1200])
    A.get_by_role("button", name="Guardar sin revisar, para después").click(); A.wait_for_timeout(800)
    lec = datos(A)["lecturas"]
    caso("se guarda aunque no se haya leído nada: la foto es la evidencia del pago", len(lec) == 3 and any(l.get("estado") == "por revisar" and str(l.get("foto") or "").startswith("archivo:") for l in lec), [(l.get("estado"), str(l.get("foto"))[:30]) for l in lec])
    tab(A, "Por revisar"); tx = cuerpo(A)
    caso("queda en «Por revisar» para resolverlo después", "Por revisar (" in tx, tx[:600])

    # ── 4 · Otro teléfono ──
    caso("todo subió a la nube", subio(A))
    B = aparato(ADM); d = B.evaluate("() => ({ eg: window.__agroDatos.egresos.length, lec: window.__agroDatos.lecturas.length, ex: window.__agroDatos.inventario.find(i => i.id === 'i-urea').existencia })")
    caso("en otro teléfono: el mismo gasto, los tres papeles y la urea en 20", d == {"eg": 1, "lec": 3, "ex": 20}, d)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
