// Una base de datos de verdad (Postgres), pero DENTRO de la prueba: no toca
// Supabase ni ningún dato real. Se arma con las mismas hojas SQL del rancho y
// se le habla como le hablaría alguien que se brinca la app y llama directo.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../../supabase/", import.meta.url));
// El orden para armar la base desde cero: el mismo que se usa para montar la real.
export const ORDEN = JSON.parse(readFileSync(DIR + "orden.json", "utf8")).hojas;
const HOJAS_VIEJAS = ORDEN.slice(0, ORDEN.indexOf("24-permisos-por-rol"));   // lo que tenía la base anterior
const HOJAS_NUEVAS = ORDEN.slice(ORDEN.indexOf("24-permisos-por-rol"));

export const leerHoja = (nombre) =>
  readFileSync(DIR + nombre + ".sql", "utf8").replace(/create extension[^;]*;/gi, "");

// Cuentas de mentira. Ningún dato real.
export const CUENTAS = {
  luis:      "00000000-0000-0000-0000-000000000001",
  migue:     "00000000-0000-0000-0000-000000000002",
  encargado: "00000000-0000-0000-0000-000000000003",
  agronomo:  "00000000-0000-0000-0000-000000000004",
  finanzas:  "00000000-0000-0000-0000-000000000005",
  dueno:     "00000000-0000-0000-0000-000000000006",
  intruso:   "00000000-0000-0000-0000-000000000099", // se registró solo, sin perfil
};

export async function armarBase({ con24 = true } = {}) {
  const db = new PGlite();
  // Lo que Supabase ya trae puesto: las cuentas, auth.uid() y los dos papeles.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    -- El almacén de archivos de Supabase, en chiquito: las mismas dos tablas.
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
      name text, owner uuid, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated;
  `);
  for (const h of HOJAS_VIEJAS) await db.exec(leerHoja(h));
  for (const [nombre, id] of Object.entries(CUENTAS))
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, nombre + "@prueba.invalid"]);
  // Perfiles puestos por el dueño de la base (como desde el panel).
  const rolViejo = { luis: "admin", migue: "admin" };
  for (const n of ["luis", "migue", "encargado", "agronomo", "finanzas", "dueno"])
    await db.query("insert into perfiles (id, nombre, rol) values ($1, $2, $3)",
      [CUENTAS[n], "Prueba " + n, rolViejo[n] || n]);
  if (con24) {
    for (const h of HOJAS_NUEVAS) await db.exec(leerHoja(h));
    await db.query("update perfiles set rol = 'superadmin' where id in ($1, $2)", [CUENTAS.luis, CUENTAS.migue]);
  }
  await db.exec("grant all on all tables in schema public to anon, authenticated;");
  // Datos sintéticos, uno por tabla sensible.
  await db.exec(`
    insert into egresos (id, datos) values ('e1', '{"monto": 1000}');
    insert into ingresos (id, datos) values ('i1', '{"monto": 5000}');
    insert into trabajadores (id, datos) values ('t1', '{"nombre": "PRUEBA UNO"}');
    insert into tareas (id, datos) values ('ta1', '{}');
    insert into config_seguridad (id, datos) values ('seg', '{"pin_admin": "hash-de-prueba"}');
    insert into auditoria (id, accion, quien, datos) values ('a1', 'cancelo', 'Prueba', '{}');
  `);
  return db;
}

// Ejecuta como lo haría una persona con esa cuenta llamando DIRECTO a la base.
// quien = null → sin sesión (sólo la llave pública).
export async function como(db, quien, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [quien ? CUENTAS[quien] : ""]);
  await db.exec(`set role ${quien ? "authenticated" : "anon"}`);
  try {
    const r = await db.query(sql, params);
    return { ok: true, filas: r.rows, afectadas: r.affectedRows ?? 0 };
  } catch (e) {
    return { ok: false, error: String(e.message), filas: [], afectadas: 0 };
  } finally {
    await db.exec("reset role");
  }
}

// La verdad, vista por el dueño de la base (sin reglas de por medio).
export const verdad = async (db, sql, params = []) => (await db.query(sql, params)).rows;
