// ════════════════════════════════════════════════════════════════════════
//  LA CORRIDA EN VIVO NO SE PIERDE AL SALIR DE LA PANTALLA
//
//  Lo que se va contando en la corrida (cajas por calibre que aún no cierran estiba, tarimas en la mesa, cortes,
//  conteos físicos, las estibas ya cerradas del día) vivía sólo en la pantalla: con salir a ver otra cosa, recargar
//  o que el teléfono cerrara la app, se perdía y la corrida empezaba de cero. Lo encontró la auditoría del 22 nov.
//
//  Ahora se guarda una foto en el propio teléfono cada vez que algo cambia, y al volver a entrar se retoma.
//   · Sólo se retoma la corrida de HOY y que no se haya terminado. La de otro día no se revive sola.
//   · Una foto vacía (nada contado, ninguna tarima) no se guarda: no hay nada que retomar.
//   · Al terminar la corrida del día, la foto se borra.
//  Es estado de trabajo de ESTE aparato, no un dato del rancho: no sube a la nube. Lo que sí es dato (estibas
//  cerradas, ajo terminado, el reporte de la corrida) ya se guardaba por su camino.
// ════════════════════════════════════════════════════════════════════════
export const CAMPOS_DE_CORRIDA_VIVA = ["cultivo", "estibaOrigenId", "poolIds", "modoRevoltura", "cajasPorEstiba", "folioCorrida", "corridaId",
  "responsable", "contador", "rendTramo", "contadorTramo", "aportesPrevios", "tramos", "estibasCerradas", "plasticoEventos", "lecturas",
  "ritmoActual", "conteos", "metaDia", "avisarCada", "minCorte"];

const suma = (o) => Object.values(o || {}).reduce((s, x) => s + (Number(x) || 0), 0);
// ¿Hay algo que valga la pena retomar?
export function tieneAlgo(e) {
  if (!e) return false;
  return (e.poolIds || []).length > 0 || !!e.estibaOrigenId || suma(e.contador) > 0 || (e.estibasCerradas || []).length > 0
    || (e.lecturas || []).length > 0 || (e.conteos || []).length > 0 || (e.plasticoEventos || []).length > 0 || (e.tramos || []).length > 0;
}

export function guardarCorridaViva(almacen, llave, estado, hoy) {
  try {
    if (!tieneAlgo(estado)) { almacen.removeItem(llave); return false; }
    const foto = { fecha: hoy };
    for (const k of CAMPOS_DE_CORRIDA_VIVA) if (estado[k] !== undefined) foto[k] = estado[k];
    almacen.setItem(llave, JSON.stringify(foto));
    return true;
  } catch { return false; }       // un teléfono lleno no debe tronar la corrida
}

export function leerCorridaViva(almacen, llave, hoy) {
  try {
    const foto = JSON.parse(almacen.getItem(llave) || "null");
    if (!foto || foto.fecha !== hoy || !foto.corridaId || !tieneAlgo(foto)) return null;
    return foto;
  } catch { return null; }
}

export function borrarCorridaViva(almacen, llave) { try { almacen.removeItem(llave); } catch { /* nada */ } }
