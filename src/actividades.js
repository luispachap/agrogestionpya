// EL CATÁLOGO ÚNICO DE ACTIVIDADES y lo que pide cada una. (Primer paso de `docs/ESPECIALIDADES.md`.)
//
// Antes cada pantalla traía su propia lista: Equipos de trabajo una, Cuadrillas otra, la actividad tecleada otra, y lo
// que alguien escribía en «Otra cosa…» no se parecía a nada. Sin decir que «Riego», «regar» y «echar agua» son lo
// mismo, la experiencia de una persona se parte en pedazos. Aquí vive UNA lista, y todo lo demás se liga a ella.
//
// Reglas que no se rompen:
//   · No se inventa nada: de fábrica sólo están las actividades que las pantallas YA ofrecían. Lo demás lo agrega una
//     persona, y queda con fecha, quién y por qué (son hechos, como la organización).
//   · Un texto que no se reconoce NO se adivina: sale «por ligar» hasta que alguien diga a qué actividad corresponde.
//   · Tres clases de requisito, que nunca se mezclan:
//       - legal:       lo pide una norma. Nace «por validar» y NO restringe nada hasta que alguien documente QUÉ NORMA
//                      es y quién validó que aplica a esta actividad. La app no decide qué es legal.
//       - interno:     lo pide el rancho por decisión propia.
//       - experiencia: se recomienda; nunca impide nada.
//     Un requisito interno jamás sustituye a uno legal: son renglones distintos y no hay campo para «sustituye a».
//   · NADA de esto restringe todavía ninguna asignación (`RESTRICCIONES_ACTIVAS`): es el catálogo, no la puerta.
//   · Lo captura sólo quien tiene el permiso otorgado, y lo valida la base (hoja 52), igual que la organización.
import { nuevoEvento, vigentes, negado } from "./eventos.js";

export const T_ACTIVIDAD = "act_actividad", T_EQUIVALENCIA = "act_equivalencia", T_REQUISITO = "act_requisito";
export const TIPOS = [T_ACTIVIDAD, T_EQUIVALENCIA, T_REQUISITO];
export const OPERACION = "configurar_organizacion";
export const RESTRICCIONES_ACTIVAS = false;
// Cuánta experiencia hace falta para que el sistema SUGIERA una especialidad (decidido por Luis, 21 nov, provisional):
// días distintos y horas registradas en los últimos meses, con al menos tantas jornadas confirmadas. Se puede cambiar
// actividad por actividad. Sólo sirve para SUGERIR: no acredita competencia ni autoriza ningún trabajo de riesgo.
export const UMBRAL_PROVISIONAL = { dias: 10, horas: 40, confirmadas: 1, meses: 12 };
const umbralValido = (u) => u && ["dias", "horas", "confirmadas", "meses"].every(k => Number.isFinite(Number(u[k])) && Number(u[k]) >= (k === "confirmadas" ? 1 : 1));
const mismoUmbral = (a, b) => ["dias", "horas", "confirmadas", "meses"].every(k => Number(a[k]) === Number(b[k]));
export const AMBITOS = { campo: "Campo", vehiculo: "Vehículos y maquinaria", bodega: "Bodega", general: "General" };
export const CLASES_DE_REQUISITO = {
  legal: { nombre: "Requisito legal", dice: "Lo pide una norma. No restringe hasta documentar cuál y validar que aplica." },
  interno: { nombre: "Requisito interno", dice: "Lo pide el rancho. No sustituye a uno legal." },
  experiencia: { nombre: "Experiencia recomendada", dice: "Se recomienda; nunca impide asignar." },
};

// Lo que las pantallas YA ofrecían (Equipos de trabajo, Cuadrillas, la actividad tecleada). Ni una más.
const DE_DRON = ["Aplicación agroquímicos", "Fumigación herbicida", "Fertilización aérea", "Monitoreo de cultivo", "Mapeo de parcela"];
// `ofrecidas` marca las doce de Equipos de trabajo y Cuadrillas (las listas de esas pantallas no cambian); las demás
// son las que ya ofrecían las capturas de actividad —la del trabajador, la del tractorista, la del dronero, la de la
// cuadrilla, la del externo y la del administrador, que es la que registra el trabajo de BODEGA—. Entran con el mismo
// nombre con que ya se guardaban, para que lo registrado se reconozca tal cual y no nazca nada duplicado.
// OJO: la bodega es un LUGAR, no una actividad: «Limpieza» en la bodega es la misma «Limpieza» (el registro ya dice
// `esBodega`). Por eso sólo «Empaque» es propia de bodega.
export const DE_FABRICA = [
  ...["Preparación de suelo", "Siembra", "Fertilización", "Riego", "Control de plagas", "Deshierbe", "Cosecha", "Limpieza"].map(n => ({ nombre: n, ambito: "campo", ofrecida: true })),
  ...["Traslado de personal", "Acarreo de cosecha", "Acarreo de insumos", "Mantenimiento del vehículo"].map(n => ({ nombre: n, ambito: "vehiculo", ofrecida: true })),
  ...["Empaque"].map(n => ({ nombre: n, ambito: "bodega" })),
  ...["Transporte", "Transporte interno", "Fertilización mecanizada", "Subsoleo", "Rastreo", "Surcado", "Mantenimiento tractor"].map(n => ({ nombre: n, ambito: "vehiculo" })),
  ...DE_DRON.map(n => ({ nombre: n, ambito: "campo" })),
];
// La misma actividad escrita de dos formas tiene la misma clave: sin acentos, sin mayúsculas, sin signos.
export const claveDe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
const idDeFabrica = (nombre) => `act-${claveDe(nombre).replace(/ /g, "-")}`;
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || "")), texto = (t) => String(t || "").trim();
const enOrden = (a, b) => String(a.datos.desde || a.fecha).localeCompare(String(b.datos.desde || b.fecha)) || String(a.capturado).localeCompare(String(b.capturado)) || String(a.id).localeCompare(String(b.id));

/* ── El catálogo de un día ── */
export function catalogoEn(eventos, fecha) {
  const acts = new Map(DE_FABRICA.map(a => [idDeFabrica(a.nombre), { id: idDeFabrica(a.nombre), nombre: a.nombre, ambito: a.ambito, activa: true, deFabrica: true, ofrecida: !!a.ofrecida }]));
  const equiv = new Map(), reqs = new Map();
  for (const e of vigentes(eventos || []).filter(e => TIPOS.includes(e.tipo) && (e.datos.desde || e.fecha) <= fecha).sort(enOrden)) {
    const d = e.datos;
    if (e.tipo === T_ACTIVIDAD) acts.set(d.actividadId, { ...(acts.get(d.actividadId) || { id: d.actividadId, deFabrica: false }), nombre: d.nombre, ambito: d.ambito, activa: d.activa !== false, ...(d.umbral ? { umbral: d.umbral, umbralPropio: true } : {}) });
    else if (e.tipo === T_EQUIVALENCIA) { if (d.actividadId) equiv.set(d.clave, { actividadId: d.actividadId, escrito: d.texto, evento: e.id }); else equiv.delete(d.clave); }
    else if (d.activo === false) reqs.delete(d.requisitoId);
    else reqs.set(d.requisitoId, { id: d.requisitoId, actividadId: d.actividadId, clase: d.clase, descripcion: d.descripcion, norma: d.norma || "", aplicabilidad: d.clase === "legal" ? d.aplicabilidad || "por_validar" : null, validadoPor: d.validadoPor || "", validadoEl: d.validadoEl || "", vigenteDesde: d.vigenteDesde || "", vigenteHasta: d.vigenteHasta || "", vencido: !!(d.vigenteHasta && d.vigenteHasta < fecha), obliga: d.clase === "interno" ? !!d.obliga : false, desde: d.desde, evento: e.id });
  }
  const estado = (r) => (r.vencido ? `Su vigencia terminó el ${r.vigenteHasta}: hay que revisarlo` : r.clase === "legal" ? (r.aplicabilidad === "validada" ? "Norma documentada y validada" : "Por validar: falta documentar la norma y que alguien confirme que aplica. Mientras tanto no autoriza a nadie a hacer este trabajo ni lo impide") : r.clase === "interno" ? (r.obliga ? "El rancho lo pide como obligatorio" : "El rancho lo recomienda") : "Recomendación");
  const lista = [...acts.values()].map(a => ({ umbral: UMBRAL_PROVISIONAL, umbralPropio: false, ...a, requisitos: [...reqs.values()].filter(r => r.actividadId === a.id).map(r => ({ ...r, estado: estado(r),
    // ¿Restringiría, el día que las restricciones se enciendan? Lo legal sólo con su norma validada; la experiencia, nunca.
    restringiria: r.vencido ? false : r.clase === "legal" ? r.aplicabilidad === "validada" : r.clase === "interno" ? r.obliga : false, restringeHoy: false })) }))
    .sort((a, b) => Object.keys(AMBITOS).indexOf(a.ambito) - Object.keys(AMBITOS).indexOf(b.ambito) || a.nombre.localeCompare(b.nombre, "es"));
  const porId = new Map(lista.map(a => [a.id, a])), porClave = new Map(lista.map(a => [claveDe(a.nombre), a]));
  return {
    fecha, actividades: lista, porId,
    equivalencias: [...equiv.entries()].filter(([, v]) => porId.has(v.actividadId)).map(([clave, v]) => ({ clave, escrito: v.escrito, actividadId: v.actividadId, nombre: porId.get(v.actividadId).nombre })),
    // Lo que se OFRECE en Equipos de trabajo y Cuadrillas: las doce de siempre y lo que una persona haya agregado. Las
    // de las capturas por oficio (tractorista, dronero…) se reconocen, pero no se meten a esas listas: nada cambia ahí.
    nombres: (ambitos) => lista.filter(a => a.activa && (a.ofrecida || !a.deFabrica) && (!ambitos || ambitos.includes(a.ambito))).map(a => a.nombre),
    // ¿Qué actividad del catálogo es este texto? Por su nombre, o porque alguien dijo que es lo mismo. Si no, NO se adivina.
    normalizar(escrito) {
      const k = claveDe(escrito); if (!k) return { actividadId: null, nombre: "", via: "vacio" };
      const a = porClave.get(k); if (a) return { actividadId: a.id, nombre: a.nombre, via: "nombre" };
      const q = equiv.get(k); if (q && porId.has(q.actividadId)) return { actividadId: q.actividadId, nombre: porId.get(q.actividadId).nombre, via: "equivalencia" };
      return { actividadId: null, nombre: "", via: "sin_reconocer" };
    },
  };
}

// Los textos de actividad que ya andan en los registros y el catálogo no reconoce: se enseñan para que alguien los
// ligue. Sale de lo mismo que ya se guarda (reparto real, cuadrillas, avances, actividades tecleadas); no crea nada.
export function porLigar({ eventos = [], actividades = [], catalogo } = {}) {
  const m = new Map(), anota = (escrito, donde) => { if (!texto(escrito) || catalogo.normalizar(escrito).actividadId) return; const k = claveDe(escrito), x = m.get(k) || { clave: k, escrito: texto(escrito), veces: 0, donde: new Set() }; x.veces += 1; x.donde.add(donde); m.set(k, x); };
  for (const e of vigentes(eventos)) { if (e.tipo === "asignacion") anota(e.datos.actividad, "Equipos de trabajo"); else if (e.tipo === "cuadrilla_dia") anota(e.datos.actividad, "Cuadrillas"); else if (e.tipo === "avance_trabajo") anota(e.datos.actividad, "Avances"); }
  for (const a of actividades || []) if (a && !a.cancelado && a.tipo !== "Otro") anota(a.tipo, "Actividades registradas");
  return [...m.values()].map(x => ({ ...x, donde: [...x.donde].sort() })).sort((a, b) => b.veces - a.veces || a.escrito.localeCompare(b.escrito, "es"));
}

/* ── Capturar ── */
const ahoraSi = ({ quien, cuando, hoy, permitido }) => (!quien?.id ? "Falta quién lo registra." : negado(quien, permitido, "El catálogo de actividades lo captura quien tiene ese permiso.") || (!cuando || !esFecha(hoy) ? "Falta la fecha de hoy." : null));
const hecho = (tipo, datos, { quien, cuando, hoy, id }) => nuevoEvento({ id, tipo, cuando, fecha: hoy, quien, datos });

// Dar de alta una actividad, cambiarle el nombre o el ámbito, o darla de baja (`activa: false`). Lo anterior se queda.
export function guardarActividad({ eventos = [], actividadId, nombre, ambito, activa = true, umbral, motivo = "", quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!texto(nombre)) return { ok: false, dice: "Falta el nombre de la actividad." };
  if (!AMBITOS[ambito]) return { ok: false, dice: "Di de qué es: campo, vehículos, bodega o general." };
  const cat = catalogoEn(eventos, hoy), previa = actividadId ? cat.porId.get(actividadId) : null;
  if (actividadId && !previa) return { ok: false, dice: "Esa actividad no está en el catálogo." };
  const otra = cat.actividades.find(a => a.id !== actividadId && claveDe(a.nombre) === claveDe(nombre));
  if (otra) return { ok: false, dice: `Ya existe «${otra.nombre}»${otra.activa ? "" : " (está dada de baja: se puede reactivar)"}.` };
  const yaLigado = cat.equivalencias.find(q => q.clave === claveDe(nombre) && q.actividadId !== actividadId);
  if (yaLigado) return { ok: false, dice: `«${texto(nombre)}» ya se ligó a ${yaLigado.nombre}. Si es otra actividad, primero quita esa liga.` };
  if (umbral !== undefined && umbral !== null && !umbralValido(umbral)) return { ok: false, dice: "El mínimo para sugerir la especialidad pide días, horas, jornadas confirmadas y meses, todos de uno en adelante. Sin ninguna jornada confirmada no se sugiere." };
  const u = umbral ? { dias: Number(umbral.dias), horas: Number(umbral.horas), confirmadas: Number(umbral.confirmadas), meses: Number(umbral.meses) } : previa?.umbralPropio ? previa.umbral : null;
  if (previa && previa.nombre === texto(nombre) && previa.ambito === ambito && previa.activa === !!activa && mismoUmbral(u || UMBRAL_PROVISIONAL, previa.umbral)) return { ok: false, dice: "No cambió nada." };
  if (previa && !texto(motivo)) return { ok: false, dice: "Di por qué cambia: después es lo único que lo explica." };
  const ev = hecho(T_ACTIVIDAD, { actividadId: actividadId || null, nombre: texto(nombre), ambito, activa: !!activa, ...(u && !mismoUmbral(u, UMBRAL_PROVISIONAL) ? { umbral: u } : {}), desde: hoy, motivo: texto(motivo), antes: previa ? { nombre: previa.nombre, ambito: previa.ambito, activa: previa.activa, umbral: previa.umbral } : null }, { quien, cuando, hoy, id });
  if (!ev.datos.actividadId) ev.datos.actividadId = ev.id;
  return { ok: true, evento: ev, dice: previa ? "Cambio registrado. Lo anterior queda guardado." : `«${texto(nombre)}» quedó en el catálogo.` };
}

// Decir que un texto escrito ES tal actividad (o quitar la liga, con `actividadId: null`). Lo ya registrado no se
// reescribe: se sigue leyendo lo que decía, y de ahora en adelante se entiende igual en todos lados.
export function ligarTexto({ eventos = [], escrito, actividadId, motivo = "", quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  const k = claveDe(escrito); if (!k) return { ok: false, dice: "Falta el texto." };
  const cat = catalogoEn(eventos, hoy), ya = cat.normalizar(escrito);
  if (ya.via === "nombre") return { ok: false, dice: `«${texto(escrito)}» ya es el nombre de una actividad del catálogo.` };
  if (actividadId && !cat.porId.has(actividadId)) return { ok: false, dice: "Esa actividad no está en el catálogo." };
  if (!actividadId && ya.via !== "equivalencia") return { ok: false, dice: "Ese texto no está ligado a nada." };
  if (actividadId && ya.actividadId === actividadId) return { ok: false, dice: `Ya está ligado a ${ya.nombre}.` };
  if ((ya.via === "equivalencia" || !actividadId) && !texto(motivo)) return { ok: false, dice: "Di por qué se cambia o se quita la liga." };
  return { ok: true, evento: hecho(T_EQUIVALENCIA, { texto: texto(escrito), clave: k, actividadId: actividadId || null, desde: hoy, motivo: texto(motivo), antes: ya.actividadId || null }, { quien, cuando, hoy, id }),
    dice: actividadId ? `«${texto(escrito)}» se entiende como ${cat.porId.get(actividadId).nombre}.` : `«${texto(escrito)}» queda otra vez por ligar.` };
}

// Un requisito de una actividad. Lo legal nace «por validar»; para darlo por validado hay que escribir la norma y
// quién validó que aplica. Quitarlo es otro hecho (`activo: false`), con motivo.
export function ponerRequisito({ eventos = [], requisitoId, actividadId, clase, descripcion, norma = "", aplicabilidad = "por_validar", validadoPor = "", vigenteDesde = "", vigenteHasta = "", obliga = false, activo = true, motivo = "", quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  const cat = catalogoEn(eventos, hoy), a = cat.porId.get(actividadId);
  if (!a) return { ok: false, dice: "Esa actividad no está en el catálogo." };
  const previo = requisitoId ? a.requisitos.find(r => r.id === requisitoId) : null;
  if (requisitoId && !previo) return { ok: false, dice: "Ese requisito no existe en esa actividad." };
  if (activo === false) { if (!previo) return { ok: false, dice: "No hay qué quitar." }; if (!texto(motivo)) return { ok: false, dice: "Di por qué se quita el requisito." };
    return { ok: true, evento: hecho(T_REQUISITO, { requisitoId, actividadId, activo: false, desde: hoy, motivo: texto(motivo), antes: { clase: previo.clase, descripcion: previo.descripcion, norma: previo.norma, aplicabilidad: previo.aplicabilidad } }, { quien, cuando, hoy, id }), dice: "Requisito quitado. Queda en el historial." }; }
  if (!CLASES_DE_REQUISITO[clase]) return { ok: false, dice: "Di si es un requisito legal, interno o experiencia recomendada." };
  if (previo && previo.clase !== clase) return { ok: false, dice: "Un requisito no cambia de clase: lo interno no se vuelve legal ni al revés. Quita éste y registra el otro." };
  if (!texto(descripcion)) return { ok: false, dice: "Falta decir qué se pide." };
  if (clase !== "legal" && texto(norma)) return { ok: false, dice: "La norma sólo va en un requisito legal. Si lo pide una norma, regístralo como legal." };
  if (clase === "legal" && aplicabilidad === "validada") {
    if (texto(norma).length < 6) return { ok: false, dice: "Para darlo por validado falta decir QUÉ norma lo pide (nombre y, si se sabe, artículo o numeral)." };
    if (!texto(validadoPor)) return { ok: false, dice: "Falta quién validó que esa norma aplica a esta actividad." };
  }
  if ((vigenteDesde && !esFecha(vigenteDesde)) || (vigenteHasta && !esFecha(vigenteHasta))) return { ok: false, dice: "La vigencia va con fechas completas." };
  if (vigenteDesde && vigenteHasta && vigenteHasta < vigenteDesde) return { ok: false, dice: "La vigencia no puede terminar antes de empezar." };
  if (clase === "legal" && !["por_validar", "validada"].includes(aplicabilidad)) return { ok: false, dice: "Un requisito legal está por validar o validado." };
  if (previo && !texto(motivo)) return { ok: false, dice: "Di por qué cambia el requisito." };
  const ev = hecho(T_REQUISITO, { requisitoId: requisitoId || null, actividadId, clase, descripcion: texto(descripcion), ...(clase === "legal" ? { norma: texto(norma), aplicabilidad, validadoPor: aplicabilidad === "validada" ? texto(validadoPor) : "", validadoEl: aplicabilidad === "validada" ? hoy : "" } : {}), ...(vigenteDesde ? { vigenteDesde } : {}), ...(vigenteHasta ? { vigenteHasta } : {}), ...(clase === "interno" ? { obliga: !!obliga } : {}), activo: true, desde: hoy, motivo: texto(motivo) }, { quien, cuando, hoy, id });
  if (!ev.datos.requisitoId) ev.datos.requisitoId = ev.id;
  return { ok: true, evento: ev, dice: clase === "legal" && aplicabilidad !== "validada" ? "Requisito legal registrado como «por validar». No restringe nada hasta documentar la norma y validar que aplica." : "Requisito registrado. Por ahora es informativo: todavía no restringe ninguna asignación." };
}
