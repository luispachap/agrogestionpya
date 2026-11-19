// ════════════════════════════════════════════════════════════════════════
//  EVENTOS — una operación, múltiples consecuencias
//
//  El principio central de AgroGestión: lo que pasa en el rancho se captura
//  UNA vez, como un evento, y de ese evento salen todas sus consecuencias
//  (asistencia, existencias, costos, bitácora…). Ningún módulo lleva su propia
//  versión de lo mismo.
//
//  Las reglas, y cómo las cumple este archivo:
//
//  1. Una operación no se captura dos veces.
//     → El evento es el único registro que se captura. Todo lo demás se saca de él.
//  2. Cada efecto guarda de qué evento salió.
//     → Todo efecto lleva `ev` (el id del evento) y un id que SALE del id del
//       evento (`idDeEfecto`). No hay efecto huérfano.
//  3. El efecto sólo existe si se cumple su condición.
//     → Las consecuencias son REGLAS por tipo de evento (`reglasDe`). Una marca
//       de entrada produce presencia, no horas en una parcela; un retiro del
//       almacén produce "está en campo", no consumo.
//  4. Corregir y cancelar no borran.
//     → Un evento nunca cambia lo que dice. Se CANCELA (con motivo y con quién)
//       o se CORRIGE con un evento nuevo que apunta al anterior. Sólo los
//       eventos vigentes producen efectos, así que la compensación es automática
//       y el historial queda entero.
//  5. Sin señal y con reintentos no se duplica nada.
//     → Los efectos NO se guardan: se calculan de los eventos cada vez. Subir
//       dos veces el mismo evento es el mismo renglón (mismo id); y no existe
//       un "costo guardado aparte" que se pueda duplicar o quedar viejo.
//  6. Todos los módulos leen lo mismo.
//     → Todos preguntan a `efectosDe(eventos)`. No hay registros paralelos.
//  7. Toda cifra se puede rastrear.
//     → `rastroDe` lleva de un efecto a su evento y a toda su historia
//       (qué corrigió, quién lo canceló, por qué).
//
//  No es una arquitectura complicada: es una lista de eventos que sólo crece,
//  y funciones puras que la leen. Lo complicado sería lo otro.
// ════════════════════════════════════════════════════════════════════════

export const VIGENTE = "vigente";
export const CANCELADO = "cancelado";
export const CORREGIDO = "corregido";

// Lo ÚNICO que puede cambiar en un evento ya guardado. La base lo exige
// también (hoja 35): todo lo demás es inmutable, hasta para un superadministrador.
export const CAMPOS_QUE_CAMBIAN = ["estado", "cancelado", "corregidoPor", "_actualizado"];

// Un id que no choca aunque dos aparatos capturen sin señal a la misma hora:
// el tipo, el instante, y un tramo al azar. `azar` se puede pasar en pruebas.
export function idDeEvento(tipo, cuando, azar) {
  const t = new Date(cuando).getTime().toString(36);
  const r = (azar ?? Math.random()).toString(36).slice(2, 9).padEnd(7, "0");
  return `ev-${String(tipo || "x").replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase()}-${t}-${r}`;
}
export const idDeEfecto = (eventoId, clase, n = 0) => `${eventoId}:${clase}:${n}`;

// Nace un evento. `cuando` es el instante en que PASÓ (UTC); `fecha` es el día
// local del rancho; `capturado` es cuándo se tecleó, que puede ser después.
export function nuevoEvento({ id, tipo, cuando, fecha, capturado, quien, datos, origen = null, relacion = null, azar }) {
  if (!tipo) throw new Error("Un evento necesita tipo");
  if (!cuando || Number.isNaN(new Date(cuando).getTime())) throw new Error("Un evento necesita cuándo pasó");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Un evento necesita el día del rancho en que pasó");
  if (!quien || !quien.id) throw new Error("Un evento necesita quién lo capturó");
  if ((origen && !relacion) || (!origen && relacion)) throw new Error("Origen y relación van juntos");
  return {
    id: id || idDeEvento(tipo, cuando, azar), tipo, estado: VIGENTE,
    cuando: new Date(cuando).toISOString(), fecha, capturado: new Date(capturado || cuando).toISOString(),
    quien: { id: quien.id, nombre: quien.nombre || "", rol: quien.rol || "" },
    origen, relacion, datos: datos || {},
  };
}

export const estaVigente = (e) => !!e && (e.estado || VIGENTE) === VIGENTE;
export const vigentes = (eventos) => (eventos || []).filter(estaVigente);

// Cancelar: el evento se queda, tachado, y deja de producir efectos.
export function cancelarEvento(evento, { motivo, quien, cuando }) {
  if (!estaVigente(evento)) return { ok: false, dice: "Ese registro ya no está vigente." };
  if (!String(motivo || "").trim()) return { ok: false, dice: "Para cancelar hay que decir por qué." };
  if (!quien?.id) return { ok: false, dice: "Falta quién cancela." };
  return { ok: true, evento: { ...evento, estado: CANCELADO, cancelado: { motivo: String(motivo).trim(), por: { id: quien.id, nombre: quien.nombre || "" }, cuando: new Date(cuando).toISOString() } } };
}

// Corregir: nace un evento nuevo que apunta al anterior, y el anterior queda
// marcado como corregido. Lo que decía el anterior NO se toca.
export function corregirEvento(evento, cambios, { motivo, quien, cuando, azar }) {
  if (!estaVigente(evento)) return { ok: false, dice: "Ese registro ya no está vigente." };
  if (!String(motivo || "").trim()) return { ok: false, dice: "Para corregir hay que decir por qué." };
  if (!quien?.id) return { ok: false, dice: "Falta quién corrige." };
  const nuevo = nuevoEvento({
    tipo: evento.tipo, cuando: cambios.cuando || evento.cuando, fecha: cambios.fecha || evento.fecha, capturado: cuando,
    quien, origen: evento.id, relacion: "corrige", azar,
    datos: { ...evento.datos, ...(cambios.datos || {}), motivoCorreccion: String(motivo).trim() },
  });
  return { ok: true, anterior: { ...evento, estado: CORREGIDO, corregidoPor: nuevo.id }, nuevo };
}

// Si por una mezcla entre aparatos llega dos veces el mismo evento, es UNO.
// Gana el que ya no está vigente (una cancelación no se "des-hace" con una copia vieja).
export function sinRepetir(eventos) {
  const porId = new Map();
  for (const e of eventos || []) {
    if (!e?.id) continue;
    const ya = porId.get(e.id);
    if (!ya || (estaVigente(ya) && !estaVigente(e))) porId.set(e.id, e);
  }
  return [...porId.values()];
}

// ── Las consecuencias ──────────────────────────────────────────────────────
// Cada tipo de evento tiene UNA regla: recibe el evento (y los catálogos) y
// devuelve sus efectos. Las reglas se anotan desde el módulo de cada operación.
const REGLAS = new Map();
export function reglasDe(tipo, regla) { REGLAS.set(tipo, regla); }
export const tiposConRegla = () => [...REGLAS.keys()];

// Todos los efectos vigentes. Cada uno: { id, ev, clase, fecha, … }.
export function efectosDe(eventos, contexto = {}) {
  const salen = [];
  for (const e of sinRepetir(eventos)) {
    if (!estaVigente(e)) continue;
    const regla = REGLAS.get(e.tipo);
    if (!regla) continue;
    const conteo = {};
    for (const f of regla(e, contexto) || []) {
      const n = conteo[f.clase] = (conteo[f.clase] ?? -1) + 1;
      salen.push({ ...f, id: idDeEfecto(e.id, f.clase, n), ev: e.id, fecha: f.fecha || e.fecha });
    }
  }
  return salen;
}

// De una cifra a sus operaciones: el evento de donde salió el efecto, lo que
// ese evento corrigió antes, y lo que lo corrigió después.
export function rastroDe(eventos, eventoId) {
  const porId = new Map(sinRepetir(eventos).map(e => [e.id, e]));
  const cadena = []; const vistos = new Set();
  let e = porId.get(eventoId);
  while (e && !vistos.has(e.id)) { cadena.unshift(e); vistos.add(e.id); e = e.origen && e.relacion === "corrige" ? porId.get(e.origen) : null; }
  e = porId.get(eventoId);
  while (e?.corregidoPor && !vistos.has(e.corregidoPor) && porId.get(e.corregidoPor)) { e = porId.get(e.corregidoPor); cadena.push(e); vistos.add(e.id); }
  return cadena;
}
// Lo que cuelga de un evento sin corregirlo (una devolución de un retiro, el cierre de una jornada…).
export const derivadosDe = (eventos, eventoId) => sinRepetir(eventos).filter(e => e.origen === eventoId && e.relacion !== "corrige");

// ¿Se intentó cambiar algo que no se puede? Lo usa la app antes de guardar, y
// es la misma regla que la base aplica por su cuenta.
export function cambioPermitido(antes, despues) {
  const hondo = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
  const a = { ...antes }, d = { ...despues };
  for (const k of CAMPOS_QUE_CAMBIAN) { delete a[k]; delete d[k]; }
  return hondo(a) === hondo(d);
}
