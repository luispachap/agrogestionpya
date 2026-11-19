"""Alta de cuentas sin consola y pantalla de Arranque, en navegador real contra
una nube de mentira que contesta como la de verdad:
  1. Crear cuenta desde la app; sin invitación ni código NO se entra.
  2. Con el código de arranque se entra como superadministrador.
  3. Invitar a un encargado, registrar el conteo inicial, capturar un saldo
     inicial con evidencia y declarar la fecha de inicio.
Uso:
  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
  python3 pruebas/cuentas_navegador.py"""
import base64, json, sys, time
from playwright.sync_api import sync_playwright
URL, NUBE = "http://localhost:5174/", "http://localhost:5199"
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
CUENTA = "00000000-0000-0000-0000-000000000001"
FICHA = f"{b64({'alg': 'HS256'})}.{b64({'sub': CUENTA, 'role': 'authenticated', 'exp': int(time.time()) + 36000})}.firma"
USUARIO = {"id": CUENTA, "email": "uno@prueba.invalid", "aud": "authenticated", "role": "authenticated", "email_confirmed_at": "2026-11-19T00:00:00Z"}
SESION = {"access_token": FICHA, "refresh_token": "r", "token_type": "bearer", "expires_in": 36000, "expires_at": int(time.time()) + 36000, "user": USUARIO}
CODIGO = "AAAAA-BBBBB-CCCCC-DDDDD"
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Cache-Control": "no-store"}
DEPURA = False
estado = {"perfil": None, "altas": [], "reclamos": [], "invitaciones": [], "inicio": None, "escrituras": []}

def nube(route):
    r = route.request; ruta = r.url.split(NUBE)[1].split("?")[0]
    J = lambda o, st=200: route.fulfill(status=st, headers=CORS, content_type="application/json", body=json.dumps(o))
    if r.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
    if DEPURA: print("   [nube]", r.method, ruta, (r.headers.get("accept") or "")[:40], flush=True)
    try: cuerpo = json.loads(r.post_data) if r.post_data else {}
    except Exception: cuerpo = {}          # un archivo subiendo, no un registro
    if ruta == "/auth/v1/resend": estado.setdefault("reenvios", []).append(cuerpo); return J({})
    if ruta == "/auth/v1/signup": estado["altas"].append(cuerpo); return J({**USUARIO, "email": cuerpo.get("email"), "email_confirmed_at": None})
    if ruta == "/auth/v1/token": return J(SESION) if cuerpo.get("password") == "contrasena-larga-1" else J({"error": "invalid_grant", "error_description": "Invalid login credentials"}, 400)
    if ruta.startswith("/auth/v1/"): return J(USUARIO if ruta.endswith("/user") else {})
    if ruta == "/rest/v1/rpc/reclamar_acceso":
        estado["reclamos"].append(cuerpo.get("p_codigo"))
        if cuerpo.get("p_codigo") == CODIGO: estado["perfil"] = {"id": CUENTA, "nombre": "PERSONA UNO", "rol": "superadmin"}; return J("superadmin")
        return J({"code": "P0001", "message": "Tu cuenta todavía no está invitada. Pídele a un administrador que te invite con este mismo correo."}, 400)
    if ruta == "/rest/v1/rpc/declarar_inicio": estado["inicio"] = cuerpo; return J(cuerpo.get("p_fecha"))
    if ruta.startswith("/rest/v1/rpc/"): return J(None)
    if ruta == "/rest/v1/perfiles" and DEPURA: print("   [perfiles]", r.method, r.headers.get("accept"), estado["perfil"], estado["reclamos"])
    if ruta == "/rest/v1/perfiles": return J([estado["perfil"]] if estado["perfil"] else [])
    if ruta == "/rest/v1/operacion": return J({"espacio": "localhost", "inicio_operaciones": (estado["inicio"] or {}).get("p_fecha"), "declarado_el": None, "nota": (estado["inicio"] or {}).get("p_nota")})
    if ruta == "/rest/v1/preferencias":      # el acomodo de cada quien: un renglón por cuenta
        if r.method == "GET": return J([{"datos": estado["prefs"]}] if estado.get("prefs") else [])
        estado["prefs"] = cuerpo.get("datos"); estado["prefs_de"] = cuerpo.get("id"); return J([], 201)
    if ruta == "/rest/v1/invitaciones":
        if r.method == "GET": return J(estado["invitaciones"])
        estado["invitaciones"].append({**cuerpo, "usada_el": None, "cancelada": False, "creada": "2026-11-19T00:00:00Z"}); return J([], 201)
    if ruta.startswith("/rest/v1/") and r.method == "GET": return J([])
    if ruta.startswith("/rest/v1/"): estado["escrituras"].append((ruta.split("/")[-1], cuerpo)); return J([], 201)
    if ruta.startswith("/storage/v1/object/comprobantes/"): estado["subidos"] = estado.get("subidos", 0) + 1; return J({"Key": ruta})
    return J({})

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    ctx.route(NUBE + "/**", nube)
    pg = ctx.new_page(); errores = []; dialogos = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("dialog", lambda d: (dialogos.append(d.message), d.accept("INICIO") if d.type == "prompt" else d.accept()))
    pg.goto(URL); pg.wait_for_timeout(800); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1200)

    # ── 0 · volver del correo de confirmación ──
    pg.goto("about:blank")   # el enlace del correo abre la app desde cero, no dentro de la misma página
    pg.goto(URL + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"); pg.wait_for_timeout(1500)
    caso("un enlace caducado se explica en la app, no en una página rota", pg.get_by_text("ya se usó o caducó").count() > 0 and "#" not in pg.url)
    pg.get_by_placeholder("Tu correo o tu PIN").fill("uno@prueba.invalid")
    pg.get_by_role("button", name="Mandar otra vez el correo de confirmación").click(); pg.wait_for_timeout(900)
    re = (estado.get("reenvios") or [{}])[0]
    caso("y se puede pedir otro correo desde ahí", re.get("email") == "uno@prueba.invalid" and re.get("type") == "signup" and pg.get_by_text("se mandó otro correo").count() > 0)
    pg.goto("about:blank")
    pg.goto(URL + f"#access_token={FICHA}&expires_in=36000&refresh_token=r&token_type=bearer&type=signup"); pg.wait_for_timeout(3000)
    caso("al volver con el correo confirmado, la app lo dice y pide entrar", pg.get_by_text("Correo confirmado. Ahora entra").count() > 0 and pg.locator(".login-bg").count() == 1)
    pg.evaluate("() => localStorage.clear()"); pg.goto(URL); pg.wait_for_timeout(1200)

    # ── 1 · crear la cuenta ──
    pg.get_by_text("Es mi primera vez: crear mi cuenta").click()
    pg.get_by_placeholder("Tu nombre completo").fill("Persona Uno")
    pg.get_by_placeholder("Tu correo").fill("Uno@Prueba.invalid")
    pg.get_by_placeholder("Contraseña (10 caracteres o más)").fill("corta")
    pg.get_by_placeholder("Repite la contraseña").fill("corta")
    pg.get_by_role("button", name="Crear mi cuenta").click(); pg.wait_for_timeout(400)
    caso("una contraseña corta no se acepta", pg.get_by_text("al menos 10 caracteres").count() > 0 and not estado["altas"])
    pg.get_by_placeholder("Contraseña (10 caracteres o más)").fill("contrasena-larga-1")
    pg.get_by_placeholder("Repite la contraseña").fill("contrasena-larga-1")
    pg.get_by_role("button", name="Crear mi cuenta").click(); pg.wait_for_timeout(1200)
    a = estado["altas"][0] if estado["altas"] else {}
    caso("la cuenta se crea con el correo en minúsculas y el nombre", a.get("email") == "uno@prueba.invalid" and (a.get("data") or {}).get("nombre") == "Persona Uno")
    caso("la app avisa que hay que confirmar el correo", pg.get_by_text("toca el enlace para confirmarlo").count() > 0)

    # ── 2 · entrar: sin invitación no; con código sí ──
    pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)
    caso("sin invitación ni código, la cuenta NO entra y se le dice por qué", pg.locator(".login-bg").count() == 1 and pg.get_by_text("todavía no está invitada").count() > 0)
    pg.get_by_placeholder("XXXXX-XXXXX-XXXXX-XXXXX").fill("mal-codigo")
    pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg.get_by_role("button", name="Entrar").click(); pg.wait_for_timeout(1500)
    caso("con un código equivocado tampoco", pg.locator(".login-bg").count() == 1)
    pg.get_by_placeholder("XXXXX-XXXXX-XXXXX-XXXXX").fill(CODIGO.lower())
    pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg.get_by_role("button", name="Entrar").click()
    for _ in range(20):
        pg.wait_for_timeout(300)
        if pg.locator(".login-bg").count() == 0: break
    if pg.locator(".login-bg").count(): print("   [detalle]", pg.locator(".alert").all_inner_texts(), errores)
    caso("con el código de arranque entra como superadministrador", pg.locator(".login-bg").count() == 0 and estado["reclamos"][-1] == CODIGO, str(estado["reclamos"]))

    # ── 3 · la pantalla de Arranque ──
    pg.evaluate("""() => { window.__agro.add('inventario', { id: 'i1', nombre: 'UREA', unidad: 'bulto', existencia: 0, costo_unit: 0, cat: 'insumo' });
        window.__agro.add('inventario', { id: 'i2', nombre: 'SULFATO', unidad: 'bulto', existencia: 0, costo_unit: 0, cat: 'insumo' });
        window.__agro.add('bolsas', { id: 'b1', nombre: 'CAJA DEL RANCHO', tipo: 'efectivo', titularId: 'x' }); }""")
    pg.wait_for_timeout(600); pg.evaluate("() => window.__agroIr('arranque')"); pg.wait_for_timeout(1200)
    caso("la pantalla dice que la base está sellada y que falta declarar el inicio", pg.get_by_text("Espacio localhost").count() > 0 and pg.get_by_text("Sin declarar").count() > 0)

    pg.get_by_role("button", name="Cuentas").click()
    pg.get_by_placeholder("Nombre completo").fill("Encargado Nuevo"); pg.get_by_placeholder("Correo").fill("Encargado@Prueba.invalid")
    pg.get_by_role("button", name="Invitar", exact=True).click(); pg.wait_for_timeout(900)
    i = estado["invitaciones"][0] if estado["invitaciones"] else {}
    caso("invitar a un encargado manda su correo, nombre y rol", i.get("correo") == "encargado@prueba.invalid" and i.get("rol") == "encargado" and i.get("invitado_por") == CUENTA, json.dumps(i)[:120])

    pg.get_by_role("button", name="Conteo").click()
    pg.get_by_label("Contado de UREA").fill("40"); pg.get_by_label("Contado de SULFATO").fill("0")
    pg.get_by_role("button", name="Registrar conteo").click(); pg.wait_for_timeout(500)
    caso("un conteo sin lugar no se registra", pg.get_by_text("dónde se contó").count() > 0)
    pg.get_by_placeholder("Ej: Bodega del rancho").fill("Bodega del rancho")
    pg.get_by_role("button", name="Registrar conteo").click(); pg.wait_for_timeout(1200)
    d = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:localhost'))")
    urea = next(x for x in d["inventario"] if x["id"] == "i1")
    cont = [m for m in d["entradas_inv"] if m.get("conteoInicial")]
    caso("la existencia queda en lo contado", urea["existencia"] == 40)
    caso("cada conteo guarda fecha, lugar y quién contó (el cero también cuenta)", len(cont) == 2 and all(m.get("ubicacion") == "Bodega del rancho" and m.get("contadoPor") and m.get("fecha") for m in cont), f"{len(cont)} conteos")

    pg.get_by_role("button", name="Saldos").click()
    pg.get_by_label("Cuenta o caja").select_option("b1")
    pg.get_by_label("Saldo a la fecha de corte").fill("15230.55")
    pg.get_by_label("Evidencia del saldo").set_input_files({"name": "arqueo.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 " + b"arqueo de prueba " * 400})
    pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Guardar saldo inicial").click(); pg.wait_for_timeout(1200)
    d = pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:localhost'))")
    si = (d["bolsas"][0].get("saldoInicial") or {})
    caso("el saldo inicial queda con su corte, responsable y evidencia", si.get("monto") == 15230.55 and si.get("fechaCorte") and si.get("responsable") and si.get("sinEvidencia") is False, json.dumps({k: si.get(k) for k in ["monto", "fechaCorte", "sinEvidencia"]}))
    caso("la evidencia se guardó como archivo aparte, no dentro del registro", str(si.get("evidencia", "")).startswith("archivo:") and len(d.get("archivos", [])) == 1)
    caso("y quedó anotado en la bitácora", any(x.get("accion") == "saldo inicial" for x in d.get("auditoria", [])))

    pg.get_by_role("button", name="Inicio", exact=True).click()
    pg.locator('input[type="date"]').first.fill("2026-12-01")
    pg.get_by_role("button", name="Declarar inicio de operaciones").click(); pg.wait_for_timeout(1500)
    caso("declarar el inicio pide confirmación dos veces y manda la fecha", (estado["inicio"] or {}).get("p_fecha") == "2026-12-01" and any("UNA sola vez" in m for m in dialogos) and any("INICIO" in m for m in dialogos))
    caso("y la pantalla lo muestra como ya declarado", pg.get_by_text("Ya no se cambia").count() > 0)
    marcados = [t for t, c in estado["escrituras"] if (c.get("datos") or {}).get("_espacio") != "localhost"]
    caso("todo lo que subió lleva la marca de este espacio", len(estado["escrituras"]) > 0 and not marcados, f"{len(estado['escrituras'])} escrituras")
    pg.wait_for_timeout(4000)
    caso("la evidencia subió al almacén privado con la sesión de la cuenta", estado.get("subidos", 0) == 1, f"{estado.get('subidos', 0)} archivo(s)")
    # ── El acomodo del menú sigue a la persona a otro aparato ──
    pg.locator(".bn-item").first.click(); pg.wait_for_timeout(400)
    pg.locator(".enf", has_text="El rancho").click(); pg.wait_for_timeout(2600)
    caso("el acomodo sube a la nube en el renglón de esa cuenta", (estado.get("prefs") or {}).get("enfoque") == "campo" and estado.get("prefs_de") == CUENTA, str(estado.get("prefs_de")))
    ctx2 = b.new_context(viewport={"width": 390, "height": 800})
    ctx2.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    ctx2.route(NUBE + "/**", nube)
    pg2 = ctx2.new_page(); pg2.on("pageerror", lambda e: errores.append(str(e))); pg2.on("dialog", lambda d: d.accept())
    pg2.goto(URL); pg2.wait_for_timeout(1200)
    pg2.locator(".role-card", has_text="Admin").first.click()
    pg2.get_by_placeholder("Tu correo o tu PIN").fill("uno@prueba.invalid")
    pg2.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg2.get_by_role("button", name="Entrar").click()
    for _ in range(20):
        pg2.wait_for_timeout(300)
        if pg2.locator(".login-bg").count() == 0: break
    pg2.wait_for_timeout(1500)
    caso("en otro aparato, la misma cuenta abre con su acomodo sin volver a preguntar", pg2.locator(".bn-label").all_inner_texts() == ["Inicio", "Registrar", "Lista", "Papeles", "Menú"] and pg2.get_by_text("¿A qué te dedicas más aquí?").count() == 0, str(pg2.locator(".bn-label").all_inner_texts()))
    caso("ninguna pantalla tronó", not errores, "; ".join(errores)[:200])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
