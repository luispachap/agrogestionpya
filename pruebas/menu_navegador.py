"""El menú, en navegador real y sin red: se abre, busca, lleva a la pantalla, ancla,
la barra respeta su tope, el acomodo sobrevive a recargar y es de cada persona.
Uso:  npx vite --port 5173 &   →   python3 pruebas/menu_navegador.py"""
import sys, pathlib
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det) if det else ""))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.dismiss())
    g["sembrar"](pg); g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    caso("el inicio del administrador ya no es una pared de tarjetas", pg.locator(".option-card").count() == 0 and pg.locator(".acc").count() == 6, pg.locator(".acc").count())
    caso("el inicio cabe en menos de dos pantallas", pg.evaluate("document.documentElement.scrollHeight") < 1600)
    caso("la barra trae Inicio, tres accesos y Menú", pg.locator(".bn-label").all_inner_texts() == ["Inicio", "Movimientos", "Finanzas", "Inventario", "Menú"], pg.locator(".bn-label").all_inner_texts())
    pg.locator(".bn-item", has_text="Menú").click(); pg.wait_for_timeout(300)
    caso("el menú abre con los siete grupos", pg.locator(".mn-cab").count() == 7, pg.locator(".mn-gn").all_inner_texts())
    pg.locator(".mn-cab", has_text="Dinero").click(); pg.wait_for_timeout(200)
    caso("un grupo se despliega al tocarlo", pg.locator(".mn-hoja .mn-n", has_text="Banco").count() == 1)
    pg.get_by_placeholder("Buscar").fill("nomina"); pg.wait_for_timeout(200)
    caso("buscar 'nomina' sin acento encuentra la nómina", pg.locator(".mn-hoja .mn-n").all_inner_texts() == ["Nómina semanal"])
    pg.locator(".mn-hoja .mn-ir").first.click(); pg.wait_for_timeout(400)
    caso("tocar un renglón abre la pantalla y cierra el menú", pg.locator(".mn-hoja").count() == 0 and pg.get_by_text("Algo salió mal").count() == 0)
    pg.locator(".bn-item").first.click(); pg.locator(".acc-link", has_text="Acomodar").click(); pg.wait_for_timeout(300)
    pg.locator(".mn-cab", has_text="Dinero").click()
    fila = pg.locator(".mn-grupo", has_text="Dinero").locator(".mn-fila", has_text="Banco")
    fila.locator(".mn-pin").click(); fila.locator(".mn-chip").click(); pg.wait_for_timeout(200)
    caso("la barra llena avisa en vez de meter un cuarto", "caben 3" in " ".join(pg.locator(".mn-ayuda").all_inner_texts()))
    pg.locator(".mn-grupo", has_text="Dinero").locator(".mn-fila", has=pg.locator(".mn-n", has_text="Movimientos")).locator(".mn-chip").click()
    fila.locator(".mn-chip").click(); pg.wait_for_timeout(200)
    pg.locator(".acc-link", has_text="Cerrar").click(); pg.wait_for_timeout(300)
    caso("lo anclado aparece en el inicio", "Banco" in pg.locator(".acc-n").all_inner_texts())
    caso("lo escogido aparece en la barra", pg.locator(".bn-label").all_inner_texts() == ["Inicio", "Finanzas", "Inventario", "Banco", "Menú"], pg.locator(".bn-label").all_inner_texts())
    pg.reload(); pg.wait_for_timeout(1200)
    if pg.locator(".login-bg").count(): g["entrar"](pg, "Admin", "7391"); pg.wait_for_timeout(400)
    caso("el acomodo sigue ahí después de recargar", "Banco" in pg.locator(".acc-n").all_inner_texts() and "Banco" in pg.locator(".bn-label").all_inner_texts())
    caso("no se escribió ninguna llave fuera del cajón del espacio", pg.evaluate("Object.keys(localStorage).every(k => k.endsWith(':local'))"), pg.evaluate("Object.keys(localStorage)"))
    pg.get_by_role("button", name="Salir").click(); pg.wait_for_timeout(500)
    g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    caso("otra persona en el mismo teléfono ve SU acomodo, no el del administrador", "Banco" not in pg.locator(".bn-label").all_inner_texts() and pg.locator(".bn-label").all_inner_texts()[1] == "Tareas", pg.locator(".bn-label").all_inner_texts())
    pg.locator(".bn-item", has_text="Menú").click(); pg.wait_for_timeout(300)
    for c in pg.locator(".mn-cab").all(): 
        if "−" not in c.inner_text(): c.click()
    nombres = pg.locator(".mn-hoja .mn-n").all_inner_texts()
    caso("el encargado no ve Arranque, Nómina ni Seguridad en su menú", not any(x in nombres for x in ["Arranque", "Nómina semanal", "Seguridad", "Finanzas"]), len(nombres))
    caso("ninguna pantalla tronó", not errs, errs)
    b.close()
print(f"\n{sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
