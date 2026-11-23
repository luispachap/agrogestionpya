"""AUDITORÍA FUNCIONAL · CHECAR SIN ABRIR SESIÓN, en el aparato que dejó el encargado: con PIN y con la credencial frente
a la cámara. La cámara es de IMITACIÓN (Chromium con un video que enseña el código de la credencial): prueba el camino
completo de la app, no una cámara de verdad ni la luz del campo — eso es la prueba de campo. Un aparato que nadie ligó
no ofrece la puerta. Cuentas, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_checador_navegador.py"""
import os, pathlib, subprocess, sys, tempfile
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
H = [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}]
nube.t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": H, **E}, "actualizado": V},
                          "t-beto": {"id": "t-beto", "nombre": "BETO INVENTADO", "pin": "4102", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": H, "credencial": {"codigo": "CREDINVENTADA01", "emitida": "2026-11-01", "por": "ADMIN DE PRUEBA"}, **E}, "actualizado": V}}
# El video de la cámara de imitación: el código de la credencial de Beto.
tmp = pathlib.Path(tempfile.mkdtemp()); pgm, y4m = tmp / "qr.pgm", tmp / "qr.y4m"
subprocess.run(["node", str(pathlib.Path(__file__).parent / "apoyo" / "imagen_qr.mjs"), "AGRO1:T:t-beto:CREDINVENTADA01", str(pgm)], check=True, capture_output=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(pgm), "-t", "8", "-r", "10", "-pix_fmt", "yuv420p", str(y4m)], check=True)
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
marcas_en_nube = lambda: [v for v in nube.t.get("eventos", {}).values() if "marca" in str(v.get("tipo") or (v.get("datos") or {}).get("tipo") or "")]

with sync_playwright() as p:
    errs = []
    def navegador(camara):
        args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={y4m}"] if camara else []
        return p.chromium.launch(args=args)
    def aparato(br, cuenta, hh="07:00", camara=False):
        ctx = br.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", permissions=["camera"] if camara else [])
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept())
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
    teclea = lambda pg, pin: ([pg.locator(".chk-teclas button", has_text=d).first.click() for d in pin], pg.locator(".chk-teclas button.ok").click(), pg.wait_for_timeout(900))

    # ══ 1. Un aparato que nadie ligó no ofrece checar sin sesión ══
    b0 = navegador(False); X = aparato(b0, None)
    caso("un aparato que nadie ligó no ofrece la puerta de checar: dice dónde se checa", X.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").count() == 0 and "se registran en el checador de la nave" in cuerpo(X), cuerpo(X)[:400])
    b0.close()

    # ══ 2. El encargado deja su teléfono ligado; Ana checa con su PIN sin abrir la app ══
    bc = navegador(True); B = aparato(bc, ENC, camara=True); subio(B); salir(B)
    B.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").click(); B.wait_for_timeout(800); t = cuerpo(B)
    caso("en el aparato que dejó el encargado sí está la puerta, y dice de quién es el aparato", "Registrar mi entrada o salida" in t and "Este aparato lo dejó ENCARGADO DE PRUEBA" in t, t[:500])
    teclea(B, "4101"); t = cuerpo(B)
    caso("ANA checa con su PIN: dice su nombre y que es su entrada", "ANA INVENTADA" in t and "ntrada" in t, t[:500])
    caso("y NO se abrió la app: sigue en la pantalla de entrada, sin nada de nadie", B.locator(".login-bg").count() >= 1 and "Pagos al personal" not in t and "Finanzas" not in t, t[:300])
    # ══ 3. Beto acerca su credencial a la cámara (de imitación) ══
    for _ in range(30):
        if "BETO INVENTADO" in cuerpo(B): break
        B.wait_for_timeout(500)
    t = cuerpo(B)
    caso("BETO se checa con su credencial frente a la cámara (imitación): dice su nombre", "BETO INVENTADO" in t, t[:500])
    B.wait_for_timeout(2500)
    caso("la misma credencial frente a la cámara no se marca diez veces", len([e for e in datos(B)["eventos"] if (e.get("datos") or {}).get("trabajadorId") == "t-beto" or (e.get("datos") or {}).get("persona", {}).get("id") == "t-beto"]) <= 2, [e["tipo"] for e in datos(B)["eventos"]][:10])
    subio(B)
    ev = [e for e in datos(B)["eventos"] if "marca" in e["tipo"] or "checad" in e["tipo"]]
    caso("quedan las marcas de Ana y de Beto, capturadas por el aparato del encargado", len({(e.get("datos") or {}).get("trabajadorId") or ((e.get("datos") or {}).get("persona") or {}).get("id") for e in ev}) >= 2 and all("ENCARGADO" in str(e.get("quien")) or "ENCARGADO" in str((e.get("datos") or {})) for e in ev), [(e["tipo"], e.get("quien"), e.get("datos")) for e in ev][:3])
    # ══ 4. El administrador lo ve en su teléfono ══
    bA = p.chromium.launch(); A = aparato(bA, ADM, "09:00")
    ir(A, "jornadas"); t = cuerpo(A)
    caso("el administrador ve en Jornadas a Ana y a Beto adentro, con su hora", "ANA INVENTADA" in t and "BETO INVENTADO" in t and "Adentro (2)" in t, t[:700])
    # ══ 5. La credencial IMPRESA, de ida y vuelta: lo que sale en la hoja se lee en el checador ══
    ir(A, "credenciales"); A.wait_for_timeout(500); t = cuerpo(A)
    caso("Credenciales: Beto tiene la suya, y no enseña su PIN", "BETO INVENTADO" in t and "4102" not in t, t[:500])
    A.emulate_media(media="print"); A.wait_for_timeout(400)
    hoja = A.locator(".printable.cred-hoja .cred", has_text="BETO INVENTADO").first
    caso("al imprimir sale la credencial de Beto con su código y su nombre", hoja.count() == 1 and hoja.locator("svg, canvas, img").count() >= 2, A.locator(".printable.cred-hoja").inner_text()[:200] if A.locator(".printable.cred-hoja").count() else "sin hoja")
    impresa = tmp / "impresa.png"; hoja.screenshot(path=str(impresa)); A.emulate_media(media="screen")
    y4m2 = tmp / "impresa.y4m"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(impresa), "-vf", "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:color=white", "-t", "8", "-r", "10", "-pix_fmt", "yuv420p", str(y4m2)], check=True)
    bi = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={y4m2}"])
    C = aparato(bi, ENC, "16:00", camara=True); subio(C); salir(C)
    C.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").click(); C.wait_for_timeout(500)
    for _ in range(30):
        if "BETO INVENTADO" in cuerpo(C): break
        C.wait_for_timeout(500)
    caso("la credencial IMPRESA frente a la cámara (de imitación) checa a Beto", "BETO INVENTADO" in cuerpo(C), cuerpo(C)[:500])
    subio(C); bi.close()
    caso("nada quedó sin subir ni rechazado por la base", subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    bc.close(); bA.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
