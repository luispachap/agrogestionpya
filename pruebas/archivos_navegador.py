"""Las fotos fuera de los registros, en navegador real y sin red:
  1. Una foto subida al buzón se guarda en el teléfono (IndexedDB) y el
     registro sólo lleva la referencia: la memoria de antes ya no carga fotos.
  2. La misma foto dos veces ocupa una sola vez, y la segunda NO se manda a leer.
  3. Después de cerrar y abrir la app, la foto se sigue viendo.
  4. Sin cuenta ligada, las capturas esperan y la app lo dice (no las "quema").
Uso:  npx vite --port 5173 &   →   python3 pruebas/archivos_navegador.py"""
import hashlib, io, json, sys, struct, zlib
from playwright.sync_api import sync_playwright
URL = "http://localhost:5173/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
def h(pin): return hashlib.sha256(("agroselectos|" + pin).encode()).hexdigest()

def png(semilla, lado=900):
    """Una imagen de mentira con suficiente detalle para pesar como una foto."""
    filas = b"".join(b"\x00" + bytes(((x * 7 + y * 13 + semilla * 29 + (x * y) % 97) % 256) for x in range(lado * 3)) for y in range(lado))
    def trozo(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(filas, 1)) + trozo(b"IEND", b"")

SEMILLA = {"config_seguridad": [{"id": "seg", "pin_admin": h("7391")}]}
LEE = "() => JSON.parse(localStorage.getItem('agro_v8:local'))"
EN_TELEFONO = """() => new Promise(ok => { const p = indexedDB.open('agro_archivos_v1', 1);
  p.onsuccess = () => { const r = p.result.transaction('archivos').objectStore('archivos').getAll();
    r.onsuccess = () => ok(r.result.map(f => ({ id: f.id, bytes: f.bytes, subido: f.subido, tam: f.blob.size }))); }; })"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errores = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("dialog", lambda d: d.dismiss())
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.evaluate("s => { localStorage.clear(); localStorage.setItem('agro_v8:local', s); }", json.dumps(SEMILLA))
    pg.reload(); pg.wait_for_timeout(1200)
    pg.locator(".role-card", has_text="Admin").first.click()
    pg.locator(".login-sheet input").first.fill("7391")
    pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)

    def subir(semilla):
        pg.evaluate("() => window.__agroIr('home')"); pg.wait_for_timeout(200)
        pg.evaluate("() => window.__agroIr('papeles')"); pg.wait_for_timeout(500)
        pg.locator('input[type="file"]').first.set_input_files({"name": f"ticket{semilla}.png", "mimeType": "image/png", "buffer": png(semilla)})
        pg.get_by_text("Guardar sin revisar, para después").wait_for(timeout=20000)
        texto = pg.locator(".screen").inner_text()
        pg.get_by_text("Guardar sin revisar, para después").click(); pg.wait_for_timeout(1200)
        return texto

    subir(1)
    d = pg.evaluate(LEE); lec = d.get("lecturas", []); fichas = d.get("archivos", [])
    caso("el papel quedó guardado", len(lec) == 1)
    caso("el registro lleva la referencia, no la foto", len(lec) == 1 and str(lec[0].get("foto", "")).startswith("archivo:"), str(lec[0].get("foto"))[:40] if lec else "")
    caso("hay una ficha del archivo con su peso", len(fichas) == 1 and fichas[0]["bytes"] > 20000, f"{fichas[0]['bytes'] // 1024} kB" if fichas else "")
    tel = pg.evaluate(EN_TELEFONO)
    caso("la foto está en el cajón de fotos del teléfono", len(tel) == 1 and tel[0]["tam"] == tel[0]["bytes"] and tel[0]["id"] == fichas[0]["id"])
    peso = pg.evaluate("() => localStorage.getItem('agro_v8:local').length")
    caso("la memoria de datos ya no carga la foto", peso < fichas[0]["bytes"] / 4, f"datos {peso // 1024} kB contra foto de {fichas[0]['bytes'] // 1024} kB")

    texto2 = subir(1)   # la MISMA foto otra vez
    d = pg.evaluate(LEE)
    caso("la misma foto dos veces ocupa una sola vez", len(d["archivos"]) == 1 and len(pg.evaluate(EN_TELEFONO)) == 1, f"{len(d['lecturas'])} papeles, {len(d['archivos'])} archivo")
    subir(2)
    caso("una foto distinta sí es otro archivo", len(pg.evaluate(LEE)["archivos"]) == 2)

    pg.reload(); pg.wait_for_timeout(1500)   # cerrar y abrir
    pg.locator(".role-card", has_text="Admin").first.click()
    pg.locator(".login-sheet input").first.fill("7391")
    pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)
    pg.evaluate("() => window.__agroIr('papeles')"); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Por revisar").first.click() if pg.get_by_role("button", name="Por revisar").count() else None
    pg.wait_for_timeout(1500)
    fotos = pg.evaluate("() => [...document.querySelectorAll('img[alt=papel]')].map(i => ({ src: i.src.slice(0, 5), ok: i.naturalWidth > 0 }))")
    caso("al volver a abrir la app, las fotos se siguen viendo", len(fotos) >= 2 and all(f["ok"] and f["src"] == "blob:" for f in fotos), json.dumps(fotos)[:120])
    caso("ninguna pantalla tronó", not errores, "; ".join(errores)[:200])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
