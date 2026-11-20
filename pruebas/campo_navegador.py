"""La captura de campo, en navegador real, contra una nube DE MENTIRA que se
porta como la de verdad (rechaza lo que llega sin cuenta):
  1. Un trabajador captura con su PIN en un teléfono SIN cuenta ligada: se
     guarda, NO se quema en reintentos, y la app dice que está sin subir.
  2. El teléfono queda ligado a la cuenta de un encargado: la cuenta NO abre
     sus pantallas sola (hay que saber la contraseña)...
  3. ...pero lo que el trabajador capturó SÍ sube, con la sesión del encargado
     y conservando el nombre de quien lo capturó y su sueldo de ese día.
  4. Subirle el sueldo a alguien deja anotado el cambio.
Uso:
  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
  python3 pruebas/campo_navegador.py"""
import base64, json, sys, time
from playwright.sync_api import sync_playwright
URL, NUBE = "http://localhost:5174/", "http://localhost:5199"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))

b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
CUENTA = "00000000-0000-0000-0000-000000000003"
FICHA = f"{b64({'alg': 'HS256'})}.{b64({'sub': CUENTA, 'role': 'authenticated', 'exp': int(time.time()) + 36000})}.firma"
SESION = {"access_token": FICHA, "refresh_token": "r", "token_type": "bearer", "expires_in": 36000,
          "expires_at": int(time.time()) + 36000, "user": {"id": CUENTA, "email": "encargado@prueba.invalid", "aud": "authenticated", "role": "authenticated"}}
SEMILLA = {"trabajadores": [{"id": "t-prueba", "nombre": "TRABAJADOR DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "5503"}]}
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Cache-Control": "no-store"}
subidas, rechazadas = [], []

def nube(route):
    r = route.request; ruta = r.url.split(NUBE)[1].split("?")[0]
    if r.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
    con_cuenta = r.headers.get("authorization", "") == "Bearer " + FICHA
    if ruta.startswith("/rest/v1/rpc/"): return route.fulfill(status=200, headers=CORS, content_type="application/json", body="null")
    if ruta == "/rest/v1/perfiles": return route.fulfill(status=200, headers=CORS, content_type="application/json",
        body=json.dumps({"id": CUENTA, "nombre": "ENCARGADO DE PRUEBA", "rol": "encargado"}) if con_cuenta else "null")
    if ruta.startswith("/rest/v1/") and r.method == "GET": return route.fulfill(status=200, headers=CORS, content_type="application/json", body="[]")
    if ruta.startswith("/rest/v1/"):
        tabla = ruta.split("/")[-1]
        if not con_cuenta:   # así contesta la base real a quien no tiene cuenta
            rechazadas.append(tabla)
            return route.fulfill(status=401, headers=CORS, content_type="application/json", body=json.dumps({"code": "42501", "message": "new row violates row-level security policy"}))
        subidas.append((tabla, json.loads(r.post_data or "{}")))
        return route.fulfill(status=201, headers=CORS, content_type="application/json", body="[]")
    return route.fulfill(status=200, headers=CORS, content_type="application/json", body="{}")

def entrar_trabajador(pg):
    pg.locator(".login-sheet input").first.fill("5503")
    pg.get_by_role("button", name="Entrar").click()
    for _ in range(20):
        pg.wait_for_timeout(300)
        if pg.locator(".login-bg").count() == 0: return True
    return False
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]')"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    ctx.route(NUBE + "/**", nube)   # la última regla puesta es la que manda
    pg = ctx.new_page(); errores = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.evaluate("s => { localStorage.clear(); localStorage.setItem('agro_v8:localhost', s); }", json.dumps(SEMILLA))
    pg.reload(); pg.wait_for_timeout(1200)

    # ── 1 · sin cuenta ligada ──
    caso("el trabajador entra con su PIN", entrar_trabajador(pg))
    pg.evaluate("""() => window.__agro.add('actividades', { fecha: '2026-11-19', parcelaId: 'R01', tipo: 'riego', horas: 8,
        trabajadorId: 't-prueba', registradoPor: { rol: 'trabajador', id: 't-prueba', nombre: 'TRABAJADOR DE PRUEBA' } })""")
    pg.wait_for_timeout(6000)   # tiempo de sobra para que la cola hubiera reintentado
    cola = pg.evaluate(COLA)
    act = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:localhost')).actividades")
    caso("la captura quedó guardada en el teléfono", len(act) == 1)
    caso("y lleva el sueldo de ese día pegado", len(act) == 1 and act[0].get("sueldoDia") == 350 and act[0].get("trabajadorNombre") == "TRABAJADOR DE PRUEBA")
    caso("espera en la cola sin gastar intentos", len(cola) == 1 and cola[0].get("intentos", 0) == 0 and len(rechazadas) == 1, f"intentos={cola[0].get('intentos') if cola else '-'}, rechazos de la nube={len(rechazadas)}")
    caso("la app dice que está SIN subir y por qué", pg.get_by_text("SIN subir: ninguna cuenta está ligada").count() > 0)
    caso("nada se apartó como fallido", pg.evaluate("() => JSON.parse(localStorage.getItem('agro_fallidas_v8:localhost') || '[]').length") == 0)

    # ── 2 · el encargado deja su cuenta ligada ──
    pg.evaluate("""([ses, cuenta]) => { localStorage.setItem('sb-localhost-auth-token', JSON.stringify(ses));
        localStorage.setItem('agro_campo_v8:localhost', JSON.stringify({ cuentaId: cuenta, nombre: 'ENCARGADO DE PRUEBA', desde: new Date().toISOString() }));
        localStorage.removeItem('agro_sesion_v8:localhost'); }""", [SESION, CUENTA])
    pg.reload(); pg.wait_for_timeout(2500)
    caso("con el teléfono ligado, la cuenta del encargado NO abre sus pantallas sola", pg.locator(".login-bg").count() == 1)

    # ── 3 · ahora sí sube ──
    caso("el trabajador vuelve a entrar con su PIN", entrar_trabajador(pg))
    for _ in range(40):
        pg.wait_for_timeout(500)
        if not pg.evaluate(COLA): break
    arriba = [d for t, d in subidas if t == "actividades"]
    if not arriba: print("   [detalle]", "subidas:", [t for t, _ in subidas], "rechazadas:", rechazadas, "cola:", pg.evaluate(COLA), "llaves:", pg.evaluate("() => Object.keys(localStorage)"))
    caso("lo capturado subió y la cola quedó vacía", len(arriba) >= 1 and len(pg.evaluate(COLA)) == 0, f"{len(arriba)} subida(s)")
    d = (arriba[0].get("datos") or {}) if arriba else {}
    caso("subió con el nombre de quien capturó, no el del encargado", (d.get("registradoPor") or {}).get("nombre") == "TRABAJADOR DE PRUEBA" and d.get("sueldoDia") == 350)
    caso("y ya no sale el aviso de 'sin subir'", pg.get_by_text("SIN subir: ninguna cuenta está ligada").count() == 0)

    # ── 4 · un cambio de sueldo queda anotado ──
    pg.evaluate("() => { const t = JSON.parse(localStorage.getItem('agro_v8:localhost')).trabajadores[0]; window.__agro.upd('trabajadores', { ...t, sueldo_dia: 400 }); }")
    pg.wait_for_timeout(1200)
    t = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:localhost')).trabajadores[0]")
    h = t.get("historialSueldo") or []
    caso("subir un sueldo deja anotado desde cuándo y cuánto ganaba antes", len(h) == 1 and h[0]["sueldo_dia"] == 400 and h[0]["anterior"] == 350, json.dumps(h))
    caso("ninguna pantalla tronó", not errores, "; ".join(errores)[:200])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
