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

export function costoDeVehiculos({ vehiculos = [], partes = [], consumos = [], egresos = [], viajes = [], desde, hasta }) {
  const enRango = (f) => (!desde || f >= desde) && (!hasta || f <= hasta);
  const nombre = new Map(vehiculos.map(v => [v.id, v.nombre]));
  const m = new Map();
  const de = (id, alias) => { if (!m.has(id)) m.set(id, { vehiculoId: id, nombre: nombre.get(id) || alias || "Vehículo que no está en este aparato", operador: 0, minutos: 0, almacen: 0, gastos: 0, renglones: [], viajes: [], sinCosto: 0 }); return m.get(id); };
  for (const p of partes) if (p.vehiculoId && enRango(p.fecha)) { const v = de(p.vehiculoId, p.vehiculo); v.operador = sumarDinero(v.operador, p.monto); v.minutos += p.minutos || 0; v.renglones.push({ clase: "operador", fecha: p.fecha, quien: p.trabajadorId, que: p.actividad, minutos: p.minutos, monto: p.monto, evs: p.evs }); }
  for (const c of consumos) if (c.destino?.tipo === "vehiculo" && c.destino.id && enRango(c.fecha)) { const v = de(c.destino.id, c.destino.nombre); if (c.costo == null) v.sinCosto += 1; else v.almacen = sumarDinero(v.almacen, c.costo); v.renglones.push({ clase: "almacen", fecha: c.fecha, que: `${c.cantidad} ${c.unidad} de ${c.articulo}`, monto: c.costo, evs: c.evs }); }
  for (const g of vivos(egresos)) if (g.vehiculoId && enRango(g.fecha)) { const v = de(g.vehiculoId); v.gastos = sumarDinero(v.gastos, g.monto); v.renglones.push({ clase: "gasto", fecha: g.fecha, que: g.concepto || "Gasto", monto: Number(g.monto) || 0, egresoId: g.id }); }
  for (const t of viajes) if (t.vehiculoId && enRango(t.fecha)) de(t.vehiculoId, t.vehiculo).viajes.push(t);
  return [...m.values()].map(v => ({ ...v, total: sumarDinero(v.operador, v.almacen, v.gastos),
    // Un viaje sin operador asignado ese día: el tiempo de quien manejó no está en la cuenta.
    viajesSinOperador: v.viajes.filter(t => !v.renglones.some(r => r.clase === "operador" && r.fecha === t.fecha)).length,
  })).sort((a, b) => b.total - a.total);
}
