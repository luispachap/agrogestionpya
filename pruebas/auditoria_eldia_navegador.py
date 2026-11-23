"""AUDITORÍA FUNCIONAL · EL DÍA (la jornada) con cuentas y dos teléfonos: lo planeado contra lo que se sabe, el cierre que
pide el porqué de cada tarea sin evidencia, la foto del cierre, lo que pasa a mañana una sola vez, reabrir con motivo, y
que nada de esto crea pagos, actividades ni gastos. Lo mismo lo ve el administrador en otro teléfono.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_eldia_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY, MANANA = "2026-11-23", "2026-11-24"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["parcelas"] = {p: {"id": p, "nombre": n, "rancho_id": "r1", "datos": {"hectareas": h, "emoji": "🌾", **E}, "actualizado": V} for p, n, h in (("sf4", "SAN FELIPE 4 INVENTADA", 3), ("p53", "LA 53 INVENTADA", 2))}
t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}}
t["cuadrillas"] = {"cq1": {"id": "cq1", "nombre": "CUADRILLA INVENTADA", "pin": "5504", "datos": {"miembros": 5, **E}, "actualizado": V}}
tarea = lambda i, quien, parcela, texto, **extra: {"id": i, "fecha": HOY, "tipo": "tarea", "estado": extra.pop("estado", "mandada"), "parcela_id": parcela, "asignado_a": quien,
    "datos": {"resumen": texto, "deQuien": "ENCARGADO DE PRUEBA", **extra, **E}, "actualizado": V}
t["indicaciones"] = {"i1": tarea("i1", "t-ana", "sf4", "REGAR SAN FELIPE 4", respuesta="hecha"), "i2": tarea("i2", "t-ana", "p53", "DESHIERBAR LA 53"),
                     "i3": tarea("i3", "cq1", "p53", "CORTAR EN LA 53"), "i0": tarea("i0", "t-ana", "p53", "QUITADA", estado="cancelada")}
t["incidencias"] = {"inc1": {"id": "inc1", "estado": "pendiente", "datos": {"fecha": HOY, "desc": "LA BOMBA DEL POZO TIRA ACEITE (INVENTADO)", "tipo": "maquinaria", "prioridad": "alta", **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
cuenta = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { act: d.actividades.length, egr: d.egresos.length, ind: d.indicaciones.length, pagos: (d.eventos || []).filter(e => e.tipo === 'pago_personal').length, ev: (d.eventos || []).map(e => e.tipo) }; }")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta_):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept())
        pg.clock.install(time=f"{HOY}T18:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta_["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    C = aparato(ENC); antes = cuenta(C)
    ir(C, "eldia"); C.get_by_role("button", name="Jornada").click(); C.wait_for_timeout(500); tx = plano(C.locator(".jornada").inner_text()); foto(C, "01-jornada")
    caso("la jornada junta lo planeado (3 tareas; la quitada sale aparte, como cambio del plan) y dice qué se sabe de cada una", "De 3 tarea(s) mandadas: 1 marcadas como hechas" in tx and "El plan tuvo 1 cambio(s) en el día" in tx, tx[:700])
    caso("la incidencia del día sale en la jornada", "LA BOMBA DEL POZO TIRA ACEITE" in tx, tx[:1500])
    C.get_by_role("button", name="Cerrar la jornada").click(); C.wait_for_timeout(300)
    caso("no se cierra sin decir por qué no se hizo cada cosa", "Falta decir por qué no se hizo" in C.locator(".jornada-dice").inner_text() and "cierre_jornada" not in cuenta(C)["ev"], C.locator(".jornada-dice").inner_text())
    C.get_by_label("Por qué no se hizo: ANA INVENTADA").select_option("no_vino"); C.get_by_label("Por qué no se hizo: CUADRILLA INVENTADA").select_option("falta_insumo"); C.get_by_label("Nota: CUADRILLA INVENTADA").fill("NO LLEGARON LAS CAJAS")
    C.get_by_label("Pasa a mañana: ANA INVENTADA").check(); C.get_by_label("Pasa a mañana: CUADRILLA INVENTADA").check(); C.get_by_label("Nota del cierre").fill("DÍA CORTO"); C.get_by_role("button", name="Cerrar la jornada").click(); C.wait_for_timeout(600); tx = plano(C.locator(".jornada").inner_text()); foto(C, "02-cerrada")
    caso("al cerrar queda la foto: quién, cuándo y por qué no se hizo cada cosa", "cerrada (versión 1)" in tx and "La cerró ENCARGADO DE PRUEBA" in tx and "NO LLEGARON LAS CAJAS" in tx, tx[:1200])
    c = cuenta(C)
    caso("cerrar la jornada no crea pagos, actividades, gastos ni tareas", c["act"] == antes["act"] and c["egr"] == antes["egr"] and c["ind"] == antes["ind"] and c["pagos"] == 0, c)
    C.get_by_role("button", name="Poner en el plan de mañana lo que quedó (2)").click(); C.wait_for_timeout(600)
    ind = [i for i in C.evaluate("() => window.__agroDatos.indicaciones") if i.get("fecha") == MANANA]
    caso("lo que quedó pasa a mañana cuando alguien lo pide, apuntando a la tarea de hoy, y una sola vez", sorted(i.get("vieneDe") for i in ind) == ["i2", "i3"] and C.get_by_role("button", name="Poner en el plan de mañana").count() == 0, [(i.get("vieneDe"), i.get("resumen")) for i in ind])
    caso("subió", subio(C))

    # ── En otro teléfono, el administrador ve lo mismo ──
    A = aparato(ADM); ir(A, "eldia"); A.get_by_role("button", name="Jornada").click(); A.wait_for_timeout(500); tx = plano(A.locator(".jornada").inner_text())
    caso("en otro teléfono el administrador ve la jornada cerrada con su foto", "cerrada (versión 1)" in tx and "NO LLEGARON LAS CAJAS" in tx, tx[:900])
    A.get_by_role("button", name="Reparto").click(); A.wait_for_timeout(300); A.get_by_role("button", name="Mañana").first.click(); A.wait_for_timeout(500); tx = cuerpo(A); foto(A, "03-manana")
    caso("y el plan de mañana con lo que quedó de hoy", "DESHIERBAR LA 53" in tx and "quedó de" in tx, tx[-900:])
    A.get_by_role("button", name="Jornada").click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Reabrir la jornada").click(); A.get_by_role("button", name="Reabrir", exact=True).click(); A.wait_for_timeout(300)
    caso("reabrir pide motivo", "Di por qué se reabre" in A.locator(".jornada-dice").inner_text())
    A.get_by_label("Motivo para reabrir").fill("FALTÓ ANOTAR UN AVANCE"); A.get_by_role("button", name="Reabrir", exact=True).click(); A.wait_for_timeout(500); tx = plano(A.locator(".jornada").inner_text())
    caso("reabierta: dice quién y por qué, y la foto anterior se conserva", "Reabierta por ADMIN DE PRUEBA: «FALTÓ ANOTAR UN AVANCE». Ya tuvo 1 cierre(s)" in tx and cuenta(A)["ev"].count("cierre_jornada") == 1, tx[:900])
    caso("subió", subio(A))
    C.reload(); C.wait_for_timeout(4000); ir(C, "eldia"); C.get_by_role("button", name="Jornada").click(); C.wait_for_timeout(500); tx = plano(C.locator(".jornada").inner_text())
    caso("el encargado, al recargar, ve la jornada reabierta por el administrador", "Reabierta por ADMIN DE PRUEBA" in tx, tx[:700])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
