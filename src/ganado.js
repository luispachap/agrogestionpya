// ============================================================
//  AgroGestión — El ganado
//
//  Aquí no había nada: ni "arete", ni "potrero", ni "vaca" aparecían en el
//  código. Lo que sí aparecía como "ganado" eran los "bonos ganados" de la
//  nómina.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE MANDA EN ESTE ARCHIVO
//  ─────────────────────────────────────────────────────────────
//  · **El tiempo de retiro es seguridad, no un dato más.** Vender un animal
//    antes de que pase el retiro de un medicamento le llega al consumidor. Si
//    NO se capturó el retiro de un tratamiento, la respuesta NO es "ya se
//    puede vender": es "no sé". Igual que la reentrada en las parcelas.
//  · **El hato se cuadra, no se ajusta.** Si el conteo físico no coincide con
//    el padrón, la diferencia se queda con su nombre. Un sistema que "cuadra
//    solo" borra justamente el dato que servía.
//  · **La mortandad también se anota.** Un animal que desaparece del padrón
//    sin baja es exactamente lo que hay que poder ver.
//  · **No se estima lo que no se midió.** Sin dos pesajes no hay ganancia
//    diaria; sin hectáreas no hay carga animal. Se dice, no se supone.
//
//  Sus pruebas están en src/ganado.test.js.
// ============================================================

import { sumarDinero, multiplicarDinero, diasEntre, fechaLocal } from "./calculos.js";

// Un número, o null si NO se capturó. `Number(null)` vale 0, y un peso de
// cero kilos no es lo mismo que un animal sin pesar.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ EL PADRÓN: CADA ANIMAL CON NOMBRE Y APELLIDO ════════════ */

export const ESTADOS_ANIMAL = ["en el hato", "vendido", "muerto", "robado", "regalado", "perdido"];
export const MOTIVOS_BAJA = ["vendido", "muerto", "robado", "regalado", "perdido"];

export const estaEnElHato = (a) => !a?.baja;

// Cuántos animales hay, según el padrón, y de dónde salieron. Cada baja lleva
// su motivo: un animal no puede simplemente dejar de aparecer.
export function cuadreDelHato({ animales, conteoFisico }) {
  const enHato = (animales || []).filter(estaEnElHato);
  const bajas = (animales || []).filter(a => a.baja);
  const porMotivo = {};
  for (const a of bajas) {
    const m = a.baja.motivo || "sin motivo";
    porMotivo[m] = (porMotivo[m] || 0) + 1;
  }
  const sinMotivo = bajas.filter(a => !a.baja.motivo).length;

  const contado = num(conteoFisico);
  if (contado === null) {
    return {
      segunPadron: enHato.length, contado: null, diferencia: null, bajas: bajas.length, porMotivo, sinMotivo,
      dice: `El padrón dice ${enHato.length} animales. Nadie los ha contado en el potrero, así que no se sabe si es cierto.`,
      ajustaSolo: false,
    };
  }
  const dif = contado - enHato.length;
  return {
    segunPadron: enHato.length, contado, diferencia: dif, bajas: bajas.length, porMotivo, sinMotivo,
    // El padrón NO se ajusta al conteo. La diferencia se queda con su nombre:
    // un animal que falta es una pregunta, no un número que se corrige.
    ajustaSolo: false,
    dice: dif === 0
      ? `Cuadra: ${contado} animales contados contra ${enHato.length} del padrón.`
      : `Se contaron ${contado} y el padrón dice ${enHato.length}: ${dif > 0 ? "sobran" : "faltan"} ${Math.abs(dif)}. La diferencia queda registrada tal cual; hay que ponerle nombre, no ajustarla.`,
  };
}

/* ════════════ LA BÁSCULA: LO QUE SUBE CADA DÍA ════════════ */

// Ganancia diaria de peso entre dos pesajes. Con un solo pesaje NO hay
// ganancia que calcular, y decirlo vale más que inventar una.
export function gananciaDiaria(pesajes) {
  const ps = (pesajes || [])
    .map(p => ({ fecha: p.fecha, kg: num(p.kg) }))
    .filter(p => p.fecha && p.kg !== null)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  if (ps.length < 2) {
    return {
      hay: false, gdp: null, pesajes: ps.length,
      dice: ps.length === 0 ? "Este animal no tiene ningún pesaje." : "Sólo hay un pesaje: hace falta otro para saber cuánto sube al día.",
    };
  }
  const a = ps[0], b = ps[ps.length - 1];
  const dias = diasEntre(a.fecha, b.fecha);
  if (!dias || dias <= 0) {
    return { hay: false, gdp: null, pesajes: ps.length, dice: "Los dos pesajes son del mismo día: no se puede sacar la ganancia diaria." };
  }
  const gdp = Math.round(((b.kg - a.kg) / dias) * 1000) / 1000;
  return {
    hay: true, gdp, dias, pesoInicial: a.kg, pesoActual: b.kg, pesajes: ps.length,
    dice: `Subió ${Math.round((b.kg - a.kg) * 10) / 10} kg en ${dias} días: ${gdp} kg por día.`,
  };
}

/* ════════════ LA JERINGA: HASTA CUÁNDO NO SE VENDE ════════════ */

// El tiempo de retiro son los días que deben pasar entre un tratamiento y la
// venta del animal (o de su leche) para que no llegue residuo al consumidor.
//
// **Vender antes del retiro es un problema serio.** Por eso, igual que con la
// reentrada en las parcelas: si NO se capturó el retiro de un medicamento, la
// respuesta NO es "ya se puede vender". Es "no sé".
export function puedeVenderse({ tratamientos, hoy }) {
  const dia = hoy || fechaLocal();
  const filas = (tratamientos || []).map(t => {
    const dias = num(t.retiroDias);
    return {
      ...t,
      retiroDias: dias,
      venderDesde: (dias === null || !t.fecha) ? null : sumarDiasSimple(t.fecha, dias),
    };
  });

  const bloquean = filas.filter(f => f.venderDesde && dia < f.venderDesde);
  const sinDato = filas.filter(f => f.retiroDias === null);

  if (bloquean.length > 0) {
    const ultimo = bloquean.reduce((a, b) => (a.venderDesde > b.venderDesde ? a : b));
    return {
      puede: false, estado: "en retiro", venderDesde: ultimo.venderDesde, sinDato,
      dice: `NO se puede vender hasta el ${ultimo.venderDesde}, por "${ultimo.producto || "un tratamiento"}" aplicado el ${ultimo.fecha}.`,
    };
  }
  if (sinDato.length > 0) {
    return {
      puede: false, estado: "no se sabe", venderDesde: null, sinDato,
      // "No sé" NO es "sí". Ésta es la regla que protege al consumidor.
      dice: `De ${sinDato.map(f => `"${f.producto || "un tratamiento"}"`).join(", ")} no se capturó el tiempo de retiro. Eso NO quiere decir que ya se pueda vender: quiere decir que no se sabe. Búscalo en el frasco.`,
    };
  }
  return {
    puede: true, estado: "libre", venderDesde: null, sinDato: [],
    dice: filas.length === 0 ? "Sin tratamientos registrados." : "Ya pasó el tiempo de retiro de todos sus tratamientos.",
  };
}

function sumarDiasSimple(fecha, dias) {
  const d = new Date(String(fecha).slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + (parseInt(dias, 10) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Los animales del hato que HOY no se pueden vender, y aparte los que no se
// sabe. Se separan a propósito: "no sé" es una alarma de dato faltante, no de
// peligro, y confundirlas enseña a ignorar las dos.
export function hatoParaVenta({ animales, tratamientos, hoy }) {
  const dia = hoy || fechaLocal();
  const porAnimal = new Map();
  for (const t of tratamientos || []) {
    if (!t?.animalId) continue;
    if (!porAnimal.has(t.animalId)) porAnimal.set(t.animalId, []);
    porAnimal.get(t.animalId).push(t);
  }
  const filas = (animales || []).filter(estaEnElHato).map(a => ({
    animal: a, ...puedeVenderse({ tratamientos: porAnimal.get(a.id) || [], hoy: dia }),
  }));
  return {
    filas,
    enRetiro: filas.filter(f => f.estado === "en retiro"),
    sinSaber: filas.filter(f => f.estado === "no se sabe"),
    libres: filas.filter(f => f.puede),
  };
}

/* ════════════ LO QUE NO SE VACUNÓ ════════════ */

// No es una lista de vacunas puestas: es la lista de los que FALTAN. Preguntar
// "¿a cuáles sí?" deja fuera justo a los que importan.
export function faltaVacuna({ animales, tratamientos, vacuna, cadaDias, hoy }) {
  const dia = hoy || fechaLocal();
  const ultima = new Map();
  for (const t of tratamientos || []) {
    if (!t?.animalId || normaliza(t.producto) !== normaliza(vacuna)) continue;
    const prev = ultima.get(t.animalId);
    if (!prev || String(t.fecha) > String(prev)) ultima.set(t.animalId, t.fecha);
  }
  const cada = num(cadaDias);
  const filas = (animales || []).filter(estaEnElHato).map(a => {
    const f = ultima.get(a.id) || null;
    const dias = f ? diasEntre(f, dia) : null;
    return {
      animal: a, ultima: f, diasDesde: dias,
      falta: f === null || (cada !== null && dias !== null && dias >= cada),
      nunca: f === null,
    };
  });
  return {
    filas,
    faltan: filas.filter(f => f.falta),
    nunca: filas.filter(f => f.nunca),
    dice: cada === null
      ? `No se sabe cada cuántos días toca "${vacuna}", así que sólo se puede decir a cuáles NUNCA se les ha puesto.`
      : `Toca cada ${cada} días.`,
  };
}

const normaliza = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/* ════════════ POTREROS Y CARGA ANIMAL ════════════ */

// Cuántos animales aguanta este pedazo. Se mide en unidades animal por
// hectárea.
//
// Si la parcela no tiene hectáreas capturadas, NO se estima una carga: se
// dice que falta el dato. Una carga inventada manda ganado a un potrero que
// no lo aguanta.
export function cargaAnimal({ potrero, animales }) {
  const ha = num(potrero?.hectareas);
  const cabezas = (animales || []).filter(a => estaEnElHato(a) && a.potreroId === potrero?.id);
  const ua = cabezas.reduce((s, a) => s + (num(a.unidadAnimal) ?? 1), 0);
  if (ha === null || ha <= 0) {
    return {
      cabezas: cabezas.length, unidadesAnimal: ua, hectareas: null, carga: null,
      dice: `${cabezas.length} animales en "${potrero?.nombre || "este potrero"}", pero no se han capturado sus hectáreas: no se puede decir si los aguanta.`,
    };
  }
  const carga = Math.round((ua / ha) * 100) / 100;
  const soporta = num(potrero?.cargaMaxima);
  return {
    cabezas: cabezas.length, unidadesAnimal: ua, hectareas: ha, carga,
    soporta,
    // Informa; no ordena mover el ganado.
    dice: soporta === null
      ? `${carga} unidades animal por hectárea. No se ha capturado cuánto aguanta este potrero, así que no hay con qué compararlo.`
      : `${carga} UA/ha contra las ${soporta} que se registraron para este potrero.`,
    llamaLaAtencion: soporta !== null && carga > soporta,
  };
}

/* ════════════ CUÁNTO CUESTA EL KILO QUE ESTÁS PRODUCIENDO ════════════ */

// Y dice SOBRE QUÉ está calculado. Si falta el costo de la alimentación o los
// kilos producidos, el número no se disfraza de completo.
export function costoPorKilo({ gastos, kilosProducidos }) {
  const kg = num(kilosProducidos);
  const total = sumarDinero((gastos || []).map(g => g.monto || 0));
  const falta = [];
  if (kg === null || kg <= 0) falta.push("kilos producidos");
  if ((gastos || []).length === 0) falta.push("gastos del hato");
  if (falta.length > 0) {
    return {
      porKilo: null, total, kilos: kg, completo: false, falta,
      dice: `No se puede sacar el costo por kilo: falta ${falta.join(" y ")}.`,
    };
  }
  return {
    porKilo: Math.round((total / kg) * 100) / 100,
    total, kilos: kg, completo: true, falta: [],
    dice: `${total} de gastos entre ${kg} kilos.`,
  };
}

/* ════════════ EL EMBARQUE: LOS KILOS QUE SALIERON Y LOS QUE LLEGARON ════════════ */

// La merma de embarque es normal (el animal se mueve, orina, se estresa). Lo
// que no es normal es no saber cuánta fue.
export function mermaDeEmbarque({ kilosSalida, kilosLlegada, cabezas }) {
  const s = num(kilosSalida), l = num(kilosLlegada);
  if (s === null || l === null) {
    return {
      merma: null, porciento: null,
      dice: s === null ? "No se pesó a la salida, así que no se puede saber la merma." : "No llegó el peso de destino todavía.",
    };
  }
  const merma = Math.round((s - l) * 10) / 10;
  const pct = s > 0 ? Math.round((merma / s) * 1000) / 10 : null;
  const n = num(cabezas);
  return {
    merma, porciento: pct, cabezas: n,
    porCabeza: n ? Math.round((merma / n) * 10) / 10 : null,
    // No dice si está bien o mal: eso lo sabe quien conoce el viaje.
    dice: `Salieron ${s} kg y llegaron ${l} kg: ${merma} kg de diferencia (${pct}%)${n ? `, ${Math.round((merma / n) * 10) / 10} kg por cabeza` : ""}.`,
  };
}
