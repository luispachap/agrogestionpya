// ============================================================
//  AgroGestión — Cuándo se va a acabar, y qué cuesta reponerlo
//
//  Luis lo pidió así: "que se confirme o no también si hubiera suficiente
//  insumo de cualquier tipo e ir prediciendo cuándo se va a terminar y cuánto
//  costará reponerlo y cuándo será necesario, antes de parar una operación
//  por esa situación."
//
//  EL DAÑO QUE EVITA
//  Parar una siembra, un riego o una aplicación a media mañana porque se
//  acabó el diésel, la semilla o un fertilizante que nadie pidió a tiempo.
//  Eso no cuesta el saco que faltó: cuesta el día de la cuadrilla completa,
//  la renta de la máquina parada y la ventana de aplicación que se pasó.
//
//  LO QUE DECIDE
//  Nada. Contesta cuatro preguntas y se calla:
//    1. ¿A qué ritmo se está gastando esto?      (ritmoDeConsumo)
//    2. ¿Qué día se acaba?                        (cuandoSeAcaba)
//    3. ¿Cuánto cuesta reponerlo?                 (cuestaReponer)
//    4. ¿Cuándo hay que PEDIRLO?                  (aTiempoDePedir)
//  Y con eso arma la lista de lo que va a faltar (loQueVaAFaltar) y contesta
//  si una faena planeada se va a parar a medias (pararaLaOperacion).
//
//  LA PREGUNTA QUE DE VERDAD IMPORTA ES LA 4
//  No sirve avisar el día que se acaba: para entonces la camioneta ya se fue
//  a Aguascalientes y el proveedor tarda tres días. La fecha útil es la de
//  PEDIRLO, que es la de acabarse menos los días de entrega. Por eso los días
//  de entrega son parte del insumo, y cuando no se capturaron se dice en voz
//  alta que se está suponiendo — nunca se supone callado.
//
//  ─────────────────────────────────────────────────────────────
//  CÓMO SE LEEN LOS MOVIMIENTOS DE BODEGA — esto importa mucho
//  ─────────────────────────────────────────────────────────────
//  En la app hay UNA sola lista de movimientos de bodega (`entradas_inv`) y
//  ahí conviven las compras y los vales de salida. Se distinguen por el
//  SIGNO de la cantidad: un vale entra en NEGATIVO (así lo escribe la
//  pantalla de vales) y una compra en POSITIVO.
//
//  Leer todo como salida, o quedarse sólo con lo positivo, produce el peor
//  error posible: SURTIR EL TANQUE ADELANTARÍA la fecha en que se acaba. Se
//  compran 1,000 litros, el módulo los cuenta como consumo, el ritmo se
//  dispara y la app grita que hay que pedir diésel el día que acaba de
//  llegar el diésel. Una alarma así, dos veces, y nadie vuelve a mirar la
//  pantalla.
//
//  Por eso el signo se lee y NO se adivina:
//    · comoVieneElSigno: "bodega"        → negativo = salida, positivo = compra.
//    · comoVieneElSigno: "puras salidas" → la lista ya viene filtrada a vales
//      y todas las cantidades son consumo, venga el signo que venga.
//  El default es "bodega", que es como la app guarda los renglones. Quien le
//  pase una lista ya filtrada lo dice al llamar; nunca se supone.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE — y hay que decirlo
//  ─────────────────────────────────────────────────────────────
//  · NO INVENTA UN RITMO. Con una sola salida no hay ritmo: hay un dato.
//    Un promedio sacado de un dato es un número inventado con cara de
//    cálculo, y sobre él saldría una fecha de "se acaba el 14 de octubre"
//    que nadie volvería a cuestionar. Sin ritmo: null, y por qué.
//  · NO MEZCLA INSUMOS. Sin decir de cuál se pregunta, no contesta: sumar
//    litros de diésel con bultos de urea da un número, no un ritmo.
//  · NO TIRA NINGÚN RENGLÓN EN SILENCIO. Un vale sin cantidad o sin fecha no
//    desaparece: se cuenta, se dice cuántos son, y el ritmo queda marcado.
//    Un renglón que se cae callado es exactamente lo que hace que un dato
//    malo parezca bueno.
//  · NO COTIZA. El costo de reponer sale del costo promedio de la bodega:
//    es lo que costó, no lo que el proveedor va a cobrar. Sirve para saber
//    de qué tamaño es el pendiente, no para hacerle la orden de compra.
//  · NO PIDE NADA SOLO. Propone; la orden la manda una persona.
//  · NO BLOQUEA NINGUNA OPERACIÓN (bloquea: false, explícito, en todas).
//    Que falte un saco lo resuelve quien compra. Bloquear la faena sólo
//    lograría que se planee fuera del sistema.
//  · NO SUPONE POR QUÉ dejó de salir un insumo. Dice cuántos días lleva sin
//    moverse; si está parada la labor, prestado el tractor o nadie anotó, eso
//    lo sabe la persona.
//  · NO REPARTE NI RELLENA. Un insumo sin costo no vale cero y un insumo sin
//    existencia capturada no tiene cero: no se sabe, y va en su propia lista.
//
//  DE DÓNDE SE CUELGA
//  El costo de lo que sale ya está resuelto en almacen.js (costoDeSalida, con
//  el costo promedio ponderado). Aquí NO se vuelve a calcular: se llama.
//  La pregunta "¿alcanza?" de un momento dado ya la contestan
//  alcanzaParaLaAplicacion (fertiriego.js) y alcanzaLaSemilla (siembra.js);
//  este archivo no las reemplaza, agrega el EJE DEL TIEMPO que a las dos les
//  falta: no sólo si alcanza hoy, sino hasta cuándo y cuándo hay que pedir.
//
//  Sus pruebas están en src/prediccion.test.js.
// ============================================================

import {
  fechaLocal, sumarDias, diasEntre, sumarDinero, fmt, fmtN, vivos,
} from "./calculos.js";
import { costoDeSalida } from "./almacen.js";
import { normalizar } from "./lectura.js";

// Number(null) es 0, Number("") es 0 y Number(undefined) es NaN. Ese 0 ya
// causó un bug real en este proyecto: un dato que falta se sumaba como cero y
// nadie lo volvía a mirar. Aquí lo que falta vale null y se pregunta.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

const red = (n, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

// Cantidades (kilos, litros, bultos) para pantalla. El dinero NUNCA pasa por
// aquí: ése va por fmt, que opera en centavos enteros.
const cant = (n) => fmtN(red(n, 2));

// Baja la primera letra para poder pegar una explicación después de dos
// puntos sin que quede una mayúscula a media frase.
const minuscula = (t) => (t ? `${String(t).charAt(0).toLowerCase()}${String(t).slice(1)}` : "");

/* ════════════ LAS PERILLAS, CON SU RAZÓN ════════════ */

// Cuánta historia se mira para sacar el ritmo. Noventa días es un tramo de
// ciclo: alcanza para promediar varias salidas sin arrastrar la temporada
// pasada, que en un rancho no se parece en nada a ésta.
export const VENTANA_DIAS = 90;

// A partir de cuánta dispersión las salidas dejan de ser parejas. Se mide con
// la desviación estándar contra el promedio: si el bandazo típico pasa de la
// mitad del promedio, ya no son salidas del mismo tamaño —hay garrafas de 20
// litros mezcladas con tambos de 200— y el promedio se sigue dando, pero
// diciendo que es un promedio de cosas distintas.
export const IRREGULAR_DESDE = 0.5;

// Un tramo de menos de una semana es muy poco para llamarle ritmo. Se da el
// número, marcado.
export const TRAMO_CORTO_DIAS = 7;

// Lo que se supone que tarda un proveedor cuando NADIE capturó sus días de
// entrega. Es un supuesto y siempre se dice que lo es: la app no sabe si el
// del diésel llega el mismo día o el fertilizante tarda tres semanas.
export const DIAS_DE_ENTREGA_SUPUESTOS = 7;

// Hasta dónde mira la lista de "lo que va a faltar". Un mes es lo que se
// alcanza a resolver con una vuelta a Aguascalientes.
export const HORIZONTE_DIAS = 30;

// Las dos formas en que puede venir una lista de movimientos. Ver la caja de
// arriba: esto no se adivina, se dice.
export const SIGNO_BODEGA = "bodega";
export const SIGNO_PURAS_SALIDAS = "puras salidas";

/* ════════════ 1 · ¿A QUÉ RITMO SE ESTÁ GASTANDO? ════════════ */

// El ritmo sale de las SALIDAS REALES de bodega, no de lo que alguien planeó.
//
// Tres casos que se dicen distinto, a propósito:
//   · ninguna salida  → no hay de dónde sacarlo. No es cero: es que no se sabe.
//   · una sola salida → tampoco hay ritmo. Un dato no es una tendencia.
//   · salidas dispares→ se da el promedio, DICIENDO que es irregular y cuánto.
//
// Los ajustes de inventario (mermas, diferencias de conteo) NO cuentan como
// consumo. Un "−30 por diferencia de conteo" no es producto que se aplicó: es
// una corrección. Contarlo doblaría el ritmo y saldría una fecha de "se acaba
// el jueves" que no llega — y las alarmas falsas enseñan a ignorar las alarmas.
//
// Y las COMPRAS tampoco. Una entrada de 1,000 litros no es consumo: es lo
// contrario. Contarla como salida haría que surtir el tanque adelantara la
// fecha en que se acaba el tanque, que es el absurdo más caro de todos.
export function ritmoDeConsumo({
  salidas, insumoId, hoy,
  ventanaDias = VENTANA_DIAS,
  comoVieneElSigno = SIGNO_BODEGA,
}) {
  const dia = hoy || fechaLocal();
  const ventana = Math.abs(num(ventanaDias) ?? VENTANA_DIAS);
  const desdeVentana = sumarDias(dia, -ventana);
  const purasSalidas = comoVieneElSigno === SIGNO_PURAS_SALIDAS;

  const vacio = {
    sabe: false, porDia: null, total: null, dias: null, cuantas: 0,
    desde: null, hasta: null, irregular: null, queTanIrregular: null,
    tramoCorto: null, menor: null, mayor: null,
    renglones: { salidas: 0, entradas: 0, ajustes: 0, sinCantidad: 0, sinFecha: 0, enCero: 0, futuras: 0 },
    descartadas: 0, hayCapturasIncompletas: false,
  };

  // Sin saber de QUÉ insumo se pregunta, la respuesta no es el ritmo de la
  // bodega entera: es que no se sabe. Sumar litros de diésel con bultos de
  // urea y kilos de cal da un número, y ese número le pondría fecha de
  // "se acaba" a un producto del que no ha salido ni un gramo.
  if (insumoId === undefined || insumoId === null || insumoId === "") {
    return {
      ...vacio,
      porque: "No se dijo de qué insumo sacar el ritmo. No se contesta con las salidas de toda la bodega: eso mezclaría litros de diésel con bultos de urea, y de esa suma no sale un ritmo, sale un número.",
    };
  }

  // Una salida cancelada no se gastó: vivos() la deja fuera de la suma, igual
  // que en todo el resto del sistema.
  const mios = vivos(salidas || []).filter(s => s && s.insumoId === insumoId);

  const cuenta = { salidas: 0, entradas: 0, ajustes: 0, sinCantidad: 0, sinFecha: 0, enCero: 0, futuras: 0 };
  const consumo = [];

  for (const s of mios) {
    // Un conteo y un ajuste no son consumo: son correcciones del padrón de la
    // bodega. Se cuentan aparte para poder decir que existen.
    if (s.esAjuste || s.esConteo) { cuenta.ajustes++; continue; }

    const q = num(s.cantidad);
    // Un vale capturado sin cantidad NO es un vale de cero. Es una captura a
    // medias, y callarla deja el resto cuadrando perfecto — que es justo la
    // trampa: el número que queda se ve impecable porque lo malo se cayó solo.
    if (q === null) { cuenta.sinCantidad++; continue; }
    if (!s.fecha) { cuenta.sinFecha++; continue; }
    if (q === 0) { cuenta.enCero++; continue; }

    if (!purasSalidas && q > 0) { cuenta.entradas++; continue; }

    cuenta.salidas++;
    consumo.push({ fecha: String(s.fecha).slice(0, 10), cantidad: Math.abs(q) });
  }

  consumo.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  // Una salida con fecha posterior a hoy es casi siempre un dedazo. No se
  // borra en silencio —un renglón que se cae callado es lo que hace que un
  // archivo malo parezca bueno—: se deja fuera del cálculo y se dice.
  cuenta.futuras = consumo.filter(s => s.fecha > dia).length;

  const descartadas = cuenta.sinCantidad + cuenta.sinFecha + cuenta.futuras;
  const hayCapturasIncompletas = descartadas > 0;

  const avisos = [];
  if (cuenta.sinCantidad) avisos.push(`${cuenta.sinCantidad} renglón(es) de bodega de este insumo no traen cantidad capturada y no se pudieron contar: no son cero, son capturas a medias.`);
  if (cuenta.sinFecha) avisos.push(`${cuenta.sinFecha} renglón(es) no traen fecha, así que no se sabe en qué tramo caen y quedaron fuera.`);
  if (cuenta.futuras) avisos.push(`${cuenta.futuras} salida(s) traen fecha posterior a hoy y quedaron fuera del cálculo: revisa esas capturas.`);
  const notaAvisos = avisos.length ? ` ${avisos.join(" ")}` : "";

  const base = { ...vacio, renglones: cuenta, descartadas, hayCapturasIncompletas };

  if (consumo.length === 0) {
    // Que haya compras y ningún vale se dice con todas sus letras: es la
    // diferencia entre "no se gasta" y "nadie está capturando los vales".
    const notaEntradas = cuenta.entradas
      ? ` Sí hay ${cuenta.entradas} entrada(s) de compra capturada(s), pero una compra no es consumo: entra producto, no sale.`
      : "";
    const notaAjustes = cuenta.ajustes
      ? ` Hay ${cuenta.ajustes} conteo(s) o ajuste(s), que tampoco son consumo: son correcciones del padrón.`
      : "";
    return {
      ...base,
      porque: `Nunca ha salido de bodega, así que no hay de dónde sacar el ritmo. No quiere decir que no se gaste: quiere decir que no se ha capturado ninguna salida.${notaEntradas}${notaAjustes}${notaAvisos}`,
    };
  }

  const ultima = consumo[consumo.length - 1].fecha;
  const dentro = consumo.filter(s => s.fecha >= desdeVentana && s.fecha <= dia);

  if (dentro.length === 0) {
    const d = diasEntre(ultima, dia);
    return {
      ...base, hasta: ultima, cuantas: 0,
      porque: `No ha salido nada de bodega en los últimos ${ventana} días. La última salida fue el ${ultima}, hace ${d} día(s). Con lo de antes no se puede decir a qué ritmo se está gastando HOY.${notaAvisos}`,
    };
  }

  if (dentro.length === 1) {
    return {
      ...base, cuantas: 1, desde: dentro[0].fecha, hasta: dentro[0].fecha,
      porque: `Sólo hay una salida en los últimos ${ventana} días (${dentro[0].fecha}, ${cant(dentro[0].cantidad)}). Con una sola salida no hay ritmo; con la siguiente ya se sabe.${notaAvisos}`,
    };
  }

  const total = dentro.reduce((s, x) => s + x.cantidad, 0);
  const desde = dentro[0].fecha;
  const hasta = dentro[dentro.length - 1].fecha;
  // Del día de la primera salida a hoy: en ese tramo salió ese total. Se mide
  // contra HOY y no contra la última salida a propósito — si lleva tres
  // semanas sin moverse, el ritmo real de estas semanas es más bajo, y
  // dividir entre el tramo corto lo inflaría y adelantaría la fecha.
  const dias = Math.max(1, diasEntre(desde, dia) || 0);
  const porDia = total / dias;

  // Qué tan parejas son las salidas: la desviación estándar contra el
  // promedio. Sirve para saber si el promedio quiere decir algo o si es el
  // promedio de un tambo y una garrafa.
  const prom = total / dentro.length;
  const varianza = dentro.reduce((s, x) => s + Math.pow(x.cantidad - prom, 2), 0) / dentro.length;
  const dispersion = prom > 0 ? Math.sqrt(varianza) / prom : 0;
  const irregular = dispersion > IRREGULAR_DESDE;
  const menor = Math.min(...dentro.map(x => x.cantidad));
  const mayor = Math.max(...dentro.map(x => x.cantidad));
  const tramoCorto = dias < TRAMO_CORTO_DIAS;

  return {
    sabe: true,
    porDia: red(porDia, 4),
    total: red(total, 3),
    dias, cuantas: dentro.length, desde, hasta,
    irregular,
    queTanIrregular: red(dispersion, 2),
    menor, mayor, tramoCorto,
    renglones: cuenta, descartadas, hayCapturasIncompletas,
    porque:
      `Salieron ${cant(total)} en ${dias} día(s) (${dentro.length} salidas, de ${desde} a ${hasta}): ${cant(porDia)} al día.` +
      (irregular
        ? ` Ojo: las salidas no son parejas —van de ${cant(menor)} a ${cant(mayor)}—, así que esto es un promedio de cosas distintas y la fecha que salga de aquí puede moverse.`
        : "") +
      (tramoCorto
        ? ` Y es un tramo de ${dias} día(s), muy corto para llamarle ritmo: tómalo como primera idea, no como dato.`
        : "") +
      notaAvisos,
  };
}

// El ritmo de UN insumo del catálogo. Existe aparte porque un insumo sin
// clave no se puede seguir: sus salidas no se pueden identificar, y heredarle
// el ritmo de la bodega entera le pondría fecha de "se acaba" a un producto
// del que no ha salido nada. Se dice, con el nombre por delante.
function ritmoDelInsumo({ insumo, salidas, hoy, ventanaDias, comoVieneElSigno }) {
  if (!insumo?.id) {
    const nombre = insumo?.nombre || "este insumo";
    return {
      sabe: false, porDia: null, total: null, dias: null, cuantas: 0,
      desde: null, hasta: null, irregular: null, queTanIrregular: null,
      tramoCorto: null, menor: null, mayor: null,
      renglones: null, descartadas: 0, hayCapturasIncompletas: false,
      porque: `${nombre} no trae clave en el catálogo de la bodega, así que no se pueden identificar sus salidas y no se sabe a qué ritmo se gasta. No es que no se gaste: es que no hay cómo seguirlo. Con darle su clave se resuelve.`,
    };
  }
  return ritmoDeConsumo({ salidas, insumoId: insumo.id, hoy, ventanaDias, comoVieneElSigno });
}

/* ════════════ 2 · ¿QUÉ DÍA SE ACABA? ════════════ */

// Con lo que hay y el ritmo, el día. Sin ritmo no hay fecha — y no hay fecha
// quiere decir null, no "el año que entra".
//
// Acepta el ritmo como objeto (lo que devuelve ritmoDeConsumo) o como número
// suelto, para el que ya lo trae calculado de otro lado.
export function cuandoSeAcaba({ insumo, ritmo, hoy }) {
  const dia = hoy || fechaLocal();
  const porDia = typeof ritmo === "number" ? num(ritmo) : num(ritmo?.porDia);
  const hay = num(insumo?.existencia);
  const nombre = insumo?.nombre || "este insumo";
  const unidad = insumo?.unidad ? ` ${insumo.unidad}` : "";

  const sinRitmo = porDia === null || porDia <= 0;
  const razonSinRitmo = (typeof ritmo === "object" && ritmo?.porque)
    ? minuscula(ritmo.porque)
    : (porDia !== null && porDia <= 0)
      ? "no se está gastando (ritmo cero)."
      : "no hay ritmo de consumo capturado.";

  if (hay === null) {
    return {
      sabe: false, dias: null, fecha: null, existencia: null, porDia,
      porque: `De ${nombre} no se sabe cuánto hay en bodega, así que no se puede decir cuándo se acaba. Un conteo lo resuelve.`,
    };
  }

  if (hay <= 0) {
    const enCero = hay === 0
      ? `${nombre} ya está en cero en el sistema.`
      : `${nombre} está en ${cant(hay)}${unidad}, en negativo. Eso no es que deba: es que o entró mercancía que nadie capturó, o salió más de lo anotado. Antes de pedir, cuéntalo.`;

    // Estar en cero es un HECHO; que HAGA FALTA es otra pregunta, y ésa
    // depende de si el insumo se está gastando. Un fungicida descontinuado
    // lleva dos años en cero y no es una alarma: es un renglón viejo del
    // catálogo. Si esto contestara "sabe: true" sin mirar el ritmo, un
    // catálogo con veinte productos muertos en cero abriría la lista con
    // veinte alarmas de "ya va tarde" — y las alarmas falsas enseñan a
    // ignorar las alarmas.
    if (sinRitmo) {
      return {
        sabe: false, dias: null, fecha: null, existencia: hay, porDia, yaSeAcabo: true,
        porque: `${enCero} Pero no se sabe si hace falta reponerlo: ${razonSinRitmo}`,
      };
    }
    return {
      sabe: true, dias: 0, fecha: dia, existencia: hay, porDia, yaSeAcabo: true,
      porque: enCero,
    };
  }

  if (porDia === null) {
    return {
      sabe: false, dias: null, fecha: null, existencia: hay, porDia: null,
      porque: `Hay ${cant(hay)}${unidad} de ${nombre}, pero no se sabe cuándo se acaba: ${razonSinRitmo}`,
    };
  }
  if (porDia <= 0) {
    return {
      sabe: false, dias: null, fecha: null, existencia: hay, porDia,
      porque: `${nombre} no se está gastando (ritmo cero), así que no hay fecha en que se acabe.`,
    };
  }

  // Se redondea HACIA ABAJO: si alcanza para 6.8 días, alcanza para 6. Medio
  // día de más en esta cuenta es media cuadrilla parada.
  const dias = Math.floor(hay / porDia);
  return {
    sabe: true, dias, fecha: sumarDias(dia, dias), existencia: hay, porDia,
    yaSeAcabo: false,
    porque: `Hay ${cant(hay)}${unidad} y se van ${cant(porDia)} al día: alcanza para ${dias} día(s) más, o sea hasta el ${sumarDias(dia, dias)}.`,
  };
}

/* ════════════ 3 · ¿CUÁNTO CUESTA REPONERLO? ════════════ */

// Se apoya en costoDeSalida (almacen.js), que ya carga el COSTO PROMEDIO
// ponderado y ya sabe decir "no hay costo" en vez de poner cero. Aquí no se
// vuelve a hacer esa cuenta: se llama y se le cambia el sombrero de "lo que
// salió" a "lo que hay que reponer".
//
// Es lo que COSTÓ, no una cotización. Sirve para saber de qué tamaño es el
// pendiente —¿son mil pesos o son cuarenta mil?—, no para hacer la orden.
export function cuestaReponer({ insumo, cantidad }) {
  const q = num(cantidad);
  const nombre = insumo?.nombre || "este insumo";
  const unidad = insumo?.unidad ? ` ${insumo.unidad}` : "";

  if (q === null || q <= 0) {
    return {
      sabe: false, cantidad: q, costoUnit: num(insumo?.costo_unit), costoTotal: null,
      porque: "No se dijo cuánto hay que reponer.",
    };
  }

  const c = costoDeSalida({ insumo, cantidad: q });
  if (!c.completo) {
    return {
      sabe: false, cantidad: q, costoUnit: null, costoTotal: null,
      // Cero pesos sería mentira y encima una mentira cómoda: no dolería en el
      // total y nadie preguntaría. Va en null y se dice.
      porque: `Hacen falta ${cant(q)}${unidad} de ${nombre}, pero no hay costo registrado, así que no se puede decir cuánto cuesta reponerlo. No es que sea gratis: es que no se sabe.`,
    };
  }
  return {
    sabe: true, cantidad: q, costoUnit: c.costoUnit, costoTotal: c.costoTotal,
    porque: `${cant(q)}${unidad} de ${nombre} × ${fmt(c.costoUnit)} = ${fmt(c.costoTotal)}, al costo promedio de la bodega. Es lo que costó, no lo que el proveedor vaya a cobrar.`,
  };
}

/* ════════════ 4 · ¿CUÁNDO HAY QUE PEDIRLO? — LA CLAVE ════════════ */

// La fecha que sirve no es la de acabarse: es la de PEDIRLO. El proveedor
// tarda, y avisar el día que se vació el tambo es avisar tarde.
//
//     fecha de pedir = fecha en que se acaba − días de entrega
//
// Los días de entrega vienen del insumo. Si no los trae, se usa un supuesto y
// se DICE que es un supuesto, con el número a la vista: un supuesto callado es
// exactamente cómo una app empieza a mentir sin que nadie se dé cuenta.
export function aTiempoDePedir({ insumo, ritmo, hoy, diasDeEntrega }) {
  const dia = hoy || fechaLocal();
  const nombre = insumo?.nombre || "este insumo";

  const delInsumo = num(insumo?.diasDeEntrega ?? insumo?.dias_entrega);
  const delParametro = num(diasDeEntrega);
  const entrega = delInsumo ?? delParametro ?? DIAS_DE_ENTREGA_SUPUESTOS;
  const entregaSupuesta = delInsumo === null;
  const notaEntrega = entregaSupuesta
    ? `De ${nombre} no se capturaron los días de entrega del proveedor: se están suponiendo ${entrega}. Captúralos y esta fecha deja de ser un supuesto.`
    : null;

  const acaba = cuandoSeAcaba({ insumo, ritmo, hoy: dia });

  if (!acaba.sabe) {
    return {
      sabe: false, bloquea: false,
      fechaSeAcaba: null, fechaDePedir: null, diasParaPedir: null, yaEsTarde: null,
      diasDeEntrega: entrega, entregaSupuesta,
      dice: `No se puede decir cuándo hay que pedir ${nombre}: ${acaba.porque}` + (notaEntrega ? ` ${notaEntrega}` : ""),
    };
  }

  const fechaDePedir = sumarDias(acaba.fecha, -entrega);
  const diasParaPedir = diasEntre(dia, fechaDePedir);
  const yaEsTarde = diasParaPedir < 0;

  return {
    sabe: true,
    // Avisa. No detiene la salida, no cierra el vale, no impide nada.
    bloquea: false,
    fechaSeAcaba: acaba.fecha,
    diasParaAcabarse: acaba.dias,
    fechaDePedir, diasParaPedir, yaEsTarde,
    diasDeEntrega: entrega, entregaSupuesta,
    dice: (yaEsTarde
      ? `YA se pasó la fecha de pedir ${nombre}: había que pedirlo el ${fechaDePedir} y hoy es ${dia}, ${-diasParaPedir} día(s) después. Se acaba el ${acaba.fecha} y el proveedor tarda ${entrega} día(s), así que si se pide hoy va a haber ${-diasParaPedir} día(s) sin producto.`
      : diasParaPedir === 0
        ? `Hoy es el día de pedir ${nombre}: se acaba el ${acaba.fecha} y el proveedor tarda ${entrega} día(s).`
        : `Hay que pedir ${nombre} antes del ${fechaDePedir} (faltan ${diasParaPedir} día(s)). Se acaba el ${acaba.fecha} y el proveedor tarda ${entrega} día(s).`)
      + (notaEntrega ? ` ${notaEntrega}` : ""),
  };
}

/* ════════════ 5 · LO QUE VA A FALTAR ════════════ */

export const ESTADOS = ["ya va tarde", "se va a acabar", "no se sabe", "aguanta"];

// La letra chica del ritmo, para pegarla al renglón que se ve.
//
// Antes esta advertencia vivía sólo dentro de ritmo.porque, que es donde
// NADIE la lee: la fila de la lista armaba su frase con la fecha de pedir y
// nada más. Así, "se van 200 al día" salía igual de firme viniendo de un
// tramo de un día que de noventa — y abajo el resumen remataba con un total
// en pesos. La advertencia tiene que ir donde se levanta la alarma.
function letraChicaDelRitmo(ritmo) {
  const marcas = [];
  if (ritmo?.tramoCorto) marcas.push(`ese ritmo salió de un tramo de ${ritmo.dias} día(s), muy corto para llamarle ritmo`);
  if (ritmo?.irregular) marcas.push(`las salidas no son parejas —van de ${cant(ritmo.menor)} a ${cant(ritmo.mayor)}—, así que es un promedio de cosas distintas`);
  if (ritmo?.hayCapturasIncompletas) marcas.push(`hay ${ritmo.descartadas} renglón(es) de bodega que no se pudieron contar (sin cantidad, sin fecha o con fecha del futuro)`);
  if (marcas.length === 0) return "";
  return ` Ojo: ${marcas.join("; ")}. La fecha puede moverse.`;
}

// La lista completa, ordenada por urgencia: primero lo que ya se pasó de la
// fecha de pedir, luego lo que se acaba dentro del horizonte, y hasta abajo lo
// que aguanta. Lo que NO SE SABE va en su propia lista, nunca revuelto con
// "aguanta": no saber si algo se va a acabar no es que aguante.
export function loQueVaAFaltar({
  inventario, salidas, hoy,
  horizonteDias = HORIZONTE_DIAS,
  ventanaDias = VENTANA_DIAS,
  diasDeEntrega,
  comoVieneElSigno = SIGNO_BODEGA,
}) {
  const dia = hoy || fechaLocal();
  const horizonte = num(horizonteDias) ?? HORIZONTE_DIAS;

  const filas = (inventario || []).map(insumo => {
    const ritmo = ritmoDelInsumo({ insumo, salidas, hoy: dia, ventanaDias, comoVieneElSigno });
    const acaba = cuandoSeAcaba({ insumo, ritmo, hoy: dia });
    const pedir = aTiempoDePedir({ insumo, ritmo, hoy: dia, diasDeEntrega });

    // Cuánto hay que reponer para aguantar el horizonte que se pidió. No es
    // "cuánto comprar" —eso lo decide quien compra, con su bulto y su
    // camioneta—: es de qué tamaño está el hueco.
    let falta = null, costo = null;
    if (ritmo.sabe && acaba.sabe && acaba.existencia !== null) {
      const paraElHorizonte = ritmo.porDia * horizonte;
      const hueco = red(paraElHorizonte - acaba.existencia, 2);
      if (hueco > 0) {
        falta = hueco;
        costo = cuestaReponer({ insumo, cantidad: hueco });
      }
    }

    const estado = !acaba.sabe
      ? "no se sabe"
      : pedir.sabe && pedir.yaEsTarde
        ? "ya va tarde"
        : acaba.dias <= horizonte
          ? "se va a acabar"
          : "aguanta";

    const nombre = insumo?.nombre || "Este insumo";
    const letraChica = letraChicaDelRitmo(ritmo);

    return {
      insumoId: insumo?.id ?? null,
      nombre: insumo?.nombre || "(sin nombre)",
      unidad: insumo?.unidad || null,
      existencia: num(insumo?.existencia),
      estado,
      ritmo, acaba, pedir,
      ritmoMarcado: !!(ritmo.tramoCorto || ritmo.irregular || ritmo.hayCapturasIncompletas),
      diasQueAguanta: acaba.sabe ? acaba.dias : null,
      faltaParaElHorizonte: falta,
      costoDeReponer: costo?.sabe ? costo.costoTotal : null,
      costoDesconocido: !!(falta !== null && costo && !costo.sabe),
      // Los dos estados que levantan alarma llevan pegado el POR QUÉ completo:
      // cuánto hay, a qué ritmo, cuándo se acaba, cuándo pedir y la letra
      // chica del ritmo. Antes "ya va tarde" armaba su frase sólo con la
      // fecha de pedir, y así se perdían dos cosas que importan: el
      // "cuéntalo antes de pedir" de un saldo en negativo, y el aviso de que
      // el ritmo salió de dos días.
      dice: estado === "no se sabe"
        ? acaba.porque
        : estado === "aguanta"
          ? `${nombre}: aguanta ${acaba.dias} día(s), más allá de los ${horizonte} que se están mirando.${letraChica}`
          : `${nombre}: ${acaba.porque} ${pedir.dice}${letraChica}`,
    };
  });

  const orden = { "ya va tarde": 0, "se va a acabar": 1, "no se sabe": 2, "aguanta": 3 };
  const ordenadas = [...filas].sort((a, b) => {
    if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
    const da = a.diasQueAguanta ?? Infinity, db = b.diasQueAguanta ?? Infinity;
    return da - db;
  });

  const yaVanTarde = ordenadas.filter(f => f.estado === "ya va tarde");
  const seVanAAcabar = ordenadas.filter(f => f.estado === "se va a acabar");
  const noSeSabe = ordenadas.filter(f => f.estado === "no se sabe");
  const aguantan = ordenadas.filter(f => f.estado === "aguanta");

  // El total suma SÓLO lo que tiene costo conocido, y aparte se dice de
  // cuántos no se sabe. Un total que se traga los desconocidos como ceros se
  // ve más chico de lo que es, y así se aprueba un presupuesto que no alcanza.
  const conCosto = ordenadas.filter(f => f.costoDeReponer !== null);
  const sinCosto = ordenadas.filter(f => f.costoDesconocido);
  const costoTotal = sumarDinero(conCosto.map(f => f.costoDeReponer));

  // Y de cuáles de las alarmas el ritmo viene marcado. Va en el resumen
  // porque el resumen es donde se ve el total en pesos, y un total armado
  // sobre ritmos flacos no puede presentarse como si fuera firme.
  const conRitmoMarcado = ordenadas.filter(f => f.ritmoMarcado && (f.estado === "ya va tarde" || f.estado === "se va a acabar"));

  const partes = [];
  if (yaVanTarde.length) partes.push(`${yaVanTarde.length} insumo(s) YA se pasaron de la fecha de pedirlos: ${yaVanTarde.map(f => f.nombre).join(", ")}.`);
  if (seVanAAcabar.length) partes.push(`${seVanAAcabar.length} más se acaban dentro de ${horizonte} días: ${seVanAAcabar.map(f => `${f.nombre} (${f.diasQueAguanta} día(s))`).join(", ")}.`);
  if (conCosto.length) partes.push(`Reponer lo que falta anda por ${fmt(costoTotal)}, al costo promedio de la bodega.`);
  // Si NO hay ni un costo conocido no se habla de "ese total": no hay total
  // del cual hablar, y mandar a buscar un número que no está sólo confunde.
  if (sinCosto.length) partes.push(
    conCosto.length
      ? `De ${sinCosto.length} insumo(s) no hay costo registrado, así que ese total va incompleto: ${sinCosto.map(f => f.nombre).join(", ")}.`
      : `No hay costo registrado de ${sinCosto.map(f => f.nombre).join(", ")}, así que no se puede decir cuánto costaría reponerlo. No es que sea gratis: es que no se sabe.`
  );
  if (conRitmoMarcado.length) partes.push(`De ${conRitmoMarcado.length} de estas alarmas el ritmo viene marcado —tramo corto, salidas dispares o renglones que no se pudieron contar—: ${conRitmoMarcado.map(f => f.nombre).join(", ")}. Las fechas se pueden mover.`);
  if (noSeSabe.length) partes.push(`De ${noSeSabe.length} insumo(s) NO se sabe si se van a acabar (falta existencia o falta ritmo). No saber no es que aguanten.`);
  // Con la bodega VACIA, "nada se acaba" es cierto y enganoso al mismo tiempo:
  // se lee como "todo esta bien" cuando lo que pasa es que no hay ni un insumo
  // capturado. Es la misma falta que decir "ALCANZA" con cero bolsas.
  if (partes.length === 0) {
    partes.push(ordenadas.length === 0
      ? `No hay ni un insumo en el catálogo de la bodega, así que no se puede decir qué se va a acabar. No es que no falte nada: es que no hay nada capturado.`
      : `Con lo que hay y el ritmo de las últimas semanas, nada se acaba en los próximos ${horizonte} días.`);
  }

  return {
    filas: ordenadas,
    yaVanTarde, seVanAAcabar, noSeSabe, aguantan,
    costoTotal, sinCosto, conRitmoMarcado,
    horizonteDias: horizonte,
    // Avisa. Nadie deja de sacar producto por esta lista.
    bloquea: false,
    dice: partes.join(" "),
  };
}

/* ════════════ 6 · ¿SE VA A PARAR LA OPERACIÓN? ════════════ */

// La pregunta de Luis, textual: "antes de parar una operación por esa
// situación". Se le dice qué se planea hacer —una siembra, una aplicación, un
// riego, con lo que lleva cada cosa— y contesta qué insumo se acaba antes de
// terminarla, y en qué día de la faena.
//
// El plan se ve así:
//   { nombre: "Siembra parcela 53", fecha: "2026-09-15", dias: 4,
//     necesita: [{ insumoId: "i1", cantidad: 800 }, { nombre: "Diésel", cantidad: 600 }] }
//
// Tres cosas que se cuentan y casi nadie cuenta a mano:
//   · Lo que se va a gastar el día a día ENTRE hoy y el día de la faena. El
//     tambo que hoy está lleno no va a estar lleno el martes.
//   · Que la faena dura varios días: no basta con que alcance el primer día.
//   · Que el mismo insumo puede venir en VARIOS renglones del plan —dos
//     parcelas, dos labores, o capturado una vez por clave y otra por
//     nombre—. La bodega es una sola: los renglones se juntan antes de
//     comparar. Si cada uno mirara la bodega llena, se ocuparían 400 kg,
//     habría 300, y la app contestaría que no se para.
export function pararaLaOperacion({
  plan, inventario, salidas, hoy,
  ventanaDias = VENTANA_DIAS,
  comoVieneElSigno = SIGNO_BODEGA,
}) {
  const dia = hoy || fechaLocal();
  const fechaPlan = plan?.fecha || dia;
  const diasPlan = Math.max(1, num(plan?.dias) ?? 1);
  const hastaQueEmpieza = Math.max(0, diasEntre(dia, fechaPlan) ?? 0);

  const porId = new Map();
  const porNombre = new Map();
  for (const i of inventario || []) {
    if (i?.id) porId.set(i.id, i);
    if (i?.nombre) porNombre.set(normalizar(i.nombre), i);
  }

  // Primero se resuelve cada renglón contra el catálogo, y después se juntan
  // los que apuntan al mismo insumo. La clave de agrupación es el insumo del
  // catálogo cuando se pudo resolver; si no, el nombre tal como se escribió;
  // y si tampoco hay nombre, el renglón se queda solo (no se junta a ciegas).
  const crudos = (plan?.necesita || []).map((p, i) => {
    const insumo = (p?.insumoId && porId.get(p.insumoId)) || (p?.nombre && porNombre.get(normalizar(p.nombre))) || null;
    return {
      insumo,
      etiqueta: insumo?.nombre || p?.nombre || "(sin nombre)",
      cantidad: num(p?.cantidad),
      clave: insumo?.id ? `id:${insumo.id}` : (p?.nombre ? `nombre:${normalizar(p.nombre)}` : `renglon:${i}`),
    };
  });

  const grupos = new Map();
  for (const c of crudos) {
    if (!grupos.has(c.clave)) grupos.set(c.clave, []);
    grupos.get(c.clave).push(c);
  }

  const filas = [...grupos.values()].map(grupo => {
    const insumo = grupo.find(g => g.insumo)?.insumo || null;
    const etiqueta = insumo?.nombre || grupo[0].etiqueta;
    const unidad = insumo?.unidad ? ` ${insumo.unidad}` : "";
    const renglonesDelPlan = grupo.length;
    const sinCantidad = grupo.filter(g => g.cantidad === null || g.cantidad <= 0).length;
    const pedido = grupo.reduce((s, g) => s + (g.cantidad ?? 0), 0);
    const notaJuntos = renglonesDelPlan > 1
      ? ` (Se ocupa en ${renglonesDelPlan} renglones del plan: ${grupo.map(g => (g.cantidad === null ? "sin cantidad" : cant(g.cantidad))).join(" + ")} = ${cant(pedido)}${unidad}. La bodega es una sola.)`
      : "";

    const comun = {
      nombre: etiqueta, insumoId: insumo?.id ?? null,
      renglonesDelPlan, pedido: sinCantidad ? null : red(pedido, 3),
    };

    if (sinCantidad > 0) {
      return {
        ...comun, alcanza: null,
        dice: sinCantidad === renglonesDelPlan
          ? `De "${etiqueta}" no se dijo cuánto se va a ocupar, así que no se puede saber si alcanza.`
          : `De "${etiqueta}" hay ${renglonesDelPlan} renglones en el plan y ${sinCantidad} no dice(n) cuánto, así que el total que se va a ocupar queda incompleto y no se puede saber si alcanza.`,
      };
    }
    // Que no esté en el catálogo NO quiere decir que no haya. Quiere decir que
    // no se sabe, y decir "falta" sobre eso es afirmar sobre lo que nadie miró.
    if (!insumo) {
      return {
        ...comun, alcanza: null,
        dice: `"${etiqueta}" no está en el catálogo de la bodega, así que no se sabe si hay. No quiere decir que no haya.${notaJuntos}`,
      };
    }
    const hay = num(insumo.existencia);
    if (hay === null) {
      return {
        ...comun, existencia: null, alcanza: null,
        dice: `De ${etiqueta} no se sabe cuánto hay en bodega. Un conteo lo resuelve; mientras, no se puede decir si alcanza.${notaJuntos}`,
      };
    }

    // Lo que el día a día se va a comer antes de que empiece la faena.
    const ritmo = ritmoDelInsumo({ insumo, salidas, hoy: dia, ventanaDias, comoVieneElSigno });
    const gastoAntes = (ritmo.sabe && hastaQueEmpieza > 0) ? red(ritmo.porDia * hastaQueEmpieza, 2) : null;
    // Si la faena es en veinte días y de este insumo no hay ritmo, la
    // existencia de HOY no es la de ese día: es la de hoy. Antes esto se
    // resolvía dejando `disponible = hay` y contestando "Alcanza" sin decir
    // que no se descontó nada — el mismo "alcanza con cero datos" que el
    // resto del archivo se cuida de no dar.
    const noSePudoProyectar = hastaQueEmpieza > 0 && gastoAntes === null;
    const disponible = noSePudoProyectar ? null : (gastoAntes === null ? hay : red(hay - gastoAntes, 2));
    const paraLaCuenta = disponible === null ? hay : disponible;

    const porDiaDeFaena = pedido / diasPlan;
    const diasQueAguanta = porDiaDeFaena > 0 ? Math.floor(Math.max(0, paraLaCuenta) / porDiaDeFaena) : diasPlan;

    // Tres respuestas, no dos. Si no se pudo proyectar y con lo de hoy
    // alcanzaría, la respuesta honesta es "no se sabe": lo que quede ese día
    // depende de un gasto que nadie ha capturado.
    const alcanza = noSePudoProyectar
      ? (hay < pedido ? false : null)
      : disponible >= pedido;

    if (alcanza === null) {
      return {
        ...comun, unidad: insumo.unidad || null, existencia: hay, alcanza: null,
        gastoAntesDeEmpezar: null, disponibleEseDia: null,
        falta: null, costoDeReponer: null, costoDesconocido: false,
        diasQueAguantaLaFaena: null, seParaEnElDia: null,
        dice: `${etiqueta}: hoy hay ${cant(hay)}${unidad} y se ocupan ${cant(pedido)}, así que HOY alcanzaría. Pero el trabajo es en ${hastaQueEmpieza} día(s) y de este insumo no hay ritmo capturado —${minuscula(ritmo.porque)}—, así que no se puede saber cuánto va a quedar ese día. No es que alcance: es que no se sabe.${notaJuntos}`,
      };
    }

    const falta = alcanza ? 0 : red(pedido - paraLaCuenta, 2);
    const costo = alcanza ? null : cuestaReponer({ insumo, cantidad: falta });
    const letraChica = letraChicaDelRitmo(ritmo);

    return {
      nombre: etiqueta, insumoId: insumo.id, unidad: insumo.unidad || null,
      renglonesDelPlan, pedido: red(pedido, 3), existencia: hay,
      // Se enseñan los dos números: el real de hoy y el proyectado al día de
      // la faena. El proyectado es una CUENTA, no una medición, y por eso va
      // aparte y con su nombre. Cuando no se pudo proyectar va en null, nunca
      // con la existencia de hoy disfrazada de proyección.
      gastoAntesDeEmpezar: gastoAntes,
      disponibleEseDia: disponible,
      alcanza, falta,
      costoDeReponer: costo?.sabe ? costo.costoTotal : null,
      costoDesconocido: !!(costo && !costo.sabe),
      diasQueAguantaLaFaena: diasQueAguanta,
      seParaEnElDia: alcanza ? null : Math.min(diasPlan, diasQueAguanta + 1),
      dice: alcanza
        ? `${etiqueta}: se ocupan ${cant(pedido)}${unidad} y para ese día habría ${cant(disponible)}. Alcanza.` +
          (gastoAntes !== null ? ` (Ya se descontaron ${cant(gastoAntes)} de lo que se gasta a diario en los ${hastaQueEmpieza} día(s) que faltan.)` : "") +
          letraChica + notaJuntos
        : `${etiqueta}: se ocupan ${cant(pedido)}${unidad} y para ese día habría ${cant(paraLaCuenta)}. Faltan ${cant(falta)}` +
          (costo?.sabe ? `, unos ${fmt(costo.costoTotal)}.` : ". No hay costo registrado, así que no se sabe cuánto costaría reponerlos.") +
          (diasPlan > 1 ? ` El trabajo es de ${diasPlan} día(s) y con esto alcanza para ${diasQueAguanta}: se pararía el día ${Math.min(diasPlan, diasQueAguanta + 1)}.` : "") +
          (gastoAntes !== null ? ` (Se descontaron ${cant(gastoAntes)} de lo que se gasta a diario en los ${hastaQueEmpieza} día(s) que faltan para empezar.)` : "") +
          (noSePudoProyectar ? ` Y ése es el faltante de HOY: de este insumo no hay ritmo capturado, así que no se pudo descontar lo que se gaste entre hoy y el ${fechaPlan}; ese día puede faltar más.` : "") +
          letraChica + notaJuntos,
    };
  });

  const faltantes = filas.filter(f => f.alcanza === false);
  const sinSaber = filas.filter(f => f.alcanza === null);
  const conCosto = faltantes.filter(f => f.costoDeReponer !== null);
  const sinCosto = faltantes.filter(f => f.costoDesconocido);
  const costoDeNoPararse = sumarDinero(conCosto.map(f => f.costoDeReponer));

  // El que se acaba primero: el que aguanta menos días de la faena.
  const elPrimeroQueSeAcaba = faltantes.length === 0 ? null :
    [...faltantes].sort((a, b) => (a.diasQueAguantaLaFaena ?? 0) - (b.diasQueAguantaLaFaena ?? 0))[0];

  // "para" tiene tres valores a propósito: sí, no, y NO SE SABE. Si hay algo
  // sin catalogar o sin existencia, la respuesta no es "no se para": es que no
  // se sabe. Decir que no se para sobre un dato que nadie miró es la forma
  // exacta en que una app pierde la confianza de todos.
  // Un plan que no dice QUE ocupa no se puede contestar con "no se para": no
  // hubo nada que comparar contra la bodega. Va como null —no se sabe— para
  // que el valor y la frase digan lo mismo; si no, una pantalla que decida por
  // el valor ensena "alcanza" mientras el texto dice "no se sabe".
  const para = crudos.length === 0 ? null
    : (faltantes.length > 0 ? true : (sinSaber.length > 0 ? null : false));

  const cabeza =
    // Si el plan no dice QUE se ocupa, no hay nada contra qué comparar la
    // bodega. Contestar "alcanza" ahí es afirmar sobre lo que nadie miró, y es
    // peor que no contestar: manda a arrancar la faena tranquilo.
    crudos.length === 0
      ? `No se sabe: no se dijo qué insumos ocupa este trabajo, así que no hay nada que comparar contra la bodega. Escribe qué se va a ocupar y con cuánto.`
      : para === true
        ? `Sí: ${elPrimeroQueSeAcaba.nombre} se acaba antes de terminar${diasPlan > 1 ? ` (se pararía el día ${elPrimeroQueSeAcaba.seParaEnElDia} de ${diasPlan})` : ""}.`
        : para === null
          ? `No se sabe: de ${sinSaber.length === 1 ? "una" : sinSaber.length} de las cosas que se ocupan no hay dato (${sinSaber.map(f => f.nombre).join(", ")}). Con lo demás sí alcanza, pero eso no contesta la pregunta.`
          : `No: con lo que hay en bodega alcanza para todo el trabajo.`;

  const cola = [
    faltantes.length > 1 ? `También faltan ${faltantes.slice(1).map(f => f.nombre).join(", ")}.` : null,
    conCosto.length ? `Reponer lo que falta anda por ${fmt(costoDeNoPararse)}, al costo promedio de la bodega.` : null,
    // Igual que arriba: sin ningún costo conocido no hay "ese total".
    sinCosto.length ? (conCosto.length
      ? `De ${sinCosto.map(f => f.nombre).join(", ")} no hay costo registrado, así que ese total va incompleto.`
      : `No hay costo registrado de ${sinCosto.map(f => f.nombre).join(", ")}, así que no se puede decir cuánto costaría reponerlo. No es que sea gratis: es que no se sabe.`) : null,
    para !== false && sinSaber.length && faltantes.length ? `Y de ${sinSaber.map(f => f.nombre).join(", ")} tampoco se sabe.` : null,
    // La faena se planea igual. Esto avisa a tiempo; no cancela nada.
    faltantes.length ? "El trabajo se puede programar igual: lo que importa es enterarse hoy y no con la cuadrilla ya en la parcela." : null,
  ].filter(Boolean);

  return {
    plan: plan?.nombre || null,
    fecha: fechaPlan, dias: diasPlan,
    para, filas, faltantes, sinSaber,
    elPrimeroQueSeAcaba,
    costoDeNoPararse, sinCosto,
    // Nunca. Aquí explícito para que nadie lo cambie sin darse cuenta.
    bloquea: false,
    dice: [cabeza, ...cola].join(" "),
  };
}
