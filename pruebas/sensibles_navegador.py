"""Lo sensible lo autoriza la base, visto desde la app: un pago capturado no cuenta hasta que la base lo valida;
sin señal queda «por validar»; lo que la base rechaza no tiene efecto; y el permiso es de la cuenta, no de la pantalla.
Corre contra una nube de mentira que valida igual que la hoja 37.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/sensibles_navegador.py"""
import base64, json, sys, time, datetime, re
from playwright.sync_api import sync_playwright
URL, NUBE = "http://localhost:5174/", "http://localhost:5199"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
CUENTA = "00000000-0000-0000-0000-000000000001"
FICHA = f"{b64({'alg': 'HS256'})}.{b64({'sub': CUENTA, 'role': 'authenticated', 'exp': int(time.time()) + 36000})}.firma"
USUARIO = {"id": CUENTA, "email": "uno@prueba.invalid", "aud": "authenticated", "role": "authenticated", "email_confirmed_at": "2026-11-19T00:00:00Z"}
SESION = {"access_token": FICHA, "refresh_token": "r", "token_type": "bearer", "expires_in": 36000, "expires_at": int(time.time()) + 36000, "user": USUARIO}
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Cache-Control": "no-store"}
hoy = datetime.date.today(); dia = hoy - datetime.timedelta(days=1) if hoy.weekday() == 6 else hoy
ahora = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
SENSIBLES = {"pago_personal": "autorizar_pagos", "cierre_semana": "cerrar_semana", "ajuste": "cambiar_reglas", "abono_prestamo": "autorizar_pagos", "recibo_personal": "autorizar_pagos"}
E = "localhost"
nube_ = {"permisos": {"rol": "superadmin", "operaciones": []}, "subidas": [],
    "trabajadores": [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "pin": "4821", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2020-01-01", "sueldo_dia": 400, "anterior": 400}], "_espacio": E}, "actualizado": "2026-01-01T00:00:00Z"}],
    "eventos": {"aus1": {"id": "aus1", "tipo": "ausencia", "fecha": dia.isoformat(), "estado": "vigente", "actualizado": "2026-01-01T00:00:00Z", "recibido": "2026-01-01T00:00:00Z",
        "datos": {"cuando": f"{dia.isoformat()}T18:00:00.000Z", "capturado": f"{dia.isoformat()}T18:00:00.000Z", "quien": {"id": CUENTA, "nombre": "PERSONA UNO", "rol": "admin"}, "origen": None, "relacion": None, "_espacio": E,
                  "datos": {"trabajadorId": "t-ana", "clase": "permiso", "paga": True, "causa": "CITA DE PRUEBA", "autorizo": "RODOLFO DE PRUEBA"}}}}}

def validar(f):
    """Lo mismo que hace la base: el sello sale de la cuenta de la sesión, nunca de lo que venga escrito."""
    viejo = nube_["eventos"].get(f["id"])
    if viejo: return {**viejo, "actualizado": ahora()}
    op = SENSIBLES.get(f.get("tipo")); p = nube_["permisos"]
    fila = {k: v for k, v in f.items() if k in ("id", "tipo", "fecha", "estado", "datos")}
    fila.update(actualizado=ahora(), recibido=ahora(), validacion=None, validacion_dice=None, validado_rol=None)
    if op:
        ok = p["rol"] == "superadmin" or op in p["operaciones"]
        fila.update(validacion="autorizado" if ok else "rechazado", validacion_dice=None if ok else "sin_permiso", validado_rol=p["rol"], validado_por=CUENTA)
    return fila

def nube(route):
    r = route.request; ruta = r.url.split(NUBE)[1].split("?")[0]
    J = lambda o, st=200: route.fulfill(status=st, headers=CORS, content_type="application/json", body=json.dumps(o))
    if r.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
    try: cuerpo = json.loads(r.post_data) if r.post_data else {}
    except Exception: cuerpo = {}
    if ruta == "/auth/v1/token": return J(SESION)
    if ruta.startswith("/auth/v1/"): return J(USUARIO if ruta.endswith("/user") else {})
    if ruta == "/rest/v1/rpc/mis_permisos": return J(nube_["permisos"])
    if ruta.startswith("/rest/v1/rpc/"): return J(None)
    if ruta == "/rest/v1/perfiles": return J([{"id": CUENTA, "nombre": "PERSONA UNO", "rol": "superadmin"}])
    if ruta == "/rest/v1/operacion": return J({"espacio": E, "inicio_operaciones": "2026-11-01", "declarado_el": None, "nota": None})
    if ruta == "/rest/v1/eventos":
        if r.method == "GET": return J(sorted(nube_["eventos"].values(), key=lambda x: x["actualizado"]))
        filas = cuerpo if isinstance(cuerpo, list) else [cuerpo]; salen = []
        for f in filas:
            nube_["subidas"].append(f); g = validar(f); nube_["eventos"][g["id"]] = g; salen.append(g)
        return J(salen, 201)
    if ruta == "/rest/v1/trabajadores" and r.method == "GET": return J(nube_["trabajadores"])
    if ruta.startswith("/rest/v1/") and r.method == "GET": return J([])
    if ruta.startswith("/rest/v1/"): return J([], 201)
    return J({})

LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:localhost', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
pagos = lambda pg: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == "pago_personal"], key=lambda e: e["capturado"])
tarjeta = lambda pg, nombre: pg.locator(".card", has_text=nombre).last
modal = lambda pg: pg.locator(".modal-sheet")
plano = lambda t: t.replace("\n", " | ")
def paga(pg, monto):
    tarjeta(pg, "ANA DE PRUEBA").get_by_role("button", name="Registrar pago").click()
    pg.get_by_label("Cuánto se entregó ($)").fill(str(monto)); modal(pg).get_by_role("button", name="Registrar pago").click(); pg.wait_for_timeout(1500)
def entrar(pg):
    pg.locator(".role-card", has_text="Admin").first.click()
    pg.get_by_placeholder("Tu correo o tu PIN").fill("uno@prueba.invalid"); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg.get_by_role("button", name="Entrar").click()
    for _ in range(30):
        pg.wait_for_timeout(300)
        if pg.locator(".login-bg").count() == 0: break
    pg.wait_for_timeout(3500)      # baja catálogos, eventos y los permisos de la cuenta

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    ctx.route(NUBE + "/**", nube)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(800); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1200)
    entrar(pg)
    pg.evaluate("p => window.__agroIr(p)", "nomina"); pg.wait_for_timeout(800)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("con cuenta de superadministrador, a Ana le corresponde su permiso pagado ($400)", "$400" in a and "Registrar pago" in a, plano(a)[:200])

    # ══ Con señal: el pago sube, la base lo autoriza y entonces cuenta ══
    paga(pg, 150)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); ev = pagos(pg)
    caso("el pago sube sin decir nada de su propia validación", len(nube_["subidas"]) >= 1 and "validacion" not in json.dumps(nube_["subidas"][-1]).lower(), json.dumps(nube_["subidas"][-1])[:120] if nube_["subidas"] else "")
    caso("la base lo autoriza y el aparato recibe el sello enseguida", len(ev) == 1 and ev[0].get("_validacion") == "autorizado" and ev[0].get("_validadoRol") == "superadmin", {k: v for k, v in (ev[0] if ev else {}).items() if k.startswith("_v")})
    caso("y ya cuenta: entregado $150, pendiente $250", "$150" in a and "$250" in a and pg.get_by_text("Por validar").count() == 0, plano(a)[:260])

    # ══ Sin señal: queda por validar y NO cuenta ══
    ctx.set_offline(True); pg.wait_for_timeout(600)
    paga(pg, 50)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); av = pg.locator(".card", has_text="Por validar")
    caso("sin señal el pago se captura, pero queda «por validar»", av.count() == 1 and "Por validar (1)" in av.inner_text() and "$50" in av.inner_text() and "no cuenta" in av.inner_text(), plano(av.inner_text())[:200] if av.count() else "")
    caso("y lo pendiente no baja: siguen $150 entregados y $250 pendientes", "$150" in a and "$250" in a and "$200" not in a, plano(a)[:260])
    ctx.set_offline(False); pg.wait_for_timeout(6000)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("al volver la señal sube solo, la base lo autoriza y entonces cuenta: entregado $200", "$200" in a and pg.get_by_text("Por validar").count() == 0 and all(e.get("_validacion") == "autorizado" for e in pagos(pg)), plano(a)[:260])

    # ══ La cuenta del aparato ya no tiene el permiso (o es la de un encargado): la base rechaza ══
    nube_["permisos"] = {"rol": "encargado", "operaciones": []}
    paga(pg, 100)       # la pantalla todavía lo ofrece: aún no se entera. Quien decide es la base.
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text(); no = pg.locator(".card", has_text="La base no lo autorizó")
    caso("la base rechaza el pago y la app lo dice, con el porqué", no.count() == 1 and "$100" in no.inner_text() and "(encargado) no tiene permiso para: registrar pagos" in no.inner_text() and "no tiene ningún efecto" in no.inner_text(), plano(no.inner_text())[:300] if no.count() else plano(pg.locator("body").inner_text())[:300])
    caso("el pago rechazado no cuenta: siguen $200 entregados", "$200" in a and "$300" not in a, plano(a)[:260])
    caso("y en la base quedó guardado como constancia, con quién lo subió", any(e.get("validacion") == "rechazado" and e.get("validado_rol") == "encargado" for e in nube_["eventos"].values()))
    pg.reload(); pg.wait_for_timeout(5000)
    pg.evaluate("p => window.__agroIr(p)", "nomina"); pg.wait_for_timeout(800)
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("en cuanto el aparato se entera de que su cuenta no tiene el permiso, deja de ofrecer «Registrar pago»", "Registrar pago" not in a and "$200" in a, plano(a)[:260])
    ci = pg.locator(".card", has_text=re.compile("Semana abierta"))
    caso("y tampoco ofrece cerrar la semana: dice que ese permiso lo asigna un administrador", ci.count() == 1 and "Cerrar el cálculo de la semana" not in ci.inner_text() and "Lo asigna un administrador a una cuenta" in ci.inner_text(), plano(ci.inner_text())[:200] if ci.count() else "")

    # ══ Con el permiso específico, sí ══
    nube_["permisos"] = {"rol": "encargado", "operaciones": ["cerrar_semana"]}
    pg.reload(); pg.wait_for_timeout(5000)
    pg.evaluate("p => window.__agroIr(p)", "nomina"); pg.wait_for_timeout(800)
    ci = pg.locator(".card", has_text=re.compile("Semana abierta"))
    a = tarjeta(pg, "ANA DE PRUEBA").inner_text()
    caso("con el permiso de cerrar la semana se ofrece cerrar… y nada más: pagar sigue sin ofrecerse", ci.count() == 1 and "Cerrar el cálculo de la semana" in ci.inner_text() and "Registrar pago" not in a)
    ci.get_by_role("button", name="Cerrar el cálculo de la semana").click(); pg.wait_for_timeout(1500)
    cerr = [e for e in nube_["eventos"].values() if e["tipo"] == "cierre_semana"]
    caso("el cierre sube, la base lo autoriza con ESE permiso y la semana queda cerrada", len(cerr) == 1 and cerr[0]["validacion"] == "autorizado" and pg.locator(".card", has_text="Cálculo cerrado · versión 1").count() == 1)
    caso("ninguna pantalla tronó", pg.get_by_text("Algo salió mal").count() == 0 and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
