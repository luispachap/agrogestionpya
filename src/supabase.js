import { createClient } from "@supabase/supabase-js";
import { espacioDe, llavesDe } from "./espacio.js";

// Sólo estas dos variables, y las dos son públicas por diseño.
// TODA variable VITE_* se copia tal cual al JavaScript que baja cualquier
// visitante: aquí jamás puede leerse un correo ni una contraseña. La antigua
// "cuenta técnica compartida" se retiró por eso (docs/auditoria, C-2).
// La dirección con la que se abrió la app, guardada ANTES de crear el cliente:
// si la persona viene del correo de confirmación, el cliente borra esa "cola"
// de la dirección en cuanto la procesa, y la app ya no sabría decirle qué pasó.
export const DIRECCION_AL_ABRIR = typeof window !== "undefined" ? window.location.href : "";

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

// El ESPACIO: cada proyecto de la nube tiene su propio cajón en el teléfono.
// La app de este proyecto nunca lee ni sube lo guardado para otro (ni lo de
// cuando la app estaba a prueba). Ver src/espacio.js.
// (En una recuperación en otro proyecto, VITE_ESPACIO_HEREDADO conserva el nombre de antes. No es un secreto.)
export const ESPACIO = espacioDe(url, import.meta.env.VITE_ESPACIO_HEREDADO);
export const LLAVES = llavesDe(ESPACIO);
