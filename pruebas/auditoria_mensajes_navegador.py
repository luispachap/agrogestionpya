"""AUDITORÍA FUNCIONAL · MENSAJES con cuentas y dos teléfonos: el encargado dice una compra en un grupo, AgroGestión
pregunta lo que falta, el administrador lo completa DESDE OTRO TELÉFONO y la confirma: nace UN gasto con el rastro de quién
lo dijo y quién lo confirmó; la plática no genera nada; recargar no lo duplica. (La privacidad de las conversaciones la
cuida la base y se ataca en `npm run test:base`.)
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_mensajes_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-23"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { chat: d.chat || [], egr: d.egresos || [], conv: (d.eventos || []).filter(e => e.tipo === 'conversacion').map(e => e.datos) }; }")
def manda(pg, texto): pg.locator("textarea").first.fill(texto); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(700)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta_):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept("no aplica"))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta_["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    C = aparato(ENC); ir(C, "chat")
    C.get_by_role("button", name="Nueva conversación").click(); C.wait_for_timeout(200); C.get_by_role("button", name="Nuevo grupo").click(); C.wait_for_timeout(200)
    C.get_by_label("Nombre del grupo").fill("COMPRAS INVENTADAS"); C.get_by_text("Todos los de Administración").click(); C.get_by_role("button", name="Abrir").click(); C.wait_for_timeout(500)
    manda(C, "Compramos tres kilos de clavos."); manda(C, "Ok, gracias"); tx = plano(C.locator("body").inner_text()); foto(C, "01-encargado")
    caso("AgroGestión propone el gasto y pregunta cuánto costó, sin que nadie le hable", "¿Cuánto costó?" in tx, tx[-600:])
    caso("la plática («ok, gracias») no genera propuestas", [len(m["propuestas"]) for m in datos(C)["chat"] if m.get("texto") == "Ok, gracias"] == [0])
    caso("subió", subio(C))
    A = aparato(ADM); ir(A, "chat"); tx = plano(A.locator(".msj-lista").inner_text())
    caso("en el teléfono del administrador aparece el grupo de su puesto con algo por confirmar", "COMPRAS INVENTADAS" in tx and "por confirmar" in tx, tx[:600])
    A.locator(".msj-conv", has_text="COMPRAS INVENTADAS").click(); A.wait_for_timeout(500)
    manda(A, "20 pesos el kilo")
    gastos = [pp for m in datos(A)["chat"] for pp in m["propuestas"] if pp["tipo"] == "gasto"]
    caso("«20 pesos el kilo», dicho desde OTRO teléfono, completa la misma compra: 3 × 20 = 60", len(gastos) == 1 and gastos[0]["monto"] == 60, gastos)
    bur = A.locator(".msj-burbuja", has=A.locator(".msj-prop-chip")).filter(has_text="Compramos tres kilos").first; bur.locator(".msj-prop-chip").click(); A.wait_for_timeout(200); bur.get_by_role("button", name="Sí").click(); A.wait_for_timeout(700); foto(A, "02-confirmado")
    e = datos(A)["egr"]
    caso("al confirmar nace UN gasto de $60 con quién lo dijo y quién lo confirmó", len(e) == 1 and e[0]["monto"] == 60 and e[0]["origen"]["dijo"] == "ENCARGADO DE PRUEBA" and "ADMIN DE PRUEBA" in str(e[0]["origen"]), [(x.get("monto"), x.get("origen")) for x in e])
    caso("subió", subio(A))
    C.reload(); C.wait_for_timeout(4500)
    caso("el encargado, al recargar, ve el gasto confirmado, una sola vez", [x["monto"] for x in datos(C)["egr"]] == [60], [x.get("monto") for x in datos(C)["egr"]])
    A.reload(); A.wait_for_timeout(4500)
    r_ = A.evaluate("() => JSON.parse(JSON.stringify(window.__agroCuentas().resultado))")
    caso("recargar el teléfono del administrador tampoco lo duplica", len(datos(A)["egr"]) == 1, [(x.get("monto"), x.get("categoria"), x.get("destinoInsumo")) for x in datos(A)["egr"]])
    caso("y el gasto cuenta una vez en Finanzas (o queda por clasificar si es de insumos)", r_["egresos"] + r_["porClasificar"]["monto"] == 60, (r_["egresos"], r_["porClasificar"]))
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
