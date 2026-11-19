// ════════════════════════════════════════════════════════════════════════
//  CUADRILLAS — quién trabajó, dónde, cuánto tiempo, haciendo qué y cuánto costó
//
//  El checador dice quién está en el rancho. Aquí se dice a dónde se mandó a
//  cada quien, y de las dos cosas juntas sale la mano de obra. Todo son
//  eventos, y cada uno se captura una vez:
//
//    asignacion       "estos doce, a la parcela 7, a deshierbar, desde las 6:10"
//    fin_asignacion   "estos ya acabaron" (quedan en el rancho, sin parcela)
//    destajo          "estos cortaron 140 cajas a $9"
//    ajuste           una regla del rancho que cambió (y quién la cambió)
//
//  Cambiar de parcela o de labor a media mañana NO es editar: es otra
//  asignación. La anterior termina sola cuando empieza la siguiente.
//
//  Reglas que no se rompen:
//  · El tiempo en una parcela es el CRUCE de dos hechos: estaba en el rancho
//    (checó) y estaba asignado ahí. Asignado sin checar no cuenta horas;
//    checado sin asignar es tiempo "sin asignar", a la vista, y no se le carga
//    a ninguna parcela para que cuadre bonito.
//  · Lo que se reparte suma EXACTO lo devengado. Repartir no crea ni pierde dinero.
//  · Cada peso dice de qué eventos salió.
//  · Un sueldo que no consta para esa fecha se marca estimado; una jornada sin
//    salida no inventa horas.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, reglasDe } from "./eventos.js";
import { jornadasDe } from "./checador.js";
import { sueldoVigente, repartirDinero, multiplicarDinero, sumarDinero } from "./calculos.js";

export const TIPO_ASIGNACION = "asignacion";
export const TIPO_FIN = "fin_asignacion";
export const TIPO_DESTAJO = "destajo";
export const TIPO_AJUSTE = "ajuste";
const PUEDE_REPARTIR = ["admin", "encargado"];
const unicos = (lista) => [...new Set((lista || []).filter(Boolean))];
const min = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

// ── Las reglas del rancho que se pueden cambiar ────────────────────────────
// Un ajuste es un evento: queda dicho quién cambió la regla, cuándo y cuánto valía.
export const AJUSTES = {
  ventana_repetida_min: { defecto: 15, minimo: 1, maximo: 120, nombre: "Minutos para tomar una segunda lectura como repetida" },
  horas_jornada: { defecto: 8, minimo: 4, maximo: 12, nombre: "Horas de una jornada (para quien cobra por hora)" },
};
export function ajusteVigente(eventos, clave) {
  const def = AJUSTES[clave];
  const ultimo = vigentes(eventos).filter(e => e.tipo === TIPO_AJUSTE && e.datos.clave === clave).sort((a, b) => a.cuando.localeCompare(b.cuando)).pop();
  return ultimo ? { valor: ultimo.datos.valor, evento: ultimo.id, por: ultimo.quien?.nombre || "", desde: ultimo.cuando } : { valor: def?.defecto, evento: null, por: "", desde: null };
}
export function cambiarAjuste({ clave, valor, quien, cuando, fecha, azar }) {
  const def = AJUSTES[clave]; const v = Number(valor);
  if (!def) return { ok: false, dice: "Esa regla no existe." };
  if (quien?.rol !== "admin") return { ok: false, dice: "Las reglas del rancho sólo las cambia un administrador." };
  if (!Number.isFinite(v) || v < def.minimo || v > def.maximo) return { ok: false, dice: `Tiene que ser un número entre ${def.minimo} y ${def.maximo}.` };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_AJUSTE, cuando, fecha, quien, azar, datos: { clave, valor: v } }) };
}

// ── Mandar gente a una parcela ─────────────────────────────────────────────
export function asignar({ trabajadorIds, parcelaId, actividad, cuadrilla = "", desde, fecha, quien, capturado, azar }) {
  const ids = unicos(trabajadorIds);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador reparte a la gente." };
  if (ids.length === 0) return { ok: false, dice: "Falta escoger a quién se manda." };
  if (!parcelaId) return { ok: false, dice: "Falta la parcela." };
  if (!String(actividad || "").trim()) return { ok: false, dice: "Falta qué van a hacer." };
  if (capturado && new Date(desde) > new Date(capturado)) return { ok: false, dice: "No se puede asignar desde una hora que todavía no llega." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_ASIGNACION, cuando: desde, fecha, capturado, quien, azar, datos: { trabajadorIds: ids, parcelaId, actividad: String(actividad).trim(), cuadrilla: String(cuadrilla || "").trim() } }) };
}
export function terminar({ trabajadorIds, desde, fecha, quien, capturado, azar }) {
  const ids = unicos(trabajadorIds);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador reparte a la gente." };
  if (ids.length === 0) return { ok: false, dice: "Falta decir quiénes terminaron." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_FIN, cuando: desde, fecha, capturado, quien, azar, datos: { trabajadorIds: ids } }) };
}
// Trabajo a destajo: tantas unidades a tanto. Se reparte parejo entre quienes lo hicieron.
export function anotarDestajo({ trabajadorIds, parcelaId, actividad, unidad, cantidad, tarifa, cuando, fecha, quien, capturado, azar }) {
  const ids = unicos(trabajadorIds); const c = Number(cantidad), t = Number(tarifa);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador anota un destajo." };
  if (ids.length === 0) return { ok: false, dice: "Falta decir quiénes lo hicieron." };
  if (!parcelaId) return { ok: false, dice: "Falta la parcela." };
  if (!(c > 0)) return { ok: false, dice: "Falta cuánto hicieron." };
  if (!(t > 0)) return { ok: false, dice: "Falta a cómo se paga cada unidad." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_DESTAJO, cuando, fecha, capturado, quien, azar, datos: { trabajadorIds: ids, parcelaId, actividad: String(actividad || "Destajo").trim(), unidad: String(unidad || "unidad").trim(), cantidad: c, tarifa: t } }) };
}

// ── Dónde está cada quien AHORA ────────────────────────────────────────────
const cambiosDe = (eventos, fecha) => vigentes(eventos).filter(e => (e.tipo === TIPO_ASIGNACION || e.tipo === TIPO_FIN) && e.fecha === fecha)
  .sort((a, b) => a.cuando.localeCompare(b.cuando) || a.capturado.localeCompare(b.capturado) || a.id.localeCompare(b.id));

export function repartoActual(eventos, { fecha, hoy, ahora }) {
  const adentro = jornadasDe(eventos, { fecha, hoy, ahora }).filter(j => j.adentro);
  const ultimo = new Map();
  for (const c of cambiosDe(eventos, fecha)) if (c.cuando <= new Date(ahora).toISOString()) for (const id of c.datos.trabajadorIds) ultimo.set(id, c);
  const grupos = new Map(); const sinAsignar = [];
  for (const j of adentro) {
    const c = ultimo.get(j.trabajadorId);
    if (!c || c.tipo === TIPO_FIN) { sinAsignar.push({ trabajadorId: j.trabajadorId, desde: c?.cuando || j.primera.cuando }); continue; }
    const k = `${c.datos.parcelaId}|${c.datos.actividad}|${c.datos.cuadrilla}`;
    if (!grupos.has(k)) grupos.set(k, { clave: k, parcelaId: c.datos.parcelaId, actividad: c.datos.actividad, cuadrilla: c.datos.cuadrilla, miembros: [] });
    grupos.get(k).miembros.push({ trabajadorId: j.trabajadorId, desde: c.cuando, evento: c.id });
  }
  // A quién se mandó a una parcela sin que haya checado: no cuenta horas, y se dice.
  const presentes = new Set(adentro.map(j => j.trabajadorId));
  const sinChecar = [...ultimo.entries()].filter(([id, c]) => c.tipo === TIPO_ASIGNACION && !presentes.has(id)).map(([id, c]) => ({ trabajadorId: id, evento: c.id, parcelaId: c.datos.parcelaId }));
  return { grupos: [...grupos.values()], sinAsignar, sinChecar };
}

// ── Los tramos: el cruce de "estaba en el rancho" con "estaba asignado ahí" ──
export function tramosDeTrabajo(eventos, { desde, hasta, hoy, ahora } = {}) {
  const tramos = []; const avisos = [];
  const cambiosPorDia = new Map();
  const cambios = (fecha) => { if (!cambiosPorDia.has(fecha)) cambiosPorDia.set(fecha, cambiosDe(eventos, fecha)); return cambiosPorDia.get(fecha); };
  const jornadas = jornadasDe(eventos, { hoy, ahora }).filter(j => (!desde || j.fecha >= desde) && (!hasta || j.fecha <= hasta));
  const conPresencia = new Set(jornadas.map(j => `${j.trabajadorId}|${j.fecha}`));
  for (const j of jornadas) {
    const mios = cambios(j.fecha).filter(c => c.datos.trabajadorIds.includes(j.trabajadorId));
    for (const t of j.tramos) {
      if (!t.entrada) { avisos.push({ clase: "salida_sin_entrada", trabajadorId: j.trabajadorId, fecha: j.fecha, ev: t.salida.id, dice: "Tiene una salida sin entrada: ese tiempo no se sabe." }); continue; }
      const ini = t.entrada.cuando;
      const corriendo = !t.salida && j.adentro && j.tramos[j.tramos.length - 1] === t;
      const fin = t.salida ? t.salida.cuando : corriendo ? new Date(ahora).toISOString() : null;
      const base = { trabajadorId: j.trabajadorId, fecha: j.fecha, evEntrada: t.entrada.id, evSalida: t.salida?.id || null, corriendo };
      const vigenteEn = (cuando) => mios.filter(c => c.cuando <= cuando).pop() || null;
      if (!fin) {
        // Entró y no se sabe cuándo salió: no se inventan horas. Se deja dicho dónde estaba.
        const c = vigenteEn(ini) || mios[0] || null; const asig = c && c.tipo === TIPO_ASIGNACION ? c : null;
        tramos.push({ ...base, desde: ini, hasta: null, minutos: null, parcelaId: asig?.datos.parcelaId || null, actividad: asig?.datos.actividad || null, cuadrilla: asig?.datos.cuadrilla || "", evAsignacion: asig?.id || null });
        avisos.push({ clase: "sin_salida", trabajadorId: j.trabajadorId, fecha: j.fecha, ev: t.entrada.id, dice: "Entró y no checó salida: sus horas de ese tramo no se saben." });
        continue;
      }
      const cortes = [ini, ...mios.map(c => c.cuando).filter(c => c > ini && c < fin), fin];
      for (let i = 0; i < cortes.length - 1; i++) {
        if (cortes[i] === cortes[i + 1]) continue;
        const c = vigenteEn(cortes[i]); const asig = c && c.tipo === TIPO_ASIGNACION ? c : null;
        tramos.push({ ...base, desde: cortes[i], hasta: cortes[i + 1], minutos: min(cortes[i], cortes[i + 1]),
          parcelaId: asig?.datos.parcelaId || null, actividad: asig?.datos.actividad || null, cuadrilla: asig?.datos.cuadrilla || "", evAsignacion: asig?.id || null });
      }
    }
  }
  // Asignados que nunca checaron ese día.
  for (const e of vigentes(eventos)) {
    if (e.tipo !== TIPO_ASIGNACION || (desde && e.fecha < desde) || (hasta && e.fecha > hasta)) continue;
    for (const id of e.datos.trabajadorIds) if (!conPresencia.has(`${id}|${e.fecha}`)) avisos.push({ clase: "asignado_sin_checar", trabajadorId: id, fecha: e.fecha, ev: e.id, dice: "Se le mandó a una parcela pero no checó entrada ese día: no cuenta horas." });
  }
  return { tramos, avisos };
}

// ── Lo devengado y a dónde se carga ────────────────────────────────────────
// Modalidad de pago del trabajador: "dia" (la de siempre), "hora" o "destajo".
//   dia     — vino, se devenga su día; se reparte entre lo que hizo según el tiempo.
//   hora    — se devenga sólo el tiempo que se sabe.
//   destajo — sólo lo que hizo a destajo; estar en el rancho no devenga.
export function manoDeObra(eventos, trabajadores, { desde, hasta, hoy, ahora } = {}) {
  const { tramos, avisos } = tramosDeTrabajo(eventos, { desde, hasta, hoy, ahora });
  const horasJornada = ajusteVigente(eventos, "horas_jornada").valor;
  const porId = new Map((trabajadores || []).map(t => [t.id, t]));
  const partes = []; const devengado = [];
  const dias = new Map();
  for (const t of tramos) { const k = `${t.trabajadorId}|${t.fecha}`; if (!dias.has(k)) dias.set(k, []); dias.get(k).push(t); }

  const destajos = vigentes(eventos).filter(e => e.tipo === TIPO_DESTAJO && (!desde || e.fecha >= desde) && (!hasta || e.fecha <= hasta));
  const destajoPorDia = new Map();
  for (const e of destajos) {
    const total = multiplicarDinero(e.datos.tarifa, e.datos.cantidad);
    const montos = repartirDinero(total, e.datos.trabajadorIds.map(() => 1));
    e.datos.trabajadorIds.forEach((id, i) => {
      const k = `${id}|${e.fecha}`; if (!destajoPorDia.has(k)) destajoPorDia.set(k, []);
      destajoPorDia.get(k).push({ trabajadorId: id, fecha: e.fecha, parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, modalidad: "destajo", minutos: null,
        unidades: e.datos.cantidad / e.datos.trabajadorIds.length, unidad: e.datos.unidad, monto: montos[i], evs: [e.id], estimado: false, provisional: false });
    });
  }

  for (const k of new Set([...dias.keys(), ...destajoPorDia.keys()])) {
    const [trabajadorId, fecha] = k.split("|");
    const t = porId.get(trabajadorId); const mios = dias.get(k) || []; const dest = destajoPorDia.get(k) || [];
    const modalidad = t?.modalidadPago || "dia";
    const v = sueldoVigente(t, fecha);
    const sabidos = mios.filter(x => x.minutos != null && x.minutos > 0);
    const provisional = mios.some(x => x.corriendo);
    const misPartes = [...dest];
    const evsDe = (x) => [x.evEntrada, x.evSalida, x.evAsignacion].filter(Boolean);
    if (!t) avisos.push({ clase: "sin_ficha", trabajadorId, fecha, dice: "Checó alguien que no está en el catálogo de este aparato: no se le puede poner costo." });
    else if (modalidad !== "destajo" && mios.length > 0) {
      if (!(v.sueldo > 0)) avisos.push({ clase: "sin_sueldo", trabajadorId, fecha, dice: "No tiene sueldo capturado: su día quedó sin costo. Un dato que falta no es un cero." });
      else if (modalidad === "hora") {
        // El total se calcula una vez (no minuto por minuto, que arrastra centavos) y se reparte.
        const total = Math.round((v.sueldo * 100 / horasJornada) * (sabidos.reduce((n, x) => n + x.minutos, 0) / 60)) / 100;
        const montos = repartirDinero(total, sabidos.map(x => x.minutos));
        sabidos.forEach((x, i) => misPartes.push({ trabajadorId, fecha, parcelaId: x.parcelaId, actividad: x.actividad, modalidad: "hora", minutos: x.minutos, monto: montos[i], evs: evsDe(x), estimado: v.estimado === true, provisional: x.corriendo }));
      } else if (sabidos.length > 0) {
        const montos = repartirDinero(v.sueldo, sabidos.map(x => x.minutos));
        sabidos.forEach((x, i) => misPartes.push({ trabajadorId, fecha, parcelaId: x.parcelaId, actividad: x.actividad, modalidad: "dia", minutos: x.minutos, monto: montos[i], evs: evsDe(x), estimado: v.estimado === true, provisional }));
      } else {
        // Vino (checó entrada) pero no se sabe cuánto tiempo: su día se devenga, y
        // NO se le carga a ninguna parcela hasta que alguien cierre su jornada.
        misPartes.push({ trabajadorId, fecha, parcelaId: null, actividad: null, modalidad: "dia", minutos: null, monto: v.sueldo, evs: unicos(mios.flatMap(evsDe)), estimado: v.estimado === true, provisional: false, sinHoras: true });
      }
      if (dest.length > 0) avisos.push({ clase: "dia_y_destajo", trabajadorId, fecha, dice: "Ese día tiene su pago de siempre Y un destajo. Si sólo iba a destajo, hay que decirlo en su ficha." });
    }
    if (misPartes.length === 0) continue;
    partes.push(...misPartes);
    devengado.push({ trabajadorId, nombre: t?.nombre || "(no está en el catálogo)", fecha, modalidad, monto: sumarDinero(misPartes.map(p => p.monto)),
      minutos: sabidos.reduce((s, x) => s + x.minutos, 0), origenSueldo: v.origen, estimado: misPartes.some(p => p.estimado), provisional, partes: misPartes });
  }
  const asignado = partes.filter(p => p.parcelaId); const suelto = partes.filter(p => !p.parcelaId);
  return {
    tramos, partes, devengado, avisos,
    total: sumarDinero(partes.map(p => p.monto)), totalAsignado: sumarDinero(asignado.map(p => p.monto)), totalSinAsignar: sumarDinero(suelto.map(p => p.monto)),
    minutosAsignados: asignado.reduce((s, p) => s + (p.minutos || 0), 0), minutosSinAsignar: suelto.reduce((s, p) => s + (p.minutos || 0), 0),
  };
}

// Agrupar las partes para contestar "por parcela" o "por persona".
export function agrupar(partes, campos) {
  const grupos = new Map();
  for (const p of partes) {
    const k = campos.map(c => p[c] ?? "").join("|");
    if (!grupos.has(k)) grupos.set(k, { ...Object.fromEntries(campos.map(c => [c, p[c] ?? null])), minutos: 0, monto: 0, partes: [], estimado: false, provisional: false });
    const g = grupos.get(k);
    g.minutos += p.minutos || 0; g.monto = sumarDinero(g.monto, p.monto); g.partes.push(p);
    g.estimado = g.estimado || !!p.estimado; g.provisional = g.provisional || !!p.provisional;
  }
  return [...grupos.values()].sort((a, b) => b.monto - a.monto);
}

// Para los reportes que ya existían (costo por parcela, por cultivo): la mano de
// obra que sale de los eventos, en la forma de "actividad" que ellos leen. No se
// guarda: se calcula. Lo que no tiene parcela NO entra aquí.
export function actividadesDeManoDeObra(partes, trabajadores) {
  const nombre = new Map((trabajadores || []).map(t => [t.id, t.nombre]));
  return agrupar(partes.filter(p => p.parcelaId), ["trabajadorId", "fecha", "parcelaId", "actividad"]).map(g => ({
    id: `mo:${g.trabajadorId}:${g.fecha}:${g.parcelaId}:${g.actividad}`, _deEventos: unicos(g.partes.flatMap(p => p.evs)),
    fecha: g.fecha, parcelaId: g.parcelaId, tipo: g.actividad || "Mano de obra", horas: Math.round((g.minutos / 60) * 100) / 100,
    trabajadorId: g.trabajadorId, trabajadorNombre: nombre.get(g.trabajadorId) || "", registradoPor: { id: g.trabajadorId, rol: "trabajador", nombre: nombre.get(g.trabajadorId) || "" },
    insumos: [], costoInsumos: 0, costoMaq: 0, costoMO: g.monto, costoTotal: g.monto, estimado: g.estimado, provisional: g.provisional,
  }));
}

// La misma jornada capturada por los dos caminos: el checador y una actividad
// tecleada a mano. No se resuelve sola: se enseña, porque duplica el costo.
export function capturasDobles(actividades, partes) {
  const deEventos = new Set(partes.filter(p => p.parcelaId && p.modalidad !== "destajo").map(p => `${p.trabajadorId}|${p.fecha}`));
  return (actividades || []).filter(a => {
    if (!a || a._deEventos || a.cancelado) return false;
    const id = a.trabajadorId || a.registradoPor?.id; const horas = parseFloat(a.horas) || parseFloat(a.horas_trab) || 0;
    return id && horas > 0 && deEventos.has(`${id}|${a.fecha}`);
  }).map(a => ({ actividadId: a.id, trabajadorId: a.trabajadorId || a.registradoPor?.id, fecha: a.fecha, parcelaId: a.parcelaId }));
}

export const horasDe = (minutos) => (minutos == null ? "no se sabe" : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`);

// Las consecuencias, dichas una vez para el motor de eventos. El costo no es
// efecto de UN evento —sale del cruce de marcas y asignaciones—, así que aquí
// sólo va lo que sí es de cada uno.
reglasDe(TIPO_ASIGNACION, (e) => e.datos.trabajadorIds.map(id => ({ clase: "destino", trabajadorId: id, parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, desde: e.cuando })));
reglasDe(TIPO_FIN, (e) => e.datos.trabajadorIds.map(id => ({ clase: "destino", trabajadorId: id, parcelaId: null, actividad: null, desde: e.cuando })));
reglasDe(TIPO_DESTAJO, (e) => [{ clase: "destajo", parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, monto: multiplicarDinero(e.datos.tarifa, e.datos.cantidad), unidades: e.datos.cantidad }]);
reglasDe(TIPO_AJUSTE, (e) => [{ clase: "regla", clave: e.datos.clave, valor: e.datos.valor }]);
