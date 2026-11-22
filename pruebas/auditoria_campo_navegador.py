"""AUDITORÍA FUNCIONAL · CAMPO: ranchos y parcelas, cultivos y variedades, calendario de siembras, estado de parcelas,
cosechas y comparación de variedades. Con cuentas, como una persona, 390 px, nube de imitación. Un rancho que arranca
VACÍO (como producción): alta de rancho, parcela y cultivo desde la app, siembra en el calendario, lo cosechado anotado
desde dos teléfonos sin señal, ajustes con motivo, y que no se elimine lo que ya tiene registros. Datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_campo_navegador.py"""
import datetime, json, os, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
FOTOS = os.environ.get("FOTOS")          # carpeta donde dejar capturas de las pantallas reales (opcional)
def png(lado=64):   # una imagen de verdad (ruido), lo bastante grande para que la app la saque del registro
    import os as _os, struct, zlib
    crudo = b"".join(b"\x00" + _os.urandom(lado * 3) for _ in range(lado))
    trozo = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(crudo)) + trozo(b"IEND", b"")
PNG = png()
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado"); AGR = N.cuenta(3, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")
nube = N.Nube([ADM, ENC, AGR])
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
campo = lambda pg, etiqueta: pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="08:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = "MOTIVO INVENTADO"
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    def recarga(pg): hora(pg); pg.reload(); pg.wait_for_timeout(3500)
    def al_dia(pg): avanza(pg, 6 / 60); recarga(pg)

    # ══ 1. Un rancho vacío: rancho y parcelas ══
    A = aparato(ADM, "07:00")
    ir(A, "parcelas"); t = cuerpo(A)
    caso("vacío, la pantalla dice por dónde empezar", "Todavía no hay ranchos" in t and "Nuevo rancho" in t, t[:300])
    A.get_by_role("button", name="Nueva parcela").click(); A.wait_for_timeout(300)
    campo(A, "Nombre de la parcela").fill("PARCELA UNO"); campo(A, "Cultivo principal").fill("Ajo"); A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(300)
    caso("sin rancho no nace una parcela, y dice por qué", len(datos(A)["parcelas"]) == 0 and "Primero da de alta un rancho" in cuerpo(A))
    A.get_by_role("button", name="Nuevo rancho").click(); A.wait_for_timeout(300); A.get_by_role("button", name="Crear Rancho").click(); A.wait_for_timeout(300)
    caso("un rancho sin nombre no se crea, y dice qué falta", len(datos(A)["ranchos"]) == 0 and "Falta el nombre del rancho" in cuerpo(A))
    campo(A, "Nombre del rancho").fill("RANCHO INVENTADO"); campo(A, "Hectáreas totales").fill("40"); A.get_by_role("button", name="Crear Rancho").click(); A.wait_for_timeout(500)
    campo(A, "Nombre del rancho").fill("rancho inventado"); A.get_by_role("button", name="Crear Rancho").click(); A.wait_for_timeout(300)
    caso("se crea el rancho, y el mismo nombre no entra dos veces", len(datos(A)["ranchos"]) == 1 and "Ya hay un rancho" in cuerpo(A), [r["nombre"] for r in datos(A)["ranchos"]])
    A.get_by_role("button", name="Nueva parcela").click(); A.wait_for_timeout(300)
    campo(A, "Nombre de la parcela").fill("PARCELA UNO"); campo(A, "Cultivo principal").fill(""); A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(300)
    caso("una parcela sin cultivo no se crea, y dice qué falta", len(datos(A)["parcelas"]) == 0 and "Falta el cultivo principal" in cuerpo(A))
    campo(A, "Cultivo principal").fill("Ajo"); campo(A, "Hectáreas").fill("3"); A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(600)
    P = datos(A)["parcelas"]; R = datos(A)["ranchos"]
    caso("la parcela nace dentro de su rancho (aunque el rancho se acabe de crear en esa misma pantalla)", len(P) == 1 and P[0]["ranchoId"] == R[0]["id"] and P[0]["hectareas"] == 3, P)
    A.get_by_role("button", name="Nueva parcela").click(); A.wait_for_timeout(300)
    campo(A, "Nombre de la parcela").fill("parcela uno"); campo(A, "Cultivo principal").fill("Ajo"); A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(300)
    caso("el mismo nombre de parcela en el mismo rancho no entra dos veces", len(datos(A)["parcelas"]) == 1 and "ya hay una parcela" in cuerpo(A))
    for nombre, ha in (("PARCELA DOS", "4"), ("PARCELA TRES", "1")):
        campo(A, "Nombre de la parcela").fill(nombre); campo(A, "Cultivo principal").fill("Ajo"); campo(A, "Hectáreas").fill(ha); A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(500)
        A.get_by_role("button", name="Nueva parcela").click(); A.wait_for_timeout(250)
    A.get_by_role("button", name="Lista").click(); A.wait_for_timeout(300); t = cuerpo(A); foto(A, "01-parcelas")
    caso("la lista enseña el rancho con sus tres parcelas", "RANCHO INVENTADO" in t and "3 parcelas" in t and all(x in t for x in ("PARCELA UNO", "PARCELA DOS", "PARCELA TRES")), t[:400])
    A.locator(".list-item", has_text="PARCELA UNO").click(); A.wait_for_timeout(400)
    campo(A, "Hectáreas").fill("3.5"); A.wait_for_timeout(400); A.get_by_role("button", name="‹ Volver").click(); A.wait_for_timeout(300)
    caso("corregir las hectáreas de una parcela se guarda", next(x for x in datos(A)["parcelas"] if x["nombre"] == "PARCELA UNO")["hectareas"] == 3.5)
    A.locator(".list-item", has_text="PARCELA UNO").click(); A.wait_for_timeout(400)
    campo(A, "Latitud GPS").fill("22.9"); campo(A, "Longitud GPS").fill("-102.7"); A.wait_for_timeout(300)
    A.get_by_role("button", name="+ Agregar al ciclo").click(); A.wait_for_timeout(300)
    A.locator('input[type="file"]').last.set_input_files({"name": "parcela.png", "mimeType": "image/png", "buffer": PNG}); A.wait_for_timeout(1500)
    pu = next(x for x in datos(A)["parcelas"] if x["nombre"] == "PARCELA UNO"); foto(A, "01b-ficha-de-parcela")
    caso("la ficha guarda la ubicación, un renglón de su ciclo y la foto", pu.get("lat") == 22.9 and pu.get("lng") == -102.7 and len(pu.get("cicloFenologico") or []) == 1 and bool(pu.get("foto")), {k: str(pu.get(k))[:40] for k in ("lat", "lng", "cicloFenologico", "foto")})
    A.get_by_role("button", name="‹ Volver").click(); A.wait_for_timeout(300)
    campo_ok = subio(A); recarga(A); P = {x["nombre"]: x for x in datos(A)["parcelas"]}
    caso("sube a la nube y al recargar sigue todo igual", campo_ok and len(P) == 3 and P["PARCELA UNO"]["hectareas"] == 3.5 and len(nube.t["parcelas"]) == 3 and len(nube.t["ranchos"]) == 1, {k: len(v) for k, v in nube.t.items() if v})
    p1, p2, p3 = P["PARCELA UNO"]["id"], P["PARCELA DOS"]["id"], P["PARCELA TRES"]["id"]
    fn = json.dumps(nube.t["parcelas"][p1])
    caso("la foto de la parcela no viaja dentro del registro: en la nube va sólo su referencia", "data:image" not in fn and "archivo:" in fn and str(P["PARCELA UNO"].get("foto") or "").startswith("archivo:"), fn[:300])

    # ══ 2. Cultivos y variedades: ya no hace falta una hoja de Excel ══
    ir(A, "variedades"); t = cuerpo(A)
    caso("sin cultivos, la pantalla ofrece darlos de alta ahí mismo", "Todavía no hay cultivos" in t and A.get_by_role("button", name="Nuevo cultivo").count() == 1, t[:300])
    A.get_by_role("button", name="Nuevo cultivo").click(); A.get_by_label("Nombre del cultivo").fill("Ajo"); A.get_by_role("button", name="Guardar cultivo").click(); A.wait_for_timeout(300)
    caso("un cultivo sin duración no se guarda, y dice para qué sirve el dato", len(datos(A)["cultivos"]) == 0 and "cuántos días dura" in cuerpo(A))
    A.get_by_label("Días de la siembra a la cosecha").fill("240"); A.get_by_role("button", name="Guardar cultivo").click(); A.wait_for_timeout(500)
    C0 = datos(A)["cultivos"]
    caso("el cultivo queda dado de alta y abre para ponerle variedades", len(C0) == 1 and C0[0]["nombre"] == "Ajo" and C0[0]["duracionDias"] == 240 and "Ajo · Variedades" in cuerpo(A), C0)
    for v in ("GARRA INVENTADA", "FRIO INVENTADO"):
        A.get_by_placeholder("Ej: Garra de tigre").fill(v); A.get_by_role("button", name="+ Agregar variedad").click(); A.wait_for_timeout(400)
    n0 = len(A.dialogos); A.get_by_placeholder("Ej: Garra de tigre").fill("garra inventada"); A.get_by_role("button", name="+ Agregar variedad").click(); A.wait_for_timeout(400)
    V = datos(A)["cultivos"][0]["variedades"]; foto(A, "02-variedades")
    caso("dos variedades, y la repetida no entra", [v["nombre"] for v in V] == ["GARRA INVENTADA", "FRIO INVENTADO"] and any("Ya existe una variedad" in d for d in A.dialogos[n0:]), [v["nombre"] for v in V])
    A.locator(".top-bar .btn-ghost").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Nuevo cultivo").click(); A.get_by_label("Nombre del cultivo").fill("AJO"); A.get_by_label("Días de la siembra a la cosecha").fill("200"); A.get_by_role("button", name="Guardar cultivo").click(); A.wait_for_timeout(300)
    caso("el mismo cultivo no se da de alta dos veces", len(datos(A)["cultivos"]) == 1 and "Ya está dado de alta" in cuerpo(A))
    subio(A)

    # ══ 3. Calendario: la siembra ══
    ir(A, "calendario"); fila = A.locator("tr", has_text="PARCELA UNO"); fila.locator("td").nth(9).click(); A.wait_for_timeout(500)   # septiembre
    A.get_by_role("button", name="Asignar cultivo").last.click(); A.wait_for_timeout(300)
    caso("sin escoger cultivo no se siembra nada", len(datos(A)["siembras"]) == 0 and any("Elige un cultivo" in d for d in A.dialogos))
    campo(A, "Cultivo").select_option(index=1); A.wait_for_timeout(400); t = cuerpo(A)
    caso("al escoger el cultivo dice cómo se va a llamar la temporada y cuándo se estima la cosecha", 'Se nombrará "Ajo 2027"' in t and "cosecha estimada 2027-04-29" in t, t[-600:])
    campo(A, "Variedad").select_option(label="GARRA INVENTADA"); campo(A, "Superficie de esta siembra").fill("3.5")
    A.get_by_role("button", name="Asignar cultivo").last.click(); A.wait_for_timeout(700); S = datos(A)["siembras"]; foto(A, "03-calendario")
    caso("la siembra queda con su parcela, cultivo, variedad, superficie y fechas", len(S) == 1 and S[0]["parcelaId"] == p1 and S[0]["cultivoId"] == C0[0]["id"] and S[0]["variedadNombre"] == "GARRA INVENTADA" and S[0]["fechaSiembra"] == "2026-09-01" and S[0]["fechaCosechaEstimada"] == "2027-04-29" and S[0]["superficie"] == 3.5 and S[0]["estado"] == "activa", S)
    t = cuerpo(A)
    caso("el calendario la pinta desde septiembre y la enseña en el progreso de los cultivos", "Ajo 2027" in t and "PARCELA UNO" in t and "Sin cultivos activos" not in t, t[:500])
    ir(A, "variedades"); A.locator(".card", has_text="Ajo").first.click(); A.wait_for_timeout(300); n0 = len(A.dialogos)
    A.locator(".card", has_text="GARRA INVENTADA").get_by_text("quitar").click(); A.wait_for_timeout(400)
    caso("una variedad que ya está sembrada no se quita", len(datos(A)["cultivos"][0]["variedades"]) == 2 and any("ya está en 1 siembra" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    A.locator(".card", has_text="FRIO INVENTADO").get_by_text("quitar").click(); A.wait_for_timeout(400)
    caso("una que no se ha usado sí se puede quitar", [v["nombre"] for v in datos(A)["cultivos"][0]["variedades"]] == ["GARRA INVENTADA"])

    # ══ 4. Estado de parcelas y comparación ══
    ir(A, "panel-parcelas"); t = cuerpo(A)
    caso("Estado de parcelas enseña la parcela con su temporada", "PARCELA UNO" in t and "Ajo 2027" in t, t[:400])
    A.locator(".card", has_text="PARCELA UNO").first.click(); A.wait_for_timeout(500); t = cuerpo(A); foto(A, "04-estado-de-parcela")
    caso("su detalle dice en qué día del ciclo va y cuándo se sembró", "Día 79 del ciclo" in t and "Sembrado 2026-09-01" in t and "3.5 ha" in t, t[:500])
    subio(A)

    # ══ 5. Cosechas: lo anotan dos personas, cada una en su teléfono ══
    ir(A, "equipo")
    for nombre, pin in (("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102")):
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("400"); campo(A, "PIN de acceso").fill(pin); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    subio(A)
    def abre_cosecha(pg, parcela): ir(pg, "cosechas"); pg.locator(".card", has_text=parcela).first.click(); pg.wait_for_timeout(400)
    def registra(pg, parcela, quien, kg, nota=""):
        abre_cosecha(pg, parcela); pg.get_by_role("button", name="+ Registro").click(); pg.wait_for_timeout(300)
        if quien: sel = campo(pg, "Quién cosechó"); sel.select_option(label=next(o for o in sel.locator("option").all_inner_texts() if quien in o))
        if kg: campo(pg, "Cantidad cosechada").fill(str(kg))
        if nota: campo(pg, "Nota").fill(nota)
        pg.get_by_role("button", name="Guardar registro").click(); pg.wait_for_timeout(600)
    n0 = len(A.dialogos); registra(A, "PARCELA UNO", "ANA", "")
    caso("sin cantidad no se anota cosecha", len(datos(A)["cosechas"]) == 0 and any("Indica la cantidad" in d for d in A.dialogos[n0:]))
    n0 = len(A.dialogos); registra(A, "PARCELA UNO", "", 700)
    caso("sin decir quién cosechó tampoco", len(datos(A)["cosechas"]) == 0 and any("quién cosechó" in d for d in A.dialogos[n0:]))
    registra(A, "PARCELA UNO", "ANA", 700, "PRIMER CORTE INVENTADO"); t = cuerpo(A); cos = datos(A)["cosechas"]
    caso("anotados 700 kg: total, rendimiento por hectárea (700 ÷ 3.5 = 200) y quién lo cosechó", len(cos) == 1 and "700 kg" in t and "200 kg" in t and "ANA INVENTADA" in t, t[:600])
    caso("el registro de cosecha de la parcela tiene identidad propia (es EL de esa parcela)", cos[0]["id"] == f"cos-{p1}" and cos[0]["parcelaId"] == p1 and not cos[0].get("_nace"), [cos[0]["id"], cos[0].get("_nace")])
    n0 = len(A.dialogos); A.get_by_role("button", name="Ajustar").click(); A.wait_for_timeout(300); campo(A, "Ajuste").fill("-50"); A.get_by_role("button", name="Aplicar ajuste").click(); A.wait_for_timeout(400)
    caso("un ajuste sin motivo no se aplica", not datos(A)["cosechas"][0].get("ajustes") and any("motivo del ajuste" in d for d in A.dialogos[n0:]))
    campo(A, "Motivo del ajuste").fill("TIERRA EN LA BASCULA INVENTADA"); A.get_by_role("button", name="Aplicar ajuste").click(); A.wait_for_timeout(600); t = cuerpo(A); aj = datos(A)["cosechas"][0]["ajustes"]
    caso("con motivo, el ajuste baja el total (650 kg) y queda con quién lo hizo y por qué", "650 kg" in t and len(aj) == 1 and aj[0]["delta"] == -50 and aj[0]["motivo"] == "TIERRA EN LA BASCULA INVENTADA" and aj[0]["ajustadoPor"]["nombre"] == "ADMIN DE PRUEBA" and "TIERRA EN LA BASCULA" in t, [t[:300], aj])
    foto(A, "05-cosecha"); subio(A)
    B = aparato(ENC, "09:00"); hora(B); al_dia(A)
    caso("el encargado ve la cosecha en su teléfono", "650 kg" in (abre_cosecha(B, "PARCELA UNO") or cuerpo(B)), cuerpo(B)[:300])
    # los dos sin señal: más cosecha en la parcela uno, y la PRIMERA cosecha de la parcela dos
    nube.caida = True
    registra(A, "PARCELA UNO", "ANA", 300, "SEGUNDO CORTE A"); registra(B, "PARCELA UNO", "BETO", 450, "SEGUNDO CORTE B")
    registra(A, "PARCELA DOS", "ANA", 1000, "PRIMERA DE LA DOS, A"); registra(B, "PARCELA DOS", "BETO", 600, "PRIMERA DE LA DOS, B")
    caso("sin señal cada teléfono ve lo suyo", "950 kg" in (abre_cosecha(A, "PARCELA UNO") or cuerpo(A)) and "1,100 kg" in (abre_cosecha(B, "PARCELA UNO") or cuerpo(B)), [cuerpo(A)[:200], cuerpo(B)[:200]])
    nube.caida = False
    for pg in (A, B): avanza(pg, 2 / 60); subio(pg)
    for pg in (A, B): al_dia(pg)
    for pg in (A, B): al_dia(pg)
    def kilos(pg, pid): c = [x for x in datos(pg)["cosechas"] if x["parcelaId"] == pid]; return (len(c), sum(r["cantidad"] for x in c for r in x.get("registros", [])), sorted(r["nota"] for x in c for r in x.get("registros", [])))
    caso("PARCELA UNO: ningún registro se pisó — 700 + 300 + 450 en los dos teléfonos, y el ajuste sigue", kilos(A, p1) == kilos(B, p1) and kilos(A, p1)[:2] == (1, 1450) and len(next(x for x in datos(B)["cosechas"] if x["parcelaId"] == p1)["ajustes"]) == 1, [kilos(A, p1), kilos(B, p1)])
    caso("PARCELA DOS: la primera cosecha anotada por los dos a la vez quedó en UN registro de la parcela, con los dos cortes (1,600 kg)", kilos(A, p2) == kilos(B, p2) and kilos(A, p2)[:2] == (1, 1600), [kilos(A, p2), kilos(B, p2)])
    caso("en la nube hay una cosecha por parcela, no más", sorted(nube.t["cosechas"].keys()) == sorted([f"cos-{p1}", f"cos-{p2}"]), list(nube.t["cosechas"].keys()))
    abre_cosecha(A, "PARCELA UNO"); t = cuerpo(A)
    caso("la pantalla enseña el total unido menos el ajuste: 1,400 kg y 400 kg por hectárea", "1,400 kg" in t and "400 kg" in t and "BETO INVENTADO" in t and "ANA INVENTADA" in t, t[:500])
    ir(A, "contabilidad"); A.get_by_role("button", name="+ Movimiento").click(); A.wait_for_timeout(200); A.locator(".option-card", has_text="Registrar Egreso").click(); A.wait_for_timeout(300)
    campo(A, "Concepto").fill("RIEGO INVENTADO"); campo(A, "Monto").fill("2800"); campo(A, "Parcela / cultivo afectado").select_option(p1); A.locator("button.btn-accent", has_text="Guardar").last.click(); A.wait_for_timeout(600)
    abre_cosecha(A, "PARCELA UNO"); t = cuerpo(A)
    caso("un gasto capturado en Finanzas para la parcela llega a su cosecha: $2,800 de costo directo, $2 por kilo", "$2,800" in t and "Producir cada kilo costó $2" in t, t[:500])
    # apartar semilla y mandar a bodega: salen de lo disponible, nunca más de lo que hay
    n0 = len(A.dialogos); A.get_by_role("button", name="Semilla").click(); A.wait_for_timeout(300); campo(A, "Cantidad para semilla").fill("5000"); A.get_by_role("button", name="Apartar como semilla").click(); A.wait_for_timeout(400)
    caso("no se aparta más semilla de la que hay disponible", not next(x for x in datos(A)["cosechas"] if x["parcelaId"] == p1).get("usosSemilla") and any("Solo hay 1,400 kg disponibles" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    campo(A, "Cantidad para semilla").fill("100"); A.get_by_role("button", name="Apartar como semilla").click(); A.wait_for_timeout(700)
    sem = [i for i in datos(A)["inventario"] if i.get("cat") == "semilla"]; t = cuerpo(A)
    caso("100 kg apartados como semilla entran al almacén a su costo ($2 el kilo) y bajan lo disponible a 1,300", len(sem) == 1 and sem[0]["nombre"] == "Semilla de Ajo" and sem[0]["existencia"] == 100 and sem[0]["costo_unit"] == 2 and "1,300 kg" in t, [sem, t[400:800]])
    n0 = len(A.dialogos); A.get_by_role("button", name="A bodega").click(); A.wait_for_timeout(300); campo(A, "Cantidad a enviar").fill("300"); campo(A, "Costo de transporte").fill("150"); A.get_by_role("button", name="Registrar envío a bodega").click(); A.wait_for_timeout(700)
    env = datos(A).get("envios_bodega") or []; t = cuerpo(A)
    caso("300 kg mandados a la bodega: queda el envío con su costo (300 × $2 + $150 de transporte) y lo disponible baja a 1,000", len(env) == 1 and env[0]["cantidad"] == 300 and env[0]["costoTotal"] == 750 and env[0]["parcelaId"] == p1 and "1,000 kg" in t, [env, t[400:800]])
    ir(A, "inventario"); t = cuerpo(A)
    caso("la semilla apartada se ve en el Inventario", "Semilla de Ajo" in t and "100" in t, t[:500])
    ir(A, "cosechas"); t = cuerpo(A); foto(A, "06-cosechas")
    caso("la lista de cosechas enseña cada parcela con lo suyo y la que no tiene", "1,400 kg" in t and "1,600 kg" in t and "Sin cosecha" in t, t[:500])
    ir(A, "reporte-variedades"); t = cuerpo(A); foto(A, "07-comparar-variedades")
    caso("Comparar variedades enseña la variedad sembrada con su parcela y su rendimiento", "GARRA INVENTADA" in t and "PARCELA UNO" in t and "Rendimiento: 1,400 kg" in t and "1,450" not in t and "Costo directo: $2,800" in t, t[:600])

    # un registro de cosecha no se borra: se cancela con motivo, y no revive al sincronizar
    abre_cosecha(A, "PARCELA DOS"); n0 = len(A.dialogos); A.respuesta = "  "
    A.get_by_role("button", name=re.compile("Cancelar el registro de 600")).click(); A.wait_for_timeout(400)
    caso("cancelar un registro de cosecha sin decir por qué no hace nada", kilos(A, p2)[1] == 1600 and not any(r.get("cancelado") for r in datos(A)["cosechas"][1].get("registros", []) + datos(A)["cosechas"][0].get("registros", [])) and any("hay que decir por qué" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    A.respuesta = "SE ANOTO DOS VECES INVENTADO"; A.get_by_role("button", name=re.compile("Cancelar el registro de 600")).click(); A.wait_for_timeout(700); t = cuerpo(A)
    c2 = next(x for x in datos(A)["cosechas"] if x["parcelaId"] == p2); can = [r for r in c2["registros"] if r.get("cancelado")]
    caso("con motivo se cancela: deja de contar (1,000 kg), sigue a la vista tachado con quién y por qué", "1,000 kg" in t and len(c2["registros"]) == 2 and len(can) == 1 and can[0]["cancelado"]["motivo"] == "SE ANOTO DOS VECES INVENTADO" and can[0]["cancelado"]["por"] == "ADMIN DE PRUEBA" and "No cuenta" in t, [t[300:700], can])
    A.respuesta = "MOTIVO INVENTADO"; subio(A); al_dia(B); al_dia(A)
    vivos = lambda pg, pid: sum(r["cantidad"] for x in datos(pg)["cosechas"] if x["parcelaId"] == pid for r in x.get("registros", []) if not r.get("cancelado"))
    caso("el otro teléfono (que lo tenía vivo) lo recibe cancelado, y al volver a sincronizar NO revive en ninguno", vivos(A, p2) == vivos(B, p2) == 1000, [vivos(A, p2), vivos(B, p2)])

    # ══ 5b. Otra variedad en otra parcela, con semilla comprada; y se da por cosechada ══
    ir(A, "variedades"); A.locator(".card", has_text="Ajo").first.click(); A.wait_for_timeout(300); A.get_by_placeholder("Ej: Garra de tigre").fill("ACELERADO INVENTADO"); A.get_by_role("button", name="+ Agregar variedad").click(); A.wait_for_timeout(400)
    ir(A, "calendario"); A.locator("tr", has_text="PARCELA DOS").locator("td").nth(10).click(); A.wait_for_timeout(500)   # octubre
    campo(A, "Cultivo").select_option(index=1); A.wait_for_timeout(300); campo(A, "Variedad").select_option(label="ACELERADO INVENTADO"); campo(A, "Origen de la semilla").select_option(label="Comprada"); A.wait_for_timeout(300)
    campo(A, "Proveedor").fill("SEMILLERA INVENTADA") if campo(A, "Proveedor").count() else None
    A.get_by_role("button", name="Asignar cultivo").last.click(); A.wait_for_timeout(700)
    s2 = next(x for x in datos(A)["siembras"] if x["parcelaId"] == p2)
    caso("segunda siembra en otra parcela, con su variedad y de dónde salió la semilla", s2["variedadNombre"] == "ACELERADO INVENTADO" and s2["semilla"]["origen"] == "comprada" and s2["fechaSiembra"] == "2026-10-01", s2)
    ir(A, "reporte-variedades"); t = cuerpo(A); foto(A, "07b-comparar-dos-variedades")
    caso("Comparar variedades pone las dos lado a lado, cada una con su parcela y lo suyo (1,000 kg la segunda, sin costo)", "GARRA INVENTADA" in t and "ACELERADO INVENTADO" in t and "Rendimiento: 1,400 kg" in t and "Rendimiento: 1,000 kg" in t, t[:900])
    ir(A, "calendario"); A.locator(".card", has_text="PARCELA DOS").last.click(); A.wait_for_timeout(500); t = cuerpo(A)
    caso("el detalle de la siembra dice su variedad y su semilla", "ACELERADO INVENTADO" in t and "Comprada" in t and "Marcar como cosechada" in t, t[:600])
    n0 = len(A.dialogos); A.respuesta = "mañana"; A.get_by_role("button", name="Marcar como cosechada").click(); A.wait_for_timeout(400)
    caso("una fecha de cosecha mal escrita no se acepta", next(x for x in datos(A)["siembras"] if x["parcelaId"] == p2)["estado"] == "activa" and any("AAAA-MM-DD" in d and "por ejemplo" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    A.respuesta = "2026-09-15"; A.get_by_role("button", name="Marcar como cosechada").click(); A.wait_for_timeout(400)
    caso("ni una cosecha anterior a la siembra", next(x for x in datos(A)["siembras"] if x["parcelaId"] == p2)["estado"] == "activa" and any("no puede ser antes de la siembra" in d for d in A.dialogos[n0:]))
    A.respuesta = HOY; A.get_by_role("button", name="Marcar como cosechada").click(); A.wait_for_timeout(600); s2 = next(x for x in datos(A)["siembras"] if x["parcelaId"] == p2)
    caso("con la fecha bien, la siembra queda cosechada con su fecha real", s2["estado"] == "finalizada" and s2["fechaCosechaReal"] == HOY, s2)
    A.respuesta = "MOTIVO INVENTADO"; subio(A)

    # ══ 6. Lo que ya tiene registros no se elimina ══
    ir(A, "parcelas"); A.locator(".list-item", has_text="PARCELA UNO").click(); A.wait_for_timeout(400); n0 = len(A.dialogos)
    A.get_by_role("button", name="Eliminar Parcela").click(); A.wait_for_timeout(500)
    caso("una parcela con siembra y cosecha no se elimina, y dice qué tiene", len(datos(A)["parcelas"]) == 3 and any("No se puede eliminar" in d and "siembras" in d and "cosechas" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    A.get_by_role("button", name="‹ Volver").click(); A.wait_for_timeout(300)
    A.locator(".list-item", has_text="PARCELA TRES").click(); A.wait_for_timeout(400); A.get_by_role("button", name="Eliminar Parcela").click(); A.wait_for_timeout(700)
    caso("una parcela sin nada registrado sí se elimina", [x["nombre"] for x in datos(A)["parcelas"]] == ["PARCELA UNO", "PARCELA DOS"] or sorted(x["nombre"] for x in datos(A)["parcelas"]) == ["PARCELA DOS", "PARCELA UNO"], [x["nombre"] for x in datos(A)["parcelas"]])
    A.get_by_role("button", name="Nuevo rancho").click(); A.wait_for_timeout(300); n0 = len(A.dialogos)
    A.locator(".list-item", has_text="RANCHO INVENTADO").locator("button").last.click(); A.wait_for_timeout(400)
    caso("un rancho con parcelas no se elimina", len(datos(A)["ranchos"]) == 1 and any("tiene 2 parcelas" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    subio(A); al_dia(B)
    caso("la parcela eliminada también desaparece del otro teléfono, y las demás siguen", sorted(x["nombre"] for x in datos(B)["parcelas"]) == ["PARCELA DOS", "PARCELA UNO"], [x["nombre"] for x in datos(B)["parcelas"]])

    # ══ 7. Otros perfiles ══
    G = aparato(AGR, "12:00"); hora(G)
    ir(G, "variedades"); G.get_by_role("button", name="Nuevo cultivo").click(); G.get_by_label("Nombre del cultivo").fill("Chile"); G.get_by_label("Días de la siembra a la cosecha").fill("150"); G.get_by_role("button", name="Guardar cultivo").click(); G.wait_for_timeout(500)
    ok = subio(G)
    caso("el agrónomo da de alta un cultivo y sube a la nube", ok and sorted(c["nombre"] for c in datos(G)["cultivos"]) == ["Ajo", "Chile"] and len(nube.t["cultivos"]) == 2, list(nube.t["cultivos"].keys()))
    ir(G, "panel-parcelas"); t = cuerpo(G)
    caso("el agrónomo ve el estado de las parcelas", "PARCELA UNO" in t and "Ajo 2027" in t, t[:300])
    ir(G, "parcelas"); ir(B, "calendario")
    caso("el agrónomo no tiene la pantalla de ranchos y parcelas, ni el encargado el calendario", "Ranchos & Parcelas" not in cuerpo(G) and "Calendario de cultivos" not in cuerpo(B), [cuerpo(G)[:120], cuerpo(B)[:120]])
    N2 = aparato(ADM, "13:00"); hora(N2)
    caso("un aparato recién entrado trae todo: rancho, dos parcelas, dos cultivos, las dos siembras y las dos cosechas", len(datos(N2)["ranchos"]) == 1 and len(datos(N2)["parcelas"]) == 2 and len(datos(N2)["cultivos"]) == 2 and len(datos(N2)["siembras"]) == 2 and kilos(N2, p1)[:2] == (1, 1450) and kilos(N2, p2)[:2] == (1, 1600) and vivos(N2, p2) == 1000, [len(datos(N2)[k]) for k in ("ranchos", "parcelas", "cultivos", "siembras", "cosechas")])

    caso("la base no rechazó ningún registro por identificador ocupado ni quedó nada sin subir", not nube.ocupados and subio(A), nube.ocupados[:4])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}")
sys.exit(0 if all(res) else 1)
