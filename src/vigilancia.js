// ============================================================
//  AgroGestión — Que el dueño se entere a tiempo
//
//  Tres cosas que el sistema no hacía y que salen directo de para qué existe:
//  control interno en un negocio familiar. No es contabilidad ni es fiscal.
//  Es que no se pierda dinero, que nadie mueva algo sin dejar rastro, y que
//  el dueño se entere A TIEMPO — sin tener que creerle a nadie.
//
//  1. ¿ALCANZA PARA EL SÁBADO?
//     La raya no se aplaza, ni la luz de los pozos. Una palabra: alcanza,
//     falta, o NO SÉ TU SALDO. Y siempre pegado de dónde salió cada saldo y
//     de qué fecha es. Un saldo de hace dos meses sigue siendo mejor que
//     ninguno, pero NO se disfraza de actual.
//
//  2. LO QUE DEJÓ DE APARECER
//     La métrica que importa no es "falló", es "NO APARECIÓ". Una captura que
//     truena se ve. La peligrosa es la que dejó de hacerse y nadie se enteró:
//     el tractor que lleva doce días sin reportar diésel, la parcela que lleva
//     tres semanas sin una sola actividad, la lista que no se pasó.
//
//  3. CONTRA EL MISMO PERIODO DEL AÑO PASADO
//     Un rancho es estacional: en agosto siempre cae. Comparar contra el mes
//     pasado produce alarmas falsas, y las alarmas falsas enseñan a ignorar
//     las alarmas. Se compara agosto contra agosto.
//
//  Nada de esto ordena nada. Informa, y la persona decide.
//
//  Sus pruebas están en src/vigilancia.test.js.
// ============================================================

import { sumarDinero, fechaLocal, diasEntre, mesLocal, fmt } from "./calculos.js";
import { vigentes } from "./eventos.js";

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ 1 · ¿ALCANZA PARA EL SÁBADO? ════════════ */

export const RESPUESTAS = ["alcanza", "falta", "no sé tu saldo"];

// Contesta con una palabra, y con la letra chica pegada: de dónde salió cada
// saldo y de qué fecha es.
//
// Si falta el saldo de alguna bolsa, o el que hay está viejo, **no contesta
// "alcanza"**: contesta que no sabe. Decir que alcanza sobre un saldo que
// nadie miró es exactamente el pecado que este sistema evita.
export function alcanzaPara({ bolsas, compromisos, hoy, diasParaEnvejecer = 15 }) {
  const dia = hoy || fechaLocal();

  // Sin bolsas registradas la respuesta NO es "alcanza": es que no se sabe.
  // Contestar que alcanza sobre cero bolsas es afirmar sobre lo que nadie
  // miró — el pecado exacto que este sistema existe para evitar.
  if (!bolsas || bolsas.length === 0) {
    return {
      respuesta: "no sé tu saldo",
      necesita: sumarDinero((compromisos || []).map(c => c.monto || 0)),
      hay: null, detalle: [], sinSaldo: [], viejos: [],
      dice: "No hay ninguna bolsa registrada, así que no se sabe cuánto dinero hay. Registra las cuentas, tarjetas y efectivos en Socios y bolsas, y sube el estado de cuenta del banco.",
    };
  }
  const detalle = (bolsas || []).map(b => {
    const saldo = num(b.saldo);
    const dias = b.saldoAl ? diasEntre(b.saldoAl, dia) : null;
    return {
      nombre: b.nombre, saldo, saldoAl: b.saldoAl || null, dias,
      sinSaldo: saldo === null,
      viejo: dias !== null && dias > diasParaEnvejecer,
      dice: saldo === null
        ? `De ${b.nombre} no se sabe el saldo.`
        : dias === null ? `${b.nombre}: ${fmt(saldo)}, sin fecha de corte.`
        : dias === 0 ? `${b.nombre}: ${fmt(saldo)}, al día de hoy.`
        : `${b.nombre}: ${fmt(saldo)} al ${b.saldoAl}, hace ${dias} día(s).`,
    };
  });

  const necesita = sumarDinero((compromisos || []).map(c => c.monto || 0));
  const sinSaldo = detalle.filter(d => d.sinSaldo);
  const viejos = detalle.filter(d => d.viejo);
  const hay = sumarDinero(detalle.filter(d => !d.sinSaldo).map(d => d.saldo));

  // No se sabe: falta un saldo, o el que hay está viejo.
  if (sinSaldo.length > 0 || viejos.length > 0) {
    const razones = [];
    if (sinSaldo.length) razones.push(`no se sabe el saldo de ${sinSaldo.map(d => d.nombre).join(", ")}`);
    if (viejos.length) razones.push(`el saldo de ${viejos.map(d => `${d.nombre} es de hace ${d.dias} días`).join(", ")}`);
    return {
      respuesta: "no sé tu saldo",
      necesita, hay, detalle, sinSaldo, viejos,
      dice: `No se puede contestar: ${razones.join(", y ")}. Con lo que sí se sabe habría ${fmt(hay)} contra ${fmt(necesita)} de compromisos, pero eso está incompleto.`,
    };
  }

  const sobra = sumarDinero(hay, -necesita);
  return {
    respuesta: sobra >= 0 ? "alcanza" : "falta",
    necesita, hay, sobra, detalle, sinSaldo: [], viejos: [],
    // Ni una palabra de "no compres". Los números y ya.
    dice: sobra >= 0
      ? `Hay ${fmt(hay)} y se necesitan ${fmt(necesita)}: sobran ${fmt(sobra)}.`
      : `Hay ${fmt(hay)} y se necesitan ${fmt(necesita)}: faltan ${fmt(-sobra)}.`,
  };
}

/* ════════════ 2 · LO QUE DEJÓ DE APARECER ════════════ */

// Cada cosa que se captura de rutina declara cada cuánto DEBERÍA aparecer.
// Esto compara contra la última vez que apareció de verdad.
//
// Una captura que truena se ve sola. La que dejó de hacerse, no — y esa es la
// peligrosa: el tractor que lleva doce días sin reportar diésel puede estar
// descompuesto, prestado, o alguien dejó de anotar.
//
// NO acusa a nadie ni supone por qué. Dice cuántos días lleva sin aparecer.
export function loQueDejoDeAparecer({ rutinas, hoy }) {
  const dia = hoy || fechaLocal();
  const filas = (rutinas || []).map(r => {
    const cada = num(r.cadaDias);
    const ultima = r.ultima || null;
    const dias = ultima ? diasEntre(ultima, dia) : null;
    if (!ultima) {
      return {
        ...r, ultima: null, dias: null, estado: "nunca",
        dice: `${r.que} no se ha capturado nunca.`,
      };
    }
    if (cada === null) {
      return {
        ...r, ultima, dias, estado: "sin ritmo",
        dice: `${r.que}: la última vez fue hace ${dias} día(s). No se ha dicho cada cuánto debería aparecer, así que no se puede saber si va tarde.`,
      };
    }
    if (dias > cada) {
      return {
        ...r, ultima, dias, estado: "no apareció",
        dice: `${r.que} lleva ${dias} días sin aparecer, y debería ser cada ${cada}. Última vez: ${ultima}.`,
      };
    }
    return { ...r, ultima, dias, estado: "al día", dice: `${r.que}: al día (hace ${dias} día(s)).` };
  });

  return {
    filas,
    // Se separan a propósito: "nunca se ha capturado" es un problema de
    // arranque; "dejó de aparecer" es un problema de hoy.
    dejaronDeAparecer: filas.filter(f => f.estado === "no apareció"),
    nunca: filas.filter(f => f.estado === "nunca"),
    sinRitmo: filas.filter(f => f.estado === "sin ritmo"),
    alDia: filas.filter(f => f.estado === "al día"),
  };
}

// Arma las rutinas a partir de los datos que la app ya tiene. Cada una dice
// qué mirar y cada cuánto debería aparecer.
export function rutinasDelRancho({ data, hoy }) {
  const ultima = (lista, campoFecha = "fecha") => {
    const fechas = (lista || []).map(x => x?.[campoFecha]).filter(Boolean).sort();
    return fechas.length ? fechas[fechas.length - 1] : null;
  };
  // La asistencia también se registra con el checador, y el trabajo con el reparto y las cuadrillas (eventos): sólo con el
  // pase de lista y lo tecleado, un rancho que ya checa salía «dejó de aparecer» todos los días — una alarma falsa, y las
  // alarmas falsas enseñan a ignorar las alarmas.
  const marcas = vigentes(data?.eventos || []).filter(e => e.tipo === "marca").map(e => ({ fecha: e.fecha || (e.cuando ? fechaLocal(new Date(e.cuando)) : null) }));
  const rutinas = [
    { clave: "asistencia", que: "La asistencia (pase de lista o checador)", cadaDias: 2, ultima: ultima([...(data?.asistencia || []), ...marcas]) },
    { clave: "actividades", que: "El registro del trabajo de campo", cadaDias: 3, ultima: ultima(data?.actividadesContables || data?.actividades) },
    { clave: "egresos", que: "La captura de gastos", cadaDias: 7, ultima: ultima(data?.egresos) },
    { clave: "cajachica", que: "El movimiento de caja chica", cadaDias: 15, ultima: ultima(data?.cajachica) },
  ];
  // Cada máquina, por su cuenta: el tractor que dejó de reportar es lo que
  // más se nota tarde.
  for (const m of data?.maquinaria || []) {
    const suyas = (data?.actividades || []).filter(a => a.maquinariaId === m.id || a.extras?.maquinaId === m.id);
    rutinas.push({ clave: `maq:${m.id}`, que: `${m.nombre}`, cadaDias: 15, ultima: ultima(suyas) });
  }
  return loQueDejoDeAparecer({ rutinas, hoy });
}

/* ════════════ 3 · CONTRA EL MISMO PERIODO DEL AÑO PASADO ════════════ */

// Un rancho es estacional: en agosto siempre cae. Comparar contra el mes
// pasado produce alarmas falsas, y las alarmas falsas enseñan a ignorar las
// alarmas.
//
// Si no hay datos del año pasado, NO se compara contra el mes anterior como
// premio de consolación: se dice que todavía no hay con qué comparar.
export function contraElAnoPasado({ movimientos, mes, campoMonto = "monto" }) {
  const mesRef = mes || mesLocal();
  const [y, m] = mesRef.split("-");
  const mesAnterior = `${Number(y) - 1}-${m}`;

  const deMes = (mm) => (movimientos || []).filter(x => String(x?.fecha || "").slice(0, 7) === mm);
  const suma = (l) => sumarDinero(l.map(x => x?.[campoMonto] || 0));

  const ahora = deMes(mesRef);
  const antes = deMes(mesAnterior);

  if (antes.length === 0) {
    return {
      mes: mesRef, mesComparado: mesAnterior,
      ahora: suma(ahora), antes: null, diferencia: null, porciento: null,
      hayConQueComparar: false,
      // Nada de comparar contra el mes pasado: en un rancho eso no dice nada.
      dice: `${mesRef}: ${fmt(suma(ahora))}. No hay datos de ${mesAnterior} para comparar. Comparar contra el mes pasado no serviría: en un rancho el trabajo va por temporada, no por calendario.`,
    };
  }

  const a = suma(ahora), b = suma(antes);
  const dif = sumarDinero(a, -b);
  const pct = b !== 0 ? Math.round((dif / Math.abs(b)) * 100) : null;
  return {
    mes: mesRef, mesComparado: mesAnterior,
    ahora: a, antes: b, diferencia: dif, porciento: pct,
    hayConQueComparar: true,
    movimientosAhora: ahora.length, movimientosAntes: antes.length,
    dice: dif === 0
      ? `${mesRef}: ${fmt(a)}, igual que en ${mesAnterior}.`
      : `${mesRef}: ${fmt(a)} contra ${fmt(b)} del mismo mes del año pasado — ${dif > 0 ? "arriba" : "abajo"} ${fmt(Math.abs(dif))}${pct !== null ? ` (${Math.abs(pct)}%)` : ""}.`,
  };
}
