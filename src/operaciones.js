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
import { entenderLoDicho, numerosDichos, aQuienesSeRefiere, deQueParcela } from "./voz.js";
import { solicitarPrestamo } from "./prestamos.js";

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
  actividad: { nombre: "Trabajo de personas en una parcela", confirma: ["admin", "encargado"], dinero: true, requiereSesion: true, a: "Actividades", porque: "el registro de campo lo confirma el encargado" },
  cosecha: { nombre: "Cosecha", confirma: ["admin", "encargado"], dinero: false, a: "Cosechas", porque: "la cosecha la confirma el encargado" },
  gasto: { nombre: "Gasto", confirma: ["admin", "finanzas"], dinero: true, requiereSesion: true, a: "Egresos", porque: "un gasto lo confirma quien lleva las cuentas" },
  necesidad: { nombre: "Algo que hace falta", confirma: ["admin", "encargado", "finanzas", "agronomo"], dinero: false, a: "Solicitudes de compra", porque: "pedir no es comprar: cualquiera con captura puede levantar la necesidad" },
  incidencia: { nombre: "Incidencia", confirma: ["admin", "encargado", "agronomo"], dinero: false, a: "Incidencias", porque: "una incidencia la levanta quien la ve" },
  fertirriego: { nombre: "Indicación de fertirriego", confirma: ["admin", "agronomo", "encargado"], dinero: false, a: "Indicaciones", porque: "la indicación la confirma el agrónomo o quien la ejecuta" },
  // Lo dicho de un préstamo nace como SOLICITUD (prestamos.js): no es deuda, no es gasto y no descuenta nada.
  prestamo: { nombre: "Solicitud de préstamo", confirma: ["admin", "encargado", "finanzas"], dinero: false, requiereSesion: true, a: "Préstamos, como solicitud por autorizar", porque: "pedir un préstamo no lo autoriza ni lo entrega" },
  nota: { nombre: "Nota en la bitácora", confirma: ["admin", "encargado", "finanzas", "agronomo"], dinero: false, a: "Bitácora", porque: "una nota no mueve nada" },
};
// Lo que la gente va a decir y TODAVÍA no se registra por aquí. Se reconoce para decir a dónde ir; no se guarda parecido.
export const POR_CONECTAR = [
  { clave: "pago", senas: /\b(le pague a|les pague|pagamos la raya|pague la raya|pago de la semana|la nomina)\b/, dice: "Suena a un pago al personal. Eso se entrega y se confirma en «Pagos al personal», con su autorización. Todavía no se registra hablando.", pantalla: "nomina" },
  { clave: "aplicacion", senas: /\b(aplicamos|se aplico|aplique|fumigamos|se fumigo|herbicida|insecticida|fungicida|bactericida)\b/, dice: "Suena a una aplicación de un producto. Lleva producto, dosis, quién la indicó y por qué, y sus tiempos de seguridad: se registra en «Aplicaciones». Todavía no se registra hablando.", pantalla: "aplicaciones" },
  { clave: "almacen", senas: /\b(saque del almacen|sacamos del almacen|entro al almacen|llego al almacen|entregue del almacen)\b/, dice: "Suena a un movimiento del almacén. Las entradas y las entregas se registran en «Entregas del almacén», para que la existencia cuadre. Todavía no se registra hablando.", pantalla: "entregas" },
];

const SENAS_DE_PRESTAMO = /\b(le preste|le prestamos|se le presto|prestamo a|un prestamo|me presto|adelanto de sueldo|le adelante|le adelantamos)\b/;
const AVISO_DE_PRESTAMO = "Queda como SOLICITUD de préstamo: todavía no es deuda y no descuenta nada. La deuda nace cuando alguien con permiso lo autoriza y registra la entrega en «Préstamos».";
// Con cuánta sesión se confirma: lo que mueve dinero o toca a una persona no se confirma sólo por venir de un teléfono conocido.
const SIN_SESION = "Esto no se confirma desde un teléfono, aunque sea conocido: se confirma dentro de la app, con tu sesión.";
const PREGUNTA = {
  "a quién se le prestó": "¿A quién se le prestó? (una persona, con nombre)", "cuánto se prestó": "¿Cuánto se prestó?", "cuántos fueron": "¿Cuántos fueron en total? (Si ese precio ya era el total, dilo: «fue el total».)",
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
    else if (["nota", "gasto", "actividad"].includes(tipo) && SENAS_DE_PRESTAMO.test(plano(p.frase))) {
      tipo = "prestamo"; aviso = AVISO_DE_PRESTAMO; falta.length = 0;
      if ((p.personas || []).length !== 1) falta.push("a quién se le prestó");
      if (p.monto == null) falta.push("cuánto se prestó");
    }
    const datos = { fecha: p.fecha, parcelaId: p.parcelas?.[0]?.id || "", parcelaNombre: p.parcelas?.[0]?.nombre || "", personas: (p.personas || []).map(x => ({ id: x.id, nombre: x.nombre })), monto: p.monto ?? null, precioUnitario: p.precioUnitario ?? null, pagadoCon: p.pagadoCon || null, horas: p.horas ?? null, cantidad: p.cantidad || null, paraQuien: p.paraQuien || null };
    if (tipo === "avance") { datos.actividad = p.actividad || actividadDicha(p.frase); datos.unidad = unidadDe(p.cantidad?.unidad) || null; datos.personasN = p.personasN ?? null; datos.pendiente = p.pendiente || null; if (!datos.actividad) falta.push("de qué actividad"); }
    if ((p.ambiguos || []).length) falta.push(`cuál de las personas es «${p.ambiguos.map(a => a.dijo || a.nombre || "").join("», «")}» (${p.ambiguos.map(a => (a.candidatos || []).map(c => c.nombre).join(" o ")).join("; ")})`);
    const op = OPERACIONES[tipo], puede = op.confirma.includes(rol);
    // El mismo dinero dicho dos veces en un mensaje (el gasto y otra vez su total) cuenta una sola vez.
    let mismoDineroQue = null;
    if (op.dinero && datos.monto != null) { if (montos.has(datos.monto)) mismoDineroQue = montos.get(datos.monto); else montos.set(datos.monto, id); }
    const soloTelefono = mensaje.de.via === "telefono" && !!op.requiereSesion;
    return { id, i: p.i, grupo: mensaje.id, tipo, tipoEntendido: p.tipo, naturaleza, frase: p.frase, seguro: !!p.seguro, porque: p.porque || "", datos, aviso, pantalla: sinConectar?.pantalla || null,
      sobre: p.sobre || null, momento: p.momento || null, heredado: p.heredado || [],
      aclaraciones: p.aclaraciones || [], requiereSesion: !!op.requiereSesion, soloTelefono,
      falta, preguntas: falta.map(f => PREGUNTA[f] || `Falta: ${f}.`),
      permiso: { puede: puede && !soloTelefono, dice: soloTelefono ? SIN_SESION : puede ? "" : `Esto lo confirma ${op.confirma.map(r => NOMBRE_DE_ROL[r] || r).join(" o ")}: ${op.porque}.` },
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
  if (p.tipo === "prestamo") return `Solicitud de préstamo${d.monto != null ? ` de $${d.monto.toLocaleString("es-MX")}` : ""}${d.personas.length === 1 ? ` para ${d.personas[0].nombre}` : ""}`;
  if (p.tipo === "gasto") return `Gasto${d.monto != null ? ` de $${d.monto.toLocaleString("es-MX")}` : ""}${d.precioUnitario != null && d.cantidad?.valor ? ` (${d.cantidad.valor.toLocaleString("es-MX")} ${d.cantidad.unidad || ""} × $${d.precioUnitario.toLocaleString("es-MX")})`.replace(/\s+×/, " ×") : ""}${d.pagadoCon ? ` · ${FORMAS_DE_PAGO.find(f => f.clave === d.pagadoCon)?.nombre || d.pagadoCon}` : ""}`;
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
  // Un teléfono conocido dice quién escribe; no alcanza para autorizar lo que mueve dinero o toca a una persona.
  if (op.requiereSesion && quien?.via === "telefono") return { ok: false, requiereSesion: true, dice: SIN_SESION };
  if (!op.confirma.includes(quien?.rol)) return { ok: false, dice: `Esto lo confirma ${op.confirma.map(r => NOMBRE_DE_ROL[r] || r).join(" o ")}: ${op.porque}.`, sinPermiso: true };
  if (p.falta.length) return { ok: false, dice: p.preguntas[0], falta: p.falta };
  if (p.mismoDineroQue) return { ok: false, dice: "Es el mismo dinero que otra parte de este mensaje: se registra una sola vez." };
  const d = p.datos, origen = { mensaje: mensaje.id, propuesta: p.id, canal: mensaje.canal || "app", frase: p.frase, dijo: mensaje.de?.nombre || "", confirmo: quien.nombre || "",
    // La conversación completa: lo que se dijo primero, cada aclaración con quién y cuándo, y quién confirmó al final.
    ...((p.aclaraciones || []).length ? { aclaraciones: p.aclaraciones.map(a => ({ mensaje: a.id, pregunta: a.pregunta, texto: a.texto, dijo: a.de?.nombre || "", cuando: a.cuando, entendido: a.entendido })) } : {}) };
  const comun = { fecha: d.fecha || fecha, origenDicho: p.frase, origen, ...(evidencia.audio ? { audio: evidencia.audio } : {}), ...(evidencia.foto ? { foto: evidencia.foto } : {}), registradoPor: { rol: quien.rol, id: quien.id, nombre: quien.nombre } };
  const una = (coleccion, registro) => ({ ok: true, escrituras: [{ coleccion, registro }], dice: `${op.nombre}: quedó en ${op.a}.` });
  if (p.tipo === "avance") {
    const r = registrarAvance({ id: `ev-avance-${p.id}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 120), parcelaId: d.parcelaId, parcelas, actividad: d.actividad, cantidad: d.cantidad?.valor, unidad: d.unidad || "otra", unidadDicha: d.unidad ? "" : d.cantidad?.unidad, personas: d.personasN, pendiente: d.pendiente, origen, quien, cuando, fecha: d.fecha || fecha });
    return r.ok ? una("eventos", r.evento) : r;
  }
  if (p.tipo === "prestamo") {
    const r = solicitarPrestamo({ trabajador: d.personas[0], monto: d.monto, motivo: p.frase, quien, cuando, fecha: d.fecha || fecha, azar: `dicho-${p.id}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80) });
    if (!r.ok) return r;
    r.evento.datos.origenDicho = origen; r.evento.datos.dichoComoYaEntregado = /\b(le preste|le prestamos|se le presto|le adelante|le adelantamos)\b/.test(plano(p.frase));
    return una("eventos", r.evento);
  }
  if (p.tipo === "gasto") return una("egresos", { ...comun, concepto: p.frase.slice(0, 90), monto: d.monto, categoria: "insumos", proveedor: d.proveedor || "", ...(d.pagadoCon ? { pagadoCon: d.pagadoCon } : {}),
    // Cómo salió el total, si fue precio × cantidad: así se puede revisar la cuenta.
    ...(d.precioUnitario != null && d.cantidad?.valor ? { precioUnitario: d.precioUnitario, cantidad: d.cantidad.valor, unidad: d.cantidad.unidad || "" } : {}) });
  if (p.tipo === "actividad") return { ok: true, dice: `Trabajo de ${d.personas.length} persona(s): quedó en Actividades.`, escrituras: d.personas.map(per => ({ coleccion: "actividades", registro: { ...comun, parcelaId: d.parcelaId, tipo: "Trabajo de campo", horas: d.horas, trabajadorId: per.id, nota: p.frase } })) };
  // Con la MISMA forma que usan sus pantallas (si no, la pantalla no lo enseña o truena al leerlo).
  // De lo que hace falta se guarda lo dicho en las notas; los productos no se inventan.
  if (p.tipo === "necesidad") return una("solicitudes_compra", { ...comun, notas: p.frase, items: [], estado: "pendiente", paraQuien: d.paraQuien, creadaPor: { id: mensaje.de?.id || quien.id, nombre: mensaje.de?.nombre || quien.nombre || "", rol: mensaje.de?.rol || quien.rol } });
  if (p.tipo === "incidencia") return una("incidencias", { ...comun, desc: p.frase, tipo: "otro", prioridad: "media", trabajadorId: mensaje.de?.id || quien.id, estado: "pendiente" });
  if (p.tipo === "cosecha") return una("cosechas", { ...comun, parcelaId: d.parcelaId, registros: [{ cantidad: d.cantidad.valor, unidad: d.cantidad.unidad }] });
  if (p.tipo === "nota") return una("bitacora", { ...comun, nota: p.frase, naturaleza: p.naturaleza, ...(p.tipoEntendido !== "nota" ? { sonabaA: p.tipoEntendido } : {}), ...(d.parcelaId ? { parcelaId: d.parcelaId } : {}),
    // De qué otro mensaje de la conversación es seguimiento, y si es lo programado o lo ya ejecutado.
    ...(p.sobre ? { sobre: p.sobre } : {}), ...(p.momento ? { momento: p.momento } : {}), ...(p.heredado?.length ? { heredado: p.heredado } : {}) });
  return { ok: false, dice: "Eso todavía no se registra por aquí." };
}

/* ── El chat de adentro entra por el mismo camino ──
   Antes el chat guardaba por su cuenta: sin revisar quién confirmaba y sin dejar dicho de qué
   mensaje salió cada registro. Aquí se decide QUÉ se escribe al firmar una propuesta del chat.
   · Lo dicho o escrito pasa por `preparar` y `ejecutar`, igual que «Dile a la app».
   · La hoja de fertirriego y el papel fotografiado conservan lo que ya se leyó de ellos, pero
     con el mismo permiso y el mismo rastro.
   No escribe nada: devuelve las escrituras. Si no se puede, dice por qué y NO se debe firmar. */
export function confirmarDelChat({ mensaje, propuesta, quien, hoy, cuando, parcelas = [] }) {
  const pr = propuesta || {};
  if (!mensaje?.id) return { ok: false, dice: "Falta el mensaje de donde salió esto." };
  if (!quien?.id || !quien?.rol) return { ok: false, dice: "Falta quién lo está confirmando." };
  if (pr.confirmacion) return { ok: false, dice: "Esto ya se firmó: no se registra dos veces." };
  const de = mensaje.de?.id ? mensaje.de : { id: mensaje.deQuien || "sin-nombre", nombre: mensaje.deQuien || "", rol: null };
  const msj = { id: mensaje.id, canal: mensaje.canal || "chat", de, cuando: mensaje.cuando };
  const evidencia = { foto: mensaje.foto?.dataUrl || null, audio: mensaje.audio?.dataUrl || null };
  if (pr.parteDe != null) return { ok: true, escrituras: [], camino: "comun", dice: "Va junto con el avance del que es parte: no se registra aparte." };

  if (typeof pr.i === "number") {
    const dichas = (mensaje.propuestas || []).filter(x => typeof x.i === "number").map(x => (x.id === pr.id ? pr : x));
    const plan = preparar({ mensaje: msj, entendido: { propuestas: dichas } });
    const p = plan.propuestas.find(x => x.i === pr.i);
    if (!p) return { ok: false, dice: "No se encontró esa parte del mensaje." };
    // Lo que la persona corrigió en el chat manda sobre lo que se entendió.
    if (pr.parcelaId && pr.parcelaId !== p.datos.parcelaId) {
      p.datos.parcelaId = pr.parcelaId;
      p.datos.parcelaNombre = parcelas.find(x => x.id === pr.parcelaId)?.nombre || "";
    }
    // Pasó cuando se dijo, no cuando alguien lo firmó.
    const r = ejecutar(p, { mensaje: msj, quien, cuando: mensaje.cuando || cuando, fecha: hoy, parcelas, evidencia });
    return { ...r, camino: "comun", tipo: p.tipo, aviso: p.aviso || "" };
  }

  // La hoja de fertirriego y el papel leído.
  const tipo = OPERACIONES[pr.tipo] ? pr.tipo : "nota", op = OPERACIONES[tipo];
  if (!op.confirma.includes(quien.rol)) return { ok: false, sinPermiso: true, dice: `Esto lo confirma ${op.confirma.map(r => NOMBRE_DE_ROL[r] || r).join(" o ")}: ${op.porque}.` };
  if (pr.confiable === false) return { ok: false, dice: "La hoja no cuadra: no entra hasta aclararla." };
  if ((pr.falta || []).length) return { ok: false, falta: pr.falta, dice: `Falta: ${pr.falta.join(", ")}.` };
  const frase = pr.frase || pr.resumen || "";
  const origen = { mensaje: msj.id, propuesta: pr.id, canal: "chat", frase, dijo: de.nombre || "", confirmo: quien.nombre || "", de: pr.deQue || "foto" };
  const comun = { fecha: pr.fecha || hoy, origen, origenChat: { mensajeId: msj.id, de: de.nombre || "", cuando: msj.cuando },
    ...(evidencia.foto ? { foto: evidencia.foto } : {}), ...(evidencia.audio ? { audio: evidencia.audio } : {}),
    registradoPor: { rol: quien.rol, id: quien.id, nombre: quien.nombre } };
  const una = (coleccion, registro) => ({ ok: true, camino: "papel", tipo, escrituras: [{ coleccion, registro }], dice: `${op.nombre}: quedó en ${op.a}.` });
  if (tipo === "fertirriego") {
    if (!pr.indicacion) return { ok: false, dice: "La hoja no trae la indicación completa." };
    const a = pr.destino?.paraQuien || null, ind = pr.indicacion;
    return una("indicaciones", { ...comun, tipo: "fertirriego", estado: a ? "mandada" : "propuesta", parcelaId: ind.parcelaId, asignadoA: a?.id || null,
      cultivo: ind.cultivo, parcelaNombre: ind.parcelaNombre, superficie: ind.superficie, productos: ind.productos, resumen: ind.resumen, deQuien: ind.deQuien });
  }
  if (tipo === "gasto") {
    if (pr.monto == null) return { ok: false, falta: ["cuánto costó"], dice: "Falta cuánto costó: el total sale del papel o se pregunta, no se supone." };
    return una("egresos", { ...comun, concepto: (frase || "Gasto del chat").slice(0, 90), monto: pr.monto, categoria: "insumos", proveedor: pr.proveedor || "" });
  }
  return una("bitacora", { ...comun, nota: frase || "(del chat)", ...(pr.tipo && pr.tipo !== "nota" ? { sonabaA: pr.tipo } : {}) });
}

/* ── LA CONVERSACIÓN CONTINÚA ──
   Cuando a una propuesta le falta algo, se pregunta, y la respuesta se entiende DENTRO de esa operación pendiente:
   «20 pesos el kilo» después de «¿Cuánto costó?» es el precio de aquellos clavos, no un gasto nuevo de 20 pesos.
   · Trabaja sobre la propuesta tal como se entendió (la de `entenderLoDicho`); `preparar` la vuelve a revisar.
   · No adivina: si la respuesta no contesta lo que falta, se dice y se vuelve a preguntar.
   · Nada se pierde: la frase original no cambia, cada aclaración queda con quién, cuándo y qué se entendió de ella
     (también la que no se entendió), y `comoLlego` guarda cómo venía antes de aclararse. */
const POR_UNIDAD = /\b(el|la|por|cada|c\/u|x)\s+(kilo|kg|litro|lt|bulto|costal|caja|pieza|metro|tonelada|rollo|saco|galon|uno|una)\b|\bcada uno\b|\bc\/u\b|\bpor pieza\b/;
const pesos = (n) => `$${Number(n).toLocaleString("es-MX")}`;
const ES_DINERO = /^(peso|pesos|varo|varos)$/;
// El primer número de la respuesta, con su unidad si la trae. «tres kilos» no es dinero; «350» o «350 pesos» sí puede serlo.
const numeroEn = (texto) => {
  const m = String(texto).replace(/,(?=\d{3})/g, "").match(/(\$)?\s*(\d+(?:\.\d+)?)\s*([a-záéíóúñ]+)?/i);
  if (m) return { valor: Number(m[2]), unidad: m[3] && !/^(el|la|los|las|por|cada|en|de|a|y)$/i.test(m[3]) ? plano(m[3]) : null, pesos: !!m[1] };
  const n = numerosDichos(texto)[0];
  return n && n.valor > 0 ? { valor: n.valor, unidad: n.unidad ? plano(n.unidad) : null, pesos: false } : null;
};
const comoDinero = (n) => (n && (n.pesos || !n.unidad || ES_DINERO.test(n.unidad)) ? n.valor : null);
// De dónde salió el dinero, si alguien lo dice («se pagó de caja chica»). Se anota; no mueve ninguna caja por sí solo.
export const FORMAS_DE_PAGO = [
  { clave: "caja_chica", nombre: "caja chica", senas: /\bcaja chica\b/ }, { clave: "tarjeta", nombre: "tarjeta", senas: /\b(con|de) (la|mi|su) tarjeta\b|\bcon tarjeta\b/ },
  { clave: "transferencia", nombre: "transferencia", senas: /\btransferencia\b|\bse transfirio\b|\ble transferi\b/ }, { clave: "credito", nombre: "a crédito (se debe)", senas: /\ba credito\b|\bfiado\b|\bse quedo a deber\b|\bse debe\b/ },
  { clave: "de_su_bolsa", nombre: "lo puso de su bolsa", senas: /\bde (mi|su) bolsa\b|\blo puse yo\b|\blo puso (el|ella)\b/ }, { clave: "efectivo", nombre: "efectivo", senas: /\ben efectivo\b|\bde contado\b/ },
];
export const formaDePagoDicha = (texto) => FORMAS_DE_PAGO.find(f => f.senas.test(plano(texto))) || null;

export function preguntaDe(falta) { return PREGUNTA[falta] || `Falta: ${falta}.`; }

export function aclarar({ propuesta, respuesta, personas = [], parcelas = [], hoy }) {
  const p = propuesta || {}, texto = String(respuesta?.texto || "").trim(), t = plano(texto);
  if (!texto) return { ok: false, propuesta: p, dice: "Falta la respuesta." };
  if (p.confirmacion) return { ok: false, propuesta: p, dice: "Esto ya se firmó: ya no se le aclara nada." };
  const esPrestamo = SENAS_DE_PRESTAMO.test(plano(p.frase)) && ["nota", "gasto", "actividad"].includes(p.tipo);
  const esAvance = p.tipo === "avance";
  // Lo que falta, con el mismo criterio que `preparar`.
  let falta = esPrestamo ? [...((p.personas || []).length !== 1 ? ["a quién se le prestó"] : []), ...(p.monto == null ? ["cuánto se prestó"] : [])] : [...(p.falta || [])];
  if (esAvance && !(p.actividad || actividadDicha(p.frase)) && !falta.includes("de qué actividad")) falta.push("de qué actividad");
  const habiaAmbiguos = (p.ambiguos || []).length > 0;
  const pago = ["gasto"].includes(p.tipo) && !esPrestamo ? formaDePagoDicha(texto) : null;
  if (!falta.length && !habiaAmbiguos && !pago) return { ok: false, propuesta: p, dice: "A esto ya no le falta nada." };
  const pregunta = falta.length ? preguntaDe(falta[0]) : habiaAmbiguos ? "¿Cuál de las personas es?" : null;   // null: nadie preguntó; alguien lo aclaró por su cuenta
  const cambios = {}, entendio = [], resueltas = new Set(), nuevas = [];
  const suelto = entenderLoDicho({ texto, personas, parcelas, insumos: [], hoy }).propuestas?.[0] || {};
  for (const f of falta) {
    if (f === "cuánto costó" || f === "cuánto se prestó") {
      const leido = numeroEn(texto), n = comoDinero(leido);
      if (n == null) {
        // Contestó una cantidad («tres kilos»), no un precio: se anota la cantidad y se sigue preguntando el precio.
        if (leido && f === "cuánto costó" && !p.cantidad) { cambios.cantidad = { valor: leido.valor, unidad: leido.unidad, dicho: texto }; entendio.push(`la cantidad: ${leido.valor} ${leido.unidad}`); }
        continue;
      }
      if (f === "cuánto costó" && POR_UNIDAD.test(t)) {
        // Un precio por unidad no es el total: se multiplica por lo que se dijo que se compró, o se pregunta cuánto fue.
        if (p.cantidad?.valor > 0) { cambios.monto = Math.round(n * p.cantidad.valor * 100) / 100; cambios.precioUnitario = n; entendio.push(`${pesos(n)} por unidad × ${p.cantidad.valor} ${p.cantidad.unidad || ""} = ${pesos(cambios.monto)}`.replace(/\s+=/, " =")); resueltas.add(f); }
        else { cambios.precioUnitario = n; entendio.push(`${pesos(n)} por unidad; falta saber cuántos fueron`); resueltas.add(f); nuevas.push("cuántos fueron"); }
      } else { cambios.monto = n; entendio.push(`el importe: ${pesos(n)}`); resueltas.add(f); }
    } else if (f === "cuántos fueron") {
      const n = numeroEn(texto)?.valor ?? null;
      // «Fue el total»: el precio que se dijo ya era lo de todo, no el de cada uno.
      if (n == null && p.precioUnitario != null && /\b(total|todo|fue todo|por todo|eso fue)\b/.test(t)) {
        cambios.monto = p.precioUnitario; cambios.precioUnitario = null; entendio.push(`${pesos(p.precioUnitario)} fue el total`); resueltas.add(f); continue;
      }
      if (n == null) continue;
      cambios.cantidad = { valor: n, unidad: suelto.cantidad?.unidad || "", dicho: texto }; cambios.monto = Math.round(n * p.precioUnitario * 100) / 100;
      entendio.push(`${n} × ${pesos(p.precioUnitario)} = ${pesos(cambios.monto)}`); resueltas.add(f);
    } else if (f === "quién trabajó" || f === "a quién se le prestó") {
      const q = aQuienesSeRefiere(texto, personas);
      if (!q.personas.length || q.ambiguos.length) continue;
      if (f === "a quién se le prestó" && q.personas.length !== 1) continue;
      cambios.personas = q.personas; entendio.push(`${f === "quién trabajó" ? "quién trabajó" : "para quién"}: ${q.personas.map(x => x.nombre).join(", ")}`); resueltas.add(f);
    } else if (/parcela/.test(f)) {
      const q = deQueParcela(texto, parcelas);
      if (q.parcelas.length !== 1) continue;
      cambios.parcelas = q.parcelas; cambios.parcelaId = q.parcelas[0].id; entendio.push(`la parcela: ${q.parcelas[0].nombre}`); resueltas.add(f);
    } else if (f === "cuánto se cosechó" || f.startsWith("cuánto se avanzó")) {
      if (!suelto.cantidad?.valor) continue;
      cambios.cantidad = suelto.cantidad; entendio.push(`la cantidad: ${suelto.cantidad.valor} ${suelto.cantidad.unidad || ""}`.trim()); resueltas.add(f);
    } else if (f === "de qué actividad") {
      const a = actividadDicha(texto);
      if (!a) continue;
      cambios.actividad = a; entendio.push(`la actividad: ${a}`); resueltas.add(f);
    }
  }
  // «Dijo el Chino y hay dos»: la respuesta con el nombre completo lo resuelve.
  if (habiaAmbiguos) {
    const q = aQuienesSeRefiere(texto, personas);
    if (q.personas.length && !q.ambiguos.length) { const ya = new Set((cambios.personas || p.personas || []).map(x => x.id)); cambios.personas = [...(cambios.personas || p.personas || []), ...q.personas.filter(x => !ya.has(x.id))]; cambios.ambiguos = []; entendio.push(`quién es: ${q.personas.map(x => x.nombre).join(", ")}`); }
  }
  if (pago && !p.pagadoCon) { cambios.pagadoCon = pago.clave; entendio.push(`cómo se pagó: ${pago.nombre}`); }
  const aclaracion = { id: respuesta.id || null, pregunta, texto, de: respuesta.de ? { id: respuesta.de.id, nombre: respuesta.de.nombre || "" } : null, cuando: respuesta.cuando || null, entendido: entendio.length ? entendio.join(" · ") : null };
  const antes = {}; for (const k of Object.keys(cambios)) antes[k] = p[k] ?? null;
  const queda = esPrestamo ? [] : [...falta.filter(f => !resueltas.has(f) && f !== "de qué actividad"), ...nuevas];
  const nueva = { ...p, ...cambios, falta: queda, aclaraciones: [...(p.aclaraciones || []), aclaracion], ...(entendio.length ? { comoLlego: { ...antes, ...(p.comoLlego || {}) } } : {}) };
  const sigue = [...falta.filter(f => !resueltas.has(f)), ...nuevas];
  if (!entendio.length) return { ok: false, propuesta: nueva, sigueFaltando: sigue, dice: `No entendí esa respuesta. ${pregunta || ""}`.trim() };
  return { ok: true, propuesta: nueva, entendio, sigueFaltando: sigue, dice: sigue.length ? `Anotado (${entendio.join("; ")}). ${preguntaDe(sigue[0])}` : `Anotado (${entendio.join("; ")}). Ya no falta nada: se puede confirmar.` };
}

// La pregunta que AgroGestión tiene abierta con una persona: lo último que dijo y todavía le falta algo.
// Sólo vale si es lo más reciente de esa persona y no pasó la ventana: contestar tres días después ya no es contestar.
export function pendienteDe(mensajes, personaId, ahora, { horas = 24 } = {}) {
  const suyos = (mensajes || []).filter(m => m && !m.aclaraA && (m.de?.id || m.deId) === personaId && m.cuando).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));
  const ultimo = suyos[0];
  if (!ultimo || new Date(ahora).getTime() - new Date(ultimo.cuando).getTime() > horas * 3600000) return null;
  const msj = { id: ultimo.id, canal: ultimo.canal || "chat", de: ultimo.de?.id ? ultimo.de : { id: personaId, nombre: "", rol: null }, cuando: ultimo.cuando };
  const dichas = (ultimo.propuestas || []).filter(x => typeof x.i === "number");
  if (!dichas.length) return null;
  const plan = preparar({ mensaje: msj, entendido: { propuestas: dichas } });
  for (const pr of plan.propuestas) {
    const cruda = dichas.find(x => x.i === pr.i);
    if (cruda.confirmacion || !pr.preguntas.length) continue;
    return { mensaje: ultimo, propuesta: cruda, pregunta: pr.preguntas[0], frase: pr.frase };
  }
  return null;
}

// ¿Lo que se acaba de escribir es la respuesta a la pregunta abierta, o es otra cosa?
// Es respuesta sólo si es corto (una frase) y de verdad contesta lo que se preguntó. En la duda, es un mensaje nuevo.
export function esRespuesta({ pendiente, texto, personas = [], parcelas = [], hoy }) {
  const limpio = String(texto || "").trim();
  if (!pendiente || !limpio) return { es: false };
  if (limpio.split(/\s+/).length > 8 || /[.!?]\s+\S/.test(limpio)) return { es: false, porque: "Es largo o trae varias frases: se toma como un mensaje nuevo." };
  const r = aclarar({ propuesta: pendiente.propuesta, respuesta: { texto: limpio }, personas, parcelas, hoy });
  return r.ok ? { es: true } : { es: false, porque: "No contesta lo que se preguntó: se toma como un mensaje nuevo." };
}

// Entre personas casi todo es plática. Sólo se propone algo de una frase que de verdad dice algo del trabajo:
// un hecho reconocido, algo que se vio, una sospecha, una decisión, algo por hacer o algo que hace falta.
// Una pregunta o un «ok, gracias» no son una propuesta de nada.
const SE_VIO = /\b(vimos|vi|se ve|se ven|se nota|hay mucha|hay mucho|hay muchos|encontramos|encontre|note|notamos|trae|anda con|plaga|gusano|mancha|fuga|se esta secando|se descompuso|no sirve|se rompio)\b/;
export function esOperativo(frase, tipo) {
  const t = ` ${plano(frase)} `;
  if (/\?\s*$/.test(String(frase || "").trim())) return false;
  if (tipo !== "nota") return true;
  return naturalezaDe(frase, tipo) !== "observacion" || SE_VIO.test(t) || SENAS_DE_PRESTAMO.test(t) || POR_CONECTAR.some(x => x.senas.test(t));
}
