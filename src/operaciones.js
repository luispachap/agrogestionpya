// ============================================================
//  AgroGestión — De lo que alguien dice a lo que el sistema registra (puro)
//
//  UN SOLO CAMINO para todo lo que entra hablando, escribiendo o mandando un
//  papel —desde «Dile a la app», desde el chat de adentro y, cuando exista,
//  desde WhatsApp—:
//
//    1. ENTENDER    lo dicho se parte en frases y cada una se clasifica (voz.js).
//    2. PREPARAR    cada frase se vuelve una PROPUESTA de operación, con lo que
//                   falta, a quién le toca confirmarla y de qué clase es.
//    3. VALIDAR     lo que falta se PREGUNTA; lo que ya se registró de ese mismo
//                   mensaje no se repite; el mismo dinero dicho dos veces cuenta una.
//    4. AUTORIZAR   confirma quien tiene permiso para ESA operación. Entender no
//                   es autorizar, y hablar no da permisos que la persona no tiene.
//    5. EJECUTAR    al confirmar se usa la operación que el módulo YA tiene. Aquí
//                   no se inventa otra forma de guardar un gasto o un avance.
//
//  REGLAS
//  · Nada se guarda solo. La app propone; una persona confirma.
//  · Se distingue lo que se HIZO de lo que se VIO, se SOSPECHA, se AVISA, se
//    DECIDIÓ o está POR HACERSE. Sólo lo hecho se propone como hecho.
//  · Cada registro dice de qué mensaje y de qué frase salió, y el mensaje
//    conserva sus originales (texto, audio, foto).
//  · Lo que todavía no tiene su operación conectada se dice, y se manda a su
//    pantalla; no se guarda «parecido» por otro lado.
// ============================================================
import { registrarAvance, unidadDe, actividadDicha, decirUnidad } from "./avances.js";

export const NATURALEZAS = {
  hecho: "Algo que se hizo", observacion: "Algo que se vio", hipotesis: "Una sospecha (no confirmada)", reporte: "Un aviso", decision: "Una decisión", plan: "Algo por hacer", necesidad: "Algo que hace falta",
};
const plano = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Cómo se dijo. El orden importa: una sospecha dicha en pasado sigue siendo sospecha.
export function naturalezaDe(frase, tipo) {
  const t = ` ${plano(frase)} `;
  if (/\b(creo que|parece que|a lo mejor|puede que|puede ser|quiza|quizas|tal vez|sospecho|yo digo que|ha de ser|como que)\b/.test(t)) return "hipotesis";
  if (/\b(decidimos|se decidio|decidi|quedamos en|quedamos que|autorice|se autorizo|acordamos)\b/.test(t)) return "decision";
  if (tipo !== "avance" && /\b(manana|pasado manana|la proxima|el lunes|hay que|tenemos que|vamos a|voy a|se va a|falta por|toca)\b/.test(t) && !/\b(compramos|compre|pagamos|pague|terminamos|acabamos|anduvieron|trabajaron|cosechamos)\b/.test(t)) return tipo === "necesidad" ? "necesidad" : "plan";
  if (tipo === "necesidad") return "necesidad";
  if (tipo === "incidencia") return "reporte";
  if (/\b(vimos|vi|se ve|se ven|se nota|hay mucha|hay mucho|hay muchos|encontramos|encontre|note|notamos|trae|anda con)\b/.test(t) && !["gasto", "actividad", "cosecha", "avance"].includes(tipo)) return "observacion";
  return ["gasto", "actividad", "cosecha", "avance", "fertirriego"].includes(tipo) ? "hecho" : "observacion";
}

// Qué se puede registrar hoy por este camino, quién lo confirma y con qué operación del sistema.
// `dinero`: mueve dinero o costo (cuenta una sola vez por mensaje). `a`: dónde queda.
export const OPERACIONES = {
  avance: { nombre: "Avance de trabajo", confirma: ["admin", "encargado"], dinero: false, a: "Avances (evento)", porque: "el avance lo confirma quien dirige el trabajo" },
  actividad: { nombre: "Trabajo de personas en una parcela", confirma: ["admin", "encargado"], dinero: true, a: "Actividades", porque: "el registro de campo lo confirma el encargado" },
  cosecha: { nombre: "Cosecha", confirma: ["admin", "encargado"], dinero: false, a: "Cosechas", porque: "la cosecha la confirma el encargado" },
  gasto: { nombre: "Gasto", confirma: ["admin", "finanzas"], dinero: true, a: "Egresos", porque: "un gasto lo confirma quien lleva las cuentas" },
  necesidad: { nombre: "Algo que hace falta", confirma: ["admin", "encargado", "finanzas", "agronomo"], dinero: false, a: "Solicitudes de compra", porque: "pedir no es comprar: cualquiera con captura puede levantar la necesidad" },
  incidencia: { nombre: "Incidencia", confirma: ["admin", "encargado", "agronomo"], dinero: false, a: "Incidencias", porque: "una incidencia la levanta quien la ve" },
  fertirriego: { nombre: "Indicación de fertirriego", confirma: ["admin", "agronomo", "encargado"], dinero: false, a: "Indicaciones", porque: "la indicación la confirma el agrónomo o quien la ejecuta" },
  nota: { nombre: "Nota en la bitácora", confirma: ["admin", "encargado", "finanzas", "agronomo"], dinero: false, a: "Bitácora", porque: "una nota no mueve nada" },
};
// Lo que la gente va a decir y TODAVÍA no se registra por aquí. Se reconoce para decir a dónde ir; no se guarda parecido.
export const POR_CONECTAR = [
  { clave: "prestamo", senas: /\b(le preste|le prestamos|prestamo a|un prestamo|me presto|adelanto de sueldo|le adelante)\b/, dice: "Suena a un préstamo. Un préstamo no es un gasto y no descuenta nada solo: se pide, se autoriza y se entrega en «Préstamos». Todavía no se registra hablando.", pantalla: "deudas" },
  { clave: "pago", senas: /\b(le pague a|les pague|pagamos la raya|pague la raya|pago de la semana|la nomina)\b/, dice: "Suena a un pago al personal. Eso se entrega y se confirma en «Pagos al personal», con su autorización. Todavía no se registra hablando.", pantalla: "nomina" },
  { clave: "aplicacion", senas: /\b(aplicamos|se aplico|aplique|fumigamos|se fumigo|herbicida|insecticida|fungicida|bactericida)\b/, dice: "Suena a una aplicación de un producto. Lleva producto, dosis, quién la indicó y por qué, y sus tiempos de seguridad: se registra en «Aplicaciones». Todavía no se registra hablando.", pantalla: "aplicaciones" },
  { clave: "almacen", senas: /\b(saque del almacen|sacamos del almacen|entro al almacen|llego al almacen|entregue del almacen)\b/, dice: "Suena a un movimiento del almacén. Las entradas y las entregas se registran en «Entregas del almacén», para que la existencia cuadre. Todavía no se registra hablando.", pantalla: "entregas" },
];

const PREGUNTA = {
  "cuánto costó": "¿Cuánto costó?", "quién trabajó": "¿Quiénes trabajaron? (con nombre: un número de personas no le registra el día a nadie)", "en qué parcela": "¿En qué parcela?", "de qué parcela": "¿De qué parcela?",
  "cuánto se cosechó": "¿Cuánto se cosechó, y en qué (cajas, kilos…)?", "cuánto se avanzó y en qué (reguladores, surcos, cajas…)": "¿Cuánto se avanzó, y en qué se mide (reguladores, surcos, cajas…)?",
  "en cuál de las parcelas que nombraste": "Nombraste varias parcelas: ¿en cuál fue?", "de qué actividad": "¿De qué actividad es el avance (deshierbe, riego, corte…)?",
};
const idDe = (mensajeId, i) => `${mensajeId}#${i}`;

// 2 y 3 · De lo entendido a las propuestas, ya revisadas.
//   mensaje    { id, canal: "app" | "chat" | "whatsapp", de: { id, nombre, rol }, cuando, texto }
//   entendido  lo que devuelve `entenderLoDicho`
//   yaHechas   ids de propuestas de este mensaje que ya se registraron (para no repetir)
export function preparar({ mensaje, entendido, yaHechas = [] }) {
  if (!mensaje?.id || !mensaje?.de?.id) throw new Error("Un mensaje necesita id y quién lo dijo");
  const hechas = new Set(yaHechas), rol = mensaje.de.rol, montos = new Map();
  const propuestas = (entendido?.propuestas || []).filter(p => p.parteDe == null).map((p) => {
    const naturaleza = naturalezaDe(p.frase, p.tipo), id = idDe(mensaje.id, p.i), falta = [...(p.falta || [])];
    const sinConectar = p.tipo === "nota" || p.tipo === "gasto" || p.tipo === "actividad" ? POR_CONECTAR.find(x => x.senas.test(plano(p.frase))) || null : null;
    let tipo = p.tipo, aviso = "";
    // Sólo lo HECHO se propone como hecho. Una sospecha o algo por hacer se conserva, pero como nota con su clase.
    if (["gasto", "actividad", "cosecha", "avance"].includes(tipo) && naturaleza !== "hecho") { aviso = `Se dijo como ${NATURALEZAS[naturaleza].toLowerCase()}, no como algo ya hecho: se guarda en la bitácora con esa clase y no cuenta como ${OPERACIONES[tipo].nombre.toLowerCase()}.`; tipo = "nota"; falta.length = 0; }
    if (sinConectar && (tipo === "nota" || tipo === "gasto" || tipo === "actividad")) { aviso = sinConectar.dice; tipo = "nota"; falta.length = 0; }
    const datos = { fecha: p.fecha, parcelaId: p.parcelas?.[0]?.id || "", parcelaNombre: p.parcelas?.[0]?.nombre || "", personas: (p.personas || []).map(x => ({ id: x.id, nombre: x.nombre })), monto: p.monto ?? null, horas: p.horas ?? null, cantidad: p.cantidad || null, paraQuien: p.paraQuien || null };
    if (tipo === "avance") { datos.actividad = actividadDicha(p.frase); datos.unidad = unidadDe(p.cantidad?.unidad) || null; datos.personasN = p.personasN ?? null; datos.pendiente = p.pendiente || null; if (!datos.actividad) falta.push("de qué actividad"); }
    if ((p.ambiguos || []).length) falta.push(`cuál de las personas es «${p.ambiguos.map(a => a.dijo || a.nombre || "").join("», «")}» (${p.ambiguos.map(a => (a.candidatos || []).map(c => c.nombre).join(" o ")).join("; ")})`);
    const op = OPERACIONES[tipo], puede = op.confirma.includes(rol);
    // El mismo dinero dicho dos veces en un mensaje (el gasto y otra vez su total) cuenta una sola vez.
    let mismoDineroQue = null;
    if (op.dinero && datos.monto != null) { if (montos.has(datos.monto)) mismoDineroQue = montos.get(datos.monto); else montos.set(datos.monto, id); }
    return { id, i: p.i, grupo: mensaje.id, tipo, tipoEntendido: p.tipo, naturaleza, frase: p.frase, seguro: !!p.seguro, porque: p.porque || "", datos, aviso, pantalla: sinConectar?.pantalla || null,
      falta, preguntas: falta.map(f => PREGUNTA[f] || `Falta: ${f}.`),
      permiso: { puede, dice: puede ? "" : `Esto lo confirma ${op.confirma.map(r => NOMBRE_DE_ROL[r] || r).join(" o ")}: ${op.porque}.` },
      dinero: op.dinero, mismoDineroQue, yaHecha: hechas.has(id),
      lista: !hechas.has(id) && falta.length === 0 && !mismoDineroQue };
  });
  return { mensaje: { id: mensaje.id, canal: mensaje.canal || "app", de: mensaje.de, cuando: mensaje.cuando }, propuestas,
    porPreguntar: propuestas.filter(p => p.preguntas.length && !p.yaHecha).map(p => ({ id: p.id, frase: p.frase, preguntas: p.preguntas })),
    resumen: resumir(propuestas) };
}
export const NOMBRE_DE_ROL = { admin: "un administrador", encargado: "un encargado", finanzas: "finanzas", agronomo: "el agrónomo", dueno: "dirección", trabajador: "el trabajador" };
function resumir(props) {
  const n = (f) => props.filter(f).length;
  return { total: props.length, listas: n(p => p.lista && p.permiso.puede), porCompletar: n(p => p.falta.length > 0 && !p.yaHecha), deOtroPermiso: n(p => p.lista && !p.permiso.puede), yaHechas: n(p => p.yaHecha), repetidas: n(p => !!p.mismoDineroQue) };
}
// Cómo se enseña una propuesta en una línea.
export function decirPropuesta(p) {
  const d = p.datos;
  if (p.tipo === "avance") return `${d.cantidad ? `${d.cantidad.valor} ${d.unidad ? decirUnidad(d.unidad, d.cantidad.valor) : d.cantidad.unidad}` : "Avance"}${d.actividad ? ` de ${d.actividad}` : ""}${d.parcelaNombre ? ` en ${d.parcelaNombre}` : ""}${d.personasN ? ` · ${d.personasN} persona(s)` : ""}${d.pendiente ? " · quedó pendiente" : ""}`;
  if (p.tipo === "gasto") return `Gasto${d.monto != null ? ` de $${d.monto.toLocaleString("es-MX")}` : ""}`;
  if (p.tipo === "actividad") return `Trabajo de ${d.personas.map(x => x.nombre).join(", ") || "—"}${d.parcelaNombre ? ` en ${d.parcelaNombre}` : ""}`;
  if (p.tipo === "cosecha") return `Cosecha${d.cantidad ? ` de ${d.cantidad.valor} ${d.cantidad.unidad}` : ""}${d.parcelaNombre ? ` de ${d.parcelaNombre}` : ""}`;
  if (p.tipo === "nota") return `Nota · ${NATURALEZAS[p.naturaleza].toLowerCase()}`;
  return OPERACIONES[p.tipo].nombre;
}

// 4 y 5 · Confirmar una propuesta: revisa permiso y faltantes, y devuelve QUÉ se escribe (no escribe: eso lo hace la pantalla).
//   quien { id, nombre, rol } = quien confirma (no necesariamente quien lo dijo).  evidencia { audio, foto } va pegada al registro.
export function ejecutar(propuesta, { mensaje, quien, cuando, fecha, parcelas = [], evidencia = {} }) {
  const p = propuesta, op = OPERACIONES[p.tipo];
  if (!op) return { ok: false, dice: "Eso todavía no se registra por aquí." };
  if (p.yaHecha) return { ok: false, dice: "Esto ya se registró de este mismo mensaje." };
  if (!op.confirma.includes(quien?.rol)) return { ok: false, dice: `Esto lo confirma ${op.confirma.map(r => NOMBRE_DE_ROL[r] || r).join(" o ")}: ${op.porque}.`, sinPermiso: true };
  if (p.falta.length) return { ok: false, dice: p.preguntas[0], falta: p.falta };
  if (p.mismoDineroQue) return { ok: false, dice: "Es el mismo dinero que otra parte de este mensaje: se registra una sola vez." };
  const d = p.datos, origen = { mensaje: mensaje.id, propuesta: p.id, canal: mensaje.canal || "app", frase: p.frase, dijo: mensaje.de?.nombre || "", confirmo: quien.nombre || "" };
  const comun = { fecha: d.fecha || fecha, origenDicho: p.frase, origen, ...(evidencia.audio ? { audio: evidencia.audio } : {}), ...(evidencia.foto ? { foto: evidencia.foto } : {}), registradoPor: { rol: quien.rol, id: quien.id, nombre: quien.nombre } };
  const una = (coleccion, registro) => ({ ok: true, escrituras: [{ coleccion, registro }], dice: `${op.nombre}: quedó en ${op.a}.` });
  if (p.tipo === "avance") {
    const r = registrarAvance({ id: `ev-avance-${p.id}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 120), parcelaId: d.parcelaId, parcelas, actividad: d.actividad, cantidad: d.cantidad?.valor, unidad: d.unidad || "otra", unidadDicha: d.unidad ? "" : d.cantidad?.unidad, personas: d.personasN, pendiente: d.pendiente, origen, quien, cuando, fecha: d.fecha || fecha });
    return r.ok ? una("eventos", r.evento) : r;
  }
  if (p.tipo === "gasto") return una("egresos", { ...comun, concepto: p.frase.slice(0, 90), monto: d.monto, categoria: "insumos", proveedor: d.proveedor || "" });
  if (p.tipo === "actividad") return { ok: true, dice: `Trabajo de ${d.personas.length} persona(s): quedó en Actividades.`, escrituras: d.personas.map(per => ({ coleccion: "actividades", registro: { ...comun, parcelaId: d.parcelaId, tipo: "Trabajo de campo", horas: d.horas, trabajadorId: per.id, nota: p.frase } })) };
  if (p.tipo === "necesidad") return una("solicitudes_compra", { ...comun, concepto: p.frase, estado: "pendiente", paraQuien: d.paraQuien });
  if (p.tipo === "incidencia") return una("incidencias", { ...comun, descripcion: p.frase, estado: "pendiente" });
  if (p.tipo === "cosecha") return una("cosechas", { ...comun, parcelaId: d.parcelaId, registros: [{ cantidad: d.cantidad.valor, unidad: d.cantidad.unidad }] });
  if (p.tipo === "nota") return una("bitacora", { ...comun, nota: p.frase, naturaleza: p.naturaleza, ...(p.tipoEntendido !== "nota" ? { sonabaA: p.tipoEntendido } : {}), ...(d.parcelaId ? { parcelaId: d.parcelaId } : {}) });
  return { ok: false, dice: "Eso todavía no se registra por aquí." };
}
