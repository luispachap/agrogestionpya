"""AUDITORÍA FUNCIONAL · LA TABLA POR CORTES (El día → Por cortes): el encargado pinta, con pinceles, qué hizo cada quien
en cada corte del día; el costo sale del motor de mano de obra de siempre (pintar no es pagar), repintar deja historial,
borrar no borra, lo no pintado queda por aclarar, y el otro teléfono ve lo mismo. Cortes provisionales (7–10, 10–13,
14–17). Cuentas, 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_cortes_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import datetime, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = os.environ.get("URL", "http://localhost:5174/"); HOY = "2026-11-19"; FOTOS = os.environ.get("FOTOS")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
nube.t["parcelas"] = {p: {"id": p, "nombre": n, "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V} for p, n in (("p1", "PARCELA UNO"), ("p2", "PARCELA DOS"))}
H = [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}]
nube.t["trabajadores"] = {i: {"id": i, "nombre": n, "pin": pin, "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": H, **E}, "actualizado": V} for i, n, pin in (("t-ana", "ANA INVENTADA", "4101"), ("t-beto", "BETO INVENTADO", "4102"))}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
costo_de = lambda pg, pid: round(sum(a.get("costoTotal") or 0 for a in datos(pg).get("actividadesContables", []) if a.get("parcelaId") == pid), 2)
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="07:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: d.accept())
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); hora(pg); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    teclea = lambda pg, pin: ([pg.locator(".chk-teclas button", has_text=d).first.click() for d in pin], pg.locator(".chk-teclas button.ok").click(), pg.wait_for_timeout(400), pg.clock.run_for(13000), hora(pg))
    B = aparato(ENC)
    ir(B, "checador"); teclea(B, "4101"); teclea(B, "4102")
    ir(B, "eldia"); B.get_by_role("button", name="Por cortes").click(); B.wait_for_timeout(500); t = cuerpo(B)
    caso("la tabla enseña a los que vinieron (Ana y Beto) con los tres cortes provisionales, y dice que faltan validar con Miguel", "ANA INVENTADA" in t and "BETO INVENTADO" in t and all(c in t for c in ("7–10", "10–13", "14–17")) and "falta validarlos con Miguel" in t, t[:900])
    B.get_by_label("Pintar a todos en 7–10").click(); B.wait_for_timeout(300)
    caso("sin pincel no se pinta nada y lo dice", "Primero escoge un pincel" in cuerpo(B) and not [e for e in datos(B)["eventos"] if e["tipo"] == "asignacion"])
    def pincel(parcela, actividad):
        B.get_by_label("Parcela del pincel nuevo").select_option(label=parcela); B.get_by_label("Actividad del pincel nuevo").select_option(actividad)
        B.get_by_role("button", name="+ Pincel nuevo").click(); B.wait_for_timeout(300)
    pincel("PARCELA UNO", "Riego")
    B.get_by_label("Pintar a todos en 7–10").click(); B.wait_for_timeout(500)
    caso("tocar el corte pinta a los dos con el pincel (Riego en la uno), en UNA asignación", len([e for e in datos(B)["eventos"] if e["tipo"] == "asignacion"]) == 1 and sorted([e for e in datos(B)["eventos"] if e["tipo"] == "asignacion"][0]["datos"]["trabajadorIds"]) == ["t-ana", "t-beto"], [e["datos"] for e in datos(B)["eventos"] if e["tipo"] == "asignacion"])
    pincel("PARCELA DOS", "Deshierbe")
    B.get_by_label(re.compile("BETO INVENTADO, 10–13")).click(); B.wait_for_timeout(400)
    caso("lo que todavía no pasa no se pinta como hecho: a las 7 no se puede pintar el corte de las 10", "todavía no llega" in cuerpo(B) and "sin pintar" in B.get_by_label(re.compile("BETO INVENTADO, 10–13")).first.get_attribute("aria-label"), cuerpo(B)[-400:])
    # salen a las 17:00 y el encargado termina de pintar el día
    avanza(B, 10); ir(B, "checador"); teclea(B, "4101"); teclea(B, "4102"); B.wait_for_timeout(500)
    ir(B, "eldia"); B.get_by_role("button", name="Por cortes").click(); B.wait_for_timeout(500)
    caso("al volver a la tabla siguen los pinceles que ya se usaron", B.locator("button[aria-label^='Pincel Riego en PARCELA UNO']").count() == 1)
    pincel("PARCELA DOS", "Deshierbe")
    B.get_by_label(re.compile("BETO INVENTADO, 10–13")).click(); B.wait_for_timeout(400)
    B.get_by_role("button", name="Repetir en 10–13 lo de 7–10").click(); B.wait_for_timeout(500); foto(B, "01-tabla")
    celda = lambda nom, corte: B.get_by_label(re.compile(f"{nom}, {corte}:")).first.get_attribute("aria-label")
    caso("REPETIR el corte anterior le pone a Ana Riego en 10–13 y respeta lo de Beto (Deshierbe en la dos)", "Riego en PARCELA UNO" in celda("ANA INVENTADA", "10–13") and "Deshierbe en PARCELA DOS" in celda("BETO INVENTADO", "10–13"), [celda("ANA INVENTADA", "10–13"), celda("BETO INVENTADO", "10–13")])
    caso("cada celda lleva la inicial de la actividad (el color nunca va solo)", B.get_by_label(re.compile("ANA INVENTADA, 7–10:")).inner_text().startswith("R"), B.get_by_label(re.compile("ANA INVENTADA, 7–10:")).inner_text())
    cerca = lambda x, y: abs(x - y) < 1.5   # las marcas llevan los segundos de quien checa primero y quien después
    caso("PINTAR NO ES PAGAR, el costo sale del motor de siempre: la uno $360 (Ana 6 h y Beto 3 h de 10 h) y la dos $120 (Beto 3 h)", cerca(costo_de(B, "p1"), 360) and cerca(costo_de(B, "p2"), 120), [costo_de(B, "p1"), costo_de(B, "p2")])
    ir(B, "eldia"); B.get_by_role("button", name="Por cortes").click(); B.wait_for_timeout(500); t = cuerpo(B)
    caso("el corte de la tarde sin pintar no se le carga a nadie: queda por aclarar (lo dice Mano de obra)", "Para revisar" not in t or "checó y no está pintado" not in t, t[-500:])
    # repintar y borrar
    B.locator("button[aria-label^='Pincel Riego en PARCELA UNO']").click(); B.wait_for_timeout(200)
    B.get_by_label(re.compile("BETO INVENTADO, 10–13")).click(); B.wait_for_timeout(500)
    titulo = B.get_by_label(re.compile("BETO INVENTADO, 10–13")).get_attribute("title") or ""
    caso("REPINTAR: Beto pasa a Riego en la uno y su celda guarda lo de antes (Deshierbe en la dos) y quién pintó", "Riego en PARCELA UNO" in celda("BETO INVENTADO", "10–13") and "Antes: Deshierbe · PARCELA DOS" in titulo and "ENCARGADO DE PRUEBA" in titulo, titulo)
    caso("y el costo se mueve solo: la uno $480 y la dos $0", cerca(costo_de(B, "p1"), 480) and costo_de(B, "p2") == 0, [costo_de(B, "p1"), costo_de(B, "p2")])
    B.get_by_role("button", name="Borrar", exact=True).click(); B.wait_for_timeout(200)
    B.get_by_label(re.compile("ANA INVENTADA, 10–13")).click(); B.wait_for_timeout(500)
    caso("BORRAR la celda de Ana: ese rato ya no es de la uno ($360), queda por aclarar, y lo pintado sigue en el historial", cerca(costo_de(B, "p1"), 360) and "sin pintar" in celda("ANA INVENTADA", "10–13") and "Antes:" in (B.get_by_label(re.compile("ANA INVENTADA, 10–13")).get_attribute("title") or ""), [costo_de(B, "p1"), celda("ANA INVENTADA", "10–13")])
    caso("no se borró ningún evento: todo se fue agregando", all(not e.get("cancelado") for e in datos(B)["eventos"] if e["tipo"] in ("asignacion", "fin_asignacion")))
    subio(B)
    # ══ El otro teléfono ══
    A = aparato(ADM, "18:00")
    ir(A, "eldia"); A.get_by_role("button", name="Por cortes").click(); A.wait_for_timeout(500)
    cel = lambda pg, nom, corte: pg.get_by_label(re.compile(f"{nom}, {corte}:")).first.get_attribute("aria-label")
    caso("el administrador ve la misma tabla y los mismos costos", "Riego en PARCELA UNO" in cel(A, "BETO INVENTADO", "10–13") and "sin pintar" in cel(A, "ANA INVENTADA", "10–13") and cerca(costo_de(A, "p1"), 360), [cel(A, "BETO INVENTADO", "10–13"), costo_de(A, "p1")])
    ir(A, "nomina"); A.wait_for_timeout(500); t = cuerpo(A)
    caso("y en Pagos a cada quien le corresponde su día ($400), pintado o no", re.search(r"ANA INVENTADA \| [^|]+ \| \$400 \|", t) and re.search(r"BETO INVENTADO \| [^|]+ \| \$400 \|", t), t[300:1200])
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
