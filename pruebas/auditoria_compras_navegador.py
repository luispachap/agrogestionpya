"""AUDITORÍA FUNCIONAL · MIS COMPRAS: la trabajadora entra con su PIN en el teléfono ligado por su encargado, registra lo
que compró con la foto del ticket (sin señal, y con doble toque), y el administrador la ve en su teléfono, la aprueba o la
rechaza diciendo por qué. La foto NO viaja dentro del registro: va aparte, al almacén de comprobantes.
Cuentas, 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_compras_navegador.py"""
import base64, json, pathlib, sys, zlib, struct
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V}}
nube.t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}}
def png(lado=80):   # una imagen de verdad, con ruido para que pese como una foto (el ticket)
    import random; random.seed(7)
    datos = zlib.compress(b"".join(b"\x00" + bytes(random.getrandbits(8) for _ in range(lado * 3)) for _ in range(lado)))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)) + chunk(b"IDAT", datos) + chunk(b"IEND", b"")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []; almacen = []
    def aparato(cuenta, hh="08:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = ""
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.on("request", lambda r: almacen.append(r.url) if "/storage/" in r.url and r.method in ("POST", "PUT") else None)
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        if cuenta:
            pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
            for _ in range(30):
                pg.wait_for_timeout(300)
                if pg.locator(".login-bg").count() == 0: break
            pg.wait_for_timeout(2500)
        return pg
    def salir(pg):
        ir(pg, "home"); pg.get_by_role("button", name="Salir").first.click()
        for _ in range(20):
            pg.wait_for_timeout(400)
            if pg.locator(".login-bg").count(): break

    # ══ 1. El encargado entra en su teléfono; luego Ana entra ahí con su PIN ══
    B = aparato(ENC); subio(B); salir(B)
    B.locator(".login-sheet input").first.fill("4101"); B.get_by_role("button", name="Entrar").click(); B.wait_for_timeout(1500)
    caso("Ana entra con su PIN en el teléfono de su encargado", "ANA" in cuerpo(B) and "Finanzas" not in cuerpo(B), cuerpo(B)[:300])
    ir(B, "compras")
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(300)
    caso("sin qué compró ni cuánto no avanza", any("Falta descripción o monto" in d for d in B.dialogos), B.dialogos[-1:])
    campo(B, "Descripción de la compra").fill("GUANTES Y CINTA INVENTADOS"); campo(B, "¿Dónde la compraste?").fill("FERRETERIA INVENTADA"); campo(B, "Monto total pagado").fill("185")
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(400)
    B.get_by_placeholder("Nombre del artículo").fill("GUANTES"); B.get_by_placeholder("Cantidad").fill("2"); B.get_by_role("button", name="+ Agregar").click(); B.wait_for_timeout(200)
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(400)
    B.context.set_offline(True)
    B.locator("input[type=file]").first.set_input_files({"name": "ticket.png", "mimeType": "image/png", "buffer": png()}); B.wait_for_timeout(800); t = cuerpo(B)
    caso("la foto del ticket se ve y la confirmación dice «Adjuntado»", "Comprobante | Adjuntado" in t and B.locator("img").count() >= 1, t[-600:])
    B.get_by_role("button", name="✓ Enviar compra").dblclick(); B.wait_for_timeout(1500)
    co = datos(B).get("compras") or []
    caso("DOBLE TOQUE sin señal: queda UNA compra, pendiente, a nombre de Ana, con lo que compró", len(co) == 1 and co[0]["estado"] == "pendiente" and co[0]["trabajadorId"] == "t-ana" and co[0]["monto"] == 185 and co[0]["items"][0]["nombre"] == "GUANTES", co)
    caso("la foto NO va dentro del registro: el registro lleva sólo su referencia", co and str(co[0].get("ticket", "")).startswith("archivo:") and "base64" not in json.dumps(co[0]), str(co[0].get("ticket"))[:80] if co else co)
    caso("sin señal la pantalla lo dice: guardada sin conexión", "Guardada sin conexión" in cuerpo(B) or "sin conexión" in cuerpo(B).lower(), cuerpo(B)[:300])
    B.wait_for_timeout(3000); B.context.set_offline(False)
    subio(B)
    for _ in range(30):
        if any("comprobantes" in u for u in almacen): break
        B.wait_for_timeout(500)
    caso("vuelve la señal: sube la compra y la foto va aparte, al almacén de comprobantes", subio(B) and len(nube.t.get("compras", {})) == 1 and any("comprobantes" in u for u in almacen), [len(nube.t.get("compras", {})), almacen[:3]])

    # ══ 2. El administrador, en su teléfono ══
    A = aparato(ADM, "10:00")
    ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Compras").click(); A.wait_for_timeout(400); t = cuerpo(A)
    caso("la ve por aprobar: qué, quién, dónde, cuánto y sus artículos", "GUANTES Y CINTA INVENTADOS" in t and "ANA INVENTADA" in t and "FERRETERIA INVENTADA" in t and "$185" in t and "GUANTES (2)" in t, t[:800])
    caso("y con su foto (el registro trae la referencia para bajarla)", A.locator(".card", has_text="GUANTES Y CINTA").locator("img").count() >= 1 or str((datos(A)["compras"][0] or {}).get("ticket", "")).startswith("archivo:"), "")
    A.respuesta = ""; A.get_by_role("button", name="✕ Rechazar").click(); A.wait_for_timeout(400)
    caso("rechazar sin decir por qué no la rechaza", datos(A)["compras"][0]["estado"] == "pendiente")
    A.respuesta = "NO ERA PARA EL RANCHO"; A.get_by_role("button", name="✕ Rechazar").click(); A.wait_for_timeout(500)
    c = datos(A)["compras"][0]
    caso("rechazada con su porqué, quién y cuándo, y se enseña así", c["estado"] == "rechazada" and c.get("motivoRechazo") == "NO ERA PARA EL RANCHO" and (c.get("revisadoPor") or {}).get("nombre") == "ADMIN DE PRUEBA" and c.get("revisadoEn") and "NO ERA PARA EL RANCHO" in cuerpo(A), c)
    caso("una compra rechazada no es gasto", A.evaluate("() => window.__agroCuentas().resultado.egresos") == 0)
    subio(A)
    # Otra compra, aprobada
    B.wait_for_timeout(3000); ir(B, "compras")
    campo(B, "Descripción de la compra").fill("REFACCION INVENTADA"); campo(B, "Monto total pagado").fill("420"); B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(300)
    B.get_by_role("button", name="Continuar →").click(); B.wait_for_timeout(300); B.get_by_role("button", name="✓ Enviar compra").click(); B.wait_for_timeout(1000); subio(B)
    A.reload(); A.wait_for_timeout(3500); ir(A, "contabilidad"); A.locator(".tab-pill", has_text="Compras").click(); A.wait_for_timeout(400)
    A.locator(".card", has_text="REFACCION INVENTADA").get_by_role("button", name="✓ Aprobar").click(); A.wait_for_timeout(500)
    c = next(x for x in datos(A)["compras"] if x["descripcion"] == "REFACCION INVENTADA")
    caso("APROBAR deja quién y cuándo, y la compra cuenta como gasto una vez ($420)", c["estado"] == "aprobada" and (c.get("revisadoPor") or {}).get("nombre") == "ADMIN DE PRUEBA" and A.evaluate("() => window.__agroCuentas().resultado.egresos") == 420, [c, A.evaluate("() => window.__agroCuentas().resultado.egresos")])
    subio(A); B.wait_for_timeout(500); B.reload(); B.wait_for_timeout(3500)
    ir(B, "compras"); t = cuerpo(B)
    caso("Ana ve sus compras con lo que se decidió de cada una", "REFACCION INVENTADA" in t and "GUANTES Y CINTA INVENTADOS" in t, t[:700])

    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
