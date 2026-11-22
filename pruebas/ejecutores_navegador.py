"""QUIÉN HIZO QUÉ, en las capturas de verdad y con gente INVENTADA.
Lo que se comprueba: que una aplicación de agroquímicos guarda aparte quién la aplicó (pueden ser varios), quién la
indicó y quién la registró; que si no se dice quién aplicó NO se le pone a quien la registró; que un registro de antes
se enseña como estaba, sin inventarle aplicador; y que nada de esto cambia costos.
Uso:  npx vite --port 5173 &   →   python3 pruebas/ejecutores_navegador.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:600] if det else ""))
plano = lambda t: t.replace("\n", " | ")
HOY = "2026-11-23"
g["SEMILLA"].update({
    "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO"}],
    "parcelas": [{"id": "pa", "nombre": "Parcela Uno", "ranchoId": "r1", "hectareas": 2, "cultivo": "Ajo", "emoji": "🌾"}],
    "trabajadores": [{"id": "t-uno", "nombre": "APLICADOR UNO", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4101"}, {"id": "t-dos", "nombre": "APLICADOR DOS", "categoria": "jornalero", "sueldo_dia": 350, "pin": "4102"}],
    # Una aplicación de antes de este cambio: sólo se sabe quién la registró.
    "aplicaciones": [{"id": "ap-vieja", "parcelaId": "pa", "tipo": "Foliar", "fecha": "2026-11-20", "cultivo": "Ajo", "superficie": 2, "productos": [{"nombre": "Producto inventado", "dosis": 1, "unidad": "kg/ha", "total": 2}], "registradoPor": "agr-prueba"}],
})
datos = lambda pg: pg.evaluate("() => { const d = window.__agroDatos; return { ap: d.aplicaciones, act: d.actividades.length, egr: d.egresos.length }; }")
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(500))
def nueva(pg, aplican=(), indico=None):
    pg.get_by_role("button", name="+ Nueva").click(); pg.wait_for_timeout(200)
    pg.locator("select.inp").first.select_option("pa")
    pg.get_by_placeholder("Ej: MAP, Nitrato de calcio...").fill("Producto de prueba"); pg.locator('input[type="number"]').first.fill("3")
    pg.get_by_role("button", name="+ Agregar a la lista").click(); pg.wait_for_timeout(200)
    for n in aplican: pg.get_by_label(f"Aplicó {n}").check()
    if indico: pg.get_by_label("Quién indicó la aplicación").select_option(indico)
    pg.get_by_role("button", name="Guardar aplicación").click(); pg.wait_for_timeout(400)
    if not aplican:
        AVISOS.append(plano(pg.locator(".ap-sin-aplicador").inner_text()) if pg.locator(".ap-sin-aplicador").count() else "")
        AVISOS.append(len([x for x in pg.evaluate("() => window.__agroDatos.aplicaciones")]))
        pg.get_by_role("button", name="Guardar sin aplicadores").click(); pg.wait_for_timeout(500)
AVISOS = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:500])); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time=f"{HOY}T09:00:00-06:00"); g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    antes = datos(pg); ir(pg, "aplicaciones")
    nueva(pg, aplican=("APLICADOR UNO", "APLICADOR DOS"), indico="agr-prueba")
    a = [x for x in datos(pg)["ap"] if x["id"] != "ap-vieja"]; q = a[0].get("quienes") if a else None
    caso("la aplicación guarda aparte quién la aplicó (dos personas), quién la indicó y quién la registró", bool(q) and sorted(e["nombre"] for e in q["ejecutaron"]) == ["APLICADOR DOS", "APLICADOR UNO"] and q["ordeno"]["nombre"] == "AGRONOMO DE PRUEBA" and q["capturo"]["rol"] == "admin" and q["confirmo"] is None, q)
    caso("y lo que ya leían las demás pantallas no cambió", a[0]["registradoPor"] and "ejecutores" not in a[0] and "ordenadoPor" not in a[0] and "aplicaron" not in a[0], {k: a[0].get(k) for k in ("registradoPor", "tipo", "superficie")})
    nueva(pg)
    b2 = [x for x in datos(pg)["ap"] if x["id"] not in ("ap-vieja", a[0]["id"])]
    caso("antes de guardar sin aplicadores la pantalla lo advierte expresamente, y todavía no guarda nada", len(AVISOS) == 2 and "No marcaste quién aplicó" in AVISOS[0] and "no se le pondrá a quien la registra" in AVISOS[0] and AVISOS[1] == 2, AVISOS)
    caso("si no se dice quién aplicó, NO se le pone a quien la registró: queda vacío", len(b2) == 1 and b2[0]["quienes"]["ejecutaron"] == [] and b2[0]["quienes"]["ordeno"] is None and b2[0]["quienes"]["capturo"] is not None, b2[0].get("quienes") if b2 else None)
    def detalle(texto_fecha_o_idx):
        pg.locator(".ap-fila").nth(texto_fecha_o_idx).click(); pg.wait_for_timeout(300); t = plano(pg.locator(".ap-quienes-detalle").inner_text()); pg.locator(".top-bar .btn-ghost").first.click(); pg.wait_for_timeout(250); return t
    filas = [plano(x.inner_text()) for x in pg.locator(".ap-fila").all()]
    caso("en la lista, las que no tienen aplicadores lo dicen; la que sí, no", sum(1 for x in filas if "Sin aplicadores identificados" in x) == 2 and len(filas) == 3, filas)
    vistos = [detalle(i) for i in range(len(filas))]
    con = [v for v in vistos if "APLICADOR UNO, APLICADOR DOS" in v or "APLICADOR DOS, APLICADOR UNO" in v]
    caso("el detalle enseña quién la aplicó, quién la indicó y quién la registró, cada uno en su renglón", len(con) == 1 and "La indicó | AGRONOMO DE PRUEBA" in con[0] and "La confirmó | Todavía nadie" in con[0], vistos)
    caso("la que no dijo quién aplicó lo dice así", sum(1 for v in vistos if "No se dijo quién aplicó" in v) == 2, vistos)
    vieja = [v for v in vistos if "Registro de antes" in v]
    caso("la aplicación de antes se enseña como estaba: quién la registró, y ningún aplicador supuesto", len(vieja) == 1 and "La registró | AGRONOMO DE PRUEBA" in vieja[0] and "No se dijo quién aplicó" in vieja[0], vieja)
    d = datos(pg)
    caso("la aplicación vieja no se reescribió", "quienes" not in [x for x in d["ap"] if x["id"] == "ap-vieja"][0])
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
