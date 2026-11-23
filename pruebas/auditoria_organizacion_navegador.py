"""AUDITORÍA FUNCIONAL · ORGANIZACIÓN con cuentas: el mapa lo captura SÓLO quien tiene otorgado el permiso
«configurar la organización» (ni el superadministrador por serlo); sin él, la base lo rechaza y no aparece. Con él:
estructura provisional, responsable «por confirmar», persona en un equipo, de quién depende, y otro teléfono que ve
exactamente lo mismo. El mapa no asigna trabajo ni da permisos.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_organizacion_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-23"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
nube = N.Nube([ADM]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "regador", "sueldo_dia": 400, **E}, "actualizado": V}}
t["agronomos"] = {"ag1": {"id": "ag1", "nombre": "AGRONOMO INVENTADO", "pin": "5502", "datos": {**E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
org = lambda pg: plano(pg.locator(".organizacion").inner_text())
unidad = lambda pg, nombre: pg.locator(".org-unidad").filter(has=pg.locator("b", has_text=nombre)).first

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta_):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept())
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta_["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM); ir(A, "organizacion"); tx = org(A)
    caso("la pantalla dice que el mapa no da permisos", "No da ni quita permisos en el sistema" in tx, tx[:400])
    # ── 1 · Sin el permiso otorgado: ni el superadministrador ──
    ofrece = A.get_by_role("button", name="Crear la estructura provisional").count()
    if ofrece: A.get_by_role("button", name="Crear la estructura provisional").click(); A.wait_for_timeout(500)
    subio(A); A.reload(); A.wait_for_timeout(4000); ir(A, "organizacion"); tx = org(A)
    rech = [r for r in nube.t.get("eventos", {}).values() if str(r.get("tipo", "")).startswith("org_")]
    caso("sin el permiso otorgado, ni el superadministrador la captura: la pantalla no lo ofrece (y si llegara, la base lo rechaza)", (ofrece == 0 and not rech) or (rech and all(r.get("validacion") == "rechazado" for r in rech)), (ofrece, [(r.get("tipo"), r.get("validacion")) for r in rech][:4]))
    caso("y en el mapa no aparece nada (lo rechazado se guarda, pero no cuenta)", A.locator(".org-unidad").count() == 0, tx[:600])
    # ── 2 · Con el permiso otorgado ──
    nube.otorgados[ADM["id"]] = ["configurar_organizacion"]
    A.reload(); A.wait_for_timeout(4000); ir(A, "organizacion")
    A.get_by_role("button", name="Crear la estructura provisional").click(); A.wait_for_timeout(600); subio(A); A.reload(); A.wait_for_timeout(4000); ir(A, "organizacion"); tx = org(A); foto(A, "01-estructura")
    caso("con el permiso: nacen las cuatro unidades de arranque, por validar y sin personas", A.locator(".org-unidad").count() == 4 and "0 persona(s)" in tx, tx[:900])
    unidad(A, "Riegos").locator("b").first.click(); A.wait_for_timeout(200)
    A.get_by_role("button", name="Nombrar responsable").click(); A.get_by_label("Persona").select_option("ag1"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    A.get_by_role("button", name="Agregar persona").click(); A.get_by_label("Persona").select_option("t-ana"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    tx = plano(unidad(A, "Riegos").inner_text())
    caso("el responsable nace «por confirmar» y la persona queda en el equipo", "AGRONOMO INVENTADO (por confirmar)" in tx and "1 persona(s)" in tx, tx)
    A.get_by_role("button", name="La gente").click(); A.wait_for_timeout(300); tx = org(A); foto(A, "02-la-gente")
    caso("de quién depende sale de la cadena: Ana depende del responsable de Riegos", "Depende de: AGRONOMO INVENTADO, responsable de Riegos (por confirmar)" in tx, tx[:1200])
    caso("subió y la base lo autorizó", subio(A) and all(r.get("validacion") == "autorizado" for r in nube.t.get("eventos", {}).values() if str(r.get("tipo", "")).startswith("org_") and r["id"] not in [x["id"] for x in rech]))
    # ── 3 · Otro teléfono ──
    B = aparato(ADM); ir(B, "organizacion"); tx = org(B)
    caso("en otro teléfono, el mismo mapa: 4 unidades, Riegos con su responsable y Ana", B.locator(".org-unidad").count() == 4 and "AGRONOMO INVENTADO (por confirmar)" in plano(unidad(B, "Riegos").inner_text()), tx[:900])
    d = B.evaluate("() => ({ act: window.__agroDatos.actividades.length, ind: (window.__agroDatos.indicaciones || []).length, ta: (window.__agroDatos.tareas || []).length })")
    caso("el mapa no creó actividades, indicaciones ni tareas", d == {"act": 0, "ind": 0, "ta": 0}, d)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
