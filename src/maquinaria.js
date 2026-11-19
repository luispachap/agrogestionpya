// ============================================================
//  AgroGestión — Horómetro, diésel y horas de máquina
//
//  El tractorista YA captura diésel inicial, final, cargado y la lectura del
//  horómetro. Los dos datos llevan tiempo guardándose y nadie los cruza: el
//  horómetro aparecía una sola vez en todo App.jsx, se tecleaba y ahí moría.
//
//  Esto los junta. Y lo hace con una regla: NO ACUSA A NADIE. No usa la
//  palabra robo. Dice "el tractor 3 en barbecho viene en 14.2 L/h; su
//  promedio de las últimas 9 labores de barbecho es 10.8" y se calla. La
//  conclusión la saca la persona, que sabe si ese día se rastreó en tierra
//  pesada o si la bomba goteaba.
//
//  Nada de este archivo toca la pantalla, la red ni el almacenamiento.
//  Sus pruebas están en src/maquinaria.test.js.
// ============================================================

import { sumarDinero, multiplicarDinero, diasEntre } from "./calculos.js";

// Un número, o null si NO se capturó.
//
// Existe porque `Number(null)` vale 0 y `Number("")` también: sin esto, "el
// tractorista no anotó los litros" se convierte solo en "cargó cero litros",
// y a partir de ahí todas las cuentas salen tranquilas sobre un dato que
// nadie miró. Un dato que falta no es un cero.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ EL HORÓMETRO NO VA PARA ATRÁS ════════════ */

// La cuenta de litros por hora sólo sirve si las horas son ciertas.
//
// NO corrige la lectura por su cuenta ni la borra: la deja visible y marcada.
// El patrón de quién captura mal también es información.
export function revisarHorometro({ lectura, lecturaAnterior, fecha, fechaAnterior, horasTrabajadas }) {
  const l = num(lectura);
  if (l === null || l < 0) {
    return { estado: "sin lectura", dice: "No se capturó el horómetro.", horasDelPeriodo: null, marcada: false };
  }
  if (num(lecturaAnterior) === null) {
    return {
      estado: "primera lectura", dice: `Primera lectura registrada: ${l} hr. Desde la próxima ya se pueden sacar las horas.`,
      horasDelPeriodo: null, marcada: false,
    };
  }
  const anterior = num(lecturaAnterior);
  const delta = l - anterior;

  if (delta < 0) {
    return {
      estado: "va para atras", marcada: true, horasDelPeriodo: null,
      dice: `La lectura (${l} hr) es MENOR que la anterior (${anterior} hr). Un horómetro no va para atrás: o se tecleó mal, o se cambió el aparato.`,
    };
  }

  // Un tractor no da más de 24 horas en un día. Se marca, no se corrige.
  const dias = (fecha && fechaAnterior) ? Math.max(1, diasEntre(fechaAnterior, fecha) || 1) : null;
  if (dias !== null && delta > dias * 24) {
    return {
      estado: "imposible", marcada: true, horasDelPeriodo: delta,
      dice: `Van ${delta.toFixed(1)} hr entre las dos lecturas, pero sólo pasaron ${dias} día(s): no caben en el calendario.`,
    };
  }

  // Lo capturado a mano en la labor contra lo que dice el aparato.
  if (num(horasTrabajadas) !== null) {
    const ht = num(horasTrabajadas);
    const dif = delta - ht;
    if (Math.abs(dif) >= 1) {
      return {
        estado: "no cuadra con la actividad", marcada: true, horasDelPeriodo: delta,
        dice: `El horómetro avanzó ${delta.toFixed(1)} hr y en la actividad se capturaron ${ht} hr: ${dif > 0 ? "sobran" : "faltan"} ${Math.abs(dif).toFixed(1)} hr.`,
      };
    }
  }

  return {
    estado: "bien", marcada: false, horasDelPeriodo: delta,
    dice: `El horómetro avanzó ${delta.toFixed(1)} hr.`,
  };
}

/* ════════════ DIÉSEL CONTRA HORAS DE MÁQUINA ════════════ */

// Se cargan 200 litros y el tractor reporta 6 horas de rastreo. Ese tractor
// gasta 11 L/h: son 66 litros, no 200.
//
// Devuelve los números y la comparación contra SU PROPIO historial en ESA
// misma labor — no contra una regla general, porque barbechar no gasta lo
// mismo que rastrear. Y no dice qué hacer.
export function consumoPorHora({ litros, horas }) {
  const L = num(litros), H = num(horas);
  if (L === null || H === null || H <= 0) return null;
  return Math.round((L / H) * 100) / 100;
}

// Promedio histórico de una máquina en un tipo de labor.
// Si hay menos de 3 labores, NO da promedio: dice que todavía no sabe.
// Un promedio sacado de una sola vez no es un promedio, es esa vez.
export function promedioConsumo(labores, { minimo = 3 } = {}) {
  const validas = (labores || [])
    .map(l => consumoPorHora({ litros: l.litros, horas: l.horas }))
    .filter(v => v !== null && v > 0);
  if (validas.length < minimo) {
    return { promedio: null, sobre: validas.length, suficiente: false };
  }
  const suma = validas.reduce((s, v) => s + v, 0);
  return {
    promedio: Math.round((suma / validas.length) * 100) / 100,
    sobre: validas.length, suficiente: true,
  };
}

// La frase que ve la persona. Informa; no acusa ni ordena.
export function compararConsumo({ maquina, labor, litros, horas, historial }) {
  const actual = consumoPorHora({ litros, horas });
  const nombreMaq = maquina || "esta máquina";
  const nombreLab = labor || "esta actividad";

  if (actual === null) {
    return {
      hay: false, actual: null, promedio: null,
      dice: `De ${nombreMaq} no se pueden sacar litros por hora: falta el diésel o faltan las horas.`,
    };
  }
  const { promedio, sobre, suficiente } = promedioConsumo(historial);
  if (!suficiente) {
    return {
      hay: true, actual, promedio: null, sobre,
      dice: `${nombreMaq} en ${nombreLab} viene en ${actual} L/h. Todavía no hay con qué compararlo: van ${sobre} actividad(es) de ${nombreLab} con datos completos, y hacen falta 3.`,
    };
  }
  const dif = Math.round((actual - promedio) * 100) / 100;
  const pct = Math.round((dif / promedio) * 100);
  return {
    hay: true, actual, promedio, sobre, diferencia: dif, porciento: pct,
    // Ni una palabra de robo. Los dos números, lado a lado, y ya.
    dice: `${nombreMaq} en ${nombreLab} viene en ${actual} L/h; su promedio de las últimas ${sobre} actividades de ${nombreLab} es ${promedio}.`,
    llamaLaAtencion: Math.abs(pct) >= 25,
  };
}

/* ════════════ EL TANQUE DEL RANCHO ════════════ */

// La pipa que descarga y la manguera que sale sin vale a las cinco de la mañana.
//
// NO prorratea el faltante entre las máquinas para que cuadre: cuadrar
// repartiendo es exactamente la forma en que se esconde un faltante.
// El sobrante o el faltante se quedan con su nombre, solos.
export function cuadrarTanque({ saldoInicial, cargas, salidas, medicionFisica }) {
  const entra = (cargas || []).reduce((s, c) => s + (num(c.litros) || 0), 0);
  const sale = (salidas || []).reduce((s, c) => s + (num(c.litros) || 0), 0);
  const teorico = Math.round(((num(saldoInicial) || 0) + entra - sale) * 100) / 100;
  if (num(medicionFisica) === null) {
    return {
      teorico, medido: null, diferencia: null,
      dice: `Según los vales quedan ${teorico} L. No se ha medido el tanque, así que no se sabe si es cierto.`,
    };
  }
  const medido = num(medicionFisica);
  const dif = Math.round((medido - teorico) * 100) / 100;
  return {
    teorico, medido, diferencia: dif,
    // El saldo NO se ajusta al conteo. Un sistema que "cuadra solo" borra
    // justamente el dato que servía.
    ajustaSolo: false,
    dice: dif === 0
      ? `El tanque cuadra: ${medido} L medidos contra ${teorico} L de los vales.`
      : `Se midieron ${medido} L y los vales dicen ${teorico} L: ${dif > 0 ? "sobran" : "faltan"} ${Math.abs(dif)} L. La diferencia queda registrada tal cual, sin repartirse entre las máquinas.`,
  };
}

/* ════════════ SERVICIO POR HORAS, NO POR CALENDARIO ════════════ */

// Aceite a las 250, filtros a las 500. Si la última lectura del horómetro es
// vieja, NO estima: dice "del tractor 3 no sé sus horas".
export function serviciosPendientes({ horometroActual, fechaLectura, hoy, servicios }) {
  const h = num(horometroActual);
  if (h === null) {
    return { sabe: false, dice: "No sé las horas de esta máquina: no se ha capturado el horómetro.", pendientes: [] };
  }
  const antiguedad = (fechaLectura && hoy) ? diasEntre(fechaLectura, hoy) : null;
  if (antiguedad !== null && antiguedad > 30) {
    return {
      sabe: false, antiguedad,
      dice: `La última lectura del horómetro es de hace ${antiguedad} días (${fechaLectura}). Con eso no se puede decir qué servicio toca: haría falta una lectura nueva.`,
      pendientes: [],
    };
  }
  const pendientes = (servicios || []).map(s => {
    const cada = num(s.cadaHoras) || 0;
    const ultimo = num(s.ultimoAHoras);
    if (!cada) return null;
    const base = ultimo === null ? 0 : ultimo;
    const toca = base + cada;
    return {
      nombre: s.nombre, cadaHoras: cada, ultimoAHoras: ultimo,
      tocaAHoras: toca, faltanHoras: Math.round((toca - h) * 10) / 10,
      vencido: h >= toca,
      nuncaSeHizo: ultimo === null,
    };
  }).filter(Boolean).sort((a, b) => a.faltanHoras - b.faltanHoras);

  return { sabe: true, horometroActual: h, antiguedad, pendientes };
}

/* ════════════ COSTO POR HORA DE CADA MÁQUINA ════════════ */

// Pone el costo por hora de cada máquina lado a lado. NO dice "véndelo" ni
// "repáralo": Rodolfo saca su conclusión.
//
// Y dice SOBRE QUÉ está calculado: si de una máquina no se sabe el diésel, no
// se disfraza el costo de completo.
export function costoPorHora({ horas, litros, precioLitro, gastosMantenimiento }) {
  const H = num(horas);
  if (H === null || H <= 0) {
    return { porHora: null, completo: false, falta: ["horas de máquina"], dice: "Sin horas no se puede sacar el costo por hora." };
  }
  const falta = [];
  const L = num(litros);
  const P = num(precioLitro);
  let combustible = 0;
  if (L !== null && P !== null) combustible = multiplicarDinero(P, L);
  else falta.push(L !== null ? "precio del diésel" : "litros de diésel");

  const mant = num(gastosMantenimiento);
  const mantenimiento = mant === null ? 0 : mant;
  if (mant === null) falta.push("gastos de mantenimiento");

  const total = sumarDinero(combustible, mantenimiento);
  return {
    porHora: Math.round((total / H) * 100) / 100,
    total, horas: H, combustible, mantenimiento,
    completo: falta.length === 0, falta,
    dice: falta.length === 0
      ? `Costo por hora calculado con combustible y mantenimiento.`
      : `Costo por hora calculado SIN: ${falta.join(", ")}. El número real es más alto.`,
  };
}
