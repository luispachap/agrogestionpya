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
import { nuevoEvento, vigentes, reglasDe, negado } from "./eventos.js";
import { jornadasDe } from "./checador.js";
import { sueldoVigente, repartirDinero, multiplicarDinero, sumarDinero } from "./calculos.js";

export const TIPO_ASIGNACION = "asignacion";
export const TIPO_FIN = "fin_asignacion";
export const TIPO_DESTAJO = "destajo";
export const TIPO_AJUSTE = "ajuste";
export const TIPO_ACLARACION = "aclaracion";
// Por qué alguien estuvo en el rancho sin estar asignado a una actividad. Que
// haya tiempo sin asignar NO quiere decir que se desperdició: quiere decir que
// falta aclararlo. Sólo "trabajo no registrado" manda ese tiempo a una parcela.
export const CAUSAS_SIN_ASIGNAR = {
  trabajo_no_registrado: "Sí trabajó, pero no se registró dónde",
  espera: "Espera por instrucciones",
  mantenimiento: "Mantenimiento o limpieza general",
  traslado: "Traslado",
  descanso_autorizado: "Descanso autorizado",
  inactividad: "Inactividad confirmada",
  otra: "Otra causa",
};
const PUEDE_REPARTIR = ["admin", "encargado"];
const unicos = (lista) => [...new Set((lista || []).filter(Boolean))];
const min = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

// ── Las reglas del rancho que se pueden cambiar ────────────────────────────
// Un ajuste es un evento: queda dicho quién cambió la regla, cuándo y cuánto valía.
const POLITICA_PERSONAL = { actividades: "Repartir según el costo de las actividades de esa persona en el mes", pendiente: "Dejarlo pendiente de distribuir", fuera: "No es de producción: no se reparte" };
export const AJUSTES = {
  ventana_repetida_min: { defecto: 15, minimo: 1, maximo: 120, nombre: "Minutos para tomar una segunda lectura como repetida" },
  criterio_flete: { defecto: "personas", opciones: { personas: "Entre las personas transportadas", pagado: "En proporción a lo que cobró cada grupo", parejo: "Parejo entre las parcelas donde trabajaron" }, nombre: "Cómo se reparte un flete externo de cuadrilla" },
  alm_aviso_h: { defecto: 24, minimo: 1, maximo: 720, nombre: "Material de consumo entregado: horas para el primer aviso" },
  alm_escala_h: { defecto: 72, minimo: 2, maximo: 2160, nombre: "Material de consumo entregado: horas para avisar al administrador" },
  alm_aviso_largo_d: { defecto: 7, minimo: 1, maximo: 365, nombre: "Herramientas y uso prolongado: días para el primer aviso" },
  alm_escala_largo_d: { defecto: 15, minimo: 2, maximo: 730, nombre: "Herramientas y uso prolongado: días para avisar al administrador" },
  compra_aviso_d: { defecto: 3, minimo: 1, maximo: 60, nombre: "Compras para el almacén sin recibir o sin precio: días para avisar al encargado" },
  compra_escala_d: { defecto: 7, minimo: 2, maximo: 180, nombre: "Compras para el almacén sin recibir o sin precio: días para avisar al administrador" },
  criterio_traslado: { defecto: "personas", opciones: { personas: "Por las personas que llevó a cada parcela", viajes: "Parejo entre los viajes", parejo: "Parejo entre las parcelas a las que llevó gente" }, nombre: "Cómo se reparte el costo de transportar trabajadores en vehículo propio" },
  maq_diferencia: { defecto: "aplicado", opciones: { aplicado: "A las parcelas que usaron la máquina, en proporción a la cuota aplicada", pendiente: "Dejarla pendiente de distribuir, a la vista", general: "Gasto general de maquinaria: no se carga a parcelas" }, nombre: "Maquinaria con cuota por hora: qué se hace con la diferencia entre lo aplicado por cuota y su costo real del mes" },
  criterio_vehiculo: { defecto: "horas", opciones: { horas: "Por horas de uso", viajes: "Por viajes", km: "Por kilómetros", periodo: "Parejo entre lo que atendió en el periodo" }, nombre: "Cómo se reparten los costos compartidos de un vehículo (combustible, taller, depreciación)" },
  tolerancia_salida_min: { defecto: 30, minimo: 0, maximo: 240, nombre: "Minutos antes de su horario que alguien puede salir sin que se pida revisar el caso" },
  ind_permiso: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Permisos pagados: qué se hace con ese importe" },
  ind_descanso: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Descansos pagados: qué se hace con ese importe" },
  ind_justificada: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Ausencias justificadas que se pagan: qué se hace con ese importe" },
  ind_espera: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Esperas por instrucciones: qué se hace con ese importe" },
  ind_traslado: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Traslados del personal: qué se hace con ese importe" },
  ind_mantenimiento: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Mantenimiento o limpieza general: qué se hace con ese importe" },
  ind_inactividad: { defecto: "pendiente", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Inactividad confirmada: qué se hace con ese importe" },
  ind_otra: { defecto: "pendiente", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Tiempo pagado por otra causa: qué se hace con ese importe" },
  ind_encargado: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Días de un encargado sin actividad registrada: qué se hace con ese importe" },
  ind_prestaciones: { defecto: "actividades", opciones: POLITICA_PERSONAL, nombre: "Costo de personal · Prestaciones (aguinaldo, vacaciones y prima): qué se hace con ese importe" },
  ind_bajas: { defecto: "general", opciones: { general: "Gasto laboral general: no se reparte a las parcelas", ...POLITICA_PERSONAL }, nombre: "Costo de personal · Prima de antigüedad e indemnizaciones al terminar una relación de trabajo: qué se hace con ese importe" },
  zona_salario_minimo: { defecto: "general", opciones: { general: "General (resto del país): Zacatecas y Aguascalientes", frontera: "Zona Libre de la Frontera Norte" }, nombre: "Salario mínimo que le toca al rancho. Los importes de cada año están en el catálogo oficial de abajo" },
  prest_corte: { tipo: "fecha", defecto: null, nombre: "Prestaciones · fecha de corte: desde qué día AgroGestión lleva su costo (lo de antes se captura como saldo inicial)" },
  prest_dias_promedio: { defecto: 30, minimo: 5, maximo: 365, nombre: "Prestaciones · días trabajados que se promedian para quien cobra por destajo o por hora" },
  prest_aguinaldo_dias: { defecto: 15, minimo: 15, maximo: 120, nombre: "Prestaciones · días de aguinaldo por año (la ley pide 15 como mínimo)" },
  prest_prima_pct: { defecto: 25, minimo: 25, maximo: 100, nombre: "Prestaciones · prima vacacional, en % (la ley pide 25 como mínimo)" },
  prest_vac_extra: { defecto: 0, minimo: 0, maximo: 30, nombre: "Prestaciones · días de vacaciones adicionales a los de la ley" },
  // Luis, 22 nov: un externo nace SIN pago sugerido escrito en el código. El rancho pone la base (300, 350…) y cada
  // registro la puede cambiar para un caso especial (una parcela con mucha hierba se paga más); nada cuenta sin aprobación.
  tarifa_externo_dia: { defecto: null, minimo: 1, maximo: 10000, nombre: "Externos · pago por día que se le sugiere al registrar (cada registro lo puede cambiar, y nada cuenta hasta que se aprueba)" },
  horas_jornada: { defecto: 8, minimo: 4, maximo: 12, nombre: "Horas del horario habitual (de ahí en adelante son horas adicionales)" },
  // La tabla por cortes (src/cortes.js). PROVISIONAL: cuántos cortes y de qué horas falta validarlo con Miguel.
  // Checar desde el teléfono propio (src/gps.js). PROVISIONALES: falta probarlo en campo y validarlo con Miguel.
  gps_radio_m: { defecto: 300, minimo: 50, maximo: 5000, nombre: "Checar desde el teléfono · qué tan cerca del rancho (metros) cuenta como «en el rancho» (provisional)" },
  gps_precision_m: { defecto: 100, minimo: 10, maximo: 1000, nombre: "Checar desde el teléfono · con qué precisión del GPS (metros) la marca se acepta sin revisar (provisional)" },
  cortes_dia: { defecto: "tres", opciones: { tres: "Tres cortes: 7–10, 10–13 y 14–17", dos: "Dos cortes: 7–12 y 13–17", cuatro: "Cuatro cortes: 7–9:30, 9:30–12, 13–15 y 15–17" }, nombre: "Tabla por cortes · cuántos cortes tiene el día (provisional: falta validarlo con Miguel)" },
};
export function ajusteVigente(eventos, clave) {
  const def = AJUSTES[clave];
  const ultimo = vigentes(eventos).filter(e => e.tipo === TIPO_AJUSTE && e.datos.clave === clave).sort((a, b) => a.cuando.localeCompare(b.cuando)).pop();
  return ultimo ? { valor: ultimo.datos.valor, evento: ultimo.id, por: ultimo.quien?.nombre || "", desde: ultimo.cuando } : { valor: def?.defecto, evento: null, por: "", desde: null };
}
export function cambiarAjuste({ permitido, clave, valor, quien, cuando, fecha, azar }) {
  const def = AJUSTES[clave]; const v = def?.opciones || def?.tipo === "fecha" ? String(valor) : Number(valor);
  if (!def) return { ok: false, dice: "Esa regla no existe." };
  { const no = negado(quien, permitido, "Las reglas del rancho sólo las cambia un administrador."); if (no) return { ok: false, dice: no }; }
  if (def.tipo === "fecha") return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + "T12:00:00Z").getTime()) ? { ok: true, evento: nuevoEvento({ tipo: TIPO_AJUSTE, cuando, fecha, quien, azar, datos: { clave, valor: v } }) } : { ok: false, dice: "Falta la fecha." };
  if (def.opciones) return def.opciones[v] ? { ok: true, evento: nuevoEvento({ tipo: TIPO_AJUSTE, cuando, fecha, quien, azar, datos: { clave, valor: v } }) } : { ok: false, dice: "Esa opción no existe." };
  if (!Number.isFinite(v) || v < def.minimo || v > def.maximo) return { ok: false, dice: `Tiene que ser un número entre ${def.minimo} y ${def.maximo}.` };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_AJUSTE, cuando, fecha, quien, azar, datos: { clave, valor: v } }) };
}

// ── Mandar gente a una parcela ─────────────────────────────────────────────
// El destino es una parcela O un vehículo (el operador del camión que trae a la
// cuadrilla, el que lleva la cosecha). Su tiempo en el vehículo se le carga al
// vehículo con lo que YA gana: no nace un segundo pago, y sólo cuenta el rato
// asignado, no toda su jornada.
export function asignar({ trabajadorIds, parcelaId, vehiculoId = null, vehiculo = "", beneficiaId = null, actividad, cuadrilla = "", desde, fecha, quien, capturado, azar }) {
  const ids = unicos(trabajadorIds);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador reparte a la gente." };
  if (ids.length === 0) return { ok: false, dice: "Falta escoger a quién se manda." };
  if (parcelaId && vehiculoId) return { ok: false, dice: "Se asigna a una parcela o a un vehículo, no a los dos a la vez. Si manejó y luego trabajó en la parcela, son dos asignaciones." };
  if (!parcelaId && !vehiculoId) return { ok: false, dice: "Falta la parcela o el vehículo." };
  if (!String(actividad || "").trim()) return { ok: false, dice: "Falta qué van a hacer." };
  if (capturado && new Date(desde) > new Date(capturado)) return { ok: false, dice: "No se puede asignar desde una hora que todavía no llega." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_ASIGNACION, cuando: desde, fecha, capturado, quien, azar,
    datos: { trabajadorIds: ids, parcelaId: parcelaId || null, ...(vehiculoId ? { vehiculoId, vehiculo: String(vehiculo || "").trim(), ...(beneficiaId ? { beneficiaId } : {}) } : {}), actividad: String(actividad).trim(), cuadrilla: String(cuadrilla || "").trim() } }) };
}
export function terminar({ trabajadorIds, desde, fecha, quien, capturado, azar }) {
  const ids = unicos(trabajadorIds);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador reparte a la gente." };
  if (ids.length === 0) return { ok: false, dice: "Falta decir quiénes terminaron." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_FIN, cuando: desde, fecha, capturado, quien, azar, datos: { trabajadorIds: ids } }) };
}
// Pago por tarea: tantas unidades a tanto. Si se sabe cuánto hizo CADA QUIEN
// (la relación que entrega la cuadrilla), a cada uno le toca lo suyo. Sólo
// cuando nada más se sabe el total del grupo se reparte parejo — y eso tiene
// que pedirlo quien captura, no lo decide la app.
export function anotarTareas({ produccion, trabajadorIds, cantidad, repartirParejo = false, parcelaId, actividad, unidad, tarifa, cuando, fecha, quien, capturado, azar }) {
  const t = Number(tarifa);
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador anota un destajo." };
  if (!parcelaId) return { ok: false, dice: "Falta la parcela." };
  if (!(t > 0)) return { ok: false, dice: "Falta a cómo se paga cada unidad." };
  const base = { parcelaId, actividad: String(actividad || "Destajo").trim(), unidad: String(unidad || "unidad").trim(), tarifa: t };
  const porPersona = (produccion || []).map(r => ({ trabajadorId: r.trabajadorId, cantidad: Number(r.cantidad) })).filter(r => r.trabajadorId && r.cantidad > 0);
  if (porPersona.length > 0) {
    if (new Set(porPersona.map(r => r.trabajadorId)).size !== porPersona.length) return { ok: false, dice: "Una persona aparece dos veces en la relación." };
    return { ok: true, evento: nuevoEvento({ tipo: TIPO_DESTAJO, cuando, fecha, capturado, quien, azar, datos: { ...base, produccion: porPersona } }) };
  }
  const ids = unicos(trabajadorIds); const c = Number(cantidad);
  if (ids.length === 0) return { ok: false, dice: "Falta decir quiénes lo hicieron." };
  if (!(c > 0)) return { ok: false, dice: "Falta cuánto hizo cada quien, o el total del grupo." };
  if (ids.length > 1 && !repartirParejo) return { ok: false, dice: "Sólo se capturó el total del grupo. Captura cuánto hizo cada quien, o di que se reparta parejo." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_DESTAJO, cuando, fecha, capturado, quien, azar, datos: { ...base, trabajadorIds: ids, cantidad: c, parejo: ids.length > 1 } }) };
}
export const anotarDestajo = (o) => anotarTareas({ ...o, repartirParejo: true });   // nombre anterior
// Lo que le toca a cada quien de un pago por tarea: [{ trabajadorId, cantidad, monto, parejo }].
export function partesDeTareas(e) {
  if (Array.isArray(e.datos.produccion)) return e.datos.produccion.map(r => ({ trabajadorId: r.trabajadorId, cantidad: r.cantidad, monto: multiplicarDinero(e.datos.tarifa, r.cantidad), parejo: false }));
  const ids = e.datos.trabajadorIds || [];
  const montos = repartirDinero(multiplicarDinero(e.datos.tarifa, e.datos.cantidad), ids.map(() => 1));
  return ids.map((id, i) => ({ trabajadorId: id, cantidad: e.datos.cantidad / ids.length, monto: montos[i], parejo: ids.length > 1 }));
}

// Aclarar un rato sin asignar: por qué fue. Es un evento aparte; el rato y las
// marcas no se tocan, y la aclaración se puede cancelar o corregir con su motivo.
export function aclararTiempo({ trabajadorId, fecha, desde, hasta, causa, parcelaId = null, actividad = null, nota = "", quien, cuando, azar }) {
  if (!PUEDE_REPARTIR.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador aclara el tiempo sin asignar." };
  if (!CAUSAS_SIN_ASIGNAR[causa]) return { ok: false, dice: "Falta decir la causa." };
  if (!trabajadorId || !desde || !hasta) return { ok: false, dice: "Falta decir de quién y de qué rato se trata." };
  if (causa === "trabajo_no_registrado" && (!parcelaId || !String(actividad || "").trim())) return { ok: false, dice: "Si sí trabajó, hay que decir en qué parcela y haciendo qué." };
  if (causa === "otra" && !String(nota).trim()) return { ok: false, dice: "Con \"otra causa\" hay que escribir cuál." };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_ACLARACION, cuando: desde, fecha, capturado: cuando, quien, azar,
    datos: { trabajadorId, desde, hasta, causa, nota: String(nota || "").trim(), ...(causa === "trabajo_no_registrado" ? { parcelaId, actividad: String(actividad).trim() } : {}) } }) };
}

// ── Dónde está cada quien AHORA ────────────────────────────────────────────
const cambiosDe = (eventos, fecha) => vigentes(eventos).filter(e => (e.tipo === TIPO_ASIGNACION || e.tipo === TIPO_FIN) && e.fecha === fecha)
  .sort((a, b) => a.cuando.localeCompare(b.cuando) || a.capturado.localeCompare(b.capturado) || a.id.localeCompare(b.id));

export function repartoActual(eventos, { fecha, hoy, ahora }) {
  const adentro = jornadasDe(eventos, { fecha, hoy, ahora }).filter(j => j.adentro);
  const hasta = new Date(ahora).toISOString();
  const cambios = cambiosDe(eventos, fecha).filter(c => c.cuando <= hasta);
  const grupos = new Map(); const sinAsignar = [];
  for (const j of adentro) {
    // Checar salida TERMINA la asignación. Si volvió a entrar, sólo cuenta lo que
    // se le asignó después de esa salida; lo de antes queda como "lo anterior".
    const entro = j.tramos[j.tramos.length - 1].entrada.cuando;
    const salidaPrevia = j.tramos.slice(0, -1).map(t => t.salida?.cuando).filter(Boolean).pop() || null;
    const mios = cambios.filter(c => c.datos.trabajadorIds.includes(j.trabajadorId));
    const c = mios.filter(x => !salidaPrevia || x.cuando >= salidaPrevia).pop();
    if (!c || c.tipo === TIPO_FIN) {
      const previa = salidaPrevia ? mios.filter(x => x.cuando < salidaPrevia && x.tipo === TIPO_ASIGNACION).pop() : null;
      const seguia = previa && mios.filter(x => x.cuando < salidaPrevia).pop() === previa;     // no le habían dicho "ya acabaron"
      sinAsignar.push({ trabajadorId: j.trabajadorId, desde: c?.cuando > entro ? c.cuando : entro,
        anterior: seguia ? { parcelaId: previa.datos.parcelaId, ...(previa.datos.vehiculoId ? { vehiculoId: previa.datos.vehiculoId, vehiculo: previa.datos.vehiculo || "" } : {}), actividad: previa.datos.actividad, cuadrilla: previa.datos.cuadrilla } : null });
      continue;
    }
    const k = `${c.datos.parcelaId || ""}|${c.datos.vehiculoId || ""}|${c.datos.actividad}|${c.datos.cuadrilla}`;
    if (!grupos.has(k)) grupos.set(k, { clave: k, parcelaId: c.datos.parcelaId, vehiculoId: c.datos.vehiculoId || null, vehiculo: c.datos.vehiculo || "", actividad: c.datos.actividad, cuadrilla: c.datos.cuadrilla, miembros: [] });
    grupos.get(k).miembros.push({ trabajadorId: j.trabajadorId, desde: c.cuando > entro ? c.cuando : entro, evento: c.id });
  }
  // A quién se asignó sin que haya checado: no cuenta horas, y se dice.
  const dia = jornadasDe(eventos, { fecha, hoy, ahora });
  const vino = new Set(dia.map(j => j.trabajadorId));
  const ultimo = new Map();
  for (const c of cambios) for (const id of c.datos.trabajadorIds) ultimo.set(id, c);
  const sinChecar = [...ultimo.entries()].filter(([id, c]) => c.tipo === TIPO_ASIGNACION && !vino.has(id)).map(([id, c]) => ({ trabajadorId: id, evento: c.id, parcelaId: c.datos.parcelaId }));
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
      // Checar salida termina la asignación: en este tramo sólo vale lo que se le
      // asignó después de su última salida (o antes de entrar, si es el primero).
      const k = j.tramos.indexOf(t);
      const salidaPrevia = j.tramos.slice(0, k).map(x => x.salida?.cuando).filter(Boolean).pop() || null;
      const vigenteEn = (cuando) => mios.filter(c => c.cuando <= cuando && (!salidaPrevia || c.cuando >= salidaPrevia)).pop() || null;
      if (!fin) {
        // Entró y no se sabe cuándo salió: no se inventan horas. Se deja dicho dónde estaba.
        const c = vigenteEn(ini) || mios[0] || null; const asig = c && c.tipo === TIPO_ASIGNACION ? c : null;
        tramos.push({ ...base, desde: ini, hasta: null, minutos: null, parcelaId: asig?.datos.parcelaId || null, vehiculoId: asig?.datos.vehiculoId || null, vehiculo: asig?.datos.vehiculo || "", beneficiaId: asig?.datos.beneficiaId || null, actividad: asig?.datos.actividad || null, cuadrilla: asig?.datos.cuadrilla || "", evAsignacion: asig?.id || null });
        avisos.push({ clase: "sin_salida", trabajadorId: j.trabajadorId, fecha: j.fecha, ev: t.entrada.id, dice: "Entró y no checó salida: sus horas de ese tramo no se saben." });
        continue;
      }
      const cortes = [ini, ...mios.map(c => c.cuando).filter(c => c > ini && c < fin), fin];
      for (let i = 0; i < cortes.length - 1; i++) {
        if (cortes[i] === cortes[i + 1]) continue;
        const c = vigenteEn(cortes[i]); const asig = c && c.tipo === TIPO_ASIGNACION ? c : null;
        tramos.push({ ...base, desde: cortes[i], hasta: cortes[i + 1], minutos: min(cortes[i], cortes[i + 1]),
          parcelaId: asig?.datos.parcelaId || null, vehiculoId: asig?.datos.vehiculoId || null, vehiculo: asig?.datos.vehiculo || "", beneficiaId: asig?.datos.beneficiaId || null, actividad: asig?.datos.actividad || null, cuadrilla: asig?.datos.cuadrilla || "", evAsignacion: asig?.id || null });
      }
    }
  }
  // Las aclaraciones: a cada rato sin asignar se le pone su causa (la más reciente que lo cubra).
  const aclaraciones = vigentes(eventos).filter(e => e.tipo === TIPO_ACLARACION).sort((a, b) => a.capturado.localeCompare(b.capturado));
  for (const t of tramos) {
    if (t.parcelaId || t.vehiculoId || !t.hasta) continue;
    const a = aclaraciones.filter(x => x.datos.trabajadorId === t.trabajadorId && x.fecha === t.fecha && x.datos.desde < t.hasta && x.datos.hasta > t.desde).pop();
    if (!a) { t.causa = null; continue; }
    t.causa = a.datos.causa; t.nota = a.datos.nota; t.evAclaracion = a.id;
    if (a.datos.causa === "trabajo_no_registrado") { t.parcelaId = a.datos.parcelaId; t.actividad = a.datos.actividad; t.aclarado = true; }
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
// Lo que se decidió pagar de un día en que alguien salió antes. NO hay regla
// automática: mientras nadie decida, el día se paga completo y el caso queda
// "por revisar". La decisión la toma una persona, con nombre y motivo.
export const TIPO_DECISION = "decision_jornada";
export const PAGO_DE_JORNADA = { completo: "Se paga el día completo", medio: "Se paga medio día", horas: "Se pagan las horas trabajadas", ninguno: "No se paga ese día" };
// Con la semana ya cerrada no se decide (ni se cancela una decisión) por encima del cierre: se reabre, con motivo y con
// su permiso, y se vuelve a cerrar. Lo que aun así llegue después (otro teléfono sin señal) sale como diferencia.
export const SEMANA_CERRADA = "Esa semana ya está cerrada. Para cambiar cómo se paga ese día hay que reabrirla (con motivo) y volver a cerrarla: así el cambio queda con quién lo autorizó.";
const enOrden = (a, b) => a.capturado.localeCompare(b.capturado) || String(a.id).localeCompare(String(b.id));   // mismo orden en todos los teléfonos
export function decidirJornada({ permitido, trabajadorId, fecha, situacion, pago, motivo, quien, cuando, azar, semanaCerrada }) {
  { const no = negado(quien, permitido, "Cómo se paga un día así lo decide un administrador."); if (no) return { ok: false, dice: no }; }
  if (!trabajadorId || !fecha) return { ok: false, dice: "Falta decir de quién y de qué día." };
  if (!situacion) return { ok: false, dice: "Falta decir qué pasó." };
  if (!PAGO_DE_JORNADA[pago]) return { ok: false, dice: "Falta decidir cómo se paga ese día." };
  if (!String(motivo || "").trim()) return { ok: false, dice: "Falta el porqué de la decisión: queda escrito con tu nombre." };
  if (semanaCerrada) return { ok: false, dice: SEMANA_CERRADA };
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_DECISION, cuando: `${fecha}T12:00:00-06:00`, fecha, capturado: cuando, quien, azar, datos: { trabajadorId, situacion, pago, motivo: String(motivo).trim() } }) };
}
export function decisionesDeJornada(eventos) {
  const m = new Map();
  for (const e of vigentes(eventos).filter(x => x.tipo === TIPO_DECISION).sort(enOrden)) m.set(`${e.datos.trabajadorId}|${e.fecha}`, e);
  return m;
}
// DOS DECISIONES DISTINTAS PARA EL MISMO DÍA. Dos administradores pueden decidir cómo se paga la misma salida, cada uno
// en su teléfono y sin saber del otro. Las dos quedan guardadas y vale la última que se tomó; pero aplicarla callada
// deja a uno creyendo que se pagó medio día y al otro que completo. Se enseñan las dos, con quién y por qué.
export function decisionesEncontradas(eventos, { desde, hasta } = {}) {
  const por = new Map();
  for (const e of vigentes(eventos).filter(x => x.tipo === TIPO_DECISION && (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta)).sort(enOrden)) {
    const k = `${e.datos.trabajadorId}|${e.fecha}`; if (!por.has(k)) por.set(k, []); por.get(k).push(e);
  }
  return [...por.values()].filter(l => new Set(l.map(e => e.datos.pago)).size > 1).map(l => ({
    trabajadorId: l[0].datos.trabajadorId, fecha: l[0].fecha, vale: l[l.length - 1].id,
    decisiones: l.map(e => ({ ev: e.id, pago: e.datos.pago, situacion: e.datos.situacion, motivo: e.datos.motivo, quien: e.quien?.nombre || "", capturado: e.capturado })) }));
}
// EL HISTORIAL COMPLETO de las decisiones de un periodo: las vigentes, las canceladas (con quién y por qué) y las que
// la base todavía no valida o rechazó. De cada día dice cuál es la que se está aplicando. Nada se borra ni se esconde.
export function historialDeDecisiones(eventos, { desde, hasta } = {}) {
  const vale = new Set([...decisionesDeJornada(eventos).values()].map(e => e.id)), cuentan = new Set(vigentes(eventos).map(e => e.id));
  return (eventos || []).filter(x => x.tipo === TIPO_DECISION && (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta)).sort(enOrden).map(e => ({
    ev: e.id, trabajadorId: e.datos.trabajadorId, fecha: e.fecha, pago: e.datos.pago, situacion: e.datos.situacion, motivo: e.datos.motivo,
    quien: e.quien?.nombre || "", capturado: e.capturado, vale: vale.has(e.id),
    estado: e.estado === "cancelado" ? "cancelada" : e._validacion === "rechazado" ? "rechazada" : cuentan.has(e.id) ? "vigente" : "por_validar",
    cancelada: e.cancelado ? { por: e.cancelado.por?.nombre || "", motivo: e.cancelado.motivo, cuando: e.cancelado.cuando } : null }));
}
export function manoDeObra(eventos, trabajadores, { desde, hasta, hoy, ahora } = {}) {
  const { tramos, avisos } = tramosDeTrabajo(eventos, { desde, hasta, hoy, ahora });
  const horasJornada = ajusteVigente(eventos, "horas_jornada").valor;
  const tolerancia = Number(ajusteVigente(eventos, "tolerancia_salida_min").valor) || 0;
  const decisiones = decisionesDeJornada(eventos); const salidasPorRevisar = [];
  const porId = new Map((trabajadores || []).map(t => [t.id, t]));
  const partes = []; const devengado = [];
  const dias = new Map();
  for (const t of tramos) { const k = `${t.trabajadorId}|${t.fecha}`; if (!dias.has(k)) dias.set(k, []); dias.get(k).push(t); }

  const destajos = vigentes(eventos).filter(e => e.tipo === TIPO_DESTAJO && (!desde || e.fecha >= desde) && (!hasta || e.fecha <= hasta));
  const destajoPorDia = new Map();
  for (const e of destajos) {
    for (const x of partesDeTareas(e)) {
      const k = `${x.trabajadorId}|${e.fecha}`; if (!destajoPorDia.has(k)) destajoPorDia.set(k, []);
      destajoPorDia.get(k).push({ trabajadorId: x.trabajadorId, fecha: e.fecha, parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, modalidad: "destajo", minutos: null,
        unidades: x.cantidad, unidad: e.datos.unidad, monto: x.monto, evs: [e.id], estimado: false, provisional: false, parejo: x.parejo });
    }
  }

  for (const k of new Set([...dias.keys(), ...destajoPorDia.keys()])) {
    const [trabajadorId, fecha] = k.split("|");
    const t = porId.get(trabajadorId); const mios = dias.get(k) || []; const dest = destajoPorDia.get(k) || [];
    const modalidad = t?.modalidadPago || "dia";
    const v = sueldoVigente(t, fecha);
    const sabidos = mios.filter(x => x.minutos != null && x.minutos > 0);
    const provisional = mios.some(x => x.corriendo);
    const misPartes = [...dest];
    const evsDe = (x) => [x.evEntrada, x.evSalida, x.evAsignacion, x.evAclaracion, x.evDecision].filter(Boolean);
    const extra = (x) => ({ vehiculoId: x.vehiculoId || null, vehiculo: x.vehiculo || "", beneficiaId: x.beneficiaId || null, causa: (x.parcelaId && !x.aclarado) || x.vehiculoId ? undefined : x.causa ?? null, nota: x.nota || "", desde: x.desde, hasta: x.hasta, aclarado: !!x.aclarado });
    if (!t) avisos.push({ clase: "sin_ficha", trabajadorId, fecha, dice: "Checó alguien que no está en el catálogo de este aparato: no se le puede poner costo." });
    else if (modalidad !== "destajo" && mios.length > 0) {
      if (!(v.sueldo > 0)) avisos.push({ clase: "sin_sueldo", trabajadorId, fecha, dice: "No tiene sueldo capturado: su día quedó sin costo. Un dato que falta no es un cero." });
      else if (modalidad === "hora") {
        // El total se calcula una vez (no minuto por minuto, que arrastra centavos) y se reparte.
        const total = Math.round((v.sueldo * 100 / horasJornada) * (sabidos.reduce((n, x) => n + x.minutos, 0) / 60)) / 100;
        const montos = repartirDinero(total, sabidos.map(x => x.minutos));
        sabidos.forEach((x, i) => misPartes.push({ trabajadorId, fecha, parcelaId: x.parcelaId, actividad: x.actividad, modalidad: "hora", minutos: x.minutos, monto: montos[i], evs: evsDe(x), estimado: v.estimado === true, provisional: x.corriendo, ...extra(x) }));
      } else if (sabidos.length > 0) {
        // Pago por día: completo, salvo que una persona haya decidido otra cosa para ESE día.
        const min = sabidos.reduce((n, x) => n + x.minutos, 0); const dec = decisiones.get(k);
        const factor = !dec ? 1 : dec.datos.pago === "medio" ? 0.5 : dec.datos.pago === "ninguno" ? 0 : dec.datos.pago === "horas" ? Math.min(1, min / (horasJornada * 60)) : 1;
        if (!dec && !provisional && min < horasJornada * 60 - tolerancia) salidasPorRevisar.push({ trabajadorId, nombre: t.nombre, fecha, minutos: min, faltaron: Math.round(horasJornada * 60 - min), sueldo: v.sueldo });
        const sueldoDelDia = Math.round(v.sueldo * factor * 100) / 100;
        const montos = repartirDinero(sueldoDelDia, sabidos.map(x => x.minutos));
        if (dec) sabidos.forEach(x => { x.evDecision = dec.id; });
        sabidos.forEach((x, i) => misPartes.push({ trabajadorId, fecha, parcelaId: x.parcelaId, actividad: x.actividad, modalidad: "dia", minutos: x.minutos, monto: montos[i], evs: evsDe(x), estimado: v.estimado === true, provisional, ...extra(x) }));
      } else {
        // Vino (checó entrada) pero no se sabe cuánto tiempo: su día se devenga, y
        // NO se le carga a ninguna parcela hasta que alguien cierre su jornada.
        misPartes.push({ trabajadorId, fecha, parcelaId: null, actividad: null, modalidad: "dia", minutos: null, monto: v.sueldo, evs: unicos(mios.flatMap(evsDe)), estimado: v.estimado === true, provisional: false, sinHoras: true });
      }
      if (dest.length > 0) avisos.push({ clase: "dia_y_destajo", trabajadorId, fecha, dice: "Ese día tiene su pago por día Y un destajo. Si sólo cobra por destajo, hay que decirlo en su ficha." });
    }
    if (misPartes.length === 0) continue;
    partes.push(...misPartes);
    devengado.push({ trabajadorId, nombre: t?.nombre || "(no está en el catálogo)", fecha, modalidad, monto: sumarDinero(misPartes.map(p => p.monto)),
      minutos: sabidos.reduce((s, x) => s + x.minutos, 0), origenSueldo: v.origen, estimado: misPartes.some(p => p.estimado), provisional, partes: misPartes });
  }
  const asignado = partes.filter(p => p.parcelaId || p.vehiculoId); const suelto = partes.filter(p => !p.parcelaId && !p.vehiculoId);
  const enVehiculos = partes.filter(p => p.vehiculoId);
  return {
    tramos, partes, devengado, avisos, salidasPorRevisar,
    // El tiempo de los operadores, por vehículo: sale de lo que ya ganan, no es otro pago.
    totalAParcelas: sumarDinero(partes.filter(p => p.parcelaId).map(p => p.monto)), totalAVehiculos: sumarDinero(enVehiculos.map(p => p.monto)),
    porVehiculo: agrupar(enVehiculos, ["vehiculoId"]).map(g => ({ ...g, vehiculo: g.partes.find(p => p.vehiculo)?.vehiculo || "" })),
    total: sumarDinero(partes.map(p => p.monto)), totalAsignado: sumarDinero(asignado.map(p => p.monto)), totalSinAsignar: sumarDinero(suelto.map(p => p.monto)),
    minutosAsignados: asignado.reduce((s, p) => s + (p.minutos || 0), 0), minutosSinAsignar: suelto.reduce((s, p) => s + (p.minutos || 0), 0),
    // Del tiempo sin asignar: cuánto sigue sin aclarar y cuánto ya tiene causa.
    porAclarar: { minutos: suelto.filter(p => !p.causa).reduce((s, p) => s + (p.minutos || 0), 0), monto: sumarDinero(suelto.filter(p => !p.causa).map(p => p.monto)) },
    porCausa: agrupar(suelto.filter(p => p.causa), ["causa"]),
    // Productividad, sin revolver: lo trabajado, lo que falta aclarar, y lo que
    // alguien CONFIRMÓ como improductivo. Espera, traslado y mantenimiento no son ninguna de las tres.
    tiempo: {
      trabajado: asignado.reduce((s, p) => s + (p.minutos || 0), 0),
      porAclarar: suelto.filter(p => !p.causa).reduce((s, p) => s + (p.minutos || 0), 0),
      improductivo: suelto.filter(p => p.causa === "inactividad").reduce((s, p) => s + (p.minutos || 0), 0),
      otros: suelto.filter(p => p.causa && p.causa !== "inactividad").reduce((s, p) => s + (p.minutos || 0), 0),
    },
    horasAdicionales: horasAdicionalesDe(devengado, horasJornada),
  };
}

// Horas adicionales REGISTRADAS: el tiempo que cada quien estuvo por encima de
// su horario habitual. Salen solas de las marcas; nadie las captura. Registrarlas
// NO cambia el pago: reconocerlas como extraordinarias para pagarlas es otra
// decisión, que lleva autorización (todavía no está hecha).
export function horasAdicionalesDe(devengado, horasHabituales) {
  const tope = Math.round(Number(horasHabituales) * 60);
  return devengado.filter(d => d.minutos > tope).map(d => ({ trabajadorId: d.trabajadorId, fecha: d.fecha, minutos: d.minutos - tope, semana: semanaDe(d.fecha), mes: d.fecha.slice(0, 7), anio: d.fecha.slice(0, 4), provisional: d.provisional }));
}
// El lunes de la semana de una fecha (AAAA-MM-DD), para acumular por semana.
export function semanaDe(fecha) {
  const d = new Date(fecha + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function acumular(horas, campo) {
  const m = new Map();
  for (const h of horas) { const k = `${h.trabajadorId}|${h[campo]}`; m.set(k, { trabajadorId: h.trabajadorId, [campo]: h[campo], minutos: (m.get(k)?.minutos || 0) + h.minutos, dias: (m.get(k)?.dias || 0) + 1 }); }
  return [...m.values()];
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
// Y no basta con enseñarlo: mientras exista la captura a mano, el dinero de un
// día de un trabajador sale de UNA fuente. Si ese día tiene mano de obra que
// salió del checador, ésa manda y la tecleada no cuenta su mano de obra (lo
// demás que dice —maquinaria, insumos— no se toca).
export function unaSolaManoDeObra(actividades, partes) {
  const dobles = new Set(capturasDobles(actividades, partes).map(d => d.actividadId));
  let total = 0;
  const salen = (actividades || []).map(a => {
    const era = Number(a?.costoMO) || 0;
    if (!dobles.has(a?.id) || era === 0) return a;
    total = sumarDinero(total, era);
    return { ...a, costoMO: 0, costoTotal: (Number(a.costoTotal) || 0) - era, _noCuenta: { monto: era, dice: "Ese día su mano de obra ya salió del checador: lo tecleado aquí no se cuenta otra vez." } };
  });
  return { actividades: salen, total, cuantas: dobles.size };
}
export function capturasDobles(actividades, partes) {
  const deEventos = new Set(partes.filter(p => (p.parcelaId || p.vehiculoId) && p.modalidad !== "destajo").map(p => `${p.trabajadorId}|${p.fecha}`));
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
reglasDe(TIPO_DESTAJO, (e) => partesDeTareas(e).map(x => ({ clase: "pago_por_tarea", trabajadorId: x.trabajadorId, parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, monto: x.monto, unidades: x.cantidad })));
reglasDe(TIPO_ACLARACION, (e) => [{ clase: "aclaracion", trabajadorId: e.datos.trabajadorId, causa: e.datos.causa, parcelaId: e.datos.parcelaId || null }]);
reglasDe(TIPO_AJUSTE, (e) => [{ clase: "regla", clave: e.datos.clave, valor: e.datos.valor }]);
