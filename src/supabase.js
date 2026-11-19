import { createClient } from "@supabase/supabase-js";

// Sólo estas dos variables, y las dos son públicas por diseño.
// TODA variable VITE_* se copia tal cual al JavaScript que baja cualquier
// visitante: aquí jamás puede leerse un correo ni una contraseña. La antigua
// "cuenta técnica compartida" se retiró por eso (docs/auditoria, C-2).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("Faltan variables de entorno de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
}

// Sin configuración la app debe abrir igual (modo sólo-teléfono), no quedar en blanco:
// createClient("") lanza un error, así que se le da una dirección que no existe.
export const supabase = createClient(url || "http://sin-configurar.invalid", anonKey || "sin-configurar", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const supabaseListo = !!(url && anonKey);
