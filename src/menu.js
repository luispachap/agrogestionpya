// ════════════════════════════════════════════════════════════════════════
//  MENÚ — encontrar las cosas
//
//  El inicio del administrador eran 35 tarjetas iguales, una tras otra, en casi
//  cuatro pantallas de alto: encontrar algo era un trabajo. Aquí vive el orden:
//    · cada pantalla tiene UN nombre y vive en UN grupo;
//    · cada perfil ve sólo las suyas;
//    · cada persona ancla al inicio lo que usa, y escoge qué va en la barra de
//      abajo; lo que más abre sube solo a "Lo que más usas";
//    · dos administradores no hacen el mismo trabajo: cada uno dice a qué se
//      dedica más y la app le abre con eso, en su orden, y puede esconder los
//      grupos que no le tocan. Esconder NO quita permiso: es sólo no estorbar.
//  La app ACOMODA, no decide: lo anclado por la persona nunca lo mueve el uso.
//  Todo es puro: quién guarda y dónde lo decide App.jsx (LLAVES.menu).
// ════════════════════════════════════════════════════════════════════════

export const GRUPOS = [
  { id: "campo", nombre: "Campo", icono: "🌾" },
  { id: "ajo", nombre: "Bodega y ajo", icono: "🏭" },
  { id: "dinero", nombre: "Dinero", icono: "💵" },
  { id: "almacen", nombre: "Almacén y compras", icono: "📦" },
  { id: "gente", nombre: "Gente", icono: "👷" },
  { id: "control", nombre: "Control y respaldo", icono: "🔐" },
];

const f = (grupo, icono, nombre, sub) => ({ grupo, icono, nombre, sub });
export const FUNCIONES = {
  // (No hay grupo "Hoy": lo de hoy no es lo mismo para el contador que para
  // el capataz. Lo de cada quien es lo que ancló, y sale primero en SU menú.)
  operacion: f("campo", "🎯", "Operación", "Qué pasa ahora en campo"),
  eldia: f("campo", "🌦", "El día", "Clima, reparto y qué se acaba"),
  aldia: f("dinero", "🎯", "¿Alcanza?", "Y qué dejó de aparecer"),
  resumen: f("dinero", "📰", "Resumen", "Cómo va la semana"),
  "panel-financiero": f("dinero", "💰", "¿Cómo vamos?", "Resumen del dinero"),
  chat: f("gente", "💬", "Chat", "Lo del grupo, ya clasificado"),
  dictado: f("campo", "💬", "Dile a la app", "Habla y ella lo registra"),
  // Campo
  "registrar-actividad": f("campo", "✏️", "Registrar actividad", "Lo que se hizo en campo"),
  "registro-masivo": f("campo", "👥", "Registro de varios", "Varios trabajadores a la vez"),
  aplicaciones: f("campo", "🧪", "Aplicaciones", "Fertirriego y tratamientos"),
  indicaciones: f("campo", "📋", "Indicaciones", "Mandar al personal"),
  tareas: f("campo", "✅", "Tareas", "Encargos y pendientes"),
  reporte: f("campo", "⚠️", "Reportar", "Una incidencia en el cultivo"),
  parcelas: f("campo", "🗺️", "Parcelas", "Ranchos y fenología"),
  "panel-parcelas": f("campo", "🌾", "Estado de parcelas", "Avance de los cultivos"),
  calendario: f("campo", "🗓️", "Calendario", "Siembras y cultivos"),
  cosechas: f("campo", "🌾", "Cosechas", "Rendimiento"),
  "rendimiento-parcelas": f("campo", "🌱", "Rendimiento por parcela", "Cajas y calibres"),
  variedades: f("campo", "🧬", "Variedades", "Tipos de cada cultivo"),
  "reporte-variedades": f("campo", "📊", "Comparar variedades", "Costo y rendimiento"),
  fito: f("campo", "📄", "Hoja de Fito", "Fertirriego que se comprueba"),
  dron: f("campo", "🚁", "Dron", "Las parcelas desde arriba"),
  ganado: f("campo", "🐄", "Ganado", "Padrón, báscula y jeringa"),
  // Bodega y ajo
  corrida: f("ajo", "🏭", "Corrida de ajo", "Encajado por calibre"),
  estibas: f("ajo", "🏷️", "Estibas", "Etiquetas y trazabilidad"),
  terminados: f("ajo", "🧄", "Ajo terminado", "Inventario por calibre"),
  embarque: f("ajo", "🚛", "Salida de camión", "Embarque y pesada"),
  consignaciones: f("ajo", "📋", "Consignaciones", "Pendientes de cobro"),
  comercializacion: f("ajo", "📈", "Comercialización", "Precio por kilo y clientes"),
  // Dinero
  "mano-obra": f("dinero", "👷", "Mano de obra", "Quién, dónde, cuánto tiempo y cuánto costó"),
  contabilidad: f("dinero", "💵", "Finanzas", "Ingresos y egresos"),
  movimientos: f("dinero", "🗂️", "Movimientos", "Todo lo capturado"),
  caja: f("dinero", "💵", "Caja chica", "Gastos y movimientos"),
  papeles: f("dinero", "📷", "Papeles", "Foto de ticket o factura"),
  banco: f("dinero", "🏦", "Banco", "Estado de cuenta"),
  socios: f("dinero", "👥", "Socios", "Quién puso y quién sacó"),
  deudas: f("dinero", "🏦", "Deudas", "Créditos y pagos"),
  proyeccion: f("dinero", "📅", "Semana", "Qué se va a necesitar"),
  reportes: f("dinero", "📈", "Reportes", "Por cultivo y parcela"),
  ciclos: f("dinero", "📅", "Temporadas", "Resultado global"),
  contpaqi: f("dinero", "📑", "ContPAQi", "Exportar pólizas"),
  // Almacén y compras
  inventario: f("almacen", "📦", "Inventario", "Lo que hay en almacén"),
  entregas: f("almacen", "🧰", "Entregas del almacén", "Quién trae qué, qué se usó y qué regresó"),
  vales: f("almacen", "📦", "Conteo y mermas", "Contar a ciegas y ver las mermas"),
  solicitudes: f("almacen", "🛒", "Solicitudes de compra", "Lo que pide el personal"),
  compras: f("almacen", "🧾", "Mis compras", "Lo que compré o pedí"),
  "compras-insumos": f("almacen", "📦", "Registrar compra", "Insumo ya comprado"),
  proveedores: f("almacen", "🚛", "Proveedores", "A quién se le compra"),
  // Gente
  equipo: f("gente", "👷", "Equipo", "Personal y maquinaria"),
  personal: f("gente", "👷", "Personal", "Actividades y préstamos"),
  reparto: f("gente", "👥", "Equipos de trabajo", "Quién va a dónde y a qué"),
  "cuadrillas-dia": f("gente", "🚌", "Cuadrillas", "Los grupos eventuales: quién vino y cómo cobran"),
  checador: f("gente", "📲", "Checador", "Entrada y salida con QR o PIN"),
  jornadas: f("gente", "⏱", "Jornadas", "Quién está, horas y correcciones"),
  credenciales: f("gente", "🏷️", "Credenciales", "El QR de cada trabajador"),
  "pase-lista": f("gente", "✅", "Pase de lista", "Asistencia de la semana"),
  asistencia: f("gente", "✅", "Asistencia", "Quién vino hoy"),
  nomina: f("gente", "🧾", "Nómina semanal", "Pago por trabajador"),
  "aprobacion-externos": f("gente", "✅", "Aprobar externos", "Trabajo de gente de fuera"),
  mis: f("gente", "📋", "Mis días", "Lo que llevo registrado"),
  // Control y respaldo
  arranque: f("control", "🎯", "Arranque", "Cuentas, conteo, saldos, inicio"),
  bitacora: f("control", "🔐", "Bitácora", "Quién hizo qué"),
  seguridad: f("control", "🔐", "Seguridad", "PIN de dirección"),
  respaldo: f("control", "💾", "Respaldo", "Guardar copia"),
  "subir-nube": f("control", "☁️", "Subir catálogos", "Carga inicial a la nube"),
};

// Qué puede abrir cada perfil. Tiene que coincidir con lo que App.jsx sabe
// pintarle a ese perfil: una prueba lo compara contra el propio App.jsx.
export const PANTALLAS_DE = {
  admin: ["checador", "reparto", "cuadrillas-dia", "mano-obra", "jornadas", "credenciales", "aldia", "aplicaciones", "aprobacion-externos", "arranque", "asistencia", "banco", "bitacora", "caja", "calendario", "chat", "ciclos", "comercializacion", "compras", "compras-insumos", "consignaciones", "contabilidad", "contpaqi", "corrida", "cosechas", "deudas", "dictado", "dron", "eldia", "embarque", "equipo", "estibas", "fito", "ganado", "indicaciones", "inventario", "mis", "movimientos", "nomina", "operacion", "panel-financiero", "panel-parcelas", "papeles", "parcelas", "pase-lista", "personal", "proveedores", "proyeccion", "registrar-actividad", "registro-masivo", "rendimiento-parcelas", "reporte", "reporte-variedades", "reportes", "respaldo", "resumen", "seguridad", "socios", "solicitudes", "subir-nube", "tareas", "terminados", "entregas", "vales", "variedades"],
  encargado: ["checador", "reparto", "cuadrillas-dia", "jornadas", "credenciales", "aldia", "aprobacion-externos", "asistencia", "banco", "bitacora", "caja", "chat", "corrida", "cosechas", "dictado", "dron", "eldia", "estibas", "fito", "ganado", "operacion", "papeles", "pase-lista", "personal", "registrar-actividad", "registro-masivo", "socios", "solicitudes", "tareas", "entregas", "vales"],
  trabajador: ["compras", "mis", "pase-lista", "reporte", "solicitudes"],
  cuadrilla: ["compras", "mis", "reporte"],
  externo: ["mis", "reporte"],
  agronomo: ["aplicaciones", "compras-insumos", "indicaciones", "operacion", "panel-parcelas", "rendimiento-parcelas", "reporte", "reporte-variedades", "solicitudes", "variedades"],
  dueno: ["mano-obra", "operacion", "panel-financiero", "panel-parcelas", "reportes", "resumen"],
  finanzas: ["jornadas", "mano-obra", "comercializacion", "consignaciones", "contabilidad", "contpaqi", "corrida", "deudas", "embarque", "estibas", "nomina", "operacion", "pase-lista", "proyeccion", "rendimiento-parcelas", "solicitudes", "terminados"],
};

// Con qué abre cada perfil antes de que la persona acomode nada.
export const DE_FABRICA = {
  admin: { barra: ["movimientos", "contabilidad", "inventario"], inicio: ["arranque", "papeles", "registrar-actividad", "aldia", "corrida", "pase-lista"] },
  encargado: { barra: ["checador", "reparto", "tareas"], inicio: ["checador", "reparto", "cuadrillas-dia", "jornadas", "registrar-actividad", "registro-masivo", "pase-lista", "entregas", "solicitudes", "corrida"] },
  trabajador: { barra: ["mis", "compras", "reporte"], inicio: [] },
  cuadrilla: { barra: ["mis", "compras", "reporte"], inicio: [] },
  externo: { barra: ["mis", "reporte"], inicio: [] },
  agronomo: { barra: ["aplicaciones", "panel-parcelas", "reporte"], inicio: ["aplicaciones", "indicaciones", "compras-insumos", "solicitudes", "variedades", "operacion"] },
  dueno: { barra: ["panel-financiero", "reportes", "panel-parcelas"], inicio: ["panel-financiero", "mano-obra", "resumen", "operacion", "reportes", "panel-parcelas"] },
  finanzas: { barra: ["solicitudes", "deudas", "contabilidad"], inicio: ["contabilidad", "mano-obra", "corrida", "nomina", "proyeccion", "embarque", "terminados"] },
};

// A qué se dedica más cada administrador. Los dos superadministradores pueden
// lo mismo, pero no hacen lo mismo: uno lleva los números y el otro el rancho.
// Escoger uno cambia con qué abre y en qué orden salen los grupos. Nada más.
export const ENFOQUES = [
  { id: "dinero", nombre: "Los números", sub: "Pólizas, movimientos, conciliar",
    barra: ["movimientos", "contabilidad", "banco"],
    inicio: ["arranque", "mano-obra", "papeles", "banco", "contpaqi", "socios", "aldia", "deudas", "nomina", "reportes"],
    orden: ["dinero", "almacen", "gente", "ajo", "campo", "control"] },
  { id: "campo", nombre: "El rancho", sub: "Actividades, gente, comprobantes",
    barra: ["checador", "reparto", "papeles"],
    inicio: ["arranque", "checador", "reparto", "cuadrillas-dia", "jornadas", "mano-obra", "registrar-actividad", "pase-lista", "papeles", "entregas", "tareas", "operacion"],
    orden: ["campo", "gente", "almacen", "ajo", "dinero", "control"] },
  { id: "bodega", nombre: "La bodega", sub: "Corrida, estibas, embarques",
    barra: ["corrida", "estibas", "terminados"],
    inicio: ["arranque", "corrida", "estibas", "terminados", "embarque", "consignaciones", "comercializacion", "pase-lista"],
    orden: ["ajo", "almacen", "gente", "dinero", "campo", "control"] },
  { id: "todo", nombre: "De todo un poco", sub: "Lo dejo como viene",
    barra: null, inicio: null, orden: null },
];
export const PERFILES_CON_ENFOQUE = ["admin"];
const enfoqueDe = (rol, prefs) => (PERFILES_CON_ENFOQUE.includes(rol) && ENFOQUES.find(e => e.id === prefs?.enfoque)) || null;
// ¿Hay que preguntarle a qué se dedica? Sólo a quien aplica y todavía no contesta.
export const faltaEnfoque = (rol, prefs) => PERFILES_CON_ENFOQUE.includes(rol) && !ENFOQUES.some(e => e.id === prefs?.enfoque);
// Con qué abre esta persona si no ha acomodado nada: lo de su enfoque, o lo de su perfil.
const fabricaDe = (rol, prefs) => {
  const e = enfoqueDe(rol, prefs), d = DE_FABRICA[rol] || { barra: [], inicio: [] };
  return { barra: e?.barra || d.barra, inicio: e?.inicio || d.inicio };
};
// Escoger enfoque acomoda de nuevo el inicio y la barra con lo de ese trabajo.
export const elegirEnfoque = (prefs, id) => (ENFOQUES.some(e => e.id === id) ? { ...prefs, enfoque: id, barra: null, inicio: null } : prefs);

export const TOPE_BARRA = 3;     // más Inicio y Menú: cinco botones, lo que cabe en un teléfono
export const TOPE_INICIO = 12;

const permitidas = (rol) => PANTALLAS_DE[rol] || [];
const limpiar = (lista, rol, tope) => {
  const ok = new Set(permitidas(rol)); const vistos = new Set(); const sale = [];
  for (const id of Array.isArray(lista) ? lista : []) {
    if (ok.has(id) && FUNCIONES[id] && !vistos.has(id)) { vistos.add(id); sale.push(id); }
  }
  return sale.slice(0, tope);
};
const conDatos = (ids) => ids.map(id => ({ id, ...FUNCIONES[id] }));

// El menú completo de una persona: los grupos en SU orden, sin grupos vacíos,
// y cada uno dice si la persona lo escondió.
export function menuDe(rol, prefs) {
  const ok = new Set(permitidas(rol));
  const orden = enfoqueDe(rol, prefs)?.orden;
  const escondidos = new Set(Array.isArray(prefs?.ocultos) ? prefs.ocultos : []);
  const grupos = orden ? [...GRUPOS].sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id)) : GRUPOS;
  return grupos
    .map(g => ({ ...g, oculto: escondidos.has(g.id), funciones: Object.keys(FUNCIONES).filter(id => FUNCIONES[id].grupo === g.id && ok.has(id)).map(id => ({ id, ...FUNCIONES[id] })) }))
    .filter(g => g.funciones.length > 0);
}
// Esconder o volver a enseñar un grupo. Nunca se pueden esconder todos.
export function alternarGrupo(rol, prefs, grupo) {
  const todos = menuDe(rol, prefs).map(g => g.id);
  if (!todos.includes(grupo)) return { prefs, dice: "" };
  const ya = (Array.isArray(prefs?.ocultos) ? prefs.ocultos : []).filter(g => todos.includes(g));
  if (ya.includes(grupo)) return { prefs: { ...prefs, ocultos: ya.filter(g => g !== grupo) }, dice: "" };
  if (ya.length >= todos.length - 1) return { prefs, dice: "Tiene que quedar al menos un grupo a la vista." };
  return { prefs: { ...prefs, ocultos: [...ya, grupo] }, dice: "" };
}

// Buscar sin acentos ni mayúsculas, en el nombre y en la descripción.
const plano = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function buscarEnMenu(rol, texto) {
  const q = plano(texto);
  if (!q) return [];
  return conDatos(permitidas(rol).filter(id => FUNCIONES[id] && (plano(FUNCIONES[id].nombre).includes(q) || plano(FUNCIONES[id].sub).includes(q))));
}

// Las preferencias de UNA persona. `null` en barra/inicio = todavía no acomoda
// nada y se le enseña lo de fábrica de su perfil; una lista vacía es SU decisión.
export const prefsVacias = () => ({ barra: null, inicio: null, enfoque: null, ocultos: [], cuando: null, uso: {} });
export function prefsDe(todas, quien) {
  const p = (todas && quien && todas[quien]) || {};
  return {
    barra: Array.isArray(p.barra) ? p.barra : null, inicio: Array.isArray(p.inicio) ? p.inicio : null,
    enfoque: typeof p.enfoque === "string" ? p.enfoque : null, ocultos: Array.isArray(p.ocultos) ? p.ocultos : [],
    cuando: typeof p.cuando === "string" ? p.cuando : null, uso: p.uso && typeof p.uso === "object" ? p.uso : {},
  };
}
export const conPrefs = (todas, quien, prefs) => (quien ? { ...(todas || {}), [quien]: prefs } : (todas || {}));

export const ancladasDe = (rol, prefs) => limpiar(prefs?.inicio ?? fabricaDe(rol, prefs).inicio, rol, TOPE_INICIO);
export const enBarraDe = (rol, prefs) => limpiar(prefs?.barra ?? fabricaDe(rol, prefs).barra, rol, TOPE_BARRA);

// En la barra de abajo el nombre va corto: caben unas diez letras.
const CORTOS = {
  "registrar-actividad": "Registrar", "registro-masivo": "Varios", "panel-parcelas": "Parcelas", "rendimiento-parcelas": "Rendimiento",
  "reporte-variedades": "Comparar", solicitudes: "Compras", compras: "Compras", "compras-insumos": "Compra", "aprobacion-externos": "Externos",
  "panel-financiero": "Dinero", "pase-lista": "Lista", credenciales: "Credencial", reparto: "Equipos", entregas: "Entregas", vales: "Conteo", "cuadrillas-dia": "Cuadrillas", "mano-obra": "M. de obra", dictado: "Dictar", corrida: "Corrida", terminados: "Terminado", embarque: "Camión",
  comercializacion: "Ventas", nomina: "Nómina", "subir-nube": "Subir", consignaciones: "Consigna", proveedores: "Proveed.",
  mis: "Mis días", fito: "Fito", caja: "Caja", indicaciones: "Indicar",
};
// La barra de abajo: lo que la persona escogió (Inicio y Menú los pone la app).
export function barraDe(rol, prefs) {
  return conDatos(enBarraDe(rol, prefs)).map(x => ({ ...x, corto: CORTOS[x.id] || x.nombre }));
}
// ¿Le hace falta el botón de Menú? Sólo si tiene más pantallas de las que ya están en su barra.
export const necesitaMenu = (rol, prefs) => permitidas(rol).length > enBarraDe(rol, prefs).length;

// Anclar o soltar del inicio. Devuelve prefs nuevas; nunca muta.
export function alternarInicio(rol, prefs, id) {
  if (!permitidas(rol).includes(id) || !FUNCIONES[id]) return { prefs, dice: "" };
  const ya = ancladasDe(rol, prefs);
  if (ya.includes(id)) return { prefs: { ...prefs, inicio: ya.filter(x => x !== id) }, dice: "" };
  if (ya.length >= TOPE_INICIO) return { prefs, dice: `En el inicio caben ${TOPE_INICIO}. Quita uno para poner otro.` };
  return { prefs: { ...prefs, inicio: [...ya, id] }, dice: "" };
}
export function alternarBarra(rol, prefs, id) {
  if (!permitidas(rol).includes(id) || !FUNCIONES[id]) return { prefs, dice: "" };
  const ya = enBarraDe(rol, prefs);
  if (ya.includes(id)) return { prefs: { ...prefs, barra: ya.filter(x => x !== id) }, dice: "" };
  if (ya.length >= TOPE_BARRA) return { prefs, dice: `En la barra de abajo caben ${TOPE_BARRA}, además de Inicio y Menú. Quita uno para poner otro.` };
  return { prefs: { ...prefs, barra: [...ya, id] }, dice: "" };
}
// Subir o bajar un acceso anclado (dir = -1 sube, +1 baja).
export function moverEnInicio(rol, prefs, id, dir) {
  const ya = ancladasDe(rol, prefs); const i = ya.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= ya.length) return prefs;
  const n = [...ya]; [n[i], n[j]] = [n[j], n[i]];
  return { ...prefs, inicio: n };
}
export const volverALoDeFabrica = (prefs) => ({ ...prefs, barra: null, inicio: null, ocultos: [] });

// Cada vez que se abre una pantalla del menú, se cuenta. Sólo eso: cuántas
// veces y cuándo fue la última. No se guarda qué se hizo adentro.
export function anotarUso(prefs, id, cuando) {
  if (!FUNCIONES[id]) return prefs;
  const antes = prefs.uso?.[id] || { n: 0 };
  return { ...prefs, uso: { ...(prefs.uso || {}), [id]: { n: (antes.n || 0) + 1, ult: cuando } } };
}

// "Lo que más usas": lo más abierto que NO está ya anclado ni en la barra.
// Con menos de 3 aperturas no sale: una vez por curiosidad no es costumbre.
export function masUsadas(rol, prefs, cuantas = 4) {
  const fuera = new Set([...ancladasDe(rol, prefs), ...enBarraDe(rol, prefs)]);
  const ok = new Set(permitidas(rol));
  const ids = Object.entries(prefs?.uso || {})
    .filter(([id, u]) => ok.has(id) && FUNCIONES[id] && !fuera.has(id) && (u?.n || 0) >= 3)
    .sort((a, b) => (b[1].n - a[1].n) || String(b[1].ult || "").localeCompare(String(a[1].ult || "")))
    .slice(0, cuantas).map(([id]) => id);
  return conDatos(ids);
}

export const ancladasConDatos = (rol, prefs) => conDatos(ancladasDe(rol, prefs));

// ── Que el acomodo siga a la persona de un aparato a otro ──────────────────
// El acomodo (inicio, barra, enfoque, grupos escondidos) lleva la hora en que
// se cambió: gana el más reciente, entero, no una mezcla de los dos. El uso sí
// se junta: de cada pantalla se queda la cuenta más alta.
export const sellarAcomodo = (prefs, cuando) => ({ ...prefs, cuando });
const acomodoDe = (p) => ({ barra: p.barra, inicio: p.inicio, enfoque: p.enfoque, ocultos: p.ocultos, cuando: p.cuando });
export function mezclarPrefs(local, nube) {
  const l = prefsDe({ x: local }, "x"), n = prefsDe({ x: nube }, "x");
  const ganaNube = !!n.cuando && (!l.cuando || n.cuando > l.cuando);
  const uso = { ...n.uso };
  for (const [id, u] of Object.entries(l.uso)) {
    const o = uso[id];
    uso[id] = !o || (u?.n || 0) >= (o?.n || 0) ? u : o;
  }
  return { ...acomodoDe(ganaNube ? n : l), uso };
}
// ¿Hay algo que valga la pena subir? El puro uso no: se sube cuando cambie el acomodo
// o cuando ya se juntó suficiente.
export const mismoAcomodo = (a, b) => JSON.stringify(acomodoDe(prefsDe({ x: a }, "x"))) === JSON.stringify(acomodoDe(prefsDe({ x: b }, "x")));
