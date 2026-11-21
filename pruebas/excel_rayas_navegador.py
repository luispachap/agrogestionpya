"""El Excel antiguo de rayas, en navegador real. El libro se fabrica aquí con la FORMA del archivo de Luis y datos
inventados (ningún nombre ni sueldo verdadero). Lo que se comprueba: que sus catálogos entran como referencia histórica
con procedencia y vigencia por confirmar; que sus semanas entran como rayas al histórico; que una clave NO queda
definida por importar el Excel: se sugiere y una persona la confirma; que no salen pagos, sueldos, gastos ni
actividades; y que el resultado por cultivo de Finanzas sale por fecha y no truena.
Uso:  npx vite --port 5173 &   →   python3 pruebas/excel_rayas_navegador.py
      (EXCEL_REAL=/ruta/al/archivo.xlsx para pasar además el archivo verdadero; no se guarda en el repositorio)"""
import os, pathlib, sys, tempfile
from playwright.sync_api import sync_playwright
import openpyxl
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

def libro(ruta):
    wb = openpyxl.Workbook(); b = wb.active; b.title = "Base de datos"
    b["A1"], b["D1"], b["I1"], b["L1"], b["V1"] = "PRODUCTOS", "UBICACIONES", "ACTIVIDADES", "TRABAJADORES", "TABULADOR DE SUELDOS"
    for c, v in zip("ABDEFGIJLMNOPVW", ["CÓDIGO", "NOMBRE", "CODIGO", "NOMBRE", "COD CULTIVO", "CULTIVO", "CODIGO", "NOMBRE", "NOMBRE", "CODIGO", "TABULADOR DE SUELDO", "PERCEPCIONES EN NOMINA", "SALARIO EN EFECTIVO", "CÓDIGO", "SUMA SEMANAL"]): b[f"{c}3"] = v
    for i, f in enumerate([("AJO", "AJO MORADO"), ("MAB", "MAIZ BLANCO"), ("PAJ", "AJO POSTCOSECHA"), ("GEN", "GENERAL")]): b[f"A{4+i}"], b[f"B{4+i}"] = f
    for i, f in enumerate([("RA1", "RANCHO 1 RA1", "AJO"), ("R51", "EL 51 R51", "MAB"), ("SF4", "SAN FELIPE 4 SF4", "AJO"), ("GEN", "GENERAL", "GEN"), ("BOD", "BODEGA AJOS", "PAJ")]): b[f"D{4+i}"], b[f"E{4+i}"], b[f"F{4+i}"] = f
    for i, f in enumerate([("A07", "Desgranar A07"), ("A16", "Regar A16"), ("A17", "Sembrar A17"), ("G02", "Quitar Hilo G02"), ("SUP", "Supervisar SUP")]): b[f"I{4+i}"], b[f"J{4+i}"] = f
    for i, f in enumerate([("PERSONA INVENTADA UNO", "E01", "SS", 3219.64, 1360), ("PERSONA INVENTADA DOS", "E02", "C2", None, 3000)]):
        for c, v in zip("LMNOP", f): b[f"{c}{4+i}"] = v
    b["V4"], b["W4"] = "SS", 4579.64
    for nombre, titulo in (("30S-06O", "Semana del 30 de Septiembre al 06 de Octubre del 2024"), ("07O-13O", "Semana del 07 al 13 de Octubre del 2024")):
        h = wb.create_sheet(nombre); h["D1"] = "Lista de Rayas Agroselectos"; h["D2"] = titulo
        h["A3"], h["B3"], h["C3"] = "CODIGO SUELDO", "CODIGO TRABAJADOR", "NOMBRE TRABAJADOR"
        for i, d in enumerate(["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"]):
            h.cell(3, 4 + 3 * i, d)
            for k, t in enumerate(["ACTIVIDAD", "UBICACIÓN", "CULTIVO"]): h.cell(4, 4 + 3 * i + k, t)
        filas = [("C2", "E01", "Persona Inventada Uno", [("Desgranar A07", "BODEGA AJOS", "PAJ")] * 3 + [("Sembrar A17", "SAN FELIPE 4 SF4", "AJO")] * 2 + [("Supervisar SUP", "GENERAL", "GEN")]),
                 ("C2", "E02", "Persona Inventada Dos", [("Regar A16", "EL 51", "#N/A"), ("Regar A16", "EL 51 R51", "MAB"), ("Quitar Hilo G02", "RANCHO 1 RA1", "AJO"), ("", "", ""), ("", "", ""), ("", "", "")])]
        for r, (tab_, cod, nom, dias) in enumerate(filas):
            h.cell(5 + r, 1, tab_); h.cell(5 + r, 2, cod); h.cell(5 + r, 3, nom)
            for i, (a, u, c) in enumerate(dias):
                for k, v in enumerate((a, u, c)):
                    if v: h.cell(5 + r, 4 + 3 * i + k, v)
        h["A8"] = "TOTALES"; h["A10"] = "Lista de Rayas Ajenos"; h["A11"], h["C11"], h["D11"], h["E11"], h["F11"] = "Cuadrilla", "Cuadrilla inventada", 300, "Quitar Hilo G02", "RANCHO 1 RA1"
    wb.save(ruta)

d = pathlib.Path(tempfile.mkdtemp()); libro(d / "Lista de Rayas inventada.xlsx")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.add_init_script("window.__agroInicio = '2026-11-20';")
    pg.clock.install(time="2026-11-30T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    ir(pg, "importar")
    pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / "Lista de Rayas inventada.xlsx")])
    pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=90000); pg.wait_for_timeout(800)
    pg.get_by_label("Abrir Lista de Rayas inventada.xlsx").click(); pg.wait_for_timeout(600)
    m = pg.locator(".modal-sheet").inner_text()
    caso("los catálogos del Excel entran como referencia histórica, con su periodo y vigencia por confirmar", "REFERENCIA histórica" in m and "2024-09-30 a 2024-10-13" in m and "vigencia por confirmar" in m, plano(m)[:600])
    caso("se dice que los trabajadores y los sueldos de esa hoja no se leen", "Los trabajadores y los sueldos de esa hoja NO se leen" in m and "3219" not in m and "4579" not in m and "PERSONA INVENTADA UNO" not in m)
    caso("las semanas entran como rayas, sin pagos ni actividades, y el cultivo con #N/A se dice", "NO se crean pagos ni actividades" in m and "no traen cultivo (en el Excel venía vacío o con error #N/A" in m, plano(m)[:900])
    caso("la clave A07 se pregunta, y el Excel se ofrece como pista con su procedencia", pg.get_by_label("Qué significa A07").count() == 1 and "esta clave era una actividad: «Desgranar»" in m and "Lista de Rayas inventada.xlsx (2024-09-30 a 2024-10-13)" in m and "Vigencia por confirmar" in m, plano(m)[600:1700])
    caso("importar el Excel no define ninguna clave por sí solo", len(de(pg, "clave_aprendida")) == 0)
    pg.get_by_label("Usar Desgranar").first.click(); pg.wait_for_timeout(200)
    caso("«Usar» sólo llena la respuesta: falta que la persona la guarde", pg.get_by_label("Qué significa A07").input_value() == "Desgranar" and len(de(pg, "clave_aprendida")) == 0)
    pg.get_by_role("button", name="Guardar A07").click(); pg.wait_for_timeout(500)
    ev = de(pg, "clave_aprendida")
    caso("al guardarla queda confirmada, anotando de qué archivo salió", len(ev) == 1 and ev[0]["datos"]["clave"] == "A07" and ev[0]["datos"]["significado"] == "Desgranar" and ev[0]["datos"]["deReferencia"]["documento"] == "Lista de Rayas inventada.xlsx", ev[-1]["datos"] if ev else "")
    m = pg.locator(".modal-sheet").inner_text()
    caso("lo que el Excel escribía sólo con el nombre («EL 51») también trae su pista", "«EL 51»" in m or "EL51" in m, plano(m)[600:2200])
    pg.get_by_role("button", name="Marcar todos").click(); pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(1200)
    D = pg.evaluate("() => ({ eg: window.__agroDatos.egresos.length, trab: window.__agroDatos.trabajadores.length, pagos: (window.__agroDatos.eventos || []).filter(e => /^pago_|^asignacion|^cuadrilla_dia|^recibo/.test(e.tipo)).length })")
    antes = pg.evaluate("() => window.__agroSembrado ? window.__agroSembrado.trabajadores : null")
    lotes = de(pg, "historico_lote"); R = [x for l in lotes for x in l["datos"]["renglones"]]
    rayas = [x for x in R if x["clase"] == "raya"]; refs = [x for x in R if x["clase"] == "referencia_clave"]
    caso("queda sólo histórico: rayas por día y referencias; ni gastos ni pagos", len(rayas) == 18 and len(refs) >= 14 and D["eg"] == 0 and D["pagos"] == 0, [len(rayas), len(refs), D])
    caso("ningún importe ni sueldo salió del Excel", all(x.get("monto") in (None, 0) for x in R) and "3219" not in str(R) and "4579" not in str(R))
    lun = next((x for x in rayas if x["fecha"] == "2024-09-30" and "Uno" in x["contraparte"]), {})
    caso("cada día guarda lo que decía el Excel: actividad, lugar y cultivo, con su fecha", lun.get("claves") == ["A07", "BODEGA AJOS"] and lun.get("actividad") == "A07" and lun.get("cultivoEscrito") == "PAJ" and lun.get("escrito", {}).get("actividad") == "Desgranar A07", lun)
    caso("las referencias guardan de qué archivo y de qué fechas son", all(x.get("documento") == "Lista de Rayas inventada.xlsx" and x.get("desde") == "2024-09-30" and x.get("vigencia") == "por confirmar" for x in refs))
    if pg.locator(".modal-sheet").count(): pg.locator(".modal-sheet").get_by_label("Cerrar documento").click(); pg.wait_for_timeout(300)
    tab(pg, "Claves de las rayas"); t = pg.locator("body").inner_text()
    caso("el catálogo enseña lo que decían los Excel anteriores, aparte de lo confirmado", "Lo que decían tus Excel anteriores" in t and "A07 · Desgranar" in t and "coincide con lo confirmado" in t and "A17" in t and "sin confirmar" in t, plano(t)[:900])
    caso("lo que el Excel dice distinto de lo confirmado se enseña y no lo cambia", "BOD · Bodega" in t and "«BODEGA AJOS» · cultivo que tenía: PAJ" in t and "distinto de lo confirmado: no lo cambia" in t, plano(t)[900:2400])
    pg.get_by_label("Confirmar A17 como Sembrar").click(); pg.wait_for_timeout(400)
    ev = de(pg, "clave_aprendida"); t = pg.locator("body").inner_text()
    caso("una referencia se confirma con un toque, y queda de dónde salió", len(ev) == 2 and ev[-1]["datos"]["clave"] == "A17" and ev[-1]["datos"]["deReferencia"]["documento"] == "Lista de Rayas inventada.xlsx" and "A17 · Sembrar" in t)
    # volver a subir el mismo archivo no duplica
    tab(pg, "Bandeja"); pg.get_by_label("Escoger archivos para importar").set_input_files([str(d / "Lista de Rayas inventada.xlsx")]); pg.wait_for_timeout(2500)
    t = pg.locator("body").inner_text()
    caso("el mismo archivo otra vez no entra dos veces", ("mismo archivo" in t or "duplicado" in t.lower()) and len(de(pg, "historico_lote")) == len(lotes), plano(t)[:400])
    # Finanzas: el resultado por cultivo sale por fecha y no truena
    ir(pg, "contabilidad"); pg.wait_for_timeout(400)
    if pg.locator(".tab-pill", has_text="Resultados").count(): tab(pg, "Resultados")
    t = pg.locator("body").inner_text()
    caso("el resultado por cultivo de Finanzas dice que sale del ciclo de cada fecha", "Resultado por cultivo" in t and "El cultivo de cada trabajo sale del ciclo que tenía la parcela ese día" in t, plano(t)[-700:])
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    real = os.environ.get("EXCEL_REAL")
    if real:
        ir(pg, "importar"); pg.get_by_label("Escoger archivos para importar").set_input_files([real])
        pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=180000); pg.wait_for_timeout(1500)
        pg.locator("[aria-label^='Abrir ']").first.click(); pg.wait_for_timeout(1500)
        m = pg.locator(".modal-sheet").inner_text()
        print("ARCHIVO REAL →", plano(m)[:700].replace("  ", " "))
        caso("el archivo real se lee en el navegador sin tronar", "REFERENCIA histórica" in m and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
