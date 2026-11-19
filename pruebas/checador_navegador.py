"""El checador en navegador real, con una cámara de mentira que enseña la
credencial de un trabajador de prueba:
  1. La cámara lee el QR y registra la ENTRADA; la credencial quieta no la repite.
  2. El PIN sirve de respaldo; un PIN que no es de nadie no registra.
  3. Sin internet se sigue checando.
  4. En Jornadas se corrige con motivo y nada se borra.
  5. Las credenciales se emiten y se dibujan; finanzas ve las jornadas pero no corrige.
Uso:  npx vite --port 5173 &   →   python3 pruebas/checador_navegador.py"""
import json, pathlib, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
CODIGO = "ABCDEFGHJK"
g["SEMILLA"]["trabajadores"] = [
    {"id": "t-qr", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4821", "credencial": {"codigo": CODIGO, "emitida": "2026-11-01T00:00:00.000Z"}},
    {"id": "t-pin", "nombre": "BETO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "9033"},
    {"id": "t-off", "nombre": "CARO DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "7711"},
]
video = pathlib.Path(tempfile.mkdtemp()) / "credencial.y4m"
subprocess.run(["node", str(aqui / "apoyo" / "qr_video.mjs"), f"AGRO1:T:t-qr:{CODIGO}", str(video)], check=True, cwd=str(aqui.parent))
datos = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:local'))")
marcas = lambda pg: [e for e in datos(pg).get("eventos", []) if e["tipo"] == "marca"]
def teclea(pg, pin):
    for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
    pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-video-capture={video}"])
    ctx = b.new_context(viewport={"width": 390, "height": 800}, permissions=["camera"])
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    caso("el checador es el primer botón de la barra del encargado", pg.locator(".bn-label").all_inner_texts()[1] == "Checador", pg.locator(".bn-label").all_inner_texts())
    pg.locator(".bn-item", has_text="Checador").click()
    for _ in range(40):
        pg.wait_for_timeout(300)
        if marcas(pg): break
    m = marcas(pg)
    caso("la cámara lee la credencial y registra la entrada sola", len(m) == 1 and m[0]["datos"]["trabajadorId"] == "t-qr" and m[0]["datos"]["sentido"] == "entrada" and m[0]["datos"]["via"] == "qr", json.dumps(m[0]["datos"] if m else {}))
    caso("y lo dice en grande con el nombre y la hora", pg.locator(".chk-aviso.entrada .chk-aviso-t").inner_text() == "ANA DE PRUEBA" and "ENTRADA" in pg.locator(".chk-aviso-l").inner_text())
    caso("el evento dice quién lo registró, cuándo y de qué operación es", m[0]["quien"]["nombre"] == "ENCARGADO DE PRUEBA" and m[0]["estado"] == "vigente" and m[0]["id"].startswith("ev-marca-") and m[0].get("_espacio") == "local")
    pg.wait_for_timeout(6000)
    caso("la credencial quieta frente a la cámara no se registra diez veces", len(marcas(pg)) == 1 and pg.locator(".chk-aviso.aviso").count() == 1, len(marcas(pg)))

    teclea(pg, "9033")
    caso("con PIN también se checa", len(marcas(pg)) == 2 and marcas(pg)[1]["datos"]["via"] == "pin" and "BETO" in pg.locator(".chk-aviso-t").inner_text())
    teclea(pg, "1234")
    caso("un PIN que no es de nadie no registra y lo dice", len(marcas(pg)) == 2 and pg.locator(".chk-aviso.mal").count() == 1)
    ctx.set_offline(True)
    teclea(pg, "7711")
    caso("sin internet se sigue checando", len(marcas(pg)) == 3 and "CARO" in pg.locator(".chk-aviso-t").inner_text())
    ctx.set_offline(False)
    caso("los contadores del día cuadran", pg.locator(".stat-val").all_inner_texts()[:3] == ["3", "0", "0"], pg.locator(".stat-val").all_inner_texts())

    # ── Jornadas: corregir con motivo ──
    pg.get_by_role("button", name="Ver el día").click(); pg.wait_for_timeout(400)
    caso("Jornadas enseña a los tres adentro", pg.get_by_text("Adentro (3)").count() == 1)
    pg.locator(".jor-fila", has_text="BETO").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Cancelar", exact=True).click()
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(300)
    caso("cancelar sin decir por qué no se puede", pg.get_by_text("hay que decir por qué").count() == 1 and all(e["estado"] == "vigente" for e in marcas(pg)))
    pg.get_by_label("Por qué (queda escrito)").fill("checó con el PIN de otro")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    beto = [e for e in marcas(pg) if e["datos"]["trabajadorId"] == "t-pin"]
    caso("con motivo se cancela, y la marca sigue ahí con quién y por qué", len(beto) == 1 and beto[0]["estado"] == "cancelado" and beto[0]["cancelado"]["motivo"] == "checó con el PIN de otro" and pg.get_by_text("CANCELADA por").count() == 1)
    pg.get_by_role("button", name="Poner una marca que faltó").click()
    pg.get_by_label("Hora que vale").fill("00:01")   # una hora que ya pasó a cualquier hora que corra la prueba
    pg.get_by_label("Por qué (queda escrito)").fill("llegó antes de que prendieran la tableta")
    pg.get_by_role("button", name="Guardar").click(); pg.wait_for_timeout(400)
    beto = [e for e in marcas(pg) if e["datos"]["trabajadorId"] == "t-pin"]
    caso("una marca puesta a mano queda marcada como tal", len(beto) == 2 and beto[1]["datos"]["via"] == "correccion" and beto[1]["datos"]["motivo"].startswith("llegó antes"), json.dumps([x["datos"] for x in beto], ensure_ascii=False)[:300] + " | " + " / ".join(pg.locator(".card .text-sm").all_inner_texts())[:200])
    pg.locator(".btn-ghost").first.click(); pg.wait_for_timeout(300)
    caso("y en la lista se ve cuál jornada trae algo a mano", pg.locator(".jor-fila", has_text="BETO").locator(".jor-etq").count() == 1)

    # ── El pase de lista ya lo sabe, sin capturarlo otra vez ──
    pg.evaluate("() => window.__agroIr('pase-lista')"); pg.wait_for_timeout(500)
    caso("el pase de lista no guardó una asistencia paralela", len(datos(pg).get("asistencia", [])) == 0)

    # ── Credenciales ──
    pg.evaluate("() => window.__agroIr('credenciales')"); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Emitir credencial a los 2 que no tienen").click(); pg.wait_for_timeout(1200)
    tr = {t["id"]: t for t in datos(pg)["trabajadores"]}
    caso("se emite credencial a quien no tenía, sin tocar la que ya existía", len(tr["t-pin"]["credencial"]["codigo"]) == 10 and tr["t-qr"]["credencial"]["codigo"] == CODIGO)
    caso("cada credencial se dibuja con su QR", pg.locator(".cred .qr svg").count() == 3, pg.locator(".cred .qr svg").count())
    caso("y el QR no trae el PIN ni el nombre", "4821" not in pg.locator(".cred-hoja").inner_html() )

    # ── Finanzas ve, no corrige ──
    pg.locator(".btn-ghost").first.click(); pg.get_by_role("button", name="Salir").click(); pg.wait_for_timeout(500)
    g["entrar"](pg, "Finanzas", "7393"); pg.wait_for_timeout(400)
    pg.evaluate("() => window.__agroIr('jornadas')"); pg.wait_for_timeout(400)
    pg.locator(".jor-fila", has_text="ANA").click(); pg.wait_for_timeout(300)
    caso("finanzas ve las jornadas pero no tiene botones para corregir", pg.get_by_text("Sus marcas").count() == 1 and pg.locator(".jor-acc").count() == 0 and pg.get_by_role("button", name="Poner una marca que faltó").count() == 0)
    caso("ninguna pantalla tronó", not errs, errs)
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
