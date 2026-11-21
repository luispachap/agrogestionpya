"""Capturas REALES de la app para el material de capacitación, con datos de ejemplo (ninguno es del rancho).
Uso:  npx vite --port 5173 &   →   python3 pruebas/capturas_capacitacion.py <carpeta de salida>"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
sal = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "capturas"); sal.mkdir(parents=True, exist_ok=True)
S = g["SEMILLA"]
hs = lambda s: [{"desde": "2024-01-01", "sueldo_dia": s, "anterior": s}]
S["ranchos"] = [{"id": "r1", "nombre": "Rancho Ejemplo"}]
S["parcelas"] = [{"id": "p1", "ranchoId": "r1", "nombre": "La Loma", "cultivo": "Ajo", "hectareas": 4, "emoji": "🧄", "cicloFenologico": []}, {"id": "p2", "ranchoId": "r1", "nombre": "El Bajío", "cultivo": "Ajo", "hectareas": 3, "emoji": "🧄", "cicloFenologico": []}]
S["trabajadores"] = [{"id": "t1", "nombre": "Ana López (ejemplo)", "categoria": "jornalero", "sueldo_dia": 400, "historialSueldo": hs(400), "pin": "4821", "fechaIngreso": "2024-03-01", "credencial": {"codigo": "ABCDEFGHJK", "emitida": "2026-11-01T00:00:00.000Z"}},
                     {"id": "t2", "nombre": "Beto Ruiz (ejemplo)", "categoria": "jornalero", "sueldo_dia": 380, "historialSueldo": hs(380), "pin": "5503", "fechaIngreso": "2022-06-15", "credencial": {"codigo": "BCDEFGHJKM", "emitida": "2026-11-01T00:00:00.000Z"}},
                     {"id": "t3", "nombre": "Carla Méndez (ejemplo)", "categoria": "jornalero", "sueldo_dia": 380, "historialSueldo": hs(380), "pin": "6611", "fechaIngreso": "2025-01-10"}]
S["encargados"] = [{"id": "enc-prueba", "nombre": "Encargado (ejemplo)", "pin": "5501"}]
S["cuadrillas"] = [{"id": "cq1", "nombre": "Cuadrilla de Juan (ejemplo)", "pin": "5504", "miembros": 8, "flete_dia": 0}]
S["maquinaria"] = [{"id": "m1", "nombre": "Tractor 3", "emoji": "🚜", "tipo": "Tractor", "costo_hora": 250, "depreciacion_mes": 3000}]
S["inventario"] = [{"id": "i1", "nombre": "Urea", "unidad": "bulto", "existencia": 40, "costo_unit": 580, "categoria": "nutricion"}, {"id": "i2", "nombre": "Diésel", "unidad": "L", "existencia": 300, "costo_unit": 25, "categoria": "combustible"}, {"id": "i3", "nombre": "Hilo rafia", "unidad": "rollo", "existencia": 0, "categoria": "otro"}]
S["actividades"] = [{"id": "a1", "fecha": "2026-11-23", "tipo": "Barbecho", "parcelaId": "p1", "registradoPor": {"tipo": "trabajador", "id": "t1"}, "maquinariaId": "m1", "costoMO": 400, "costoMaq": 1500, "costoInsumos": 0, "costoTotal": 1900, "insumos": []},
                    {"id": "a2", "fecha": "2026-11-24", "tipo": "Riego", "parcelaId": "p2", "registradoPor": {"tipo": "trabajador", "id": "t2"}, "costoMO": 380, "costoMaq": 0, "costoInsumos": 0, "costoTotal": 380, "insumos": []}]
S["egresos"] = [{"id": "g1", "fecha": "2026-11-22", "monto": 900, "categoria": "mantenimiento", "concepto": "Servicio del tractor", "vehiculoId": "m1"}, {"id": "g2", "fecha": "2026-11-23", "monto": 1800, "categoria": "combustible", "concepto": "Diésel", "vehiculoId": "m1"},
                {"id": "g3", "fecha": "2026-11-24", "monto": 2400, "categoria": "servicios", "concepto": "Luz del pozo"}, {"id": "g4", "fecha": "2026-11-25", "monto": 3500, "categoria": "insumos", "concepto": "Fertilizante foliar"}]
S["ingresos"] = [{"id": "in1", "fecha": "2026-11-26", "monto": 48000, "concepto": "Venta de ajo calibre 8", "categoria": "venta_cosecha", "parcelaId": "p1"}]
S["compras"] = [{"id": "co1", "fecha": "2026-11-24", "trabajadorId": "t1", "tipoTrab": "trabajador", "descripcion": "Hilo rafia y flete", "proveedor": "Ferretería (ejemplo)", "monto": 1500, "estado": "aprobada", "afectaInventario": True, "items": [{"nombre": "Hilo rafia", "cantidad": 10, "insumoId": "i3", "unidad": "rollo"}, {"nombre": "Flete", "cantidad": 1, "insumoId": None}]}]
S["titulares"] = [{"id": "ti1", "nombre": "Rancho Ejemplo", "rfc": "XAXX010101000"}]
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(700)
def tab(pg, nombre): pg.locator(".tab-pill", has_text=nombre).first.click(); pg.wait_for_timeout(500)
def foto(pg, nombre, completa=False): pg.wait_for_timeout(300); pg.screenshot(path=str(sal / f"{nombre}.png"), full_page=completa); print("ok", nombre)
def intenta(nombre, f):
    try: f()
    except Exception as e: print("FALTA", nombre, str(e)[:120])

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2, timezone_id="America/Mexico_City")
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); pg.on("dialog", lambda d: d.accept())
    pg.add_init_script("window.__agroInicio = '2026-11-20'")
    pg.clock.install(time="2026-11-27T08:05:00-06:00")
    g["sembrar"](pg); foto(pg, "01-entrada")
    pg.get_by_role("button", name="Soy externo y no tengo PIN").click(); foto(pg, "01b-entrada-externo"); pg.get_by_role("button", name="No soy yo: regresar").click()
    # El trabajador
    g["entrar"](pg, "Trabajador", "4821"); pg.wait_for_timeout(600); foto(pg, "20-trabajador-inicio")
    intenta("21", lambda: (ir(pg, "reporte"), foto(pg, "21-trabajador-reporte")))
    intenta("22", lambda: (ir(pg, "compras"), foto(pg, "22-trabajador-compra")))
    pg.evaluate("() => localStorage.removeItem('agro_sesion_v8:local')"); pg.reload(); pg.wait_for_timeout(1200)
    # El encargado: checador, equipos, cuadrillas
    g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(600); foto(pg, "10-encargado-inicio")
    ir(pg, "checador"); pg.wait_for_timeout(800)
    for pin in ("4821", "5503"):
        for d in pin: pg.locator(".chk-teclas button", has_text=d).first.click()
        pg.locator(".chk-teclas button.ok").click(); pg.wait_for_timeout(500)
    foto(pg, "11-checador", True)
    intenta("12", lambda: (ir(pg, "reparto"), foto(pg, "12-equipos-de-trabajo", True)))
    intenta("13", lambda: (ir(pg, "cuadrillas-dia"), foto(pg, "13-cuadrillas", True)))
    intenta("14", lambda: (ir(pg, "jornadas"), foto(pg, "14-el-dia", True)))
    intenta("15", lambda: (ir(pg, "credenciales"), foto(pg, "15-credenciales", True)))
    intenta("16", lambda: (ir(pg, "entregas"), foto(pg, "16-entregas-almacen", True)))
    intenta("17", lambda: (ir(pg, "personal"), foto(pg, "17-personal", True)))
    pg.evaluate("() => localStorage.removeItem('agro_sesion_v8:local')"); pg.reload(); pg.wait_for_timeout(1200)
    # El administrador
    g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(800); foto(pg, "30-admin-inicio", True)
    for n, pagina, pestana in [("32-parcelas", "parcelas", None), ("33-inventario", "inventario", None), ("34-mano-de-obra", "mano-obra", None), ("35-equipo", "equipo", None),
                               ("40-finanzas-compras", "contabilidad", "Compras"), ("41-finanzas-resultados", "contabilidad", "Resultados"), ("42-finanzas-flujo", "contabilidad", "Flujo de efectivo"),
                               ("50-pagos", "nomina", None), ("51-pagos-bonos", "nomina", "Bonos"), ("52-pagos-prestamos", "nomina", "Préstamos"), ("53-pagos-prestaciones", "nomina", "Prestaciones"),
                               ("60-cierre-de-mes", "reportes", "Cierre de mes"), ("61-importar", "importar", None), ("62-importar-como", "importar", "Qué lee y qué no"), ("70-arranque", "arranque", None)]:
        def uno(n=n, pagina=pagina, pestana=pestana):
            ir(pg, pagina)
            if pestana: tab(pg, pestana)
            if n.startswith("60"): pg.get_by_label("Mes que se cierra").fill("2026-11"); pg.wait_for_timeout(500)
            foto(pg, n, True)
        intenta(n, uno)
    intenta("31", lambda: (ir(pg, "home"), pg.locator(".bn-item", has_text="Menú").click(), pg.wait_for_timeout(600), foto(pg, "31-menu")))
    b.close()
