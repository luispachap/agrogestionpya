// ════════════════════════════════════════════════════════════════════════
//  RESULTADO, INVENTARIO Y FLUJO — tres preguntas distintas
//
//    RESULTADO   ¿se ganó o se perdió? Los costos cuentan cuando se CAUSAN:
//                la mano de obra el día que se trabajó; el insumo el día que
//                se CONSUMIÓ (no el día que se compró); la maquinaria por lo
//                que de verdad costó, una sola vez.
//    INVENTARIO  ¿qué hay en el almacén y cuánto vale? Comprar no es gastar:
//                es cambiar dinero por mercancía. Lo que se compró y no se ha
//                usado está aquí, no en los costos.
//    FLUJO       ¿qué dinero entró y salió? Cuenta cuando se PAGA: la compra
//                el día que se hizo, la gente el día que se le entregó.
//
//  Reglas que evitan contar dos veces:
//   · Insumos: al resultado entra lo consumido (`costoInsumos` de las
//     actividades, que ya incluye lo que salió del almacén a una parcela),
//     el uso general del rancho, las mermas, y los AJUSTES DE VALUACIÓN
//     (lo que cambió después, aparte y con su causa). Las compras NO.
//   · Maquinaria: la cuota por hora que ya traen las actividades (costo
//     APLICADO) más lo que entra por la fuente de vehículos, que para una
//     máquina con cuota es sólo la DIFERENCIA contra su costo real, y para
//     las demás su costo real completo. Nunca cuota + real.
//     Por eso aquí NO se suman aparte el operador, el diésel ni el taller de
//     un vehículo: ya vienen dentro de esa fuente.
//   · Compras del personal: lo que es mercancía es inventario; sólo lo que no
//     lo es (un flete) es gasto, y mientras no esté valuada no es ninguno.
//   · Personal: lo otorgado/causado es costo; pagar nunca lo es.
//
//  Todas las pantallas leen de aquí.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, vivos } from "./calculos.js";
import { costoAFinanzas } from "./almacen.js";
import { vigentes } from "./eventos.js";

const S = (l) => sumarDinero(l);
const n = (x) => Number(x) || 0;
// Un gasto capturado que en realidad es una compra para el almacén (inventario): categoría «insumos» y sin parcela ni vehículo.
export const esCompraDeAlmacen = (e) => e.categoria === "insumos" && !e.parcelaId && !e.vehiculoId;

//   actividades   las que cuentan (`actividadesContables`)
//   indirectos    lo de `juntarFuentes`
//   compras       lo de `repartoDeCompras` (compras.js)
//   almacen       { consumoGeneral, ajustesValuacion, mermas, valor, sinValor } — ya en dinero
export function resultadoDelRancho({ ingresos = [], egresos = [], entradas_inv = [], actividades = [], indirectos = null, compras = null, almacen = {} }) {
  const deFuente = (f) => !indirectos ? 0 : sumarDinero(S((indirectos.partes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.pendientes || []).filter(p => p.fuente === f).map(p => p.monto)), S((indirectos.noProduccion || []).filter(p => p.fuente === f).map(p => p.monto)));
  const gastos = vivos(egresos).filter(e => !e.vehiculoId && !esCompraDeAlmacen(e));
  const produccion = [
    { clave: "mo", nombre: "Mano de obra en parcelas y bodega", monto: S(actividades.map(a => n(a.costoMO))) },
    { clave: "insumos", nombre: "Insumos consumidos", monto: S(actividades.map(a => n(a.costoInsumos))), nota: "cuentan cuando se usan, no cuando se compran" },
    { clave: "ajustes_insumos", nombre: "Ajustes de valuación de insumos", monto: n(almacen.ajustesValuacion), nota: "consumos cuyo costo se supo o cambió después; el original no se toca" },
    { clave: "maq_cuota", nombre: "Maquinaria: aplicado por cuota por hora", monto: S(actividades.map(a => n(a.costoMaq))) },
    { clave: "vehiculos", nombre: "Maquinaria y vehículos: costo real fuera de la cuota", monto: deFuente("vehiculos"), nota: "operador, combustible, mantenimiento y depreciación; de las máquinas con cuota, sólo la diferencia" },
    { clave: "personal", nombre: "Personal: pagado sin actividad en parcela", monto: deFuente("personal"), nota: "permisos, descansos, esperas, días de encargados" },
    { clave: "prestaciones", nombre: "Prestaciones que se generaron", monto: deFuente("prestaciones"), nota: "aguinaldo, vacaciones y prima; cuentan cuando se ganan" },
    { clave: "bonos", nombre: "Bonos e incentivos otorgados", monto: deFuente("bonos"), nota: "cuentan cuando se otorgan, no cuando se pagan" },
    { clave: "bajas", nombre: "Bajas: prima de antigüedad e indemnizaciones", monto: deFuente("bajas") },
  ];
  const generales = [
    { clave: "gastos", nombre: "Gastos capturados", monto: S(gastos.map(e => n(e.monto))), nota: "sin las compras para el almacén ni los gastos de vehículos" },
    { clave: "compras", nombre: "Compras del personal que no son mercancía", monto: n(compras?.gasto) },
    { clave: "consumo_general", nombre: "Insumos de uso general del rancho", monto: n(almacen.consumoGeneral) },
    { clave: "mermas", nombre: "Mermas y faltantes del almacén", monto: n(almacen.mermas) },
  ];
  const lineas = [...produccion, ...generales];
  const totalIngresos = S(vivos(ingresos).map(g => n(g.monto))), totalEgresos = S(lineas.map(l => l.monto));
  // El inventario: no es gasto. Lo comprado para el almacén que todavía no se usa está aquí.
  const comprado = sumarDinero(S(vivos(egresos).filter(esCompraDeAlmacen).map(e => n(e.monto))), S(entradas_inv.map(costoAFinanzas)), n(compras?.inventario));
  const inventario = { valor: n(almacen.valor), sinValor: almacen.sinValor || [], comprado, porValuar: n(compras?.porValuar) };
  return { ingresos: totalIngresos, produccion, generales, lineas, costos: S(produccion.map(l => l.monto)), gastos: S(generales.map(l => l.monto)), egresos: totalEgresos, utilidad: sumarDinero(totalIngresos, -totalEgresos), inventario };
}

// Lo que entró y salió de dinero, mes por mes.
//   eventos    todos (pagos al personal, de prestaciones, de bajas y de bonos; entregas de préstamos; abonos)
//   prestamos  los de la tabla de antes (los que nacen de eventos ya vienen por su entrega y se ignoran aquí)
export function flujoDeEfectivo({ ingresos = [], egresos = [], compras = [], entradas_inv = [], creditos = [], eventos = [], prestamos = [], hoy = "" }) {
  const meses = new Map();
  const reg = (fecha, lado, clase, monto) => {
    if (!(monto > 0)) return;
    const k = (fecha || hoy || "").slice(0, 7); if (!k) return;
    if (!meses.has(k)) meses.set(k, { mes: k, ingresos: 0, egresos: 0, detalle: {} });
    const m = meses.get(k); m[lado] = sumarDinero(m[lado], monto); m.detalle[clase] = sumarDinero(m.detalle[clase] || 0, monto);
  };
  for (const g of vivos(ingresos)) reg(g.fecha, "ingresos", "ventas", n(g.monto));
  for (const e of vivos(egresos)) reg(e.fecha, "egresos", esCompraDeAlmacen(e) ? "almacen" : "gastos", n(e.monto));
  // La compra del personal sale completa el día que se hizo. Lo que de ella entra al almacén NO sale otra vez.
  for (const c of compras) if (c.estado === "aprobada") reg(c.fecha, "egresos", "compras", n(c.monto));
  for (const e of entradas_inv) reg(e.fecha, "egresos", "almacen", costoAFinanzas(e));
  for (const cr of vivos(creditos)) {
    if (cr.formaPago === "dinero") reg(cr.fecha, "ingresos", "creditos", n(cr.monto));
    for (const ab of cr.abonos || []) if (ab.tipo === "dinero") reg(ab.fecha, "egresos", "abonos_creditos", n(ab.monto));
  }
  for (const e of vigentes(eventos)) {
    const m = n(e.datos?.monto);
    if (e.tipo === "pago_personal") reg(e.fecha, "egresos", "pagos_personal", m);
    else if (e.tipo === "pago_prestacion") reg(e.fecha, "egresos", "pagos_prestaciones", m);
    else if (e.tipo === "pago_baja") reg(e.fecha, "egresos", "pagos_bajas", m);
    else if (e.tipo === "pago_bono") reg(e.fecha, "egresos", "pagos_bonos", m);
    else if (e.tipo === "prestamo_entrega") reg(e.fecha, "egresos", "prestamos_entregados", m);
    // Un abono que sale de lo que ganó en la semana no es dinero que entra: ya se le entregó de menos. Sólo el abono aparte.
    else if (e.tipo === "abono_prestamo" && !e.datos?.semana) reg(e.fecha, "ingresos", "abonos_prestamos", m);
  }
  for (const p of vivos(prestamos)) if (!p._deEventos) reg(p.fecha, "egresos", "prestamos_entregados", n(p.monto));
  const lista = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  let acumulado = 0;
  for (const m of lista) { m.neto = sumarDinero(m.ingresos, -m.egresos); acumulado = sumarDinero(acumulado, m.neto); m.acumulado = acumulado; }
  return { meses: lista, ingresos: S(lista.map(m => m.ingresos)), egresos: S(lista.map(m => m.egresos)), neto: acumulado };
}
export const NOMBRE_DE_FLUJO = { ventas: "ingresos capturados", creditos: "créditos recibidos", abonos_prestamos: "abonos de préstamos al personal", gastos: "gastos capturados", compras: "compras del personal", almacen: "compras para el almacén",
  abonos_creditos: "abonos a créditos", pagos_personal: "pagos al personal", pagos_prestaciones: "pagos de prestaciones", pagos_bajas: "pagos de bajas", pagos_bonos: "pagos de bonos", prestamos_entregados: "préstamos entregados al personal" };
