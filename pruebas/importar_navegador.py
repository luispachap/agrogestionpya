"""Importar documentos por montones, en navegador real: una factura en XML, hojas de Excel y CSV, un Word, un PDF con
texto, una foto y una hoja que no se reconoce. Todo con datos de mentira y sin nube.
Uso:  npx vite --port 5173 &   →   python3 pruebas/importar_navegador.py"""
import json, pathlib, sys, tempfile, zipfile
from playwright.sync_api import sync_playwright
import openpyxl
from reportlab.pdfgen import canvas
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
plano = lambda t: t.replace("\n", " | ")
S = g["SEMILLA"]
S["trabajadores"] = [{"id": "t-ana", "nombre": "ANA DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 400, "pin": "4821"}]
S["maquinaria"] = [{"id": "m-tractor", "nombre": "TRACTOR DE PRUEBA", "costo_hora": 100}]
S["titulares"] = [{"id": "ti1", "nombre": "RANCHO DE PRUEBA", "rfc": "XAXX010101000"}]
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(500)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(300)
egresos = lambda pg: pg.evaluate("() => window.__agroDatos.egresos")

# ── Los papeles de mentira ──
d = pathlib.Path(tempfile.mkdtemp())
def xml(nombre, fecha, uuid, total="1160.00"):
    (d / nombre).write_text(f'''<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="77" Fecha="{fecha}T10:00:00" SubTotal="1000.00" Moneda="MXN" Total="{total}" TipoDeComprobante="I" FormaPago="03">
<cfdi:Emisor Rfc="AGR010101AAA" Nombre="AGROQUIMICOS DE PRUEBA SA DE CV"/><cfdi:Receptor Rfc="XAXX010101000" Nombre="RANCHO DE PRUEBA"/>
<cfdi:Conceptos><cfdi:Concepto Cantidad="20" Unidad="BULTO" Descripcion="UREA DE PRUEBA" ValorUnitario="50.00" Importe="1000.00"/></cfdi:Conceptos>
<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="x" UUID="{uuid}"/></cfdi:Complemento></cfdi:Comprobante>''', encoding="utf8"); return str(d / nombre)
U1, U2 = "AAAAAAAA-1111-2222-3333-444444444444", "BBBBBBBB-1111-2222-3333-444444444444"
f_nueva, f_vieja = xml("factura nueva.xml", "2026-11-25", U1), xml("factura vieja.xml", "2025-08-12", U2, "580.00")
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Semana 46"
for r in [["RANCHO DE PRUEBA"], ["Nombre del trabajador", "Puesto", "Días trabajados", "Total a pagar"], ["ANA DE PRUEBA", "Campo", 6, 2400], ["BETO DE PRUEBA LOPEZ", "Riego", 6, 2280], ["TOTAL", "", "", 4680]]: ws.append(r)
ws2 = wb.create_sheet("Personal")
for r in [["Nombre", "Puesto", "Sueldo diario", "Fecha de ingreso"], ["ANA DE PRUEBA", "Campo", 400, "01/03/2024"], ["BETO DE PRUEBA LOPEZ", "Riego", 380, "15/06/2022"]]: ws2.append(r)
wb.save(d / "nomina y personal.xlsx")
(d / "diesel.csv").write_text("Fecha,Unidad,Litros,Importe\n26/11/2026,TRACTOR DE PRUEBA,80,2000\n10/05/2025,TRACTOR DE PRUEBA,60,1400\n27/11/2026,TRACTOR DE PRUEBA,,500\n", encoding="utf8")
(d / "rara.csv").write_text("F.,Quién,Cuánto\n27/11/2026,FERRETERIA DE PRUEBA,120\n", encoding="utf8")
with zipfile.ZipFile(d / "proveedores.docx", "w", zipfile.ZIP_DEFLATED) as z:
    celda = lambda t: f"<w:tc><w:p><w:r><w:t>{t}</w:t></w:r></w:p></w:tc>"
    fila = lambda *c: "<w:tr>" + "".join(celda(x) for x in c) + "</w:tr>"
    z.writestr("word/document.xml", f'<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Proveedores</w:t></w:r></w:p><w:tbl>{fila("Proveedor", "RFC", "Teléfono")}{fila("SEMILLAS DE PRUEBA SA", "SEM010101AAA", "4490000000")}</w:tbl></w:body></w:document>')
c = canvas.Canvas(str(d / "factura nueva.pdf")); c.drawString(72, 760, "FACTURA"); c.drawString(72, 740, f"Folio fiscal: {U1}"); c.drawString(72, 720, "RFC emisor AGR010101AAA"); c.drawString(72, 700, "Total: $1,160.00"); c.save()
(d / "ticket.png").write_bytes(bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082"))
(d / ".DS_Store").write_text("basura")
todos = [f_nueva, f_vieja, str(d / "nomina y personal.xlsx"), str(d / "diesel.csv"), str(d / "rara.csv"), str(d / "proveedores.docx"), str(d / "factura nueva.pdf"), str(d / "ticket.png"), str(d / ".DS_Store")]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, timezone_id="America/Mexico_City")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.add_init_script("window.__agroInicio = '2026-11-20'")
    pg.clock.install(time="2026-11-30T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    ir(pg, "importar")
    t = pg.locator("body").inner_text()
    caso("la pantalla dice desde cuándo es operación y que lo anterior entra como histórico", "Importar documentos" in t and "La operación arrancó el 2026-11-20" in t and "nada entra a la operación hasta que tú lo confirmes" in t, plano(t)[:300])
    pg.get_by_label("Escoger archivos para importar").set_input_files(todos)
    pg.wait_for_function("() => !document.body.innerText.includes('Leyendo ')", timeout=60000); pg.wait_for_timeout(800)
    rec = de(pg, "doc_recibido"); lei = de(pg, "doc_leido"); t = pg.locator("body").inner_text()
    por = {e["datos"]["docId"]: e["datos"] for e in lei}; nom = {e["id"]: e["datos"]["nombre"] for e in rec}; est = {nom[k]: v for k, v in por.items()}
    caso("se reciben los 8 documentos (la basura de la carpeta no) y cada uno queda leído", len(rec) == 8 and len(lei) == 8 and ".DS_Store" not in nom.values(), sorted(nom.values()))
    caso("la factura posterior al arranque se propone como gasto; la de antes, al histórico", est["factura nueva.xml"]["n"] == {"egresos": 1} and est["factura vieja.xml"]["n"] == {"historico": 1} and est["factura nueva.xml"]["clase"] == "cfdi_gasto", [est["factura nueva.xml"]["n"], est["factura vieja.xml"]["n"]])
    caso("el PDF de la misma factura se pega a su XML y no se cuenta otra vez", est["factura nueva.pdf"]["estado"] == "incorporado" and "versión impresa" in est["factura nueva.pdf"]["resumen"], est["factura nueva.pdf"])
    caso("el Excel trae dos hojas: la nómina va al histórico y del personal sólo se propone a quien no está", est["nomina y personal.xlsx"]["n"] == {"historico": 2, "trabajadores": 1} and est["nomina y personal.xlsx"]["duplicados"] == 1, est["nomina y personal.xlsx"])
    caso("del combustible: lo posterior con importe y vehículo conocido es gasto, lo viejo histórico, y el renglón sin litros no se adivina", est["diesel.csv"]["n"] == {"egresos": 1, "historico": 1} and est["diesel.csv"]["sinLeer"] == 1, est["diesel.csv"])
    caso("la tabla del Word se lee como lista de proveedores", est["proveedores.docx"]["n"] == {"proveedores": 1}, est["proveedores.docx"])
    caso("la foto se guarda y se dice que falta leerla; la hoja rara queda por revisar, sin proponer nada", est["ticket.png"]["estado"] == "necesita_lectura" and est["rara.csv"]["estado"] == "por_revisar" and est["rara.csv"]["n"] == {}, [est["ticket.png"]["estado"], est["rara.csv"]])
    caso("mientras nadie confirma, no hay ni un gasto ni una persona nueva", len(egresos(pg)) == 0 and len(pg.evaluate("() => window.__agroDatos.trabajadores")) == 1 and len(de(pg, "historico_lote")) == 0)
    # ── Subir lo mismo otra vez no duplica ──
    pg.get_by_label("Escoger archivos para importar").set_input_files([f_nueva, str(d / "diesel.csv")]); pg.wait_for_timeout(1500)
    caso("el mismo archivo no se recibe dos veces", len(de(pg, "doc_recibido")) == 8 and "ya se habían recibido antes" in pg.locator("body").inner_text())
    # ── Confirmar la factura nueva ──
    pg.get_by_label("Abrir factura nueva.xml").click(); pg.wait_for_timeout(400)
    m = pg.locator(".modal-sheet").inner_text()
    caso("al abrirla se ve lo que propone, con importe, proveedor y a dónde va", "UREA DE PRUEBA" in m and "$1,160" in m and "Gasto por registrar" in m and "insumos" in m, plano(m)[:400])
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(600)
    eg = egresos(pg)
    caso("queda el gasto con su folio fiscal y de qué documento salió, y como insumo por clasificar (no se supone del almacén)", len(eg) == 1 and eg[0]["monto"] == 1160 and eg[0]["uuid"] == U1 and eg[0]["_importado"]["documento"] == "factura nueva.xml" and eg[0]["categoria"] == "insumos" and not eg[0].get("destinoInsumo"), eg[0] if eg else "")
    # ── La nómina y el personal ──
    tab(pg, "Todos"); pg.get_by_label("Abrir nomina y personal.xlsx").click(); pg.wait_for_timeout(400)
    m = pg.locator(".modal-sheet").inner_text()
    caso("la nómina posterior al arranque avisa que NO crea pagos, y Ana sale como ya registrada", "Al histórico" in m and "Ya está registrado" in m and "BETO DE PRUEBA LOPEZ" in m and "Persona para el catálogo" in m, plano(m)[:500])
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(600)
    tr = pg.evaluate("() => window.__agroDatos.trabajadores"); lotes = de(pg, "historico_lote")
    caso("entra Beto al catálogo sin PIN, la nómina al histórico, y no existe ningún pago", len(tr) == 2 and not tr[1].get("pin") and tr[1]["fechaIngreso"] == "2022-06-15" and len(lotes) == 1 and len(lotes[0]["datos"]["renglones"]) == 2 and len(de(pg, "pago_personal")) == 0, [x["nombre"] for x in tr])
    # ── Enseñarle la hoja rara ──
    tab(pg, "Todos"); pg.get_by_label("Abrir rara.csv").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Decir qué es").click()
    pg.get_by_label("Qué es esta hoja").select_option("gastos")
    pg.get_by_label("Columna de Fecha").select_option("0"); pg.get_by_label("Columna de Importe").select_option("2"); pg.get_by_label("Columna de Proveedor").select_option("1")
    pg.get_by_role("button", name="Guardar y volver a leer").click(); pg.wait_for_timeout(1500)
    m = pg.locator(".modal-sheet").inner_text()
    caso("después de decirle qué es cada columna, la hoja rara ya propone su gasto, y queda aprendido", len(de(pg, "hoja_aprendida")) == 1 and "FERRETERIA DE PRUEBA" in m and "$120" in m and "Gasto por registrar" in m, plano(m)[:400])
    pg.get_by_role("button", name="Incorporar lo marcado").click(); pg.wait_for_timeout(500)
    # ── Descartar la foto, y el histórico ──
    tab(pg, "Todos"); pg.get_by_label("Abrir ticket.png").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Descartar este documento").click(); pg.wait_for_timeout(200)
    sin = "Falta decir por qué" in pg.locator(".modal-sheet").inner_text()
    pg.get_by_label("Motivo para descartar el documento").fill("NO ES DEL RANCHO"); pg.get_by_role("button", name="Descartar este documento").click(); pg.wait_for_timeout(400)
    caso("descartar pide motivo y queda anotado", sin and len(de(pg, "doc_descartado")) == 1)
    tab(pg, "Histórico"); h = pg.locator("body").inner_text()
    caso("el histórico se ve por mes (o «sin fecha» si la hoja no la traía) y dice que no está en costos ni en flujo", "NO está en los costos" in h and "sin fecha" in h and "Pagos al personal · 2 renglón(es)" in h and "$4,680" in h, plano(h)[:500])
    ir(pg, "contabilidad"); tab(pg, "Resultados"); r = pg.locator("body").inner_text()
    caso("en Finanzas sólo están los gastos confirmados: la urea por clasificar y la ferretería; el histórico no aparece", "Insumos por clasificar" in r and "UREA DE PRUEBA" in r and "4,680" not in r and "580" not in r, plano(r)[:300])
    caso("ninguna pantalla tronó", not g["trono"](pg) and not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
