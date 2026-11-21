// QUIÉN HIZO QUÉ: cuatro personas que casi nunca son la misma y que antes se guardaban revueltas.
//
//   · quién lo ORDENÓ    — quien dijo que se hiciera (puede no saberse);
//   · quién lo CAPTURÓ   — quien lo tecleó en la app (la sesión);
//   · quién lo EJECUTÓ   — quien de verdad hizo el trabajo: una persona, varias, o una cuadrilla como grupo;
//   · quién lo CONFIRMÓ  — un responsable que da fe de que se hizo (todavía no existe esa captura: nace vacío).
//
// Reglas que no se rompen:
//   · No se inventa a nadie. Lo que no se dijo queda vacío y sale en `faltan`. Que alguien haya capturado una aplicación
//     NO quiere decir que la aplicó.
//   · Los registros de antes se leen como estaban: de una actividad se sabe «a nombre de quién» se registró (eso era el
//     ejecutor) y, a veces, quién la capturó; de una aplicación sólo quién la capturó. Se dice de dónde sale cada dato
//     (`origen: "registro_anterior"`) y no se rellena lo demás.
//   · Esto NO cambia cómo se paga ni cómo se costea: los módulos de dinero siguen leyendo lo de siempre
//     (`registradoPor`, `trabajadorId`). `quienes` es información aparte, para saber quién sabe hacer qué.
//   · Una cuadrilla se anota como grupo, con cuántas personas: de sus integrantes no se supone quién hizo qué.
const persona = (p, tipo) => (p && p.id ? { id: p.id, nombre: String(p.nombre || "").trim(), ...(tipo || p.tipo ? { tipo: tipo || p.tipo } : {}), ...(p.personas != null ? { personas: Number(p.personas) || 0 } : {}), ...(p.grupo ? { grupo: true } : {}) } : null);
const nombreEn = (catalogos, tipo, id) => { const lista = tipo === "cuadrilla" ? catalogos.cuadrillas : tipo === "encargado" ? catalogos.encargados : tipo === "externo" ? catalogos.externos : catalogos.trabajadores; return (lista || []).find(x => x.id === id)?.nombre || [...(catalogos.trabajadores || []), ...(catalogos.encargados || []), ...(catalogos.agronomos || [])].find(x => x.id === id)?.nombre || ""; };
export const CLASES = ["actividades", "aplicaciones"];

// Al CAPTURAR: arma `quienes` con lo que la pantalla sí sabe. Si el registro ya lo trae, no se toca.
export function conQuienes(clase, registro, { sesion, catalogos = {} } = {}) {
  if (!CLASES.includes(clase) || !registro || registro.quienes) return registro;
  const capturo = sesion?.id ? { id: sesion.id, nombre: sesion.nombre || "", rol: sesion.role || sesion.rol || "" } : null;
  const ordeno = persona(registro.ordenadoPor) || null;
  let ejecutaron = [];
  if (Array.isArray(registro.ejecutores)) ejecutaron = registro.ejecutores.map(e => persona(e)).filter(Boolean);
  else if (clase === "actividades") {
    // En las capturas de actividad, «a nombre de quién» es quien la hizo. Si es una cuadrilla, es el grupo.
    const r = registro.registradoPor, id = registro.trabajadorId || r?.id, tipo = registro.trabajadorId ? "planta" : r?.tipo || "";
    if (id) ejecutaron = [tipo === "cuadrilla" ? { id, nombre: r?.nombre || nombreEn(catalogos, tipo, id), tipo, grupo: true, personas: Number(registro.cuadrilla_personas) || 0 } : { id, nombre: r?.nombre || nombreEn(catalogos, tipo, id), tipo: tipo || "planta" }];
  }
  // De una aplicación NO se supone que quien la capturó la aplicó: si no se dijo, queda vacío.
  const limpio = { ...registro }; delete limpio.ordenadoPor; delete limpio.ejecutores;
  return { ...limpio, quienes: { ordeno, capturo, ejecutaron, confirmo: null } };
}

// Al LEER: quién ordenó, capturó, ejecutó y confirmó, venga el registro de hoy o de antes. Nunca rellena.
export function quienesDe(clase, registro, catalogos = {}) {
  const dice = (q, origen) => { const faltan = []; if (!q.ejecutaron.length) faltan.push("quién lo ejecutó"); if (!q.ordeno) faltan.push("quién lo ordenó"); if (!q.capturo) faltan.push("quién lo capturó"); if (!q.confirmo) faltan.push("quién lo confirmó");
    return { ...q, origen, faltan, sabeQuienEjecuto: q.ejecutaron.length > 0, personas: q.ejecutaron.filter(e => !e.grupo).map(e => e.id) }; };
  if (!registro) return dice({ ordeno: null, capturo: null, ejecutaron: [], confirmo: null }, "sin_registro");
  if (registro.quienes) { const q = registro.quienes; return dice({ ordeno: q.ordeno || null, capturo: q.capturo || null, ejecutaron: Array.isArray(q.ejecutaron) ? q.ejecutaron : [], confirmo: q.confirmo || null }, "capturado"); }
  if (clase === "aplicaciones") { const id = typeof registro.registradoPor === "string" ? registro.registradoPor : registro.registradoPor?.id;
    return dice({ ordeno: null, capturo: id ? { id, nombre: nombreEn(catalogos, "", id), rol: "" } : null, ejecutaron: [], confirmo: null }, "registro_anterior"); }
  const r = registro.registradoPor, id = registro.trabajadorId || r?.id, tipo = registro.trabajadorId ? "planta" : r?.tipo || "", c = registro.registradoEnNombrePor;
  return dice({ ordeno: null, capturo: c?.id ? { id: c.id, nombre: c.nombre || "", rol: c.rol || "" } : null, confirmo: null,
    ejecutaron: id ? [{ id, nombre: r?.nombre || nombreEn(catalogos, tipo, id), tipo: tipo || "planta", ...(tipo === "cuadrilla" ? { grupo: true, personas: Number(registro.cuadrilla_personas) || 0 } : {}) }] : [] }, "registro_anterior");
}

// Lo mismo para lo que ya nace como evento (el reparto real y el día de una cuadrilla): ahí quien manda a la gente es
// quien lo capturó, y los ejecutores son los que se mandaron o los que vinieron.
export function quienesDeEvento(e, catalogos = {}) {
  if (!e) return null;
  const q = e.quien?.id ? { id: e.quien.id, nombre: e.quien.nombre || "", rol: e.quien.rol || "" } : null;
  if (e.tipo === "asignacion") return { ordeno: q, capturo: q, confirmo: null, ejecutaron: (e.datos.trabajadorIds || []).map(id => ({ id, nombre: nombreEn(catalogos, "", id), tipo: "planta" })) };
  if (e.tipo === "cuadrilla_dia") return { ordeno: null, capturo: q, confirmo: null, ejecutaron: (e.datos.integrantes || []).map(i => (typeof i === "string" ? { id: i, nombre: "" } : { id: i.id || i.nombre, nombre: i.nombre || "" })).filter(x => x.id).map(x => ({ ...x, tipo: "cuadrilla" })) };
  return null;
}

export const textoDe = (lista) => (lista || []).map(e => (e.grupo ? `${e.nombre || "Cuadrilla"}${e.personas ? ` (${e.personas} personas, como grupo)` : " (como grupo)"}` : e.nombre || "Alguien que ya no está en el catálogo")).join(", ");
