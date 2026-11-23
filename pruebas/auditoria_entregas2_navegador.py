"""AUDITORÍA FUNCIONAL · LO QUE FALTABA DE ENTREGAS DEL ALMACÉN, con cuentas: herramientas prestadas (no se preguntan para
qué ni cuánto se usó), «sigue en uso» con fecha, bajas con causa (y lo que se decide, aparte), traslados entre bodegas
desde dos teléfonos sin señal, y el plazo de una herramienta que no regresa. 390 px, nube de imitación, datos inventados.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      python3 pruebas/auditoria_entregas2_navegador.py"""
import datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-19"
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det and not ok else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); ENC = N.cuenta(2, "encargado@prueba.invalid", "ENCARGADO DE PRUEBA", "encargado")
nube = N.Nube([ADM, ENC]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"
nube.t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": E, "actualizado": V}}
nube.t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "datos": {"hectareas": 2, "cultivo": "Ajo", **E}, "actualizado": V}}
nube.t["trabajadores"] = {"t-ana": {"id": "t-ana", "nombre": "ANA INVENTADA", "pin": "4101", "datos": {"categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": [{"desde": "2026-01-01", "sueldo_dia": 400, "anterior": 400}], **E}, "actualizado": V}}
nube.t["inventario"] = {"i-pala": {"id": "i-pala", "nombre": "PALA INVENTADA", "cat": "herramienta", "datos": {"unidad": "pieza", "existencia": 6, "costo_unit": 0, "minimo": 0, "esHerramienta": True, **E}, "actualizado": V},
                        "i-urea": {"id": "i-urea", "nombre": "UREA INVENTADA", "cat": "fertilizante", "datos": {"unidad": "bulto", "existencia": 30, "costo_unit": 500, "minimo": 0, **E}, "actualizado": V}}
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(600))
datos = lambda pg: pg.evaluate("() => window.__agroDatos")
cuerpo = lambda pg: plano(pg.locator("body").inner_text())
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
def de(pg, tipo): return [e for e in datos(pg)["eventos"] if e["tipo"] == tipo]
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(350)
EXIST = "id => (window.__agroDatos.inventario.find(a => a.id === id) || {}).existencia"
EGRESOS = "() => (window.__agroDatos.egresos || []).length"

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    reloj = {"ms": None}
    def tic(): reloj["ms"] += 40; return datetime.datetime.fromtimestamp(reloj["ms"] / 1000, datetime.timezone.utc)
    nube.reloj = lambda: tic() if reloj["ms"] else datetime.datetime.now(datetime.timezone.utc)
    def hora(pg): reloj["ms"] = max(reloj["ms"] or 0, pg.evaluate("() => Date.now()"))
    def aparato(cuenta, hh="08:00"):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block")
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort()); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept("MOTIVO INVENTADO") if d.type == "prompt" else d.accept()))
        pg.clock.install(time=f"{HOY}T{hh}:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500); hora(pg)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    def avanza(pg, horas): pg.clock.fast_forward(int(horas * 3600 * 1000)); pg.wait_for_timeout(400); hora(pg)
    def elige(pg, etiqueta, texto):
        sel = pg.get_by_label(etiqueta, exact=True) if etiqueta == "Parcela" else pg.get_by_label(etiqueta)
        v = sel.evaluate("(s, t) => [...s.options].find(o => o.textContent.includes(t))?.value", texto); sel.select_option(v); return v

    B = aparato(ENC, "07:00")
    # ══ 1. Una herramienta se presta: no se pregunta para qué ══
    ir(B, "entregas"); elige(B, "Artículo", "PALA INVENTADA"); B.get_by_label("Cantidad").fill("3"); elige(B, "Quién lo recibe", "ANA INVENTADA")
    caso("HERRAMIENTA: no pregunta para qué es; dice que se presta y se devuelve", B.get_by_label("Para qué es").count() == 0 and B.get_by_text("se presta y se devuelve").count() == 1, cuerpo(B)[:500])
    B.locator("button.btn-accent", has_text="Entregar").click(); B.wait_for_timeout(400)
    elige(B, "Artículo", "UREA INVENTADA"); B.get_by_label("Cantidad").fill("5"); elige(B, "Quién lo recibe", "ANA INVENTADA")
    B.get_by_label("Para qué es").select_option("parcela"); elige(B, "Parcela", "PARCELA UNO"); B.get_by_label("Actividad").select_option("Fertilización")
    B.locator("button.btn-accent", has_text="Entregar").click(); B.wait_for_timeout(400)
    r = de(B, "alm_retiro")
    caso("dos entregas a Ana: 3 palas y 5 bultos de urea, a su cargo; prestar no es gasto", len(r) == 2 and B.evaluate(EGRESOS) == 0 and B.evaluate(EXIST, "i-pala") == 3 and B.evaluate(EXIST, "i-urea") == 25, [len(r), B.evaluate(EXIST, "i-pala"), B.evaluate(EXIST, "i-urea")])

    # ══ 2. Cierre: la urea (usó 3, regresó 1, 1 sigue con ella) y las palas (regresó 1, se rompió 1, 1 sigue) ══
    avanza(B, 7)
    tab(B, "Por cerrar")
    u = B.locator(".card", has_text="UREA INVENTADA").first; u.get_by_role("button", name="Cerrar: se usó o regresó").click(); B.wait_for_timeout(300)
    B.get_by_label("Se usó").fill("3"); B.get_by_label("Regresó al almacén").fill("1")
    caso("dice cuánto sigue con ella", B.get_by_text("Lo demás (1 bulto) sigue con ANA INVENTADA").count() == 1, cuerpo(B)[:600])
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    cons = [e for e in de(B, "alm_consumo") if e.get("origen")]
    caso("lo usado (3) nace como consumo con su costo ($500), y apunta a su entrega", len(cons) == 1 and cons[0]["datos"]["cantidad"] == 3 and cons[0]["datos"]["costoUnit"] == 500, cons)
    pl = B.locator(".card", has_text="PALA INVENTADA").first; pl.get_by_role("button", name="Regresó o cambió de manos").click(); B.wait_for_timeout(300)
    caso("a una herramienta no se le pregunta cuánto se usó", B.get_by_label("Se usó").count() == 0)
    B.get_by_label("Regresó al almacén").fill("1"); B.get_by_label("Se rompió, se perdió o se acabó").fill("1")
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(300)
    caso("BAJA sin causa no se guarda", B.get_by_text("Falta decir por qué se da de baja").count() == 1 and len(de(B, "alm_baja")) == 0)
    B.get_by_label("Por qué se da de baja").select_option("accidente"); B.get_by_label("Qué pasó, con detalle").fill("SE QUEBRO EL MANGO INVENTADO"); B.get_by_label("Valor de cada pieza").fill("320")
    B.get_by_role("button", name="Guardar").click(); B.wait_for_timeout(500)
    bj = de(B, "alm_baja")
    caso("la pala rota queda como baja con causa, valor, qué pasó y quién la traía", len(bj) == 1 and bj[0]["datos"]["causa"] == "accidente" and bj[0]["datos"]["valorUnit"] == 320 and "MANGO" in bj[0]["datos"]["nota"], bj)
    caso("la baja no generó gasto ni descuento a nadie", B.evaluate(EGRESOS) == 0 and not [e for e in datos(B)["eventos"] if "descuento" in e["tipo"]])
    u = B.locator(".card", has_text="UREA INVENTADA").first
    u.get_by_role("button", name="Sigue con ANA").click(); B.wait_for_timeout(300)
    B.get_by_label("Próxima revisión").fill("2026-11-25"); B.get_by_role("button", name="Sigue en uso").click(); B.wait_for_timeout(400)
    rv = de(B, "alm_revision")
    caso("SIGUE EN USO con fecha: no es consumo ni devolución, y deja de preguntar hasta ese día", len(rv) == 1 and rv[0]["datos"].get("proxima") == "2026-11-25" and len([e for e in de(B, "alm_consumo") if e.get("origen")]) == 1, rv)
    subio(B)

    # ══ 3. En el teléfono del administrador: la baja por revisar y la decisión aparte ══
    A = aparato(ADM, "15:30")
    ir(A, "entregas"); tab(A, "Por revisar")
    caso("la baja espera que alguien decida, y dice que no descuenta nada", A.get_by_text("La baja no descuenta nada a nadie").count() == 1 and "la traía ANA INVENTADA" in A.locator(".card", has_text="PALA INVENTADA").first.inner_text(), cuerpo(A)[:700])
    A.get_by_role("button", name="Dejar escrito qué se decidió").click(); A.get_by_label("Qué se revisó o decidió").fill("ACCIDENTE, SIN RESPONSABILIDAD"); A.locator(".modal-sheet").get_by_role("button", name="Guardar").click(); A.wait_for_timeout(400)
    rs = de(A, "alm_resolucion")
    caso("la decisión queda escrita aparte de la baja, de una persona, y no toca el número", len(rs) == 1 and rs[0]["origen"] == bj[0]["id"] and rs[0].get("quien", {}).get("nombre") == "ADMIN DE PRUEBA" and A.evaluate(EXIST, "i-pala") == 4, [rs, A.evaluate(EXIST, "i-pala")])
    subio(A)

    # ══ 4. Traslados entre bodegas desde dos teléfonos sin señal ══
    B.reload(); B.wait_for_timeout(3500); A.reload(); A.wait_for_timeout(3500)
    nube.caida = True
    def mover(pg, cuanto, a):
        ir(pg, "entregas"); tab(pg, "Qué hay")
        pg.locator(".card", has_text="UREA INVENTADA").first.get_by_role("button", name="Mover a otro lugar").click(); pg.wait_for_timeout(300)
        pg.get_by_label("Cuánto se mueve").fill(str(cuanto)); pg.get_by_label("A qué lugar").fill(a); pg.get_by_role("button", name="Mover", exact=True).click(); pg.wait_for_timeout(500)
    mover(A, 10, "BODEGA DOS INVENTADA"); mover(B, 5, "BODEGA DOS INVENTADA")
    nube.caida = False
    caso("vuelve la señal y suben los dos traslados", subio(A) and subio(B), [A.evaluate(COLA), B.evaluate(COLA)])
    A.reload(); A.wait_for_timeout(3500); B.reload(); B.wait_for_timeout(3500)
    tr = lambda pg: len(de(pg, "alm_transferencia"))
    caso("los DOS traslados quedan en los dos teléfonos (ninguno pisa al otro)", tr(A) == 2 and tr(B) == 2, [tr(A), tr(B)])
    ir(A, "entregas"); tab(A, "Qué hay"); ta = A.locator(".card", has_text="UREA INVENTADA").first.inner_text()
    ir(B, "entregas"); tab(B, "Qué hay"); tb = B.locator(".card", has_text="UREA INVENTADA").first.inner_text()
    pr = lambda t: t.split("Su código")[0]
    caso("mover no es gasto: de los 26 bultos, 11 en el almacén y 15 en la bodega dos (y 1 con Ana), igual en los dos teléfonos", "11 bulto" in ta and "BODEGA DOS INVENTADA | 15 bulto" in plano(ta) and pr(ta) == pr(tb) and A.evaluate(EGRESOS) == 0 and A.evaluate(EXIST, "i-urea") == 11, [plano(ta), plano(tb)])

    # ══ 5. Una herramienta que no regresa: el plazo ══
    avanza(B, 24 * 8); B.reload(); B.wait_for_timeout(3500); hora(B)
    ir(B, "entregas"); tab(B, "Por cerrar"); tx = cuerpo(B)
    caso("a los ocho días la pala que sigue con Ana sale para cerrar, diciendo desde cuándo", "PALA INVENTADA" in tx and ("8 día" in tx or "día(s)" in tx), tx[:800])

    caso("nada quedó sin subir ni rechazado por la base", subio(A) and subio(B) and not nube.ocupados, nube.ocupados[:3])
    caso("ninguna pantalla tronó", not errs, errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
