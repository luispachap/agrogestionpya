"""SIN SEÑAL, con la versión que se publica (no la de desarrollo) y su trabajador de servicio de verdad.
Lo que se comprueba: que un teléfono que abrió AgroGestión UNA sola vez con señal la pueda abrir después sin señal
(antes quedaba la pantalla en blanco), que la gente entre con su PIN y que lo guardado en el teléfono siga ahí.
Uso:  npm run build && npx vite preview --port 4173 &   →   python3 pruebas/sinsenal_navegador.py"""
import json, sys
from playwright.sync_api import sync_playwright
URL = "http://localhost:4173/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:300] if det else ""))
SEMILLA = {"trabajadores": [{"id": "t-uno", "nombre": "PERSONA INVENTADA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4101"}],
           "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}], "parcelas": [{"id": "p1", "ranchoId": "r1", "nombre": "PARCELA UNO", "hectareas": 2}]}
with sync_playwright() as p:
    b = p.chromium.launch()
    for nombre in ("Pixel 7", "Galaxy S9+"):
        ctx = b.new_context(**{k: v for k, v in p.devices[nombre].items() if k != "default_browser_type"})
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(3500)                         # UNA visita con señal
        guardado = pg.evaluate("async () => { const o = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) o.push(new URL(r.url).pathname); return o; }")
        caso(f"{nombre}: con una sola visita ya quedó guardado lo que la app necesita para arrancar", "/index.html" in guardado and any(x.startswith("/assets/index-") and x.endswith(".js") for x in guardado), guardado)
        pg.evaluate("s => localStorage.setItem('agro_v8:local', s)", json.dumps(SEMILLA))
        ctx.set_offline(True)
        try: pg.reload(timeout=20000); pg.wait_for_timeout(2500); abre = pg.locator(".login-bg").count() == 1
        except Exception as e: abre = False; errs.append(str(e)[:120])
        caso(f"{nombre}: sin señal, la app abre (no queda en blanco)", abre, errs[:1])
        if abre:
            pg.locator(".login-sheet input").first.fill("4101"); pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)
            caso(f"{nombre}: sin señal, la persona entra con su PIN y ve lo suyo", pg.locator(".login-bg").count() == 0 and "PERSONA" in pg.locator("body").inner_text().upper(), pg.locator("body").inner_text()[:120].replace("\n", " | "))
            pg.reload(timeout=20000); pg.wait_for_timeout(2500)
            d = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:local') || '{}')")
            caso(f"{nombre}: y al volver a abrir sin señal, lo guardado en el teléfono sigue ahí", len(d.get("trabajadores", [])) == 1 and len(d.get("parcelas", [])) == 1 and pg.locator("body").inner_text().strip() != "")
        caso(f"{nombre}: nada tronó", not [e for e in errs if "ERR_INTERNET_DISCONNECTED" not in e], errs[:2])
        ctx.close()
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
