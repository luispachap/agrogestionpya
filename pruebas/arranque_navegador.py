"""El arranque limpio, en navegador real: un teléfono que trae guardadas pruebas
viejas abre la versión nueva y...
  1. no las muestra, no las sube (ni teniendo cuenta con permiso), y no las toca;
  2. no deja restaurar un respaldo de antes;
  3. sí deja DESCARGAR lo de antes, tal cual, para archivo;
  4. lo que se captura hoy sí sube, con la marca de este espacio.
Uso (los dos servidores):
  npx vite --port 5173 &
  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
  python3 pruebas/arranque_navegador.py"""
import base64, hashlib, json, sys, time
from playwright.sync_api import sync_playwright
NUBE = "http://localhost:5199"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
def h(pin): return hashlib.sha256(("agroselectos|" + pin).encode()).hexdigest()
b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
CUENTA = "00000000-0000-0000-0000-000000000003"
FICHA = f"{b64({'alg': 'HS256'})}.{b64({'sub': CUENTA, 'role': 'authenticated', 'exp': int(time.time()) + 36000})}.firma"
SESION = {"access_token": FICHA, "refresh_token": "r", "token_type": "bearer", "expires_in": 36000, "expires_at": int(time.time()) + 36000,
          "user": {"id": CUENTA, "email": "encargado@prueba.invalid", "aud": "authenticated", "role": "authenticated"}}

# Lo que un teléfono trae de cuando la app estaba a prueba (todo inventado).
VIEJO = {
  "agro_v7": json.dumps({"parcelas": [{"id": "p_viejo", "nombre": "PARCELA DE PRUEBA"}], "trabajadores": [{"id": "t_viejo", "nombre": "TRABAJADOR VIEJO", "pin": "1111", "sueldo_dia": 1}],
                         "egresos": [{"id": "e_viejo", "monto": 999999, "concepto": "GASTO INVENTADO"}], "inventario": [{"id": "i_viejo", "nombre": "UREA", "existencia": 500}]}),
  "agro_pending_v7": json.dumps([{"id": "q1", "operacion": "add", "sec": "egresos", "payload": {"id": "e_viejo", "monto": 999999}, "intentos": 0}]),
  "agro_fallidas_v1": json.dumps([{"id": "q2", "operacion": "add", "sec": "actividades", "payload": {"id": "a_viejo", "horas": 8}, "intentos": 5}]),
}
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Cache-Control": "no-store"}
escrituras = []
def nube(route):
    r = route.request; ruta = r.url.split(NUBE)[1].split("?")[0]
    if r.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
    if ruta.startswith("/rest/v1/rpc/"): return route.fulfill(status=200, headers=CORS, content_type="application/json", body="null")
    if ruta == "/rest/v1/perfiles": return route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps({"id": CUENTA, "nombre": "ENCARGADO DE PRUEBA", "rol": "encargado"}))
    if ruta.startswith("/rest/v1/") and r.method == "GET": return route.fulfill(status=200, headers=CORS, content_type="application/json", body="[]")
    if ruta.startswith("/rest/v1/"):
        escrituras.append((ruta.split("/")[-1], json.loads(r.post_data or "{}")))
        return route.fulfill(status=201, headers=CORS, content_type="application/json", body="[]")
    return route.fulfill(status=200, headers=CORS, content_type="application/json", body="{}")
TOMA = "() => Object.fromEntries(['agro_v7', 'agro_pending_v7', 'agro_fallidas_v1'].map(k => [k, localStorage.getItem(k)]))"

with sync_playwright() as p:
    b = p.chromium.launch()
    # ── A · con nube y con una cuenta que SÍ tiene permiso de subir ──
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    ctx.route(NUBE + "/**", nube)
    pg = ctx.new_page(); errores = []
    pg.on("pageerror", lambda e: errores.append(str(e))); pg.on("dialog", lambda d: d.dismiss())
    pg.goto("http://localhost:5174/"); pg.wait_for_timeout(800)
    pg.evaluate("([v, ses]) => { localStorage.clear(); for (const k in v) localStorage.setItem(k, v[k]); localStorage.setItem('sb-localhost-auth-token', JSON.stringify(ses)); }", [VIEJO, SESION])
    pg.reload(); pg.wait_for_timeout(8000)   # tiempo de sobra para bajar, mezclar y vaciar cualquier cola
    caso("la cuenta entra a la versión nueva", pg.locator(".login-bg").count() == 0)
    nuevo = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:localhost') || '{}')")
    caso("la operación nueva abre vacía: ni parcelas, ni gente, ni gastos de antes",
         all(len(nuevo.get(t, [])) == 0 for t in ["parcelas", "trabajadores", "egresos", "inventario", "actividades", "ranchos"]),
         ", ".join(f"{t}={len(nuevo.get(t, []))}" for t in ["parcelas", "trabajadores", "egresos", "inventario"]))
    caso("en pantalla no aparece nada de lo viejo", not any(x in pg.locator("body").inner_text() for x in ["PARCELA DE PRUEBA", "GASTO INVENTADO", "TRABAJADOR VIEJO"]))
    caso("NADA de lo viejo subió, ni lo que estaba en cola ni lo apartado", len(escrituras) == 0, f"{len(escrituras)} escritura(s) a la nube")
    caso("lo de antes sigue en el teléfono, idéntico", pg.evaluate(TOMA) == VIEJO)
    # y lo que se captura hoy sí sube, marcado
    pg.evaluate("() => window.__agro.add('tareas', { titulo: 'Tarea de hoy', fecha: '2026-11-19' })"); pg.wait_for_timeout(2500)
    hoy = [d for t, d in escrituras if t == "tareas"]
    caso("lo capturado hoy sí sube, con la marca de este espacio", len(hoy) == 1 and (hoy[0].get("datos") or {}).get("_espacio") == "localhost", json.dumps([t for t, _ in escrituras]))
    caso("y sigue sin subir nada viejo", not any("viejo" in json.dumps(d) or "999999" in json.dumps(d) for _, d in escrituras))
    caso("ninguna pantalla tronó", not errores, "; ".join(errores)[:200])
    ctx.close()

    # ── B · el respaldo viejo no se restaura; lo de antes sí se descarga ──
    ctx = b.new_context(viewport={"width": 390, "height": 800}, accept_downloads=True)
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:5173/"); pg.wait_for_timeout(800)
    pg.evaluate("([v, s]) => { localStorage.clear(); for (const k in v) localStorage.setItem(k, v[k]); localStorage.setItem('agro_v8:local', s); }",
                [VIEJO, json.dumps({"config_seguridad": [{"id": "seg", "pin_admin": h("7391")}]})])
    pg.reload(); pg.wait_for_timeout(1200)
    pg.locator(".role-card", has_text="Admin").first.click(); pg.locator(".login-sheet input").first.fill("7391")
    pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)
    pg.evaluate("() => window.__agroIr('respaldo')"); pg.wait_for_timeout(600)
    pg.locator('input[type="file"]').first.set_input_files({"name": "respaldo-agroselectos-2026-09-01.json", "mimeType": "application/json", "buffer": VIEJO["agro_v7"].encode()})
    pg.wait_for_timeout(900)
    caso("un respaldo de antes NO se restaura, y la app dice por qué", pg.get_by_text("versión anterior").count() > 0)
    d = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:local'))")
    caso("y los datos de la operación quedan intactos", len(d.get("egresos", [])) == 0 and len(d.get("trabajadores", [])) == 0)
    caso("la app ofrece descargar lo de antes", pg.get_by_text("Datos de antes en este teléfono").count() == 1)
    with pg.expect_download() as bajada: pg.get_by_role("button", name="Descargar los datos de antes").click()
    archivo = json.loads(open(bajada.value.path(), encoding="utf8").read())
    caso("y lo descargado trae lo viejo completo, tal cual", archivo["llaves"]["agro_v7"] == VIEJO["agro_v7"] and archivo["llaves"]["agro_pending_v7"] == VIEJO["agro_pending_v7"])
    caso("descargar no borró ni movió nada", pg.evaluate(TOMA) == VIEJO)
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
