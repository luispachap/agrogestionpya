"""La mensajería institucional en navegador real, con gente y parcelas INVENTADAS. Tres personas en el mismo aparato
de prueba (encargado, administrador y agrónomo), cada una con su sesión. Lo que se comprueba:
  1. Hay conversaciones (la general, directas y grupos) y las reglas se pueden leer.
  2. El encargado reporta una compra sin precio; AgroGestión pregunta; el ADMINISTRADOR contesta «20 pesos el kilo»
     y aclara que fue de caja chica: es UNA sola propuesta, y al confirmarla nace UN gasto con toda la conversación.
  3. La plática («ok, gracias», una pregunta) no genera propuestas ni pendientes.
  4. Una plaga reportada y «la voy a inspeccionar» del agrónomo quedan como observación y pendiente ligados.
  5. Al asistente se le habla con «Agro,» y sólo entonces contesta.
  6. Quien no participa en un grupo no lo ve; la administración sí, y se le dice.
Uso:  npx vite --port 5173 &   →   python3 pruebas/mensajes_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:600] if det else ""))
plano = lambda t: t.replace("\n", " | ")
g["SEMILLA"].update({"ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}], "parcelas": [{"id": "sf4", "nombre": "San Felipe 4", "ranchoId": "r1", "hectareas": 3, "emoji": "🌾"}]})
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { chat: d.chat, egr: d.egresos, bit: d.bitacora || [], conv: (d.eventos || []).filter(e => e.tipo === 'conversacion').map(e => e.datos) }; }")
def entrar_como(pg, pin):
    pg.evaluate("() => { for (const k of Object.keys(localStorage)) if (/sesion/i.test(k)) localStorage.removeItem(k); }")
    pg.reload(); pg.wait_for_timeout(1200); g["entrar"](pg, "", pin); pg.wait_for_timeout(500)
    pg.evaluate("p => window.__agroIr(p)", "chat"); pg.wait_for_timeout(500)
def manda(pg, texto):
    pg.locator("textarea").first.fill(texto); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(600)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda x: x.accept("no aplica"))
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    pg.evaluate("p => window.__agroIr(p)", "chat"); pg.wait_for_timeout(500)

    # ── 1. Conversaciones y reglas ──
    t = plano(pg.locator(".msj-lista").inner_text())
    pg.get_by_role("button", name="Nueva conversación").click(); pg.wait_for_timeout(200); t2 = pg.locator(".msj-menu").inner_text(); pg.keyboard.press("Escape"); pg.mouse.click(10, 10); pg.wait_for_timeout(200)
    caso("la mensajería abre en la lista de conversaciones, con la general, y el botón de nueva conversación ofrece persona o grupo", "General del rancho" in t and "Hablar con alguien" in t2 and "Nuevo grupo" in t2, t + t2)
    pg.get_by_role("button", name="Opciones").click(); pg.wait_for_timeout(200); pg.get_by_role("button", name="Reglas de los mensajes").click(); pg.wait_for_timeout(200)
    r = pg.locator(".msj-reglas").inner_text()
    caso("las reglas dicen que son institucionales, que no son para vigilar, quién las lee, que se conservan y que nada se registra solo", "institucionales" in r and "No son para vigilar" in r and "tampoco la administración" in r and "Nada se registra solo" in r and "se conservan" in r and "las hace cumplir la base de datos" in r, r[:200])
    pg.get_by_role("button", name="Entendido").click()
    pg.get_by_role("button", name="Nueva conversación").click(); pg.wait_for_timeout(200); pg.get_by_role("button", name="Nuevo grupo").click(); pg.wait_for_timeout(200)
    pg.get_by_label("Nombre del grupo").fill("Compras"); pg.get_by_text("Todos los de Administración").click(); pg.get_by_role("button", name="Abrir").click(); pg.wait_for_timeout(500)
    d = datos(pg)
    caso("se abre un grupo de trabajo por puesto y queda como evento", len(d["conv"]) == 1 and d["conv"][0]["nombre"] == "Compras" and d["conv"][0]["institucional"] is True and "Compras" in pg.locator(".msj-cabeza h2").inner_text(), d["conv"])

    # ── 2. Una compra entre dos personas ──
    manda(pg, "Compramos tres kilos de clavos.")
    t = plano(pg.locator("body").inner_text())
    caso("AgroGestión propone el gasto y pregunta lo que falta, sin que nadie le hable", "AgroGestión pregunta: ¿Cuánto costó?" in t and "gasto" in t, t[-500:])
    manda(pg, "Ok, gracias")
    manda(pg, "¿A qué hora llega el camión?")
    d = datos(pg); platica = [m for m in d["chat"] if m.get("platica")]
    caso("la plática no genera propuestas ni cosas por confirmar", len(platica) == 2 and all(len(m["propuestas"]) == 0 for m in platica) and "no se entendió" not in pg.locator("body").inner_text().lower(), [m["texto"] for m in platica])
    entrar_como(pg, "7391")
    t = plano(pg.locator(".msj-lista").inner_text())
    caso("el administrador ve el grupo porque es de su puesto, con lo que espera confirmación y lo que no ha leído", "Compras" in t and "1 por confirmar" in t and pg.locator(".msj-conv", has_text="Compras").locator(".msj-nuevos").inner_text() == "3", t)
    pg.locator(".msj-conv", has_text="Compras").click(); pg.wait_for_timeout(400)
    manda(pg, "20 pesos el kilo")
    d = datos(pg); gastos = [p for m in d["chat"] for p in m["propuestas"] if p["tipo"] == "gasto"]
    caso("«20 pesos el kilo» dicho por OTRA persona completa la misma compra: 3 kilos × 20 = 60, y no nace otro gasto", len(gastos) == 1 and gastos[0]["monto"] == 60 and gastos[0]["aclaraciones"][0]["texto"] == "20 pesos el kilo" and gastos[0]["aclaraciones"][0]["de"]["nombre"] == "Administrador", gastos)
    manda(pg, "Se pagó de caja chica")
    d = datos(pg); gastos = [p for m in d["chat"] for p in m["propuestas"] if p["tipo"] == "gasto"]
    caso("y «se pagó de caja chica» también va a la misma propuesta", len(gastos) == 1 and gastos[0].get("pagadoCon") == "caja_chica" and len(gastos[0]["aclaraciones"]) == 2, gastos)
    bur = pg.locator(".msj-burbuja", has_text="Compramos tres kilos").first; bur.locator(".msj-prop-chip").click(); pg.wait_for_timeout(200)
    t = plano(bur.inner_text())
    caso("la conversación se ve completa junto a la propuesta", "20 pesos el kilo" in t and "caja chica" in t and "Administrador" in t, t)
    bur.get_by_role("button", name="Sí").click(); pg.wait_for_timeout(500)
    d = datos(pg); e = d["egr"]
    caso("al confirmar nace UN gasto con el mensaje original, las dos aclaraciones y quién confirmó", len(e) == 1 and e[0]["monto"] == 60 and e[0]["pagadoCon"] == "caja_chica" and e[0]["origen"]["dijo"] == "ENCARGADO DE PRUEBA" and [a["texto"] for a in e[0]["origen"]["aclaraciones"]] == ["20 pesos el kilo", "Se pagó de caja chica"] and e[0]["origen"]["confirmo"] == "Administrador", e)
    caso("los mensajes de aclaración se conservan como mensajes de la conversación", len([m for m in d["chat"] if m.get("aclaraA")]) == 2)
    ev = [m for m in d["chat"] if m.get("esEvidencia")]
    caso("lo confirmado marca como evidencia el mensaje original y sus dos aclaraciones, y como sensible por ser dinero", len(ev) == 3 and all(m.get("sensible") for m in ev), [(m["texto"], m.get("sensible")) for m in ev])
    pg.locator(".msj-atras").click(); pg.wait_for_timeout(300)
    caso("al salir, el grupo ya no marca mensajes sin leer", pg.locator(".msj-conv", has_text="Compras").locator(".msj-nuevos").count() == 0)
    pg.locator(".tab-pill", has_text="Memoria").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Buscar en la memoria").fill("clavos"); pg.wait_for_timeout(300)
    h = pg.locator(".msj-hallazgo")
    caso("en la memoria se encuentra la compra, ya registrada", h.count() == 1 and "compra" in h.first.inner_text() and "registrado" in h.first.inner_text(), plano(h.first.inner_text()) if h.count() else "")
    h.first.get_by_role("button", name="¿De dónde salió?").click(); pg.wait_for_timeout(300)
    t = plano(pg.locator(".msj-rastro").inner_text())
    caso("«¿de dónde salió?» separa lo dicho, lo interpretado, lo confirmado y lo registrado, con nombres y conversación", "1 · Lo que se dijo" in t and "ENCARGADO DE PRUEBA" in t and "en Compras" in t and "«Compramos tres kilos de clavos.»" in t and "Administrador" in t and "«20 pesos el kilo»" in t and "2 · Lo que AgroGestión interpretó" in t and "$20 por unidad × 3 kilos = $60" in t and "3 · Lo que una persona confirmó" in t and "Lo confirmó Administrador" in t and "4 · Lo que quedó registrado" in t and "Egresos" in t, t)
    pg.locator(".tab-pill", has_text="Consultas").click(); pg.wait_for_timeout(300)
    t = pg.locator(".msj-consulta").inner_text()
    caso("ser administrador no da la consulta excepcional de conversaciones: se le dice", "Tu cuenta no tiene ese permiso. Ser administrador no lo da" in t and "Nadie ha abierto una conversación ajena" in t, plano(t)[:300])
    pg.locator(".tab-pill", has_text="Conversaciones").click(); pg.wait_for_timeout(300)

    # ── 3. Plaga e inspección; el asistente ──
    pg.locator(".msj-conv", has_text="General del rancho").click(); pg.wait_for_timeout(400)
    manda(pg, "Vimos mucha plaga en San Felipe 4.")
    entrar_como(pg, "5502")
    pg.locator(".msj-conv", has_text="General del rancho").click(); pg.wait_for_timeout(400)
    manda(pg, "Mañana la voy a inspeccionar.")
    d = datos(pg); seg = [p for m in d["chat"] for p in m["propuestas"] if p.get("sobre")]
    caso("«la voy a inspeccionar» queda ligado a la plaga que reportó otra persona, con su parcela", len(seg) == 1 and seg[0]["sobre"]["clase"] == "seguimiento" and "plaga" in seg[0]["sobre"]["frase"] and seg[0].get("parcelaId") == "sf4" and seg[0]["heredado"] == ["parcela"], seg)
    t = pg.locator("body").inner_text().lower()
    caso("y no se inventa ningún diagnóstico", "no dice qué es ni qué lo causa" in t and not any(x in t for x in ["trips", "hongo", "se recomienda"]))
    bur = pg.locator(".msj-burbuja", has_text="Mañana la voy a inspeccionar").last; bur.locator(".msj-prop-chip").click(); pg.wait_for_timeout(200); bur.get_by_role("button", name="Sí").click(); pg.wait_for_timeout(400)
    b0 = datos(pg)["bit"]
    caso("el agrónomo lo confirma y queda como pendiente en la bitácora, apuntando a la observación", len(b0) == 1 and b0[0]["naturaleza"] == "plan" and b0[0]["sobre"]["frase"].startswith("Vimos mucha plaga") and b0[0]["parcelaId"] == "sf4", b0)
    antes = len(datos(pg)["chat"])
    manda(pg, "Agro, se descompuso la bomba del pozo")
    d = datos(pg); bot = [m for m in d["chat"] if m.get("delAsistente")]
    caso("al asistente se le habla con «Agro,» y sólo entonces contesta", len(d["chat"]) == antes + 2 and len(bot) == 1 and "lo dejé preparado" in bot[0]["texto"] and bot[0]["de"]["nombre"] == "AgroGestión", [m["texto"] for m in bot])
    pg.locator(".msj-atras").click(); pg.wait_for_timeout(300)
    t = plano(pg.locator(".msj-lista").inner_text())
    caso("el agrónomo no ve el grupo de Compras, porque no participa", "Compras" not in t and "General del rancho" in t, t)
    pg.locator(".tab-pill", has_text="Memoria").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Parcela").select_option("sf4"); pg.wait_for_timeout(300)
    t = plano(pg.locator(".msj-memoria").inner_text())
    caso("la memoria se consulta por parcela: lo que se vio y el pendiente, sin confundir lo interpretado con lo registrado", "observación de campo" in t and "interpretado" in t and "registrado" in t and "clavos" not in t, t[-500:])
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
