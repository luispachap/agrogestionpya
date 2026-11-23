// ═════════════════════════════════════════════════════════════════════════════
//  CHECAR DESDE EL TELÉFONO PROPIO, CON SU UBICACIÓN (idea de Luis, 22 nov; docs/PROPUESTAS-ASISTENCIA.md §1)
//
//  Hoy se checa en el aparato que dejó un encargado (supervisado). Esto agrega el teléfono DE UNA PERSONA: un encargado
//  lo liga a esa persona (que tiene que estar activada en su ficha), y ahí sólo ella checa lo suyo. El teléfono
//  comprueba con el GPS que está cerca de algún rancho:
//   · cerca del suyo (o de cualquiera, si no tiene rancho de siempre): marca normal, con su posición y precisión;
//   · en otro rancho: tiene que decir a qué fue, y eso queda en la marca;
//   · lejos de todo rancho: NO se registra; se le dice que avise a su encargado;
//   · el GPS no dio precisión suficiente (bajo techo): la marca queda «por revisar», no se tira.
//  El GPS no necesita señal: la marca se guarda y sube después. Se puede falsear con aplicaciones: esto desanima el mal
//  uso, no lo vuelve imposible (y se dice). Radio y precisión son reglas del rancho, PROVISIONALES.
// ═════════════════════════════════════════════════════════════════════════════
import { distKm } from "./calculos.js";
import { marcar } from "./checador.js";
import { ajusteVigente } from "./cuadrillas.js";

const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
export const conUbicacion = (ranchos = []) => (ranchos || []).filter(r => Number.isFinite(num(r?.lat)) && Number.isFinite(num(r?.lng)));
export const puedeChecarConGps = (t) => !!t && t.activo !== false && !t._porBaja && t.checaConGps === "si";
export function reglasDeGps(eventos) {
  return { radioM: Number(ajusteVigente(eventos, "gps_radio_m").valor) || 300, precisionMaxM: Number(ajusteVigente(eventos, "gps_precision_m").valor) || 100 };
}

// ¿Dónde está? Con la posición que dio el teléfono, los ranchos con su ubicación y el rancho de siempre de la persona.
export function dondeEstoy({ posicion, ranchos, ranchoHabitualId = null, radioM = 300, precisionMaxM = 100 }) {
  const con = conUbicacion(ranchos);
  if (!con.length) return { estado: "sin_ranchos", marca: false, dice: "Ningún rancho tiene su ubicación todavía: tu encargado la pone en Ranchos. Mientras, checa en el aparato del encargado." };
  const lat = num(posicion?.lat), lng = num(posicion?.lng), precision = num(posicion?.precision);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { estado: "sin_gps", marca: false, dice: "El teléfono no dio tu ubicación. Revisa que la ubicación esté prendida y vuelve a intentar, o checa en el aparato del encargado." };
  const lista = con.map(r => ({ rancho: r, distanciaM: Math.round(distKm(lat, lng, num(r.lat), num(r.lng)) * 1000) })).sort((a, b) => a.distanciaM - b.distanciaM);
  const cerca = lista[0];
  const base = { distanciaM: cerca.distanciaM, rancho: cerca.rancho, precision: Number.isFinite(precision) ? Math.round(precision) : null };
  // Aunque el GPS venga impreciso, si ni con su margen de error alcanza a estar en un rancho, está lejos.
  if (Number.isFinite(precision) && precision > precisionMaxM && cerca.distanciaM - precision > radioM) return { ...base, estado: "lejos", marca: false, dice: `No estás en ningún rancho: el más cercano, ${cerca.rancho.nombre}, está a ${aTexto(cerca.distanciaM)} (el GPS dio ±${Math.round(precision)} m). No se registró. Avisa a tu encargado.` };
  if (Number.isFinite(precision) && precision > precisionMaxM) return { ...base, estado: "sin_precision", marca: true, porRevisar: true, dice: `El GPS dio tu ubicación con poca precisión (±${Math.round(precision)} m). La marca se guarda, pero queda por revisar.` };
  if (cerca.distanciaM > radioM) return { ...base, estado: "lejos", marca: false, dice: `No estás en ningún rancho: el más cercano, ${cerca.rancho.nombre}, está a ${aTexto(cerca.distanciaM)}. No se registró. Avisa a tu encargado.` };
  const suyo = !ranchoHabitualId || cerca.rancho.id === ranchoHabitualId;
  return suyo ? { ...base, estado: "en_su_rancho", marca: true, dice: `En ${cerca.rancho.nombre}, a ${aTexto(cerca.distanciaM)}.` }
    : { ...base, estado: "en_otro_rancho", marca: true, pideMotivo: true, dice: `Estás en ${cerca.rancho.nombre}, que no es tu rancho de siempre. Di a qué viniste.` };
}
const aTexto = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

// La marca desde el teléfono propio: la de siempre (`marcar`), con su posición y lo que se supo de dónde estaba.
export function marcaDesdeSuTelefono({ eventos, trabajador, soloDe, ahora, fecha, quien, posicion, donde, motivo = "", ventanaMin, azar }) {
  if (!soloDe?.id || trabajador?.id !== soloDe.id) return { ok: false, dice: `Este teléfono es de ${soloDe?.nombre || "otra persona"}: aquí sólo checa esa persona.` };
  if (!puedeChecarConGps(trabajador)) return { ok: false, dice: "A esta persona no la han activado para checar desde su teléfono. Que cheque en el aparato del encargado." };
  if (!donde?.marca) return { ok: false, dice: donde?.dice || "No se pudo saber dónde estás." };
  if (donde.pideMotivo && !String(motivo || "").trim()) return { ok: false, pideMotivo: true, dice: donde.dice };
  const r = marcar({ eventos, trabajador, via: "telefono_propio", ahora, fecha, quien, ventanaMin, azar,
    lugar: { tipo: "rancho", id: donde.rancho.id, nombre: donde.rancho.nombre } });
  if (!r.ok) return r;
  const gps = { lat: num(posicion.lat), lng: num(posicion.lng), precision: donde.precision, distanciaM: donde.distanciaM, ranchoId: donde.rancho.id, estado: donde.estado };
  return { ...r, evento: { ...r.evento, datos: { ...r.evento.datos, desdeSuTelefono: true, gps, ...(donde.porRevisar ? { porRevisar: true } : {}), ...(donde.pideMotivo ? { motivo: String(motivo).trim() } : {}) } } };
}

// Cómo se enseña en Jornadas: qué fue supervisado y qué no.
export function textoDeMarcaGps(marca) {
  const d = marca?.datos; if (!d?.desdeSuTelefono) return "";
  const g = d.gps || {}, lugar = d.lugar?.nombre || "un rancho";
  if (g.estado === "sin_precision") return `Desde su teléfono · por revisar: el GPS dio ±${g.precision} m`;
  if (g.estado === "en_otro_rancho") return `Desde su teléfono · en ${lugar} (no es el suyo) · ${d.motivo || "sin decir a qué"}`;
  return `Desde su teléfono · a ${aTexto(g.distanciaM ?? 0)} de ${lugar}`;
}
