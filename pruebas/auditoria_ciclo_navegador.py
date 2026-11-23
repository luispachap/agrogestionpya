"""AUDITORÍA FUNCIONAL · EL CICLO DE UN CULTIVO CON SUS ETAPAS ESCRITAS EN LA APP: Operación («cosecha en curso»),
Estado de parcelas (avance por etapa y semáforos), Calendario (etapa actual, editar, no eliminar una siembra con
registros, semilla propia ligada a la temporada que se cosechó) y Aplicaciones (aplicadores, quién la indicó,
reentrada y carencia, el aviso de lo que no se sabe y el reporte). Cuentas, 390 px, nube de imitación, otro teléfono.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_ciclo_navegador.py"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); AGR = N.cuenta(3, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")
nube = N.Nube([ADM, AGR]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 40, **E}, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V},
                 "p2": {"id": "p2", "nombre": "PARCELA DOS", "rancho_id": "r1", "datos": {"hectareas": 3, "cultivo": "Cebolla", **E}, "actualizado": V}}
# El cultivo existe pero SIN etapas: se escriben en la app.
t["cultivos"] = {"cul_ceb": {"id": "cul_ceb", "nombre": "CEBOLLA INVENTADA", "datos": {"emoji": "🧅", "duracionDias": 160, "unidadCosecha": "kg", "variedades": [], **E}, "actualizado": V}}
# Sembrada el 2 de julio: el 19 de noviembre va en el día 140.
t["siembras"] = {"s2": {"id": "s2", "parcela_id": "p2", "cultivo_id": "cul_ceb", "estado": "activa", "datos": {"cultivoNombre": "CEBOLLA INVENTADA", "fechaSiembra": "2026-07-02", "fechaCosechaEstimada": "2026-12-09", "superficie": 3, **E}, "actualizado": V},
                 "s9": {"id": "s9", "parcela_id": "p1", "cultivo_id": "cul_ceb", "estado": "activa", "datos": {"cultivoNombre": "CEBOLLA INVENTADA", "fechaSiembra": "2027-03-01", "superficie": 1, "notas": "SEMBRADA POR ERROR", **E}, "actualizado": V}}
t["trabajadores"] = {i: {"id": i, "nombre": n, "pin": pin, "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V} for i, n, pin in (("t-ana", "ANA INVENTADA", "4101"), ("t-beto", "BETO INVENTADO", "4102"))}
t["inventario"] = {"i-con": {"id": "i-con", "nombre": "FUNGICIDA CON ETIQUETA", "cat": "agroquimico", "unidad": "L", "existencia": 20, "costo_unit": 100, "minimo": 0, "datos": {"reentradaDias": 2, "carenciaDias": 10, **E}, "actualizado": V},
                   "i-sin": {"id": "i-sin", "nombre": "FOLIAR SIN ETIQUETA", "cat": "nutricion", "unidad": "L", "existencia": 20, "costo_unit": 50, "minimo": 0, "datos": E, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(700))
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
campo = lambda pg, et: pg.locator(".form-group", has=pg.locator("label", has_text=et)).locator("input, select, textarea").first
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []; pg.respuesta = ""
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400]))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept(pg.respuesta) if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T10:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM)

    # ══ 1. Escribir las etapas del cultivo en la app ══
    ir(A, "variedades"); A.locator(".card", has_text="CEBOLLA INVENTADA").first.click(); A.wait_for_timeout(300)
    A.get_by_role("button", name="Escribir las etapas").click(); A.wait_for_timeout(200)
    A.get_by_label("Etapa 1", exact=True).fill("SIEMBRA"); A.get_by_label("Hasta el día, etapa 1").fill("20"); A.get_by_role("button", name="+ Otra etapa").click(); A.wait_for_timeout(100)
    A.get_by_label("Etapa 2", exact=True).fill("DESARROLLO"); A.get_by_label("Hasta el día, etapa 2").fill("130"); A.get_by_role("button", name="+ Otra etapa").click(); A.wait_for_timeout(100)
    A.get_by_label("Etapa 3", exact=True).fill("COSECHA"); A.get_by_label("Hasta el día, etapa 3").fill("160")
    A.get_by_role("button", name="Guardar etapas").click(); A.wait_for_timeout(500)
    cul = next(c for c in datos(A)["cultivos"] if c["id"] == "cul_ceb")
    caso("las etapas escritas en la app quedan en el cultivo: siembra 0–20, desarrollo 20–130, cosecha 130–160", [(e["etapa"], e["diaInicio"], e["diaFin"]) for e in cul.get("fenologia") or []] == [("SIEMBRA", 0, 20), ("DESARROLLO", 20, 130), ("COSECHA", 130, 160)], cul.get("fenologia"))
    subio(A)

    # ══ 2. Operación: la cebolla de la parcela dos va en el día 140 → cosecha en curso ══
    G = aparato(AGR); ir(G, "operacion"); tx = cuerpo(G)
    caso("OPERACIÓN: «Cosecha en curso» con la cebolla de la parcela dos, sin registro de cosecha aún", "Cosecha en curso" in tx and "CEBOLLA INVENTADA · PARCELA DOS" in tx and "Sin registro de cosecha aún" in tx, tx[:700])
    ir(A, "registrar-actividad"); A.get_by_text("ANA INVENTADA").first.click(); A.wait_for_timeout(400); A.get_by_text("PARCELA DOS").first.click(); A.wait_for_timeout(400)
    A.get_by_text("Cosecha", exact=True).first.click(); A.wait_for_timeout(250); campo(A, "Cantidad").fill("3000")
    A.get_by_role("button", name="Continuar →").click(); A.wait_for_timeout(500); A.get_by_role("button", name="✓ Registrar actividad").click(); A.wait_for_timeout(3300)
    subio(A); G.reload(); G.wait_for_timeout(3500); ir(G, "operacion"); tx = cuerpo(G)
    caso("con la cosecha anotada, Operación dice cuánto lleva recolectado (3,000 kg)", "3,000 kg recolectado" in tx, tx[:700])

    # ══ 3. Estado de parcelas: avance por etapa y semáforos ══
    ir(G, "panel-parcelas"); G.locator(".card", has_text="PARCELA DOS").first.click(); G.wait_for_timeout(500); tx = cuerpo(G)
    caso("ESTADO DE PARCELAS: día 140 del ciclo y las tres etapas escritas en la app, cada una con su semáforo", "Día 140 del ciclo" in tx and all(e in tx for e in ("SIEMBRA", "DESARROLLO", "COSECHA")) and "Realizado:" in tx and "Esperado:" in tx, tx[:1500])
    caso("las etapas que ya debieron pasar y nadie reportó salen con atraso (siembra y desarrollo esperadas al 100 %)", tx.count("Esperado: 100%") >= 2, tx[:1500])
    G.get_by_role("button", name="+ Reportar avance de esta fase").first.click(); G.wait_for_timeout(300)
    caso("y desde ahí se puede reportar el avance de una etapa", "avance" in cuerpo(G).lower(), cuerpo(G)[:300])

    # ══ 4. Calendario: etapa actual, editar, no eliminar con registros, eliminar la sembrada por error ══
    ir(A, "calendario"); A.locator(".card", has_text="PARCELA DOS").last.click(); A.wait_for_timeout(500); tx = cuerpo(A)
    caso("CALENDARIO: el detalle dice la etapa actual (COSECHA), el día 140 y el avance del ciclo", "Etapa actual del cultivo" in tx and "COSECHA" in tx and "Día 140 desde la siembra" in tx and "Avance del ciclo" in tx, tx[:900])
    A.get_by_role("button", name="Editar datos de la siembra").click(); A.wait_for_timeout(400)
    campo(A, "Superficie (ha)").fill("2.5"); A.get_by_role("button", name="Guardar cambios").click(); A.wait_for_timeout(600)
    caso("editar la siembra: la superficie queda en 2.5 ha", next(s for s in datos(A)["siembras"] if s["id"] == "s2").get("superficie") == 2.5, next(s for s in datos(A)["siembras"] if s["id"] == "s2"))
    if A.get_by_role("button", name="Eliminar siembra").count() == 0: A.locator(".card", has_text="PARCELA DOS").last.click(); A.wait_for_timeout(500)
    n0 = len(A.dialogos); A.get_by_role("button", name="Eliminar siembra").click(); A.wait_for_timeout(500)
    caso("una siembra con cosecha y actividades NO se elimina, y dice qué tiene", any(s["id"] == "s2" for s in datos(A)["siembras"]) and any("No se puede eliminar" in d and "registros de cosecha" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    ir(A, "calendario"); A.locator(".card", has_text="PARCELA UNO").last.click(); A.wait_for_timeout(500)
    n0 = len(A.dialogos); A.get_by_role("button", name="Eliminar siembra").click(); A.wait_for_timeout(600)
    caso("la que se sembró por error y no tiene nada sí se elimina (pregunta antes)", not any(s["id"] == "s9" for s in datos(A)["siembras"]) and any("No tiene nada registrado" in d for d in A.dialogos[n0:]), A.dialogos[n0:])

    # ══ 5. Semilla propia ligada a la temporada que se cosechó ══
    ir(A, "calendario"); A.locator("tr", has_text="PARCELA UNO").locator("td").nth(12).click(); A.wait_for_timeout(500)   # diciembre
    campo(A, "Cultivo").select_option("cul_ceb"); A.wait_for_timeout(300); campo(A, "Origen de la semilla").select_option("propia"); A.wait_for_timeout(300)
    ops = campo(A, "¿De qué cosecha?").locator("option").all_inner_texts()
    caso("SEMILLA PROPIA: ofrece la temporada que de verdad cosechó (parcela, cultivo, año y kilos), no «undefined · 0»", any("PARCELA DOS" in o and "CEBOLLA INVENTADA 2026" in o and "3,000 kg" in o for o in ops) and not any("undefined" in o for o in ops), ops)
    campo(A, "¿De qué cosecha?").select_option(index=1); campo(A, "Superficie de esta siembra").fill("1")
    A.get_by_role("button", name="Asignar cultivo").last.click(); A.wait_for_timeout(700)
    nueva = [s for s in datos(A)["siembras"] if s["parcelaId"] == "p1" and s["id"] != "s9"]
    caso("la siembra nueva queda ligada a esa cosecha Y a su temporada", len(nueva) == 1 and nueva[0]["semilla"]["origen"] == "propia" and nueva[0]["semilla"]["cosechaId"] and nueva[0]["semilla"].get("siembraId") == "s2", nueva[0].get("semilla") if nueva else None)
    A.locator(".card", has_text="PARCELA UNO").last.click(); A.wait_for_timeout(500); tx = cuerpo(A)
    caso("y su detalle lo dice: «Propia · PARCELA DOS · CEBOLLA INVENTADA 2026»", "Propia · PARCELA DOS · CEBOLLA INVENTADA 2026" in tx, tx[:800])
    n0 = len(A.dialogos); ir(A, "calendario"); A.locator(".card", has_text="PARCELA DOS").last.click(); A.wait_for_timeout(500); A.get_by_role("button", name="Eliminar siembra").click(); A.wait_for_timeout(400)
    caso("y la temporada de donde salió la semilla tampoco se puede eliminar por eso", any("siembras con su semilla" in d for d in A.dialogos[n0:]), A.dialogos[n0:])
    subio(A)

    # ══ 6. Aplicaciones: aplicadores, quién la indicó, reentrada y carencia, lo que no se sabe, el reporte ══
    ir(G, "aplicaciones"); G.get_by_role("button", name="+ Nueva").click(); G.wait_for_timeout(300)
    G.locator("select.inp").first.select_option("p2")
    campo(G, "Vincular a insumo del inventario").select_option("i-con"); G.wait_for_timeout(200); campo(G, "Dosis").fill("1")
    G.get_by_role("button", name="+ Agregar a la lista").click(); G.wait_for_timeout(300)
    for n in ("ANA INVENTADA", "BETO INVENTADO"): G.locator(".ap-quienes label", has_text=n).locator("input").check()
    G.get_by_label("Quién indicó la aplicación").select_option(index=1); indico = G.get_by_label("Quién indicó la aplicación").locator("option:checked").inner_text()
    G.get_by_role("button", name="Guardar aplicación").click(); G.wait_for_timeout(900)
    ap = datos(G)["aplicaciones"]
    q = (ap[0].get("quienes") or {}) if ap else {}
    caso("la aplicación queda con sus DOS aplicadores y quién la indicó, aparte de quién la registró", len(ap) == 1 and sorted(x["nombre"] for x in q.get("ejecutaron") or []) == ["ANA INVENTADA", "BETO INVENTADO"] and (q.get("ordeno") or {}).get("nombre") == indico.split(" (")[0] and (q.get("capturo") or {}).get("nombre") == "AGRONOMO DE PRUEBA", [q, indico])
    caso("y queda en la temporada que tenía la parcela ese día (la cebolla), no en lo anotado en la parcela", ap and ap[0].get("siembraId") == "s2" and ap[0].get("cultivo") == "CEBOLLA INVENTADA", [ap[0].get("siembraId"), ap[0].get("cultivo")] if ap else ap)
    if G.get_by_role("button", name="Guardar aplicación").count() == 0: G.get_by_role("button", name="+ Nueva").click(); G.wait_for_timeout(300)
    G.locator("select.inp").first.select_option("p2")
    campo(G, "Vincular a insumo del inventario").select_option("i-sin"); G.wait_for_timeout(200); campo(G, "Dosis").fill("1"); G.get_by_role("button", name="+ Agregar a la lista").click(); G.wait_for_timeout(300)
    G.locator(".ap-quienes label", has_text="ANA INVENTADA").locator("input").check(); G.get_by_role("button", name="Guardar aplicación").click(); G.wait_for_timeout(900)
    subio(G); A.reload(); A.wait_for_timeout(3500); ir(A, "home"); tx = cuerpo(A)
    caso("REENTRADA: el tablero dice en rojo NO ENTRAR a la parcela dos (2 días)", "No entrar a PARCELA DOS" in tx, tx[:1500])
    caso("CARENCIA: y aparte, en ámbar, NO CORTAR en la parcela dos (10 días)", "No cortar en PARCELA DOS" in tx, tx[:1500])
    ir(A, "inventario"); A.wait_for_timeout(300); fol = A.locator(".list-item", has_text="FOLIAR SIN ETIQUETA").first.inner_text()
    caso("LO QUE NO SE SABE va aparte, en el producto: al foliar le falta la reentrada (no dice que ya se puede)", "reentrada" in fol.lower() and "ya se puede" not in fol.lower(), fol)
    caso("quedan las dos aplicaciones", len(datos(G)["aplicaciones"]) == 2, len(datos(G)["aplicaciones"]))
    def abrir(producto):
        ir(G, "aplicaciones")
        for i in range(G.locator(".ap-fila").count()):
            G.locator(".ap-fila").nth(i).click(); G.wait_for_timeout(400)
            if producto in cuerpo(G): return cuerpo(G)
            G.locator(".top-bar .btn-ghost").first.click(); G.wait_for_timeout(300)
        return ""
    tx = abrir("FUNGICIDA CON ETIQUETA")
    caso("el detalle de la aplicación dice quién aplicó y quién la indicó", "ANA INVENTADA" in tx and "BETO INVENTADO" in tx and "La indicó" in tx and indico.split(" (")[0] in tx, tx[:900])
    caso("y ofrece el reporte para compartir", G.get_by_role("button", name="Generar reporte para compartir").count() == 1)
    G.get_by_role("button", name="Generar reporte para compartir").click(); G.wait_for_timeout(800)
    caso("generar el reporte no truena", not errs, errs[:1])
    # Cancelar (ya no se puede borrar): el foliar se capturó por error
    tx = abrir("FOLIAR SIN ETIQUETA")
    caso("una aplicación ya no tiene «Eliminar»: se cancela", G.get_by_role("button", name="Eliminar aplicación").count() == 0 and G.get_by_role("button", name="Cancelar aplicación").count() == 1, tx[-300:])
    ex0 = G.evaluate("() => window.__agroDatos.inventario.find(i => i.id === 'i-sin').existencia")
    G.respuesta = ""; G.get_by_role("button", name="Cancelar aplicación").click(); G.wait_for_timeout(500)
    caso("sin decir por qué no se cancela", not any(a.get("cancelado") for a in datos(G)["aplicaciones"]))
    tx = abrir("FOLIAR SIN ETIQUETA"); G.respuesta = "SE CAPTURÓ POR ERROR"; G.get_by_role("button", name="Cancelar aplicación").click(); G.wait_for_timeout(800)
    fo = [a for a in datos(G)["aplicaciones"] if any(p.get("insumoId") == "i-sin" for p in a.get("productos") or [])][0]
    eg = [e for e in datos(G)["egresos"] if e.get("aplicacionId") == fo["id"]]
    ex1 = G.evaluate("() => window.__agroDatos.inventario.find(i => i.id === 'i-sin').existencia")
    caso("cancelada con su porqué y quién: sigue en la lista, tachada", fo.get("cancelado") and fo.get("motivoCancelacion") == "SE CAPTURÓ POR ERROR" and fo.get("canceladoPor") == "AGRONOMO DE PRUEBA" and len(datos(G)["aplicaciones"]) == 2, fo)
    caso("el producto regresa al almacén (3 L) y su costo de $150 se cancela con el mismo porqué", ex1 - ex0 == 3 and len(eg) == 1 and eg[0].get("cancelado") and "SE CAPTURÓ POR ERROR" in eg[0].get("motivoCancelacion", ""), [ex0, ex1, eg])
    caso("y lo que regresó vuelve con el costo con que salió ($50 el litro), no sin precio", G.evaluate("() => { const e = window.__agroDatos.eventos.filter(x => x.tipo === 'alm_entrada' && x.datos.articuloId === 'i-sin'); return e.length ? e[e.length - 1].datos.costoUnit : null; }") == 50)

    # ══ 7. Otro teléfono ══
    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(G) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
