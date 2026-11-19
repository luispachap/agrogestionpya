// ============================================================
//  AgroGestión — La siembra, medida mientras pasa
//
//  Este rancho es MÁS AGRÍCOLA QUE GANADERO. El ajo es el negocio; el ganado
//  es la parte chica. Todo lo que sigue está pensado para el surco.
//
//  ─────────────────────────────────────────────────────────────
//  LA IDEA: MEDIR CUANDO YA SE ESTÁN DETENIENDO
//  ─────────────────────────────────────────────────────────────
//  La sembradora se para sola cada rato a recargar semilla. Ese alto ya
//  existe, ya cuesta tiempo, y hoy no deja ningún dato. Si en ese momento se
//  anota cuánta semilla entró y por dónde va, sale gratis:
//
//   · Cuántos kilos de semilla por hectárea se están usando DE VERDAD, no los
//     que decía el plan.
//   · Cuánto falta y cuánta semilla se va a necesitar para terminar — a
//     tiempo de ir por ella, no cuando ya se paró la máquina.
//   · A qué ritmo va, para saber si acaba hoy.
//
//  Y en la cosecha cierra el círculo: cajas por hectárea, y cajas por kilo de
//  semilla. Ésa es la pregunta que de verdad importa.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · No estima lo que no se midió. Sin hectáreas capturadas no hay kg/ha; sin
//    dos recargas no hay ritmo. Se dice, no se supone.
//  · No ordena parar ni apurarse. Enseña el número y se calla.
//  · No corrige una recarga que se ve rara: la marca y la deja.
//
//  Sus pruebas están en src/siembra.test.js.
// ============================================================

import { sumarDinero, multiplicarDinero, diasEntre, fmt, fechaLocal } from "./calculos.js";

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ EL AVANCE, RECARGA POR RECARGA ════════════ */

// Cada recarga trae: cuándo fue, cuánta semilla entró, y por dónde va la
// máquina (hectáreas acumuladas o surcos). Con eso sale todo lo demás.
//
// Se pide el avance en HECTÁREAS acumuladas porque es lo que el tractorista
// puede decir mirando el terreno ("ya llevo como la mitad de las 8"). Si
// sabe surcos, se convierte con el ancho de siembra.
export function avanceDeSiembra({ recargas, hectareasTotales, kgPorHaPlaneado }) {
  const rs = [...(recargas || [])]
    .filter(r => r && r.cuando)
    .sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));

  const total = num(hectareasTotales);
  const kgTotal = rs.reduce((s, r) => s + (num(r.kg) ?? 0), 0);
  const ultima = rs[rs.length - 1];
  const hechas = ultima ? num(ultima.hectareasAcumuladas) : null;

  if (rs.length === 0) {
    return {
      hay: false, recargas: 0, kgUsados: 0, hectareasHechas: null,
      dice: "Todavía no se ha registrado ninguna recarga de semilla.",
    };
  }

  // Kilos por hectárea REALES. Sin hectáreas hechas no hay densidad: no se
  // inventa una a partir del plan.
  const kgPorHa = (hechas !== null && hechas > 0)
    ? Math.round((kgTotal / hechas) * 100) / 100
    : null;

  const plan = num(kgPorHaPlaneado);
  const desviacion = (kgPorHa !== null && plan !== null && plan > 0)
    ? Math.round(((kgPorHa - plan) / plan) * 100)
    : null;

  // Ritmo: hectáreas por hora entre la primera y la última recarga.
  const ritmo = calcularRitmo(rs);

  // Lo que falta, y la semilla que va a hacer falta para terminarlo.
  let faltaHa = null, semillaQueFalta = null, cuandoTermina = null;
  if (total !== null && hechas !== null) {
    faltaHa = Math.round((total - hechas) * 100) / 100;
    if (kgPorHa !== null && faltaHa > 0) semillaQueFalta = Math.round(faltaHa * kgPorHa * 10) / 10;
    if (ritmo.hay && faltaHa > 0) cuandoTermina = Math.round((faltaHa / ritmo.haPorHora) * 10) / 10;
  }

  return {
    hay: true,
    recargas: rs.length,
    kgUsados: Math.round(kgTotal * 10) / 10,
    hectareasHechas: hechas,
    hectareasTotales: total,
    kgPorHa, kgPorHaPlaneado: plan, desviacion,
    ritmo,
    faltaHa, semillaQueFalta, horasParaTerminar: cuandoTermina,
    porcentaje: (total !== null && total > 0 && hechas !== null)
      ? Math.round((hechas / total) * 100) : null,
    // Cada frase dice sobre qué está calculada.
    dice: armarFrase({ rs, total, hechas, kgTotal, kgPorHa, plan, desviacion, ritmo, faltaHa, semillaQueFalta, cuandoTermina }),
  };
}

function calcularRitmo(rs) {
  const conHa = rs.filter(r => num(r.hectareasAcumuladas) !== null);
  if (conHa.length < 2) {
    return { hay: false, porque: "Con una sola recarga no se puede sacar el ritmo: hace falta otra para saber cuánto avanzó entre las dos." };
  }
  const a = conHa[0], b = conHa[conHa.length - 1];
  const horas = (new Date(b.cuando) - new Date(a.cuando)) / 3600000;
  const ha = num(b.hectareasAcumuladas) - num(a.hectareasAcumuladas);
  if (!(horas > 0) || !(ha > 0)) {
    return { hay: false, porque: "Las recargas no traen suficiente diferencia de tiempo o de avance para sacar un ritmo." };
  }
  return {
    hay: true,
    haPorHora: Math.round((ha / horas) * 100) / 100,
    horas: Math.round(horas * 10) / 10,
    sobre: conHa.length,
  };
}

function armarFrase({ total, hechas, kgTotal, kgPorHa, plan, desviacion, ritmo, faltaHa, semillaQueFalta, cuandoTermina }) {
  const partes = [];
  if (hechas !== null && total !== null) partes.push(`Van ${hechas} de ${total} hectáreas.`);
  else if (hechas !== null) partes.push(`Van ${hechas} hectáreas. No se ha capturado la superficie de la parcela, así que no se sabe cuánto falta.`);
  else partes.push("No se ha anotado por dónde va la máquina, así que sólo se sabe cuánta semilla se ha cargado.");

  partes.push(`Se han usado ${Math.round(kgTotal * 10) / 10} kg de semilla.`);

  if (kgPorHa !== null) {
    partes.push(plan !== null
      ? `Van ${kgPorHa} kg por hectárea; el plan decía ${plan} (${desviacion > 0 ? "+" : ""}${desviacion}%).`
      : `Van ${kgPorHa} kg por hectárea. No se capturó cuánto decía el plan, así que no hay con qué compararlo.`);
  }
  if (semillaQueFalta !== null) {
    partes.push(`Para las ${faltaHa} hectáreas que faltan harían falta unos ${semillaQueFalta} kg más, al ritmo de siembra que llevan.`);
  }
  if (cuandoTermina !== null) partes.push(`A ${ritmo.haPorHora} ha/hora, faltan como ${cuandoTermina} horas.`);
  else if (!ritmo.hay) partes.push(ritmo.porque);
  return partes.join(" ");
}

// Una recarga que se ve rara. NO se corrige ni se borra: se marca. El patrón
// de quién captura mal también es información.
export function revisarRecarga({ recarga, anterior, kgPorHaEsperado }) {
  const kg = num(recarga?.kg);
  const ha = num(recarga?.hectareasAcumuladas);
  const avisos = [];
  if (kg === null) avisos.push("No se anotó cuánta semilla entró.");
  if (ha === null) avisos.push("No se anotó por dónde va la máquina. Sin eso no se puede saber el avance ni cuánto falta.");

  if (anterior && ha !== null) {
    const haAnt = num(anterior.hectareasAcumuladas);
    if (haAnt !== null && ha < haAnt) {
      avisos.push(`El avance (${ha} ha) es MENOR que el de la recarga anterior (${haAnt} ha). La máquina no va para atrás: o se tecleó mal, o se está sembrando otra parcela.`);
    }
    if (haAnt !== null && ha > haAnt && kg !== null && kgPorHaEsperado) {
      const densidad = kg / (ha - haAnt);
      const esperado = num(kgPorHaEsperado);
      if (esperado && (densidad > esperado * 1.6 || densidad < esperado * 0.5)) {
        avisos.push(`Entre esta recarga y la anterior van ${Math.round(densidad)} kg por hectárea, y lo normal aquí son ${esperado}. Puede ser el terreno, puede ser la calibración, o puede ser que un dato esté mal.`);
      }
    }
  }
  return {
    // Se guarda SIEMPRE. Igual que el vale de salida: lo que ya pasó, pasó.
    seGuarda: true,
    marcada: avisos.length > 0,
    avisos,
  };
}

/* ════════════ EL RENDIMIENTO: LA PREGUNTA QUE IMPORTA ════════════ */

// Cajas por hectárea, y cajas por kilo de semilla. Con eso se sabe si valió
// la pena la parcela, la variedad y la densidad de siembra.
//
// Y dice SOBRE QUÉ está calculado: si falta la superficie o falta la semilla,
// no se disfraza de completo.
export function rendimiento({ cajas, hectareas, kgSemilla, kgPorCaja }) {
  const c = num(cajas), ha = num(hectareas), kg = num(kgSemilla);
  const falta = [];
  if (c === null) falta.push("las cajas cosechadas");
  if (ha === null || ha <= 0) falta.push("las hectáreas de la parcela");

  if (falta.length > 0) {
    return {
      completo: false, falta, cajasPorHa: null, cajasPorKgSemilla: null,
      dice: `No se puede sacar el rendimiento: falta ${falta.join(" y ")}.`,
    };
  }

  const cajasPorHa = Math.round((c / ha) * 100) / 100;
  const cajasPorKg = (kg !== null && kg > 0) ? Math.round((c / kg) * 1000) / 1000 : null;
  const kilos = num(kgPorCaja) !== null ? Math.round(c * num(kgPorCaja)) : null;

  return {
    completo: true, falta: [],
    cajas: c, hectareas: ha, kgSemilla: kg,
    cajasPorHa,
    cajasPorKgSemilla: cajasPorKg,
    kilosTotales: kilos,
    kilosPorHa: kilos !== null ? Math.round((kilos / ha) * 10) / 10 : null,
    dice: [
      `${cajasPorHa} cajas por hectárea.`,
      cajasPorKg !== null ? `${cajasPorKg} cajas por cada kilo de semilla sembrado.` : "No se capturó la semilla usada, así que no se sabe cuántas cajas dio cada kilo.",
      kilos !== null ? `Son ${kilos} kg en total, ${Math.round((kilos / ha) * 10) / 10} kg por hectárea.` : null,
    ].filter(Boolean).join(" "),
  };
}

// Compara el rendimiento de varias parcelas o temporadas, lado a lado.
//
// NO dice cuál es la buena ni recomienda sembrar en una y no en otra: pone
// los números juntos y quien conoce el terreno saca la conclusión. La parcela
// que rindió menos puede ser la que se heló, y eso la app no lo sabe.
export function compararRendimientos(filas) {
  const buenas = (filas || [])
    .map(f => ({ ...f, r: rendimiento(f) }))
    .filter(f => f.r.completo);
  if (buenas.length === 0) {
    return { hay: false, filas: [], dice: "Todavía no hay ninguna parcela con cajas y hectáreas capturadas." };
  }
  const orden = [...buenas].sort((a, b) => b.r.cajasPorHa - a.r.cajasPorHa);
  const prom = Math.round((buenas.reduce((s, f) => s + f.r.cajasPorHa, 0) / buenas.length) * 100) / 100;
  return {
    hay: true,
    filas: orden.map(f => ({
      nombre: f.nombre, cajasPorHa: f.r.cajasPorHa, cajasPorKgSemilla: f.r.cajasPorKgSemilla,
      hectareas: f.r.hectareas, cajas: f.r.cajas,
      contraElPromedio: Math.round((f.r.cajasPorHa - prom) * 100) / 100,
    })),
    promedio: prom,
    incompletas: (filas || []).length - buenas.length,
    dice: `Promedio: ${prom} cajas por hectárea sobre ${buenas.length} parcela(s).` +
      ((filas || []).length - buenas.length > 0
        ? ` Quedaron fuera ${(filas || []).length - buenas.length} por no tener cajas o hectáreas capturadas — no es que hayan rendido cero.`
        : ""),
  };
}

/* ════════════ ¿CUÁNDO SE ACABA LA SEMILLA? ════════════ */

// Antes de que la máquina se pare por falta de semilla. Con lo que hay en
// bodega y el ritmo real de consumo, cuánto alcanza.
export function alcanzaLaSemilla({ existenciaKg, kgPorHa, hectareasQueFaltan, costoPorKg }) {
  const hay = num(existenciaKg);
  const densidad = num(kgPorHa);
  const falta = num(hectareasQueFaltan);

  if (hay === null) {
    return { sabe: false, dice: "No se sabe cuánta semilla hay en bodega, así que no se puede decir si alcanza." };
  }
  if (densidad === null || densidad <= 0) {
    return { sabe: false, hay, dice: `Hay ${hay} kg de semilla, pero todavía no se sabe cuántos kilos se están usando por hectárea. Registra un par de recargas y ya se puede calcular.` };
  }
  const alcanzaHa = Math.round((hay / densidad) * 100) / 100;
  if (falta === null) {
    return { sabe: true, hay, alcanzaHa, dice: `Con ${hay} kg alcanza para unas ${alcanzaHa} hectáreas más, al ritmo que van.` };
  }
  const faltanKg = Math.round((falta * densidad - hay) * 10) / 10;
  const costo = num(costoPorKg);
  return {
    sabe: true, hay, alcanzaHa, faltanKg: faltanKg > 0 ? faltanKg : 0,
    alcanza: faltanKg <= 0,
    costoDeReponer: (faltanKg > 0 && costo !== null) ? multiplicarDinero(costo, faltanKg) : null,
    dice: faltanKg <= 0
      ? `Alcanza: hay ${hay} kg y para las ${falta} hectáreas que faltan se necesitan unos ${Math.round(falta * densidad)} kg.`
      : `NO alcanza: hay ${hay} kg y para las ${falta} hectáreas que faltan se necesitan unos ${Math.round(falta * densidad)} kg. Faltan ${faltanKg} kg` +
        (costo !== null ? `, que costarían alrededor de ${fmt(multiplicarDinero(costo, faltanKg))}.` : ". No se capturó el costo por kilo, así que no se sabe cuánto costaría reponerlos."),
  };
}
