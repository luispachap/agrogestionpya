"""LO PUBLICADO ES EXACTAMENTE LO PROBADO. Compila esta misma versión con la configuración pública de producción y
compara cada archivo, byte por byte, contra lo que sirve el sitio. No entra a ninguna cuenta ni toca datos.
Uso:  SITIO=https://app.agroselectos.com URL=https://<proyecto>.supabase.co LLAVE=<llave pública> python3 pruebas/real_identico.py"""
import glob, hashlib, os, ssl, subprocess, sys, tempfile, urllib.request
SITIO = os.environ.get("SITIO", "https://app.agroselectos.com").rstrip("/")
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt") if os.path.exists("/root/.ccr/ca-bundle.crt") else ssl.create_default_context()
baja = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), context=ctx, timeout=60).read()
D = tempfile.mkdtemp(prefix="dist-prod-")
r = subprocess.run(["npx", "vite", "build", "--outDir", D], env={**os.environ, "VITE_SUPABASE_URL": os.environ["URL"], "VITE_SUPABASE_ANON_KEY": os.environ["LLAVE"]}, capture_output=True, text=True)
if r.returncode: print(r.stdout[-800:], r.stderr[-800:]); sys.exit(1)
iguales, distintos = 0, []
for ruta in sorted(glob.glob(D + "/assets/*")) + [D + "/index.html", D + "/sw.js"]:
    rel = ruta[len(D):]
    try: pub = baja(SITIO + ("/" if rel == "/index.html" else rel))
    except Exception as e: distintos.append(f"{rel}: no se pudo bajar ({type(e).__name__})"); continue
    if hashlib.sha256(pub).digest() == hashlib.sha256(open(ruta, "rb").read()).digest(): iguales += 1
    else: distintos.append(f"{rel}: distinto ({len(pub)} publicado, {os.path.getsize(ruta)} local)")
version = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
for d in distintos: print("FALLA", d)
print(f"{iguales} de {iguales + len(distintos)} archivos idénticos a la versión {version}")
sys.exit(0 if not distintos else 1)
