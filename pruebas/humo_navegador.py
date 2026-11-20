"""Prueba de humo en navegador real (Chromium): la app compilada abre, y los
ataques C-1 y C-3 del diagnóstico ya no funcionan. Uso:
   npm run build && npx vite preview --port 4173 &   →   python3 pruebas/humo_navegador.py
No toca red externa ni datos reales."""
import json, sys
from playwright.sync_api import sync_playwright
URL = "http://localhost:4173/"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errores = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1500)
    caso("la app abre y muestra el acceso", pg.locator(".login-bg").count() > 0)
    # C-1: PIN de fábrica de cada rol de dirección
    for rol, pin in (("Admin", "1234"), ("Dirección", "0000"), ("Finanzas", "4444")):
        campo = pg.locator("input").first; campo.fill(pin)
        pg.get_by_role("button", name="Entrar").click()
        for _ in range(40):  # hasta 20 s: el acceso puede tardar si intenta consultar la nube
            pg.wait_for_timeout(500)
            if pg.locator(".login-bg").count() == 0 or pg.locator(".login-bg .alert-desc").count() > 0: break
        sigue_fuera = pg.locator(".login-bg").count() > 0
        caso(f"C-1 · PIN de fábrica de {rol} ya no entra", sigue_fuera, (pg.locator(".alert-desc").first.text_content() or "")[:70] if sigue_fuera else "ENTRÓ COMO " + rol.upper())
        if not sigue_fuera:  # versión vulnerable: limpiar para poder seguir probando
            pg.evaluate("() => localStorage.removeItem('agro_sesion_v8:local')"); pg.reload(); pg.wait_for_timeout(1200)
    # C-3: sesión falsificada escrita a mano en el teléfono
    for falsa in ({"role": "admin", "id": "admin", "nombre": "X", "cuenta": True}, {"role": "encargado", "id": "inventado", "nombre": "X"}, {"role": "finanzas", "id": "finanzas", "cuenta": True}):
        pg.evaluate("s => localStorage.setItem('agro_sesion_v8:local', s)", json.dumps(falsa))
        pg.reload(); pg.wait_for_timeout(1200)
        fuera = pg.locator(".login-bg").count() > 0
        borrada = pg.evaluate("() => localStorage.getItem('agro_sesion_v8:local')") is None
        caso(f"C-3 · sesión falsa de {falsa['role']} es rechazada y borrada", fuera and borrada)
    # M-7: la app recién abierta no trae trabajadores en el teléfono
    datos = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:local') || '{}')")
    caso("M-7 · una instalación nueva no trae trabajadores precargados", len(datos.get("trabajadores", [])) == 0, f"{len(datos.get('trabajadores', []))} trabajadores")
    caso("sin errores de ejecución en la página", not errores, "; ".join(errores)[:200])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
