"""AUDITORÍA FUNCIONAL · LAS PRESTACIONES DE QUIEN COBRA POR SEMANA VAN SOBRE LA SEMANA ENTRE 7 (Luis, 23 nov: «el
aguinaldo se calcula en base a salario semanal entre 7, ése es el verdadero salario diario»), mientras su día de pago y de
costo sigue siendo la semana entre 6. Cuenta de administrador, 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_aguinaldo_navegador.py   (URL=… para otro puerto)"""
import datetime, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = os.environ.get("URL", "http://localhost:5174/"); HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V}}
H = [{"desde": "2024-11-01", "sueldo_dia": 583.33, "anterior": 583.33, "sueldo_semana": 3500}]
t["trabajadores"] = {"t-carlos": {"id": "t-carlos", "nombre": "CARLOS INVENTADO", "pin": "4111", "datos": {"categoria": "jornalero", "sueldo_semana": 3500, "sueldo_dia": 583.33, "fechaIngreso": "2024-11-01", "historialSueldo": H, **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).last
modal = lambda pg: pg.locator(".modal-sheet")
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
    A = ctx.new_page(); A.on("pageerror", lambda e: errs.append(str(e))); A.on("dialog", lambda d: d.accept())
    A.clock.install(time=f"{HOY}T06:30:00-06:00"); A.goto(URL); A.wait_for_timeout(1500); reloj["ms"] = A.evaluate("() => Date.now()")
    A.get_by_placeholder("Tu correo o tu PIN").fill(ADM["correo"]); A.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); A.get_by_role("button", name="Entrar").click()
    for _ in range(30):
        A.wait_for_timeout(300)
        if A.locator(".login-bg").count() == 0: break
    A.wait_for_timeout(2500)
    ir(A, "nomina"); tab(A, "Prestaciones")
    A.get_by_label(re.compile("fecha de corte")).fill("2026-07-01"); A.locator(".form-group", has_text="fecha de corte").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(800)
    tarjeta(A, "CARLOS INVENTADO").get_by_role("button", name="Ver mes por mes").click(); A.wait_for_timeout(400)
    c = plano(tarjeta(A, "CARLOS INVENTADO").inner_text())
    caso("el aguinaldo de julio de quien cobra $3,500 por semana sale de 500 por día (la semana entre 7), y lo dice", "2026-07 · Aguinaldo: $636.99" in c and "× 500 (su sueldo de la semana (3500) entre 7, su salario diario" in c, c[:900])
    caso("y no de 583.33 (la semana entre 6, que es su día de pago y de costo)", "583.33 (" not in c, c[:600])
    tarjeta(A, "CARLOS INVENTADO").get_by_role("button", name="Determinar").click()
    A.get_by_label("Qué prestación").select_option("aguinaldo"); A.get_by_label("De qué periodo").select_option("2026"); A.wait_for_timeout(300)
    m = plano(modal(A).inner_text())
    # Calculado hasta hoy (19 nov): 15 días × 323 de 365 × $500 = $6,636.99.
    caso("al determinar el aguinaldo 2026 propone, hasta hoy, 15 días × 323/365 × $500 = $6,636.99, sin imponerlo", "saldrían $6,636.99" in m and "× 500 (su sueldo de la semana (3500) entre 7" in m, m[:500])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
