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
# Las columnas que de verdad tiene cada tabla, leídas de las hojas SQL. Antes esta nube aceptaba cualquier columna, y el
# 24 nov ningún mensaje del chat subía a la base real («deQuien» se llama `dequien`) sin que ningún recorrido lo viera.
COLUMNAS = {t: set(c) for t, c in json.loads(subprocess.run(["node", "herramientas/columnas.mjs"], cwd=_raiz, capture_output=True, text=True).stdout or "{}").items()}
# Los tipos de evento que la base sólo autoriza con importe (`datos.monto` mayor que cero; hojas 39, 41 y 57), leídos de las
# hojas: la última que lo dice manda.
PIDE_IMPORTE = {}
for _h in sorted((_raiz / "supabase").glob("[0-9]*.sql")):
    for _b in re.findall(r"insert into operaciones_sensibles[^;]*", _h.read_text(encoding="utf8"), re.I):
        for _t, _op, _pide in re.findall(r"\('([a-z_]+)',\s*'([a-z_]+)',\s*(true|false)", _b): PIDE_IMPORTE[_t] = _pide == "true"

import hashlib, tempfile
# Qué puede cada perfil en cada tabla (`permisos_rol`, como queda con TODAS las hojas aplicadas). Lo que no está ahí, la
# base lo niega (hoja 24). Se calcula armando la base aislada una vez y se guarda por la huella de las hojas.
def _permisos():
    h = hashlib.sha256(b"".join(p.read_bytes() for p in sorted((_raiz / "supabase").glob("[0-9]*.sql"))) + (_raiz / "supabase" / "orden.json").read_bytes()).hexdigest()[:16]
    cache = pathlib.Path(tempfile.gettempdir()) / f"agro-permisos-rol-{h}.json"
    if not cache.exists():
        r = subprocess.run(["node", "pruebas/apoyo/permisos_rol.mjs"], cwd=_raiz, capture_output=True, text=True)
        if r.returncode: raise RuntimeError("No se pudo leer permisos_rol de la base aislada: " + r.stderr[-400:])
        cache.write_text(r.stdout)
    return json.loads(cache.read_text())
PERMISOS = _permisos()
# Las tablas cuya regla NO es `puede()`: la bitácora de auditoría (cualquiera con perfil la escribe; nadie la cambia).
POR_OTRA_REGLA = {"auditoria", "preferencias", "perfiles", "invitaciones", "operacion", "restauraciones"}
def puede(c, tabla, accion):
    if not c: return False
    if c["rol"] == "superadmin" or tabla in POR_OTRA_REGLA: return True
    return bool(PERMISOS.get(c["rol"], {}).get(tabla, {}).get(accion))

def firma(fila, llave="llave-de-la-nube-de-mentira"):
    """Como la hoja 53: la firma amarra el evento entero (qué es, lo que dice, su estado) con su sello."""
    datos = {k: v for k, v in (fila.get("datos") or {}).items() if k not in ("_actualizado", "_selloOriginal")}
    return hashlib.sha256("|".join([llave, str(fila.get("id")), str(fila.get("tipo")), str(fila.get("estado")), json.dumps(datos, sort_keys=True), str(fila.get("validacion")), str(fila.get("validacion_dice")), str(fila.get("validado_por")), str(fila.get("validado_rol")), str(fila.get("validado")), str(fila.get("recibido"))]).encode()).hexdigest()

class Nube:
    def __init__(self, cuentas, inicio="2026-11-01"):
        self.cuentas = {c["ficha"]: c for c in cuentas}; self.porCorreo = {c["correo"]: c for c in cuentas}
        self.t = {}; self.subidas = []; self.rechazos = []; self.ocupados = []; self.otorgados = {}; self.inicio = inicio; self.caida = False; self.depura = None; self.restaurando = set(); self.restauraciones = []; self.sin_hoja_53 = False; self.reloj = None
        self.detalle = []   # qué rechazó, a quién y por qué: lo que en el rancho sería «no se pudo subir»
        import atexit
        atexit.register(lambda: self.detalle and print("   [nube] rechazó:", "; ".join(sorted({f"{t}·{r}·{m}" for t, r, m in self.detalle}))[:1500], flush=True))
    def rechazar(self, tabla, c, porque, f=None):
        self.rechazos.append(tabla); self.detalle.append((tabla, (c or {}).get("rol", "sin sesión"), porque))
        import os
        if os.environ.get("NUBE_DETALLE"):
            datos = (f or {}).get("datos") if isinstance((f or {}).get("datos"), dict) else {}
            print("   [nube rechaza]", tabla, (c or {}).get("rol"), porque, (f or {}).get("id"), sorted(k for k in datos if not k.startswith("_"))[:25], flush=True)
    def ahora(self):
        return (self.reloj() if self.reloj else datetime.datetime.now(datetime.timezone.utc)).isoformat().replace("+00:00", "Z")
    def quien(self, r):
        return self.cuentas.get((r.headers.get("authorization") or "").replace("Bearer ", ""))
    def sellar(self, f, c):
        viejo = self.t.setdefault("eventos", {}).get(f["id"])
        fila = {k: v for k, v in f.items() if k in ("id", "tipo", "fecha", "estado", "datos")}
        # Igual que la hoja 53: el sello original viaja al lado del evento sólo para restaurar, y nunca se guarda dentro.
        sello = (fila.get("datos") or {}).get("_selloOriginal") if isinstance(fila.get("datos"), dict) else None
        if isinstance(fila.get("datos"), dict): fila["datos"] = {k: v for k, v in fila["datos"].items() if k != "_selloOriginal"}
        if not viejo and isinstance(sello, dict) and c["rol"] == "superadmin" and c["id"] in self.restaurando:
            cand = {**fila, "recibido": sello.get("recibido"), "validacion": sello.get("validacion"), "validacion_dice": sello.get("dice"), "validado_por": sello.get("por"), "validado_rol": sello.get("rol"), "validado": sello.get("cuando")}
            if sello.get("firma") and sello.get("firma") == firma(cand):          # sólo el sello que la propia nube firmó
                cand.update(actualizado=self.ahora(), restaurado=self.ahora(), restaurado_por=c["id"], sello_firma=sello["firma"]); return cand
        if viejo: fila = {**viejo, "estado": f.get("estado", viejo.get("estado")), "datos": f.get("datos", viejo.get("datos"))}
        else: fila.update(recibido=self.ahora(), validacion=None, validacion_dice=None, validado_rol=None)
        fila["actualizado"] = self.ahora()
        op = SENSIBLES.get(f.get("tipo"))
        if op and not viejo:
            ok = op in self.otorgados.get(c["id"], []) or (c["rol"] == "superadmin" and op not in SOLO_OTORGADOS)
            dice = None if ok else "sin_permiso"
            # Como la base: un pago, un abono o un préstamo sin importe en `datos.monto` no se autoriza.
            if ok and PIDE_IMPORTE.get(f.get("tipo")):
                try: monto = float(((fila.get("datos") or {}).get("datos") or {}).get("monto"))
                except Exception: monto = None
                if not monto or monto <= 0: ok = False; dice = "importe"
            fila.update(validacion="autorizado" if ok else "rechazado", validacion_dice=dice, validado_rol=c["rol"], validado_por=c["id"], validado=self.ahora())
        if not viejo or viejo.get("estado") == "vigente": fila["sello_firma"] = firma(fila)
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
        if ruta == "/rest/v1/rpc/abrir_restauracion":
            if not c or c["rol"] != "superadmin": return J({"code": "P0001", "message": "Sólo un superadministrador puede restaurar un respaldo"}, 400)
            if self.sin_hoja_53: return J({"code": "PGRST202", "message": "Could not find the function public.abrir_restauracion(p_motivo) in the schema cache"}, 404)
            self.restaurando.add(c["id"]); self.restauraciones.append({"abierta_por": c["id"], "motivo": cuerpo.get("p_motivo"), "desde": self.ahora(), "eventos": 0}); return J(self.ahora())
        if ruta == "/rest/v1/rpc/borrar_registro":
            # Como la hoja 30: borrar no quita el renglón, le pone una lápida que los demás teléfonos bajan.
            if not c: return J({"code": "42501", "message": "sin sesión"}, 401)
            fila = self.t.get(cuerpo.get("p_tabla"), {}).get(str(cuerpo.get("p_id")))
            if fila: fila["borrado"] = self.ahora(); fila["actualizado"] = self.ahora()
            return J(bool(fila))
        if ruta.startswith("/rest/v1/rpc/"): return J(None)
        if ruta == "/rest/v1/perfiles":
            objeto = "vnd.pgrst.object" in (r.headers.get("accept") or "")
            fila = {"id": c["id"], "nombre": c["nombre"], "rol": c["rol"]} if c else None
            return J(fila if objeto else ([fila] if fila else []))
        if ruta == "/rest/v1/operacion": return J({"espacio": E, "inicio_operaciones": self.inicio, "declarado_el": None, "nota": None})
        if not ruta.startswith("/rest/v1/"): return J({})
        tabla = ruta.split("/")[-1]; filas = self.t.setdefault(tabla, {})
        if tabla == "restauraciones": return J(self.restauraciones if c else [])
        if r.method == "GET":
            if self.depura and tabla in self.depura: print("   [nube]", tabla, "cuenta:", c and c["rol"], "filas:", len(filas), (r.headers.get("authorization") or "")[-12:], flush=True)
            if not c: return J([])
            # Como la base: lo que el perfil no puede leer no le llega (lista vacía, sin error).
            if not puede(c, tabla, "leer"): return J(None if "vnd.pgrst.object" in (r.headers.get("accept") or "") else [])
            lista = sorted(filas.values(), key=lambda x: (x.get("actualizado") or "", str(x.get("id"))))
            m = re.search(r"actualizado=gte\.([^&]+)", r.url)
            if m:
                desde = m.group(1).replace("%3A", ":").replace("%2B", "+")
                lista = [x for x in lista if (x.get("actualizado") or "") >= desde]
            # Como la base: `id=eq.<x>` devuelve ESE renglón, no el primero de la tabla (antes devolvía el primero, y una
            # unión de registros leía el de otra parcela).
            m = re.search(r"[?&]id=eq\.([^&]+)", r.url)
            if m:
                import urllib.parse
                quiere = urllib.parse.unquote(m.group(1)); lista = [x for x in lista if str(x.get("id")) == quiere]
            if "vnd.pgrst.object" in (r.headers.get("accept") or ""): return J(lista[0] if lista else None)
            return J(lista)
        if not c:
            self.rechazos.append(tabla); return J({"code": "42501", "message": "new row violates row-level security policy"}, 401)
        if r.method == "DELETE": return J([], 200)
        entran = cuerpo if isinstance(cuerpo, list) else [cuerpo]; salen = []
        prefer = r.headers.get("prefer") or ""
        solo_faltantes = "ignore-duplicates" in prefer
        # Como PostgREST: una columna que la tabla no tiene rechaza el renglón entero.
        if tabla in COLUMNAS:
            for f in entran:
                otra = next((k for k in (f or {}) if k not in COLUMNAS[tabla]), None) if isinstance(f, dict) else None
                if otra:
                    self.rechazar(tabla, c, f"columna {otra}"); return J({"code": "PGRST204", "message": f"Could not find the '{otra}' column of '{tabla}' in the schema cache"}, 400)
        import urllib.parse
        filtros = [(k, urllib.parse.unquote(v)) for k, v in re.findall(r"[?&](\w+)=eq\.([^&]+)", r.url)]
        if r.method == "PATCH":
            # Sin permiso de editar (o en la bitácora, que nadie cambia) la base no toca ningún renglón: lista vacía.
            if tabla == "auditoria" or not puede(c, tabla, "editar"): return J([], 200)
            # Actualizar: sólo los renglones que ya están y cumplen el filtro; si no hay ninguno, no pasa nada (lista vacía).
            for fid, ya in list(filas.items()):
                if not filtros or not all(str(ya.get(k)) == v for k, v in filtros): continue
                cambio = {**ya, **(entran[0] if entran and isinstance(entran[0], dict) else {}), "id": fid}
                self.subidas.append((tabla, fid, c["rol"]))
                g = self.sellar(cambio, c) if tabla == "eventos" else {**cambio, "actualizado": cambio.get("actualizado") or self.ahora()}
                filas[fid] = g; salen.append(g)
            return J(salen, 200)
        upsert = "merge-duplicates" in prefer or solo_faltantes or "on_conflict=" in r.url
        for f in entran:
            if not isinstance(f, dict) or "id" not in f: continue
            # Como la hoja 31: lo que entra sin la marca de ESTE espacio se rechaza, aunque quien lo suba tenga permiso.
            if tabla in COLUMNAS and "datos" in COLUMNAS[tabla] and tabla != "preferencias":
                if ((f.get("datos") or {}) if isinstance(f.get("datos"), dict) else {}).get("_espacio") != E:
                    self.rechazar(tabla, c, "sin marca de espacio"); return J({"code": "P0001", "message": f'Este registro no es de esta operación (espacio "{E}"). No se sube: puede ser un dato viejo o de prueba.'}, 400)
            # Como la base: un evento sin tipo o sin día no entra (columnas obligatorias).
            if tabla == "eventos" and (not f.get("tipo") or not f.get("fecha")):
                self.rechazar(tabla, c, "sin tipo o sin día"); return J({"code": "23502", "message": 'null value in column "fecha" of relation "eventos" violates not-null constraint'}, 400)
            # Como las reglas de la base: dar de alta pide «crear»; un upsert de algo que ya está va además por el camino
            # de actualizar, que pide «editar».
            if not puede(c, tabla, "crear") or (f["id"] in filas and not solo_faltantes and not puede(c, tabla, "editar")):
                self.rechazar(tabla, c, "sin permiso", f); return J({"code": "42501", "message": f'new row violates row-level security policy for table "{tabla}"'}, 403)
            # La bitácora de auditoría no tiene regla para cambiar: un upsert de algo que ya está va por el camino de
            # actualizar y la base lo rechaza (aunque sea lo mismo que ya subió).
            if tabla == "auditoria" and f["id"] in filas and not solo_faltantes:
                self.rechazar(tabla, c, "bitácora otra vez"); return J({"code": "42501", "message": 'new row violates row-level security policy (USING expression) for table "auditoria"'}, 403)
            if solo_faltantes and f["id"] in filas: continue          # lo que ya está no se toca
            if not upsert and f["id"] in filas:
                return J({"code": "23505", "message": f'duplicate key value violates unique constraint "{tabla}_pkey"'}, 409)
            # Igual que la hoja 56: un identificador ocupado por OTRO registro (otra marca de nacimiento) no se pisa.
            ya = filas.get(f["id"]); nace = lambda x: (x.get("datos") or {}).get("_nace") if isinstance(x.get("datos"), dict) else None
            if ya and nace(ya) and nace(f) != nace(ya):
                self.ocupados.append((tabla, f["id"], c["rol"])); return J({"code": "23505", "message": f'identificador_ocupado: ya existe otro registro con el identificador "{f["id"]}" en {tabla}. No se sobrescribió.'}, 409)
            self.subidas.append((tabla, f["id"], c["rol"]))
            g = self.sellar(f, c) if tabla == "eventos" else {**f, "actualizado": f.get("actualizado") or self.ahora()}
            # Como la política «crear eventos» de la base: lo que entra por INSERT —también un upsert que acaba
            # actualizando— tiene que ser vigente (o venir restaurado con su sello). Cancelar o corregir es un UPDATE.
            if tabla == "eventos" and (f.get("estado") or "vigente") != "vigente" and not g.get("restaurado"):
                self.subidas.pop(); self.rechazar(tabla, c, "evento no vigente por alta")
                return J({"code": "42501", "message": 'new row violates row-level security policy for table "eventos"'}, 403)
            filas[g["id"]] = g; salen.append(g)
        return J(salen, 201)
    def cuantos(self): return {t: len(f) for t, f in sorted(self.t.items()) if f}
