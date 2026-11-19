// ============================================================
//  AgroGestión — La planeación del día, dictada
//
//  A las seis de la mañana Gera reparte el día. No lo reparte llenando un
//  formulario por persona: lo dice de corrido, en una sola bocanada, como se
//  dice de verdad:
//
//    «Hoy Juan y Pedro se van a la 53 a regar, el Chato que ande con el
//     tractor 3 en el Naranjo levantando la basura, y a Ramiro mándalo a la
//     bodega por los sacos de fosfonitrato.»
//
//  De ahí salen TRES tareas, cada una con su quién, su qué, su dónde y su con
//  qué. Y cada quien recibe en su teléfono nada más lo suyo, en palabras que
//  se entienden sin que nadie se las explique.
//
//  Fito manda lo suyo por otro lado: una foto de su hoja de Excel de
//  fertirriego. Esa hoja ya la lee `src/fertiriego.js`; aquí se convierte en
//  una tarea con nombre y apellido, para que no se quede en el grupo de
//  WhatsApp esperando a que alguien se dé por aludido.
//
//  ─────────────────────────────────────────────────────────────
//  LA REGLA DE ESTE MÓDULO
//  ─────────────────────────────────────────────────────────────
//  UNA TAREA SIN PERSONA NO SE MANDA A NADIE NI SE DA POR ASIGNADA.
//
//  Se queda arriba, en `sinAsignar`, hasta que alguien diga de quién es.
//  Repartir mal el día es peor que no repartirlo: si la app le manda a Juan
//  algo que era de Pedro, Juan lo hace, Pedro no hace lo suyo, y para el
//  mediodía hay dos parcelas mal y nadie sabe de dónde salió la instrucción.
//  Una tarea que se queda arriba en rojo se resuelve en diez segundos por
//  teléfono.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · NO manda nada solo. Arma las indicaciones y las PROPONE; Gera las
//    despacha. La app reparte lo que oyó, no lo que supone.
//  · NO adivina a quién le toca. Si dijo "el Chato" y hay dos Chatos, la
//    tarea se queda sin asignar. Mandarle el día al que no era es peor que
//    no mandárselo a nadie.
//  · NO supone por qué alguien quedó sin tarea. Puede ser su día de descanso
//    o puede ser que a Gera se le pasó. Pregunta; no decide.
//  · NO resuelve un choque. Si el tractor 3 quedó con dos personas, lo
//    señala y ahí se detiene. Un tractor no se parte en dos, y elegir cuál
//    de los dos se queda sin él no es cosa de la app.
//  · NO bloquea nada. Una tarea a la que le falta la parcela se manda igual,
//    con lo que falta señalado. Si la app exige que el dictado salga
//    perfecto, el día se reparte por teléfono y la app se queda vacía.
//  · NO confunde "no contestó" con "no lo hizo". Son cosas distintas y se
//    dicen distinto.
//  · NO le manda la tarea a quien no le tocaba, aunque la pantalla lo pida
//    con el id equivocado. La lista de a quién le toca es la de la tarea.
//  · NO lee un "todavía no termino" como "terminó". Cuando el trabajador
//    contesta algo que la app no entiende, lo dice y enseña sus palabras:
//    dar por hecho lo que nadie hizo es la peor mentira que puede decir un
//    tablero.
//  · NO tira lo que oyó de más. Si se nombraron dos máquinas o dos parcelas,
//    van las dos en el encargo y se pide que se diga cuál. Borrar la máquina
//    del recado deja al tractorista parado en la parcela.
//
//  Sus pruebas están en src/plan.test.js.
// ============================================================

import { normalizar } from "./lectura.js";
import { fechaLocal, sumarDias } from "./calculos.js";
import { numeroDicho, aQuienesSeRefiere, deQueParcela, partirEnDichos } from "./voz.js";

// Un dato que falta NO es un cero. Number(null) da 0, y un cero se suma y
// nadie lo vuelve a mirar; un null se pregunta.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

const escapar = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Una firma corta y estable de lo que se dictó. Sirve para que el id de una
// tarea NO dependa nada más del día y del lugar en la lista.
//
// Gera dicta a las 6:10 y vuelve a dictar a la una de la tarde. Si las dos
// tareas se llaman "2026-09-08-1", la confirmación del que contestó primero
// cae en la tarea del otro: se reporta hecha la de la mañana porque contestó
// el de la tarde, y las dos quedan mal. El id tiene que salir de lo que se
// dijo, no de la posición.
function huella(s) {
  let h = 5381;
  const t = String(s == null ? "" : s);
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}

/* ════════════ QUÉ SE VA A HACER ════════════ */

// Las labores del rancho, con las raíces de como las nombra la gente. Son
// RAÍCES a propósito y se buscan con principio de palabra: "\bRIEG" agarra
// riego, riega y rieguen, y NO agarra el "riego" que va dentro de
// "fertirriego" — que es otra faena, con otro producto y otro responsable.
export const LABORES = {
  regar:       ["\\bRIEG", "\\bREGAR", "\\bREGANDO", "\\bAGUA\\b"],
  fertirriego: ["\\bFERTIRRIEG", "\\bFERTIRIEG", "\\bFERTILIZ"],
  barbechar:   ["\\bBARBECH"],
  rastrear:    ["\\bRASTRE", "\\bRASTRA"],
  sembrar:     ["\\bSIEMBR", "\\bSEMBR", "\\bPLANTAR", "\\bPLANTANDO"],
  limpiar:     ["\\bLIMPI", "\\bDESHIERB", "\\bESCARD", "\\bBASURA", "\\bDESHOJ"],
  fumigar:     ["\\bFUMIG", "\\bASPERJ", "\\bAPLICA", "\\bCURAND"],
  cosechar:    ["\\bCOSECH", "\\bCORTAR", "\\bCORTANDO", "\\bARRANC", "\\bPIZC"],
  acarrear:    ["\\bACARRE", "\\bCARGA", "\\bLLEVA", "\\bTRAER", "\\bTRAIGA", "\\bRECOG",
                "\\bMANDAL", "\\bMANDA A", "\\bPOR LOS", "\\bPOR LAS", "\\bDESCARG"],
  componer:    ["\\bCOMPON", "\\bARREGL", "\\bREPAR", "\\bSOLD"],
  corrida:     ["\\bCORRIDA", "\\bCORREDORA", "\\bCALIBR"],
};

// Cómo se dice cada labor en el mensaje que le llega al trabajador. Nada de
// nombres de catálogo: "fertirregar", no "aplicación de fertirriego".
const COMO_SE_DICE = {
  regar: "regar", fertirriego: "fertirregar", barbechar: "barbechar",
  rastrear: "pasar la rastra", sembrar: "sembrar", limpiar: "limpiar",
  fumigar: "fumigar", cosechar: "cortar", acarrear: "ir por material",
  componer: "componer", corrida: "andar en la corrida",
};

const RE_LABOR = new Map();
for (const [labor, senas] of Object.entries(LABORES)) {
  RE_LABOR.set(labor, senas.map(s => new RegExp(s)));
}

// Qué faena es. Si dos empatan NO elige: un "podría ser esto o esto" se
// pregunta; una faena adivinada se ejecuta.
export function queLabor(frase) {
  const t = normalizar(frase);
  const puntos = [...RE_LABOR.entries()]
    .map(([que, res]) => ({ que, n: res.filter(r => r.test(t)).length }))
    .sort((a, b) => b.n - a.n);

  if (!puntos[0] || puntos[0].n === 0) {
    return { que: null, queDice: null, posibles: [], porque: "No se entendió qué se va a hacer." };
  }
  if (puntos[1] && puntos[1].n === puntos[0].n) {
    return {
      que: null, queDice: null, posibles: [puntos[0].que, puntos[1].que],
      porque: `Podría ser ${puntos[0].que} o ${puntos[1].que}. Dilo tú; mientras tanto se manda lo que dijiste, tal cual.`,
    };
  }
  return {
    que: puntos[0].que, queDice: COMO_SE_DICE[puntos[0].que], posibles: [],
    porque: `Suena a ${puntos[0].que}.`,
  };
}

/* ════════════ CON QUÉ MÁQUINA ════════════ */

// Igual que `deQueParcela`: si nombró dos máquinas no elige, las devuelve las
// dos. El nombre se busca completo, así que "tractor 3" no casa dentro de
// "tractor 30" — mandar al tractorista a la máquina equivocada es un día
// perdido y un horómetro que ya no cuadra con nada.
export function queMaquinas(frase, maquinaria) {
  const t = normalizar(frase);
  const halladas = (maquinaria || []).filter(m => {
    const n = normalizar(m?.nombre || "");
    if (n.length < 3) return false;
    return new RegExp("(^|[^A-Z0-9])" + escapar(n) + "([^A-Z0-9]|$)").test(t);
  });
  return {
    maquinas: halladas,
    seguro: halladas.length === 1,
    porque: halladas.length === 0 ? "No se nombró ninguna máquina del catálogo."
      : halladas.length === 1 ? `Se entendió: ${halladas[0].nombre}.`
      : `Se nombraron varias: ${halladas.map(m => m.nombre).join(", ")}. Dinos cuál.`,
  };
}

/* ════════════ A QUÉ HORA ════════════ */

// "a las siete", "desde las 6:30", "a la una de la tarde".
//
// Pide LAS en plural a propósito (con "a la una" como único caso aparte). Sin
// eso, «se van a la 53 a regar» se leía como «a la 5, 3 de la tarde» y salía
// una hora que nadie dijo. Y una hora inventada manda a la cuadrilla al campo
// antes de que llegue el agua.
const RE_DE_LA_TARDE = /\b(?:DE|POR|EN)\s+LA\s+(?:TARDE|NOCHE)\b|\bPM\b/;
const doble = (n) => String(n).padStart(2, "0");

// De un pedazo de frase saca UNA hora. `segmento` es lo que se dijo pegado a
// esa hora y nada más — hasta donde empieza la hora siguiente.
//
// Buscar "de la tarde" en TODA la frase es lo que convertía «a las siete de
// la mañana y a las cuatro de la tarde» en las siete de la NOCHE: la tarde de
// la segunda hora le caía encima a la primera, y al trabajador le llegaba una
// cita doce horas después de la que le dijeron.
function unaHora(resto, segmento) {
  let h = null, min = 0;
  const reloj = resto.match(/^(\d{1,2}):(\d{2})/);
  if (reloj) {
    h = num(reloj[1]);
    min = num(reloj[2]) ?? 0;
  } else {
    // Dos palabras nada más: "SIETE DE (la mañana)", "6 EN (la 51)". Más allá
    // empiezan a colarse números que son de otra cosa, y un número de más es
    // una hora inventada.
    h = numeroDicho(resto.split(/\s+/).slice(0, 2).join(" "));
    if (/\bY MEDIA\b/.test(resto)) min = 30;
    else if (/\bY CUARTO\b/.test(resto)) min = 15;
  }
  if (h === null || h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (RE_DE_LA_TARDE.test(segmento) && h < 12) h += 12;
  return `${doble(h)}:${doble(min)}`;
}

// TODAS las horas que se dijeron, en el orden en que se dijeron. Dos son dos
// de verdad: «a las siete de la mañana y a las cuatro de la tarde» son dos
// vueltas de riego, no un error de dictado. Quedarse con la primera y tirar
// la segunda en silencio es perder media instrucción.
export function horasDichas(frase) {
  const t = normalizar(frase);
  // Se marca dónde empieza cada "a las …" y se lee el pedazo que le toca a
  // cada una, sin invadir el de la siguiente.
  const marca = /\b(?:A|DESDE|PARA|HASTA)\s+(LAS|LA)\s+/g;
  const marcas = [];
  let m;
  while ((m = marca.exec(t)) !== null) {
    marcas.push({ i: m.index, tras: m.index + m[0].length, plural: m[1] === "LAS" });
  }

  const horas = [];
  for (let k = 0; k < marcas.length; k++) {
    const fin = marcas[k + 1] ? marcas[k + 1].i : t.length;
    const resto = t.slice(marcas[k].tras, Math.min(fin, marcas[k].tras + 30)).trim();
    // "a la 53" NO es una hora; "a la una" sí. Es el único singular que pasa.
    if (!marcas[k].plural && !/^UNA\b/.test(resto)) continue;
    const h = unaHora(resto, t.slice(marcas[k].i, fin));
    if (h && !horas.includes(h)) horas.push(h);
  }
  return horas;
}

// La hora, cuando se dijo UNA. Si se dijeron dos, aquí no sale ninguna: no
// hay forma de elegir cuál sin inventar. Las dos viven en `horasDichas` y las
// dos van en el recado.
export function horaDicha(frase) {
  const horas = horasDichas(frase);
  return horas.length === 1 ? horas[0] : null;
}

/* ════════════ PARA QUÉ DÍA ════════════ */

// "mañana" mueve el día; "de la mañana" es una hora y NO lo mueve. Sin
// acentos las dos se ven igual, y confundirlas manda la tarea al día
// siguiente: la gente llega y no hay quién le abra la bodega. Y de pilón la
// tarea desaparece del seguimiento de hoy, que es donde alguien la habría
// echado de menos.
//
// No es sólo "de la mañana": la gente dice "por la mañana", "en la mañana" y
// "esta mañana", y las tres son HOY. Se le quitan todas a la frase y lo que
// quede diciendo "mañana" sí es el día siguiente — incluido "mañana temprano"
// y "mañana por la mañana", que de verdad lo son.
const RE_HORA_DEL_DIA = /\b(?:DE|POR|EN)\s+LA\s+MANANA\b|\bESTA\s+MANANA\b/g;

export function paraQueDia(frase, hoy) {
  const dia = hoy || fechaLocal();
  const t = normalizar(frase);
  if (/\bPASADO MANANA\b/.test(t)) return sumarDias(dia, 2);
  if (/\bMANANA\b/.test(t.replace(RE_HORA_DEL_DIA, " "))) return sumarDias(dia, 1);
  return dia;
}

function comoSeLlamaElDia(fecha, dia) {
  if (fecha === dia) return "Hoy";
  if (fecha === sumarDias(dia, 1)) return "Mañana";
  if (fecha === sumarDias(dia, 2)) return "Pasado mañana";
  return fecha;
}

/* ════════════ A QUIÉN NOMBRÓ ════════════ */

// En la nómina de verdad el apodo NO viene en un campo aparte: viene dentro
// del nombre y entre paréntesis, como lo capturó quien hizo la nómina —
// "NOMBRE APELLIDO (APODO)", "NOMBRE APELLIDO (APODO)".
//
// Y Gera nombra a la gente por el apodo, siempre. Sin esto, "el Zurdo se va a
// la 53" no reconocía a nadie: la última palabra del nombre era "(ZURDO)" con
// paréntesis y nunca casaba. El dictado entero se iba a la columna roja.
export function conElApodoAparte(personas) {
  return (personas || []).map(p => {
    const dentro = String(p?.nombre || "").match(/\(([^)]+)\)/);
    if (!dentro) return p;
    const limpio = String(p.nombre).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    return { ...p, nombre: limpio || p.nombre, apodo: p.apodo || dentro[1].trim() };
  });
}

// Le quita a la frase los nombres de parcela ANTES de buscar personas.
//
// El rancho tiene parcelas que se llaman como la gente: "SAN FELIPE 1",
// "MARCOS", "RANCHO NARANJO". Sin esto, "Juan se va a San Felipe 1 a regar"
// le manda también el día a Felipe, que no estaba ni en la conversación, y
// nada en la pantalla dice que ahí pasó algo raro. Un día de trabajo que
// nadie dio es peor que uno sin asignar: el sin asignar se ve en rojo y se
// arregla por teléfono en diez segundos.
//
// Cuesta lo suyo: si de verdad hay un trabajador que se llama como una
// parcela, esa tarea se va a quedar sin asignar. Se prefiere así — la app
// pregunta en vez de mandarle el día al que no era.
function sinLosNombresDeParcela(frase, parcelas) {
  let t = normalizar(frase);
  for (const p of parcelas || []) {
    const n = normalizar(p?.nombre || "");
    if (n.length < 2) continue;
    t = t.replace(new RegExp("(^|[^A-Z0-9])" + escapar(n) + "([^A-Z0-9]|$)", "g"), "$1 $2");
  }
  return t;
}

// A quiénes nombró, con el apodo de la nómina real y sin confundir a nadie
// con el nombre de una parcela. Devuelve a las personas TAL COMO vienen de la
// lista, no las copias con las que se buscó: el id y lo demás son los suyos.
export function quienesDijo(frase, personas, parcelas) {
  const lista = personas || [];
  const hallazgo = aQuienesSeRefiere(sinLosNombresDeParcela(frase, parcelas), conElApodoAparte(lista));
  const original = (p) => lista.find(x => x.id != null && x.id === p.id) || p;
  return {
    personas: hallazgo.personas.map(original),
    ambiguos: hallazgo.ambiguos.map(a => ({ ...a, candidatos: a.candidatos.map(original) })),
    porque: hallazgo.porque,
  };
}

/* ════════════ PARTIR LO DICHO EN TAREAS ════════════ */

// Una coma o una "y" separan tareas... casi siempre. "Juan y Pedro" NO son
// dos tareas: son la cuadrilla de una. Por eso un pedazo que nombra gente
// pero no dice ninguna faena se pega al pedazo que sigue, que es donde viene
// el verbo. Partirlo ahí daría dos tareas: una para Juan sin qué hacer, y
// Pedro se iría solo a regar once hectáreas.
const SEPARADORES = /\s*[,;]\s+|\s+y\s+|\s+e\s+/i;

export function partirEnTareas(texto, personas, parcelas) {
  const juntas = [];
  for (const dicho of partirEnDichos(texto)) {
    const pedazos = String(dicho).split(SEPARADORES)
      .map(p => p.replace(/^(?:y|e)\s+/i, "").trim())
      .filter(p => p.length > 1);

    let pendiente = null;
    for (const p of pedazos) {
      const hayFaena = !!queLabor(p).que;
      const quienes = quienesDijo(p, personas, parcelas);
      const hayGente = quienes.personas.length > 0 || quienes.ambiguos.length > 0;

      if (!hayFaena && hayGente) {
        // Nombres esperando su verbo.
        pendiente = pendiente ? `${pendiente} y ${p}` : p;
        continue;
      }
      if (!hayFaena && !hayGente) {
        // Cola de la tarea anterior ("en el Naranjo", "con el tractor 3").
        if (pendiente) pendiente = `${pendiente} ${p}`;
        else if (juntas.length) juntas[juntas.length - 1] += ` ${p}`;
        else juntas.push(p);
        continue;
      }
      juntas.push(pendiente ? `${pendiente} y ${p}` : p);
      pendiente = null;
    }
    // Se dijeron nombres y nunca llegó el verbo. No se tira: se queda como
    // tarea sin qué, para que alguien diga qué era.
    if (pendiente) juntas.push(pendiente);
  }
  return juntas;
}

/* ════════════ REPARTIR EL DÍA ════════════ */

function lugarDe(tarea) {
  if (tarea.parcela) {
    return (tarea.que === "acarrear" ? "a " : "la parcela ") + tarea.parcela.nombre;
  }
  if ((tarea.parcelas || []).length > 1) {
    return `en ${tarea.parcelas.map(p => p.nombre).join(" y ")}`;
  }
  return null;
}

// La máquina va en el recado SIEMPRE que se nombró, aunque se hayan nombrado
// dos. Guardarla sólo cuando hay una y callar cuando hay dos borra el tractor
// del encargo y deja el recado con cara de completo: el Chato llega al
// Naranjo a levantar la basura y no sabe con qué máquina. Se dicen las dos y
// se pide que alguien diga cuál.
function conQueDe(tarea) {
  if (tarea.maquina) return `con el ${tarea.maquina.nombre}`;
  const varias = tarea.maquinas || [];
  if (varias.length > 1) return `con el ${varias.map(m => m.nombre).join(" o el ")} (dinos con cuál)`;
  return null;
}

// Las horas, todas las que se dijeron. Si fueron dos vueltas, las dos van.
function cuandoDe(tarea) {
  const horas = (tarea.horas && tarea.horas.length) ? tarea.horas : (tarea.hora ? [tarea.hora] : []);
  return horas.length === 0 ? null : `a las ${horas.join(" y a las ")}`;
}

function armarTarea({ frase, id, dia, personas, parcelas, maquinaria, deQuien, dichoALas }) {
  const quienes = quienesDijo(frase, personas, parcelas);
  const donde = deQueParcela(frase, parcelas);
  const conQue = queMaquinas(frase, maquinaria);
  const labor = queLabor(frase);
  const fecha = paraQueDia(frase, dia);
  const horas = horasDichas(frase);

  // Dos encargos que se oyeron pegados. "Juan que se vaya a la 53 y Pedro al
  // Naranjo a regar" no es una tarea de dos personas en dos parcelas: son dos
  // encargos, uno de cada quien. La app no los sabe separar sin adivinar
  // quién va a dónde, así que los deja juntos y lo DICE. Callarlo manda a los
  // dos a los dos lados.
  const revueltos = quienes.personas.length > 1 && donde.parcelas.length > 1;

  const falta = [];
  if (quienes.personas.length === 0) {
    falta.push(quienes.ambiguos.length > 0 ? "cuál de los que se llaman así es" : "a quién le toca");
  }
  if (!labor.que) falta.push("qué se va a hacer");
  if (donde.parcelas.length === 0) falta.push("en qué parcela");
  // Se nombraron varias: no falta el dato, falta saber cuál era. Se señala
  // igual, porque un encargo con dos lugares o dos máquinas está tan a medias
  // como uno sin ninguno.
  if (donde.parcelas.length > 1) falta.push(revueltos ? "en cuál parcela va cada quien" : "en cuál de las parcelas");
  if (conQue.maquinas.length > 1) falta.push("con cuál máquina");

  const tarea = {
    id,
    frase,
    personas: quienes.personas,
    ambiguos: quienes.ambiguos,
    que: labor.que,
    queDice: labor.queDice,
    posibles: labor.posibles,
    parcela: donde.parcelas.length === 1 ? donde.parcelas[0] : null,
    parcelas: donde.parcelas,
    maquina: conQue.maquinas.length === 1 ? conQue.maquinas[0] : null,
    maquinas: conQue.maquinas,
    // `hora` es la hora cuando se dijo UNA. Con dos queda en null a propósito
    // — elegir una de las dos sería inventar — y las dos viven en `horas`.
    hora: horas.length === 1 ? horas[0] : null,
    horas,
    fecha,
    cuandoDicho: comoSeLlamaElDia(fecha, dia),
    deQuien: deQuien || null,
    dichoALas: dichoALas || null,
    detalle: null,
    productos: [],
    falta,
    revueltos,
    asignada: quienes.personas.length > 0,
    porque: [
      quienes.personas.length > 0
        ? `Le toca a ${quienes.personas.map(p => p.nombre).join(" y ")}.`
        : quienes.ambiguos.length > 0
          ? `Se dijo un nombre que tienen varios y no se sabe cuál es. Esta tarea NO se manda hasta que lo digas: mandarle el día al que no era es peor que no mandárselo a nadie.`
          : "No se dijo a quién le toca. No se manda a nadie hasta que lo digas.",
      revueltos
        ? `Se oyeron ${quienes.personas.length} personas y ${donde.parcelas.length} parcelas en el mismo encargo: puede que de verdad sean dos encargos distintos. Revísalo antes de mandarlo, porque así se le manda a los dos que vayan a los dos lados.`
        : null,
      conQue.maquinas.length > 1
        ? `Se nombraron ${conQue.maquinas.length} máquinas (${conQue.maquinas.map(m => m.nombre).join(", ")}). Van todas en el recado hasta que digas cuál: borrarlas deja al tractorista parado en la parcela.`
        : null,
    ].filter(Boolean).join(" "),
  };

  tarea.dice = [
    `${tarea.cuandoDicho}:`,
    labor.queDice || `(no se entendió qué) «${frase}»`,
    lugarDe(tarea),
    conQueDe(tarea),
    cuandoDe(tarea),
    "—",
    tarea.asignada ? tarea.personas.map(p => p.nombre).join(", ") : "SIN ASIGNAR",
  ].filter(Boolean).join(" ");

  return tarea;
}

// Parte lo que Gera dictó y arma las tareas que PROPONE. Lo que no se supo de
// quién es sale aparte, en `sinAsignar`, y no se manda a nadie.
export function repartirElDia({ texto, personas, parcelas, maquinaria, hoy, deQuien, dichoALas, dictadoId } = {}) {
  const dia = hoy || fechaLocal();
  const frases = partirEnTareas(texto, personas, parcelas);
  // El id lleva la firma del dictado, no nada más el día y el lugar en la
  // lista. Gera dicta a las 6:10 y otra vez a la una: si las dos tareas se
  // llaman igual, la confirmación de una cae en la otra y se reporta hecho lo
  // que nadie hizo. Además, dos dictados del mismo día tienen que poder
  // guardarse juntos sin pisarse.
  const marca = dictadoId ? String(dictadoId) : huella(`${dichoALas || ""}|${texto || ""}`);
  const todas = frases.map((frase, i) => armarTarea({
    frase, id: `${dia}-${marca}-${i + 1}`, dia, personas, parcelas, maquinaria, deQuien, dichoALas,
  }));

  const tareas = todas.filter(t => t.asignada);
  const sinAsignar = todas.filter(t => !t.asignada);
  const incompletas = tareas.filter(t => t.falta.length > 0);

  return {
    fecha: dia,
    todas,
    // Sólo las que tienen a quién. Lo demás NO se da por asignado.
    tareas,
    // Aparte y muy visible: es lo primero que hay que resolver del día.
    sinAsignar,
    incompletas,
    // Nada se guarda ni se manda solo. Queda escrito para que nadie lo cambie
    // sin darse cuenta.
    guardaSolo: false,
    mandaSolo: false,
    // Y nada bloquea: una tarea a la que le falta la parcela se manda igual.
    bloquea: false,
    dice: todas.length === 0
      ? "No se entendió ninguna tarea de lo que se dijo. Se guarda el audio para que no se pierda."
      : [
          `Se entendieron ${todas.length} tarea(s): ${tareas.length} con a quién le toca` +
            (sinAsignar.length > 0 ? ` y ${sinAsignar.length} sin a quién.` : "."),
          sinAsignar.length > 0
            ? "Las que no tienen a quién NO se mandan a nadie: repartir mal el día es peor que no repartirlo. Dinos de quién son."
            : null,
          incompletas.length > 0
            ? `A ${incompletas.length} le falta algo (${[...new Set(incompletas.flatMap(t => t.falta))].join(", ")}), pero se pueden mandar igual.`
            : null,
        ].filter(Boolean).join(" "),
  };
}

/* ════════════ LA INDICACIÓN QUE LE LLEGA AL TELÉFONO ════════════ */

function textoPara(tarea, persona) {
  const companeros = (tarea.personas || [])
    .filter(p => p.id !== persona.id)
    .map(p => p.nombre);

  // Cuando no se entendió la faena, se le mandan a la persona las palabras
  // tal como se dijeron. La app no entendió; Gera sí se explicó, y el que va
  // a hacer el trabajo conoce el rancho mejor que la app.
  const cuerpo = tarea.queDice
    ? [
        tarea.queDice,
        lugarDe(tarea),
        conQueDe(tarea),
        cuandoDe(tarea),
      ].filter(Boolean).join(" ")
    : `lo que se dijo fue «${String(tarea.frase || "").trim()}»`;

  const conDetalle = tarea.detalle ? `${cuerpo}: ${tarea.detalle}` : cuerpo;
  const conQuien = companeros.length > 0 ? `${conDetalle} con ${companeros.join(" y ")}` : conDetalle;
  const firma = tarea.deQuien
    ? (tarea.dichoALas ? ` Dijo ${tarea.deQuien} a las ${tarea.dichoALas}.` : ` Dijo ${tarea.deQuien}.`)
    : "";

  return `${tarea.cuandoDicho || "Hoy"}: ${conQuien}.${firma}`;
}

// El texto corto que le va a llegar al teléfono. Sin ids, sin nombres de
// pantalla, sin jerga: el que lo lee trae las manos llenas de tierra.
//
// Con `persona` arma el de esa persona; sin ella, el de cada quien.
//
// Y esa persona TIENE que estar en la tarea. Ésta es la única puerta por
// donde sale un recado: si abre para cualquiera, basta un id equivocado en la
// pantalla para que a Aurelio le llegue el día de Juan. Todo el cuidado de no
// mandar una tarea sin dueño no sirve de nada si aquí se le manda al que no
// era.
export function indicacionParaElTrabajador(tarea, persona) {
  const gente = tarea?.personas || [];
  if (gente.length === 0) {
    return {
      mandable: false, mandaSolo: false, mensajes: [], texto: null, para: null, paraId: null,
      porque: "Esta tarea no tiene a quién mandársele. Una tarea sin persona no se manda a nadie: se queda arriba hasta que alguien diga de quién es.",
    };
  }
  if (persona && !gente.some(p => p.id === persona.id)) {
    return {
      mandable: false, mandaSolo: false, mensajes: [], texto: null, para: null, paraId: null,
      porque: `Esta tarea no es de ${persona.nombre || "esa persona"}: le toca a ${gente.map(p => p.nombre).join(" y ")}. No se le manda a quien no le tocaba.`,
    };
  }
  const aQuienes = persona ? [persona] : gente;
  const mensajes = aQuienes.map(p => ({ paraId: p.id, para: p.nombre, texto: textoPara(tarea, p) }));
  return {
    mandable: true,
    // La arma; no la manda. La despacha una persona.
    mandaSolo: false,
    mensajes,
    texto: mensajes[0].texto,
    para: mensajes[0].para,
    paraId: mensajes[0].paraId,
    porque: `Se le manda a ${aQuienes.map(p => p.nombre).join(" y ")}.`,
  };
}

/* ════════════ A QUÉ SE VA CADA QUIEN ════════════ */

// El día volteado del revés: por persona, lo suyo y nada más. Es la vista que
// abre el trabajador en su teléfono, y por eso no trae lo de los demás.
export function aQueSeVaCadaQuien(tareas) {
  const porPersona = new Map();
  for (const t of tareas || []) {
    for (const p of t.personas || []) {
      if (!porPersona.has(p.id)) {
        porPersona.set(p.id, { personaId: p.id, nombre: p.nombre, tareas: [], mensajes: [] });
      }
      const fila = porPersona.get(p.id);
      fila.tareas.push(t);
      fila.mensajes.push(indicacionParaElTrabajador(t, p).texto);
    }
  }

  return [...porPersona.values()]
    .map(f => ({
      ...f,
      cuantas: f.tareas.length,
      dice: f.tareas.length === 1
        ? `${f.nombre}, una cosa: ${f.mensajes[0]}`
        : `${f.nombre}, ${f.tareas.length} cosas: ${f.mensajes.join(" ")}`,
    }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

/* ════════════ QUIÉN QUEDÓ SIN NADA ════════════ */

// A veces está bien (es su descanso) y a veces se le pasó a Gera. La app no
// tiene forma de saber cuál de las dos, así que PREGUNTA.
export function quienNoTieneNada({ tareas, personas } = {}) {
  const gente = personas || [];
  if (gente.length === 0) {
    // Sin lista de gente la respuesta NO es "todos tienen tarea": es que no
    // se sabe. Afirmar sobre una lista vacía es afirmar sobre lo que nadie
    // miró.
    return {
      sabe: false, sinTarea: [], conTarea: [], suponeElMotivo: false,
      pregunta: "No hay lista de gente, así que no se puede saber quién quedó sin nada. Registra a los trabajadores en Equipo.",
    };
  }

  const conTarea = new Set();
  for (const t of tareas || []) for (const p of t.personas || []) conTarea.add(p.id);

  const sinTarea = gente.filter(p => !conTarea.has(p.id)).map(p => ({
    id: p.id, nombre: p.nombre,
    pregunta: `${p.nombre} no tiene nada asignado. ¿Descansa, anda en otra cosa, o se te pasó?`,
  }));

  return {
    sabe: true,
    sinTarea,
    conTarea: [...conTarea],
    // No supone el motivo. Nunca dice "descansa".
    suponeElMotivo: false,
    pregunta: sinTarea.length === 0
      ? `Todos (${gente.length}) tienen algo asignado.`
      : `Quedaron sin nada: ${sinTarea.map(p => p.nombre).join(", ")}. ¿Descansan, andan en otra cosa, o se te pasaron?`,
  };
}

/* ════════════ LO QUE CHOCA ════════════ */

// Una persona no se parte en dos, y un tractor tampoco.
//
// Un choque NO se resuelve solo: elegir cuál de los dos se queda con el
// tractor no es cosa de la app. Se señala y ahí se detiene.
//
// Y lo que no se sabe va aparte: dos tareas del mismo día en parcelas
// distintas SIN hora no son un choque — puede regar en la mañana y limpiar en
// la tarde. Decir "chocan" sin saber la hora sería afirmar sobre lo que nadie
// miró, y las alarmas falsas enseñan a ignorar las alarmas.
//
// La máquina se mide con la misma vara que la persona: se mira la HORA. Que
// el tractor 3 ande en la 53 temprano y en el Naranjo en la tarde es el día
// normal del rancho, no un choque.
export function chocanLasTareas(tareas) {
  const lista = tareas || [];
  const choques = [];
  const porRevisar = [];

  const porPersona = new Map();
  for (const t of lista) {
    for (const p of t.personas || []) {
      if (!porPersona.has(p.id)) porPersona.set(p.id, { persona: p, suyas: [] });
      porPersona.get(p.id).suyas.push(t);
    }
  }

  for (const { persona, suyas } of porPersona.values()) {
    for (let i = 0; i < suyas.length; i++) {
      for (let j = i + 1; j < suyas.length; j++) {
        const a = suyas[i], b = suyas[j];
        if (a.fecha !== b.fecha) continue;
        const mismoLugar = (a.parcela?.id ?? null) === (b.parcela?.id ?? null);

        if (a.hora && b.hora && a.hora === b.hora) {
          choques.push({
            tipo: "persona", persona, tareas: [a, b], hora: a.hora,
            dice: `${persona.nombre} quedó en dos tareas a las ${a.hora} del ${a.fecha}` +
              (mismoLugar ? "" : `: una en ${a.parcela?.nombre || "un lugar que no se dijo"} y otra en ${b.parcela?.nombre || "un lugar que no se dijo"}`) +
              ". Una persona no se parte en dos: dinos cuál de las dos es.",
          });
          continue;
        }
        if ((!a.hora || !b.hora) && a.parcela && b.parcela && !mismoLugar) {
          porRevisar.push({
            tipo: "persona sin hora", persona, tareas: [a, b],
            dice: `${persona.nombre} tiene dos tareas el ${a.fecha}, en ${a.parcela.nombre} y en ${b.parcela.nombre}. ` +
              "No se dijo la hora de al menos una, así que NO se sabe si chocan: puede que le dé tiempo a las dos.",
          });
        }
      }
    }
  }

  const porMaquina = new Map();
  for (const t of lista) {
    if (!t.maquina) continue;
    const llave = `${t.maquina.id}|${t.fecha}`;
    if (!porMaquina.has(llave)) porMaquina.set(llave, { maquina: t.maquina, fecha: t.fecha, suyas: [] });
    porMaquina.get(llave).suyas.push(t);
  }
  // Con la máquina se mira la HORA, igual que con las personas.
  //
  // Que el tractor 3 ande en la 53 en la mañana y en el Naranjo en la tarde
  // no es un choque: es el día normal del rancho. Gritar "choque" cada vez
  // que un tractor trabaja dos veces es enseñarle a Gera a ignorar el aviso,
  // y el día que de verdad se empalmen ya nadie lo va a leer.
  for (const { maquina, fecha, suyas } of porMaquina.values()) {
    for (let i = 0; i < suyas.length; i++) {
      for (let j = i + 1; j < suyas.length; j++) {
        const a = suyas[i], b = suyas[j];
        const gente = [...a.personas || [], ...b.personas || []];
        const ids = new Set(gente.map(p => p.id));
        if (ids.size < 2) continue;
        const nombres = [...new Set(gente.map(p => p.nombre))];

        if (a.hora && b.hora && a.hora === b.hora) {
          choques.push({
            tipo: "maquina", maquina, fecha, tareas: [a, b], hora: a.hora,
            dice: `El ${maquina.nombre} quedó con ${nombres.join(" y ")} a las ${a.hora} del ${fecha}. ` +
              "Un tractor no se parte en dos: dinos con cuál de los dos se queda.",
          });
          continue;
        }
        if (!a.hora || !b.hora) {
          porRevisar.push({
            tipo: "maquina sin hora", maquina, fecha, tareas: [a, b],
            dice: `El ${maquina.nombre} quedó con ${nombres.join(" y ")} el ${fecha}. ` +
              "No se dijo la hora de al menos una, así que NO se sabe si se empalman: puede que uno lo use en la mañana y el otro en la tarde.",
          });
        }
      }
    }
  }

  return {
    choques,
    porRevisar,
    hay: choques.length > 0,
    // Se señala; no se arregla solo, y no impide mandar el día.
    resuelveSolo: false,
    bloquea: false,
    dice: lista.length === 0
      ? "No hay tareas que revisar."
      : choques.length === 0 && porRevisar.length === 0
        ? "Nadie quedó en dos lados a la misma hora y ninguna máquina quedó con dos personas."
        : [
            choques.length > 0 ? `${choques.length} choque(s). ${choques.map(c => c.dice).join(" ")}` : null,
            porRevisar.length > 0 ? `${porRevisar.length} por revisar: falta la hora para saber si de verdad chocan.` : null,
          ].filter(Boolean).join(" "),
  };
}

/* ════════════ CÓMO VA EL DÍA ════════════ */

// Lo que puede contestar UNA persona de UNA tarea.
export const ESTADOS_CONFIRMACION = ["sin contestar", "vista", "sin entender", "confirmada", "hecha", "no puede"];
// Y cómo queda la tarea completa, con todos los que van en ella.
export const ESTADOS_TAREA = ["sin contestar", "por leer", "a medias", "confirmada", "hecha", "no puede"];

// El trabajador contesta con la boca o con el pulgar, y contesta lo que se le
// da la gana: "ya quedó", "todavía no termino", "se me ponchó la llanta".
//
// Aquí se mira PRIMERO si dijo que no. Buscar "TERMIN" antes que "NO PUED"
// convertía «no puedo terminar, se descompuso la bomba» en HECHA: el que dijo
// que estaba parado quedaba reportado como cumplido y el problema no le
// llegaba a nadie en todo el día.
//
// Y lo que la app no entiende NO se da por bueno. Antes cualquier cosa fuera
// de la lista caía en "vista" y el renglón se reportaba confirmada, así que
// un problema reportado se leía como un sí. Ahora se dice "no se entendió" y
// se enseñan las palabras del trabajador para que una persona las lea. Nos
// cuesta que un "ya quedó, no hubo problema" también caiga ahí por el "no" —
// se prefiere: que lo lea alguien es barato, dar por hecho lo que nadie hizo
// no.
const RE_NO_PUEDE = /\bNO PUED|\bNO PUD|\bNO VOY\b|\bNO IRE\b|\bNO ALCANC|RECHAZ|\bNO SE PUDO\b/;
const RE_NIEGA = /\bNO\b|\bNI\b|\bNUNCA\b|\bTAMPOCO\b|\bNEL\b/;
const RE_HECHA = /HECH|TERMIN|\bLISTO\b|\bLISTA\b|\bYA QUEDO\b|\bYA SALIO\b/;
const RE_CONFIRMA = /CONFIRM|\bVOY\b|\bVAMOS\b|\bENTERADO\b|\bORALE\b|\bSALE\b|\bOK\b|\bSI\b/;
const RE_VISTA = /\bVISTA\b|\bVISTO\b|\bLEIDO\b/;

function estadoLimpio(e) {
  const t = normalizar(e);
  if (!t) return "sin contestar";
  if (RE_NO_PUEDE.test(t)) return "no puede";
  const niega = RE_NIEGA.test(t);
  if (!niega && RE_HECHA.test(t)) return "hecha";
  if (!niega && RE_CONFIRMA.test(t)) return "confirmada";
  if (!niega && RE_VISTA.test(t)) return "vista";
  return "sin entender";
}

// Qué se confirmó, qué se hizo y qué no contestó nadie. Sin esto la planeación
// es un deseo: se dictó, se mandó, y nadie sabe si llegó.
//
// "Sin contestar" NO quiere decir "no se hizo". Quiere decir que no se sabe —
// en el Naranjo no hay señal. Se dicen distinto porque son cosas distintas, y
// tratar el silencio como incumplimiento es la forma más rápida de que la
// gente deje de contestar.
export function comoVaElDia({ tareas, confirmaciones, hoy } = {}) {
  const dia = hoy || fechaLocal();
  const delDia = (tareas || []).filter(t => !t.fecha || t.fecha === dia);
  const dichas = confirmaciones || [];

  if (delDia.length === 0) {
    return {
      fecha: dia, total: 0, filas: [], hechas: [], confirmadas: [], sinContestar: [],
      noPueden: [], aMedias: [], porLeer: [], sueltas: [],
      // Un avance sobre cero tareas es una mentira redonda: no hay de dónde.
      avance: null,
      dice: "No hay tareas repartidas para hoy, así que no hay nada que seguir. Eso NO quiere decir que nadie esté trabajando: quiere decir que el día no se repartió en la app.",
    };
  }

  const idsConocidos = new Set(delDia.map(t => t.id));
  const sueltas = dichas.filter(c => !idsConocidos.has(c.tareaId));

  const filas = delDia.map(t => {
    const suyas = dichas.filter(c => c.tareaId === t.id);
    const porPersona = (t.personas || []).map(p => {
      const deElla = suyas
        .filter(c => c.personaId === p.id)
        .sort((a, b) => String(a.cuando || "").localeCompare(String(b.cuando || "")));
      const ult = deElla[deElla.length - 1] || null;
      return {
        personaId: p.id, nombre: p.nombre,
        estado: ult ? estadoLimpio(ult.estado) : "sin contestar",
        // Sus palabras, tal como llegaron. Cuando la app no las entiende, es
        // lo único que sirve: lo lee una persona y se acabó la duda.
        dijo: ult?.estado ?? null,
        cuando: ult?.cuando || null,
        nota: ult?.nota || null,
      };
    });

    const estados = porPersona.map(x => x.estado);
    const dudosos = porPersona.filter(x => x.estado === "sin entender");
    let estado;
    if (estados.includes("no puede")) estado = "no puede";
    // Contestó algo que la app no entendió. NO se cuenta como confirmada: una
    // respuesta que nadie entendió no es un sí.
    else if (dudosos.length > 0) estado = "por leer";
    else if (estados.length > 0 && estados.every(e => e === "hecha")) estado = "hecha";
    else if (estados.length === 0 || estados.every(e => e === "sin contestar")) estado = "sin contestar";
    else if (estados.every(e => e === "hecha" || e === "confirmada")) estado = "confirmada";
    else estado = "a medias";

    // "Vista" es que la abrió, no que contestó. Sigue faltando su respuesta.
    const callan = porPersona.filter(x => x.estado === "sin contestar" || x.estado === "vista").map(x => x.nombre);
    return {
      tarea: t, estado, porPersona,
      dice: estado === "hecha" ? `${t.dice} — hecha.`
        : estado === "no puede" ? `${t.dice} — ${porPersona.filter(x => x.estado === "no puede").map(x => x.nombre).join(", ")} dice que no puede. Eso hay que resolverlo.`
        : estado === "por leer" ? `${t.dice} — ${dudosos.map(x => `${x.nombre} contestó «${String(x.dijo).trim()}»`).join("; ")}. No se entendió si está hecha o no: léelo tú.`
        : estado === "sin contestar" ? `${t.dice} — nadie ha contestado. No se sabe si se hizo o no; puede que no haya señal.`
        : estado === "confirmada" ? `${t.dice} — confirmada, todavía sin reportar hecha.`
        : `${t.dice} — falta que conteste ${callan.join(", ")}.`,
    };
  });

  const de = (e) => filas.filter(f => f.estado === e);
  const hechas = de("hecha");

  const porLeer = de("por leer");

  return {
    fecha: dia,
    total: filas.length,
    filas,
    hechas,
    confirmadas: de("confirmada"),
    sinContestar: de("sin contestar"),
    noPueden: de("no puede"),
    aMedias: de("a medias"),
    porLeer,
    sueltas,
    avance: hechas.length / filas.length,
    dice: `De ${filas.length} tarea(s): ${hechas.length} hecha(s), ${de("confirmada").length} confirmada(s), ` +
      `${de("a medias").length} a medias, ${de("sin contestar").length} sin contestar y ${de("no puede").length} con problema. ` +
      "Sin contestar NO quiere decir que no se hizo: quiere decir que no se sabe." +
      (porLeer.length > 0 ? ` ${porLeer.length} contestó algo que no se entendió: hay que leerlo, no se da por hecho.` : "") +
      (sueltas.length > 0 ? ` Llegaron ${sueltas.length} respuesta(s) de tareas que no son de hoy.` : ""),
  };
}

/* ════════════ LA HOJA DE FITO SE VUELVE TAREA ════════════ */

const riegaEstaParcela = (persona, parcelaId, parcelaNombre) => {
  const suyas = persona?.riega || persona?.parcelas || [];
  const nombre = normalizar(parcelaNombre || "");
  return (Array.isArray(suyas) ? suyas : [suyas]).some(x => {
    if (x == null) return false;
    if (parcelaId && String(x) === String(parcelaId)) return true;
    return !!nombre && normalizar(String(x)) === nombre;
  });
};

const esRegador = (persona) => /RIEG|REGADOR|AGUAD/.test(normalizar(
  [persona?.categoria, persona?.puesto, persona?.oficio].filter(Boolean).join(" ")
));

// Toma la indicación que sale de `indicacionDesdeHoja` (src/fertiriego.js) y
// la vuelve una tarea con nombre y apellido.
//
// Si no se sabe quién riega esa parcela, la tarea se queda SIN ASIGNAR y se
// enseñan los regadores como candidatos. NO se le manda al único regador que
// haya "porque ha de ser él": el que riega la 53 y el que riega el Naranjo
// pueden ser distintos, y una aplicación de fertilizante que le llega al que
// no era se hace tarde, o no se hace.
export function deLaHojaDeFito({ indicacion, personas, parcelas, hoy } = {}) {
  const dia = hoy || fechaLocal();
  const ind = indicacion || {};
  const fecha = ind.fecha || dia;

  const parcela = ind.parcelaId
    ? (parcelas || []).find(p => p.id === ind.parcelaId) || null
    : null;
  const nombreParcela = parcela?.nombre || ind.parcelaNombre || null;

  const productos = ind.productos || [];
  const detalle = productos.length === 0 ? null : productos.map(p => (
    (p.total ?? 0) > 0
      ? `${p.nombre} ${p.total} ${p.unidad || ""}`.trim()
      // El total en cero no es "no se aplica": es una celda que Fito no
      // llenó. Se manda la dosis y se dice qué falta.
      : `${p.nombre} ${p.dosis ?? "?"} por ha (falta el total)`
  )).join(", ");

  const suyos = (personas || []).filter(p => riegaEstaParcela(p, ind.parcelaId, nombreParcela));
  const candidatos = suyos.length > 0 ? suyos : (personas || []).filter(esRegador);
  const asignados = suyos.length === 1 ? suyos : [];

  const falta = [];
  if (asignados.length === 0) falta.push("a quién le toca");
  if (!parcela) falta.push("en qué parcela");

  // El id lleva la firma de la hoja, no nada más el día y la parcela. Fito
  // manda dos hojas de la 53 el mismo día —una corregida— y con el mismo id
  // la confirmación de una cae en la otra.
  const dondeDice = normalizar(nombreParcela || "sin parcela").replace(/\s+/g, "-");
  const marca = ind.hojaId ? String(ind.hojaId) : huella(`${ind.resumen || ""}|${JSON.stringify(productos)}`);

  const tarea = {
    id: `fito-${fecha}-${dondeDice}-${marca}`,
    frase: ind.resumen || "",
    personas: asignados,
    ambiguos: [],
    que: "fertirriego",
    queDice: COMO_SE_DICE.fertirriego,
    posibles: [],
    parcela,
    parcelas: parcela ? [parcela] : [],
    maquina: null,
    maquinas: [],
    hora: null,
    horas: [],
    fecha,
    cuandoDicho: comoSeLlamaElDia(fecha, dia),
    deQuien: ind.deQuien || "Fito",
    dichoALas: null,
    detalle,
    productos,
    falta,
    asignada: asignados.length > 0,
    porque: asignados.length === 1
      ? `${asignados[0].nombre} es quien riega ${nombreParcela}.`
      : suyos.length > 1
        ? `Hay ${suyos.length} personas registradas para regar ${nombreParcela}. Dinos cuál: esta tarea no se manda hasta entonces.`
        : !parcela
          ? `La hoja dice "${ind.parcelaNombre || "(sin parcela)"}" y esa parcela no está en el catálogo, así que no se sabe quién la riega.`
          : `No hay nadie registrado como el que riega ${nombreParcela}.`,
  };

  tarea.dice = [
    `${tarea.cuandoDicho}:`,
    tarea.queDice,
    lugarDe(tarea),
    detalle ? `— ${detalle}` : null,
    "—",
    tarea.asignada ? tarea.personas.map(p => p.nombre).join(", ") : "SIN ASIGNAR",
  ].filter(Boolean).join(" ");

  return {
    tarea,
    asignada: tarea.asignada,
    candidatos,
    // Se propone; la manda una persona.
    mandaSolo: false,
    bloquea: false,
    dice: tarea.asignada
      ? `La hoja de Fito para ${nombreParcela} queda para ${tarea.personas.map(p => p.nombre).join(", ")}. Falta que la mandes.`
      : `${tarea.porque} Mientras tanto la tarea se queda arriba, sin mandarse a nadie.` +
        (candidatos.length > 0
          ? ` Los que riegan son: ${candidatos.map(p => p.nombre).join(", ")}. Dinos cuál.`
          : " No hay nadie registrado como regador; regístralo en Equipo."),
  };
}
