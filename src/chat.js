// ============================================================
//  AgroGestión — El chat de adentro de la app
//
//  Hoy el rancho se coordina por WhatsApp. Ahí caben las fotos, los audios y
//  los recados, y ahí también se pierden: la hoja de fertirriego que Fito
//  mandó el martes queda cuarenta mensajes más arriba, la necesidad del
//  filtro nadie la levantó porque le llegó a los ocho del grupo, y el gasto
//  del diésel se capturó dos veces porque nadie supo si ya lo habían metido.
//
//  Este chat vive DENTRO de la app para cerrar ese hueco. Fito y Gera mandan
//  lo de siempre —texto, foto, audio—, el sistema entiende qué es cada cosa,
//  propone el movimiento que le corresponde, y una persona lo confirma con un
//  toque. Nada más.
//
//  ─────────────────────────────────────────────────────────────
//  CÓMO SE ENTIENDE CADA MENSAJE (de gratis a caro, como siempre)
//  ─────────────────────────────────────────────────────────────
//  1. El TEXTO (escrito, o la transcripción que el teléfono ya hizo del
//     audio) pasa por `entenderLoDicho` de voz.js. Ese clasificador ya
//     existe y ya está probado: aquí NO se vuelve a escribir.
//  2. La FOTO de una hoja de fertirriego, cuando ya viene pasada a renglones,
//     pasa por `leerFertiriego` de fertiriego.js — gratis, sin señal, y con
//     la multiplicación que valida la tabla sola.
//  3. La FOTO de un papel (ticket, factura, etiqueta) llega aquí YA LEÍDA por
//     el lector de papeles. Este archivo es lógica pura: no toca la cámara ni
//     la red. Sacar el texto de una foto cuesta y se hace afuera.
//  4. Y si nada de eso alcanzó: **por identificar**. El mensaje NO se tira —
//     se queda completo, con su foto y su audio, esperando que una persona
//     diga qué es. Es la misma regla del buzón de papeles.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE DECIDE
//  ─────────────────────────────────────────────────────────────
//  · Qué es cada mensaje y qué movimientos PROPONE.
//  · A quién le toca cada cosa — y cuando no se sabe, lo dice y lo deja sin
//    asignar. Mandarle una indicación a todos es que no la haga nadie.
//  · Qué lleva rato colgado esperando un sí, y cuánto rato.
//  · Cuándo la FOTO y el TEXTO del mismo mensaje pueden estar diciendo lo
//    mismo. Gera manda el ticket y además escribe qué fue: de ahí salen dos
//    gastos del mismo importe, que es exactamente el gasto capturado dos
//    veces que este chat vino a evitar. No los junta ni tira uno —eso lo
//    hace una persona, que puede saber que sí fueron dos compras—: los
//    señala, y el mensaje deja de decir que está seguro.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · NO guarda nada solo. Todo movimiento pasa por la confirmación de una
//    persona, con su nombre. Es lo mismo que ya hace el dictado por voz: un
//    mensaje sin confirmar NUNCA cuenta como movimiento, ni en los totales
//    ni en el resumen del día.
//  · NO bloquea nada. Avisa, y la persona decide.
//  · NO tira lo que no entendió, ni lo convierte en cero.
//  · NO vuelve a clasificar un mensaje que una persona ya firmó. Rehacerlo
//    borraría quién confirmó y cuándo —y ese gasto se podría registrar una
//    segunda vez—, en un sistema donde nada de dinero se borra.
//  · NO da por buena una hoja a la que le faltaron renglones, aunque lo poco
//    que se leyó multiplique exacto; ni un estado de cuenta que todavía no
//    cuadra renglón por renglón, aunque traiga sus tres saldos.
//  · NO MANDA NADA FUERA DE LA APP. No hay integración con WhatsApp ni con
//    ningún otro servicio: lo que se escribe aquí se queda aquí. Está puesto
//    como `saleDeLaApp: false` para que nadie lo cambie sin darse cuenta.
//
//  ─────────────────────────────────────────────────────────────
//  CÓMO SE VE UN MENSAJE
//  ─────────────────────────────────────────────────────────────
//    {
//      id: "msj12",
//      de: { id: "t7", nombre: "Fito", rol: "agronomo" },
//      cuando: "2026-09-08T22:14:00.000Z",     // marca de tiempo en UTC
//      texto: "...",                            // escrito, o lo transcrito
//      audio: { dataUrl, segundos } | null,
//      foto:  { dataUrl, renglones?, lectura? } | null,
//    }
//
//  `foto.renglones` es la hoja ya pasada a renglones (el camino gratis) y
//  `foto.lectura` es lo que devolvió el lector de papeles. Si la foto no
//  trae ninguno de los dos, todavía no se ha leído — y eso se DICE, no se
//  adivina.
//
//  Sus pruebas están en src/chat.test.js.
// ============================================================

import { fechaLocal, sumarDinero, fmt } from "./calculos.js";
import { entenderLoDicho } from "./voz.js";
import { leerFertiriego, validarFertiriego, indicacionDesdeHoja } from "./fertiriego.js";

// Un dato que falta NO es un cero. Number(null) da 0, y ese cero se suma, se
// promedia y nadie lo vuelve a mirar. Aquí lo que no se sabe sale null.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ EL DÍA DE UN MENSAJE ════════════ */

// Zacatecas va seis horas atrás de UTC. Un mensaje de las diez y media de la
// noche tiene una marca de tiempo que en UTC ya es del día siguiente, y si el
// hilo se agrupara por esa marca, lo que Gera mandó el lunes en la noche
// aparecería el martes. Por eso el día sale de `fechaLocal`, nunca de
// `toISOString()`.
//
// Y un "2026-09-08" pelón YA es un día local: pasarlo por `new Date()` lo
// leería como medianoche UTC y en el rancho retrocedería al día anterior.
export function diaDe(cuando) {
  if (!cuando) return null;
  const s = String(cuando);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : fechaLocal(d);
}

// Horas entre dos marcas de tiempo. Una duración sí se puede sacar en UTC:
// no depende de en qué día caiga. Devuelve null cuando falta alguna — que no
// es lo mismo que cero horas.
function horasEntre(a, b) {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round(((db - da) / 3600000) * 10) / 10;
}

const enHoras = (h) => {
  if (h === null) return "no se sabe desde cuándo";
  if (h < 1) return "menos de una hora";
  if (h < 24) return `${Math.round(h)} hora(s)`;
  const d = Math.floor(h / 24);
  return `${d} día(s)`;
};

/* ════════════ EL ORIGEN: DE DÓNDE SALIÓ CADA MOVIMIENTO ════════════ */

// Todo movimiento que salga del chat se lleva pegado de dónde salió: qué
// mensaje, quién lo mandó, a qué hora, y la foto o el audio ORIGINALES.
//
// Por qué pegado y no en una lista aparte: es la misma razón por la que
// `lectura.aplicado` vive dentro del propio registro. Dos listas se
// desincronizan, y el día que alguien pregunte "¿y este gasto de dónde
// salió?" —seis meses después, en un cierre— la respuesta tiene que estar en
// el mismo renglón, no en otra tabla que a lo mejor ya no cuadra.
export function origenDe(mensaje) {
  const m = mensaje || {};
  const falta = [];
  const dia = diaDe(m.cuando);
  if (!m.id) falta.push("cuál mensaje fue");
  if (!m.de || (!m.de.id && !m.de.nombre)) falta.push("quién lo mandó");
  // TRAER hora y traer una hora QUE SE ENTIENDA son dos cosas distintas, y se
  // dicen distinto — igual que "nunca se capturó" va aparte de "dejó de
  // aparecer". Antes bastaba con que el campo no estuviera vacío: con un
  // "ayer en la tarde" adentro, el origen se daba por completo y la pantalla
  // acababa enseñándole "Lo mandó Gera el null" a un capataz.
  if (!m.cuando) falta.push("a qué hora llegó");
  else if (!dia) falta.push(`de qué día es (dice "${String(m.cuando)}", y eso no se entiende como fecha)`);

  return {
    mensajeId: m.id || null,
    deId: m.de?.id || null,
    de: m.de?.nombre || m.de?.id || null,
    rolDeQuienMando: m.de?.rol || null,
    // La marca de tiempo TAL COMO LLEGÓ, aunque no se entienda: nunca se
    // pierde lo que la persona escribió, ni siquiera cuando no sirve.
    cuando: m.cuando || null,
    cuandoSeEntiende: dia !== null,
    dia,
    texto: m.texto || "",
    // La foto y el audio ORIGINALES, tal como llegaron. Nunca se pierde
    // evidencia: es la misma regla de la foto borrosa del ticket.
    foto: m.foto?.dataUrl || null,
    audio: m.audio?.dataUrl || null,
    completo: falta.length === 0,
    falta,
    dice: falta.length === 0
      ? `Lo mandó ${m.de?.nombre || m.de?.id} el ${dia}.`
      : `De este mensaje no se sabe ${falta.join(", ni ")}. Un movimiento sin su origen no se puede aclarar después: revísalo antes de confirmarlo.`,
  };
}

/* ════════════ QUÉ ES CADA MENSAJE ════════════ */

// Los tipos que el chat puede proponer. "nota" es lo que no se entendió, y
// no es un movimiento: es un recado que se queda en el hilo.
export const TIPOS_MENSAJE = [
  "actividad", "gasto", "necesidad", "incidencia", "cosecha",
  "fertirriego", "horometro", "etiqueta", "estado_cuenta", "nota",
];

export const CONFIANZAS = ["alta", "media", "por identificar"];

// Cómo se traduce lo que el lector de papeles devolvió a un movimiento del
// chat. Sólo lo que ya sabe leer; lo demás cae en "por identificar", que es
// una respuesta honesta y se resuelve en diez segundos.
const PAPEL_A_MOVIMIENTO = {
  ticket: "gasto", factura: "gasto", remision: "gasto",
  horometro: "horometro", etiqueta_agroquimico: "etiqueta",
  estado_cuenta: "estado_cuenta",
};

// Nombres de campo como los diría una persona, para que la pantalla pida lo
// que falta con palabras y no con la etiqueta interna.
const EN_PALABRAS = {
  emisor: "de qué proveedor es", rfc: "el RFC del proveedor",
  fecha: "de qué fecha es", total: "cuánto costó", uuid: "el folio fiscal",
  lectura: "cuánto marcó el horómetro", nombre: "cómo se llama el producto",
  ingredienteActivo: "el ingrediente activo", reentradaDias: "a los cuántos días se puede entrar",
  carenciaDias: "a los cuántos días se puede cortar", banco: "de qué banco es",
  saldoInicial: "el saldo inicial", saldoFinal: "el saldo final",
};
const enPalabras = (campo) => EN_PALABRAS[campo] || campo;

/* ════════════ EL MISMO MOVIMIENTO, CAPTURADO DOS VECES ════════════ */

// El hueco que este chat vino a cerrar es el del gasto del diésel capturado
// dos veces. Y la forma más fácil de volver a abrirlo es la más común de
// todas: Gera manda la FOTO del ticket y en el mismo mensaje ESCRIBE qué fue.
// De ahí salían dos gastos, del mismo importe y del mismo día, los dos
// declarados con confianza "alta"; si alguien confirmaba los dos, el día
// cerraba con $7,600 por una compra de $3,800.
//
// Esto NO los junta ni tira uno: los señala y dice en qué se parecen. La app
// informa, la persona manda — puede que de verdad sean dos compras, y ella lo
// sabe y el sistema no.
//
// Sólo se cruza la FOTO contra lo DICHO. Dos gastos que salieron del mismo
// texto son dos frases distintas —"se compró diésel" y "se pagó la comida"— y
// marcarlos sería una alarma falsa, que es justo lo que enseña a ignorar las
// alarmas.
const ladoDe = (p) => (p?.deQue === "foto" ? "foto" : "dicho");

export function posiblesDuplicados(propuestas, { mismoMensaje = false } = {}) {
  const movs = (propuestas || []).filter(p => p && p.tipo !== "nota");
  const pares = [];

  for (let i = 0; i < movs.length; i++) {
    for (let j = i + 1; j < movs.length; j++) {
      const a = movs[i], b = movs[j];
      if (a.tipo !== b.tipo) continue;
      if (ladoDe(a) === ladoDe(b)) continue;
      // Fuera del propio mensaje hay que exigir que sean del MISMO mensaje.
      // Dos gastos de dos mensajes distintos son dos gastos, y decir lo
      // contrario sería inventar una coincidencia.
      if (!mismoMensaje) {
        const ma = a.origen?.mensajeId || null, mb = b.origen?.mensajeId || null;
        if (!ma || !mb || ma !== mb) continue;
      }

      const foto = ladoDe(a) === "foto" ? a : b;
      const dicho = foto === a ? b : a;
      const mf = num(foto.monto), md = num(dicho.monto);

      let dice;
      if (a.tipo !== "gasto") {
        dice = `Del mismo mensaje salieron dos ${a.tipo}: uno de la foto y otro de lo que se escribió. ` +
          `Puede que sea el mismo, capturado dos veces: revísalo antes de confirmar los dos.`;
      } else if (mf !== null && md !== null && Math.abs(mf - md) < 0.005) {
        dice = `La foto y lo que se escribió en el mismo mensaje sacaron dos gastos del mismo importe (${fmt(mf)}). ` +
          `Lo más probable es que sea UNO solo capturado dos veces: confirma el que sirva y rechaza el otro con su motivo.`;
      } else if (mf !== null && md !== null) {
        dice = `Del mismo mensaje salieron dos gastos: la foto dice ${fmt(mf)} y lo que se escribió dice ${fmt(md)}. ` +
          `Puede que sea el mismo con un número mal leído, o que de verdad sean dos compras. Revísalo antes de confirmar los dos.`;
      } else {
        dice = `Del mismo mensaje salieron dos gastos, uno de la foto y otro de lo que se escribió, y de al menos uno ` +
          `no se leyó el importe, así que no se pueden comparar. Puede que sea el mismo capturado dos veces: revísalo antes de confirmar los dos.`;
      }

      pares.push({ a, b, ids: [a.id || null, b.id || null], tipo: a.tipo, dice });
    }
  }
  return pares;
}

// Toma un mensaje del chat y dice QUÉ ES y qué movimientos propone.
//
// No guarda nada, no manda nada y no bloquea nada: devuelve el mismo mensaje
// con sus propuestas colgadas, para que una persona las confirme una por una.
export function clasificarMensaje({ mensaje, personas, parcelas, insumos, hoy } = {}) {
  const m = mensaje || {};
  // El día del PROPIO mensaje manda; `hoy` es el último recurso, para el que
  // llegó sin hora. Al revés —como estaba— un mensaje del viernes revisado el
  // martes salía fechado el martes, y el ticket cuya fecha no se leyó quedaba
  // con el día en que alguien lo abrió: tres días de corrimiento en un archivo
  // que se cuida de no inventarle una fecha a nada.
  const dia = diaDe(m.cuando) || hoy || fechaLocal();
  const origen = origenDe(m);

  // ── Lo que ya se clasificó y alguien FIRMÓ no se vuelve a clasificar.
  //
  // La pantalla reclasifica un mensaje guardado sin pensarlo, y antes eso
  // reconstruía las propuestas desde cero con `confirmacion: null`: se perdía
  // quién firmó y cuándo, el mensaje volvía a la fila de pendientes, y ese
  // mismo gasto se podía confirmar —y registrar— una segunda vez. En un
  // archivo cuya regla es que nada de dinero se borra, la firma se borraba
  // sola. Aquí se devuelve tal cual está, con lo que ya tiene.
  if (yaLoFirmaron(m)) return comoYaEstaba(m, origen);

  const propuestas = [];
  // Por qué el sistema hizo lo que hizo, paso por paso. Un resultado sin
  // explicación sólo se puede obedecer o ignorar.
  const pasos = [];

  /* ── La foto: primero la hoja de Fito, que es gratis y se valida sola ── */
  if (m.foto?.renglones) {
    const hoja = leerFertiriego(m.foto.renglones);
    if (hoja.ok) {
      const val = validarFertiriego(hoja);
      const ind = indicacionDesdeHoja({ hoja, parcelas, hoy: dia });
      const avisos = val.avisos || [];
      const falta = [];
      if (!ind.parcelaReconocida) falta.push("de qué parcela es");
      if (!origen.de) falta.push("quién la mandó");
      pasos.push({ paso: "fertiriego", dice: [val.porque, ...avisos].join(" ") });
      propuestas.push({
        id: `${m.id || "msj"}:hoja`,
        tipo: "fertirriego",
        deQue: "foto",
        // Una hoja que no cuadra al kilo NO se da por buena. No se rechaza
        // sola —eso lo hace una persona—, pero llega marcada y con el
        // renglón malo señalado, para que nadie la confirme de corrida.
        confiable: val.confiable,
        renglonMalo: val.renglonMalo,
        // Y una hoja a la que le faltan ocho de los once fertilizantes
        // TAMPOCO es una hoja segura, aunque lo poco que se leyó multiplique
        // exacto. Los avisos ya existían pero no tocaban el veredicto: una
        // foto cortada —lo más común del mundo— se iba en "alta" con el 70%
        // de la hoja sin leer. Cuadrar tres renglones no dice nada de los
        // ocho que nadie vio.
        seguro: val.confiable && ind.parcelaReconocida && !!origen.de && avisos.length === 0,
        indicacion: {
          ...ind,
          // `indicacionDesdeHoja` deja "Fito" quemado: es su suposición, no un
          // dato leído de la hoja. Aquí se sabe QUIÉN mandó el mensaje, y una
          // indicación de fertirriego es la que manda a alguien a echar
          // producto en una parcela: se dice de quién llegó de verdad.
          deQuien: origen.de || null,
          loQueSuponiaLaHoja: ind.deQuien || null,
        },
        parcelaId: ind.parcelaId,
        fecha: ind.fecha,
        falta,
        avisos,
        porque: [val.confiable ? `Es una hoja de fertirriego. ${val.porque}` : val.porque, ...avisos].join(" "),
        // El resumen es lo que va a leer el que riega. Si la hoja pudo salir
        // cortada, eso viaja pegado al resumen: mandarlo limpio sería decirle
        // que la indicación son tres productos cuando pudieron ser once.
        resumen: avisos.length === 0 ? ind.resumen : `${ind.resumen} — OJO: ${avisos.join(" ")}`,
        origen,
        confirmacion: null,
      });
    } else {
      pasos.push({ paso: "fertiriego", dice: hoja.porque });
    }
  }

  /* ── La foto de un papel, ya leída por el lector ── */
  if (m.foto?.lectura) {
    const l = m.foto.lectura;
    const tipo = PAPEL_A_MOVIMIENTO[l.tipo] || null;
    if (l.ok && tipo) {
      const c = l.campos || {};
      const falta = (l.noSeLeyo || []).map(enPalabras);
      const p = {
        id: `${m.id || "msj"}:papel`,
        tipo, deQue: "foto",
        fecha: c.fecha || dia,
        campos: c,
        // Los renglones que el lector SÍ devolvió viajan pegados. Antes se
        // quedaban en el camino y en silencio: quedaba un estado de cuenta
        // declarado seguro sobre el que ya nadie podía correr la comprobación
        // renglón por renglón, porque los movimientos ya no estaban.
        renglones: l.renglones || [],
        falta,
        porque: `Se leyó un papel de tipo ${l.tipo}${l.fuente ? ` (${l.fuente})` : ""}.`,
        origen,
        confirmacion: null,
      };
      if (tipo === "gasto") {
        // El total sale del papel o NO SALE. Un gasto sin monto se pregunta;
        // un gasto en cero se guarda y nadie lo vuelve a mirar.
        p.monto = num(c.total);
        p.proveedor = c.emisor || null;
        if (p.monto === null && !falta.includes("cuánto costó")) falta.push("cuánto costó");
      }
      if (tipo === "horometro") {
        p.lectura = num(c.lectura);
        if (p.lectura === null && !falta.includes("cuánto marcó el horómetro")) falta.push("cuánto marcó el horómetro");
      }
      if (tipo === "estado_cuenta") {
        // Un estado de cuenta NO se da por bueno con tres saldos. Lo que lo
        // hace confiable es la aritmética renglón por renglón —saldo anterior
        // + abono − cargo = saldo del renglón—, y esa comprobación se hace al
        // cargarlo, no aquí. Así que de este chat NUNCA sale "seguro": sale
        // con sus renglones y con el aviso de que le falta cuadrar.
        p.porComprobar = true;
        if (p.renglones.length === 0) falta.push("los movimientos renglón por renglón");
        p.porque += p.renglones.length === 0
          ? " El papel no trajo los renglones, sólo los saldos: sin los movimientos no hay con qué comprobarlo, y sin comprobarlo no alimenta ningún reporte."
          : ` Trae ${p.renglones.length} renglón(es). Todavía le falta cuadrar (saldo anterior + abono − cargo = saldo del renglón): hasta que cuadre no alimenta ningún reporte.`;
      }
      // Se calcula al final, cuando ya se sabe todo lo que faltó.
      p.seguro = falta.length === 0 && !p.porComprobar;
      pasos.push({ paso: "papel", dice: p.porque });
      propuestas.push(p);
    } else {
      pasos.push({
        paso: "papel",
        dice: l.dice || "El papel se leyó pero no se reconoció de qué es. Queda por identificar.",
      });
    }
  }

  /* ── La foto que todavía nadie ha leído ── */
  if (m.foto && !m.foto.renglones && !m.foto.lectura) {
    pasos.push({
      paso: "foto",
      dice: "Llegó una foto que todavía no se ha leído. Se guarda tal cual; ábrela para leerla o captura los datos a mano.",
    });
  }

  /* ── El texto (escrito, o lo que el teléfono transcribió del audio) ── */
  const texto = String(m.texto || "").trim();
  if (texto) {
    const entendido = entenderLoDicho({ texto, personas, parcelas, insumos, hoy: dia });
    pasos.push({ paso: "texto", dice: entendido.resumen });
    for (const p of entendido.propuestas) {
      propuestas.push({
        ...p,
        id: `${m.id || "msj"}:${p.i}`,
        deQue: m.audio ? "audio" : "texto",
        // voz.js devuelve las parcelas que reconoció; si nombró dos, no
        // elige — y aquí tampoco, por eso el id se queda en null.
        parcelaId: (p.parcelas || []).length === 1 ? p.parcelas[0].id : null,
        origen,
        confirmacion: null,
      });
    }
  }

  /* ── ¿La foto y el texto están diciendo LO MISMO? ── */
  //
  // Nadie cruzaba la foto del papel con el texto del mismo mensaje, y de ahí
  // salían dos gastos iguales declarados "alta". No se juntan ni se tira uno:
  // se marcan los dos, cada uno apuntando al otro, y el mensaje deja de decir
  // que está seguro.
  const pares = posiblesDuplicados(propuestas, { mismoMensaje: true });
  for (const par of pares) {
    for (const [uno, otro] of [[par.a, par.b], [par.b, par.a]]) {
      uno.posibleDuplicadoDe = [...new Set([...(uno.posibleDuplicadoDe || []), otro.id])];
      uno.avisoDuplicado = par.dice;
    }
  }
  if (pares.length > 0) pasos.push({ paso: "duplicado", dice: pares.map(p => p.dice).join(" ") });

  /* ── Y si nada alcanzó, el mensaje NO se tira ── */
  const movimientos = propuestas.filter(p => p.tipo !== "nota");
  const confianza = movimientos.length === 0
    ? "por identificar"
    : movimientos.every(p =>
        p.seguro &&
        (p.falta || []).length === 0 &&
        (p.ambiguos || []).length === 0 &&
        (p.posibleDuplicadoDe || []).length === 0)
      ? "alta"
      : "media";

  return {
    ...m,
    propuestas,
    movimientos,
    confianza,
    posiblesDuplicados: pares,
    origen,
    pasos,
    // El mensaje completo se queda SIEMPRE, con su foto y su audio, se haya
    // entendido o no.
    seGuarda: true,
    porIdentificar: confianza === "por identificar",
    // NADA se guarda solo, NADA bloquea, y NADA sale de la app. Están aquí
    // explícitos para que ningún cambio futuro los pise sin darse cuenta.
    guardaSolo: false,
    bloquea: false,
    saleDeLaApp: false,
    porque: confianza === "por identificar"
      ? (m.foto || m.audio
        ? "No se entendió qué es. El mensaje se queda completo, con su foto o su audio, marcado como por identificar: una persona lo resuelve en diez segundos."
        : "No se entendió qué es. El mensaje se queda tal cual, marcado como por identificar.")
      : `Se entendieron ${movimientos.length} movimiento(s): ${movimientos.map(p => p.tipo).join(", ")}.` +
        (pares.length > 0 ? ` ${pares.map(p => p.dice).join(" ")}` : "") +
        (confianza === "media" && pares.length === 0 ? " Falta completar algo antes de confirmarlos." : ""),
  };
}

// ¿Alguien ya firmó algo de este mensaje? Cuenta la firma de cualquiera de sus
// propuestas y también la del propio mensaje, que es como se cierra a mano el
// que "no era nada".
function yaLoFirmaron(mensaje) {
  const m = mensaje || {};
  if ((m.propuestas || []).some(p => confirmacionDe(p).firmada)) return true;
  return confirmacionDe(m).firmada;
}

// Devuelve el mensaje con lo que YA tiene, sin volver a clasificar nada. Se
// recalculan sólo los campos que se derivan de las propuestas; las propuestas
// —con su confirmación, su motivo y su `comoLlego`— se quedan intactas.
function comoYaEstaba(mensaje, origen) {
  const m = mensaje || {};
  const propuestas = m.propuestas || [];
  const movimientos = propuestas.filter(p => p.tipo !== "nota");
  const est = estadoDeConfirmacion(m);
  const pares = posiblesDuplicados(propuestas, { mismoMensaje: true });

  return {
    ...m,
    propuestas,
    movimientos,
    // Si el mensaje ya traía su veredicto, se respeta. Y si no lo traía, no se
    // inventa uno "alto": lo que ya pasó por manos de una persona se queda en
    // lo que esa persona decidió.
    confianza: m.confianza || (movimientos.length === 0 ? "por identificar" : "media"),
    posiblesDuplicados: pares,
    origen: m.origen || origen,
    pasos: [
      ...(m.pasos || []),
      {
        paso: "ya firmado",
        dice: "Este mensaje ya lo revisó una persona, así que no se vuelve a clasificar: rehacerlo borraría quién firmó y cuándo.",
      },
    ],
    seGuarda: true,
    yaClasificado: true,
    porIdentificar: est.porIdentificar,
    guardaSolo: false,
    bloquea: false,
    saleDeLaApp: false,
    porque: `Este mensaje ya lo revisó una persona (${est.dice}) Se deja como está: volver a clasificarlo ` +
      `borraría quién firmó y cuándo, y ese movimiento se podría registrar una segunda vez.`,
  };
}

/* ════════════ A QUIÉN LE TOCA ════════════ */

// Quién atiende cada cosa. Se puede cambiar desde afuera pasando `roles`.
//
// `porParcela` quiere decir que le toca a quien trabaja ESA parcela, no a
// quien tenga tal puesto: una indicación de riego para la 53 la ejecuta el
// que riega la 53, y mandársela al encargado general no la riega.
export const ROL_QUE_ATIENDE = {
  fertirriego: { porParcela: true, roles: [], porque: "una indicación de fertirriego la ejecuta quien atiende esa parcela" },
  necesidad: { roles: ["finanzas", "admin"], porque: "una necesidad la resuelve quien compra" },
  gasto: { roles: ["admin", "finanzas"], porque: "un gasto lo revisa quien lleva las cuentas" },
  estado_cuenta: { roles: ["admin", "finanzas"], porque: "un estado de cuenta lo concilia quien lleva las cuentas" },
  incidencia: { roles: ["encargado", "admin"], porque: "una descompostura la atiende el encargado" },
  actividad: { roles: ["encargado", "admin"], porque: "el registro de campo lo revisa el encargado" },
  cosecha: { roles: ["encargado", "admin"], porque: "la cosecha la revisa el encargado" },
  horometro: { roles: ["encargado", "admin"], porque: "el horómetro lo revisa el encargado" },
  etiqueta: { roles: ["agronomo", "admin"], porque: "la ficha de un agroquímico la revisa el agrónomo" },
  nota: { roles: [], porque: "una nota no es una indicación para nadie en particular" },
};

const parcelasDe = (persona) => {
  const l = persona?.parcelas || persona?.parcelaIds || [];
  return (Array.isArray(l) ? l : [l]).map(x => (x && x.id) || x).filter(Boolean);
};

// A quién se le manda una propuesta.
//
// Y la regla que manda aquí: si NO se sabe a quién le toca, se dice y se
// deja SIN ASIGNAR. Mandarle una indicación a todo el grupo es exactamente
// lo que hoy pasa en WhatsApp, y el resultado conocido es que no la hace
// nadie porque cada quien supone que la va a hacer otro.
export function aQuienLeToca({ propuesta, personas, roles } = {}) {
  const p = propuesta || {};
  const tipo = p.tipo || "nota";
  const regla = { ...(ROL_QUE_ATIENDE[tipo] || ROL_QUE_ATIENDE.nota), ...((roles || {})[tipo] || {}) };
  const gente = (personas || []).filter(x => x && x.id);
  const vacio = { paraQuien: null, candidatos: [], sinAsignar: true, porRol: null, bloquea: false };

  // Una nota no le toca a nadie, y eso NO es un problema por resolver: es a
  // propósito. Va aparte de "no se supo a quién", igual que "nunca se
  // capturó" va aparte de "dejó de aparecer".
  if ((regla.roles || []).length === 0 && !regla.porParcela) {
    return {
      ...vacio, sinAsignar: false, esParaNadie: true,
      porque: "Es una nota: queda en el hilo para que se vea, pero no es una indicación para nadie en particular.",
    };
  }

  // Camino de parcela: le toca a quien atiende esa parcela, y a nadie más.
  if (regla.porParcela) {
    if (!p.parcelaId) {
      return {
        ...vacio,
        porque: "No se sabe de qué parcela es, así que no se sabe a quién le toca. Dilo tú y se asigna: si le llega a todos, no la hace nadie.",
      };
    }
    const suyos = gente.filter(x => parcelasDe(x).includes(p.parcelaId));
    if (suyos.length === 1) {
      return {
        paraQuien: suyos[0], candidatos: suyos, sinAsignar: false, porRol: "parcela", bloquea: false,
        porque: `Le toca a ${suyos[0].nombre || suyos[0].id} porque es quien atiende esa parcela.`,
      };
    }
    if (suyos.length === 0) {
      return {
        ...vacio, porRol: "parcela",
        // No se cae al encargado general: mandarle el riego de la 53 a quien
        // no la riega es mandarlo a nadie, sólo que con acuse de recibo.
        porque: "Nadie está registrado como responsable de esa parcela, así que no se sabe a quién le toca. Asígnala tú, o registra quién la atiende y a partir de ahí se asigna sola.",
      };
    }
    return {
      ...vacio, candidatos: suyos, porRol: "parcela",
      porque: `Hay ${suyos.length} personas registradas en esa parcela (${suyos.map(x => x.nombre || x.id).join(", ")}). Elige tú a quién le toca: si le llega a todas, no la hace ninguna.`,
    };
  }

  // Camino de puesto: le toca a quien tiene ese papel en el rancho.
  const conRol = gente.filter(x => (regla.roles || []).includes(x.rol));
  if (conRol.length === 1) {
    return {
      paraQuien: conRol[0], candidatos: conRol, sinAsignar: false, porRol: "rol", bloquea: false,
      porque: `Le toca a ${conRol[0].nombre || conRol[0].id}: ${regla.porque}.`,
    };
  }
  if (conRol.length === 0) {
    return {
      ...vacio, porRol: "rol",
      porque: `No hay nadie registrado que pueda atenderlo (${regla.porque}), así que no se sabe a quién le toca. Asígnalo tú.`,
    };
  }
  return {
    ...vacio, candidatos: conRol, porRol: "rol",
    porque: `Hay ${conRol.length} que podrían atenderlo (${conRol.map(x => x.nombre || x.id).join(", ")}). Elige tú a quién le toca: si le llega a todos, no lo hace nadie.`,
  };
}

/* ════════════ LA CONFIRMACIÓN ════════════ */

export const ESTADOS_CONFIRMACION = ["pendiente", "confirmado", "corregido", "rechazado"];

// Marca una propuesta. Devuelve { ok, propuesta, dice }: si algo falta, NO
// marca nada y dice qué falta.
//
// Dos cosas se exigen a propósito:
//  · QUIÉN. Una confirmación sin nombre no es una confirmación: es un
//    registro que apareció solo, que es justo lo que este chat evita.
//  · El MOTIVO al rechazar. Es la misma regla de la merma sin causa y de la
//    cancelación de dinero: lo que se descarta se descarta con su porqué,
//    porque dentro de seis meses ese porqué es lo único que va a explicar
//    por qué el gasto del diésel no está.
//
// Al CORREGIR se conserva cómo llegó (`comoLlego`). Corregir no es borrar:
// el dato original se queda, para poder ver qué se leyó mal y de quién.
export function marcarConfirmacion(propuesta, { estado, quien, cuando, motivo, cambios } = {}) {
  const p = propuesta || {};
  if (!ESTADOS_CONFIRMACION.includes(estado) || estado === "pendiente") {
    return { ok: false, propuesta: p, dice: "Hay que decir si se confirma, se corrige o se rechaza." };
  }
  if (!quien || !(quien.nombre || quien.id)) {
    return { ok: false, propuesta: p, dice: "Falta quién lo está confirmando. Una confirmación sin nombre no es una confirmación." };
  }
  if (estado === "rechazado" && !String(motivo || "").trim()) {
    return { ok: false, propuesta: p, dice: "Falta por qué se rechaza. Dentro de seis meses ese motivo es lo único que va a explicar por qué esto no se registró." };
  }

  const confirmacion = {
    estado,
    quien: quien.nombre || quien.id,
    quienId: quien.id || null,
    cuando: cuando || new Date().toISOString(),   // la marca se guarda en UTC
    motivo: String(motivo || "").trim() || null,
    cambios: estado === "corregido" ? { ...(cambios || {}) } : null,
  };

  if (estado === "corregido") {
    const antes = {};
    for (const k of Object.keys(cambios || {})) antes[k] = p[k];
    return {
      ok: true,
      propuesta: { ...p, ...(cambios || {}), comoLlego: p.comoLlego || antes, confirmacion },
      dice: `Corregido por ${confirmacion.quien}. Se guarda también cómo llegó.`,
    };
  }
  return {
    ok: true,
    propuesta: { ...p, confirmacion },
    dice: estado === "confirmado"
      ? `Confirmado por ${confirmacion.quien}.`
      : `Rechazado por ${confirmacion.quien}: ${confirmacion.motivo}`,
  };
}

function confirmacionDe(propuesta) {
  const c = propuesta?.confirmacion;
  if (!c || !ESTADOS_CONFIRMACION.includes(c.estado) || c.estado === "pendiente") {
    return { estado: "pendiente", quien: null, cuando: null, firmada: false };
  }
  // Una confirmación sin quién no se toma por buena. No se borra —el dato
  // sigue ahí— pero no cuenta como movimiento hasta que alguien la firme.
  return { ...c, firmada: !!c.quien };
}

// Un movimiento cuenta SÓLO si una persona lo confirmó o lo corrigió, con su
// nombre. Pendiente no cuenta. Rechazado no cuenta.
export const cuentaComoMovimiento = (propuesta) => {
  const c = confirmacionDe(propuesta);
  return (c.estado === "confirmado" || c.estado === "corregido") && c.firmada;
};

// El estado de todo un mensaje: pendiente / confirmado / corregido /
// rechazado, con quién y cuándo.
//
// Un mensaje puede traer tres movimientos (la cuadrilla, el diésel y el
// filtro que hace falta) y confirmarse uno por uno. Mientras quede uno
// colgado, el mensaje sigue pendiente: es lo que evita que se dé por cerrado
// algo que sólo se atendió a medias.
export function estadoDeConfirmacion(mensaje) {
  const m = mensaje || {};
  const movs = (m.propuestas || []).filter(p => p.tipo !== "nota");

  if (movs.length === 0) {
    // Un mensaje que no se entendió también se puede resolver a mano: "no era
    // nada, es un recado". Esa marca vive en el propio mensaje.
    const c = confirmacionDe(m);
    const cero = { pendientes: 0, confirmadas: 0, corregidas: 0, rechazadas: 0, sinFirma: 0 };
    if (c.estado !== "pendiente" && c.firmada) {
      return {
        ...cero, estado: c.estado, porIdentificar: false,
        quien: c.quien, cuando: c.cuando, cuentaComoMovimiento: false,
        dice: c.estado === "rechazado"
          ? `${c.quien} lo marcó como que no era nada: ${c.motivo}. Se queda en el hilo, tachado.`
          : `${c.quien} ya lo revisó, pero no salió ningún movimiento de él.`,
      };
    }
    return {
      ...cero, estado: "pendiente", porIdentificar: true, quien: null, cuando: null,
      cuentaComoMovimiento: false,
      dice: "Todavía no se sabe qué es este mensaje. Se queda completo, con su foto o su audio, esperando que alguien lo diga.",
    };
  }

  const cs = movs.map(confirmacionDe);
  const pendientes = cs.filter(c => c.estado === "pendiente").length;
  const sinFirma = cs.filter(c => c.estado !== "pendiente" && !c.firmada).length;
  const confirmadas = cs.filter(c => c.estado === "confirmado" && c.firmada).length;
  const corregidas = cs.filter(c => c.estado === "corregido" && c.firmada).length;
  const rechazadas = cs.filter(c => c.estado === "rechazado" && c.firmada).length;
  const ultima = cs.filter(c => c.cuando).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando))).pop() || null;

  const base = {
    quien: ultima?.quien || null, cuando: ultima?.cuando || null,
    porIdentificar: false,
    pendientes, confirmadas, corregidas, rechazadas, sinFirma,
  };

  if (sinFirma > 0) {
    return {
      ...base, estado: "pendiente", cuentaComoMovimiento: false,
      dice: `${sinFirma} de ${movs.length} aparece(n) resuelto(s) pero sin quién lo hizo. Hay que confirmarlo con nombre: un movimiento que nadie firmó no se puede aclarar después.`,
    };
  }
  if (pendientes > 0) {
    return {
      ...base, estado: "pendiente", cuentaComoMovimiento: false,
      dice: pendientes === movs.length
        ? `Esperando confirmación: ${movs.length} movimiento(s) sin revisar.`
        : `Van ${movs.length - pendientes} de ${movs.length}; quedan ${pendientes} sin revisar.`,
    };
  }
  if (rechazadas === movs.length) {
    // El motivo va pegado a QUIEN lo dijo. Antes el nombre salía de la
    // confirmación más reciente y el motivo de la primera propuesta: cuando
    // no eran la misma persona, el renglón le colgaba a uno las palabras del
    // otro ("Rechazado por Migue: ya se había capturado el lunes", que Migue
    // nunca dijo). En el archivo que existe para que quede claro quién dijo
    // qué, y en una familia, ésa es exactamente la línea que arma el pleito.
    const firmas = [];
    for (const c of cs) {
      if (!firmas.some(f => f.quien === c.quien && f.motivo === c.motivo)) {
        firmas.push({ quien: c.quien, motivo: c.motivo });
      }
    }
    const linea = firmas.length === 1
      ? `Rechazado por ${firmas[0].quien}${firmas[0].motivo ? `: ${firmas[0].motivo}` : ""}.`
      : `Rechazado, cada uno con su motivo: ` +
        firmas.map(f => `${f.quien}${f.motivo ? ` — ${f.motivo}` : " — sin motivo"}`).join("; ") + ".";
    return {
      ...base, estado: "rechazado", cuentaComoMovimiento: false, firmasDelRechazo: firmas,
      dice: `${linea} Se queda en el hilo, tachado, con el motivo.`,
    };
  }
  const estado = corregidas > 0 ? "corregido" : "confirmado";
  return {
    ...base, estado, cuentaComoMovimiento: true,
    dice: `${estado === "corregido" ? "Corregido" : "Confirmado"} por ${base.quien}` +
      (rechazadas > 0 ? `; ${rechazadas} se rechazó(aron).` : "."),
  };
}

/* ════════════ LO QUE VA EN LAS COLUMNAS DE LA TABLA ════════════ */

// La tabla `chat` de Supabase tiene cuatro columnas de verdad además del id
// (fecha, tipo, estado, deQuien) y todo lo demás viaja en la columna `datos`.
// Estas dos funciones dicen exactamente qué poner en las dos que hay que
// decidir, para que la pantalla no se invente su propia traducción y acabe
// guardando un estado que las consultas no reconocen.

// texto | foto | audio | hoja, como los espera la columna `tipo`.
export function tipoDeMensaje(mensaje) {
  const m = mensaje || {};
  if (m.foto?.renglones) return "hoja";
  if (m.foto) return "foto";
  if (m.audio) return "audio";
  if (String(m.texto || "").trim()) return "texto";
  return null;   // sin texto, sin foto y sin audio no hay mensaje que guardar
}

// El estado como lo espera la columna: pendiente | confirmado | corregido |
// rechazado | por_identificar.
//
// "por identificar" y "pendiente" se guardan distinto a propósito, aunque los
// dos estén esperando a una persona: uno espera un sí, el otro espera que
// alguien diga qué es. Son dos trabajos distintos y se buscan por separado.
export function estadoParaLaTabla(mensaje) {
  const e = estadoDeConfirmacion(mensaje);
  return e.porIdentificar ? "por_identificar" : e.estado;
}

/* ════════════ EL HILO ════════════ */

// Los mensajes en orden, agrupados por día, con quién los mandó.
//
// El día sale de la hora LOCAL. Un mensaje de las diez y media de la noche
// tiene marca de tiempo del día siguiente en UTC, y agrupado por esa marca
// aparecería un día después de que se mandó.
export function hiloDeMensajes(mensajes) {
  const conHora = [], sinHora = [];
  for (const m of mensajes || []) {
    if (!m) continue;
    (diaDe(m.cuando) ? conHora : sinHora).push(m);
  }
  conHora.sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));

  const dias = [];
  for (const m of conHora) {
    const fecha = diaDe(m.cuando);
    let d = dias.find(x => x.fecha === fecha);
    if (!d) { d = { fecha, mensajes: [], dePersonas: [] }; dias.push(d); }
    d.mensajes.push(m);
    const quien = m.de?.nombre || m.de?.id || "sin nombre";
    if (!d.dePersonas.includes(quien)) d.dePersonas.push(quien);
  }
  for (const d of dias) {
    d.cuantos = d.mensajes.length;
    d.dice = `${d.cuantos} mensaje(s) de ${d.dePersonas.join(", ")}.`;
  }

  return {
    dias, total: conHora.length, sinHora,
    // Un mensaje sin hora NO se mete en el día de hoy. Ponerlo hoy sería
    // inventarle una fecha, y un mensaje con fecha inventada estorba más de
    // lo que ayuda cuando hay que reconstruir un día.
    dice: sinHora.length === 0
      ? `${conHora.length} mensaje(s) en ${dias.length} día(s).`
      : `${conHora.length} mensaje(s) en ${dias.length} día(s), y ${sinHora.length} sin hora: de ésos no se sabe de qué día son, así que quedan aparte y no se ponen en hoy.`,
  };
}

/* ════════════ LO QUE LLEVA RATO COLGADO ════════════ */

// Lo que está esperando que alguien diga que sí, y desde hace cuánto.
//
// Ésta es la función que evita que el chat se vuelva un basurero. Un chat
// donde todo entra y nada se cierra es peor que no tenerlo: da la sensación
// de que ya quedó registrado, y no quedó. Lo viejo se sube arriba.
export function pendientesDeConfirmar(mensajes, { ahora, horasParaApurar = 8 } = {}) {
  const momento = ahora || new Date().toISOString();
  const filas = [];

  for (const m of mensajes || []) {
    if (!m) continue;
    const est = estadoDeConfirmacion(m);
    if (est.estado !== "pendiente") continue;

    const horas = horasEntre(m.cuando, momento);
    const movs = (m.propuestas || []).filter(p => p.tipo !== "nota" && !cuentaComoMovimiento(p));
    const de = m.de?.nombre || m.de?.id || "alguien";
    const que = est.porIdentificar
      ? "un mensaje que todavía no se sabe qué es"
      : movs.map(p => p.tipo).join(", ");

    filas.push({
      mensajeId: m.id || null,
      de, cuando: m.cuando || null,
      // Sin hora no se sabe cuánto lleva. Eso NO son cero horas: cero horas
      // diría "acaba de llegar", que es lo contrario de lo que se sabe.
      horas,
      porIdentificar: est.porIdentificar,
      cuantos: est.porIdentificar ? 1 : movs.length,
      apura: horas !== null && horas >= horasParaApurar,
      dice: horas === null
        ? `${que} de ${de}: no se sabe de cuándo es, así que tampoco cuánto lleva esperando.`
        : `${que} de ${de}: lleva ${enHoras(horas)} esperando que alguien lo confirme.`,
    });
  }

  // Lo más viejo primero; lo que no trae hora se va al final, porque no se
  // puede formar en una fila que se ordena por tiempo.
  filas.sort((a, b) => {
    if (a.horas === null && b.horas === null) return 0;
    if (a.horas === null) return 1;
    if (b.horas === null) return -1;
    return b.horas - a.horas;
  });

  const conHora = filas.filter(f => f.horas !== null);
  return {
    filas,
    cuantos: filas.length,
    masViejo: conHora[0] || null,
    sinHora: filas.filter(f => f.horas === null),
    dice: filas.length === 0
      ? "No hay nada esperando confirmación."
      : `${filas.length} mensaje(s) esperando confirmación` +
        (conHora[0] ? `; el más viejo lleva ${enHoras(conHora[0].horas)}.` : ", y de ninguno se sabe desde cuándo."),
  };
}

/* ════════════ EL RESUMEN DEL DÍA ════════════ */

// Qué se movió hoy y qué quedó colgado.
//
// Lo confirmado y lo colgado van SEPARADOS a propósito. Si se enseñaran
// juntos, un día con doce mensajes se leería como un día con doce
// movimientos, y ocho de ellos serían cosas que nadie revisó.
export function resumenDelDia({ mensajes, fecha } = {}) {
  const dia = fecha || fechaLocal();
  const todos = (mensajes || []).filter(Boolean);
  const delDia = todos.filter(m => diaDe(m.cuando) === dia);
  // Un mensaje sin fecha legible NO se mete en el día —eso sería inventarle
  // una— pero TAMPOCO se cae en silencio. Antes desaparecía del resumen sin
  // una sola palabra: cuarenta mil pesos confirmados que no estaban en ningún
  // día y de los que el dueño nunca se enteraba. El hilo sí lo decía; el
  // resumen, que es el número que él ve, no.
  const sinFecha = todos.filter(m => diaDe(m.cuando) === null);

  const movimientos = [], colgados = [], rechazados = [], porIdentificar = [], cerradosSinMovimiento = [];
  const dePersonas = [];

  for (const m of delDia) {
    const quien = m.de?.nombre || m.de?.id || "sin nombre";
    if (!dePersonas.includes(quien)) dePersonas.push(quien);

    const movs = (m.propuestas || []).filter(p => p.tipo !== "nota");
    if (movs.length === 0) {
      // Quién decide si esto sigue "por identificar" es `estadoDeConfirmacion`
      // y nadie más. Antes esta función lo rehacía por su cuenta y le salía
      // distinto: el mensaje que alguien ya había cerrado a mano —"era una
      // foto de la troca"— seguía apareciendo aquí como trabajo pendiente,
      // mientras la otra función ya lo daba por resuelto. Dos respuestas
      // distintas del mismo archivo sobre el mismo mensaje, y la equivocada
      // era la que le habla al dueño.
      const est = estadoDeConfirmacion(m);
      if (est.porIdentificar) porIdentificar.push(m);
      else if (est.estado === "rechazado") rechazados.push(m);
      else cerradosSinMovimiento.push(m);
      continue;
    }
    for (const p of movs) {
      const c = confirmacionDe(p);
      if (cuentaComoMovimiento(p)) movimientos.push(p);
      else if (c.estado === "rechazado" && c.firmada) rechazados.push(p);
      else colgados.push(p);
    }
  }

  // Movimientos ya confirmados que podrían ser el mismo, capturado dos veces.
  // Se avisa aquí también porque es aquí donde se ve el daño: el total del día
  // con el gasto sumado dos veces. No se descuenta ninguno —la app informa, la
  // persona manda— pero el total no sale solo, sale con el aviso al lado.
  const duplicados = posiblesDuplicados(movimientos);

  // Lo confirmado que no está en el total de ningún día, porque su mensaje no
  // trae fecha que se entienda.
  const movimientosSinFecha = [];
  for (const m of sinFecha) {
    for (const p of (m.propuestas || []).filter(p => p.tipo !== "nota")) {
      if (cuentaComoMovimiento(p)) movimientosSinFecha.push(p);
    }
  }
  const conMontoSinFecha = movimientosSinFecha.filter(p => p.tipo === "gasto" && num(p.monto) !== null);
  const gastadoSinFecha = sumarDinero(conMontoSinFecha.map(p => p.monto));

  const porTipo = {};
  for (const p of movimientos) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;

  // El dinero del día: SÓLO lo confirmado, y sólo lo que trae monto. Un gasto
  // sin monto no entra como cero — se cuenta aparte y se dice, porque un cero
  // se suma y nadie lo vuelve a mirar.
  const gastos = movimientos.filter(p => p.tipo === "gasto");
  const conMonto = gastos.filter(p => num(p.monto) !== null);
  const sinMonto = gastos.length - conMonto.length;
  const gastado = sumarDinero(conMonto.map(p => p.monto));

  const partes = [];
  if (movimientos.length === 0) partes.push("Hoy no se confirmó ningún movimiento.");
  else partes.push(`Se confirmaron ${movimientos.length}: ${Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(", ")}.`);
  if (conMonto.length > 0) partes.push(`Gasto confirmado del día: ${fmt(gastado)}.`);
  if (sinMonto > 0) partes.push(`${sinMonto} gasto(s) confirmado(s) sin monto capturado: no entran en esa suma.`);
  if (duplicados.length > 0) {
    partes.push(
      `Ojo: ${duplicados.length} par(es) de movimientos confirmados salieron del mismo mensaje y podrían ser el mismo, ` +
      `capturado dos veces. ${duplicados.map(d => d.dice).join(" ")}`
    );
  }
  if (colgados.length > 0) partes.push(`Quedaron ${colgados.length} sin confirmar.`);
  if (porIdentificar.length > 0) partes.push(`${porIdentificar.length} mensaje(s) por identificar.`);
  if (cerradosSinMovimiento.length > 0) partes.push(`${cerradosSinMovimiento.length} mensaje(s) ya revisado(s) del que no salió ningún movimiento.`);
  if (rechazados.length > 0) partes.push(`${rechazados.length} se rechazó(aron), con su motivo.`);
  if (sinFecha.length > 0) {
    partes.push(
      `Aparte: ${sinFecha.length} mensaje(s) sin fecha que se entienda, así que no entran en ningún día` +
      (movimientosSinFecha.length > 0
        ? ` — y traen ${movimientosSinFecha.length} movimiento(s) ya confirmado(s)` +
          (conMontoSinFecha.length > 0 ? `, ${fmt(gastadoSinFecha)} que no están en el total de ningún día` : "") +
          `. Ponles fecha para que cuenten.`
        : `.`)
    );
  }

  return {
    fecha: dia,
    cuantosMensajes: delDia.length,
    dePersonas,
    movimientos, porTipo,
    gastado: conMonto.length > 0 ? gastado : null,
    gastosSinMonto: sinMonto,
    colgados, rechazados, porIdentificar, cerradosSinMovimiento,
    posiblesDuplicados: duplicados,
    // Lo que no cupo en ningún día. Se cuenta y se dice, no se rellena con hoy.
    sinFecha,
    movimientosSinFecha,
    gastadoSinFecha: conMontoSinFecha.length > 0 ? gastadoSinFecha : null,
    dice: partes.join(" "),
  };
}
