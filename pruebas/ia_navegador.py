"""La lectura con IA en la importación, en navegador real y SIN gastar: el servidor de la IA es de mentira.
Lo que se comprueba: que sólo se ofrece para lo que los lectores gratuitos no pudieron, que se dice cuánto puede costar
antes, que lo leído entra por el mismo camino (propuesta y confirmación), que lo dudoso llega sin marcar, que una hoja
desordenada sólo manda sus primeros renglones, que se lleva el costo por documento, y que sin presupuesto no pasa nada.
Uso:  npx vite --port 5173 &   →   python3 pruebas/ia_navegador.py"""
import json, pathlib, sys, tempfile
from playwright.sync_api import sync_playwright
from PIL import Image
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
plano = lambda t: t.replace("\n", " | ")
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "pin": "4821"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(500)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
egresos = lambda pg: pg.evaluate("() => window.__agroDatos.egresos")
# ── El servidor de mentira: contesta como el de verdad, lleva la cuenta y respeta el tope ──
SERVIDOR = """
window.__ia = { pedidos: [], gastado: 0, tope: 4000000, lecturas: 0 };
const R = (m) => Object.assign({ fecha: '', nombre: '', concepto: '', cantidad: '', unidad: '', importe: '', litros: '', vehiculo: '', parcela: '', dias: '', puesto: '' }, m);
const TICKET = { clase: 'ticket', confianza: 'alta', emisor: 'FERRETERIA DE PRUEBA', fecha: '2026-11-27', folio: 'A-1', subtotal: '', total: '348.00', moneda: 'MXN', renglones: [R({ concepto: 'TORNILLO', importe: '120.00' }), R({ concepto: 'BROCA', importe: '228.00' })], no_se_leyo: [], avisos: [] };
window.__agroPresupuestoIA = () => ({ tope: window.__ia.tope, gastado: window.__ia.gastado, apartado: 0, lecturas: window.__ia.lecturas });
window.__agroIA = (p) => {
  window.__ia.pedidos.push({ modo: p.modo, nivel: p.nivel, nombre: p.nombre, imagenes: (p.imagenes || []).length, bytes: (p.imagenes || []).reduce((s, i) => s + i.base64.length, 0), texto: p.texto || '' });
  const micro = p.nivel === 'superior' ? 9000 : (p.modo === 'hoja' ? 60 : 470);
  if (window.__ia.gastado + micro > window.__ia.tope) return { error: 'sin_presupuesto', dice: 'Se llegó al tope autorizado para leer documentos con IA.' };
  window.__ia.gastado += micro; window.__ia.lecturas++;
  const uso = { modelo: p.nivel === 'superior' ? 'claude-sonnet-5-5' : 'claude-haiku-5-5', nivel: p.nivel, entrada: 2600, salida: 420, microusd: micro };
  if (p.modo === 'hoja') return { ok: true, modo: 'hoja', uso, lectura: { clase: 'gastos', confianza: 'alta', renglon_encabezado: '0', columnas: { fecha: '0', proveedor: '1', importe: '2' }, avisos: [] } };
  if (/borroso/.test(p.nombre)) return { ok: true, modo: 'documento', uso, lectura: p.nivel === 'superior' ? Object.assign({}, TICKET, { folio: 'B-2', total: '99.00', renglones: [] }) : Object.assign({}, TICKET, { folio: 'B-2', total: '', confianza: 'baja', no_se_leyo: ['total'], renglones: [] }) };
  return { ok: true, modo: 'documento', uso, lectura: TICKET };
};
"""
d = pathlib.Path(tempfile.mkdtemp())
Image.new("RGB", (2400, 3200), (240, 240, 235)).save(d / "ticket.jpg", quality=70)
Image.new("RGB", (900, 1200), (200, 200, 200)).save(d / "borroso.jpg", quality=60)
(d / "rara.csv").write_text("F.,Quién,Cuánto,CURP\n" + "\n".join(f"27/11/2026,PROVEEDOR {i} DE PRUEBA,{100 + i},LORA900101MZSPZN05" for i in range(60)) + "\n", encoding="utf8")
(d / "gastos.csv").write_text("Fecha,Proveedor,Concepto,Total\n26/11/2026,CFE DE PRUEBA,Luz,900\n", encoding="utf8")

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
    pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / x) for x in ("ticket.jpg", "borroso.jpg", "rara.csv", "gastos.csv")])
    pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=60000); pg.wait_for_timeout(800)
    ped = lambda: pg.evaluate("() => window.__ia.pedidos")
    t = pg.locator("body").inner_text()
    caso("subir documentos NO manda nada a la IA: sólo avisa cuántos no se pudieron leer gratis", len(ped()) == 0 and "3 documento(s) no se pudieron leer gratis" in t, plano(t)[:200])
    tab(pg, "Lectura con IA"); t = pg.locator("body").inner_text()
    caso("la pestaña dice el presupuesto, que es un tope total, y cuánto costaría leer lo pendiente", "Autorizado $4.00 · gastado $0" in t and "Es un tope total, no mensual" in t and "Documentos que podrían leerse con IA (3)" in t and "a lo más" in t, plano(t)[:400])
    # ── Un ticket, uno por uno ──
    tab(pg, "Bandeja"); pg.get_by_label("Abrir ticket.jpg").click(); pg.wait_for_timeout(400)
    m = pg.locator(".modal-sheet").inner_text()
    caso("antes de gastar se dice por qué hace falta y cuánto puede costar", "Es una foto" in m and "Leer con IA (hasta $0.0035)" in m and "queda $4.00" in m, plano(m)[:300])
    pg.get_by_role("button", name="Leer con IA (hasta").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text(); q = ped()
    caso("la foto se achica antes de mandarse (más grande sólo cuesta más)", len(q) == 1 and q[0]["imagenes"] == 1 and q[0]["nivel"] == "economico" and q[0]["bytes"] < 400000, q[0] if q else "")
    caso("lo que leyó la IA es una PROPUESTA: un gasto por registrar, con su costo y el aviso de compararlo contra el papel", "Leído con IA · Gasto por registrar" in m and "$348" in m and "FERRETERIA DE PRUEBA" in m and "este documento lleva $0.0005" in m and "compáralo contra el papel" in m and len(egresos(pg)) == 0, plano(m)[:500])
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(600)
    eg = egresos(pg)
    caso("al confirmarlo queda el gasto, con de qué documento salió", len(eg) == 1 and eg[0]["monto"] == 348 and eg[0]["_importado"]["documento"] == "ticket.jpg", eg[0] if eg else "")
    # ── La hoja desordenada: sólo viajan sus primeros renglones ──
    tab(pg, "Todos"); pg.get_by_label("Abrir rara.csv").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Leer con IA (hasta").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text(); q = ped()[-1]
    caso("de la hoja sólo viajan sus primeros 30 renglones, sin la CURP, y la IA sólo dice qué columna es cada cosa", q["modo"] == "hoja" and q["imagenes"] == 0 and len(q["texto"].split("\n")) == 30 and "LORA900101" not in q["texto"] and "▮▮▮" in q["texto"], q["texto"][:120])
    caso("con eso la app lee TODA la hoja ella sola (60 renglones) y dice qué columnas reconoció la IA", "60 marcado(s) de 60" in m and "las reconoció la IA" in m and "PROVEEDOR 0 DE PRUEBA" in m, plano(m)[:400])
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(900)
    caso("sólo al confirmarla queda aprendida para las siguientes hojas iguales", len(de(pg, "hoja_aprendida")) == 1 and len(egresos(pg)) == 61)
    # ── El borroso: dudoso con el económico, y el superior a petición ──
    tab(pg, "Todos"); pg.get_by_label("Abrir borroso.jpg").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Leer con IA (hasta").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text()
    caso("si la IA no leyó el total no se propone ningún gasto, y se ofrece el nivel superior diciendo cuánto más cuesta", "No se leyó el total" in m and "Incorporar lo marcado" not in m and "Intentar con el nivel superior (hasta $0.07" in m and len(egresos(pg)) == 61, plano(m)[:500])
    pg.get_by_role("button", name="Intentar con el nivel superior").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text()
    caso("el nivel superior sólo se usa cuando una persona lo pide, y su costo se suma al del documento", ped()[-1]["nivel"] == "superior" and "$99" in m and "este documento lleva $0.0095" in m, plano(m)[:300])
    pg.get_by_label("Motivo para descartar el documento").fill("LA IA LO LEYO MAL"); pg.get_by_role("button", name="Descartar este documento").click(); pg.wait_for_timeout(500)
    # ── Las medidas ──
    tab(pg, "Lectura con IA"); t = pg.locator("body").inner_text()
    caso("se ve cuánto costó cada documento y cuántos se aceptaron tal cual, con cambios o se descartaron", "Costo por documento" in t and "borroso.jpg" in t and "$0.0095" in t and "De 3 documento(s) ya decididos por una persona, 67 % se aceptaron tal cual" in t and "1 necesitaron el nivel superior" in t, plano(t)[:700])
    caso("el presupuesto se actualiza con lo gastado", "gastado $0.01" in t.replace("$0.0100", "$0.01") or "gastado $0.0100" in t, plano(t)[:200])
    caso("la hoja que se leyó sola (gastos.csv) nunca fue a la IA", all(x["nombre"] != "gastos.csv" for x in ped()) and len(ped()) == 4)
    # ── Sin presupuesto no pasa nada ──
    pg.evaluate("() => { window.__ia.tope = window.__ia.gastado; }")
    Image.new("RGB", (800, 800), (10, 200, 10)).save(d / "otro.jpg")
    tab(pg, "Bandeja"); pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / "otro.jpg")]); pg.wait_for_timeout(1500)
    tab(pg, "Lectura con IA"); pg.wait_for_timeout(500); t = pg.locator("body").inner_text()
    caso("al acabarse lo autorizado se dice y el botón queda apagado", "Se acabó lo autorizado" in t and pg.get_by_role("button", name="Leer con IA los 1").is_disabled(), plano(t)[:300])
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
