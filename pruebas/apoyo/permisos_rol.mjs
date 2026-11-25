// Lo que cada perfil puede hacer en cada tabla, tal como queda en una base armada con las hojas SQL (todas sus altas y
// cambios ya aplicados). Lo lee la nube de imitación para negar lo que la base niega.
//   node pruebas/apoyo/permisos_rol.mjs   → { rol: { tabla: { leer, crear, editar } } }
import { armarBase, verdad } from "../base/base.mjs";
const db = await armarBase();
const filas = await verdad(db, "select rol, tabla, leer, crear, editar from permisos_rol order by rol, tabla");
const r = {};
for (const f of filas) (r[f.rol] ||= {})[f.tabla] = { leer: f.leer, crear: f.crear, editar: f.editar };
console.log(JSON.stringify(r));
