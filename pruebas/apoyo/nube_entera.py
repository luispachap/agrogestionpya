"""Una nube de mentira ENTERA: guarda lo que le suben, lo devuelve a quien lo pida y distingue cuentas, como la de
verdad. Sirve para probar que lo capturado sigue ahí al cerrar sesión, al recargar y en otro aparato, sin tocar la
base real. No es la base: los permisos de verdad se prueban atacando la base aislada (npm run test:base)."""
import base64, json, time, datetime, re, subprocess, pathlib
NUBE = "http://localhost:5199"; E = "localhost"
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "*", "Cache-Control": "no-store"}
b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
def cuenta(n, correo, nombre, rol):
    cid = f"00000000-0000-0000-0000-00000000000{n}"
    ficha = f"{b64({'alg': 'HS256'})}.{b64({'sub': cid, 'role': 'authenticated', 'exp': 4102444800})}.firma{n}"
    usuario = {"id": cid, "email": correo, "aud": "authenticated", "role": "authenticated", "email_confirmed_at": "2026-11-19T00:00:00Z"}
    return {"id": cid, "correo": correo, "nombre": nombre, "rol": rol, "ficha": ficha, "usuario": usuario,
            "sesion": {"access_token": ficha, "refresh_token": "r" + str(n), "token_type": "bearer", "expires_in": 36000, "expires_at": 4102444800, "user": usuario}}
# Qué tipos de evento son sensibles: se lee del propio código, para que no se desfase.
_raiz = pathlib.Path(__file__).parent.parent.parent
SENSIBLES = json.loads(subprocess.run(["node", "-e", "import('./src/eventos.js').then(m => console.log(JSON.stringify(m.OPERACION_DE)))"], cwd=_raiz, capture_output=True, text=True).stdout or "{}")
SOLO_OTORGADOS = json.loads(subprocess.run(["node", "-e", "import('./src/eventos.js').then(m => console.log(JSON.stringify(m.SOLO_OTORGADOS)))"], cwd=_raiz, capture_output=True, text=True).stdout or "[]")

class Nube:
    def __init__(self, cuentas, inicio="2026-11-01"):
        self.cuentas = {c["ficha"]: c for c in cuentas}; self.porCorreo = {c["correo"]: c for c in cuentas}
        self.t = {}; self.subidas = []; self.rechazos = []; self.otorgados = {}; self.inicio = inicio; self.caida = False; self.depura = None; self.reloj = None
    def ahora(self):
        return (self.reloj() if self.reloj else datetime.datetime.now(datetime.timezone.utc)).isoformat().replace("+00:00", "Z")
    def quien(self, r):
        return self.cuentas.get((r.headers.get("authorization") or "").replace("Bearer ", ""))
    def sellar(self, f, c):
        viejo = self.t.setdefault("eventos", {}).get(f["id"])
        fila = {k: v for k, v in f.items() if k in ("id", "tipo", "fecha", "estado", "datos")}
        if viejo: fila = {**viejo, "estado": f.get("estado", viejo.get("estado")), "datos": f.get("datos", viejo.get("datos"))}
        else: fila.update(recibido=self.ahora(), validacion=None, validacion_dice=None, validado_rol=None)
        fila["actualizado"] = self.ahora()
        op = SENSIBLES.get(f.get("tipo"))
        if op and not viejo:
            ok = op in self.otorgados.get(c["id"], []) or (c["rol"] == "superadmin" and op not in SOLO_OTORGADOS)
            fila.update(validacion="autorizado" if ok else "rechazado", validacion_dice=None if ok else "sin_permiso", validado_rol=c["rol"], validado_por=c["id"])
        return fila
    def __call__(self, route):
        r = route.request; ruta = r.url.split(NUBE)[1].split("?")[0]
        J = lambda o, st=200: route.fulfill(status=st, headers=CORS, content_type="application/json", body=json.dumps(o))
        if self.depura and any(d in ruta for d in self.depura): print("   [nube llega]", r.method, ruta, flush=True)
        if r.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
        if self.caida: return route.abort()
        try: cuerpo = json.loads(r.post_data) if r.post_data else {}
        except Exception: cuerpo = {}
        c = self.quien(r)
        if ruta == "/auth/v1/token":
            k = self.porCorreo.get(cuerpo.get("email"))
            if cuerpo.get("refresh_token"): k = next((x for x in self.cuentas.values() if x["sesion"]["refresh_token"] == cuerpo["refresh_token"]), None)
            return J(k["sesion"]) if k and (cuerpo.get("refresh_token") or cuerpo.get("password") == "contrasena-larga-1") else J({"error": "invalid_grant", "error_description": "Invalid login credentials"}, 400)
        if ruta.startswith("/auth/v1/"): return J(c["usuario"] if (c and ruta.endswith("/user")) else {})
        if ruta.startswith("/storage/"): return J({"Key": "x"}) if c else J({"message": "no"}, 401)
        if ruta == "/rest/v1/rpc/mis_permisos": return J({"rol": c["rol"], "operaciones": self.otorgados.get(c["id"], [])} if c else None)
        if ruta == "/rest/v1/rpc/hora_del_servidor": return J(self.ahora())
        if ruta.startswith("/rest/v1/rpc/"): return J(None)
        if ruta == "/rest/v1/perfiles":
            objeto = "vnd.pgrst.object" in (r.headers.get("accept") or "")
            fila = {"id": c["id"], "nombre": c["nombre"], "rol": c["rol"]} if c else None
            return J(fila if objeto else ([fila] if fila else []))
        if ruta == "/rest/v1/operacion": return J({"espacio": E, "inicio_operaciones": self.inicio, "declarado_el": None, "nota": None})
        if not ruta.startswith("/rest/v1/"): return J({})
        tabla = ruta.split("/")[-1]; filas = self.t.setdefault(tabla, {})
        if r.method == "GET":
            if self.depura and tabla in self.depura: print("   [nube]", tabla, "cuenta:", c and c["rol"], "filas:", len(filas), (r.headers.get("authorization") or "")[-12:], flush=True)
            if not c: return J([])
            lista = sorted(filas.values(), key=lambda x: (x.get("actualizado") or "", str(x.get("id"))))
            m = re.search(r"actualizado=gte\.([^&]+)", r.url)
            if m:
                desde = m.group(1).replace("%3A", ":").replace("%2B", "+")
                lista = [x for x in lista if (x.get("actualizado") or "") >= desde]
            if "vnd.pgrst.object" in (r.headers.get("accept") or ""): return J(lista[0] if lista else None)
            return J(lista)
        if not c:
            self.rechazos.append(tabla); return J({"code": "42501", "message": "new row violates row-level security policy"}, 401)
        if r.method == "DELETE": return J([], 200)
        entran = cuerpo if isinstance(cuerpo, list) else [cuerpo]; salen = []
        for f in entran:
            if not isinstance(f, dict) or "id" not in f: continue
            self.subidas.append((tabla, f["id"], c["rol"]))
            g = self.sellar(f, c) if tabla == "eventos" else {**f, "actualizado": f.get("actualizado") or self.ahora()}
            filas[g["id"]] = g; salen.append(g)
        return J(salen, 201)
    def cuantos(self): return {t: len(f) for t, f in sorted(self.t.items()) if f}
