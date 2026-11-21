"""Las rayas con claves, en navegador real y SIN gastar (la IA es de mentira; las personas, inventadas).
Lo que se comprueba: que una libreta leída entra como relación de quién hizo qué y dónde, siempre al histórico; que una
clave sin registrar NO se inventa, se pregunta; que lo contestado queda guardado y sirve para el documento siguiente;
que una actividad no se puede guardar como ubicación; que corregir conserva lo anterior; y que no se crean pagos,
actividades ni gastos.
Uso:  npx vite --port 5173 &   →   python3 pruebas/rayas_navegador.py"""
import pathlib, sys, tempfile
from playwright.sync_api import sync_playwright
from PIL import Image
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
plano = lambda t: t.replace("\n", " | ")
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(500)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
SERVIDOR = """
window.__ia = { pedidos: [], gastado: 0, tope: 4000000, lecturas: 0 };
const R = (m) => Object.assign({ fecha: '', nombre: '', concepto: '', cantidad: '', unidad: '', importe: '', litros: '', vehiculo: '', parcela: '', dias: '', puesto: '', claves: '', observacion: '' }, m);
const RAYA = (fecha) => ({ clase: 'raya', confianza: 'media', emisor: '', fecha, folio: '', subtotal: '', total: '', moneda: '', no_se_leyo: [], avisos: ['La última columna no se distingue si es dinero: se dejó vacía.'],
  renglones: [R({ nombre: 'Chon Inventado', claves: 'A27 | Sf4' }), R({ nombre: 'Lupe Inventada', claves: 'Ao7 | Bod' }), R({ nombre: 'Beto Inventado', claves: 'A07 | Bod' }), R({ nombre: 'Rigo Inventado', claves: 'A16 | RASI' }), R({ nombre: 'Gus Inventado', observacion: 'falta' })] });
window.__agroPresupuestoIA = () => ({ tope: window.__ia.tope, gastado: window.__ia.gastado, apartado: 0, lecturas: window.__ia.lecturas });
window.__agroIA = (p) => { window.__ia.pedidos.push(p.nombre); window.__ia.gastado += 900; window.__ia.lecturas++;
  return { ok: true, modo: 'documento', uso: { modelo: 'claude-haiku-5-5', nivel: p.nivel, entrada: 2700, salida: 1300, microusd: 900 }, lectura: RAYA(/lunes/.test(p.nombre) ? '2024-10-07' : '2024-10-06') }; };
"""
d = pathlib.Path(tempfile.mkdtemp())
Image.new("RGB", (900, 1200), (150, 200, 170)).save(d / "domingo.jpg", quality=70)
Image.new("RGB", (900, 1200), (150, 190, 180)).save(d / "lunes.jpg", quality=70)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.add_init_script("window.__agroInicio = '2026-11-20';" + SERVIDOR)
    pg.clock.install(time="2026-11-30T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    ir(pg, "importar")
    tab(pg, "Claves de las rayas"); t = pg.locator("body").inner_text()
    caso("de arranque sólo se sabe lo que dijo Luis: Bodega y San Felipe 1 a 4, y ninguna actividad", "BOD · Bodega" in t and "SF4 · San Felipe 4" in t and "SF1 · San Felipe 1" in t and "Actividades (0)" in t and "Ubicaciones (5)" in t, plano(t)[:500])
    tab(pg, "Bandeja")
    pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / "domingo.jpg")])
    pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=60000); pg.wait_for_timeout(800)
    pg.get_by_label("Abrir domingo.jpg").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Leer con IA (hasta").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text()
    caso("la libreta entra como raya: quién hizo qué y dónde, sin pagos ni actividades", "raya con claves" in m and "NO se crean pagos ni actividades" in m and "Chon Inventado" in m, plano(m)[:400])
    caso("una actividad sin registrar no se inventa: se dice su código y que falta decir qué es", "A07: falta decir qué actividad es" in m and "Bodega (BOD)" in m and "San Felipe 4 (SF4)" in m, plano(m)[400:1500])
    caso("se pregunta una vez por clave, primero la que más sale, y lo raro se pregunta qué clase de cosa es", "Claves que falta decir qué son (4)" in m and m.index("A07") < m.index("A16") and "sale 2 veces" in m and "(en el papel: Ao7)" in m and pg.get_by_label("Qué es RASI").count() == 1, plano(m)[:900])
    caso("la duda de la IA se conserva para la revisión", "no se distingue si es dinero" in m)
    caso("quien faltó queda con su anotación, sin clave que preguntar", "Gus Inventado" in m and "falta" in m)
    # Una actividad no se guarda como ubicación (se intenta con la clave rara y después con una A).
    pg.get_by_label("Qué significa A07").fill("Limpia de ajo"); pg.get_by_role("button", name="Guardar A07").click(); pg.wait_for_timeout(500)
    m = pg.locator(".modal-sheet").inner_text(); ev = de(pg, "clave_aprendida")
    caso("al contestar, queda guardada con el código original y deja de preguntarse", len(ev) == 1 and ev[0]["datos"]["clave"] == "A07" and ev[0]["datos"]["clase"] == "actividad" and ev[0]["datos"]["significado"] == "Limpia de ajo" and "Claves que falta decir qué son (3)" in m and "Limpia de ajo (A07)" in m, plano(m)[:600])
    pg.get_by_label("Qué es RASI").select_option("ubicacion"); pg.get_by_role("button", name="Guardar RASI").click(); pg.wait_for_timeout(300)
    m = pg.locator(".modal-sheet").inner_text()
    caso("sin decir qué significa no se guarda", "Falta decir qué significa" in m and len(de(pg, "clave_aprendida")) == 1, plano(m)[:300])
    caso("como la IA tuvo dudas, nada llega marcado: lo marca una persona", "Lo que se propone (0 marcado(s) de 5)" in m)
    pg.get_by_role("button", name="Marcar todos").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(700)
    D = pg.evaluate("() => ({ eg: window.__agroDatos.egresos.length, act: (window.__agroDatos.actividades || []).length, pagos: (window.__agroDatos.eventos || []).filter(e => /^pago_|^asignacion|^cuadrilla_dia/.test(e.tipo)).length })")
    lotes = de(pg, "historico_lote"); r = lotes[0]["datos"]["renglones"] if lotes else []
    lupe = next((x for x in r if x["contraparte"] == "Lupe Inventada"), {})
    caso("al incorporar queda sólo el histórico: ni gastos, ni actividades, ni pagos", len(lotes) == 1 and len(r) == 5 and D == {"eg": 0, "act": 0, "pagos": 0}, D)
    caso("cada renglón guarda el código como venía en el papel, y aparte cuál es actividad y cuál lugar", lupe.get("claves") == ["Ao7", "Bod"] and lupe.get("actividad") == "A07" and lupe.get("ubicacion") == "BOD" and lupe.get("fecha") == "2024-10-06" and lupe.get("clase") == "raya", lupe)
    # ── El documento siguiente ya usa lo aprendido ──
    if pg.locator(".modal-sheet").count(): pg.locator(".modal-sheet").get_by_label("Cerrar documento").click(); pg.wait_for_timeout(300)
    pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / "lunes.jpg")])
    pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=60000); pg.wait_for_timeout(800)
    pg.get_by_label("Abrir lunes.jpg").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Leer con IA (hasta").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text()
    caso("en el documento siguiente A07 ya no se pregunta y sale con su significado", "Claves que falta decir qué son (3)" in m and "Limpia de ajo (A07)" in m and pg.get_by_label("Qué significa A07").count() == 0, plano(m)[:500])
    pg.locator(".modal-sheet").get_by_label("Cerrar documento").click(); pg.wait_for_timeout(300)
    # ── El catálogo: lo pendiente de lo ya importado, y corregir ──
    tab(pg, "Claves de las rayas"); t = pg.locator("body").inner_text()
    caso("el catálogo enseña lo aprendido, cuántas veces sale, y lo que sigue pendiente de lo ya importado", "A07 · Limpia de ajo" in t and "sale 2 veces en lo ya importado" in t and "falta decir qué son (3)" in t and "Actividades (1)" in t, plano(t)[:700])
    pg.get_by_label("Corregir A07").click(); pg.get_by_label("Qué es A07").select_option("ubicacion"); pg.get_by_role("button", name="Guardar corrección").click(); pg.wait_for_timeout(300)
    t = pg.locator("body").inner_text()
    caso("una clave de actividad no se puede volver ubicación", "no se guarda como ubicación" in t and len(de(pg, "clave_aprendida")) == 1, plano(t)[:300])
    pg.get_by_label("Qué es A07").select_option("actividad"); pg.get_by_label("Nuevo significado de A07").fill("Relimpia de ajo"); pg.get_by_role("button", name="Guardar corrección").click(); pg.wait_for_timeout(500)
    t = pg.locator("body").inner_text(); ev = de(pg, "clave_aprendida")
    caso("corregir guarda la nueva y deja a la vista la anterior", len(ev) == 2 and "A07 · Relimpia de ajo" in t and "antes decía: «Limpia de ajo»" in t, plano(t)[:600])
    lotes2 = de(pg, "historico_lote")
    caso("corregir no toca lo ya importado: el histórico conserva el código y se lee con el significado vigente", len(lotes2) == 1 and lotes2[0]["datos"]["renglones"] == r)
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
