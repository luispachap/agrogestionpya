// ════════════════════════════════════════════════════════════════════════
//  CHECADOR — quién llegó, a qué hora, y a qué hora se fue
//
//  La nave junta al 85–90 % de la gente antes de repartirse; el resto llega
//  directo a su rancho. Cada llegada y cada salida es un EVENTO ("marca"), y de
//  las marcas sale la jornada. Reglas que no se rompen:
//
//  · Entrar al rancho NO es trabajar en una parcela. La marca produce
//    presencia y horas en el rancho. A qué parcela se cargan esas horas lo dice
//    la asignación de cuadrilla, que es otro evento.
//  · Una marca no se edita ni se borra: se cancela o se corrige, con motivo.
//  · Lo que no se sabe no se inventa: una entrada sin salida de ayer NO vale
//    "8 horas". Vale "sin cerrar", hasta que alguien con autoridad la cierre.
//  · La credencial lleva un código propio, no el PIN ni datos de la persona.
//    Si se pierde, se emite otra y la vieja deja de servir.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, cancelarEvento, corregirEvento, reglasDe } from "./eventos.js";

export const TIPO_MARCA = "marca";
export const NAVE = { tipo: "nave", id: "nave", nombre: "Nave" };
// Minutos en que una segunda lectura de la misma persona se toma como repetida
// y no como salida. Es una regla del rancho: se puede cambiar.
export const VENTANA_REPETIDA_MIN = 15;

// ── La credencial ──────────────────────────────────────────────────────────
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // sin 0/O ni 1/I/L: se confunden impresas
export function codigoNuevo(azar = Math.random) {
  let c = "";
  for (let i = 0; i < 10; i++) c += LETRAS[Math.floor(azar() * LETRAS.length) % LETRAS.length];
  return c;
}
// Emitir (o volver a emitir) la credencial de un trabajador. La anterior deja de servir.
export function emitirCredencial(trabajador, { cuando, quien, azar }) {
  const anteriores = [...(trabajador.credencialesAnteriores || [])];
  if (trabajador.credencial?.codigo) anteriores.push({ ...trabajador.credencial, hasta: cuando });
  return { ...trabajador, credencial: { codigo: codigoNuevo(azar), emitida: cuando, por: quien?.nombre || "" }, credencialesAnteriores: anteriores };
}
// Lo que va dentro del QR. Sólo el id y el código: ni nombre, ni PIN, ni sueldo.
export const textoDeCredencial = (trabajador) => (trabajador?.credencial?.codigo ? `AGRO1:T:${trabajador.id}:${trabajador.credencial.codigo}` : "");
export function leerCredencial(texto) {
  const p = String(texto || "").trim().split(":");
  if (p.length < 4 || p[0] !== "AGRO1" || p[1] !== "T") return null;
  return { id: p.slice(2, -1).join(":"), codigo: p[p.length - 1] };
}

// ¿De quién es este QR? Dice por qué no, cuando no.
export function quienEsPorQR(texto, trabajadores) {
  const c = leerCredencial(texto);
  if (!c) return { ok: false, dice: "Ese código no es una credencial del rancho." };
  const t = (trabajadores || []).find(x => x.id === c.id);
  if (!t) return { ok: false, dice: "Esa credencial no está en este aparato. Si es nueva, falta que el aparato baje los datos." };
  if (t.activo === false) return { ok: false, dice: `${t.nombre} está dado de baja.` };
  if (!t.credencial?.codigo || t.credencial.codigo !== c.codigo) return { ok: false, dice: `Esa credencial de ${t.nombre} ya no sirve: se emitió otra después.` };
  return { ok: true, trabajador: t, via: "qr" };
}
// El PIN es la alternativa cuando no trae la credencial.
export function quienEsPorPin(pin, trabajadores) {
  const p = String(pin || "").trim();
  if (p.length < 4) return { ok: false, dice: "El PIN es de 4 números o más." };
  const hallados = (trabajadores || []).filter(t => t.activo !== false && String(t.pin || "") === p);
  if (hallados.length === 0) return { ok: false, dice: "Ese PIN no es de nadie." };
  if (hallados.length > 1) return { ok: false, dice: "Ese PIN lo tienen dos personas. Hay que cambiarle el PIN a una antes de usarlo aquí." };
  return { ok: true, trabajador: hallados[0], via: "pin" };
}

// ── Las marcas ─────────────────────────────────────────────────────────────
const esMarca = (e) => e.tipo === TIPO_MARCA;
export const marcasDe = (eventos, { trabajadorId, fecha } = {}) =>
  vigentes(eventos).filter(e => esMarca(e) && (!trabajadorId || e.datos.trabajadorId === trabajadorId) && (!fecha || e.fecha === fecha))
    .sort((a, b) => a.cuando.localeCompare(b.cuando) || a.id.localeCompare(b.id));

const hora = (iso, zona) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: zona });

// ¿Qué toca: entrada, salida, o nada porque es la misma lectura repetida?
export function siguienteMarca(marcasDeHoy, ahora, { ventanaMin = VENTANA_REPETIDA_MIN, zona = "America/Mexico_City" } = {}) {
  const ultima = marcasDeHoy[marcasDeHoy.length - 1];
  if (!ultima) return { hacer: "entrada" };
  const min = (new Date(ahora) - new Date(ultima.cuando)) / 60000;
  if (min >= 0 && min < ventanaMin) return { hacer: "nada", dice: `Ya quedó tu ${ultima.datos.sentido} de las ${hora(ultima.cuando, zona)}.` };
  return { hacer: ultima.datos.sentido === "entrada" ? "salida" : "entrada" };
}

// Registrar una lectura en el checador. Devuelve el evento a guardar, o por qué no.
export function marcar({ eventos, trabajador, via, ahora, fecha, quien, lugar = NAVE, ventanaMin, zona, azar }) {
  if (!trabajador?.id) return { ok: false, dice: "No se sabe de quién es la marca." };
  const remoto = lugar.tipo !== "nave";
  if (remoto && !["admin", "encargado"].includes(quien?.rol)) return { ok: false, dice: "Una llegada directa a campo sólo la registra un encargado o un administrador." };
  const sig = siguienteMarca(marcasDe(eventos, { trabajadorId: trabajador.id, fecha }), ahora, { ventanaMin, zona });
  if (sig.hacer === "nada") return { ok: false, repetida: true, dice: sig.dice };
  const evento = nuevoEvento({
    tipo: TIPO_MARCA, cuando: ahora, fecha, quien, azar,
    datos: { trabajadorId: trabajador.id, sentido: sig.hacer, via: remoto ? "remoto" : via, lugar, ...(remoto ? { autorizo: quien.nombre || quien.id } : {}) },
  });
  return { ok: true, evento, sentido: sig.hacer };
}

// Una marca que faltó (se le olvidó checar, se fue la luz). Es una corrección:
// lleva motivo y queda dicho quién la puso y cuándo, aparte de la hora que vale.
export function marcaQueFalto({ trabajadorId, sentido, cuando, fecha, motivo, quien, capturado, lugar = NAVE, azar }) {
  if (!["entrada", "salida"].includes(sentido)) return { ok: false, dice: "Falta decir si es entrada o salida." };
  if (!String(motivo || "").trim()) return { ok: false, dice: "Hay que decir por qué se pone a mano." };
  if (!["admin", "encargado"].includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador pone una marca a mano." };
  if (new Date(cuando) > new Date(capturado)) return { ok: false, dice: "No se puede poner una marca en el futuro." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_MARCA, cuando, fecha, capturado, quien, azar, datos: { trabajadorId, sentido, via: "correccion", lugar, motivo: String(motivo).trim() } }) };
}
export const cancelarMarca = cancelarEvento;
export const cambiarHoraDeMarca = (marca, cuando, opciones) => corregirEvento(marca, { cuando }, opciones);
// Si era salida y quedó como entrada (o al revés). El sentido se guarda con la
// marca —no se adivina por el orden—, así que voltearlo es una corrección con motivo.
export const voltearMarca = (marca, opciones) => corregirEvento(marca, { datos: { sentido: marca.datos.sentido === "entrada" ? "salida" : "entrada" } }, opciones);

// ── La jornada sale de las marcas ──────────────────────────────────────────
// Por trabajador y día: los tramos (entrada→salida), los minutos SABIDOS, y lo
// que no cuadra dicho con su nombre. No inventa la hora que falta.
export function jornadasDe(eventos, { fecha, hoy, ahora } = {}) {
  const grupos = new Map();
  for (const m of marcasDe(eventos, { fecha })) {
    const k = `${m.datos.trabajadorId}|${m.fecha}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  }
  const salen = [];
  for (const [k, marcas] of grupos) {
    const [trabajadorId, dia] = k.split("|");
    const tramos = []; const avisos = []; let abierto = null;
    for (const m of marcas) {
      if (m.datos.sentido === "entrada") {
        if (abierto) { tramos.push({ entrada: abierto, salida: null, minutos: null }); avisos.push("Dos entradas seguidas: falta una salida en medio."); }
        abierto = m;
      } else if (abierto) {
        tramos.push({ entrada: abierto, salida: m, minutos: Math.max(0, Math.round((new Date(m.cuando) - new Date(abierto.cuando)) / 60000)) });
        abierto = null;
      } else {
        tramos.push({ entrada: null, salida: m, minutos: null }); avisos.push("Una salida sin entrada.");
      }
    }
    const adentro = !!abierto && dia === hoy;
    if (abierto) {
      tramos.push({ entrada: abierto, salida: null, minutos: null });
      if (!adentro) avisos.push("Entró y no checó salida. Las horas de ese tramo no se saben.");
    }
    const cerrados = tramos.filter(t => t.minutos != null);
    const corriendo = adentro && ahora ? Math.max(0, Math.round((new Date(ahora) - new Date(abierto.cuando)) / 60000)) : 0;
    salen.push({
      trabajadorId, fecha: dia, tramos, adentro,
      minutos: cerrados.reduce((s, t) => s + t.minutos, 0),      // sólo lo que se sabe
      minutosCorriendo: corriendo,                                 // lo que lleva hoy, todavía abierto
      completa: avisos.length === 0 && !adentro,                   // ¿se puede pagar con esto sin preguntar?
      avisos, eventos: marcas.map(m => m.id),
      primera: marcas[0], lugar: marcas[0].datos.lugar || NAVE,
      aMano: marcas.some(m => m.datos.via === "correccion" || m.relacion === "corrige"),
    });
  }
  return salen.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.primera.cuando.localeCompare(b.primera.cuando));
}

// El día de un vistazo: quién está, quién ya se fue, quién no ha llegado, y qué no cuadra.
export function resumenDelDia(eventos, trabajadores, { fecha, hoy, ahora }) {
  const js = jornadasDe(eventos, { fecha, hoy, ahora });
  const porId = new Map(js.map(j => [j.trabajadorId, j]));
  const activos = (trabajadores || []).filter(t => t.activo !== false);
  return {
    adentro: js.filter(j => j.adentro), salieron: js.filter(j => !j.adentro && j.avisos.length === 0),
    porRevisar: js.filter(j => j.avisos.length > 0),
    sinLlegar: activos.filter(t => !porId.has(t.id)),
    desconocidos: js.filter(j => !activos.some(t => t.id === j.trabajadorId)),
    jornadas: js,
  };
}

// Días con presencia, para quien todavía lee la asistencia como "vino / no vino".
export function presenciasDe(eventos) {
  const vistos = new Map();
  for (const m of marcasDe(eventos)) if (m.datos.sentido === "entrada") vistos.set(`${m.datos.trabajadorId}|${m.fecha}`, m.id);
  return vistos;   // "trabajador|fecha" → evento de donde sale
}

export const horasYMinutos = (min) => (min == null ? "no se sabe" : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);

// La consecuencia de una marca: presencia en el rancho. Nada de costo: el
// costo sale de a qué se asignaron las horas, no de haber entrado.
reglasDe(TIPO_MARCA, (e) => [{ clase: e.datos.sentido === "entrada" ? "llegada" : "retiro", trabajadorId: e.datos.trabajadorId, lugar: e.datos.lugar || NAVE, cuando: e.cuando }]);
