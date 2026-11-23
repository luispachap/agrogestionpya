"""AUDITORÍA FUNCIONAL · PAPELES QUE TRAEN TEXTO (sin IA): un ticket en PDF de un proveedor nuevo se captura una vez y
se confirma; el SIGUIENTE ticket del mismo proveedor se lee solo, con lo aprendido, gratis y sin señal; y la ficha de un
agroquímico en PDF deja el producto con su reentrada y su carencia (seguridad de personas: lo que no viene no es cero).
Los PDF son de verdad (con capa de texto), hechos aquí con datos inventados. Cuentas, 390 px, nube de imitación.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_papeles2_navegador.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}

def pdf(lineas):
    """Un PDF de una página con su texto de verdad (Helvetica), como el que da un punto de venta."""
    esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    contenido = "BT /F1 11 Tf 14 TL 60 740 Td " + " ".join(f"({esc(l)}) Tj T*" for l in lineas) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(contenido)} >>\nstream\n{contenido}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out = "%PDF-1.4\n"; pos = []
    for i, o in enumerate(objs, 1): pos.append(len(out.encode("latin-1"))); out += f"{i} 0 obj\n{o}\nendobj\n"
    x = len(out.encode("latin-1"))
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{p:010d} 00000 n \n" for p in pos)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n"
    return out.encode("latin-1")
TICKET = lambda folio, fecha, sub, iva, tot: pdf(["FERRETERIA INVENTADA DEL CENTRO", "RFC FIC010101AB1", f"TICKET {folio}", f"FECHA {fecha}",
                                                  "2 GUANTES DE CARNAZA", f"SUBTOTAL {sub}", f"IVA 16% {iva}", f"TOTAL {tot}", "GRACIAS POR SU COMPRA"])
FICHA = pdf(["FICHA TECNICA", "FUNGICIDA INVENTADO 50 PH", "INGREDIENTE ACTIVO: AZUFRE INVENTADO", "INTERVALO DE REENTRADA: 24 HORAS", "INTERVALO DE SEGURIDAD: 7 DIAS"])

ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
tab = lambda pg, txt: (pg.locator(".tab-pill", has_text=txt).first.click(), pg.wait_for_timeout(400))
campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []; ia = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept()))
        pg.on("request", lambda r: ia.append(r.url) if "/functions/" in r.url else None)
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)
    subir = lambda pg, nombre, contenido: (pg.locator("input[type=file]").first.set_input_files({"name": nombre, "mimeType": "application/pdf", "buffer": contenido}), pg.wait_for_timeout(2500))

    # ══ 1. Un ticket en PDF de un proveedor nuevo ══
    ir(A, "papeles"); subir(A, "ticket 1.pdf", TICKET("A-101", "2026-11-17", "500.00", "80.00", "580.00")); tx = cuerpo(A)
    caso("el PDF se abre por su texto (sin IA) y dice que el proveedor todavía no se conoce", "Todavía no se conoce a este proveedor" in tx and not ia, [tx[:700], ia])
    campo(A, "Proveedor").fill("FERRETERIA INVENTADA DEL CENTRO"); campo(A, "Fecha").fill("2026-11-17"); campo(A, "Total").fill("580.00")
    A.get_by_role("button", name="Sólo confirmar").click(); A.wait_for_timeout(800)
    pt = datos(A).get("patrones_lectura") or []
    caso("al confirmarlo se aprende el proveedor: dónde está cada dato, no el valor", len(pt) == 1 and "FERRETERIA" in (pt[0].get("emisor") or "") and "580" not in str(pt[0].get("anclas") or ""), pt)

    # ══ 2. El siguiente ticket del mismo proveedor se lee solo ══
    nube.caida = True
    tab(A, "Subir papel"); subir(A, "ticket 2.pdf", TICKET("A-188", "2026-11-18", "1,250.00", "200.00", "1,450.00")); tx = cuerpo(A)
    vals = A.locator("input.inp").evaluate_all("els => els.map(e => e.value)")
    caso("SIN SEÑAL, el segundo ticket se lee con lo aprendido: gratis y sin IA", "Con lo que ya se había aprendido de este proveedor" in tx and not ia, tx[:700])
    caso("y saca el TOTAL (1,450.00), no el subtotal ni el IVA, con la fecha y el proveedor", any(v.replace(",", "") in ("1450", "1450.00", "1450.0") for v in vals) and "2026-11-18" in vals and any("FERRETERIA" in v for v in vals), vals)
    A.get_by_role("button", name="Confirmar y aplicar").click(); A.wait_for_timeout(900); nube.caida = False
    eg = [e for e in datos(A)["egresos"] if not e.get("cancelado")]
    caso("aplicado: UN gasto de $1,450 a nombre del proveedor, sin factura (se dice: no es deducible)", len(eg) == 1 and eg[0]["monto"] == 1450 and "FERRETERIA" in eg[0].get("proveedor", "") and eg[0].get("tieneComprobanteFiscal") is False, eg)
    caso("de esa lectura se cuenta como «sin corregir»: la regla ya sirvió", any(l.get("estado") == "confirmada" and l.get("fuente") == "patron-local" for l in datos(A)["lecturas"]), [(l.get("estado"), l.get("fuente")) for l in datos(A)["lecturas"]])

    # ══ 3. La ficha técnica de un agroquímico ══
    tab(A, "Subir papel"); subir(A, "ficha.pdf", FICHA); A.wait_for_timeout(500)
    campo(A, "¿Qué es este papel?").select_option("etiqueta_agroquimico"); A.wait_for_timeout(300)
    campo(A, "Nombre del producto").fill("FUNGICIDA INVENTADO 50 PH"); campo(A, "Ingrediente activo").fill("AZUFRE INVENTADO")
    campo(A, "Días de reentrada").fill("1")
    A.get_by_role("button", name="Confirmar y aplicar").click(); A.wait_for_timeout(1000); tx = cuerpo(A)
    art = [a for a in datos(A)["inventario"] if a.get("nombre") == "FUNGICIDA INVENTADO 50 PH"]
    caso("ETIQUETA: el producto queda en el almacén con su ingrediente y su reentrada (1 día)", len(art) == 1 and art[0].get("ingredienteActivo") == "AZUFRE INVENTADO" and art[0].get("reentradaDias") == 1, art or tx[:600])
    caso("y la carencia que no se capturó queda VACÍA, no en cero (no se sabe ≠ ya se puede)", art and art[0].get("carenciaDias") is None, art[0].get("carenciaDias") if art else None)

    # ══ 4. Otro teléfono ══
    caso("todo subió", subio(A))
    B = aparato(ADM)
    caso("el otro teléfono trae lo aprendido del proveedor, el gasto, los tres papeles y el producto", len(datos(B).get("patrones_lectura") or []) == 1 and len(datos(B)["lecturas"]) == 3 and len([e for e in datos(B)["egresos"] if not e.get("cancelado")]) == 1 and any(a.get("nombre") == "FUNGICIDA INVENTADO 50 PH" for a in datos(B)["inventario"]), [len(datos(B).get("patrones_lectura") or []), len(datos(B)["lecturas"])])
    ir(B, "papeles"); subir(B, "ticket 3.pdf", TICKET("A-190", "2026-11-19", "100.00", "16.00", "116.00")); tx = cuerpo(B)
    caso("y en ese teléfono el mismo proveedor también se lee solo", "Con lo que ya se había aprendido de este proveedor" in tx, tx[:500])
    caso("ninguna lectura llamó a la IA", not ia, ia[:3])
    caso("la nube no rechazó nada", not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
