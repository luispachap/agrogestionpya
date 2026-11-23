// ═════════════════════════════════════════════════════════════════════════════
//  EL TIEMPO ESPERANDO TAREA (idea de Luis, 23 nov)
//
//  «Entre que marcan algo completado y les asignan una nueva tarea, o que chequen entrada y les asignen… es un buen
//  indicador para ver cuánto podríamos ahorrar en horas hombre con un plan prefabricado cada día.»
//
//  No es otra cuenta: sale de la mano de obra de siempre (`manoDeObra`): los ratos SIN ASIGNAR dentro de una jornada.
//  Se separan por momento:
//   · al llegar: de la entrada a su primera asignación del día;
//   · entre tareas: de que terminó una a que le dieron la siguiente;
//   · al final: de su última asignación a su salida (no es esperar tarea; se enseña aparte);
//   · en la comida: el hueco entre dos cortes de la tabla (no cuenta como espera).
//  Y por lo que se sabe de cada rato: «espera» confirmada (alguien lo aclaró así), «sin aclarar» (posible espera), o con
//  otra causa (descanso, traslado, mantenimiento… : no cuenta). Sólo informa: no cambia pagos, costos ni el «por
//  aclarar», no culpa a nadie, y ningún módulo de dinero lo lee. Mientras no haya registro en tiempo real de todas las
//  actividades, es un indicador grueso: se dice.
// ═════════════════════════════════════════════════════════════════════════════
import { sumarDinero } from "./calculos.js";

export const MOMENTOS = { al_llegar: "Al llegar, antes de su primera tarea", entre_tareas: "Entre una tarea y la siguiente", al_final: "Después de su última tarea, antes de salir", comida: "En la comida, entre cortes" };
const asignada = (p) => !!(p.parcelaId || p.vehiculoId);
const dentro = (p, h) => p.desde >= h.desde && p.hasta <= h.hasta;

// `mo`: lo que devuelve manoDeObra. `huecos(fecha)`: los ratos entre cortes de ese día [{desde, hasta}] (ISO).
export function tiempoEsperando(mo, { huecos = () => [] } = {}) {
  const porDia = new Map();
  for (const p of mo?.partes || []) {
    if (p.minutos == null || !p.desde || !p.hasta || p.modalidad === "destajo") continue;
    const k = `${p.trabajadorId}|${p.fecha}`; if (!porDia.has(k)) porDia.set(k, []); porDia.get(k).push(p);
  }
  const renglones = [];
  for (const partes of porDia.values()) {
    const orden = [...partes].sort((a, b) => a.desde.localeCompare(b.desde));
    const hs = huecos(orden[0].fecha) || [];
    orden.forEach((p, i) => {
      if (asignada(p) || !(p.minutos > 0)) return;
      const antes = orden.slice(0, i).some(asignada), despues = orden.slice(i + 1).some(asignada);
      const momento = hs.some(h => dentro(p, h)) ? "comida" : !antes ? (despues ? "al_llegar" : null) : despues ? "entre_tareas" : "al_final";
      if (!momento) return;   // en todo el día no se le asignó nada: eso ya sale como «por aclarar», no como espera
      const clase = p.causa === "espera" ? "espera" : !p.causa ? "sin_aclarar" : "otra_causa";
      renglones.push({ trabajadorId: p.trabajadorId, fecha: p.fecha, momento, clase, causa: p.causa || null, desde: p.desde, hasta: p.hasta, minutos: p.minutos, monto: p.monto });
    });
  }
  const cuentan = renglones.filter(r => ["al_llegar", "entre_tareas"].includes(r.momento) && r.clase !== "otra_causa");
  const suma = (l) => ({ veces: l.length, minutos: l.reduce((s, r) => s + r.minutos, 0), monto: sumarDinero(l.map(r => r.monto)) });
  return {
    renglones,
    // Lo que un plan hecho de víspera podría ahorrar: al llegar y entre tareas, confirmado o sin aclarar.
    esperando: { ...suma(cuentan), confirmado: suma(cuentan.filter(r => r.clase === "espera")), sinAclarar: suma(cuentan.filter(r => r.clase === "sin_aclarar")) },
    porMomento: Object.fromEntries(Object.keys(MOMENTOS).map(m => [m, suma(renglones.filter(r => r.momento === m && r.clase !== "otra_causa"))])),
    conOtraCausa: suma(renglones.filter(r => r.clase === "otra_causa")),
    porPersona: [...new Set(cuentan.map(r => r.trabajadorId))].map(id => ({ trabajadorId: id, ...suma(cuentan.filter(r => r.trabajadorId === id)) })).sort((a, b) => b.minutos - a.minutos),
    dice: "Indicador grueso: sale de las marcas y de a qué se asignó a cada quien. Mientras no se registre en el momento todo lo que hace cada persona, un rato «sin aclarar» puede ser trabajo que no se anotó.",
  };
}
