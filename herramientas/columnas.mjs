// Las columnas que de verdad tiene cada tabla, leídas de las hojas SQL (supabase/NN-*.sql).
// Una columna escrita sin comillas en una hoja la guarda PostgreSQL en minúsculas («deQuien» es `dequien`): eso fue lo
// que el 24 nov dejó sin subir todos los mensajes del chat. La usan la prueba de filas y la nube de imitación.
//   node herramientas/columnas.mjs   → imprime { tabla: [columnas] } en JSON.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function columnasDeLasHojas(dir = new URL("../supabase/", import.meta.url)) {
  const cols = {};
  const nombre = (s) => (s.startsWith("\"") ? s.slice(1, -1) : s.toLowerCase());
  for (const f of readdirSync(dir).filter(n => /^\d+.*\.sql$/.test(n))) {
    const sql = readFileSync(new URL(f, dir), "utf8").replace(/--[^\n]*/g, "");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[\w]+"?)\s*\(([\s\S]*?)\n\s*\)\s*;/gi)) {
      const t = nombre(m[1]); cols[t] = cols[t] || new Set();
      for (const linea of m[2].split("\n")) {
        const tok = linea.trim().split(/\s+/)[0];
        if (!tok || /^(constraint|primary|unique|check|foreign|exclude|\))/i.test(tok)) continue;
        cols[t].add(nombre(tok.replace(/,$/, "")));
      }
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?("?\w+"?)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)/gi)) {
      const t = nombre(m[1]); cols[t] = cols[t] || new Set(); cols[t].add(nombre(m[2]));
    }
  }
  return cols;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const c = columnasDeLasHojas();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(c).map(([t, s]) => [t, [...s].sort()]))));
}
