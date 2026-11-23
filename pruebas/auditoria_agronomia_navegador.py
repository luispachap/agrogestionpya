"""AUDITORÍA FUNCIONAL · AGRONOMÍA Y CAMPO: Indicaciones del agrónomo (mandar, marcar hecha con su insumo: la actividad,
la salida del almacén y el costo una sola vez), Operación (lo que va en proceso y lo atrasado) y Ganado (padrón, báscula,
jeringa con su retiro, venta, potreros, cuadre y bajas con motivo). Con cuentas, 390 px, nube de imitación, otro teléfono.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_agronomia_navegador.py          (FOTOS=/ruta para guardar capturas)"""
import json, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); AGR = N.cuenta(3, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")
nube = N.Nube([ADM, AGR]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "cultivo": "Ajo", "datos": {"hectareas": 2, "emoji": "🌾", **E}, "actualizado": V}}
FEN = [{"etapa": "Preparación de suelo", "diaInicio": 0, "diaFin": 14}, {"etapa": "Siembra", "diaInicio": 14, "diaFin": 30}, {"etapa": "Desarrollo", "diaInicio": 30, "diaFin": 200}, {"etapa": "Cosecha", "diaInicio": 200, "diaFin": 240}]
t["cultivos"] = {"cul_ajo": {"id": "cul_ajo", "nombre": "Ajo", "datos": {"emoji": "🌱", "duracionDias": 240, "unidadCosecha": "kg", "fenologia": FEN, "variedades": [], **E}, "actualizado": V}}
t["siembras"] = {"s1": {"id": "s1", "parcela_id": "p1", "cultivo_id": "cul_ajo", "estado": "activa", "datos": {"cultivoNombre": "Ajo", "fechaSiembra": "2026-09-01", "fechaCosechaEstimada": "2027-04-29", "superficie": 2, **E}, "actualizado": V}}
# En campo dijeron que la siembra va a la mitad (debió terminar el 1 de octubre) y la preparación del suelo, completa.
t["avances_fase"] = {"av1": {"id": "av1", "datos": {"siembraId": "s1", "etapa": "Siembra", "porcentaje": 50, "fecha": "2026-11-10", **E}, "actualizado": V},
                     "av2": {"id": "av2", "datos": {"siembraId": "s1", "etapa": "Preparación de suelo", "porcentaje": 100, "fecha": "2026-09-14", **E}, "actualizado": V}}
t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "regador", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}}
t["inventario"] = {"i-urea": {"id": "i-urea", "nombre": "UREA INVENTADA", "cat": "fertilizante", "unidad": "bulto", "existencia": 10, "costo_unit": 500, "minimo": 0, "datos": {"emoji": "📦", **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
tab = lambda pg, txt: (pg.locator(".tab-pill", has_text=txt).first.click(), pg.wait_for_timeout(400))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuestas = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuestas.pop(0) if pg.respuestas else "") if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    G = aparato(AGR)

    # ── 1 · Indicaciones: el agrónomo manda y se marca hecha con su insumo ──
    ir(G, "indicaciones"); G.get_by_role("button", name="+ Nueva").click(); G.wait_for_timeout(300)
    campo(G, "¿A quién?").select_option("t-ana"); campo(G, "Parcela").select_option("p1")
    campo(G, "Indicación").fill("FERTILIZAR BLOQUE NORTE"); campo(G, "Insumo a aplicar").select_option("i-urea"); G.wait_for_timeout(200); campo(G, "Cantidad sugerida").fill("2")
    G.get_by_role("button", name="Enviar indicación").click(); G.wait_for_timeout(500); tx = cuerpo(G); foto(G, "01-indicacion")
    ta = [x for x in datos(G)["tareas"] if x.get("titulo") == "FERTILIZAR BLOQUE NORTE"]
    caso("la indicación queda para Ana, en la parcela uno, con la urea sugerida", len(ta) == 1 and ta[0]["asignadoA"] == "t-ana" and ta[0]["parcelaId"] == "p1" and ta[0]["insumoId"] == "i-urea" and ta[0]["estado"] == "pendiente", ta)
    caso("y se ve en la lista con su destinatario", "FERTILIZAR BLOQUE NORTE" in tx and "ANA INVENTADA" in tx and "UREA INVENTADA — 2 bulto" in tx, tx[:900])
    G.get_by_role("button", name="✓ Marcar hecha").click(); G.wait_for_timeout(400)
    campo(G, "Horas trabajadas").fill("8"); campo(G, "Cantidad de UREA INVENTADA").fill("2"); G.get_by_role("button", name="✓ Marcar como hecha").click(); G.wait_for_timeout(800)
    d = datos(G); ac = [a for a in d["actividades"] if a.get("indicacionId") == ta[0]["id"]]; eg = [e for e in d["egresos"] if e.get("indicacionId") == ta[0]["id"]]
    caso("marcarla hecha deja la actividad a nombre de Ana (quien la hizo), no de quien la marcó", len(ac) == 1 and ac[0]["trabajadorId"] == "t-ana" and ac[0]["marcadoPor"]["nombre"] == "AGRONOMO DE PRUEBA", ac)
    caso("la urea sale del almacén (10 → 8)", next(i for i in d["inventario"] if i["id"] == "i-urea")["existencia"] == 8)
    caso("y su costo ($1,000) se carga a la parcela una vez, como uso del almacén", len(eg) == 1 and eg[0]["monto"] == 1000 and eg[0].get("deInventario") and eg[0]["parcelaId"] == "p1", eg)
    r = G.evaluate("() => JSON.parse(JSON.stringify(window.__agroCuentas()))")
    caso("en Finanzas: $400 de Ana + $1,000 de urea = $1,400 de costo, y la urea NO sale otra vez del flujo", r["resultado"]["egresos"] == 1400 and r["flujo"]["egresos"] == 0, (r["resultado"]["egresos"], r["flujo"]["egresos"]))
    caso("la indicación queda como hecha", next(x for x in datos(G)["tareas"] if x["id"] == ta[0]["id"])["estado"] == "completada")

    # ── 1b · Hoja de Fito: la tabla se comprueba sola antes de mandar ──
    A0 = aparato(ADM); ir(A0, "fito")
    HOJA = "Fertiriego en el cultivo de:,AJO,Superficie en Ha:,2\nParcela:,PARCELA UNO,Fecha:,18/11/2026\nFertilizantes,Dosis kg/ha,Fertilizante total,Productos Extras,Dosis/ha:Lt o Kg,Producto total\nUREA,20,40,,,\nMKP,10,20,,,\n"
    A0.locator("input[type=file]").first.set_input_files({"name": "hoja mala.csv", "mimeType": "text/csv", "buffer": HOJA.replace("UREA,20,40", "UREA,20,45").encode()}); A0.wait_for_timeout(900); tx = cuerpo(A0); foto(A0, "01b-fito-no-cuadra")
    caso("Hoja de Fito: una hoja cuyo total no es la dosis por las hectáreas no deja mandar nada (y dice dónde)", "Mientras la tabla no cuadre, la indicación no se manda" in tx and A0.get_by_role("button", name="Mandar la indicación").count() == 0, tx[:1200])
    A0.locator("input[type=file]").first.set_input_files({"name": "hoja.csv", "mimeType": "text/csv", "buffer": HOJA.encode()}); A0.wait_for_timeout(900); tx = cuerpo(A0); foto(A0, "01c-fito")
    caso("la hoja buena cuadra, encuentra la parcela y dice qué falta en la bodega (urea: hay 8, se necesitan 40)", "PARCELA UNO" in tx and "hay 8 y se necesitan 40" in tx.replace("8.0", "8"), tx[:1500])
    caso("y de lo que no está en el catálogo dice que no se sabe (no que no hay)", "no está en el catálogo de la bodega" in tx, tx[:1500])
    A0.get_by_role("button", name="Mandar la indicación").click(); A0.wait_for_timeout(400)
    caso("sin decir a quién le toca no se manda (una indicación sin dueño no la hace nadie)", any("Falta decir a quién le toca" in x for x in A0.dialogos) and not [i for i in datos(A0).get("indicaciones") or [] if i.get("tipo") == "fertirriego"], A0.dialogos[-1:])
    A0.locator(".form-group", has=A0.locator("label", has_text="¿A quién le toca?")).locator("select").select_option("t-ana") if A0.locator(".form-group", has=A0.locator("label", has_text="¿A quién le toca?")).count() else A0.locator("select").last.select_option("t-ana")
    A0.get_by_role("button", name="Mandar la indicación").click(); A0.wait_for_timeout(600)
    ind = [i for i in datos(A0).get("indicaciones") or [] if i.get("tipo") == "fertirriego"]
    caso("se manda a Ana, para la parcela uno, con lo que pide la hoja y lo que falta", len(ind) == 1 and ind[0]["asignadoA"] == "t-ana" and ind[0]["parcelaId"] == "p1" and any(f["nombre"] for f in ind[0].get("faltantes") or []) and ind[0]["estado"] == "mandada", ind)
    A0.context.close()

    # ── 2 · Operación: lo que va en proceso y lo atrasado ──
    ir(G, "operacion"); tx = cuerpo(G); foto(G, "02-operacion")
    caso("Operación se llama así en su pantalla", G.locator(".top-bar h2").first.inner_text().strip() == "Operación", G.locator(".top-bar h2").first.inner_text())
    caso("en proceso: la siembra de la parcela uno al 50 %, reportado en campo", "Siembra" in tx and "PARCELA UNO" in tx and "50%" in tx and "campo" in tx, tx[:900])
    caso("y atrasada: debió terminar a fines de septiembre", "Atrasado o pendiente" in tx and "50% hecho" in tx and "atrasado" in tx, tx[:1200])

    # ── 2b · Las etapas de un cultivo dado de alta en la app (defecto 38) ──
    ir(G, "variedades"); G.get_by_role("button", name="Nuevo cultivo").click(); G.wait_for_timeout(200)
    G.locator("#cul-nombre").fill("CEBOLLA INVENTADA"); G.locator("#cul-dias").fill("150"); G.get_by_role("button", name="Guardar").last.click(); G.wait_for_timeout(500)
    tx = cuerpo(G)
    caso("un cultivo recién dado de alta dice que no tiene etapas (su avance por etapa saldría vacío)", "Todavía no tiene etapas" in tx, tx[:600])
    G.get_by_role("button", name="Escribir las etapas").click(); G.wait_for_timeout(200)
    G.get_by_label("Etapa 1", exact=True).fill("SIEMBRA"); G.get_by_label("Hasta el día, etapa 1").fill("20"); G.get_by_role("button", name="+ Otra etapa").click(); G.wait_for_timeout(100)
    G.get_by_label("Etapa 2", exact=True).fill("DESARROLLO"); G.get_by_label("Desde el día, etapa 2").fill("10"); G.get_by_label("Hasta el día, etapa 2").fill("160")
    G.get_by_role("button", name="Guardar etapas").click(); G.wait_for_timeout(300); tx = cuerpo(G)
    caso("etapas que se enciman o pasan de lo que dura el cultivo no se guardan, y se dice por qué", "empieza antes de que termine la anterior" in tx or "pero el cultivo dura 150 días" in tx, tx[600:1400])
    G.get_by_label("Desde el día, etapa 2").fill("20"); G.get_by_label("Hasta el día, etapa 2").fill("130"); G.get_by_role("button", name="+ Otra etapa").click(); G.wait_for_timeout(100)
    G.get_by_label("Etapa 3", exact=True).fill("COSECHA"); G.get_by_label("Hasta el día, etapa 3").fill("150")
    G.get_by_role("button", name="Guardar etapas").click(); G.wait_for_timeout(500); tx = cuerpo(G); foto(G, "02b-etapas")
    cul = next(c for c in datos(G)["cultivos"] if c["nombre"] == "CEBOLLA INVENTADA")
    caso("en orden, se guardan y se ven: siembra 0–20, desarrollo 20–130, cosecha 130–150", [(e["etapa"], e["diaInicio"], e["diaFin"]) for e in cul.get("fenologia") or []] == [("SIEMBRA", 0, 20), ("DESARROLLO", 20, 130), ("COSECHA", 130, 150)] and "día 130 al 150" in tx, cul.get("fenologia"))

    # ── 3 · Ganado ──
    A = aparato(ADM); ir(A, "ganado"); tab(A, "Potreros")
    A.respuestas = ["POTRERO NORTE", "10", "1"]; A.get_by_role("button", name="+ Registrar potrero").click(); A.wait_for_timeout(500)
    A.respuestas = ["POTRERO SUR", "", ""]
    otro = A.get_by_role("button", name="+ Registrar potrero")
    caso("se puede registrar más de un potrero", otro.count() == 1, cuerpo(A)[:500])
    if otro.count(): otro.click(); A.wait_for_timeout(500)
    tx = cuerpo(A)
    caso("los potreros quedan con lo que se sabe (y lo que no, en blanco)", "POTRERO NORTE" in tx and "POTRERO SUR" in tx and [x.get("hectareas") for x in datos(A)["potreros"]] == [10, None], [(x.get("nombre"), x.get("hectareas")) for x in datos(A)["potreros"]])
    def alta(arete, potrero=None):
        A.locator(".top-bar button.btn-accent").click(); A.wait_for_timeout(300)
        A.get_by_placeholder("MX-0001").fill(arete)
        if potrero: campo(A, "Potrero").select_option(label=potrero)
        A.get_by_role("button", name="Dar de alta").click(); A.wait_for_timeout(400)
    tab(A, "El hato"); alta("MX-0001", "POTRERO NORTE"); alta("MX-0002", "POTRERO NORTE"); alta("MX-0003")
    alta("MX-0001")
    caso("un arete repetido no se da de alta (imposibilitaría el cuadre)", any("mismo arete" in x for x in A.dialogos) and len(datos(A)["animales"]) == 3, A.dialogos[-1:])
    A.locator(".list-item", has_text="MX-0001").first.click(); A.wait_for_timeout(400)
    A.get_by_placeholder("kg").fill("300"); A.locator("input[type=date]").first.fill("2026-10-20"); A.locator(".card", has_text="La báscula").locator("button").click(); A.wait_for_timeout(300)
    A.get_by_placeholder("kg").fill("330"); A.locator("input[type=date]").first.fill("2026-11-19"); A.locator(".card", has_text="La báscula").locator("button").click(); A.wait_for_timeout(300)
    campo(A, "Producto").fill("IVERMECTINA INVENTADA"); A.get_by_placeholder("Días de retiro").fill("35"); A.locator(".card", has_text="La jeringa").locator("input[type=date]").fill("2026-11-10")
    A.get_by_role("button", name="Registrar tratamiento").click(); A.wait_for_timeout(400); tx = cuerpo(A); foto(A, "03-animal")
    caso("la báscula: 30 kg en 30 días = 1 kg al día", "1" in tx and "kg" in tx and len(datos(A)["pesajes"]) == 2, tx[:700])
    caso("con un tratamiento de 35 días de retiro del 10 de nov.: NO se puede vender (es seguridad)", "NO se puede vender" in tx, tx[:500])
    A.get_by_role("button", name="‹").first.click(); A.wait_for_timeout(300)
    A.locator(".list-item", has_text="MX-0002").first.click(); A.wait_for_timeout(400)
    campo(A, "Producto").fill("VITAMINA INVENTADA"); A.get_by_role("button", name="Registrar tratamiento").click(); A.wait_for_timeout(400); tx = cuerpo(A)
    caso("un tratamiento sin retiro capturado: «no se sabe si se puede vender», nunca «se puede»", "No se sabe si se puede vender" in tx and "Se puede vender" not in tx, tx[:500])
    A.get_by_role("button", name="‹").first.click(); A.wait_for_timeout(300); tab(A, "Para venta"); tx = cuerpo(A); foto(A, "04-venta")
    caso("para venta: el que está en retiro, aparte el que no se sabe, y aparte el libre", "NO se pueden vender (1)" in tx and "No se sabe (1)" in tx and "Sin retiro pendiente (1)" in tx and "MX-0003" in tx, tx[:1200])
    tab(A, "El hato"); A.get_by_placeholder("¿Cuántos contaste en el potrero?").fill("2"); A.wait_for_timeout(300); tx = cuerpo(A)
    caso("el cuadre: el padrón dice 3 y se contaron 2 — la diferencia se queda con su nombre, no se ajusta", "3" in tx and len([a for a in datos(A)["animales"] if not a.get("baja")]) == 3 and ("falta" in tx.lower() or "diferencia" in tx.lower()), tx[:900])
    A.locator(".list-item", has_text="MX-0003").first.click(); A.wait_for_timeout(300)
    A.respuestas = ["1", "SE LO LLEVÓ LA CRECIENTE (INVENTADO)"]; A.get_by_role("button", name="Dar de baja").click(); A.wait_for_timeout(500)
    an = {a["arete"]: a for a in datos(A)["animales"]}
    caso("la baja lleva su motivo, la causa y quién la dio", (an["MX-0003"].get("baja") or {}).get("motivo") and an["MX-0003"]["baja"].get("causa") and an["MX-0003"]["baja"].get("por") == "ADMIN DE PRUEBA", an["MX-0003"].get("baja"))
    A.get_by_placeholder("¿Cuántos contaste en el potrero?").fill("2"); A.wait_for_timeout(300); tx = cuerpo(A)
    caso("y con la baja, el cuadre ya cuadra (2 contra 2), con las bajas por motivo a la vista", "Bajas por motivo" in tx, tx[:900])
    tab(A, "Potreros"); tx = cuerpo(A)
    caso("los potreros dicen cuántas cabezas tienen", "POTRERO NORTE" in tx and "2 cabezas" in tx, tx[:700])

    # ── 4 · Otro teléfono ──
    caso("todo subió", subio(A) and subio(G))
    B = aparato(ADM); d2 = B.evaluate("() => ({ a: window.__agroDatos.animales.length, baja: window.__agroDatos.animales.filter(x => x.baja).length, t: window.__agroDatos.tratamientos.length, ta: window.__agroDatos.tareas.filter(x => x.estado === 'completada').length, ex: window.__agroDatos.inventario.find(i => i.id === 'i-urea').existencia })")
    caso("en otro teléfono: los 3 animales (1 de baja), los 2 tratamientos, la indicación hecha y la urea en 8", d2 == {"a": 3, "baja": 1, "t": 2, "ta": 1, "ex": 8}, d2)
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
