"""EL RECORRIDO DE ENTREGA: un día entero del rancho, de punta a punta, con cuentas, contra una nube de mentira ENTERA
(guarda y devuelve lo que se le sube) y con gente, parcelas e insumos INVENTADOS.
Alta de personal → asistencia → plan → reparto → cambio de actividad → incidencia → aplicación → inventario → salida →
cierre de la jornada → consultas. Y después lo que de verdad importa para entregar: cerrar sesión, recargar y abrir en
OTRO aparato, y que todo siga ahí, una sola vez, con los mismos costos y los mismos pagos.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/entrega_navegador.py"""
import json, pathlib, sys, datetime
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"
res = []; hallazgos = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
HOY = "2026-11-23"   # lunes
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin")
ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO CON CUENTA", "encargado")
OTRAS = {"dueno": N.cuenta(3, "direccion@prueba.invalid", "DIRECCION DE PRUEBA", "dueno"), "finanzas": N.cuenta(4, "finanzas@prueba.invalid", "FINANZAS DE PRUEBA", "finanzas"), "agronomo": N.cuenta(5, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")}
nube = N.Nube([ADM, ENC, *OTRAS.values()])
GENTE = [("ANA INVENTADA", "4101"), ("BETO INVENTADO", "4102"), ("CARO INVENTADA", "4103")]
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
def campo(pg, etiqueta): return pg.locator(".form-group", has=pg.locator("label", has_text=etiqueta)).locator("input, select, textarea").first
def entrar(pg, c):
    pg.get_by_placeholder("Tu correo o tu PIN").fill(c["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1")
    pg.get_by_role("button", name="Entrar").click()
    for _ in range(30):
        pg.wait_for_timeout(300)
        if pg.locator(".login-bg").count() == 0: return True
    return False
def foto(pg):
    """Lo que tiene que salir IGUAL después de cerrar sesión, recargar o abrir en otro aparato."""
    return pg.evaluate("""() => { const d = window.__agroDatos; const n = k => (d[k] || []).length;
      const dinero = l => Math.round((l || []).reduce((s, x) => s + (Number(x.costo ?? x.monto ?? x.costoTotal ?? 0) || 0), 0) * 100) / 100;
      const ev = (d.eventos || []); const porTipo = {}; for (const e of ev) porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
      return { trabajadores: n('trabajadores'), encargados: n('encargados'), ranchos: n('ranchos'), parcelas: n('parcelas'), inventario: n('inventario'),
        indicaciones: n('indicaciones'), incidencias: n('incidencias'), aplicaciones: n('aplicaciones'), actividades: n('actividades'), egresos: n('egresos'), ingresos: n('ingresos'),
        eventos: ev.length, porTipo, costoContable: dinero(d.actividadesContables), egresosMonto: dinero(d.egresos), nombres: (d.trabajadores || []).map(t => t.nombre).sort() }; }""")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(hora="06:30"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept()))
        pg.clock.install(time=f"{HOY}T{hora}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        return pg
    # La hora de la nube sigue a la del aparato que se está usando (los aparatos traen el reloj de la prueba, no el de hoy).
    reloj = {"ms": None}
    def tic():
        reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))

    # ══ 1. El administrador arma el rancho desde cero ══
    A = aparato(); hora(A)
    caso("el administrador entra con su cuenta a un rancho vacío", entrar(A, ADM) and foto(A)["trabajadores"] == 0)
    ir(A, "parcelas"); A.get_by_role("button", name="Nuevo rancho").click(); A.wait_for_timeout(300)
    campo(A, "Nombre del rancho").fill("RANCHO INVENTADO"); campo(A, "Hectáreas totales").fill("10"); A.get_by_role("button", name="Crear Rancho").click(); A.wait_for_timeout(500)
    for nombre, ha in (("PARCELA NORTE", "3"), ("PARCELA SUR", "2")):
        A.get_by_role("button", name="Nueva parcela").click(); A.wait_for_timeout(300)
        campo(A, "Rancho").select_option(label="RANCHO INVENTADO") if campo(A, "Rancho").evaluate("e => e.tagName") == "SELECT" else None
        campo(A, "Nombre de la parcela").fill(nombre); campo(A, "Cultivo principal").fill("Ajo"); campo(A, "Hectáreas").fill(ha)
        A.get_by_role("button", name="Crear Parcela").click(); A.wait_for_timeout(500)
    f = foto(A); caso("crea un rancho y dos parcelas", f["ranchos"] == 1 and f["parcelas"] == 2, f)
    ir(A, "equipo")
    for nombre, pin in GENTE:
        A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
        campo(A, "Nombre completo").fill(nombre); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill(pin)
        A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    f = foto(A); caso("da de alta a tres trabajadores", f["trabajadores"] == 3 and f["nombres"] == sorted(n for n, _ in GENTE), f["nombres"])
    # El alta revisa lo que después deja a la gente sin entrar
    A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(250)
    campo(A, "Nombre completo").fill("DANI INVENTADO"); campo(A, "Sueldo/día").fill("350"); campo(A, "PIN de acceso").fill("4101"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("un PIN que ya tiene otra persona no se guarda, y se dice de quién es", foto(A)["trabajadores"] == 3 and "ya lo tiene ANA INVENTADA" in (A.dialogos[-1] if A.dialogos else ""), A.dialogos[-1:])
    campo(A, "Nombre completo").fill(""); campo(A, "PIN de acceso").fill("4109"); A.get_by_role("button", name="Guardar").click(); A.wait_for_timeout(300)
    caso("sin nombre tampoco se guarda", foto(A)["trabajadores"] == 3 and "nombre" in A.dialogos[-1], A.dialogos[-1:])
    A.locator(".top-bar .btn-accent").click(); A.wait_for_timeout(200)
    caso("el sueldo del alta vale desde hoy: no sale como «estimado»", all((t.get("historialSueldo") or [{}])[0].get("desde") == HOY for t in datos(A)["trabajadores"]))
    caso("todo eso subió a la nube, una vez cada cosa", subio(A) and nube.cuantos().get("trabajadores") == 3 and nube.cuantos().get("parcelas") == 2 and nube.cuantos().get("ranchos") == 1, nube.cuantos())

    # ══ 2. El encargado, en SU teléfono y con SU cuenta ══
    B = aparato("06:50"); hora(B)
    caso("el encargado entra con su cuenta en otro aparato y le baja lo que el administrador dio de alta", entrar(B, ENC) and (B.wait_for_timeout(2500) or True) and foto(B)["trabajadores"] == 3 and foto(B)["parcelas"] == 2, foto(B))

    # ══ 3. Planea el día, hablado ══
    ir(B, "eldia"); B.locator(".tab-pill", has_text="Reparto").click(); B.wait_for_timeout(300)
    B.locator("textarea").first.fill("Hoy Ana y Beto van a la Parcela Norte a deshierbar. Caro va a la Parcela Sur a regar."); B.get_by_role("button", name="Ver el reparto").click(); B.wait_for_timeout(500)
    B.get_by_role("button", name="Mandarla").first.dblclick(); B.wait_for_timeout(500)      # un doble toque, como pasa de verdad
    while B.get_by_role("button", name="Mandarla").count(): B.get_by_role("button", name="Mandarla").first.click(); B.wait_for_timeout(400)
    f = foto(B)
    caso("el plan de hoy queda mandado: tres tareas, una por persona", f["indicaciones"] == 3, [(i.get("asignadoA"), i.get("parcelaId"), i.get("fecha"), i.get("estado")) for i in datos(B)["indicaciones"]])
    caso("y un doble toque no lo duplica", B.locator(".plan-ya-mandada").count() == 2 and "3 tarea(s) para 3 persona(s)" in B.locator(".plan-mandado").inner_text(), plano(B.locator(".plan-mandado").inner_text())[:160])

    # ══ 4. 7:00 — llegan, checan y se les reparte de verdad ══
    def teclea(pg, pin):
        for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
        pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(350)
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    avanza(B, 10 / 60); ir(B, "checador"); vistos = []
    for _, pin in GENTE: teclea(B, pin); vistos.append(plano(B.locator(".chk-aviso").inner_text())); B.clock.run_for(13000); B.wait_for_timeout(150)
    caso("los tres checan su entrada con PIN y cada quien ve a qué va", all(n in v for (n, _), v in zip(GENTE, vistos)) and "PARCELA NORTE" in vistos[0] and "PARCELA SUR" in vistos[2], vistos)
    ir(B, "reparto")
    for n in ("ANA INVENTADA", "BETO INVENTADO"): B.locator(".rep-ficha", has_text=n).click()
    B.get_by_label("Parcela").select_option(label="PARCELA NORTE") ; B.get_by_label("Qué van a hacer").select_option("Deshierbe"); B.get_by_role("button", name="Asignar desde ahorita").click(); B.wait_for_timeout(400)
    B.locator(".rep-ficha", has_text="CARO INVENTADA").click()
    B.get_by_label("Parcela").select_option(label="PARCELA SUR"); B.get_by_label("Qué van a hacer").select_option("Riego"); B.get_by_role("button", name="Asignar desde ahorita").click(); B.wait_for_timeout(400)
    f = foto(B); caso("quedan repartidos: dos en la Norte y una en la Sur", f["porTipo"].get("marca") == 3 and f["porTipo"].get("asignacion") == 2 and B.get_by_text("Sin asignar (").count() == 0, f["porTipo"])

    # ══ 5. 10:00 — cambio de actividad: Caro se va a la Norte ══
    avanza(B, 3); ir(B, "reparto")
    B.locator(".rep-ficha", has_text="CARO INVENTADA").click()
    B.get_by_label("Parcela").select_option(label="PARCELA NORTE"); B.get_by_label("Qué van a hacer").select_option("Deshierbe"); B.get_by_role("button", name="Asignar desde ahorita").click(); B.wait_for_timeout(400)
    f = foto(B); caso("el cambio es otra asignación, no una edición de la anterior", f["porTipo"].get("asignacion") == 3, f["porTipo"])

    # ══ 6. Una incidencia, dicha en Mensajes ══
    ir(B, "dictado"); B.get_by_label("Mensaje", exact=True).fill("Se descompuso la bomba del pozo."); B.get_by_role("button", name="Mandar").click(); B.wait_for_timeout(700)
    bur = B.locator(".msj-burbuja.mio", has_text="Se descompuso la bomba").first
    bur.locator("button[aria-label^='Guardar ']").first.click(); B.wait_for_timeout(600)
    f = foto(B); inc = datos(B)["incidencias"]
    caso("la incidencia queda guardada una vez, con quién la dijo", f["incidencias"] == 1 and "bomba" in (inc[0].get("desc") or ""), inc[:1])
    if B.locator(".msj-atras").count(): B.locator(".msj-atras").click(); B.wait_for_timeout(300)
    caso("lo del encargado subió a la nube con SU cuenta", subio(B) and nube.cuantos().get("incidencias") == 1 and all(r == "encargado" for t, i, r in nube.subidas if t in ("incidencias", "indicaciones")), nube.cuantos())

    # ══ 7. El administrador compra un insumo y registra una aplicación ══
    A.clock.fast_forward(int(4.5 * 3600 * 1000)); A.wait_for_timeout(500); hora(A); A.reload(); A.wait_for_timeout(2500)
    if A.locator(".login-bg").count(): entrar(A, ADM); A.wait_for_timeout(2500)
    A.wait_for_timeout(1500)
    f = foto(A); caso("al administrador le llega lo que hizo el encargado: plan, marcas, asignaciones e incidencia", f["indicaciones"] == 3 and f["incidencias"] == 1 and f["porTipo"].get("marca") == 3 and f["porTipo"].get("asignacion") == 3, f)
    ir(A, "compras-insumos"); campo(A, "Insumo").select_option(index=1); A.wait_for_timeout(300)
    campo(A, "Nombre del nuevo insumo").fill("FERTILIZANTE INVENTADO"); campo(A, "Cantidad").fill("20"); campo(A, "Costo total").fill("4000"); campo(A, "Proveedor").fill("PROVEEDOR INVENTADO")
    A.get_by_role("button", name="Registrar compra").click(); A.wait_for_timeout(700)
    f = foto(A); caso("la compra deja UN artículo con 20 de existencia y UN egreso de $4,000", f["inventario"] == 1 and f["egresos"] == 1 and f["egresosMonto"] == 4000, f)
    RES = "() => { const c = window.__agroCuentas(); const r = c.resultado; return JSON.parse(JSON.stringify({ ingresos: r.ingresos, egresos: r.egresos, utilidad: r.utilidad, produccion: r.produccion, generales: r.generales, inventario: r.inventario && { valor: r.inventario.valor, comprado: r.inventario.comprado }, llaves: Object.keys(r) })); }"
    r0 = A.evaluate(RES)
    ir(A, "aplicaciones"); A.get_by_role("button", name="+ Nueva").click(); A.wait_for_timeout(300)
    A.locator("select.inp").first.select_option(label=[o for o in A.locator("select.inp").first.locator("option").all_inner_texts() if "PARCELA NORTE" in o][0])
    sel = A.locator("select", has=A.locator("option", has_text="No descontar de inventario")); sel.select_option(index=2 if "──" in sel.locator("option").nth(1).inner_text() else 1); A.wait_for_timeout(200)
    A.locator('input[type="number"]').first.fill("2"); A.get_by_role("button", name="+ Agregar a la lista").click(); A.wait_for_timeout(200)
    A.get_by_label("Aplicó ANA INVENTADA").check(); A.get_by_role("button", name="Guardar aplicación").click(); A.wait_for_timeout(700)
    f = foto(A)
    r1 = A.evaluate(RES); con = [e for e in datos(A)["eventos"] if e["tipo"] == "alm_consumo"]
    caso("la aplicación queda una vez, con quien la aplicó, y descuenta 6 kg del almacén una sola vez", f["aplicaciones"] == 1 and len(con) == 1 and con[0]["datos"]["cantidad"] == 6 and [e["nombre"] for e in datos(A)["aplicaciones"][0]["quienes"]["ejecutaron"]] == ["ANA INVENTADA"], con[:1])
    gastos = {x["clave"]: x["monto"] for x in r1["produccion"] + r1["generales"]}
    caso("el insumo aplicado cuesta $1,200 UNA vez (no se suma además como consumo) y el almacén baja de $4,000 a $2,800", gastos["gastos"] == 1200 and gastos["insumos"] == 0 and gastos["consumo_general"] == 0 and r1["inventario"]["valor"] == 2800, [gastos, r1["inventario"]])
    caso("la compra para el almacén no es gasto: sigue en inventario", r0["inventario"]["valor"] == 4000 and {x["clave"]: x["monto"] for x in r0["generales"]}["gastos"] == 0)
    subio(A)

    # ══ 8. 15:00 — salen, y el encargado cierra la jornada ══
    avanza(B, 5); ir(B, "checador")
    nube.caida = True; antesEv = len(nube.t.get("eventos", {}))          # se va la señal justo a la salida
    for _, pin in GENTE: teclea(B, pin); B.clock.run_for(13000); B.wait_for_timeout(150)
    B.wait_for_timeout(2500); sinSubir = B.evaluate(COLA)
    caso("sin señal, las tres salidas se guardan en el teléfono y esperan (la nube no recibió nada)", sinSubir >= 3 and len(nube.t.get("eventos", {})) == antesEv and foto(B)["porTipo"].get("marca") == 6, [sinSubir, antesEv])
    B.evaluate("() => window.__agroIr('home')"); B.wait_for_timeout(400); t = plano(B.locator("body").inner_text())
    caso("y la app lo dice en pantalla", "3 registro(s)" in t or "sin subir" in t.lower(), t[:300])
    nube.caida = False; B.evaluate("() => window.dispatchEvent(new Event('online'))")
    caso("al volver la señal suben solas, una vez cada una", subio(B, 60) and len(nube.t.get("eventos", {})) == antesEv + 3, [B.evaluate(COLA), len(nube.t.get("eventos", {})), antesEv])
    ir(B, "checador")
    f = foto(B); caso("los tres checan su salida: seis marcas, ni una de más", f["porTipo"].get("marca") == 6, f["porTipo"])
    caso("al encargado le llegó la aplicación y el artículo del almacén SIN salir ni volver a entrar", f["aplicaciones"] == 1 and f["inventario"] == 1, f)
    ir(B, "eldia"); B.get_by_role("button", name="Jornada").click(); B.wait_for_timeout(600)
    t = B.locator(".jornada").inner_text()
    caso("la jornada compara el plan con lo que pasó: tres tareas, las tres con trabajo registrado", "De 3 tarea(s) mandadas" in t and "3 con trabajo registrado" in t, plano(t)[:200])
    if B.get_by_label("Nota del cierre").count(): B.get_by_label("Nota del cierre").fill("Día normal; se descompuso la bomba del pozo")
    B.get_by_role("button", name="Cerrar la jornada").click(); B.wait_for_timeout(600)
    f = foto(B); caso("el encargado cierra la jornada: una foto, una vez", f["porTipo"].get("cierre_jornada") == 1 and "quedó cerrada" in B.locator(".jornada-dice").inner_text(), f["porTipo"])
    caso("todo lo del día subió", subio(B), B.evaluate(COLA))
    fB = foto(B)

    # ══ 9. Consultas: lo que el día dejó en costos y en pagos ══
    A.clock.fast_forward(int(4.5 * 3600 * 1000)); A.wait_for_timeout(300); hora(A); A.reload(); A.wait_for_timeout(3500)
    fA = foto(A); rA = A.evaluate(RES); mo = {x["clave"]: x["monto"] for x in rA["produccion"]}
    caso("al administrador le llega el día completo, igual que lo dejó el encargado", {k: v for k, v in fA.items() if k != "encargados"} == {k: v for k, v in fB.items() if k != "encargados"}, [fA["porTipo"], fB["porTipo"]])
    caso("la mano de obra del día son tres días de $350: $1,050, ni un peso más", round(mo["mo"] + mo["personal"], 2) == 1050 and fA["costoContable"] == fB["costoContable"], [mo, fA["costoContable"], fB["costoContable"]])
    porParcela = A.evaluate("() => { const d = window.__agroDatos; const s = {}; for (const a of d.actividadesContables || []) { const p = (d.parcelas.find(x => x.id === a.parcelaId) || {}).nombre || 'sin parcela'; s[p] = Math.round(((s[p] || 0) + (a.costoMO || 0)) * 100) / 100; } return s; }")
    caso("y cada parcela carga lo suyo: Caro trabajó 3 h en la Sur y 5 h en la Norte, y su día se reparte así", 130 <= porParcela.get("PARCELA SUR", 0) <= 133 and 916 <= porParcela.get("PARCELA NORTE", 0) <= 920 and set(porParcela) == {"PARCELA NORTE", "PARCELA SUR"}, porParcela)
    ir(A, "nomina"); A.wait_for_timeout(600); t = plano(A.locator("body").inner_text())
    caso("Pagos al personal dice lo mismo: $350 a cada quien, $1,050 en total, nada entregado todavía", t.count("le corresponde") == 3 and "TOTAL A PAGAR | $1,050" in t and t.count("Pendiente | $350") == 3, t[200:700])
    # Pagarle a Ana: un pago no es costo, y lo valida la base con la cuenta de quien paga
    A.locator(".card", has_text="ANA INVENTADA").last.get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(300)
    A.get_by_label("Cuánto se entregó ($)").fill("350"); A.locator(".modal-sheet").get_by_role("button", name="Registrar pago").click(); A.wait_for_timeout(1800)
    t = plano(A.locator(".card", has_text="ANA INVENTADA").last.inner_text()); pagos = [e for e in datos(A)["eventos"] if e["tipo"] == "pago_personal"]
    caso("el pago a Ana queda registrado y AUTORIZADO por la base: entregado $350, pendiente $0", len(pagos) == 1 and pagos[0].get("_validacion") == "autorizado", pagos[0].get("_validacion") if pagos else None)
    caso("y se ve en pantalla", "Entregado | $350" in t and "Pendiente | $0" in t, t[:220])
    rP = A.evaluate(RES)
    caso("pagar no cambió ningún costo: el resultado es el mismo que antes de pagar", rP == rA, [rP["egresos"], rA["egresos"]])
    subio(A); fA = foto(A); rA = rP
    ir(A, "jornadas"); t = plano(A.locator("body").inner_text())
    caso("Jornadas enseña a los tres con sus ocho horas", "VINIERON | 3" in t and t.count("en el rancho") == 3, t[:300])
    ir(A, "aplicaciones"); t = plano(A.locator("body").inner_text())
    caso("la aplicación se puede consultar, con su parcela", "PARCELA NORTE" in t and "Sin aplicadores identificados" not in t, t[:300])

    # ══ 10. Lo que importa para entregar: que siga ahí ══
    antes = nube.cuantos(); nsub = len(nube.subidas)
    A.evaluate("p => window.__agroIr(p)", "home"); A.wait_for_timeout(300); A.get_by_role("button", name="Salir").first.click()
    for _ in range(20):
        A.wait_for_timeout(400)
        if A.locator(".login-bg").count(): break
    caso("al cerrar sesión se vuelve a pedir la entrada", A.locator(".login-bg").count() == 1, A.dialogos[-1:])
    entrar(A, ADM); A.wait_for_timeout(3500); f2 = foto(A); r2 = A.evaluate(RES)
    caso("al volver a entrar todo sigue igual: mismos registros, mismos costos", f2 == fA and r2 == rA, [k for k in fA if fA[k] != f2.get(k)])
    A.reload(); A.wait_for_timeout(3500); f3 = foto(A)
    caso("al recargar la página, también", f3 == fA, [k for k in fA if fA[k] != f3.get(k)])
    C = aparato("19:40"); entrar(C, ADM); C.wait_for_timeout(4500); f4 = foto(C); r4 = C.evaluate(RES)
    ir(C, "nomina"); C.wait_for_timeout(600); t = plano(C.locator(".card", has_text="ANA INVENTADA").last.inner_text())
    caso("y en ese aparato nuevo el pago a Ana sale igual: entregado $350, pendiente $0, una sola vez", "Entregado | $350" in t and "Pendiente | $0" in t and len([e for e in datos(C)["eventos"] if e["tipo"] == "pago_personal"]) == 1, t[:220])
    caso("en un aparato NUEVO, que nunca había abierto la app, baja exactamente lo mismo", f4 == fA and r4 == rA, [(k, fA[k], f4.get(k)) for k in fA if fA[k] != f4.get(k)] or [r4["egresos"], rA["egresos"]])
    caso("entrar, salir, recargar y abrir en otro aparato no volvió a subir ni duplicó nada en la nube", nube.cuantos() == antes and len(nube.subidas) == nsub, [nube.cuantos(), antes, [x for x in nube.subidas[nsub:]][:6]])
    ids = {}
    for t_, i, _ in nube.subidas: ids.setdefault(t_, set()).add(i)
    d = datos(C); unicos = lambda l, k: len({json.dumps(k(x), sort_keys=True) for x in l}) == len(l)
    caso("nada quedó dos veces: una tarea por persona, una marca por momento, una asignación por momento", unicos(d["indicaciones"], lambda x: [x["asignadoA"], x["fecha"], x["parcelaId"]]) and unicos([e for e in d["eventos"] if e["tipo"] == "marca"], lambda e: [e["datos"].get("trabajadorId") or e["datos"].get("personaId") or e["datos"], e["cuando"]]) and unicos(d["trabajadores"], lambda x: x["nombre"]))

    # ══ Todas las pantallas del administrador, con los datos del día y con el rancho VACÍO (como está hoy producción) ══
    import subprocess
    PANTALLAS = json.loads(subprocess.run(["node", "-e", "import('./src/menu.js').then(m => console.log(JSON.stringify(m.PANTALLAS_DE)))"], cwd=pathlib.Path(__file__).parent.parent, capture_output=True, text=True).stdout)
    def recorre(pg, paginas):
        malas = []
        for pagina in paginas:
            n = len(errs); pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(120); pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(450)
            if pg.get_by_text("Algo salió mal").count() or len(errs) > n or len(pg.locator("body").inner_text().strip()) < 20: malas.append((pagina, errs[n:n + 1]))
        pg.evaluate("p => window.__agroIr(p)", "home"); pg.wait_for_timeout(200)
        return malas
    malas = recorre(C, PANTALLAS["admin"])
    caso(f"las {len(PANTALLAS['admin'])} pantallas del administrador abren con los datos del día, sin tronar", not malas, malas[:4])
    for rol, c in {**OTRAS, "encargado": ENC}.items():
        P = aparato("19:45"); ok = entrar(P, c); P.wait_for_timeout(3000); nsub = len(nube.subidas)
        malas = recorre(P, PANTALLAS[rol]) if ok else [("no entró", [])]
        caso(f"{rol}: entra con su cuenta y sus {len(PANTALLAS[rol])} pantallas abren con los datos del día", ok and not malas and foto(P)["trabajadores"] == 3, malas[:3])
        P.context.close()
    ADM2 = N.cuenta(6, "admin2@prueba.invalid", "OTRO ADMIN DE PRUEBA", "superadmin")
    vacia = N.Nube([ADM, ADM2]); ctxV = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
    ctxV.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctxV.route(N.NUBE + "/**", vacia)
    V = ctxV.new_page(); V.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); V.on("dialog", lambda d: d.accept())
    V.goto(URL); V.wait_for_timeout(1500); entrar(V, ADM2); V.wait_for_timeout(2500)
    malas = recorre(V, PANTALLAS["admin"])
    caso("y también con el rancho vacío, como está hoy producción", not malas, malas[:4])
    caso("abrir las pantallas no escribió nada en la nube", not vacia.cuantos() or set(vacia.cuantos()) <= {"preferencias"}, vacia.cuantos())
    propias_ = lambda q: {k: v for k, v in q.items() if k not in ("preferencias",)}
    # ══ Respaldo y recuperación: con SÓLO el archivo se rehace todo, en el aparato y en la nube ══
    ir(C, "respaldo")
    with C.expect_download() as dl: C.get_by_role("button", name="Descargar respaldo").click()
    ruta = dl.value.path(); resp = json.loads(open(ruta, encoding="utf8").read())
    caso("el respaldo trae lo capturado (y nada de cuentas ya hechas, que se vuelven a calcular)", len(resp["eventos"]) == fA["eventos"] and len(resp["trabajadores"]) == 3 and len(resp["egresos"]) == 2 and not [k for k in resp if k in ("actividadesContables", "almacen", "indirectos", "salidasInv")] and resp["inventario"][0]["existencia"] == 20, sorted(resp)[:12])
    caso("la pantalla de respaldo ya no ofrece borrar datos ni poner el inventario en cero", C.get_by_text("Borrar TODO").count() == 0 and C.get_by_text("Poner inventario en cero").count() == 0 and C.get_by_text("Reiniciar datos").count() == 0)
    ir(V, "respaldo"); V.locator('input[type="file"]').set_input_files(ruta); V.wait_for_timeout(600)
    caso("restaurar pide decir por qué, y sin eso no hace nada", "escribe por qué se restaura" in V.locator(".alert").first.inner_text() and not propias_(vacia.cuantos()), V.locator(".alert").first.inner_text()[:120])
    V.get_by_label("Por qué se restaura").fill("Ensayo: se perdió toda la base"); V.locator('input[type="file"]').set_input_files(ruta)
    for _ in range(40):
        V.wait_for_timeout(500)
        if V.locator(".alert").count() and "restaurad" in V.locator(".alert").first.inner_text().lower() and "por qué" not in V.locator(".alert").first.inner_text(): break
    dice = plano(V.locator(".alert").first.inner_text()) if V.locator(".alert").count() else "sin mensaje"
    fR = foto(V); rR = V.evaluate(RES)
    caso("restaurar en un rancho vacío deja TODO igual: mismos registros, mismos costos, mismo valor del almacén (no descuenta dos veces)", fR == fA and rR == rA, [dice, [(k, fA[k], fR.get(k)) for k in fA if fA[k] != fR.get(k)], rR["inventario"], rA["inventario"]])
    propias = lambda q: {k: v for k, v in q.items() if k not in ("preferencias",)}
    caso("y lo vuelve a poner en la nube completo", propias(vacia.cuantos()) == propias(nube.cuantos()), [vacia.cuantos(), nube.cuantos(), dice])
    pagoO = [e for e in nube.t["eventos"].values() if e["tipo"] == "pago_personal"][0]; pagoR = [e for e in vacia.t["eventos"].values() if e["tipo"] == "pago_personal"][0]
    caso("el pago restaurado sigue AUTORIZADO POR QUIEN LO AUTORIZÓ y con su fecha, no por quien restauró", pagoR["validacion"] == "autorizado" and pagoR["validado_por"] == ADM["id"] == pagoO["validado_por"] and pagoR.get("validado") == pagoO.get("validado") and pagoR["datos"]["quien"]["nombre"] == "ADMIN DE PRUEBA", {k: pagoR.get(k) for k in ("validacion", "validado_por", "validado", "restaurado_por")})
    caso("y queda dicho quién lo restauró, cuándo y por qué", pagoR.get("restaurado_por") == ADM2["id"] and vacia.restauraciones and vacia.restauraciones[0]["motivo"] == "Ensayo: se perdió toda la base" and vacia.restauraciones[0]["abierta_por"] == ADM2["id"], vacia.restauraciones[:1])
    caso("los eventos conservan la hora en que la base los recibió", all(vacia.t["eventos"][i].get("recibido") == e.get("recibido") for i, e in nube.t["eventos"].items()))
    caso("el sello original no se guardó dentro de ningún evento", not [e for e in vacia.t["eventos"].values() if "_selloOriginal" in (e.get("datos") or {})])
    ctxW = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
    ctxW.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctxW.route(N.NUBE + "/**", vacia)
    W = ctxW.new_page(); W.on("pageerror", lambda e: errs.append(str(e))); W.goto(URL); W.wait_for_timeout(1500); entrar(W, ADM); W.wait_for_timeout(4500)
    fW = foto(W); rW = W.evaluate(RES)
    caso("otro aparato que entra a esa nube recuperada ve exactamente la misma operación", fW == fA and rW == rA, [(k, fA[k], fW.get(k)) for k in fA if fA[k] != fW.get(k)])
    # Alguien corrigió un sueldo en la nube DESPUÉS del respaldo: restaurar no lo regresa al valor viejo.
    idT = next(iter(vacia.t["trabajadores"])); vacia.t["trabajadores"][idT] = {**vacia.t["trabajadores"][idT], "datos": {**vacia.t["trabajadores"][idT]["datos"], "sueldo_dia": 999}, "actualizado": "2099-01-01T00:00:00Z"}
    V.get_by_label("Por qué se restaura").fill("Ensayo: otra vez el mismo archivo"); V.locator('input[type="file"]').set_input_files(ruta); V.wait_for_timeout(5000)
    caso("y lo que en la nube era más reciente que el respaldo se queda como estaba", vacia.t["trabajadores"][idT]["datos"]["sueldo_dia"] == 999)
    caso("restaurar dos veces el mismo archivo no duplica nada", propias(vacia.cuantos()) == propias(nube.cuantos()) and foto(V) == fA, vacia.cuantos())
    ctxW.close()
    ctxV.close()

    # ══ 11. Teléfono compartido: quien entra con PIN no se queda «adentro» para el siguiente ══
    C.evaluate("p => window.__agroIr(p)", "home"); C.wait_for_timeout(300); C.get_by_role("button", name="Salir").first.click()
    for _ in range(20):
        C.wait_for_timeout(400)
        if C.locator(".login-bg").count(): break
    C.locator(".login-sheet input").first.fill("4101"); C.get_by_role("button", name="Entrar").click(); C.wait_for_timeout(1200)
    caso("en ese mismo aparato, Ana entra con su PIN y ve sólo lo suyo", C.locator(".login-bg").count() == 0 and "ANA" in C.locator("body").inner_text().upper() and "Pagos al personal" not in C.locator("body").inner_text(), plano(C.locator("body").inner_text())[:160])
    C.clock.fast_forward(4 * 60 * 1000); C.wait_for_timeout(400)
    caso("a los cuatro minutos sin tocarlo sigue abierta", C.locator(".login-bg").count() == 0)
    C.clock.fast_forward(2 * 60 * 1000); C.wait_for_timeout(600)
    caso("a los cinco minutos sin uso la sesión se cierra sola y lo dice", C.locator(".login-bg").count() == 1 and C.locator(".login-cerrada-sola").count() == 1, plano(C.locator("body").inner_text())[:200])
    caso("y lo guardado en el aparato sigue igual", foto(C)["trabajadores"] == 3 and foto(C)["eventos"] == f4["eventos"])
    caso("ninguna pantalla tronó en todo el recorrido", not errs, errs[:2])
    print("   lo que quedó en la nube:", nube.cuantos())
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
