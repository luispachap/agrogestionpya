// ════════════════════════════════════════════════════════════════════════
//  CAJA CHICA — no toda salida de caja es un gasto
//
//  Decidido por Luis (21 nov): de la caja sale dinero para siete cosas distintas, y cada una se cuenta distinto.
//  La caja NO inventa nada nuevo: cada clase usa lo que ya existía.
//
//    gasto_parcela   gasto de una parcela       → un gasto ligado, con su parcela (costo de esa parcela)
//    gasto_general   gasto general del rancho   → un gasto ligado, SIN parcela (gasto general en Resultados)
//    inventario      compra para el almacén     → un gasto de «insumos» que entró al almacén: no es gasto todavía
//    prestamo        préstamo a un trabajador   → el préstamo vive en Préstamos (se pide, se autoriza, se entrega);
//                                                 la caja sólo dice que el dinero salió de aquí y se LIGA a esa entrega
//    pago_personal   anticipo o pago a alguien  → el pago vive en Pagos al personal; la caja se LIGA a ese pago
//    traspaso        traspaso de fondos         → dinero que cambia de bolsa dentro del rancho: ni gasto ni salida
//    otro            todavía no se sabe         → POR CLASIFICAR: sale en el flujo, y no entra a Resultados
//
//  Reglas:
//   · El dinero que ENTRA a la caja (el fondo, o su reposición) es un traspaso: no es ingreso, y no es gasto. El gasto
//     nace cuando ese dinero se usa. Así el fondo nunca se cuenta dos veces.
//   · Una salida no desaparece del flujo de efectivo: o se cuenta por su gasto ligado, o por el pago o préstamo al que
//     está ligada, o —si no tiene ninguno de los dos— se cuenta aquí, con su nombre: «por clasificar» o «por ligar».
//   · Nada se cuenta dos veces: si la salida ya tiene su gasto o su evento, la caja no la vuelve a sumar.
//   · La caja no crea préstamos ni pagos: ésos necesitan permiso y se registran en su pantalla.
// ════════════════════════════════════════════════════════════════════════
import { vivos, estaCancelado } from "./calculos.js";
import { vigentes } from "./eventos.js";

export const CLASES_DE_SALIDA = {
  gasto_parcela: { nombre: "Gasto de una parcela", ayuda: "Entra al costo de esa parcela.", egreso: true, pideParcela: true },
  gasto_general: { nombre: "Gasto general del rancho", ayuda: "Sale en Resultados como gasto general. No se le inventa una parcela.", egreso: true },
  inventario: { nombre: "Compra para el almacén", ayuda: "No es gasto todavía: se cuenta cuando se use. La mercancía se recibe en Almacén.", egreso: true },
  prestamo: { nombre: "Préstamo a un trabajador", ayuda: "No es gasto. El préstamo se pide, se autoriza y se entrega en Préstamos; aquí sólo se anota que el dinero salió de esta caja.", liga: ["prestamo_entrega"] },
  pago_personal: { nombre: "Anticipo o pago a un trabajador", ayuda: "No es gasto: el costo nació el día que trabajó. El pago se registra en Pagos al personal; aquí sólo se anota que salió de esta caja.", liga: ["pago_personal", "pago_prestacion", "pago_bono", "pago_baja"] },
  traspaso: { nombre: "Traspaso de fondos", ayuda: "Dinero que regresa a administración o pasa a otra caja. No es gasto ni salida de dinero del rancho." },
  otro: { nombre: "Otra cosa, o todavía no sé", ayuda: "Queda por clasificar: sale en el flujo de efectivo y no entra a Resultados hasta que alguien diga qué fue." },
};
export const ORDEN_DE_CLASES = ["gasto_parcela", "gasto_general", "inventario", "prestamo", "pago_personal", "traspaso", "otro"];
export const nombreDeClase = (c) => CLASES_DE_SALIDA[c]?.nombre || "Por clasificar";

// Qué fue una salida. Las de antes no dicen clase: con parcela eran gasto de esa parcela; sin parcela, nadie dijo qué fueron.
export function claseDeSalida(mov) {
  if (!mov || mov.tipo !== "salida") return null;
  if (CLASES_DE_SALIDA[mov.clase]) return mov.clase;
  return mov.parcelaId ? "gasto_parcela" : "otro";
}

// Lo que hay que revisar antes de guardar. Devuelve el texto de lo que falta, o "".
export function revisarSalida({ clase, concepto, monto, parcelaId }) {
  if (!String(concepto || "").trim()) return "Falta el concepto.";
  if (!(Number(monto) > 0)) return "Falta el monto.";
  if (!CLASES_DE_SALIDA[clase]) return "Falta decir qué fue esta salida.";
  if (CLASES_DE_SALIDA[clase].pideParcela && !parcelaId) return "Falta decir de qué parcela fue el gasto. Si no fue de ninguna, es un gasto general.";
  return "";
}

// El gasto ligado que le toca a una salida (o null si su clase no es un gasto). El id es FIJO por movimiento: clasificar
// dos veces la misma salida no crea dos gastos.
export function egresoDeCaja(mov, quien = null) {
  const clase = claseDeSalida(mov);
  if (!clase || !CLASES_DE_SALIDA[clase].egreso) return null;
  const base = { id: "eg-" + mov.id, fecha: mov.fecha, concepto: "Caja chica: " + mov.concepto, monto: Number(mov.monto) || 0, cajachicaId: mov.id, ...(quien ? { registradoPor: quien } : {}) };
  if (clase === "gasto_parcela") return mov.parcelaId ? { ...base, categoria: "caja_chica", parcelaId: mov.parcelaId } : null;
  if (clase === "gasto_general") return { ...base, categoria: "caja_chica" };
  return { ...base, categoria: "insumos", destinoInsumo: "inventario" };
}

const gastoLigado = (mov, egresos) => (egresos || []).find(e => e.cajachicaId === mov.id && !estaCancelado(e)) || null;
const eventoLigado = (mov, eventos) => mov.eventoId ? vigentes(eventos || []).find(e => e.id === mov.eventoId) || null : null;

// Cómo queda cada salida viva: por dónde se cuenta su dinero.
//   via: "gasto" (su gasto ligado) · "evento" (el pago o préstamo ligado) · "traspaso" (no se cuenta) · "caja" (se cuenta aquí)
//   pendiente: "" · "por_clasificar" · "por_ligar"
export function estadoDeSalida(mov, { egresos = [], eventos = [] } = {}) {
  const clase = claseDeSalida(mov);
  if (!clase) return null;
  if (clase === "traspaso") return { clase, via: "traspaso", pendiente: "" };
  if (gastoLigado(mov, egresos)) return { clase, via: "gasto", pendiente: "" };
  if (CLASES_DE_SALIDA[clase].liga) return eventoLigado(mov, eventos) ? { clase, via: "evento", pendiente: "" } : { clase, via: "caja", pendiente: "por_ligar" };
  // «otro», o un gasto cuyo gasto ligado no existe o fue cancelado: el dinero salió y nadie dice a dónde se carga.
  return { clase, via: "caja", pendiente: "por_clasificar" };
}

// Lo que la caja le agrega al flujo de efectivo: SÓLO las salidas que no se cuentan por otro lado.
export function salidasDeCajaAlFlujo(cajachica = [], ctx = {}) {
  const sale = [];
  for (const mov of vivos(cajachica)) {
    const e = estadoDeSalida(mov, ctx);
    if (e && e.via === "caja") sale.push({ fecha: mov.fecha, monto: Number(mov.monto) || 0, clase: e.pendiente === "por_ligar" ? "caja_por_ligar" : "caja_por_clasificar", id: mov.id });
  }
  return sale;
}

// Lo que alguien tiene que resolver: lo que nadie dijo qué fue y lo que falta ligar a su préstamo o pago.
export function pendientesDeCaja(cajachica = [], ctx = {}) {
  const porClasificar = [], porLigar = [];
  for (const mov of vivos(cajachica)) {
    const e = estadoDeSalida(mov, ctx);
    if (e?.pendiente === "por_clasificar") porClasificar.push(mov);
    if (e?.pendiente === "por_ligar") porLigar.push(mov);
  }
  const suma = (l) => Math.round(l.reduce((s, m) => s + (Number(m.monto) || 0) * 100, 0)) / 100;
  return { porClasificar, porLigar, montoPorClasificar: suma(porClasificar), montoPorLigar: suma(porLigar) };
}

// Los préstamos entregados o pagos registrados a los que se puede ligar una salida de esa clase: vigentes y que
// ninguna otra salida viva tenga ya ligados (un pago no sale de la caja dos veces).
export function eventosParaLigar(clase, { eventos = [], cajachica = [], propio = null } = {}) {
  const tipos = CLASES_DE_SALIDA[clase]?.liga;
  if (!tipos) return [];
  const ocupados = new Set(vivos(cajachica).filter(m => m.eventoId && m.id !== propio).map(m => m.eventoId));
  return vigentes(eventos).filter(e => tipos.includes(e.tipo) && !ocupados.has(e.id))
    .map(e => ({ id: e.id, tipo: e.tipo, fecha: e.fecha, monto: Number(e.datos?.monto) || 0, trabajadorId: e.datos?.trabajadorId || e.datos?.a?.id || "", nombre: e.datos?.a?.nombre || "" }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

// Ligar una salida a su evento: tiene que ser de un tipo que le toca, estar libre y ser del mismo importe.
export function revisarLiga(mov, eventoId, ctx = {}) {
  const clase = claseDeSalida(mov);
  const e = eventosParaLigar(clase, { ...ctx, propio: mov.id }).find(x => x.id === eventoId);
  if (!e) return "Ese registro no se puede ligar: no existe, está cancelado, no está autorizado o ya está ligado a otra salida.";
  if (Math.abs(e.monto - (Number(mov.monto) || 0)) > 0.004) return `Los importes no coinciden: de la caja salieron ${Number(mov.monto) || 0} y ese registro es por ${e.monto}. No se liga algo que no cuadra.`;
  return "";
}

// El saldo de la caja: lo que entró menos lo que salió, sin lo cancelado. Todas las clases salen de la caja por igual.
export const saldoDeCaja = (cajachica = []) => Math.round(vivos(cajachica).reduce((s, c) => s + (c.tipo === "entrada" ? 1 : -1) * (Number(c.monto) || 0) * 100, 0)) / 100;
