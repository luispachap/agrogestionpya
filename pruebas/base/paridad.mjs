// ¿La base de PRODUCCIÓN es la misma que se arma y se ataca en las pruebas?
// Las pruebas de permisos corren contra una base aislada armada con las hojas del repositorio. Sólo valen para la de
// verdad si las dos tienen las mismas tablas, reglas, candados y funciones. Esto saca las huellas de la base de pruebas
// e imprime la consulta (de sólo lectura) que da las de producción: si las cuatro coinciden, son la misma.
// Uso: node pruebas/base/paridad.mjs      (no toca producción; la consulta se corre aparte)
import { armarBase } from "./base.mjs";
import { createHash } from "node:crypto";
const md5 = (t) => createHash("md5").update(t).digest("hex");
const b = await armarBase();
const q = async (s) => (await b.query(`select x::text x from (${s}) t`)).rows.map((r) => r.x);
const FUN = `p.proname||'|'||md5(regexp_replace(regexp_replace(p.prosrc, '--[^\\n]*', '', 'g'), '\\s+', '', 'g'))||'|'||p.prosecdef`;
const SQL = {
  reglas: `select tablename||'|'||policyname||'|'||cmd||'|'||array_to_string(roles, ',')||'|'||md5(regexp_replace(coalesce(qual,'')||'/'||coalesce(with_check,''), '[\\s()]+|::[a-z ]+|public\\.', '', 'g')) x from pg_policies where schemaname='public'`,
  funciones: `select ${FUN} x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'rls_auto_enable'`,
  tablas: `select c.relname||'|'||c.relrowsecurity x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`,
  permisos: `select to_jsonb(p) - 'actualizado' x from (select rol, tabla, leer, crear, editar, borrar from permisos_rol) p`,
  sensibles: `select to_jsonb(o) x from (select * from operaciones_sensibles) o`,
  puertas: `select p.proname||'|'||has_function_privilege('anon', p.oid, 'execute')||'|'||has_function_privilege('authenticated', p.oid, 'execute') x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'rls_auto_enable'`,
  candados: `select c.relname||'|'||tg.tgname||'|'||tg.tgenabled::text x from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tg.tgisinternal`,
};
const huella = (lista) => md5(lista.map(md5).sort().join(""));
for (const [k, s] of Object.entries(SQL)) { const l = await q(s); console.log(k.padEnd(10), String(l.length).padStart(4), huella(l)); }
if (process.argv.includes("--consulta")) console.log("\n" + Object.entries(SQL).map(([k, s]) => `select '${k}' k, count(*) n, md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")) huella from (${s}) t`).join("\nunion all "));
if (process.argv.includes("--detalle")) console.log(JSON.stringify(Object.fromEntries(await Promise.all(Object.entries(SQL).map(async ([k, s]) => [k, (await q(s)).sort()])))));
