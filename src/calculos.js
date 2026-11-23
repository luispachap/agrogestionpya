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
  // Un abono cancelado no se borra: se queda en el historial, tachado, y deja de contar.
  const abonado = sumarDinero((cr?.abonos || []).filter(a => !estaCancelado(a)).map(a => a.monto || 0));
  return { abonado, saldo: sumarDinero(cr?.monto || 0, -abonado) };
}

// DOS APARATOS ABONANDO AL MISMO CRÉDITO. Los abonos viven dentro del crédito, así que el que subía al último pisaba
// el abono del otro: dinero pagado que desaparecía del registro. Dos versiones del mismo crédito se UNEN: se conservan
// los abonos de las dos (por su id), y si en alguna un abono está cancelado, queda cancelado (cancelar no se deshace
// por llegar tarde). Los demás datos del crédito son los de la versión que gana.
export function unirAbonos(a = [], b = []) {
  const porId = new Map();
  for (const ab of [...(a || []), ...(b || [])]) {
    if (!ab || ab.id == null) continue;
    const ya = porId.get(ab.id);
    if (!ya || (estaCancelado(ab) && !estaCancelado(ya))) porId.set(ab.id, ab);
  }
  return [...porId.values()].sort((x, y) => String(x.fecha || "").localeCompare(String(y.fecha || "")) || String(x.id).localeCompare(String(y.id)));
}
export function unirCredito(gana, otro) {
  if (!gana) return otro;
  if (!otro) return gana;
  const abonos = unirAbonos(gana.abonos, otro.abonos);
  const unido = { ...gana, abonos };
  return { ...unido, estado: saldoCredito(unido).saldo <= 0 ? "pagado" : "activo" };
}
// ¿A `a` le falta algo que `b` sí tiene? (un abono, o saber que uno se canceló)
export function leFaltanAbonos(a, b) {
  const de = (cr) => new Map((cr?.abonos || []).map(x => [x.id, estaCancelado(x)]));
  const ma = de(a), mb = de(b);
  for (const [id, cancelado] of mb) if (!ma.has(id) || (cancelado && !ma.get(id))) return true;
  return false;
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
// Lo que es DEL RANCHO: sin lo cancelado, sin lo que una persona marcó como personal en Socios y sin los traspasos entre
// bolsas propias. Lo personal no se borra (sigue en Socios y en el banco, que debe cuadrar): sólo no es ingreso ni gasto
// del rancho. Toda suma de resultado, costo o flujo pasa por aquí; las listas y la cuenta entre socios usan `vivos`.
export const esPersonal = (m) => !!m && m.destino === "personal";
export const delRancho = (lista) => vivos(lista).filter(m => !esPersonal(m) && !m?.traspasoCon);

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

// Un registro de cosecha NO se borra: se cancela con motivo y deja de contar. (Además, borrarlo ya no «pegaba»: al
// unir con lo que otro teléfono tenía, el registro borrado volvía.)
export const registrosVivos = (cos) => (cos?.registros || []).filter(r => r && !r.cancelado);
export function cancelarRegistroDeCosecha(cos, regId, { motivo, quien, cuando }) {
  if (!String(motivo || "").trim()) return { ok: false, dice: "Para cancelar un registro de cosecha hay que decir por qué." };
  const reg = (cos?.registros || []).find(r => r.id === regId);
  if (!reg) return { ok: false, dice: "Ese registro ya no está." };
  if (reg.cancelado) return { ok: false, dice: "Ese registro ya estaba cancelado." };
  return { ok: true, cosecha: { ...cos, registros: cos.registros.map(r => r.id === regId ? { ...r, cancelado: { motivo: String(motivo).trim(), por: quien || "", cuando } } : r) } };
}
export function totalCosecha(cos) {
  if (!cos) return 0;
  const regs = registrosVivos(cos).reduce((s, r) => s + (parseFloat(r.cantidad) || 0), 0);
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
    porTrabajadorDia[k].push({
      parcelaId: claveParcela, horas, actividadId: a.id,
      sueldoDia: parseFloat(a.sueldoDia) || 0, trabajadorNombre: a.trabajadorNombre || "",
      // ¿Es de alguien de planta? (una cuadrilla o un encargado también capturan,
      // pero su costo no es sueldo por día y no debe salir como "faltante").
      dePlanta: !!a.trabajadorId || rol === "trabajador" || rol === "planta",
    });
  });

  // Calcular costo por parcela
  const costoPorParcela = {};   // parcelaId -> costoTotal
  const desglosePorParcela = {}; // parcelaId -> [{trabajadorId, fecha, horas, costo}]
  const sinSueldo = [];          // días trabajados que no se pudieron costear
  const estimados = [];          // actividades costeadas con un sueldo que no consta para esa fecha

  Object.entries(porTrabajadorDia).forEach(([k, acts]) => {
    const [trabajadorId, fecha] = k.split("|");
    const enCatalogo = (trabajadores || []).find(t => t.id === trabajadorId);
    // El sueldo que vale es el que tenía ESE DÍA (la foto que se guardó al
    // capturar). Sólo si el registro es viejo y no trae foto se usa el del
    // catálogo de hoy. Así un aumento no reescribe los meses pasados, y dar de
    // baja a alguien no borra lo que ya costó.
    const foto = acts.find(a => a.sueldoDia > 0);
    // Sin foto: lo que diga el historial de sueldos para ESA fecha. Y si
    // tampoco hay historial, el sueldo de hoy — pero marcado como estimado,
    // porque nadie puede probar que ése era el sueldo de aquel día.
    const vigente = foto ? { sueldo: foto.sueldoDia, origen: "foto" } : sueldoVigente(enCatalogo, fecha);
    const sueldoDiario = vigente.sueldo;
    const trabajador = enCatalogo || { nombre: (acts.find(a => a.trabajadorNombre) || {}).trabajadorNombre || "(ya no está en el catálogo)" };
    if (sueldoDiario <= 0) {
      // Un dato que falta no es un cero: se dice cuáles días quedaron sin costo.
      // (Quien sí está en el catálogo pero sin sueldo —un encargado que captura,
      // por ejemplo— no entra aquí: ése nunca tuvo costo por día.)
      if (!enCatalogo && acts.some(a => a.dePlanta)) sinSueldo.push({ trabajadorId, fecha, horas: acts.reduce((t, a) => t + a.horas, 0), actividades: acts.map(a => a.actividadId) });
      return;
    }
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
        origenSueldo: vigente.origen, estimado: vigente.estimado === true,
      });
      if (vigente.estimado) estimados.push(a.actividadId);
    });
  });

  return { costoPorParcela, desglosePorParcela, sinSueldo, estimados };
}

/* ──── El sueldo de la SEMANA ──── */
// Luis, 22 nov: «el sueldo por día es el de la semana entre 6», para que TODO el sueldo semanal se reparta entre las
// actividades de los días trabajados. Quien cobra por semana lleva en su ficha `sueldo_semana`, y cada día de su
// calendario (lunes a sábado si no se dice otro) vale su PARTE, repartida al centavo: la semana completa suma exacto lo
// que gana —3,500 = 583.33 × 5 + 583.35—, no 3,499.98. El centavo que sobra se lo lleva el último día de su calendario.
// Un día fuera de su calendario (un domingo que sí vino) vale el promedio. Su `sueldo_dia` es ese promedio: es el que se
// enseña y la base de sus prestaciones.
export const DIAS_DE_SIEMPRE = [1, 2, 3, 4, 5, 6];
export const diaDeLaSemana = (fecha) => { const d = new Date(fecha + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; };
const diasDelCalendario = (t) => (Array.isArray(t?.diasAsistencia) && t.diasAsistencia.length ? [...new Set(t.diasAsistencia.map(Number))].sort((a, b) => a - b) : DIAS_DE_SIEMPRE);
export const promedioDeSemana = (semana, trabajador) => Math.round((parseFloat(semana) || 0) / diasDelCalendario(trabajador).length * 100) / 100;
export function parteDelDia(semana, trabajador, fecha) {
  const s = parseFloat(semana) || 0; if (!(s > 0)) return 0;
  const dias = diasDelCalendario(trabajador), i = fecha ? dias.indexOf(diaDeLaSemana(fecha)) : -1;
  return i >= 0 ? repartirDinero(s, dias.map(() => 1))[i] : promedioDeSemana(s, trabajador);
}
// Al guardar una ficha que cobra por semana, su sueldo por día es el promedio (no se teclea aparte).
export function conSueldoSemanal(persona) {
  const s = parseFloat(persona?.sueldo_semana);
  return s > 0 ? { ...persona, sueldo_semana: Math.round(s * 100) / 100, sueldo_dia: promedioDeSemana(s, persona) } : persona;
}

/* ──── El sueldo de cada fecha, con su evidencia ──── */
// ¿Cuánto ganaba esta persona ESE día? De mejor a peor evidencia:
//   "historial"         — hay un cambio de sueldo anotado que cubre la fecha.
//   "anterior_conocido" — la fecha es anterior al primer cambio anotado: se
//                         usa el sueldo que tenía antes de ese cambio. Consta
//                         que lo tenía; no consta desde cuándo. ESTIMADO.
//   "catalogo_actual"   — no hay historial: se usa el de hoy. ESTIMADO.
// Nunca se escribe un sueldo viejo con el valor de hoy como si fuera un hecho.
export function sueldoVigente(trabajador, fecha) {
  if (!trabajador) return { sueldo: 0, origen: "sin_dato", estimado: true };
  // Quien cobra por semana: el día vale su parte de la semana (y se dice el promedio y la semana de donde salió).
  const de = (r, origen, estimado) => { const sem = parseFloat(r.sueldo_semana) || 0;
    return sem > 0 ? { sueldo: parteDelDia(sem, trabajador, fecha), promedio: promedioDeSemana(sem, trabajador), semana: sem, origen, estimado } : { sueldo: parseFloat(r.sueldo_dia) || 0, origen, estimado }; };
  const hist = (trabajador.historialSueldo || []).filter(h => h && h.desde).sort((a, b) => (a.desde < b.desde ? -1 : 1));
  if (hist.length > 0 && fecha) {
    let vigente = null;
    for (const h of hist) if (h.desde <= fecha) vigente = h;
    if (vigente) return de(vigente, "historial", false);
    const antes = parseFloat(hist[0].anterior);
    if (antes > 0) return { sueldo: antes, origen: "anterior_conocido", estimado: true };
  }
  return de(trabajador, "catalogo_actual", true);
}

// Al dar de ALTA a alguien, el sueldo que se le pone vale desde ese día: se anota como el primer renglón de su
// historial. Sin esto, todo lo que trabajara salía marcado como «sueldo estimado» aunque el sueldo fuera el suyo.
export function sueldoDeAlta(persona, hoy) {
  const s = parseFloat(persona && persona.sueldo_dia) || 0, sem = parseFloat(persona && persona.sueldo_semana) || 0;
  if (!persona || !(s > 0) || (persona.historialSueldo || []).length > 0) return persona;
  return { ...persona, historialSueldo: [{ desde: hoy, sueldo_dia: s, anterior: s, ...(sem > 0 ? { sueldo_semana: sem } : {}) }] };
}

// Al cambiarle el sueldo a alguien se ANOTA el cambio: desde qué día, cuánto,
// y cuánto ganaba antes. Si el sueldo no cambió, no se anota nada.
export function anotarCambioDeSueldo(antes, despues, hoy) {
  if (!despues) return despues;
  const viejo = parseFloat(antes && antes.sueldo_dia) || 0, nuevo = parseFloat(despues.sueldo_dia) || 0;
  const semViejo = parseFloat(antes && antes.sueldo_semana) || 0, semNuevo = parseFloat(despues.sueldo_semana) || 0;
  if (!antes || (viejo === nuevo && semViejo === semNuevo)) return despues;
  const hist = [...(despues.historialSueldo || antes.historialSueldo || [])];
  // Dos cambios el mismo día (una corrección de dedo) son uno solo.
  const mismoDia = hist.findIndex(h => h.desde === hoy);
  const renglon = { desde: hoy, sueldo_dia: nuevo, anterior: mismoDia >= 0 ? hist[mismoDia].anterior : viejo, ...(semNuevo > 0 ? { sueldo_semana: semNuevo } : {}) };
  if (mismoDia >= 0) hist[mismoDia] = renglon; else hist.push(renglon);
  return { ...despues, historialSueldo: hist };
}

/* ──── Lo devengado no es lo mismo que el costo repartido ──── */
// Son dos preguntas distintas y aquí se contestan por separado:
//   1. DEVENGADO: ¿cuánto se ganó cada persona cada día, y por qué modalidad?
//      (por día, por hora o a destajo). Esto es lo que se le debe.
//   2. DISTRIBUCIÓN: de eso, ¿cuánto le toca a cada parcela y a cada labor?
// La suma de la distribución SIEMPRE es igual a lo devengado: repartir no crea
// ni pierde dinero.
//
// La modalidad sale de la actividad ("destajo" con tarifa y unidades) o del
// trabajador (`modalidadPago`: "dia" —la de siempre— u "hora"). Sin dato, "dia".
// NO cambia ninguna regla de pago: sólo las deja separadas y a la vista.
export function remuneracionDevengada(actividades, trabajadores, { horasJornada = 8 } = {}) {
  const dias = {};
  for (const a of actividades || []) {
    if (!a || !a.fecha || estaCancelado(a)) continue;
    const id = a.trabajadorId || (a.registradoPor && a.registradoPor.id);
    const rol = a.registradoPor && (a.registradoPor.rol || a.registradoPor.tipo);
    if (!id || rol === "admin" || rol === "dueno" || rol === "finanzas") continue;
    const k = `${id}|${a.fecha}`;
    (dias[k] = dias[k] || []).push(a);
  }
  const devengado = [];
  for (const [k, acts] of Object.entries(dias)) {
    const [trabajadorId, fecha] = k.split("|");
    const t = (trabajadores || []).find(x => x.id === trabajadorId);
    const foto = acts.find(a => parseFloat(a.sueldoDia) > 0);
    const v = foto ? { sueldo: parseFloat(foto.sueldoDia), origen: "foto", estimado: false } : sueldoVigente(t, fecha);
    const destajo = acts.filter(a => a.modalidad === "destajo" && parseFloat(a.tarifa) > 0 && parseFloat(a.unidades) > 0);
    const jornal = acts.filter(a => !destajo.includes(a) && (parseFloat(a.horas) || parseFloat(a.horas_trab) || 0) > 0);
    const partes = [];
    for (const a of destajo) {
      partes.push({ actividadId: a.id, parcelaId: a.parcelaId || null, tipo: a.tipo || null, modalidad: "destajo",
        unidades: parseFloat(a.unidades), monto: multiplicarDinero(parseFloat(a.tarifa), parseFloat(a.unidades)) });
    }
    if (jornal.length > 0 && v.sueldo > 0) {
      const horas = jornal.map(a => parseFloat(a.horas) || parseFloat(a.horas_trab) || 0);
      const porHora = (t && t.modalidadPago) === "hora";
      // Por día: se devenga el día completo y se reparte entre lo que hizo.
      // Por hora: se devenga sólo lo trabajado.
      const total = porHora ? multiplicarDinero(v.sueldo / horasJornada, horas.reduce((s, h) => s + h, 0)) : v.sueldo;
      const montos = repartirDinero(total, horas);
      jornal.forEach((a, i) => partes.push({ actividadId: a.id, parcelaId: a.parcelaId || null, tipo: a.tipo || null,
        modalidad: porHora ? "hora" : "dia", horas: horas[i], monto: montos[i] }));
    }
    if (partes.length === 0) continue;
    devengado.push({
      trabajadorId, trabajadorNombre: (t && t.nombre) || (acts.find(a => a.trabajadorNombre) || {}).trabajadorNombre || "",
      fecha, monto: sumarDinero(partes.map(p => p.monto)), origenSueldo: v.origen, estimado: v.estimado === true && partes.some(p => p.modalidad !== "destajo"),
      partes,
    });
  }
  return devengado;
}

// De lo devengado, cuánto le toca a cada parcela, a cada labor y a cada modalidad.
export function distribuirCosto(devengado) {
  const porParcela = {}, porActividad = {}, porModalidad = {};
  let total = 0, estimado = 0;
  for (const d of devengado || []) {
    for (const p of d.partes || []) {
      const par = p.parcelaId || "(sin parcela)", lab = p.tipo || "(sin actividad)";
      porParcela[par] = sumarDinero(porParcela[par] || 0, p.monto);
      porActividad[lab] = sumarDinero(porActividad[lab] || 0, p.monto);
      porModalidad[p.modalidad] = sumarDinero(porModalidad[p.modalidad] || 0, p.monto);
      total = sumarDinero(total, p.monto);
      if (d.estimado && p.modalidad !== "destajo") estimado = sumarDinero(estimado, p.monto);
    }
  }
  // "estimado" es la parte del total calculada con un sueldo que no consta
  // para esa fecha. Se enseña junto al total, nunca escondida dentro de él.
  return { porParcela, porActividad, porModalidad, total, estimado };
}

// La foto del sueldo: al capturar una actividad se le pega el sueldo diario que
// la persona tiene HOY y su nombre. No cambia cuánto se le paga a nadie; sólo
// deja escrito con qué sueldo se costeó ese día. Si ya trae foto, no se toca.
export function sellarSueldoDelDia(actividad, trabajadores) {
  if (!actividad || parseFloat(actividad.sueldoDia) > 0) return actividad;
  const id = actividad.trabajadorId || (actividad.registradoPor && actividad.registradoPor.id);
  const t = id && (trabajadores || []).find(x => x.id === id);
  // Quien cobra por semana: la foto es la parte de la semana que vale ESE día (no el promedio).
  const sueldo = t && parseFloat(t.sueldo_semana) > 0 ? parteDelDia(t.sueldo_semana, t, actividad.fecha) : parseFloat(t && t.sueldo_dia) || 0;
  if (!t || sueldo <= 0) return actividad;
  return { ...actividad, sueldoDia: sueldo, trabajadorNombre: actividad.trabajadorNombre || t.nombre || "" };
}

// UN IDENTIFICADOR QUE NO SE REPITE ENTRE TELÉFONOS. Antes casi todos los registros nacían con «letra + hora del
// teléfono en milésimas»: dos aparatos capturando en la misma milésima (o uno guardando dos renglones seguidos) hacían
// el MISMO identificador, y en la nube el segundo registro pisaba al primero sin avisar. La hora se queda (ordena y
// ayuda a leer) y se le pega una parte al azar.
export const unico = () => `${Date.now()}${Math.random().toString(36).slice(2, 9).padEnd(7, "0")}`;

// TODO REGISTRO DE DINERO O DE ALMACÉN DICE QUIÉN LO CAPTURÓ. Un gasto o un ingreso tecleado en Finanzas se guardaba sin
// autor: se sabía el importe y no quién lo había metido. Se estampa al guardar, con la sesión; nunca se pisa el que
// ya traiga (lo que capturó un trabajador y aprueba otro sigue siendo del trabajador).
export const COLECCIONES_CON_AUTOR = ["egresos", "ingresos", "cajachica", "creditos", "entradas_inv", "compras", "solicitudes_compra", "ventas", "consignaciones"];
export function conAutor(sec, item, sesion) {
  if (!COLECCIONES_CON_AUTOR.includes(sec) || !item || item.registradoPor || !sesion?.id) return item;
  return { ...item, registradoPor: { rol: sesion.role || sesion.rol || "", id: sesion.id, nombre: sesion.nombre || "" } };
}

// LOS COBROS DE UN EMBARQUE TAMPOCO SE PISAN. Cada cobro vive dentro de su embarque (`liquidaciones`): si dos teléfonos
// cobraban parte del mismo, uno sin señal, el que subía después dejaba al embarque sin el cobro del otro (el ingreso sí
// quedaba, y el embarque decía que se había cobrado menos). Igual que los abonos de un crédito: se UNEN por identificador.
export function unirEmbarque(gana, otro) {
  if (!gana) return otro;
  if (!otro) return gana;
  const porId = new Map();
  for (const l of [...(otro.liquidaciones || []), ...(gana.liquidaciones || [])]) if (l && l.id != null) porId.set(l.id, l);
  const liquidaciones = [...porId.values()].sort((x, y) => String(x.fecha || "").localeCompare(String(y.fecha || "")) || String(x.id).localeCompare(String(y.id)));
  if (!liquidaciones.length) return gana;
  const cobrado = gana.estadoCobro === "cobrado" || otro.estadoCobro === "cobrado";
  return { ...gana, liquidaciones, montoCobrado: sumarDinero(liquidaciones.map(l => Number(l.monto) || 0)), estadoCobro: cobrado ? "cobrado" : (gana.estadoCobro || otro.estadoCobro) };
}
export function leFaltanCobros(a, b) {
  const ids = new Set((a?.liquidaciones || []).map(l => l.id));
  return (b?.liquidaciones || []).some(l => !ids.has(l.id)) || (b?.estadoCobro === "cobrado" && a?.estadoCobro !== "cobrado");
}
// Las colecciones cuyos registros llevan una lista que crece desde varios teléfonos: se unen, nunca se escoge uno.
// LA COSECHA DE UNA PARCELA TAMPOCO SE PISA. Lo cosechado se anota dentro del registro de cosecha de la parcela
// (`registros`, `ajustes`, `usosSemilla`), y lo anotan varias personas desde varios teléfonos: el que subía después
// dejaba fuera lo del otro. Se unen por identificador. Y el registro de la parcela lleva identificador de nombre propio
// (`cos-<parcela>`): dos teléfonos que anotan la PRIMERA cosecha sin señal ya no dejan dos registros de la misma parcela.
export const idDeCosecha = (parcelaId) => `cos-${parcelaId}`;
const LISTAS_DE_COSECHA = ["registros", "ajustes", "usosSemilla"];
const unirLista = (a, b) => { const m = new Map(); for (const x of [...(b || []), ...(a || [])]) if (x && x.id != null && !(m.get(x.id)?.cancelado && !x.cancelado)) m.set(x.id, x); /* lo cancelado gana */ return [...m.values()].sort((x, y) => String(x.fecha || "").localeCompare(String(y.fecha || "")) || String(x.id).localeCompare(String(y.id))); };
export function unirCosecha(gana, otro) {
  if (!gana) return otro;
  if (!otro) return gana;
  const u = { ...gana };
  for (const k of LISTAS_DE_COSECHA) if ((gana[k] || []).length || (otro[k] || []).length) u[k] = unirLista(gana[k], otro[k]);
  return u;
}
export function leFaltaCosecha(a, b) {
  return LISTAS_DE_COSECHA.some(k => { const ids = new Set((a?.[k] || []).map(x => x.id)); return (b?.[k] || []).some(x => !ids.has(x.id)); });
}
export const UNIONES_DE_REGISTROS = { creditos: { unir: unirCredito, falta: leFaltanAbonos }, embarques: { unir: unirEmbarque, falta: leFaltanCobros }, cosechas: { unir: unirCosecha, falta: leFaltaCosecha } };

// LA MARCA DE NACIMIENTO (`_nace`). La parte al azar del identificador hace una coincidencia casi imposible, pero eso lo
// decide el teléfono. La que de verdad cuida es la BASE (hoja 56): cada registro capturado nace con esta marca, que
// viaja con él para siempre; si a un identificador ocupado llega un registro con OTRA marca, la base lo rechaza y el
// guardado queda intacto. Sólo la llevan los identificadores hechos al momento (`unico()` o los de un evento); los de
// nombre propio (recibir una compra, comprar una solicitud, una configuración) son «el mismo hecho» a propósito.
// OJO: el identificador ENTERO tiene que ser el hecho al momento (prefijo de letras + hora + azar). Uno de nombre propio
// que lleva DENTRO el identificador de otra cosa (`eg-sol-<solicitud>-0`, `eg-<movimiento de caja>`,
// `alm_entrada-compra-<compra>-0`) NO lleva marca: antes la llevaba, y entonces el mismo hecho capturado en dos teléfonos
// sin señal se rechazaba y se reubicaba como si fuera otro — o sea, se duplicaba.
const HECHO_AL_MOMENTO = /^[A-Za-z_]*\d{13}[a-z0-9]{7}\d{0,5}$|^ev-[a-z0-9]+-[a-z0-9]+-[a-z0-9]{7}$/;
// La marca sale del generador de azar del sistema (no del mismo que usa el identificador): si dos teléfonos coinciden
// en el identificador, que coincidan además en esto no es cosa de suerte.
export const marcaNueva = () => {
  try { const b = new Uint8Array(12); globalThis.crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, "0")).join(""); }
  catch { return `${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`; }
};
export function conNacimiento(item, marca = marcaNueva) {
  if (!item || item._nace || !HECHO_AL_MOMENTO.test(String(item.id || ""))) return item;
  return { ...item, _nace: marca() };
}
// Al corregir un registro, su marca no se pierde aunque la pantalla lo haya vuelto a armar sin ella.
export const conservarNacimiento = (item, guardado) => (item && !item._nace && guardado?._nace ? { ...item, _nace: guardado._nace } : item);
export const esIdentificadorOcupado = (e) => /identificador_ocupado/.test(String(e?.message || e || ""));

// ALTA DE UN CULTIVO desde la app. Antes sólo entraban por la hoja de Excel de catálogos: en un rancho que arranca
// limpio nadie podía dar de alta «Ajo», y sin cultivo no hay calendario, ciclos ni resultado por cultivo.
// El identificador sale del NOMBRE: dos teléfonos que dan de alta el mismo cultivo sin señal dejan uno solo.
const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
// LAS ETAPAS DE UN CULTIVO (su calendario: preparación, siembra, desarrollo, cosecha…). Antes sólo entraban por la hoja
// de Excel: un cultivo dado de alta en la app no tenía etapas y el avance por fase, el calendario y Operación salían
// vacíos. La app no las inventa: las escribe quien sabe (Fito). Se revisa que cada una tenga nombre, que empiece antes
// de terminar, que vayan en orden sin encimarse y que no pasen de lo que dura el cultivo.
const num_ = (v) => (v === "" || v == null ? NaN : Number(v));
export function revisarEtapas(etapas = [], duracionDias = null) {
  const limpias = (etapas || []).map(e => ({ etapa: String(e?.etapa || "").trim().replace(/\s+/g, " "), diaInicio: num_(e?.diaInicio), diaFin: num_(e?.diaFin) }))
    .filter(e => e.etapa || Number.isFinite(e.diaInicio) || Number.isFinite(e.diaFin));
  if (limpias.length === 0) return { ok: false, dice: "Escribe al menos una etapa." };
  for (const [i, e] of limpias.entries()) {
    const n = `La etapa ${i + 1}${e.etapa ? ` («${e.etapa}»)` : ""}`;
    if (!e.etapa) return { ok: false, dice: `${n} no tiene nombre.` };
    if (!Number.isInteger(e.diaInicio) || !Number.isInteger(e.diaFin) || e.diaInicio < 0) return { ok: false, dice: `${n}: faltan sus días (desde qué día y hasta qué día, contados desde la siembra).` };
    if (e.diaFin <= e.diaInicio) return { ok: false, dice: `${n} termina antes de empezar.` };
    if (duracionDias && e.diaFin > Number(duracionDias)) return { ok: false, dice: `${n} termina el día ${e.diaFin}, pero el cultivo dura ${duracionDias} días.` };
    if (i > 0 && e.diaInicio < limpias[i - 1].diaFin) return { ok: false, dice: `${n} empieza antes de que termine la anterior: van en orden y sin encimarse.` };
    if (limpias.slice(0, i).some(x => sinAcentos(x.etapa) === sinAcentos(e.etapa))) return { ok: false, dice: `${n} se repite.` };
  }
  return { ok: true, etapas: limpias };
}

export function revisarCultivo(form, cultivos = []) {
  const nombre = String(form?.nombre || "").trim().replace(/\s+/g, " ");
  if (!nombre) return { ok: false, dice: "Falta el nombre del cultivo." };
  const otro = (cultivos || []).find(c => sinAcentos(c.nombre) === sinAcentos(nombre));
  if (otro) return { ok: false, dice: `Ya está dado de alta ${otro.nombre}. Si es otra clase del mismo cultivo, agrégala como variedad.` };
  const dias = Number(form?.duracionDias);
  if (!Number.isInteger(dias) || dias < 20 || dias > 730) return { ok: false, dice: "Falta cuántos días dura de la siembra a la cosecha (entre 20 y 730). Con eso se calcula la fecha estimada de cosecha." };
  const unidad = String(form?.unidadCosecha || "").trim() || "kg";
  return { ok: true, cultivo: { id: `cul_${sinAcentos(nombre).replace(/[^a-z0-9]+/g, "_")}`, nombre, emoji: "🌱", duracionDias: dias, unidadCosecha: unidad, camasPorHa: 0, fenologia: [], variedades: [] } };
}

// ALTA DE RANCHOS Y PARCELAS. Antes «Crear» no hacía nada si faltaba un dato (y no decía cuál), dejaba crear una parcela
// sin rancho y dos con el mismo nombre; y se podía ELIMINAR una parcela con actividades, siembras o gastos, que se
// quedaban apuntando a nada.
export function revisarRancho(form, ranchos = []) {
  const nombre = String(form?.nombre || "").trim().replace(/\s+/g, " ");
  if (!nombre) return { ok: false, dice: "Falta el nombre del rancho." };
  const otro = (ranchos || []).find(r => r.id !== form.id && sinAcentos(r.nombre) === sinAcentos(nombre));
  if (otro) return { ok: false, dice: `Ya hay un rancho que se llama ${otro.nombre}.` };
  if (!(Number(form?.hectareas) > 0)) return { ok: false, dice: "Faltan las hectáreas del rancho." };
  return { ok: true, nombre };
}
export function revisarParcela(form, parcelas = [], ranchos = []) {
  const nombre = String(form?.nombre || "").trim().replace(/\s+/g, " ");
  if (!(ranchos || []).length) return { ok: false, dice: "Primero da de alta un rancho: cada parcela pertenece a uno." };
  const ranchoId = (ranchos || []).some(r => r.id === form?.ranchoId) ? form.ranchoId : ranchos[0].id;
  if (!nombre) return { ok: false, dice: "Falta el nombre de la parcela." };
  const otra = (parcelas || []).find(p => p.id !== form.id && p.ranchoId === ranchoId && sinAcentos(p.nombre) === sinAcentos(nombre));
  if (otra) return { ok: false, dice: `En ese rancho ya hay una parcela que se llama ${otra.nombre}.` };
  if (!String(form?.cultivo || "").trim()) return { ok: false, dice: "Falta el cultivo principal (el que tiene o va a tener)." };
  if (!(Number(form?.hectareas) > 0)) return { ok: false, dice: "Faltan las hectáreas de la parcela." };
  return { ok: true, nombre, ranchoId, cultivo: String(form.cultivo).trim() };
}
// Qué hay registrado sobre una parcela. Si hay algo, no se elimina.
const COLECCIONES_CON_PARCELA = [["actividades", "actividades"], ["siembras", "siembras"], ["cosechas", "cosechas"], ["egresos", "gastos"], ["ingresos", "ingresos"], ["aplicaciones", "aplicaciones"], ["estibas", "estibas"], ["indicaciones", "tareas o indicaciones"], ["incidencias", "reportes"], ["cajachica", "movimientos de caja"]];
export function usoDeParcela(data, parcelaId) {
  const partes = [];
  for (const [col, nombre] of COLECCIONES_CON_PARCELA) {
    const n = (data?.[col] || []).filter(x => x && (x.parcelaId === parcelaId || (Array.isArray(x.parcelas) && x.parcelas.includes(parcelaId)) || (Array.isArray(x.parcelaIds) && x.parcelaIds.includes(parcelaId)))).length;
    if (n) partes.push({ que: nombre, cuantos: n });
  }
  const ev = (data?.eventos || []).filter(e => e?.datos?.parcelaId === parcelaId).length;
  if (ev) partes.push({ que: "registros de trabajo, almacén o mapa", cuantos: ev });
  return { usada: partes.length > 0, partes, dice: partes.length ? `No se puede eliminar: tiene ${partes.map(p => `${p.cuantos} ${p.que}`).join(", ")}. Lo registrado se quedaría sin su parcela.` : "" };
}

// UN PROVEEDOR, UNA FICHA (defecto 14). Deudas guardaba el proveedor como texto y Proveedores como ficha: el mismo
// proveedor salía como dos y su deuda no se juntaba. Ahora una deuda nueva apunta a la ficha (`proveedorId`); si se
// escribe un nombre que ya existe (sin importar acentos ni mayúsculas) se usa esa ficha; y las deudas de antes, que
// sólo traen el texto, se leen como de la ficha que se llama igual. Nada se reescribe.
const nombreLlano = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export const fichaDeProveedor = (nombre, proveedores = []) => (nombreLlano(nombre) ? (proveedores || []).find(p => nombreLlano(p.nombre) === nombreLlano(nombre)) || null : null);
export function esDelProveedor(credito, proveedor) {
  if (!credito || !proveedor) return false;
  if (credito.proveedorId) return credito.proveedorId === proveedor.id;
  return !!nombreLlano(credito.proveedor) && nombreLlano(credito.proveedor) === nombreLlano(proveedor.nombre);
}
export const nombreDelProveedor = (credito, proveedores = []) => (proveedores || []).find(p => p.id === credito?.proveedorId)?.nombre || credito?.proveedor || "";

// UNA MÁQUINA, UNA FICHA. Se podía dar de alta una máquina sin nombre, o la misma dos veces: su diésel, su horómetro y su
// costo real quedaban partidos en dos. El mismo nombre con otras mayúsculas o acentos es la misma máquina.
export function revisarMaquina(form, maquinaria = [], { propioId = null } = {}) {
  const nombre = String(form?.nombre || "").trim().replace(/\s+/g, " ");
  if (!nombre) return { ok: false, dice: "Falta el nombre de la máquina." };
  if ((maquinaria || []).some(m => m.id !== propioId && nombreLlano(m.nombre) === nombreLlano(nombre))) return { ok: false, dice: `Ya hay una máquina que se llama «${nombre}».` };
  const c = Number(form?.costo_hora ?? 0); if (!(c >= 0)) return { ok: false, dice: "El costo por hora es un número (0 si no se cobra por hora)." };
  return { ok: true, nombre };
}
