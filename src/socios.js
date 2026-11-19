// ============================================================
//  AgroGestión — Varios RFC, una sola empresa
//
//  Luis, textual: «el sistema de agrogestion es un tanto diferente en el
//  sentido de que estaría trabajando con varios RFC pero en una sola empresa
//  sabes? osea toda la familia estamos metidos en el rancho y todos movemos
//  dinero del rancho entonces ocupo que todo eso se refleje»
//
//  Esto no es un detalle de configuración: es el eje del sistema.
//
//  Fiscalmente son personas distintas. Económicamente es UN SOLO NEGOCIO.
//  Hasta ahora la app no distinguía de qué bolsa salió cada peso, así que la
//  utilidad que enseñaba era la de un negocio imaginario donde todo el dinero
//  es del mismo dueño.
//
//  Lo que pasa de verdad en el rancho:
//   · Migue paga al proveedor de agroquímicos CON SU TARJETA PERSONAL. Es
//     gasto del rancho, y el rancho LE QUEDA DEBIENDO A MIGUE.
//   · Un cliente deposita en la cuenta de RODOLFO. Es ingreso del rancho,
//     aunque esté a nombre del papá.
//   · El estado de cuenta personal de cualquiera trae la despensa de su casa
//     junto al pago del rancho. Separar eso es el trabajo.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE ESTE ARCHIVO NO HACE
//  ─────────────────────────────────────────────────────────────
//  · NO decide solo qué movimiento es del rancho y cuál es personal. Propone
//    y una PERSONA confirma. Marcar como personal el pago de un proveedor
//    esconde un gasto real; marcar como del rancho la despensa de una casa
//    infla el costo y ensucia la cuenta entre hermanos. Las dos duelen.
//  · NO borra lo personal: lo marca y lo excluye, para que el estado de
//    cuenta siga cuadrando contra el banco.
//  · NO calcula impuestos. Saber a nombre de quién quedó una factura sí; el
//    ISR no. Esto es control interno.
//
//  Sus pruebas están en src/socios.test.js.
// ============================================================

import { aCentavos, sumarDinero, fmt } from "./calculos.js";

/* ════════════ TITULARES Y BOLSAS ════════════ */

// Un TITULAR es una persona o un RFC: Rodolfo, Migue, Fito, Luis, o la razón
// social. Una BOLSA es de dónde sale o entra el dinero: una cuenta de banco,
// una tarjeta, o un efectivo. Cada bolsa tiene UN dueño.
export const TIPOS_BOLSA = ["banco", "tarjeta", "efectivo"];

// El destino de un movimiento: del rancho, personal, o todavía sin decidir.
// "sin decidir" es un estado de primera clase, no un hueco: mientras nadie lo
// haya visto, no debe contar en la utilidad ni desaparecer de la vista.
export const DESTINOS = ["rancho", "personal", "sin decidir"];
export const destinoDe = (m) => (m && m.destino) || "sin decidir";

/* ════════════ EL DINERO QUE SÓLO CAMBIÓ DE BOLSA ════════════ */

// La venta entra al Bajío, la raya sale de Banorte, el efectivo vive en la
// caja del encargado. Un traspaso entre bolsas propias NO es ingreso de un
// lado ni gasto del otro: si se cuenta así, el año se infla por los dos lados.
export const esTraspaso = (m) => !!(m && m.traspasoCon);

// Y el puente que más importa: todo retiro de efectivo del banco tiene que
// aparecer como entrada en alguna caja, CON EL NOMBRE de quién lo recibió.
//
// NO supone quién lo recibió aunque sólo haya un encargado, ni une un par por
// su cuenta aunque cuadre perfecto: dos retiros del mismo importe el mismo
// día también cuadran perfecto.
export function retirosSinRecibir({ movimientosBanco, entradasCaja, toleranciaDias = 3 }) {
  const usadas = new Set();
  const sueltos = [];
  for (const r of movimientosBanco || []) {
    if (!r || !(r.cargo > 0)) continue;
    if (!/RETIRO|EFECTIVO|DISPOSICION|CAJERO/i.test(r.concepto || "")) continue;
    if (r.traspasoCon) continue;   // ya se emparejó a mano
    const candidatas = (entradasCaja || []).filter(c => {
      if (usadas.has(c.id)) return false;
      if (aCentavos(c.monto) !== aCentavos(r.cargo)) return false;
      if (!c.fecha || !r.fecha) return true;
      const d = Math.abs(Math.round((new Date(r.fecha + "T00:00:00") - new Date(c.fecha + "T00:00:00")) / 86400000));
      return d <= toleranciaDias;
    });
    if (candidatas.length === 1) {
      // Se PROPONE. No se une solo.
      sueltos.push({ retiro: r, propuesta: candidatas[0], estado: "hay una que cuadra" });
    } else if (candidatas.length > 1) {
      sueltos.push({ retiro: r, candidatas, estado: "hay varias que cuadran" });
    } else {
      sueltos.push({ retiro: r, estado: "ninguna caja lo recibió" });
    }
  }
  return {
    todos: sueltos,
    // Esto es lo primero que debe ver el dueño.
    sinRecibir: sueltos.filter(s => s.estado === "ninguna caja lo recibió"),
    monto: sumarDinero(sueltos.filter(s => s.estado === "ninguna caja lo recibió").map(s => s.retiro.cargo)),
  };
}

/* ════════════ UN SOLO LIBRO DEL RANCHO ════════════ */

// La utilidad del rancho es UNA SOLA, sin importar por dónde pasó el dinero.
// Se suman todas las bolsas, se excluye lo personal y se excluyen los
// traspasos (que no son ingreso ni gasto de nadie).
//
// Y se dice SOBRE QUÉ está calculada: cuánto quedó fuera por ser personal y
// cuánto sigue sin decidir. Un total sin eso es un total que se pinta de
// tranquilo sobre datos que nadie miró.
export function libroDelRancho({ ingresos, egresos }) {
  const clasificar = (lista) => {
    const rancho = [], personal = [], pendientes = [], traspasos = [];
    for (const m of lista || []) {
      if (esTraspaso(m)) { traspasos.push(m); continue; }
      const d = destinoDe(m);
      if (d === "rancho") rancho.push(m);
      else if (d === "personal") personal.push(m);
      else pendientes.push(m);
    }
    return { rancho, personal, pendientes, traspasos };
  };
  const i = clasificar(ingresos);
  const e = clasificar(egresos);
  const suma = (l) => sumarDinero(l.map(m => m.monto || 0));

  const ingresoRancho = suma(i.rancho);
  const egresoRancho = suma(e.rancho);
  const sinDecidir = [...i.pendientes, ...e.pendientes];

  return {
    ingresos: ingresoRancho,
    egresos: egresoRancho,
    utilidad: sumarDinero(ingresoRancho, -egresoRancho),
    excluidoPersonal: sumarDinero(suma(i.personal), suma(e.personal)),
    excluidoTraspasos: sumarDinero(suma(i.traspasos), suma(e.traspasos)),
    sinDecidir,
    montoSinDecidir: suma(sinDecidir),
    // El total NUNCA se enseña solo. Esta frase va pegada a él.
    sobreQue: sinDecidir.length === 0
      ? `Sobre todos los movimientos marcados. Quedaron fuera ${fmt(sumarDinero(suma(i.personal), suma(e.personal)))} de gastos personales.`
      : `OJO: hay ${sinDecidir.length} movimiento(s) por ${fmt(suma(sinDecidir))} que nadie ha marcado como del rancho o personal. Esta utilidad está calculada SIN ellos, así que puede cambiar.`,
    completo: sinDecidir.length === 0,
  };
}

/* ════════════ LA CUENTA CORRIENTE ENTRE SOCIOS ════════════ */

// Quién ha puesto, quién ha sacado, cuánto le debe el rancho a cada quien y
// al revés.
//
// **Ésta es la función que evita pleitos entre hermanos**, y es la que más va
// a agradecer la familia dentro de dos años.
//
// La regla: si un GASTO DEL RANCHO salió de una bolsa de Migue, el rancho le
// debe a Migue. Si un INGRESO DEL RANCHO entró a una bolsa de Rodolfo,
// Rodolfo tiene dinero del rancho en su bolsa.
export function cuentaCorriente({ ingresos, egresos, bolsas, titulares, aportaciones }) {
  const duenoDe = new Map((bolsas || []).map(b => [b.id, b.titularId]));
  const saldo = new Map((titulares || []).map(t => [t.id, {
    titularId: t.id, nombre: t.nombre,
    pusoDeSuBolsa: 0, recibioEnSuBolsa: 0, aporto: 0, retiro: 0,
    movimientos: 0, sinBolsa: 0,
  }]));
  const nadie = { titularId: null, nombre: "sin bolsa asignada", pusoDeSuBolsa: 0, recibioEnSuBolsa: 0, aporto: 0, retiro: 0, movimientos: 0, sinBolsa: 0 };

  const tocar = (bolsaId) => {
    const t = duenoDe.get(bolsaId);
    return (t && saldo.get(t)) || nadie;
  };

  for (const e of egresos || []) {
    if (esTraspaso(e) || destinoDe(e) !== "rancho") continue;
    const s = tocar(e.bolsaId);
    if (!e.bolsaId) s.sinBolsa = sumarDinero(s.sinBolsa, e.monto || 0);
    else s.pusoDeSuBolsa = sumarDinero(s.pusoDeSuBolsa, e.monto || 0);
    s.movimientos++;
  }
  for (const i of ingresos || []) {
    if (esTraspaso(i) || destinoDe(i) !== "rancho") continue;
    const s = tocar(i.bolsaId);
    if (!i.bolsaId) s.sinBolsa = sumarDinero(s.sinBolsa, i.monto || 0);
    else s.recibioEnSuBolsa = sumarDinero(s.recibioEnSuBolsa, i.monto || 0);
    s.movimientos++;
  }
  // Aportaciones y retiros que la persona hizo a propósito (meter o sacar
  // dinero del rancho), capturados aparte.
  for (const a of aportaciones || []) {
    const s = saldo.get(a.titularId);
    if (!s) continue;
    if (a.tipo === "aportacion") s.aporto = sumarDinero(s.aporto, a.monto || 0);
    else s.retiro = sumarDinero(s.retiro, a.monto || 0);
  }

  const filas = [...saldo.values()].map(s => {
    // A favor del socio: lo que puso de su bolsa + lo que aportó.
    // En contra: lo que recibió en su bolsa + lo que retiró.
    const aFavor = sumarDinero(s.pusoDeSuBolsa, s.aporto);
    const enContra = sumarDinero(s.recibioEnSuBolsa, s.retiro);
    const neto = sumarDinero(aFavor, -enContra);
    return {
      ...s, aFavor, enContra, neto,
      dice: neto > 0 ? `El rancho le debe ${fmt(neto)} a ${s.nombre}.`
        : neto < 0 ? `${s.nombre} tiene ${fmt(-neto)} del rancho en sus bolsas.`
        : `${s.nombre} está a mano con el rancho.`,
    };
  });

  const sinAsignar = nadie.sinBolsa;
  return {
    filas: filas.sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto)),
    sinAsignar,
    // La cuenta no cuadra si hay dinero del rancho que no se sabe de qué
    // bolsa salió. Se dice, no se reparte.
    completa: sinAsignar === 0,
    sobreQue: sinAsignar === 0
      ? "Sobre todos los movimientos del rancho, cada uno con su bolsa."
      : `OJO: hay ${fmt(sinAsignar)} de movimientos del rancho sin decir de qué bolsa salieron. Esa parte NO está repartida entre nadie, así que estos saldos están incompletos.`,
  };
}

/* ════════════ PROPONER SI ES DEL RANCHO O PERSONAL ════════════ */

// Propone; NO decide. Y dice en qué se basa, porque un sistema que da el
// resultado sin explicar sólo se puede obedecer o ignorar.
//
// El criterio se aprende de lo que ya se marcó antes: "esta cuenta, porque
// así se clasificó 340 veces".
export function proponerDestino({ movimiento, historial }) {
  const texto = String(movimiento?.concepto || "").toUpperCase();
  const proveedor = String(movimiento?.proveedor || movimiento?.cliente || "").toUpperCase();

  // ¿Cómo se ha marcado antes a este mismo proveedor o concepto?
  const parecidos = (historial || []).filter(h => {
    const hp = String(h.proveedor || h.cliente || "").toUpperCase();
    if (proveedor && hp && hp === proveedor) return true;
    const hc = String(h.concepto || "").toUpperCase();
    return hc && texto && (hc === texto);
  }).filter(h => destinoDe(h) !== "sin decidir");

  if (parecidos.length === 0) {
    return {
      propone: null, seguro: false,
      porque: "No hay con qué compararlo: es la primera vez que aparece este proveedor o concepto. Márcalo tú y a partir de la próxima se propone solo.",
    };
  }
  const cuenta = {};
  for (const h of parecidos) cuenta[destinoDe(h)] = (cuenta[destinoDe(h)] || 0) + 1;
  const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
  const [mejor, veces] = orden[0];

  // Si antes se marcó de las dos formas, NO propone: quiere decir que depende
  // del caso, y ahí es donde el sistema se equivocaría.
  if (orden.length > 1 && orden[1][1] === veces) {
    return {
      propone: null, seguro: false,
      porque: `A este proveedor se le ha marcado ${veces} vez(ces) como del rancho y ${veces} como personal. Depende del caso, así que decide tú.`,
    };
  }
  return {
    propone: mejor, seguro: veces >= 3,
    veces,
    porque: `Se propone "${mejor}" porque así se marcó ${veces} vez(ces) antes${proveedor ? ` a ${movimiento.proveedor || movimiento.cliente}` : ""}. Confírmalo o cámbialo.`,
  };
}

/* ════════════ A NOMBRE DE QUIÉN QUEDÓ EL COMPROBANTE ════════════ */

// Quién puede deducir una factura depende de a nombre de qué RFC salió. Aquí
// sólo se DEJA DICHO — no se calcula ningún impuesto, que eso no es lo que
// hace este sistema.
export function comprobantesPorTitular({ egresos, titulares }) {
  const porRfc = new Map((titulares || []).filter(t => t.rfc).map(t => [String(t.rfc).toUpperCase(), t]));
  const filas = new Map();
  const sinComprobante = [];
  const aNombreDeNadie = [];

  for (const e of egresos || []) {
    if (destinoDe(e) !== "rancho" || esTraspaso(e)) continue;
    if (!e.uuid) { sinComprobante.push(e); continue; }
    const rfc = String(e.rfcReceptor || "").toUpperCase();
    const t = porRfc.get(rfc);
    if (!t) { aNombreDeNadie.push(e); continue; }
    const f = filas.get(t.id) || { titularId: t.id, nombre: t.nombre, rfc: t.rfc, monto: 0, cuantas: 0 };
    f.monto = sumarDinero(f.monto, e.monto || 0);
    f.cuantas++;
    filas.set(t.id, f);
  }
  const montoSin = sumarDinero(sinComprobante.map(e => e.monto || 0));
  return {
    filas: [...filas.values()].sort((a, b) => b.monto - a.monto),
    sinComprobante, montoSinComprobante: montoSin,
    aNombreDeNadie,
    // Un gasto sin factura NO es un problema a esconder: es un gasto no
    // deducible que hay que registrar como tal. Lo grave no es que exista,
    // es que nadie sepa que existe.
    dice: sinComprobante.length === 0
      ? "Todos los gastos del rancho tienen comprobante fiscal."
      : `${sinComprobante.length} gasto(s) del rancho por ${fmt(montoSin)} no tienen comprobante fiscal. No son deducibles — y saber cuánto se va así al año es información que cambia decisiones.`,
  };
}
