// Escribe en un archivo el SQL que arma la base del rancho sobre la «plataforma», en el mismo orden que base.mjs.
import { ORDEN, leerHoja, CUENTAS } from "../base/base.mjs";
import { writeFileSync } from "node:fs";
const corte = ORDEN.indexOf("24-permisos-por-rol");
let s = "\\set ON_ERROR_STOP on\n";
for (const h of ORDEN.slice(0, corte)) s += `-- hoja ${h}\n` + leerHoja(h) + "\n";
for (const [n, id] of Object.entries(CUENTAS)) s += `insert into auth.users (id, email, encrypted_password) values ('${id}', '${n}@prueba.invalid', 'hash-inventado-${n}');\n`;
const rolViejo = { luis: "admin", migue: "admin" };
for (const n of ["luis", "migue", "encargado", "agronomo", "finanzas", "dueno"]) s += `insert into perfiles (id, nombre, rol) values ('${CUENTAS[n]}', 'Prueba ${n}', '${rolViejo[n] || n}');\n`;
for (const h of ORDEN.slice(corte)) s += `-- hoja ${h}\n` + leerHoja(h) + "\n";
s += `update perfiles set rol = 'superadmin' where id in ('${CUENTAS.luis}', '${CUENTAS.migue}');\n`;
writeFileSync(process.argv[2], s);
