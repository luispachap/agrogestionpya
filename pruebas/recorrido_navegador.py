"""Recorrido en navegador real, con datos de mentira y sin red:
  1. Si el teléfono no puede guardar (memoria llena), la app LO DICE.
  2. Borrar a un trabajador pide confirmación: decir que no, no borra; decir que sí, borra.
  3. Cada rol entra y se abre CADA una de sus pantallas sin que ninguna truene.
Uso:  npx vite --port 5173 &   →   python3 pruebas/recorrido_navegador.py
(Corre contra el modo de desarrollo, que es el que deja abrir pantallas por nombre.)"""
import hashlib, json, re, sys, pathlib
from playwright.sync_api import sync_playwright
URL = "http://localhost:5173/"
SRC = (pathlib.Path(__file__).parent.parent / "src" / "App.jsx").read_text(encoding="utf8")
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
def h(pin): return hashlib.sha256(("agroselectos|" + pin).encode()).hexdigest()

# Qué pantallas abre cada rol: se lee del propio código, para que no se desfase.
def pantallas(bandera):
    m = re.search(r"\{" + bandera + r" && <>(.*?)</>\}", SRC, re.S)
    return sorted(set(re.findall(r'page === "([^"]+)"', m.group(1))))
ROLES = {  # tarjeta del acceso, bandera en el código, lo que se teclea
    "Admin": ("isAdmin", "7391"), "Dirección": ("isDueno", "7392"), "Finanzas": ("isFinanzas", "7393"),
    "Encargado": ("isEncargado", "5501"), "Agrónomo": ("isAgronomo", "5502"),
    "Trabajador": ("isTrab", "5503"), "Cuadrilla": ("isCuad", "5504"), "Externo": ("isExterno", "PERSONA DE PRUEBA"),
}
SEMILLA = {
    "config_seguridad": [{"id": "seg", "pin_admin": h("7391"), "pin_dueno": h("7392"), "pin_finanzas": h("7393")}],
    "trabajadores": [{"id": "t-prueba", "nombre": "TRABAJADOR DE PRUEBA", "categoria": "jornalero", "sueldo_dia": 350, "pin": "5503"}],
    "encargados": [{"id": "enc-prueba", "nombre": "ENCARGADO DE PRUEBA", "pin": "5501"}],
    "agronomos": [{"id": "agr-prueba", "nombre": "AGRONOMO DE PRUEBA", "pin": "5502"}],
    "cuadrillas": [{"id": "cq-prueba", "nombre": "CUADRILLA DE PRUEBA", "pin": "5504", "miembros": 5, "flete_dia": 0}],
}
def sembrar(pg):
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.evaluate("""s => { const d = JSON.parse(localStorage.getItem('agro_v8:local') || '{}');
        localStorage.clear(); localStorage.setItem('agro_v8:local', JSON.stringify({ ...d, ...JSON.parse(s) })); }""", json.dumps(SEMILLA))
    pg.reload(); pg.wait_for_timeout(1200)
def entrar(pg, tarjeta, clave):
    pg.locator(".role-card", has_text=tarjeta).first.click()
    pg.locator(".login-sheet input").first.fill(clave)
    pg.get_by_role("button", name="Entrar").click()
    for _ in range(20):
        pg.wait_for_timeout(300)
        if pg.locator(".login-bg").count() == 0: return True
    return False
def trono(pg): return pg.get_by_text("Algo salió mal").count() > 0

with sync_playwright() as p:
    b = p.chromium.launch()
    def nueva():
        ctx = b.new_context(viewport={"width": 390, "height": 800})
        ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())
        pg = ctx.new_page(); pg.errores = []
        pg.on("pageerror", lambda e: pg.errores.append(str(e)))
        pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept() if pg.aceptar else d.dismiss()))
        pg.dialogos = []; pg.aceptar = False
        return pg

    # ── 1 · El aviso de que no se está guardando ──
    pg = nueva(); sembrar(pg)
    caso("entra el administrador con su PIN propio", entrar(pg, "Admin", "7391"))
    caso("con guardado sano NO sale el aviso", pg.get_by_text("NO está guardando").count() == 0)
    pg.evaluate("""() => { const o = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === 'agro_v8:local') throw new DOMException('lleno', 'QuotaExceededError'); return o.call(this, k, v); }; }""")
    pg.evaluate("() => window.__agroIr('equipo')"); pg.wait_for_timeout(600)
    pg.aceptar = True  # cualquier cambio de datos sirve: nombrar cabo intenta guardar
    pg.locator('button[title^="Nombrar cabo"]').first.click(); pg.wait_for_timeout(900)
    caso("si el teléfono no puede guardar, sale el aviso en rojo", pg.get_by_text("NO está guardando").count() > 0)
    caso("y la app sigue abierta, no truena", not trono(pg) and not pg.errores, "; ".join(pg.errores)[:150])
    pg.context.close()

    # ── 2 · Borrar a un trabajador pide confirmación ──
    pg = nueva(); sembrar(pg); entrar(pg, "Admin", "7391")
    pg.evaluate("() => window.__agroIr('equipo')"); pg.wait_for_timeout(600)
    n = lambda: len(pg.evaluate("() => JSON.parse(localStorage.getItem('agro_v8:local')).trabajadores"))
    boton = pg.get_by_label("Borrar a TRABAJADOR DE PRUEBA")
    caso("el trabajador de prueba aparece en Equipo", boton.count() == 1 and n() == 1)
    pg.aceptar = False; boton.click(); pg.wait_for_timeout(700)
    caso("al borrar, la app PREGUNTA antes", len(pg.dialogos) == 1 and "¿Borrar a TRABAJADOR DE PRUEBA?" in pg.dialogos[0], (pg.dialogos or ["sin pregunta"])[0][:60].replace("\n", " "))
    caso("si se contesta que NO, el trabajador sigue ahí", n() == 1 and boton.count() == 1)
    pg.aceptar = True; boton.click(); pg.wait_for_timeout(900)
    caso("si se contesta que SÍ, se borra", n() == 0)
    bit = pg.evaluate("() => (JSON.parse(localStorage.getItem('agro_v8:local')).auditoria || [])")
    caso("y el borrado queda anotado en la bitácora", any(x.get("accion") == "borro" and x.get("tabla") == "trabajadores" for x in bit), f"{len(bit)} renglones")
    pg.context.close()

    # ── 3 · Cada rol abre cada una de sus pantallas ──
    total = 0
    for tarjeta, (bandera, clave) in ROLES.items():
        pg = nueva(); sembrar(pg)
        if not entrar(pg, tarjeta, clave): caso(f"{tarjeta}: entra", False); pg.context.close(); continue
        malas = []
        for pant in pantallas(bandera):
            antes = len(pg.errores)
            pg.evaluate("p => window.__agroIr(p)", pant); pg.wait_for_timeout(350)
            vacia = pg.evaluate("() => (document.querySelector('.screen')?.innerText || '').trim().length") == 0
            if trono(pg) or len(pg.errores) > antes or vacia:
                malas.append(pant + (" (en blanco)" if vacia else " (" + (pg.errores[-1][:70] if len(pg.errores) > antes else "tronó") + ")"))
                if trono(pg): pg.get_by_role("button", name="Volver al inicio").click(); pg.wait_for_timeout(300)
            total += 1
        caso(f"{tarjeta}: abre sus {len(pantallas(bandera))} pantallas sin tronar", not malas, "; ".join(malas)[:300])
        pg.context.close()
    print(f"({total} pantallas abiertas en total)")
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
