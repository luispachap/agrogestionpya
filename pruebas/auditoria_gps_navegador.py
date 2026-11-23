"""AUDITORÍA FUNCIONAL · CHECAR DESDE EL TELÉFONO PROPIO, CON SU UBICACIÓN: el administrador activa a la persona en su
ficha; el encargado liga el teléfono de ella como SUYO; ahí sólo ella checa, y la ubicación del teléfono dice en qué
rancho está (en el suyo, en otro con su porqué, lejos de todo: no se registra; poca precisión: por revisar). Sin señal
también. El administrador lo ve distinguido en Jornadas. La ubicación es de IMITACIÓN (Playwright): el GPS de un
teléfono de verdad es la prueba de campo. Cuentas, 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_gps_navegador.py"""
import datetime, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
R1 = (22.7700, -102.5800); R2 = (22.8150, -102.5800)
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO UNO", "datos": {"lat": R1[0], "lng": R1[1], **E}, "actualizado": V},
                     "r2": {"id": "r2", "nombre": "RANCHO DOS", "datos": {"lat": R2[0], "lng": R2[1], **E}, "actualizado": V}}
H = [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}]
nube.t["trabajadores"] = {i: {"id": i, "nombre": n, "pin": pin, "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": H, **E}, "actualizado": V} for i, n, pin in (("t-ana", "ANA INVENTADA", "4101"), ("t-beto", "BETO INVENTADO", "4102"))}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
marcas = lambda pg: [e for e in datos(pg)["eventos"] if e["tipo"] == "marca"]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="07:00", donde=None):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", permissions=["geolocation"] if donde else [], geolocation=donde)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuestas = []; pg.confirmar = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        def dialogo(d):
            pg.dialogos.append(d.message)
            if d.type == "prompt": d.accept(pg.respuestas.pop(0) if pg.respuestas else "")
            elif d.type == "confirm": (d.accept() if (pg.confirmar.pop(0) if pg.confirmar else True) else d.dismiss())
            else: d.accept()
        pg.on("dialog", dialogo)
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); hora(pg); return pg
    def salir(pg):
        ir(pg, "home"); pg.get_by_role("button", name="Salir").first.click()
        for _ in range(20):
            pg.wait_for_timeout(400)
            if pg.locator(".login-bg").count(): break
    teclea = lambda pg, pin: ([pg.locator(".chk-teclas button", has_text=d).first.click() for d in pin], pg.locator(".chk-teclas button.ok").click(), pg.wait_for_timeout(2500))
    en = lambda lat_lng, dlat=0.0009, precision=15: {"latitude": lat_lng[0] + dlat, "longitude": lat_lng[1], "accuracy": precision}

    # ══ 1. El administrador activa a Ana en su ficha: rancho de siempre y que puede checar desde su teléfono ══
    A = aparato(ADM, "06:00")
    ir(A, "equipo"); A.get_by_label("Editar la ficha de ANA INVENTADA").click(); A.wait_for_timeout(400)
    abierto = A.get_by_role("button", name="Guardar cambios").count() == 1
    caso("la ficha de Ana se abre para editar", abierto, cuerpo(A)[:300])
    campo(A, "Rancho de siempre").select_option("r1"); campo(A, "¿Checa desde su teléfono").select_option("si")
    A.get_by_role("button", name="Guardar cambios").click(); A.wait_for_timeout(600)
    ana = next(t for t in datos(A)["trabajadores"] if t["id"] == "t-ana")
    caso("Ana queda con su rancho de siempre (RANCHO UNO) y activada para checar desde su teléfono", ana.get("ranchoId") == "r1" and ana.get("checaConGps") == "si", {k: ana.get(k) for k in ("ranchoId", "checaConGps")})
    subio(A)

    # ══ 2. El encargado liga el teléfono de Ana como SUYO ══
    T = aparato(ENC, "06:30", donde=en(R1)); subio(T)
    T.confirmar = [True, True]; T.respuestas = ["4101"]; salir(T)
    v = T.evaluate("() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('agro_campo')) || 'null'))")
    caso("al salir, el encargado lo deja como el teléfono de Ana (la que escribió su PIN)", v and (v.get("soloDe") or {}).get("id") == "t-ana", v)
    T.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").click(); T.wait_for_timeout(500); t = cuerpo(T)
    caso("la puerta dice que es el teléfono de Ana, que se anota dónde está, y no trae cámara", "Este es el teléfono de ANA INVENTADA" in t and T.locator("video").count() == 0, t[:500])
    teclea(T, "4102")
    caso("BETO no puede checar en el teléfono de Ana", "Este teléfono es de ANA INVENTADA" in cuerpo(T) and not marcas(T), cuerpo(T)[:400])
    # ══ 3. Ana checa en su rancho ══
    T.clock.run_for(13000); teclea(T, "4101"); t = cuerpo(T)
    m = marcas(T)
    caso("ANA checa ENTRADA en su rancho: la marca lleva su posición, la precisión y la distancia (≈100 m de RANCHO UNO)", len(m) == 1 and m[0]["datos"]["desdeSuTelefono"] and m[0]["datos"]["gps"]["ranchoId"] == "r1" and 80 < m[0]["datos"]["gps"]["distanciaM"] < 120 and "ENTRADA" in t and "RANCHO UNO" in t, [t[:300], m[0]["datos"] if m else None])
    caso("y no se abrió la app", T.locator(".login-bg").count() >= 1 and "Finanzas" not in t)
    # ══ 4. Lejos de todo rancho: no se registra ══
    T.context.set_geolocation({"latitude": 23.2, "longitude": -102.58, "accuracy": 10}); T.clock.fast_forward(20 * 60 * 1000); hora(T)
    teclea(T, "4101"); t = cuerpo(T)
    caso("LEJOS de todo rancho: no se registra, dice a cuánto está el más cercano y que avise a su encargado", "No estás en ningún rancho" in t and "Avisa a tu encargado" in t and len(marcas(T)) == 1, t[:400])
    # ══ 5. En otro rancho, sin señal: dice a qué fue ══
    T.context.set_geolocation(en(R2)); T.context.set_offline(True)
    T.respuestas = [""]; teclea(T, "4101")
    caso("en OTRO rancho, sin decir a qué fue, no se registra", "a qué viniste" in cuerpo(T) and len(marcas(T)) == 1, cuerpo(T)[:400])
    T.clock.run_for(13000); T.respuestas = ["A AYUDAR CON EL RIEGO"]; teclea(T, "4101"); t = cuerpo(T)
    m = marcas(T)
    caso("con su porqué sí (y SIN SEÑAL): SALIDA en RANCHO DOS, con su motivo", len(m) == 2 and m[1]["datos"]["gps"]["estado"] == "en_otro_rancho" and m[1]["datos"]["motivo"] == "A AYUDAR CON EL RIEGO" and "SALIDA" in t, [t[:300], m[-1]["datos"] if m else None])
    # ══ 6. Poca precisión: por revisar ══
    T.context.set_geolocation(en(R1, precision=400)); T.clock.fast_forward(20 * 60 * 1000); hora(T); teclea(T, "4101"); t = cuerpo(T)
    m = marcas(T)
    caso("con POCA PRECISIÓN del GPS la marca se guarda pero queda por revisar", len(m) == 3 and m[2]["datos"].get("porRevisar") and "por revisar" in t, [t[:300], m[-1]["datos"] if m else None])
    T.context.set_offline(False)
    caso("vuelve la señal y suben las tres marcas", subio(T) and len([v for v in nube.t.get("eventos", {}).values() if v.get("tipo") == "marca"]) == 3, [T.evaluate(COLA), len(nube.t.get("eventos", {}))])
    # ══ 7. El administrador lo ve en Jornadas, distinguido ══
    A.reload(); A.wait_for_timeout(3500); ir(A, "jornadas"); A.get_by_text("ANA INVENTADA").first.click(); A.wait_for_timeout(500); t = cuerpo(A)
    caso("JORNADAS distingue lo checado desde su teléfono: a cuánto del rancho, en otro rancho con su porqué, y lo por revisar", "Desde su teléfono · a" in t and "RANCHO UNO" in t and "en RANCHO DOS (no es el suyo) · A AYUDAR CON EL RIEGO" in t and "por revisar" in t and "su teléfono" in t, t[:1200])
    # ══ 8. El teléfono del encargado, compartido, sigue como siempre ══
    S = aparato(ENC, "08:00"); S.confirmar = [True, False]; salir(S)
    S.get_by_role("button", name="Sólo vengo a registrar mi entrada o salida").click(); S.wait_for_timeout(500); t = cuerpo(S)
    caso("si el encargado dice que NO es de una persona, el aparato queda para su gente, como siempre", "Este aparato lo dejó ENCARGADO DE PRUEBA" in t and "Este es el teléfono de" not in t, t[:400])
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
