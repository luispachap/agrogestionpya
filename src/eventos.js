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

// ── Lo sensible lo autoriza el servidor (hoja 37) ──────────────────────────
// Estos tipos de evento mueven dinero o reglas. La app los deja capturar, pero
// NO les da efecto hasta que la base los valida con la cuenta que los subió:
//   autorizado   la base comprobó el permiso → cuenta
//   pendiente    todavía no sube (sin señal) → se enseña "por validar", no cuenta
//   rechazado    la cuenta que lo subió no tenía el permiso → no cuenta, y se enseña
// El sello (`_validacion`) lo pone la base; nada que venga escrito en el evento lo sustituye.
// Esta lista es la misma de `operaciones_sensibles` en la base (hay prueba que las compara).
export const OPERACION_DE = {
  cierre_semana: "cerrar_semana", reapertura_semana: "cerrar_semana", confirmacion_pagos: "cerrar_semana",
  prestacion_determinada: "determinar_prestaciones", prestacion_saldo_inicial: "determinar_prestaciones",
  pago_personal: "autorizar_pagos", pago_prestacion: "autorizar_pagos", abono_prestamo: "autorizar_pagos", recibo_personal: "autorizar_pagos",
  decision_jornada: "decidir_asistencia", horas_reconocidas: "decidir_asistencia",
  ajuste: "cambiar_reglas",
  cierre_mes: "cerrar_mes", reapertura_mes: "cerrar_mes",
};
export const OPERACIONES = {
  cerrar_semana: "Cerrar y reabrir la semana, y confirmar sus pagos",
  determinar_prestaciones: "Determinar prestaciones y capturar sus saldos iniciales",
  autorizar_pagos: "Registrar pagos, abonos a préstamos y recibos",
  decidir_asistencia: "Decidir cómo se paga un día y reconocer horas adicionales",
  cambiar_reglas: "Cambiar las reglas del rancho",
  cerrar_mes: "Cerrar y reabrir el mes de costos",
};
// Sin servidor (un aparato que no está conectado a ninguna nube, o las pruebas) no hay quién valide:
// ahí mandan las reglas de la app. Con servidor, se exige el sello. Lo prende la app al arrancar.
let conServidor = false;
export const exigirValidacion = (si) => { conServidor = !!si; };
export const esSensible = (e) => !!OPERACION_DE[e?.tipo];
export function validacionDe(e) {
  if (!esSensible(e) || !conServidor) return "no_aplica";
  return e._validacion === "autorizado" ? "autorizado" : e._validacion === "rechazado" ? "rechazado" : "pendiente";
}
const cuenta = (e) => { const v = validacionDe(e); return v === "no_aplica" || v === "autorizado"; };
// ¿Se le deja capturar esto aquí? `permitido` es lo que la base dijo de la cuenta de este aparato
// (true/false); sin servidor no viene, y entonces manda el perfil con que se entró. Esto sólo evita
// ofrecer lo que la base va a rechazar: la que decide es la base.
export const SIN_PERMISO = "La cuenta con la que está conectado este aparato no tiene ese permiso. Lo asigna un administrador en Arranque, en Cuentas.";
export const negado = (quien, permitido, dice) => (permitido === true ? null : permitido === false ? SIN_PERMISO : quien?.rol === "admin" ? null : dice);
// Lo capturado que todavía no cuenta, para enseñarlo: por validar y rechazado.
export function sinValidar(eventos) {
  const pendientes = [], rechazados = [];
  for (const e of sinRepetir(eventos)) { if (!estaVigente(e)) continue; const v = validacionDe(e); if (v === "pendiente") pendientes.push(e); else if (v === "rechazado") rechazados.push(e); }
  return { pendientes, rechazados };
}
// Los vigentes, ya sin repetidos: quien pregunte por aquí nunca cuenta dos veces
// el mismo evento, aunque la lista venga de juntar dos aparatos.
// Y nunca uno sensible que la base no haya autorizado.
export const vigentes = (eventos) => sinRepetir(eventos).filter(e => estaVigente(e) && cuenta(e));

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

// Juntar lo de este aparato con lo que llegó de la nube. Un evento no cambia lo
// que dice, así que no hay "cuál versión gana": sólo importa si alguno de los
// dos ya dejó de estar vigente. Devuelve también cuáles son nuevos o cambiaron,
// para guardar sólo ésos.
export const SELLOS = ["_recibido", "_validacion", "_validacionDice", "_validadoPor", "_validadoRol", "_validado", "_cambioRechazado"];
export function juntarEventos(locales, deLaNube) {
  const porId = new Map((locales || []).filter(e => e?.id).map(e => [e.id, e]));
  const cambiaron = [];
  for (const n of deLaNube || []) {
    if (!n?.id) continue;
    const l = porId.get(n.id);
    if (!l || (estaVigente(l) && !estaVigente(n))) { porId.set(n.id, n); cambiaron.push(n); }
    // Aquí se canceló o corrigió algo sensible y la base NO lo aceptó (quien lo subió no tenía el permiso): vale lo de la base.
    else if (!estaVigente(l) && estaVigente(n) && n._cambioRechazado && n._cambioRechazado !== l._cambioRechazado) { porId.set(n.id, n); cambiaron.push(n); }
    // Lo único que la nube le agrega a un evento que ya se tenía: los sellos del servidor (cuándo lo recibió, si lo validó).
    else if (SELLOS.some(k => n[k] != null && n[k] !== l[k])) { const con = { ...l }; for (const k of SELLOS) if (n[k] != null) con[k] = n[k]; porId.set(n.id, con); cambiaron.push(con); }
  }
  return { eventos: [...porId.values()], cambiaron };
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
