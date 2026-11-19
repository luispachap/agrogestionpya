// ============================================================
//  AgroGestión — Cálculos puros
//
//  Aquí vive lo que se puede probar sin abrir la app: dinero,
//  fechas, conversiones y cálculos chicos. Ninguna función de
//  este archivo toca la pantalla, el almacenamiento ni la red.
//
//  Por qué existe: mientras todo vivía dentro de App.jsx no se
//  podía llamar nada desde fuera, así que no se podía escribir
//  ni una prueba. Sacar estas funciones es lo que destapa eso.
//
//  Las pruebas están en src/calculos.test.js y se corren con
//  "npm test" (usa el corredor que ya trae node, sin instalar nada).
// ============================================================

/* ════════════ DINERO ════════════ */

// El dinero se guarda en pesos pero se OPERA en centavos enteros.
// Por qué: 0.1 + 0.2 en punto flotante da 0.30000000000000004. En un
// rancho que paga a destajo por kilo y reparte costos entre parcelas,
// ese sobrante se acumula hasta que la suma de las partes ya no da
// el total. En centavos enteros no hay sobrante que acumular.

// Pasa un monto en pesos a centavos enteros.
export const aCentavos = (monto) => Math.round((parseFloat(monto) || 0) * 100);

// Pasa centavos enteros de vuelta a pesos.
export const aPesos = (centavos) => (Math.round(centavos) || 0) / 100;

// Suma montos sin que se arrastre el error del punto flotante.
export const sumarDinero = (...montos) =>
  aPesos(montos.flat().reduce((s, m) => s + aCentavos(m), 0));

// Multiplica un precio por una cantidad y redondea al centavo.
// Ej: precio por caja × número de cajas, tarifa de destajo × unidades.
export const multiplicarDinero = (monto, cantidad) =>
  aPesos(Math.round(aCentavos(monto) * (parseFloat(cantidad) || 0)));

// Reparte un monto entre varias partes según sus pesos relativos,
// y le da el sobrante a la última para que la suma cuadre EXACTA.
// Es el mismo patrón que ya usaba el reparto de la revoltura entre
// tarimas, subido aquí para que lo use todo el que reparta dinero.
// Devuelve un arreglo de montos en pesos, del mismo largo que "pesos".
export function repartirDinero(total, pesos) {
  const partes = (pesos || []).map(p => parseFloat(p) || 0);
  if (partes.length === 0) return [];
  const suma = partes.reduce((s, p) => s + p, 0);
  const totalCent = aCentavos(total);
  if (suma <= 0) {
    // Sin pesos con que repartir: todo a la primera, para no perder centavos.
    return partes.map((_, i) => (i === 0 ? aPesos(totalCent) : 0));
  }
  const res = [];
  let repartido = 0;
  for (let i = 0; i < partes.length - 1; i++) {
    const c = Math.round(totalCent * (partes[i] / suma));
    res.push(aPesos(c));
    repartido += c;
  }
  res.push(aPesos(totalCent - repartido)); // el resto, para que cuadre al centavo
  return res;
}

// Formato de dinero para pantalla.
// Muestra centavos SOLO cuando los hay: así las pantallas siguen
// limpias ($12,400) pero un descuadre de centavos se ve ($12,400.03)
// en vez de quedar escondido por el redondeo.
export const fmt = (n) => {
  const cent = aCentavos(n);
  const conCentavos = cent % 100 !== 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: conCentavos ? 2 : 0,
    maximumFractionDigits: conCentavos ? 2 : 0,
  }).format(aPesos(cent));
};

export const fmtN = (n) => new Intl.NumberFormat("es-MX").format(n || 0);

/* ════════════ CANTIDAD CON LETRA ════════════ */

// Convierte un monto a cantidad con letra en español (para remisiones de venta).
// El monto se redondea a centavos ANTES de partirlo: si primero se corta el
// entero y luego se redondean los centavos por separado, 1.999 imprime
// "UN PESO 100/100 M.N." — y eso sale en el papel que se le entrega al cliente.
export function numeroALetras(monto) {
  const totalCent = aCentavos(monto);
  const negativo = totalCent < 0;
  const abs = Math.abs(totalCent);
  const entero = Math.floor(abs / 100);
  const cents = abs % 100;
  const signo = negativo ? "MENOS " : "";
  if (entero === 0) return `${signo}CERO PESOS ${String(cents).padStart(2, "0")}/100 M.N.`;
  const UNI = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
  const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const aLetras = (n, apocope) => {
    // apocope: "VEINTIUNO"→"VEINTIÚN" y "UNO"→"UN" cuando antecede a MIL/MILLONES.
    if (n <= 29) { const s = UNI[n]; return apocope && n === 21 ? "VEINTIÚN" : s; }
    if (n < 100) { const d = Math.floor(n / 10), u = n % 10; return DEC[d] + (u ? " Y " + (apocope && u === 1 ? "UN" : UNI[u]) : ""); }
    if (n === 100) return "CIEN";
    if (n < 1000) { const c = Math.floor(n / 100), r = n % 100; return CEN[c] + (r ? " " + aLetras(r, apocope) : ""); }
    if (n < 1000000) { const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? "MIL" : aLetras(m, true) + " MIL") + (r ? " " + aLetras(r, apocope) : ""); }
    const mill = Math.floor(n / 1000000), r = n % 1000000;
    return (mill === 1 ? "UN MILLÓN" : aLetras(mill, true) + " MILLONES") + (r ? " " + aLetras(r, apocope) : "");
  };
  // Gramática: "UN PESO" (singular), y millones exactos llevan "DE" (UN MILLÓN DE PESOS).
  const palabraPesos = entero === 1 ? "PESO" : "PESOS";
  const millonExacto = entero >= 1000000 && entero % 1000000 === 0;
  return `${signo}${aLetras(entero, true)}${millonExacto ? " DE" : ""} ${palabraPesos} ${String(cents).padStart(2, "0")}/100 M.N.`;
}

/* ════════════ FECHAS ════════════ */

// Regla de la casa: para DECIDIR qué día es, hora de México (la del
// dispositivo). Para GUARDAR una marca de tiempo, UTC.
//
// Nunca uses toISOString() para sacar un día o un mes: devuelve UTC, y
// Zacatecas va seis horas atrás. A las 7 de la noche del 30 de septiembre,
// toISOString() ya dice octubre. Eso hizo que el panel del dueño cambiara
// de mes a media tarde y que el resumen semanal encogiera de 7 a 6 días.

// Día local en formato YYYY-MM-DD.
export const fechaLocal = (d = new Date()) => {
  const f = d instanceof Date ? d : new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

// Mes local en formato YYYY-MM.
export const mesLocal = (d = new Date()) => fechaLocal(d).slice(0, 7);

// Suma (o resta, con número negativo) días a una fecha YYYY-MM-DD.
// Trabaja con el calendario local, así que respeta fines de mes y años bisiestos.
export function sumarDias(fecha, dias) {
  const base = fecha ? new Date(String(fecha).slice(0, 10) + "T00:00:00") : new Date();
  base.setDate(base.getDate() + (parseInt(dias, 10) || 0));
  return fechaLocal(base);
}

// Mes anterior a un YYYY-MM dado.
export function mesAnterior(mes) {
  const [y, m] = String(mes).split("-").map(Number);
  return mesLocal(new Date(y, m - 2, 1));
}

// Días entre dos fechas YYYY-MM-DD (b − a). Positivo si b es posterior.
export function diasEntre(a, b) {
  if (!a || !b) return null;
  const da = new Date(String(a).slice(0, 10) + "T00:00:00");
  const db = new Date(String(b).slice(0, 10) + "T00:00:00");
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

/* ════════════ CRÉDITOS ════════════ */

export function saldoCredito(cr) {
  const abonado = sumarDinero((cr?.abonos || []).map(a => a.monto || 0));
  return { abonado, saldo: sumarDinero(cr?.monto || 0, -abonado) };
}

// Días que faltan para que venza (negativo = ya venció). null si no hay fecha.
export const diasParaVencer = (credito, hoy = fechaLocal()) =>
  credito && credito.vencimiento ? diasEntre(hoy, credito.vencimiento) : null;

// Cubeta de antigüedad, la de siempre en un estado de cuenta.
// "sin fecha" no es lo mismo que "por vencer": un saldo sin fecha de
// vencimiento no es una deuda, es un número, y la pantalla lo dice así.
export function cubetaVencimiento(credito, hoy = fechaLocal()) {
  const d = diasParaVencer(credito, hoy);
  if (d === null) return "sin fecha";
  if (d >= 0) return "por vencer";
  const vencidos = -d;
  if (vencidos <= 30) return "1-30";
  if (vencidos <= 60) return "31-60";
  if (vencidos <= 90) return "61-90";
  return "+90";
}

export const CUBETAS_VENCIMIENTO = ["por vencer", "1-30", "31-60", "61-90", "+90", "sin fecha"];

/* ════════════ QUIÉN GANA AL SINCRONIZAR ════════════ */

// Cuando el mismo registro existe en el aparato y en la nube, gana el más
// reciente, y en un empate gana el LOCAL: es lo que la persona acaba de tocar.
//
// Por qué importa: la marca "_actualizado" la pone este aparato al guardar, y
// dataApi le pone la suya a lo que baja de la nube. Si lo local no llevara
// marca, la nube ganaría siempre y una corrección hecha sin señal
// desaparecería de la pantalla en cuanto volviera el internet. El dato no se
// perdía —la cola de subida lo guarda aparte— pero la persona veía que su
// corrección se borró sola, y eso es peor: o la recaptura, o deja de confiar.
export function ganaAlSincronizar(local, nube) {
  if (!local) return nube;
  if (!nube) return local;
  const tn = nube._actualizado || "";
  const tl = local._actualizado || "";
  return tn > tl ? nube : local;
}

/* ════════════ CANCELACIÓN (nada de dinero se borra) ════════════ */

// Un movimiento de dinero cancelado se queda en su lugar, tachado y visible,
// con quién lo canceló, cuándo y por qué. Se borra sólo lo que nunca existió.
export const estaCancelado = (r) => !!(r && r.cancelado);

// Filtra lo cancelado de una lista antes de sumar.
export const vivos = (lista) => (lista || []).filter(r => !estaCancelado(r));

// Marca un registro como cancelado. NO lo quita: devuelve una copia marcada.
export function marcarCancelado(registro, { motivo, quien, cuando } = {}) {
  return {
    ...registro,
    cancelado: true,
    motivoCancelacion: String(motivo || "").trim(),
    canceladoPor: quien || "—",
    canceladoEn: cuando || new Date().toISOString(),
  };
}

/* ════════════ OTROS CÁLCULOS ════════════ */

// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine).
export function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Limpia un número de teléfono y lo deja en formato internacional (con 52 al inicio).
export function formatearTelefonoMX(tel) {
  if (!tel) return "";
  const limpio = String(tel).replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.startsWith("52") && limpio.length >= 12) return limpio;
  if (limpio.length === 10) return "52" + limpio;
  return limpio; // confiar en lo que el usuario puso
}

export function totalCosecha(cos) {
  if (!cos) return 0;
  const regs = (cos.registros || []).reduce((s, r) => s + (parseFloat(r.cantidad) || 0), 0);
  const ajus = (cos.ajustes || []).reduce((s, a) => s + (parseFloat(a.delta) || 0), 0);
  return regs + ajus;
}

/* ──── Costo de mano de obra ──── */
// Distribuye el sueldo diario de cada trabajador entre las parcelas donde
// trabajó ese día, en proporción a las horas. Retorna un mapa parcelaId -> costo total.
//
// Lógica: para cada trabajador-día, costoPorHora = sueldoDiario / horasTotalesDelDía
// Luego cada parcela recibe (horasEnParcela * costoPorHora).
// Si un trabajador trabajó 4h en R01 y 4h en R02 con sueldo de $400:
//   costoPorHora = 400/8 = 50 → R01 recibe $200, R02 recibe $200.
//
// Si solo trabajó 4h ese día (un solo bloque): 400/4 = 100/h → la parcela recibe $400 completo.
//
// El sueldo del día se REPARTE en centavos enteros y el sobrante se le da a
// la última parcela: así lo que se le carga a las parcelas suma exactamente
// el sueldo que se le pagó, sin centavos perdidos ni inventados.
export function calcularCostoManoObra(actividades, trabajadores) {
  // Estructura: { "trabajadorId|fecha": [actividad, actividad, ...] }
  const porTrabajadorDia = {};
  (actividades || []).forEach(a => {
    if (!a || !a.fecha) return;
    // Las actividades de bodega no tienen parcela: usan una clave virtual por cultivo.
    const claveParcela = a.parcelaId || (a.esBodega && a.cultivoBodega ? `bodega:${a.cultivoBodega}` : "");
    if (!claveParcela) return;
    // Las actividades guardan las horas como "horas" (modal nuevo) u "horas_trab" (admin/registro).
    const horas = parseFloat(a.horas) || parseFloat(a.horas_trab) || 0;
    if (horas <= 0) return;
    // ¿Quién trabajó? Distintos formularios usan distintos campos:
    //   • trabajadorId directo
    //   • registradoPor.id (puede ser trabajador, cuadrilla, encargado…)
    //   • registradoPor.tipo es "planta"/"cuadrilla"/"encargado"/"externo" según el formulario admin
    //   • registradoPor.rol es "trabajador"/"agronomo"/etc. según los formularios nuevos
    const trabajadorId = a.trabajadorId || (a.registradoPor && a.registradoPor.id);
    if (!trabajadorId) return;
    // Excluir cuando la actividad fue registrada por admin o dueño (sin trabajador real ligado)
    const rol = a.registradoPor && (a.registradoPor.rol || a.registradoPor.tipo);
    if (rol === "admin" || rol === "dueno" || rol === "finanzas") return;
    const k = `${trabajadorId}|${a.fecha}`;
    if (!porTrabajadorDia[k]) porTrabajadorDia[k] = [];
    porTrabajadorDia[k].push({ parcelaId: claveParcela, horas, actividadId: a.id });
  });

  // Calcular costo por parcela
  const costoPorParcela = {};   // parcelaId -> costoTotal
  const desglosePorParcela = {}; // parcelaId -> [{trabajadorId, fecha, horas, costo}]

  Object.entries(porTrabajadorDia).forEach(([k, acts]) => {
    const [trabajadorId, fecha] = k.split("|");
    const trabajador = (trabajadores || []).find(t => t.id === trabajadorId);
    if (!trabajador) return;
    const sueldoDiario = parseFloat(trabajador.sueldo_dia) || 0;
    if (sueldoDiario <= 0) return;
    const horasTotalesDelDia = acts.reduce((s, a) => s + a.horas, 0);
    if (horasTotalesDelDia <= 0) return;
    const costoPorHora = sueldoDiario / horasTotalesDelDia;
    // El sueldo del día se reparte proporcional a las horas, al centavo.
    const montos = repartirDinero(sueldoDiario, acts.map(a => a.horas));
    acts.forEach((a, i) => {
      const costo = montos[i];
      costoPorParcela[a.parcelaId] = sumarDinero(costoPorParcela[a.parcelaId] || 0, costo);
      if (!desglosePorParcela[a.parcelaId]) desglosePorParcela[a.parcelaId] = [];
      desglosePorParcela[a.parcelaId].push({
        trabajadorId, trabajadorNombre: trabajador.nombre, fecha,
        horas: a.horas, costoPorHora, costo, actividadId: a.actividadId,
      });
    });
  });

  return { costoPorParcela, desglosePorParcela };
}
