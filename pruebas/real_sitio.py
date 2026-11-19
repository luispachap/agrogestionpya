"""El sitio PUBLICADO, abierto en un navegador real con un teléfono que trae
pruebas viejas guardadas. No crea cuentas ni escribe nada en la base.
Uso: SITIO=https://agrogestion-operacion.vercel.app python3 pruebas/real_sitio.py"""
import json, os, sys
from playwright.sync_api import sync_playwright
SITIO = os.environ["SITIO"].rstrip("/") + "/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
VIEJO = {"agro_v7": json.dumps({"parcelas": [{"id": "p", "nombre": "PARCELA DE PRUEBA"}], "egresos": [{"id": "e", "monto": 999999, "concepto": "GASTO INVENTADO"}],
                                "trabajadores": [{"id": "t", "nombre": "TRABAJADOR VIEJO", "pin": "1111"}]}),
         "agro_pending_v7": json.dumps([{"id": "q1", "operacion": "add", "sec": "egresos", "payload": {"id": "e", "monto": 999999}, "intentos": 0}]),
         "agro_session_v1": json.dumps({"role": "admin", "nombre": "Falso", "id": "x"})}
with sync_playwright() as p:
    b = p.chromium.launch()
    for nombre, tel in [("teléfono", p.devices["Pixel 7"]), ("iPhone", p.devices["iPhone 13"])]:
        nav = b if "iPhone" not in nombre else p.webkit.launch() if False else b
        ctx = b.new_context(**{k: v for k, v in tel.items() if k != "default_browser_type"})
        pg = ctx.new_page(); errores = []; a_la_nube = []
        pg.on("pageerror", lambda e: errores.append(str(e)))
        pg.on("request", lambda r: a_la_nube.append((r.method, r.url)) if "supabase.co" in r.url else None)
        r = pg.goto(SITIO); pg.wait_for_timeout(1500)
        pg.evaluate("v => { for (const k in v) localStorage.setItem(k, v[k]); }", VIEJO)
        pg.reload(); pg.wait_for_timeout(7000)
        caso(f"{nombre}: el sitio abre", r.status == 200 and pg.locator(".login-bg").count() == 1)
        caso(f"{nombre}: una sesión falsa de administrador no entra", pg.locator(".login-bg").count() == 1)
        caso(f"{nombre}: ofrece crear cuenta (está conectado a la nube)", pg.get_by_text("Es mi primera vez: crear mi cuenta").count() == 1)
        llaves = pg.evaluate("() => Object.keys(localStorage)")
        caso(f"{nombre}: trabaja en el cajón del proyecto nuevo", any(k == "agro_v8:cidgbfddrzoilvkqhszg" for k in llaves), ", ".join(sorted(llaves))[:160])
        nuevo = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:cidgbfddrzoilvkqhszg') || '{}')")
        caso(f"{nombre}: abre vacío, sin nada de las pruebas viejas", all(len(nuevo.get(t, [])) == 0 for t in ["parcelas", "egresos", "trabajadores", "ranchos"]))
        escrituras = [u for m, u in a_la_nube if m in ("POST", "PATCH", "PUT", "DELETE") and "/auth/v1/" not in u]
        caso(f"{nombre}: nada de lo viejo intentó subir", not escrituras, "; ".join(escrituras)[:160])
        caso(f"{nombre}: lo de antes sigue intacto en el teléfono", pg.evaluate("() => localStorage.getItem('agro_v7')") == VIEJO["agro_v7"] and pg.evaluate("() => localStorage.getItem('agro_pending_v7')") == VIEJO["agro_pending_v7"])
        caso(f"{nombre}: ninguna pantalla tronó", not errores, "; ".join(errores)[:200])
        if nombre == "teléfono":
            js = "".join(pg.evaluate("async () => { const s = [...document.scripts].map(x => x.src).filter(Boolean); return Promise.all(s.map(u => fetch(u).then(r => r.text()))); }"))
            caso("el código publicado no trae contraseñas ni la llave de servicio", "service_role" not in js and "APP_PASSWORD" not in js and "sb_secret_" not in js)
            caso("ni ganchos de prueba", "__agroIr" not in js and "window.__agro=" not in js.replace(" ", ""))
            pg.screenshot(path="/tmp/claude-0/-home-claude/2756350c-51c5-5cbc-a806-f10e6f12e6de/scratchpad/sitio.png")
        ctx.close()
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
