// ════════════════════════════════════════════════════════════════════════
//  MENÚ — encontrar las cosas
//
//  El inicio del administrador eran 35 tarjetas iguales, una tras otra, en casi
//  cuatro pantallas de alto: encontrar algo era un trabajo. Aquí vive el orden:
//    · cada pantalla tiene UN nombre y vive en UN grupo;
//    · cada perfil ve sólo las suyas;
//    · cada persona ancla al inicio lo que usa, y escoge qué va en la barra de
//      abajo; lo que más abre sube solo a "Lo que más usas".
//  La app ACOMODA, no decide: lo anclado por la persona nunca lo mueve el uso.
//  Todo es puro: quién guarda y dónde lo decide App.jsx (LLAVES.menu).
// ════════════════════════════════════════════════════════════════════════

export const GRUPOS = [
  { id: "hoy", nombre: "Hoy", icono: "🌦" },
  { id: "campo", nombre: "Campo", icono: "🌾" },
  { id: "ajo", nombre: "Bodega y ajo", icono: "🏭" },
  { id: "dinero", nombre: "Dinero", icono: "💵" },
  { id: "almacen", nombre: "Almacén y compras", icono: "📦" },
  { id: "gente", nombre: "Gente", icono: "👷" },
  { id: "control", nombre: "Control y respaldo", icono: "🔐" },
];

const f = (grupo, icono, nombre, sub) => ({ grupo, icono, nombre, sub });
export const FUNCIONES = {
  // Hoy
  operacion: f("hoy", "🎯", "Operación", "Qué pasa ahora en campo"),
  eldia: f("hoy", "🌦", "El día", "Clima, reparto y qué se acaba"),
  aldia: f("hoy", "🎯", "¿Alcanza?", "Y qué dejó de aparecer"),
  resumen: f("hoy", "📰", "Resumen", "Cómo va la semana"),
  "panel-financiero": f("hoy", "💰", "¿Cómo vamos?", "Resumen del dinero"),
  chat: f("hoy", "💬", "Chat", "Lo del grupo, ya clasificado"),
  dictado: f("hoy", "💬", "Dile a la app", "Habla y ella lo registra"),
  // Campo
  "registrar-actividad": f("campo", "✏️", "Registrar actividad", "Una labor de campo"),
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
  vales: f("almacen", "📦", "Vales", "Salidas, mermas y conteo"),
  solicitudes: f("almacen", "🛒", "Solicitudes de compra", "Lo que pide el personal"),
  compras: f("almacen", "🧾", "Mis compras", "Lo que compré o pedí"),
  "compras-insumos": f("almacen", "📦", "Registrar compra", "Insumo ya comprado"),
  proveedores: f("almacen", "🚛", "Proveedores", "A quién se le compra"),
  // Gente
  equipo: f("gente", "👷", "Equipo", "Personal y maquinaria"),
  personal: f("gente", "👷", "Personal", "Actividades y préstamos"),
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
  admin: ["aldia", "aplicaciones", "aprobacion-externos", "arranque", "asistencia", "banco", "bitacora", "caja", "calendario", "chat", "ciclos", "comercializacion", "compras", "compras-insumos", "consignaciones", "contabilidad", "contpaqi", "corrida", "cosechas", "deudas", "dictado", "dron", "eldia", "embarque", "equipo", "estibas", "fito", "ganado", "indicaciones", "inventario", "mis", "movimientos", "nomina", "operacion", "panel-financiero", "panel-parcelas", "papeles", "parcelas", "pase-lista", "personal", "proveedores", "proyeccion", "registrar-actividad", "registro-masivo", "rendimiento-parcelas", "reporte", "reporte-variedades", "reportes", "respaldo", "resumen", "seguridad", "socios", "solicitudes", "subir-nube", "tareas", "terminados", "vales", "variedades"],
  encargado: ["aldia", "aprobacion-externos", "asistencia", "banco", "bitacora", "caja", "chat", "corrida", "cosechas", "dictado", "dron", "eldia", "estibas", "fito", "ganado", "operacion", "papeles", "pase-lista", "personal", "registrar-actividad", "registro-masivo", "socios", "solicitudes", "tareas", "vales"],
  trabajador: ["compras", "mis", "pase-lista", "reporte", "solicitudes"],
  cuadrilla: ["compras", "mis", "reporte"],
  externo: ["mis", "reporte"],
  agronomo: ["aplicaciones", "compras-insumos", "indicaciones", "operacion", "panel-parcelas", "rendimiento-parcelas", "reporte", "reporte-variedades", "solicitudes", "variedades"],
  dueno: ["operacion", "panel-financiero", "panel-parcelas", "reportes", "resumen"],
  finanzas: ["comercializacion", "consignaciones", "contabilidad", "contpaqi", "corrida", "deudas", "embarque", "estibas", "nomina", "operacion", "pase-lista", "proyeccion", "rendimiento-parcelas", "solicitudes", "terminados"],
};

// Con qué abre cada perfil antes de que la persona acomode nada.
export const DE_FABRICA = {
  admin: { barra: ["movimientos", "contabilidad", "inventario"], inicio: ["arranque", "papeles", "registrar-actividad", "aldia", "corrida", "pase-lista"] },
  encargado: { barra: ["tareas", "personal", "caja"], inicio: ["registrar-actividad", "registro-masivo", "pase-lista", "vales", "solicitudes", "corrida"] },
  trabajador: { barra: ["mis", "compras", "reporte"], inicio: [] },
  cuadrilla: { barra: ["mis", "compras", "reporte"], inicio: [] },
  externo: { barra: ["mis", "reporte"], inicio: [] },
  agronomo: { barra: ["aplicaciones", "panel-parcelas", "reporte"], inicio: ["aplicaciones", "indicaciones", "compras-insumos", "solicitudes", "variedades", "operacion"] },
  dueno: { barra: ["panel-financiero", "reportes", "panel-parcelas"], inicio: ["panel-financiero", "resumen", "operacion", "reportes", "panel-parcelas"] },
  finanzas: { barra: ["solicitudes", "deudas", "contabilidad"], inicio: ["contabilidad", "corrida", "nomina", "proyeccion", "embarque", "terminados"] },
};

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

// El menú completo de un perfil: grupos en orden, sin grupos vacíos.
export function menuDe(rol) {
  const ok = new Set(permitidas(rol));
  return GRUPOS
    .map(g => ({ ...g, funciones: Object.keys(FUNCIONES).filter(id => FUNCIONES[id].grupo === g.id && ok.has(id)).map(id => ({ id, ...FUNCIONES[id] })) }))
    .filter(g => g.funciones.length > 0);
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
export const prefsVacias = () => ({ barra: null, inicio: null, uso: {} });
export function prefsDe(todas, quien) {
  const p = (todas && quien && todas[quien]) || {};
  return { barra: Array.isArray(p.barra) ? p.barra : null, inicio: Array.isArray(p.inicio) ? p.inicio : null, uso: p.uso && typeof p.uso === "object" ? p.uso : {} };
}
export const conPrefs = (todas, quien, prefs) => (quien ? { ...(todas || {}), [quien]: prefs } : (todas || {}));

export const ancladasDe = (rol, prefs) => limpiar(prefs?.inicio ?? DE_FABRICA[rol]?.inicio, rol, TOPE_INICIO);
export const enBarraDe = (rol, prefs) => limpiar(prefs?.barra ?? DE_FABRICA[rol]?.barra, rol, TOPE_BARRA);

// En la barra de abajo el nombre va corto: caben unas diez letras.
const CORTOS = {
  "registrar-actividad": "Registrar", "registro-masivo": "Varios", "panel-parcelas": "Parcelas", "rendimiento-parcelas": "Rendimiento",
  "reporte-variedades": "Comparar", solicitudes: "Compras", compras: "Compras", "compras-insumos": "Compra", "aprobacion-externos": "Externos",
  "panel-financiero": "Dinero", "pase-lista": "Lista", dictado: "Dictar", corrida: "Corrida", terminados: "Terminado", embarque: "Camión",
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
export const volverALoDeFabrica = (prefs) => ({ ...prefs, barra: null, inicio: null });

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
