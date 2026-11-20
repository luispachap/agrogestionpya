"""La entrada única, en navegador real: nadie escoge su perfil; el PIN o el correo dicen quién es; la credencial sola
no abre la app (pide el PIN); y registrar asistencia va aparte, sólo en un aparato que dejó un encargado.
Uso:  npx vite --port 5173 &   →   python3 pruebas/entrada_navegador.py"""
import json, pathlib, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
plano = lambda t: t.replace("\n", " | ")
CODIGO = "ABCDEFGHJK"
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-qr", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4821", "credencial": {"codigo": CODIGO, "emitida": "2026-11-01T00:00:00.000Z"}},
                     {"id": "t-dos", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "6060"}, {"id": "t-tres", "nombre": "CARO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "6060"}]
video = pathlib.Path(tempfile.mkdtemp()) / "credencial.y4m"
subprocess.run(["node", str(aqui / "apoyo" / "qr_video.mjs"), f"AGRO1:T:t-qr:{CODIGO}", str(video)], check=True, cwd=str(aqui.parent))
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
marcas = lambda pg: [e for e in pg.evaluate(LEER) if e["tipo"] == "marca"]
sesion = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('agro_sesion_v8:local') || 'null')")
def salir(pg): pg.evaluate("() => { localStorage.removeItem('agro_sesion_v8:local'); }"); pg.reload(); pg.wait_for_timeout(1200)
def intenta(pg, texto):
    pg.locator("#entrada-campo").fill(texto); pg.get_by_role("button", name="Entrar →").click(); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={video}"])
    ctx = b.new_context(viewport={"width": 390, "height": 800}, permissions=["camera"], timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    g["sembrar"](pg)
    t = pg.locator(".login-sheet").inner_text()
    caso("la entrada ya no pregunta «¿quién eres?»: un solo campo para el PIN o el correo", pg.locator(".role-card").count() == 0 and "¿Quién eres?" not in t and "tu pin o tu correo" in t.lower() and "No hay que escoger perfil" in t, plano(t)[:300])
    caso("en un teléfono cualquiera no se ofrece checar desde la entrada: se dice dónde se hace", "Sólo vengo a registrar" not in t and "checador de la nave" in t)
    intenta(pg, "4821")
    caso("con su PIN entra el trabajador, a sus pantallas", (sesion(pg) or {}).get("role") == "trabajador" and sesion(pg)["id"] == "t-qr", sesion(pg))
    salir(pg); intenta(pg, "5501")
    caso("con su PIN entra el encargado, a las suyas, sin haber escogido nada", (sesion(pg) or {}).get("role") == "encargado", sesion(pg))
    salir(pg); intenta(pg, "6060")
    caso("un PIN que tienen dos personas no deja entrar a ninguna y dice qué hacer", sesion(pg) is None and "Ese PIN lo tienen dos personas" in pg.locator(".login-sheet").inner_text())
    intenta(pg, "0000")
    caso("un PIN de nadie no entra y no dice de qué perfil sería", sesion(pg) is None and "PIN incorrecto" in pg.locator(".login-sheet").inner_text())
    intenta(pg, "hola")
    caso("algo que no es PIN ni correo se explica", sesion(pg) is None and "Escribe tu PIN (sólo números) o tu correo" in pg.locator(".login-sheet").inner_text())
    # ── La credencial: dice quién es, y pide el PIN ──
    pg.get_by_role("button", name="Usar mi credencial").click()
    for _ in range(40):
        pg.wait_for_timeout(300)
        if "Hola, ANA DE PRUEBA" in pg.locator(".login-sheet").inner_text(): break
    t = pg.locator(".login-sheet").inner_text()
    caso("la credencial sola no abre la app: saluda por su nombre y pide el PIN", "Hola, ANA DE PRUEBA" in t and "Con la credencial sola no se abre la app" in t and sesion(pg) is None, plano(t)[:300])
    intenta(pg, "9999")
    caso("con la credencial y un PIN que no es el suyo, no entra", sesion(pg) is None and "Ese no es tu PIN" in pg.locator(".login-sheet").inner_text())
    intenta(pg, "4821")
    caso("con la credencial y SU PIN, entra", (sesion(pg) or {}).get("id") == "t-qr", sesion(pg))
    caso("y no quedó ninguna marca de asistencia: entrar no es checar", len(marcas(pg)) == 0)
    # ── El aparato que un encargado dejó para su gente: checar sin abrir sesión ──
    pg.evaluate("() => localStorage.setItem('agro_campo_v8:local', JSON.stringify({ cuentaId: 'u-enc', nombre: 'ENCARGADO DE PRUEBA', desde: '2026-11-20T12:00:00.000Z' }))")
    salir(pg)
    pg.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").click()
    for _ in range(40):
        pg.wait_for_timeout(300)
        if marcas(pg): break
    m = marcas(pg); t = pg.locator(".login-sheet").inner_text()
    caso("en ese aparato se checa con la credencial desde la entrada, y queda a nombre de la cuenta que lo dejó", len(m) == 1 and m[0]["datos"]["trabajadorId"] == "t-qr" and m[0]["datos"]["sentido"] == "entrada" and m[0]["quien"]["id"] == "u-enc" and "ENTRADA" in t, m[0]["datos"] if m else plano(t)[:200])
    caso("checar no abrió ninguna sesión", sesion(pg) is None and pg.locator(".login-bg").count() == 1)
    for d in "6060": pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(400)
    caso("checar con un PIN repetido tampoco escoge a nadie", len(marcas(pg)) == 1 and "dos personas" in pg.locator(".login-sheet").inner_text())
    pg.get_by_role("button", name="Quiero entrar a la app").click(); pg.wait_for_timeout(300)
    caso("y de ahí se regresa a la entrada normal", "tu pin o tu correo" in pg.locator(".login-sheet").inner_text().lower())
    pg.get_by_role("button", name="Soy externo y no tengo PIN").click(); intenta(pg, "PERSONA EXTERNA DE PRUEBA")
    caso("quien no tiene PIN entra como externo con su nombre, y sólo a lo suyo", (sesion(pg) or {}).get("role") == "externo", sesion(pg))
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
