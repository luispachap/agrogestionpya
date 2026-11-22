"""Un almacén de archivos de mentira, con la misma puerta que el de Supabase: GET y POST /storage/v1/object/<almacén>/<nombre>.
Uso: python3 almacen_falso.py <puerto> <carpeta> <llave>"""
import sys, os, urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
PUERTO, CARPETA, LLAVE = int(sys.argv[1]), sys.argv[2], sys.argv[3]
os.makedirs(CARPETA, exist_ok=True)
def ruta(p):
    k = urllib.parse.unquote(p.split("/storage/v1/object/", 1)[1])
    return os.path.join(CARPETA, urllib.parse.quote(k, safe=""))
class M(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _ok(self): return self.headers.get("Authorization") == "Bearer " + LLAVE
    def do_GET(self):
        if not self._ok(): self.send_response(401); self.end_headers(); return
        f = ruta(self.path)
        if not os.path.exists(f): self.send_response(404); self.end_headers(); return
        b = open(f, "rb").read(); self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        if not self._ok(): self.send_response(401); self.end_headers(); return
        b = self.rfile.read(int(self.headers.get("Content-Length", 0))); open(ruta(self.path), "wb").write(b)
        self.send_response(200); self.send_header("Content-Length", "2"); self.end_headers(); self.wfile.write(b"{}")
HTTPServer(("127.0.0.1", PUERTO), M).serve_forever()
