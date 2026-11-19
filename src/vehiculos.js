// ════════════════════════════════════════════════════════════════════════
//  LO QUE CUESTA UN VEHÍCULO — tres cosas que ya se capturan, juntas
//
//    operador      el rato que un trabajador estuvo asignado a ese vehículo,
//                  con lo que YA gana (sale de la mano de obra; no es otro pago)
//    del almacén   el diésel, el aceite o la refacción que se consumió en él
//    gastos        lo que se pagó directo para él: taller, refacción, gasolinera
//
//  Cada peso entra por UNA sola de las tres. Y un viaje en vehículo propio NO
//  lleva importe: aquí se ve qué viajes hizo, y su costo es el del vehículo.
//  Todavía NO se reparte ese costo a las parcelas: con qué criterio (por viaje,
//  por persona, por hora) es una regla del rancho que no se ha decidido.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, vivos } from "./calculos.js";

export function costoDeVehiculos({ vehiculos = [], partes = [], consumos = [], egresos = [], viajes = [], desde, hasta, conDepreciacion = false }) {
  const enRango = (f) => (!desde || f >= desde) && (!hasta || f <= hasta);
  const nombre = new Map(vehiculos.map(v => [v.id, v.nombre]));
  const m = new Map();
  const de = (id, alias) => { if (!m.has(id)) m.set(id, { vehiculoId: id, nombre: nombre.get(id) || alias || "Vehículo que no está en este aparato", operador: 0, minutos: 0, almacen: 0, gastos: 0, renglones: [], viajes: [], sinCosto: 0 }); return m.get(id); };
  for (const p of partes) if (p.vehiculoId && enRango(p.fecha)) { const v = de(p.vehiculoId, p.vehiculo); v.operador = sumarDinero(v.operador, p.monto); v.minutos += p.minutos || 0; v.renglones.push({ clase: "operador", fecha: p.fecha, quien: p.trabajadorId, que: p.actividad, minutos: p.minutos, monto: p.monto, beneficiaId: p.beneficiaId || null, evs: p.evs }); }
  for (const c of consumos) if (c.destino?.tipo === "vehiculo" && c.destino.id && enRango(c.fecha)) { const v = de(c.destino.id, c.destino.nombre); if (c.costo == null) v.sinCosto += 1; else v.almacen = sumarDinero(v.almacen, c.costo); v.renglones.push({ clase: "almacen", fecha: c.fecha, capturado: c.capturado || null, que: `${c.cantidad} ${c.unidad} de ${c.articulo}`, monto: c.costo, evs: c.evs }); }
  for (const g of vivos(egresos)) if (g.vehiculoId && enRango(g.fecha)) { const v = de(g.vehiculoId); v.gastos = sumarDinero(v.gastos, g.monto); v.renglones.push({ clase: "gasto", fecha: g.fecha, capturado: g._actualizado || null, que: g.concepto || "Gasto", monto: Number(g.monto) || 0, egresoId: g.id }); }
  for (const t of viajes) if (t.vehiculoId && enRango(t.fecha)) de(t.vehiculoId, t.vehiculo).viajes.push(t);
  // Un vehículo con depreciación capturada cuesta aunque ese periodo no tenga ningún papel.
  if (conDepreciacion) for (const x of vehiculos) if (Number(x.depreciacion_mes) > 0) de(x.id);
  return [...m.values()].map(v => ({ ...v, total: sumarDinero(v.operador, v.almacen, v.gastos),
    // Un viaje sin operador asignado ese día: el tiempo de quien manejó no está en la cuenta.
    viajesSinOperador: v.viajes.filter(t => !v.renglones.some(r => r.clase === "operador" && r.fecha === t.fecha)).length,
  })).sort((a, b) => b.total - a.total);
}

// ════════════════════════════════════════════════════════════════════════
//  REPARTIR lo que costó un vehículo entre lo que atendió
//
//  Son DOS VISTAS del mismo dinero: el historial del vehículo (arriba) y a qué
//  parcelas benefició (aquí). Repartir NO crea un gasto nuevo: cada peso
//  repartido sigue siendo el mismo peso del historial, y lleva de dónde salió.
//  Por eso lo repartido + lo pendiente + lo que no fue a producción suma
//  EXACTO el costo del vehículo.
//
//  · Transportar trabajadores (el rato del operador en "Traslado de personal"):
//    entre los viajes de ese día, por las personas que llevó a cada parcela
//    (o por viaje, o parejo: es una regla del rancho).
//  · Lo compartido (combustible, taller, depreciación): entre TODOS los usos
//    del periodo —no sólo llevar gente— por horas, viajes, kilómetros o parejo.
//  · Un uso sin parcela (llevar el camión al taller) se lleva su parte, y esa
//    parte NO se le carga a ninguna parcela.
//  · Lo que no se sabe a qué benefició queda PENDIENTE, con su porqué. No se
//    inventa un criterio para que cuadre.
//  · Una máquina que ya carga cuota por hora en las actividades NO se reparte
//    encima: sería cobrarla dos veces. Se enseña la cuota contra el costo real.
// ════════════════════════════════════════════════════════════════════════
import { repartirDinero } from "./calculos.js";
export const ACT_TRASLADO = "Traslado de personal";
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000) + 1;
const enteros = (pesos) => pesos.map(p => Math.round(p * 1000));

// `trabajo`: lo que hizo cada cuadrilla cada día ({fecha, cuadrillaId, parcelaId, personas}).
// `cuotas`: actividades que ya cargaron maquinaria por hora ({maquinariaId, fecha, costoMaq}).
export function repartirVehiculos({ vehiculos = [], costos = [], trabajo = [], cuotas = [], desde, hasta, criterioTraslado = "personas", criterioVehiculo = "horas" }) {
  const enRango = (f) => (!desde || f >= desde) && (!hasta || f <= hasta);
  const ficha = new Map(vehiculos.map(v => [v.id, v]));
  return costos.map(v => {
    const cuota = sumarDinero(cuotas.filter(a => a.maquinariaId === v.vehiculoId && enRango(a.fecha) && Number(a.costoMaq) > 0).map(a => a.costoMaq));
    const depMes = Number(ficha.get(v.vehiculoId)?.depreciacion_mes) || 0;
    const depreciacion = depMes > 0 && desde && hasta ? Math.round(depMes * diasEntre(desde, hasta) / 30.4 * 100) / 100 : 0;
    const base = { vehiculoId: v.vehiculoId, nombre: v.nombre, costoReal: sumarDinero(v.total, depreciacion), depreciacion, cuota };
    if (cuota > 0) return { ...base, modo: "cuota", partes: [], pendientes: [], noProduccion: 0, repartido: 0,
      dice: `Ya carga cuota por hora en las actividades (${cuota}). Su costo real no se reparte encima: sería cobrarlo dos veces.` };

    // Los usos del periodo: cada viaje con cuadrilla, y cada rato de operador que no fue traslado de personal.
    const opTraslado = v.renglones.filter(r => r.clase === "operador" && r.que === ACT_TRASLADO);
    const opOtros = v.renglones.filter(r => r.clase === "operador" && r.que !== ACT_TRASLADO);
    const destinosDe = (t) => { const m = new Map(); for (const w of trabajo) if (w.fecha === t.fecha && w.cuadrillaId === t.cuadrillaId && w.parcelaId) m.set(w.parcelaId, (m.get(w.parcelaId) || 0) + (w.personas || 1)); return [...m].map(([parcelaId, personas]) => ({ parcelaId, personas })); };
    const viajes = v.viajes.map(t => ({ ...t, destinos: destinosDe(t) }));
    const partes = []; const pendientes = []; let noProduccion = 0;
    const enPesos = (n) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    const QUE = { operador: "el tiempo del operador", compartido: "combustible, taller y depreciación" };
    const carga = (monto, destinos, origen, baseTxt, fecha, como = "") => {    // un importe → las parcelas de un viaje, por personas
      if (monto <= 0) return;
      const m = repartirDinero(monto, destinos.map(d => d.personas)); const todos = destinos.reduce((s, x) => s + x.personas, 0);
      destinos.forEach((d, i) => { if (m[i] > 0) partes.push({ parcelaId: d.parcelaId, monto: m[i], origen, fecha, vehiculoId: v.vehiculoId, vehiculo: v.nombre,
        base: `${baseTxt}${destinos.length > 1 ? ` · ${d.personas} de ${todos} personas` : ""}`,
        // Cómo se calculó, en palabras, para quien pregunte.
        explica: `${v.nombre}: ${QUE[origen]}. ${como}${destinos.length > 1 ? ` De ese importe (${enPesos(monto)}), a esta parcela le tocaron ${d.personas} de las ${todos} personas que llevó.` : ""}`.trim() }); });
    };
    // 1 · Transportar trabajadores: el operador de cada día, entre los viajes de ese día.
    const minutosDeViaje = new Map();
    for (const fecha of new Set(opTraslado.map(r => r.fecha))) {
      const monto = sumarDinero(opTraslado.filter(r => r.fecha === fecha).map(r => r.monto)); const min = opTraslado.filter(r => r.fecha === fecha).reduce((s, r) => s + (r.minutos || 0), 0);
      const delDia = viajes.filter(t => t.fecha === fecha);
      if (delDia.length === 0) { pendientes.push({ monto, origen: "operador", fecha, porque: "Hay tiempo de operador en traslado de personal y ese día no hay ningún viaje de cuadrilla registrado con este vehículo." }); continue; }
      const conDestino = delDia.filter(t => t.destinos.length > 0);
      if (conDestino.length === 0) { pendientes.push({ monto, origen: "operador", fecha, porque: "Ese día llevó gente, pero no hay trabajo registrado de esa cuadrilla: no se sabe a qué parcela benefició." }); continue; }
      const pesos = conDestino.map(t => (criterioTraslado === "viajes" ? 1 : criterioTraslado === "parejo" ? t.destinos.length : t.destinos.reduce((s, d) => s + d.personas, 0) || t.personas || 1));
      const m = repartirDinero(monto, pesos); const mm = repartirDinero(min, pesos);
      conDestino.forEach((t, i) => { minutosDeViaje.set(t, mm[i]); carga(m[i], criterioTraslado === "parejo" ? t.destinos.map(d => ({ ...d, personas: 1 })) : t.destinos, "operador", `Traslado del ${fecha} (${t.cuadrilla})`, fecha,
        `Ese día el operador costó ${enPesos(monto)} llevando gente${conDestino.length > 1 ? `, repartido entre ${conDestino.length} viajes` : ""}.`); });
    }
    // 2 · Lo compartido, entre todos los usos del periodo.
    const compartido = sumarDinero(v.almacen, v.gastos, depreciacion);
    const usos = [
      ...viajes.map(t => ({ clase: "viaje", fecha: t.fecha, que: `Viaje del ${t.fecha} (${t.cuadrilla})`, destinos: t.destinos, minutos: minutosDeViaje.get(t) || 0, km: Number(t.km) > 0 ? Number(t.km) : null })),
      ...opOtros.map(r => ({ clase: "uso", fecha: r.fecha, que: `${r.que} del ${r.fecha}`, destinos: r.beneficiaId ? [{ parcelaId: r.beneficiaId, personas: 1 }] : [], sinParcela: !r.beneficiaId, minutos: r.minutos || 0, km: null })),
    ];
    if (compartido > 0) {
      const peso = (u) => (criterioVehiculo === "viajes" ? 1 : criterioVehiculo === "km" ? u.km : criterioVehiculo === "periodo" ? 1 : u.minutos);
      if (usos.length === 0) pendientes.push({ monto: compartido, origen: "compartido", porque: "No hay ningún uso registrado de este vehículo en el periodo: no se sabe a qué benefició." });
      else if (criterioVehiculo === "km" && usos.some(u => u.km == null)) pendientes.push({ monto: compartido, origen: "compartido", porque: "Se pidió repartir por kilómetros y hay usos sin kilometraje capturado." });
      else if (usos.every(u => !(peso(u) > 0))) pendientes.push({ monto: compartido, origen: "compartido", porque: "Se pidió repartir por horas de uso y no hay horas de operador registradas en este vehículo." });
      else {
        const m = repartirDinero(compartido, enteros(usos.map(u => peso(u) || 0)));
        usos.forEach((u, i) => {
          if (m[i] <= 0) return;
          if (u.sinParcela) { noProduccion = sumarDinero(noProduccion, m[i]); return; }
          if (u.destinos.length === 0) { pendientes.push({ monto: m[i], origen: "compartido", fecha: u.fecha, porque: `${u.que}: no hay trabajo registrado de esa cuadrilla ese día, no se sabe a qué parcela benefició.` }); return; }
          carga(m[i], u.destinos, "compartido", u.que, u.fecha, `En el mes sumaron ${enPesos(compartido)} y se repartieron ${({ horas: "por horas de uso", viajes: "por viajes", km: "por kilómetros", periodo: "parejo" })[criterioVehiculo]} entre ${usos.length} uso(s); a "${u.que}" le tocaron ${enPesos(m[i])}.`);
        });
      }
    }
    // El operador en usos que no son traslado de personal: a su parcela si se dijo, y si no, no es de producción.
    for (const r of opOtros) { if (r.beneficiaId) partes.push({ parcelaId: r.beneficiaId, monto: r.monto, origen: "operador", fecha: r.fecha, vehiculoId: v.vehiculoId, vehiculo: v.nombre, base: `${r.que} del ${r.fecha}`, explica: `${v.nombre}: el tiempo del operador en "${r.que}", que se dijo que fue para esta parcela.` }); else noProduccion = sumarDinero(noProduccion, r.monto); }
    const repartido = sumarDinero(partes.map(p => p.monto)); const pendiente = sumarDinero(pendientes.map(p => p.monto));
    return { ...base, modo: "reparto", criterioTraslado, criterioVehiculo, partes, pendientes, noProduccion, repartido, pendiente, usos: usos.length,
      cuadra: sumarDinero(repartido, pendiente, noProduccion) === base.costoReal };
  });
}
// Lo que le tocó a cada parcela, sumando todos los vehículos. Es costo INDIRECTO:
// va encima del costo directo de la parcela, sin cambiarlo.
export function indirectoPorParcela(repartos) {
  const m = new Map();
  for (const v of repartos) for (const p of v.partes) { const x = m.get(p.parcelaId) || { parcelaId: p.parcelaId, monto: 0, renglones: [] }; x.monto = sumarDinero(x.monto, p.monto); x.renglones.push({ ...p, vehiculo: v.nombre, vehiculoId: v.vehiculoId }); m.set(p.parcelaId, x); }
  return [...m.values()].sort((a, b) => b.monto - a.monto);
}

// ── Mes por mes, y como FUENTE de costo indirecto ──────────────────────────
// Lo de cada mes se reparte entre los usos de ESE mes: el taller de marzo no se
// le carga a los viajes de noviembre. La depreciación sólo corre en los meses
// que ya terminaron o van corriendo, desde el primero en que el vehículo aparece.
const finDeMes = (mes) => { const [a, m] = mes.split("-").map(Number); return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`; };
export function vehiculosPorMes({ vehiculos = [], partes = [], consumos = [], egresos = [], viajes = [], trabajo = [], cuotas = [], hoy, criterioTraslado, criterioVehiculo }) {
  const meses = new Set();
  for (const p of partes) if (p.vehiculoId) meses.add(p.fecha.slice(0, 7));
  for (const c of consumos) if (c.destino?.tipo === "vehiculo") meses.add(c.fecha.slice(0, 7));
  for (const g of vivos(egresos)) if (g.vehiculoId && g.fecha) meses.add(g.fecha.slice(0, 7));
  for (const t of viajes) if (t.vehiculoId) meses.add(t.fecha.slice(0, 7));
  const lista = [...meses].sort(); if (lista.length === 0) return [];
  // Todos los meses desde el primero hasta el de hoy, para que la depreciación no se salte los meses sin papeles.
  const todos = []; let [a, m] = lista[0].split("-").map(Number); const tope = (hoy || lista[lista.length - 1]).slice(0, 7);
  while (`${a}-${String(m).padStart(2, "0")}` <= tope && todos.length < 240) { todos.push(`${a}-${String(m).padStart(2, "0")}`); m += 1; if (m > 12) { m = 1; a += 1; } }
  return todos.flatMap(mes => {
    const desde = `${mes}-01`, hasta = finDeMes(mes);
    const costos = costoDeVehiculos({ vehiculos, partes, consumos, egresos, viajes, desde, hasta, conDepreciacion: true });
    return repartirVehiculos({ vehiculos, costos, trabajo, cuotas, desde, hasta, criterioTraslado, criterioVehiculo }).filter(r => r.costoReal > 0 || r.partes.length > 0).map(r => ({ ...r, mes }));
  });
}
export function fuenteVehiculos(repartosPorMes) {
  const reparto = repartosPorMes.filter(r => r.modo === "reparto");
  return { fuente: "vehiculos", nombre: "Vehículos y maquinaria",
    partes: reparto.flatMap(r => r.partes.map(p => ({ ...p, mes: r.mes }))),
    pendientes: reparto.flatMap(r => r.pendientes.map(p => ({ ...p, mes: r.mes, vehiculo: r.nombre, vehiculoId: r.vehiculoId }))),
    noProduccion: sumarDinero(reparto.map(r => r.noProduccion)),
    detalleNoProduccion: reparto.filter(r => r.noProduccion > 0).map(r => ({ mes: r.mes, vehiculo: r.nombre, monto: r.noProduccion })) };
}
