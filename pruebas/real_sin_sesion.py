"""Ataques al proyecto REAL, desde internet, sólo con la llave pública (la que
viene dentro de la app y cualquiera puede sacar). No crea ni deja nada.
Uso: URL=https://xxxx.supabase.co LLAVE=<llave pública> python3 pruebas/real_sin_sesion.py"""
import json, os, sys, urllib.request, urllib.error
URL, LLAVE = os.environ["URL"].rstrip("/"), os.environ["LLAVE"]
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + det if det else ""))
def pedir(metodo, ruta, cuerpo=None, extra=None):
    h = {"apikey": LLAVE, "Authorization": "Bearer " + LLAVE, "Content-Type": "application/json", **(extra or {})}
    req = urllib.request.Request(URL + ruta, method=metodo, headers=h, data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

TABLAS = ["egresos", "ingresos", "trabajadores", "perfiles", "config_seguridad", "auditoria", "permisos_rol", "operacion", "invitaciones", "preferencias", "eventos",
          "limites", "uso_ia", "archivos", "actividades", "inventario", "bolsas", "prestamos", "cajachica", "creditos", "estados_cuenta", "parcelas"]
fugas = []
for t in TABLAS:
    s, c = pedir("GET", f"/rest/v1/{t}?select=*&limit=5")
    if s == 200 and c.strip() not in ("[]", ""): fugas.append(f"{t}: {c[:80]}")
caso(f"sin sesión no se lee nada de {len(TABLAS)} tablas", not fugas, "; ".join(fugas))

entro = []
for t in ["egresos", "trabajadores", "auditoria", "perfiles", "invitaciones", "archivos", "tareas"]:
    cuerpo = {"id": "ataque-sin-sesion", "datos": {"_espacio": URL.split("//")[1].split(".")[0]}} if t not in ("perfiles", "invitaciones") else \
             ({"id": "00000000-0000-0000-0000-000000000099", "nombre": "x", "rol": "superadmin"} if t == "perfiles" else {"correo": "x@x.invalid", "nombre": "x", "rol": "superadmin"})
    s, c = pedir("POST", f"/rest/v1/{t}", cuerpo, {"Prefer": "return=minimal"})
    if s in (200, 201, 204): entro.append(t)
caso("sin sesión no se escribe en ninguna tabla (ni perfiles ni invitaciones)", not entro, ", ".join(entro))

abiertas = []
for f, args in [("consumo", {}), ("tiene_perfil", {}), ("puede", {"p_tabla": "egresos", "p_accion": "leer"}), ("reclamar_acceso", {"p_codigo": "x"}),
                ("borrar_registro", {"p_tabla": "tareas", "p_id": "x"}), ("sellar_espacio", {"p_espacio": "otro"}),
                ("preparar_arranque", {"p_huella": "a" * 64, "p_usos": 9, "p_dias": 99}), ("declarar_inicio", {"p_fecha": "2020-01-01"}),
                ("restaurar_registro", {"p_tabla": "tareas", "p_id": "x"})]:
    s, c = pedir("POST", f"/rest/v1/rpc/{f}", args)
    if s == 200: abiertas.append(f"{f} → {c[:40]}")
caso("sin sesión no se puede llamar ninguna función de la base", not abiertas, "; ".join(abiertas))

s, c = pedir("GET", "/storage/v1/object/list/comprobantes")
s2, c2 = pedir("POST", "/storage/v1/object/list/comprobantes", {"prefix": "", "limit": 10})
caso("sin sesión no se listan los comprobantes", not (s2 == 200 and c2.strip() not in ("[]", "")), f"{s2} {c2[:60]}")
s, c = pedir("POST", "/storage/v1/object/comprobantes/ataque.jpg", None, {"Content-Type": "image/jpeg"})
caso("sin sesión no se sube un archivo", s not in (200, 201), f"{s}")
s, c = pedir("GET", "/storage/v1/object/public/comprobantes/cualquiera.jpg")
caso("el almacén no tiene enlaces públicos", s != 200, f"{s}")
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
