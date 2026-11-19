import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Faltan variables de entorno de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
}

export const supabase = createClient(url || "", anonKey || "", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const supabaseListo = !!(url && anonKey);

// SEGURIDAD (auditoría Fase 1, hallazgo C-2): la "cuenta técnica compartida" queda
// DESACTIVADA. Toda variable VITE_* se copia tal cual al archivo JavaScript público,
// así que leer aquí un correo y una contraseña los dejaba al alcance de cualquiera
// que abriera la app. Se conservan los dos nombres exportados para no tocar App.jsx;
// el reemplazo correcto (identidad por persona validada en el servidor) está en
// docs/auditoria/00-DIAGNOSTICO.md, sección D.
export const cuentaTecnicaListo = false;
export async function iniciarConCuentaTecnica() {
  return { ok: false, motivo: "desactivada_por_seguridad" };
}
