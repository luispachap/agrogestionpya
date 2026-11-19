// ============================================================
//  AgroGestión — El recorrido del dron por las parcelas
//
//  ─────────────────────────────────────────────────────────────
//  LO PRIMERO, PORQUE SI NO ESTO SE MALENTIENDE:
//  ESTO **NO** ES FOTOGRAMETRÍA
//  ─────────────────────────────────────────────────────────────
//  Fotogrametría de verdad es un ortomosaico —todas las fotos cosidas en un
//  solo mapa a escala— y un NDVI calibrado, que es una medición del vigor de
//  la planta hecha con una cámara multiespectral y un panel de referencia.
//  Eso es un servicio aparte, con su equipo y su software, y **este archivo
//  no lo hace ni se le parece**.
//
//  Lo que sí hace, que es lo que se puede hacer hoy y ya vale mucho:
//
//    · Fotos fechadas y ubicadas por parcela — el GPS de la foto dice de
//      qué parcela es, sin que nadie tenga que acordarse.
//    · Una línea del tiempo por parcela — la 53 el 3 de julio, la 53 el 28
//      de julio, la 53 el 20 de agosto: cómo va cambiando, a la vista.
//    · Un aviso de la parcela que nadie vuela — que es lo único que hace
//      que el dron se siga usando en octubre y no nada más en marzo.
//    · Una revisión con IA de las fotos de un vuelo, **con el contexto del
//      rancho pegado**, para que diga algo útil en vez de "se ve un campo
//      verde".
//    · La bitácora de ocurrencias del vuelo, ligada a parcela y fecha.
//
//  Prometer fotogrametría y entregar fotos sería engañar a Luis. Fotos
//  fechadas, ubicadas y comparables ya son mucho más de lo que hay hoy —
//  que es nada—, y se dicen por su nombre.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE ESTE ARCHIVO NO HACE
//  ─────────────────────────────────────────────────────────────
//  · **No calcula ningún porcentaje de crecimiento entre dos fotos.** Dos
//    fotos tomadas a mano alzada, a distinta altura y con distinta luz, no
//    miden nada. Un "creció 18 %" sacado de mirarlas es un número inventado,
//    y un número inventado con dos decimales se cree más que una opinión
//    dicha como opinión.
//  · **No asigna una foto a la parcela menos lejana.** Si el GPS cae a un
//    kilómetro de todo, la respuesta es "no cae en ninguna parcela
//    conocida", y una persona la asigna en diez segundos.
//  · **No adivina una fecha que no viene en aaaa-mm-dd.** "03/07/2026" puede
//    ser el 3 de julio o el 7 de marzo, y con la misma trampa la librería de
//    Excel fechó en diciembre un estado de agosto. Se dice que no se pudo
//    leer y la foto queda apartada, con nombre.
//  · **No supone por qué una parcela lleva 45 días sin volarse.** Puede que
//    el dron esté descompuesto, prestado, o que llovió tres semanas. Dice
//    los días y se calla.
//  · **No guarda nada solo.** Todo lo de aquí PROPONE; la app guarda cuando
//    una persona confirma.
//  · **No bloquea nada.** Nunca.
//
//  ─────────────────────────────────────────────────────────────
//  UNA CUENTA QUE NO SE PUDO HACER NO ES UN CERO NI UN "VA BIEN"
//  ─────────────────────────────────────────────────────────────
//  Aquí hubo un error que vale la pena dejar escrito, porque es el que más
//  caro sale: cuando no se podía calcular cuántos días llevaba una parcela
//  sin volarse, el número salía null — y `null > 30` es falso, así que la
//  parcela caía en el renglón verde. Una parcela con 67 días sin volar salía
//  "al día" y de paso imprimía "NaN-NaN-NaN" en la fecha sugerida.
//  Por eso hoy hay un estado aparte, **"no se sabe"**, y una cuenta que no se
//  pudo hacer NUNCA cae del lado tranquilizador.
//
//  Y lo mismo con lo que se quedó fuera: las fotos sin ubicar, las que no
//  traen fecha y las que alcanzan dos parcelas viajan pegadas a la respuesta.
//  Una alarma que afirma sin decir que no miró todo es peor que no tener
//  alarma.
//
//  ─────────────────────────────────────────────────────────────
//  Y LO MÁS IMPORTANTE DE TODO: LA IA OPINA, NO MIDE
//  ─────────────────────────────────────────────────────────────
//  Lo que conteste una revisión de IA sobre unas fotos es una OBSERVACIÓN:
//  del mismo peso que si Fito pasara, viera y dijera "esa esquina se ve
//  amarilla". Sirve para ir a ver. No es un dato duro, no entra a ningún
//  reporte como cifra, y **nunca dispara un movimiento sola**. Por eso toda
//  observación de origen "ia" nace con `esOpinion: true` y `confirmada:
//  false`, y así se queda hasta que alguien la mire.
//
//  Sus pruebas están en src/dron.test.js.
// ============================================================

import { fechaLocal, diasEntre, sumarDias, distKm } from "./calculos.js";

// Un dato que falta NO es un cero. Number(null) da 0, y un 0 en una latitud
// es un punto en el Golfo de Guinea: una parcela sin coordenadas capturadas
// se volvería la parcela más lejana del mundo, o —peor— la más cercana a
// otra foto sin GPS. Este helper devuelve null y el null se dice con
// palabras.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ════════════ EL DÍA DE UNA FOTO ════════════ */

// Deja un día en aaaa-mm-dd **sin adivinar nada**, y devuelve null cuando no
// se puede leer. Lo que sí lee:
//
//   · "2026-07-03"                 → tal cual: ya es un día del calendario.
//   · "2026-07-03T19:00:00Z", Date,
//     o una marca de tiempo        → se pasa por `fechaLocal`, NUNCA por
//     toISOString(): Supabase guarda en UTC y Zacatecas va seis horas atrás,
//     así que un vuelo de las 7 de la noche del 30 de septiembre saldría
//     fechado en octubre y se pasaría al mes siguiente él solo. Ya pasó en el
//     panel del dueño.
//   · "2026:07:03 10:12:00"        → así viene la fecha en los EXIF de la
//     cámara, y ya es hora local de la cámara: el día está ahí, no hay que
//     convertir nada.
//
// Y lo que NO lee a propósito: "03/07/2026". Puede ser el 3 de julio o el 7
// de marzo, y no hay forma de saber cuál desde aquí. Adivinar es exactamente
// la trampa que fechó en diciembre un estado de cuenta de agosto. Se dice que
// no se pudo leer y una persona lo corrige en diez segundos.
export function aDiaLocal(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : fechaLocal(v);
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : fechaLocal(d);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : fechaLocal(d);
  }
  const exif = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (exif) return `${exif[1]}-${exif[2]}-${exif[3]}`;
  return null;
}

// El día de una foto, y **por qué** cuando no lo hay. Son tres respuestas
// distintas y la app las trata distinto:
//   · un día;
//   · "no trae fecha"        → la foto se aparta. **No se le pone la de hoy.**
//     Una foto sin fecha metida en el vuelo de hoy ensucia la línea del tiempo
//     para siempre, y nadie la va a volver a mirar para corregirla;
//   · "trae fecha y no se pudo leer" → también se aparta, pero es otro
//     problema: aquí sí hay el dato, lo que falta es entenderlo. Mezclarlos
//     haría que nadie supiera cuál de los dos arreglar.
export function diaDeLaFoto(foto) {
  const deCampo = aDiaLocal(foto?.fecha);
  if (deCampo) return { dia: deCampo, ilegible: false, porque: null };

  const deExif = aDiaLocal(foto?.tomadaEn);
  const hayCampo = foto?.fecha !== null && foto?.fecha !== undefined && foto?.fecha !== "";
  if (deExif) {
    return {
      dia: deExif, ilegible: false,
      porque: hayCampo
        ? `La fecha capturada ("${String(foto.fecha)}") no se pudo leer; se usó la marca de tiempo de la foto.`
        : null,
    };
  }

  const hayMarca = foto?.tomadaEn !== null && foto?.tomadaEn !== undefined && foto?.tomadaEn !== "";
  if (hayCampo || hayMarca) {
    return {
      dia: null, ilegible: true,
      porque: `La fecha "${String(hayCampo ? foto.fecha : foto.tomadaEn)}" no se pudo leer. Se necesita aaaa-mm-dd: "03/07/2026" puede ser el 3 de julio o el 7 de marzo, y adivinar cuál mueve la foto de mes.`,
    };
  }
  return { dia: null, ilegible: false, porque: "Esta foto no trae fecha. No se le pone la de hoy: se aparta para que alguien la diga." };
}

// El día y ya, para quien sólo necesita eso.
export function fechaDeLaFoto(foto) {
  return diaDeLaFoto(foto).dia;
}

/* ════════════ ¿DE QUÉ PARCELA ES ESTA FOTO? ════════════ */

// Punto en polígono, por conteo de cruces. Si el polígono está capturado,
// esto es una respuesta exacta y no hay nada que discutir: el punto está
// adentro o no está.
export function puntoEnPoligono(lat, lng, poligono) {
  const p = (poligono || []).filter(v => v && num(v.lat) !== null && num(v.lng) !== null);
  if (p.length < 3) return null;   // menos de tres esquinas no es un polígono
  let dentro = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const yi = num(p[i].lat), xi = num(p[i].lng);
    const yj = num(p[j].lat), xj = num(p[j].lng);
    const cruza = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// Acepta el polígono como [{lat,lng}] o como [[lat,lng]] — según de dónde
// salga (dibujado en el mapa, o pegado de un KML).
function poligonoDe(parcela) {
  const bruto = parcela?.poligono || parcela?.poligonos || null;
  if (!Array.isArray(bruto) || bruto.length < 3) return null;
  const pts = bruto.map(v => Array.isArray(v)
    ? { lat: num(v[0]), lng: num(v[1]) }
    : { lat: num(v?.lat), lng: num(v?.lng) })
    .filter(v => v.lat !== null && v.lng !== null);
  return pts.length >= 3 ? pts : null;
}

// Cuando la parcela sólo tiene un centro (que es como están capturadas hoy),
// el radio sale de su tamaño: una parcela de 10 ha cabe en un círculo de
// unos 178 metros, y una de 50 ha necesita 400. Usar el mismo radio para
// todas dejaría fuera media parcela grande o metería la del vecino en una
// chica.
//
// El mínimo existe porque casi ninguna parcela tiene las hectáreas
// capturadas todavía, y sin él el radio saldría cero y NADA casaría nunca.
function radioDeParcela(parcela, radioMinimoM) {
  const ha = num(parcela?.hectareas);
  if (ha === null || ha <= 0) return radioMinimoM;
  return Math.max(radioMinimoM, Math.round(Math.sqrt((ha * 10000) / Math.PI)));
}

const metrosEntre = (lat1, lng1, lat2, lng2) => Math.round(distKm(lat1, lng1, lat2, lng2) * 1000);

// De cerca a lejos. La que no tiene centro capturado no compite por
// distancia: se va hasta atrás, porque "no se sabe qué tan lejos" no es
// "está lejísimos" ni mucho menos "está pegadita".
function porDistancia(a, b) {
  if (a.metros === null && b.metros === null) return 0;
  if (a.metros === null) return 1;
  if (b.metros === null) return -1;
  return a.metros - b.metros;
}

// Decide a qué parcela pertenece una foto, con el GPS que ya viene extraído
// de los EXIF.
//
// Tres respuestas posibles, y las tres son distintas:
//   · una parcela, porque el punto cae dentro de su polígono o dentro del
//     alcance de su centro;
//   · "no cae en ninguna parcela conocida" — se dice cuál quedó más cerca y
//     a cuántos metros, PERO NO SE ASIGNA. Que sea la menos lejana no la
//     hace la correcta: el dron pudo haber volado el lote del vecino, o la
//     parcela nueva que nadie ha dado de alta;
//   · "no se sabe", porque la foto no trae GPS o porque ninguna parcela
//     tiene coordenadas capturadas. Eso último NO es que la foto esté fuera:
//     es que no hay contra qué compararla, y decirlo distinto haría que
//     alguien creyera que el dron voló donde no debía.
export function ubicarLaFoto({ foto, parcelas, radioMinimoM = 250 }) {
  const base = {
    fotoId: foto?.id ?? null, parcelaId: null, parcelaNombre: null, metros: null,
    dudosa: false, fueraDeSuPoligono: false, masCercana: null, candidatas: [],
  };

  const lat = num(foto?.lat), lng = num(foto?.lng);
  if (lat === null || lng === null) {
    return {
      ...base, estado: "sin gps",
      dice: "Esta foto no trae GPS, así que no se sabe de qué parcela es. Alguien puede decirlo a mano; la app no lo va a adivinar.",
    };
  }

  const medibles = (parcelas || []).filter(p => poligonoDe(p) || (num(p?.lat) !== null && num(p?.lng) !== null));
  if (medibles.length === 0) {
    return {
      ...base, estado: "sin parcelas ubicadas",
      dice: "Ninguna parcela tiene coordenadas capturadas, así que no hay contra qué comparar el GPS de la foto. No quiere decir que la foto esté fuera del rancho: quiere decir que faltan las coordenadas de las parcelas.",
    };
  }

  const evaluadas = medibles.map(p => {
    const poli = poligonoDe(p);
    const clat = num(p.lat), clng = num(p.lng);
    const metros = (clat === null || clng === null) ? null : metrosEntre(lat, lng, clat, clng);
    const radio = radioDeParcela(p, radioMinimoM);
    return {
      parcelaId: p.id, parcelaNombre: p.nombre || p.id,
      dentroDelPoligono: poli ? puntoEnPoligono(lat, lng, poli) : null,
      metros, radio,
    };
  });

  // El polígono manda: es una respuesta exacta, no una estimación. Pero
  // **también los de polígono se ordenan**. Dos parcelas pueden traer el mismo
  // polígono —una redibujada, o un KML pegado dos veces— y antes se quedaba
  // con la primera de la lista mientras el texto juraba que era "la más
  // cercana": proponía una y decía la otra.
  const enPoligono = evaluadas.filter(e => e.dentroDelPoligono === true).sort(porDistancia);

  // Una parcela cuya orilla capturada dice que NO sigue compitiendo por
  // cercanía al centro, y a propósito: el GPS de un dron falla unos metros y
  // las orillas se dibujan a ojo, así que un punto 20 m afuera casi siempre es
  // de esa parcela. Lo que NO se vale es callarlo — la foto queda marcada
  // dudosa y el texto dice que la orilla ya había contestado que no.
  const cerca = evaluadas
    .filter(e => e.dentroDelPoligono !== true && e.metros !== null && e.metros <= e.radio)
    .sort(porDistancia);

  const porPoligono = enPoligono.length > 0;
  const ganadoras = porPoligono ? enPoligono : cerca;

  if (ganadoras.length > 0) {
    const g = ganadoras[0];
    const contradicePoligono = g.dentroDelPoligono === false;
    // Dos parcelas pegadas pueden alcanzar el mismo punto, y una orilla que
    // dice que no también es motivo de duda. Confirmarlo cuesta un toque, y
    // una traza mal puesta se arrastra todo el ciclo.
    const dudosa = ganadoras.length > 1 || contradicePoligono;
    const otras = ganadoras.slice(1)
      .map(e => `${e.parcelaNombre}${e.metros !== null ? ` a ${e.metros} m` : ""}`)
      .join(", ");
    const conMetros = g.metros !== null ? ` (a ${g.metros} m)` : "";

    let dice;
    if (porPoligono && ganadoras.length > 1) {
      dice = `Cae dentro del polígono de ${ganadoras.length} parcelas: ${g.parcelaNombre} y ${otras}. Se propone ${g.parcelaNombre} porque su centro es el que queda más cerca${conMetros}, pero dos polígonos encimados quieren decir que uno está mal dibujado. Confírmalo antes de dejarla ahí.`;
    } else if (porPoligono) {
      dice = `Cae dentro de ${g.parcelaNombre}.`;
    } else if (ganadoras.length > 1) {
      dice = `Cae en el alcance de ${ganadoras.length} parcelas: la más cercana es ${g.parcelaNombre}${conMetros}, pero también ${otras}. Confírmalo antes de dejarla ahí.` +
        (contradicePoligono ? ` Y ojo: la orilla capturada de ${g.parcelaNombre} dice que el punto queda FUERA de ella; entra nada más por distancia al centro.` : "");
    } else if (contradicePoligono) {
      dice = `La orilla capturada de ${g.parcelaNombre} dice que este punto queda FUERA de la parcela. Queda a ${g.metros} m de su centro, dentro de sus ${g.radio} m de alcance, así que se propone ella —el GPS falla unos metros y las orillas se dibujan a ojo—, pero confírmalo.`;
    } else {
      dice = `Cae a ${g.metros} m del centro de ${g.parcelaNombre}, dentro de sus ${g.radio} m de alcance.`;
    }

    return {
      ...base,
      parcelaId: g.parcelaId, parcelaNombre: g.parcelaNombre, metros: g.metros,
      estado: porPoligono ? "dentro del polígono" : "cerca del centro",
      dudosa,
      fueraDeSuPoligono: contradicePoligono,
      candidatas: ganadoras.map(e => ({
        parcelaId: e.parcelaId, parcelaNombre: e.parcelaNombre, metros: e.metros,
        dentroDelPoligono: e.dentroDelPoligono,
      })),
      dice,
    };
  }

  const conDistancia = evaluadas.filter(e => e.metros !== null).sort(porDistancia);
  const mas = conDistancia[0] || null;
  return {
    ...base,
    estado: "no cae en ninguna parcela conocida",
    masCercana: mas ? { parcelaId: mas.parcelaId, parcelaNombre: mas.parcelaNombre, metros: mas.metros } : null,
    // Se nombra la más cercana como PISTA, no como respuesta. Pegarla ahí
    // sería inventar una traza, y una traza inventada no se distingue después
    // de una buena.
    dice: mas
      ? `No cae en ninguna parcela conocida. La más cercana es ${mas.parcelaNombre}, a ${mas.metros} m — demasiado lejos para darla por buena. Dile tú de cuál es.`
      : "No cae en ninguna parcela conocida, y ninguna tiene centro capturado para medir qué tan lejos quedó.",
  };
}

/* ════════════ EL RECORRIDO: FOTOS → VUELOS ════════════ */

// Un VUELO es todas las fotos de una parcela en un mismo día. Es como se
// habla en el rancho ("el vuelo del martes en la 53"), y es la unidad con la
// que se compara, se revisa y se anota.
//
// Devuelve también lo que NO entró, y con nombre: sin GPS, sin fecha, con
// fecha que no se pudo leer, o fuera de todo. Un renglón que se cae en
// silencio es exactamente el bug del estado de cuenta del banco: lo que queda
// encadena perfecto y el archivo parece bueno.
export function recorrido({ fotos, parcelas, radioMinimoM = 250 }) {
  const sinUbicar = [], sinFecha = [], fechaIlegible = [], dudosas = [];
  const porVuelo = new Map();

  for (const foto of fotos || []) {
    const ub = ubicarLaFoto({ foto, parcelas, radioMinimoM });
    const d = diaDeLaFoto(foto);

    if (!ub.parcelaId) { sinUbicar.push({ foto, ubicacion: ub, porque: ub.dice }); continue; }
    if (!d.dia) {
      (d.ilegible ? fechaIlegible : sinFecha).push({ foto, ubicacion: ub, porque: d.porque });
      continue;
    }
    if (ub.dudosa) dudosas.push({ foto, ubicacion: ub, dia: d.dia, porque: ub.dice });

    const clave = `${ub.parcelaId}|${d.dia}`;
    if (!porVuelo.has(clave)) {
      porVuelo.set(clave, {
        id: clave, parcelaId: ub.parcelaId, parcelaNombre: ub.parcelaNombre,
        fecha: d.dia, fotos: [],
      });
    }
    porVuelo.get(clave).fotos.push({ ...foto, parcelaId: ub.parcelaId, fecha: d.dia, ubicacion: ub });
  }

  const vuelos = [...porVuelo.values()]
    .map(v => ({ ...v, cuantas: v.fotos.length }))
    .sort((a, b) => (a.fecha === b.fecha ? String(a.parcelaNombre).localeCompare(String(b.parcelaNombre)) : a.fecha.localeCompare(b.fecha)));

  const porParcela = [];
  for (const v of vuelos) {
    let p = porParcela.find(x => x.parcelaId === v.parcelaId);
    if (!p) {
      p = { parcelaId: v.parcelaId, parcelaNombre: v.parcelaNombre, vuelos: [], cuantasFotos: 0, ultimoVuelo: null };
      porParcela.push(p);
    }
    p.vuelos.push(v);
    p.cuantasFotos += v.cuantas;
    if (!p.ultimoVuelo || v.fecha > p.ultimoVuelo) p.ultimoVuelo = v.fecha;
  }

  const fuera = sinUbicar.length + sinFecha.length + fechaIlegible.length;
  const partes = [`${vuelos.length} vuelo(s) en ${porParcela.length} parcela(s).`];
  if (sinUbicar.length > 0) partes.push(`${sinUbicar.length} foto(s) no se pudieron ubicar (sin GPS, o fuera de toda parcela conocida): están apartadas, no perdidas.`);
  if (sinFecha.length > 0) partes.push(`${sinFecha.length} foto(s) no traen fecha, así que no se metieron a ningún vuelo. NO se dieron por de hoy.`);
  if (fechaIlegible.length > 0) partes.push(`${fechaIlegible.length} foto(s) traen una fecha que no se pudo leer (se necesita aaaa-mm-dd): tampoco entraron, y no se adivinó el día.`);
  if (dudosas.length > 0) partes.push(`${dudosas.length} foto(s) alcanzan más de una parcela: confírmalas.`);

  return {
    vuelos, porParcela, sinUbicar, sinFecha, fechaIlegible, dudosas,
    fotosTotal: (fotos || []).length,
    fotosEnVuelos: vuelos.reduce((s, v) => s + v.cuantas, 0),
    fotosFuera: fuera,
    dice: partes.join(" "),
  };
}

/* ════════════ LA LÍNEA DEL TIEMPO DE UNA PARCELA ════════════ */

// Los vuelos de una parcela en orden, y cuántos días pasaron entre uno y
// otro. Esto es lo que de verdad enseña algo: la misma tierra el 3 de julio
// y el 20 de agosto, una junto a la otra.
//
// El primer vuelo NO lleva "0 días desde el anterior": lleva null. No hubo
// anterior, y un cero ahí se lee como "se voló dos veces el mismo día".
//
// Y quién decide el mensaje es **si hubo vuelo anterior o no**, no si la
// resta salió: antes las dos cosas llegaban como null por caminos distintos,
// y un vuelo con otro atrás decía "es el primer vuelo registrado".
export function lineaDelTiempo(fotos, parcelaId, { parcelas } = {}) {
  // Acepta fotos que ya traen parcelaId (ya ubicadas y confirmadas) o, si se
  // pasan las parcelas, las ubica al vuelo.
  const propias = (fotos || []).filter(f => {
    if (f?.parcelaId) return f.parcelaId === parcelaId;
    if (!parcelas) return false;
    return ubicarLaFoto({ foto: f, parcelas }).parcelaId === parcelaId;
  });

  const porDia = new Map();
  const sinFecha = [], fechaIlegible = [];
  for (const f of propias) {
    const d = diaDeLaFoto(f);
    if (!d.dia) { (d.ilegible ? fechaIlegible : sinFecha).push({ foto: f, porque: d.porque }); continue; }
    if (!porDia.has(d.dia)) porDia.set(d.dia, []);
    porDia.get(d.dia).push(f);
  }

  const dias = [...porDia.keys()].sort();
  const vuelos = dias.map((dia, i) => {
    const anterior = i > 0 ? dias[i - 1] : null;
    const desde = anterior ? diasEntre(anterior, dia) : null;
    const cuantas = porDia.get(dia).length;
    return {
      id: `${parcelaId}|${dia}`, parcelaId, fecha: dia,
      fotos: porDia.get(dia), cuantas,
      vueloAnterior: anterior,
      diasDesdeElAnterior: desde,
      dice: anterior === null
        ? `${dia}: ${cuantas} foto(s). Es el primer vuelo registrado de esta parcela.`
        : desde === null
          ? `${dia}: ${cuantas} foto(s). Hubo un vuelo antes, el ${anterior}, pero no se pudo calcular cuántos días pasaron entre uno y otro.`
          : `${dia}: ${cuantas} foto(s), ${desde} día(s) después del vuelo anterior.`,
    };
  });

  const fuera = sinFecha.length + fechaIlegible.length;
  const cola = fuera === 0 ? "" :
    ` ${fuera} foto(s) de esta parcela no entraron a ningún vuelo` +
    `${sinFecha.length > 0 ? `: ${sinFecha.length} sin fecha` : ""}` +
    `${fechaIlegible.length > 0 ? `${sinFecha.length > 0 ? " y " : ": "}${fechaIlegible.length} con fecha que no se pudo leer` : ""}` +
    `. No se les puso la de hoy.`;

  return {
    parcelaId, vuelos, cuantosVuelos: vuelos.length,
    primero: vuelos[0]?.fecha || null,
    ultimo: vuelos.length ? vuelos[vuelos.length - 1].fecha : null,
    sinFecha, fechaIlegible,
    fotosFueraDeVuelos: fuera,
    dice: (vuelos.length === 0
      ? "De esta parcela no hay ni un vuelo registrado. No es que esté bien ni mal: es que no se ha visto."
      : vuelos.length === 1
        ? `Un solo vuelo, el ${vuelos[0].fecha}. Con uno no hay comparación todavía; con el segundo empieza a servir.`
        : `${vuelos.length} vuelos, del ${vuelos[0].fecha} al ${vuelos[vuelos.length - 1].fecha}.`) + cola,
  };
}

/* ════════════ LA PARCELA QUE NADIE VUELA ════════════ */

// Éste es el que de verdad se usa. Sin él el dron se estrena en marzo, se usa
// dos veces y para agosto está en el clóset — y la línea del tiempo de la 53
// se queda con una sola foto, que no compara con nada.
//
// Es la misma idea de "lo que dejó de aparecer": la métrica no es "falló", es
// "NO APARECIÓ". Y aquí se separan cosas que parecen una:
//   · "nunca se ha volado"  → es un problema de arranque;
//   · "dejó de volarse"     → es un problema de hoy;
//   · "no se sabe"          → la cuenta no se pudo hacer (una fecha que no se
//     leyó, por ejemplo). **Esto NO cae en el renglón verde.** Cuando caía,
//     una parcela con 67 días sin volar salía "al día" — el error más caro
//     que ha tenido este archivo.
//
// **No supone por qué.** Dice los días. El dron puede estar descompuesto,
// prestado, o pudo haber llovido tres semanas.
export function parcelasSinVolar({ fotos, parcelas, hoy, cada = 30 }) {
  // `hoy` puede llegar como Date desde una pantalla. Se normaliza, y si no se
  // puede leer NO se sustituye por hoy en silencio: sin saber qué día es no se
  // puede decir cuántos días lleva ninguna parcela sin volarse.
  const dia = (hoy === null || hoy === undefined || hoy === "") ? fechaLocal() : aDiaLocal(hoy);
  const rec = recorrido({ fotos, parcelas });
  const porId = new Map(rec.porParcela.map(p => [p.parcelaId, p]));

  // Lo que nadie miró viaja pegado a la alarma. Una foto sin ubicar puede ser
  // justamente de la parcela que sale en rojo, y una alarma que afirma sin
  // decir que no miró todo es peor que no tener alarma.
  const sinMirar = {
    sinUbicar: rec.sinUbicar.length,
    sinFecha: rec.sinFecha.length,
    fechaIlegible: rec.fechaIlegible.length,
    dudosas: rec.dudosas.length,
  };
  sinMirar.total = sinMirar.sinUbicar + sinMirar.sinFecha + sinMirar.fechaIlegible;
  sinMirar.hay = sinMirar.total > 0 || sinMirar.dudosas > 0;
  // Dos versiones del mismo detalle: una con la palabra "foto(s)" para cuando
  // va sola, y otra sin ella para cuando ya viene después de un conteo de
  // fotos — repetir "1 foto(s) ... (1 foto(s) ...)" se lee mal en un teléfono.
  const detalle = (conNombre) => [
    sinMirar.sinUbicar > 0 ? `${sinMirar.sinUbicar}${conNombre ? " foto(s)" : ""} que no se pudieron ubicar (sin GPS o fuera de toda parcela conocida)` : null,
    sinMirar.sinFecha > 0 ? `${sinMirar.sinFecha}${conNombre ? " foto(s)" : ""} sin fecha` : null,
    sinMirar.fechaIlegible > 0 ? `${sinMirar.fechaIlegible}${conNombre ? " foto(s)" : ""} con una fecha que no se pudo leer` : null,
    sinMirar.dudosas > 0 ? `${sinMirar.dudosas}${conNombre ? " foto(s)" : ""} que alcanzan más de una parcela` : null,
  ].filter(Boolean).join(", ");
  sinMirar.dice = detalle(true);
  sinMirar.detalle = detalle(false);

  const colaSinMirar = sinMirar.total > 0
    ? ` Ojo: hay ${sinMirar.total} foto(s) que no entraron a ningún vuelo (${sinMirar.detalle}); alguna podría ser de aquí.`
    : "";

  const filas = (parcelas || []).map(p => {
    const nombre = p.nombre || p.id;
    // Cada parcela puede traer su propio ritmo: una de ajo en plena corrida
    // se mira más seguido que un potrero en descanso.
    const ritmo = num(p.volarCadaDias) ?? num(cada);
    const info = porId.get(p.id) || null;
    const ultimo = info?.ultimoVuelo || null;
    const dias = (ultimo && dia) ? diasEntre(ultimo, dia) : null;

    const dudosasAqui = rec.dudosas.filter(d => d.ubicacion?.parcelaId === p.id);
    const dudosasDelUltimo = ultimo ? dudosasAqui.filter(d => d.dia === ultimo).length : 0;
    const colaDudosas = dudosasDelUltimo > 0
      ? ` El último vuelo se apoya en ${dudosasDelUltimo} foto(s) que alcanzaban más de una parcela: si no eran de aquí, la fecha cambia.`
      : "";

    const comun = {
      parcelaId: p.id, parcelaNombre: nombre, cada: ritmo,
      fotosDudosas: dudosasAqui.length,
    };

    if (!ultimo) {
      return {
        ...comun, ultimoVuelo: null, dias: null, cada: ritmo, proximoSugerido: null, estado: "nunca",
        dice: `${nombre}: no se ha volado nunca.${colaSinMirar}`,
      };
    }
    // Una cuenta que no se pudo hacer no es "va al día": es "no sé".
    if (dias === null) {
      return {
        ...comun, ultimoVuelo: ultimo, dias: null, proximoSugerido: null, estado: "no se sabe",
        dice: `${nombre}: hay vuelos —el último dice "${ultimo}"—, pero no se pudo calcular cuántos días han pasado${dia ? "" : ", porque la fecha de hoy que se pasó no se pudo leer"}. Así que NO se puede decir si va al día ni si va tarde.${colaDudosas}`,
      };
    }
    if (ritmo === null) {
      return {
        ...comun, ultimoVuelo: ultimo, dias, cada: null, proximoSugerido: null, estado: "sin ritmo",
        dice: `${nombre}: el último vuelo fue hace ${dias} día(s). No se ha dicho cada cuánto debería volarse, así que no se puede saber si va tarde.${colaDudosas}`,
      };
    }
    const proximo = sumarDias(ultimo, ritmo);
    if (dias > ritmo) {
      return {
        ...comun, ultimoVuelo: ultimo, dias, proximoSugerido: proximo, estado: "sin volar",
        // Los días y ya. Ni una palabra de por qué.
        dice: `${nombre}: hace ${dias} días que nadie la vuela, y se dijo que cada ${ritmo}. Último vuelo: ${ultimo}.${colaDudosas}${colaSinMirar}`,
      };
    }
    return {
      ...comun, ultimoVuelo: ultimo, dias, proximoSugerido: proximo, estado: "al día",
      dice: `${nombre}: al día (voló hace ${dias} día(s)).${colaDudosas}`,
    };
  });

  const sinVolar = filas.filter(f => f.estado === "sin volar");
  const nunca = filas.filter(f => f.estado === "nunca");
  const noSeSabe = filas.filter(f => f.estado === "no se sabe");
  return {
    filas,
    // Aparte a propósito, igual que en vigilancia: mezclarlas hace que la
    // lista salga siempre en rojo el primer día y que nadie la vuelva a abrir.
    sinVolar, nunca, noSeSabe,
    sinRitmo: filas.filter(f => f.estado === "sin ritmo"),
    alDia: filas.filter(f => f.estado === "al día"),
    sinMirar,
    bloquea: false,
    dice: [
      dia ? null : "No se pudo leer la fecha de hoy que se pasó, así que no se puede decir cuántos días lleva ninguna parcela sin volarse.",
      sinVolar.length > 0 ? `${sinVolar.length} parcela(s) llevan más días de los dichos sin volarse.` : null,
      nunca.length > 0 ? `${nunca.length} parcela(s) no se han volado nunca — de ésas todavía no hay nada que comparar.` : null,
      noSeSabe.length > 0 ? `${noSeSabe.length} parcela(s) tienen vuelos pero no se pudo calcular cuántos días han pasado. NO están al día: no se sabe.` : null,
      // "Todas están al día" cuando no hay NINGUNA parcela es una afirmación
      // sobre lo que nadie miró — la misma falta que decía "ALCANZA" con cero
      // bolsas registradas. Sin parcelas dadas de alta la respuesta no es que
      // todo esté bien: es que no hay nada que mirar, y eso hay que decirlo
      // porque lo que falta es capturar las parcelas.
      filas.length === 0
        ? "No hay ninguna parcela dada de alta, así que no se puede decir nada del recorrido del dron. Da de alta las parcelas primero."
        : (sinVolar.length === 0 && nunca.length === 0 && noSeSabe.length === 0 && dia
            ? "Todas las parcelas se han volado dentro de su ritmo." : null),
      sinMirar.hay ? `Y esto no lo mira todo: ${sinMirar.dice}.` : null,
    ].filter(Boolean).join(" "),
  };
}

/* ════════════ COMPARAR DOS VUELOS ════════════ */

// Qué cambió entre dos fechas. Da los días transcurridos y arma los pares de
// fotos para ponerlas lado a lado — el andamiaje, no el juicio.
//
// **No devuelve ningún porcentaje de crecimiento**, y eso es a propósito.
// Dos fotos tomadas a distinta altura, con distinta luz y desde distinto
// ángulo no miden nada; un "creció 18 %" salido de mirarlas es un número
// inventado, y los números inventados se creen más que las opiniones porque
// traen decimales. Medir es otra cosa —ortomosaico a escala, NDVI
// calibrado— y es un servicio aparte.
export function compararVuelos(vueloA, vueloB, { toleranciaM = 40 } = {}) {
  const vacio = { comparable: false, dias: null, antes: null, despues: null, pares: [], sinPar: [], sinGps: { antes: 0, despues: 0 }, crecimiento: null };
  if (!vueloA || !vueloB) {
    return { ...vacio, dice: "Faltan los dos vuelos para comparar." };
  }
  if (vueloA.parcelaId && vueloB.parcelaId && vueloA.parcelaId !== vueloB.parcelaId) {
    return {
      ...vacio,
      // Poner la 53 junto a la Gabino y hablar de "el cambio" es comparar dos
      // tierras distintas y llamarle tiempo.
      dice: "Esos dos vuelos son de parcelas distintas. Comparar una parcela contra otra no dice cómo cambió ninguna de las dos.",
    };
  }

  // Migue va a escoger dos de una lista, en el orden que se le ocurra. El
  // orden lo pone la fecha, no el clic: si no, saldrían días negativos y una
  // "mejoría" que en realidad es el vuelo viejo.
  const [antes, despues] = (vueloA.fecha && vueloB.fecha && vueloB.fecha < vueloA.fecha)
    ? [vueloB, vueloA] : [vueloA, vueloB];

  const dias = (antes.fecha && despues.fecha) ? diasEntre(antes.fecha, despues.fecha) : null;

  const conGps = (v) => (v.fotos || []).filter(f => num(f.lat) !== null && num(f.lng) !== null);
  const gpsA = conGps(antes), gpsB = conGps(despues);
  const porGps = gpsA.length > 0 && gpsB.length > 0;
  const sinGps = porGps
    ? { antes: (antes.fotos || []).length - gpsA.length, despues: (despues.fotos || []).length - gpsB.length }
    : { antes: 0, despues: 0 };

  const pares = [];
  const sinPar = [];
  if (porGps) {
    // Se emparejan por LUGAR: la foto del 3 de julio de esa esquina contra la
    // del 20 de agosto de esa misma esquina. Es lo único que hace comparable
    // un par.
    //
    // Las ya usadas se marcan por POSICIÓN, no por id. Con el id, una foto sin
    // id marcaba `undefined` como usado y a partir de ahí se saltaban TODAS
    // las demás del vuelo de después: desaparecían de los pares y también de
    // los "sin par" — se esfumaban de los dos lados. Y dos tarjetas con el
    // mismo IMG_0001 hacían lo mismo.
    const usadas = new Set();
    for (const a of gpsA) {
      let mejor = -1, mejorM = null;
      for (let j = 0; j < gpsB.length; j++) {
        if (usadas.has(j)) continue;
        const m = metrosEntre(num(a.lat), num(a.lng), num(gpsB[j].lat), num(gpsB[j].lng));
        if (mejorM === null || m < mejorM) { mejor = j; mejorM = m; }
      }
      if (mejor >= 0 && mejorM !== null && mejorM <= toleranciaM) {
        usadas.add(mejor);
        pares.push({ antes: a, despues: gpsB[mejor], metros: mejorM, emparejadoPor: "lugar", dice: `Mismo punto (a ${mejorM} m), ${antes.fecha} contra ${despues.fecha}.` });
      } else {
        sinPar.push({ foto: a, de: "antes", dice: `De este punto no hay foto parecida en el vuelo del ${despues.fecha}.` });
      }
    }
    for (let j = 0; j < gpsB.length; j++) {
      if (!usadas.has(j)) sinPar.push({ foto: gpsB[j], de: "después", dice: `De este punto no hay foto parecida en el vuelo del ${antes.fecha}.` });
    }
  } else {
    const n = Math.min((antes.fotos || []).length, (despues.fotos || []).length);
    for (let i = 0; i < n; i++) {
      pares.push({
        antes: antes.fotos[i], despues: despues.fotos[i], metros: null, emparejadoPor: "orden",
        // Se dice fuerte: emparejar por orden es una suposición, no una
        // medición, y quien las mire tiene que saberlo.
        dice: "Emparejadas por el orden en que se tomaron, no por el lugar: puede que no sean el mismo punto.",
      });
    }
  }

  const colaSinGps = (sinGps.antes + sinGps.despues) > 0
    ? ` ${sinGps.antes + sinGps.despues} foto(s) de estos vuelos no traen GPS y no se pudieron emparejar por lugar: quedaron fuera de la comparación, no borradas.`
    : "";

  return {
    comparable: true,
    parcelaId: antes.parcelaId || despues.parcelaId || null,
    antes: { id: antes.id || null, fecha: antes.fecha || null, cuantas: (antes.fotos || []).length },
    despues: { id: despues.id || null, fecha: despues.fecha || null, cuantas: (despues.fotos || []).length },
    dias,
    pares, sinPar,
    // Las que ni siquiera pudieron entrar al emparejado, contadas y dichas.
    sinGps,
    emparejadoPor: porGps ? "lugar" : "orden",
    // Explícito, y con su explicación pegada, para que nadie lo "arregle"
    // después metiendo un número aquí.
    crecimiento: null,
    porqueNoHayPorcentaje:
      "No se calcula ningún porcentaje de cambio: dos fotos no lo miden. Distinta altura, distinta hora y distinta luz mueven el color más que la planta. Para medir de verdad hace falta un vuelo de fotogrametría con ortomosaico y NDVI calibrado, que es un servicio aparte.",
    dice: (dias === null
      ? `${pares.length} par(es) de fotos para ver lado a lado. A alguno de los dos vuelos le falta la fecha, así que no se puede decir cuántos días pasaron.`
      : `Del ${antes.fecha} al ${despues.fecha}: ${dias} día(s), ${pares.length} par(es) de fotos para ver lado a lado` +
        `${porGps ? " del mismo punto" : ", emparejadas por orden"}.` +
        (sinPar.length > 0 ? ` ${sinPar.length} foto(s) se quedaron sin par.` : "")) + colaSinGps,
  };
}

/* ════════════ LO QUE SE LE MANDA A LA IA ════════════ */

// Doce fotos. Por qué doce: un vuelo trae entre sesenta y doscientas, y
// mandarlas todas cuesta cada vez sin decir nada nuevo — la número 137 es la
// misma tierra que la 136. Doce repartidas a lo largo del vuelo cubren la
// parcela de punta a punta.
export const TOPE_FOTOS_REVISION = 12;

export const TIPOS_OCURRENCIA = [
  "plaga", "enfermedad", "maleza", "riego", "falta de planta",
  "daño físico", "crecimiento", "otro",
];

// Reparte parejo a lo largo del vuelo en vez de tomar las primeras: las
// primeras doce son todas la misma esquina, porque así se levanta un vuelo.
function repartirParejo(lista, tope) {
  if (lista.length <= tope) return lista.slice();
  const paso = lista.length / tope;
  const out = [];
  for (let i = 0; i < tope; i++) out.push(lista[Math.floor(i * paso)]);
  return out;
}

// Arma lo que se le va a mandar a la IA para que revise un vuelo.
//
// El contexto es la mitad del asunto: sin él, una IA mirando fotos de una
// parcela dice "se observa un cultivo verde en hileras", que ya lo sabíamos.
// Con el cultivo, la fecha de siembra, lo que se le aplicó y lo que dice la
// bitácora, puede decir algo que sirva para ir a ver.
//
// Y el tope DICE cuántas dejó fuera. Un tope callado hace creer que se revisó
// todo el vuelo cuando se revisó la décima parte, y esa creencia es peor que
// no haber revisado.
export function prepararRevision({ vuelo, parcela, bitacora, aplicaciones, tope = TOPE_FOTOS_REVISION }) {
  const todas = (vuelo?.fotos || []).slice().sort((a, b) => String(a.tomadaEn || a.orden || "").localeCompare(String(b.tomadaEn || b.orden || "")));
  if (todas.length === 0) {
    return {
      listo: false, fotos: [], fotosMandadas: 0, fotosTotal: 0, fotosFuera: 0,
      contexto: null, faltaContexto: [], noSeUsaron: null, pregunta: null,
      esOpinion: true, bloquea: false,
      dice: "Ese vuelo no tiene fotos, así que no hay nada que revisar.",
    };
  }

  const elegidas = repartirParejo(todas, Math.max(1, num(tope) ?? TOPE_FOTOS_REVISION));
  const fuera = todas.length - elegidas.length;

  // Una fecha que vino y no se pudo leer NO es una fecha que no se capturó:
  // en la primera hay que corregir un dato, en la segunda hay que ir a
  // buscarlo. Se dicen distinto para que se arregle lo que es.
  const fechaCruda = vuelo?.fecha ?? null;
  const fecha = aDiaLocal(fechaCruda) || null;
  const siembraCruda = parcela?.fechaSiembra || parcela?.siembra || null;
  const siembra = aDiaLocal(siembraCruda) || null;
  const diasDeSembrado = (siembra && fecha) ? diasEntre(siembra, fecha) : null;

  // Sólo lo de ESTA parcela, y sólo lo que pasó ANTES del vuelo: una
  // aplicación de la semana que viene no explica una foto de hoy.
  //
  // Antes el filtro dejaba pasar lo que NO traía parcela ("si no dice de cuál
  // es, ha de ser de ésta") y, si la ficha de la parcela venía sin id, dejaba
  // pasar TODO: la urea de GABINO y la plaga de GABINO acababan explicando una
  // foto de la 53, el modelo razonaba sobre una parcela que no existe y eso
  // terminaba escrito en la bitácora. Hoy un registro que no se puede amarrar
  // a esta parcela **no se le pega**: se cuenta y se dice.
  const clasificar = (lista) => {
    const propias = [], sinParcela = [], deOtra = [], sinSaberDeCual = [], posteriores = [], sinFecha = [];
    for (const x of lista || []) {
      if (!x) continue;
      if (!x.parcelaId) { sinParcela.push(x); continue; }
      if (!parcela?.id) { sinSaberDeCual.push(x); continue; }
      if (String(x.parcelaId) !== String(parcela.id)) { deOtra.push(x); continue; }
      const f = aDiaLocal(x.fecha);
      if (!f) { sinFecha.push(x); continue; }
      if (fecha && f > fecha) { posteriores.push(x); continue; }
      propias.push({ ...x, fecha: f });
    }
    return { propias, sinParcela, deOtra, sinSaberDeCual, posteriores, sinFecha };
  };

  const ap = clasificar(aplicaciones);
  const bi = clasificar(bitacora);
  const aps = ap.propias.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const bit = bi.propias.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const cuenta = (k) => ap[k].length + bi[k].length;
  const noSeUsaron = {
    sinParcela: cuenta("sinParcela"),
    deOtraParcela: cuenta("deOtra"),
    sinSaberDeCual: cuenta("sinSaberDeCual"),
    posterioresAlVuelo: cuenta("posteriores"),
    sinFecha: cuenta("sinFecha"),
  };
  noSeUsaron.total = Object.values(noSeUsaron).reduce((s, n) => s + n, 0);
  noSeUsaron.dice = [
    noSeUsaron.sinParcela > 0 ? `${noSeUsaron.sinParcela} sin parcela anotada` : null,
    noSeUsaron.deOtraParcela > 0 ? `${noSeUsaron.deOtraParcela} de otra parcela` : null,
    noSeUsaron.sinSaberDeCual > 0 ? `${noSeUsaron.sinSaberDeCual} que no se pudieron comparar porque esta ficha de parcela no trae identificador` : null,
    noSeUsaron.posterioresAlVuelo > 0 ? `${noSeUsaron.posterioresAlVuelo} posteriores al vuelo` : null,
    noSeUsaron.sinFecha > 0 ? `${noSeUsaron.sinFecha} sin fecha, que no se pueden poner antes ni después del vuelo` : null,
  ].filter(Boolean).join(", ");

  const falta = [];
  if (!parcela?.id) falta.push("de qué parcela del sistema es esta ficha (no trae identificador)");
  if (!parcela?.cultivo) falta.push("qué se sembró en esta parcela");
  if (!siembra) falta.push(siembraCruda ? `cuándo se sembró (viene "${String(siembraCruda)}" y no se pudo leer)` : "cuándo se sembró");
  if (aps.length === 0) falta.push("qué se le ha aplicado");
  if (bit.length === 0) falta.push("qué dice la bitácora de ocurrencias");

  const contexto = {
    parcelaId: parcela?.id || null,
    parcela: parcela?.nombre || null,
    cultivo: parcela?.cultivo || null,
    hectareas: num(parcela?.hectareas),
    fechaSiembra: siembra || null,
    diasDeSembrado,
    fechaDelVuelo: fecha,
    aplicaciones: aps.map(a => ({ fecha: a.fecha, que: a.producto || a.nombre || a.tipo || "una aplicación", nota: a.nota || null })),
    bitacora: bit.map(b => ({ fecha: b.fecha, texto: b.texto || b.nota || "", quien: b.quien || null })),
    noSeUsaron,
  };

  const renglones = [
    `Parcela: ${contexto.parcela || "sin nombre"}${contexto.hectareas !== null ? ` (${contexto.hectareas} ha)` : ""}.`,
    `Cultivo: ${contexto.cultivo || "NO SE CAPTURÓ."}`,
    contexto.fechaSiembra
      ? `Sembrada el ${contexto.fechaSiembra}${diasDeSembrado !== null ? `, o sea ${diasDeSembrado} días antes de este vuelo.` : "."}`
      : siembraCruda
        ? `Fecha de siembra: viene como "${String(siembraCruda)}" y no se pudo leer, así que NO se sabe de cuándo es.`
        : "Fecha de siembra: NO SE CAPTURÓ.",
    `Fecha del vuelo: ${fecha || (fechaCruda ? `viene como "${String(fechaCruda)}" y no se pudo leer, así que NO se sabe.` : "NO SE CAPTURÓ.")}`,
    aps.length > 0
      ? `Lo que se le ha aplicado hasta ese día: ${contexto.aplicaciones.map(a => `${a.fecha} ${a.que}`).join("; ")}.`
      : "Aplicaciones registradas: NINGUNA. Eso quiere decir que no hay registro, NO que no se haya aplicado nada.",
    bit.length > 0
      ? `Lo que dice la bitácora: ${contexto.bitacora.map(b => `${b.fecha} ${b.texto}`).join("; ")}.`
      : "Bitácora de ocurrencias: SIN ANOTACIONES para esta parcela.",
    // Se le dice al modelo lo que quedó fuera, con la misma franqueza con que
    // se le dice a la persona: si no, razona como si el expediente estuviera
    // completo.
    noSeUsaron.total > 0
      ? `Hay ${noSeUsaron.total} registro(s) que NO se le pegaron a esta parcela (${noSeUsaron.dice}). No se dan por de aquí.`
      : null,
    `Se te mandan ${elegidas.length} fotos de las ${todas.length} de ese vuelo, repartidas a lo largo del recorrido.`,
    "",
    "Lo que se te pide:",
    "1. Describe lo que SE VE en las fotos: color, uniformidad, huecos, orillas, encharcamientos, maleza.",
    "2. Señala en cuáles fotos lo viste, para que alguien pueda ir a ese punto.",
    "3. Si algo no se alcanza a ver con claridad, DILO. No completes con lo que suele pasar.",
    "4. NO des porcentajes ni cifras de rendimiento, altura o cobertura: no se pueden medir en una foto.",
    "5. NO des órdenes ni digas qué aplicar. Quien decide es el agrónomo, que ve cosas que la foto no.",
    "6. Contesta en español llano, para que lo lea alguien en un teléfono en el campo.",
  ].filter(r => r !== null);

  return {
    listo: true,
    fotos: elegidas,
    fotosMandadas: elegidas.length,
    fotosTotal: todas.length,
    // Se dice, siempre. Un tope callado hace creer que se revisó todo.
    fotosFuera: fuera,
    contexto,
    faltaContexto: falta,
    noSeUsaron,
    pregunta: renglones.join("\n"),
    // Lo que vuelva de aquí es una opinión sobre unas fotos. Nunca un dato.
    esOpinion: true,
    bloquea: false,
    dice: `Se van a mandar ${elegidas.length} de las ${todas.length} fotos del vuelo` +
      (fuera > 0 ? `; quedan ${fuera} sin mandar — la revisión NO es de todo el vuelo.` : ".") +
      (falta.length > 0
        ? ` Falta contexto (${falta.join(", ")}): la IA va a poder decir menos, y va a estar adivinando más.`
        : " Va con todo el contexto del rancho.") +
      (noSeUsaron.total > 0
        ? ` No se le pegaron ${noSeUsaron.total} registro(s) que no se pudieron amarrar a esta parcela (${noSeUsaron.dice}).`
        : "") +
      " Lo que conteste es una observación sobre unas fotos, no una medición: sirve para ir a ver, no para decidir solo.",
  };
}

/* ════════════ LA BITÁCORA DE OCURRENCIAS ════════════ */

export const ORIGENES_OBSERVACION = ["persona", "ia"];

// El id de una observación tiene que ser único de verdad. Con `obs${Date.now()}`
// dos observaciones creadas en el mismo milisegundo —lo normal cuando la
// revisión con IA devuelve tres y la pantalla las propone en fila— nacían con
// el mismo id: en una bitácora de SÓLO INSERCIÓN eso es una tapando a la otra,
// o la nube rechazando la segunda, y la que se pierde no deja rastro.
// El consecutivo cuida el mismo milisegundo en este teléfono; el pedazo al
// azar cuida el mismo milisegundo en dos teléfonos distintos.
let consecutivoObservacion = 0;
function idDeObservacion() {
  consecutivoObservacion += 1;
  const azar = Math.random().toString(36).slice(2, 8);
  return `obs${Date.now()}-${consecutivoObservacion}-${azar}`;
}

// Una anotación del vuelo, ligada a la parcela y a la fecha. De SÓLO
// INSERCIÓN, como el resto del sistema: una observación no se edita ni se
// borra — si estaba equivocada, se anota otra que lo diga. Una bitácora que
// se puede corregir después no es una bitácora, es un borrador.
//
// **No guarda.** Devuelve la propuesta y la app la inserta cuando una
// persona confirma.
export function guardarObservacion({ parcelaId, vueloId, fecha, texto, quien, origen = "persona", tipo, fotoId, id } = {}) {
  const t = String(texto == null ? "" : texto).trim();
  if (!t) {
    // Un renglón vacío en la bitácora es peor que no tener el renglón: se ve
    // como que sí se revisó y no dice nada.
    return { ok: false, observacion: null, porque: "Una observación sin texto no es una observación. Escribe qué se vio, aunque sea corto." };
  }
  if (!parcelaId) {
    return { ok: false, observacion: null, porque: "Falta de qué parcela es. Una ocurrencia que no está ligada a una parcela no la va a volver a encontrar nadie." };
  }

  const deIA = origen === "ia";
  const avisos = [];
  if (!ORIGENES_OBSERVACION.includes(origen)) {
    return { ok: false, observacion: null, porque: `No se sabe de dónde salió esta observación. Tiene que ser una de: ${ORIGENES_OBSERVACION.join(", ")}.` };
  }
  // Sin nombre se guarda igual: el capataz que dicta desde el campo no va a
  // perder su nota por no haber escogido su usuario. Pero se dice que falta.
  if (!deIA && !quien) avisos.push("No quedó a nombre de quién. Se guarda igual, pero dentro de tres meses nadie va a saber quién la vio.");
  if (tipo && !TIPOS_OCURRENCIA.includes(tipo)) {
    // No se corrige lo que escribió la persona: se guarda tal cual y se dice.
    avisos.push(`"${tipo}" no está en la lista de tipos. Se guarda tal cual, no se cambia por otro.`);
  }

  // Sin fecha se pone la de hoy, que es la del día en que se está anotando. Si
  // vino una fecha y NO se pudo leer, no se sustituye por la de hoy en
  // silencio: se deja vacía y se dice, porque una ocurrencia mal fechada es
  // peor que una sin fechar.
  const sinFecha = fecha === null || fecha === undefined || fecha === "";
  const dia = sinFecha ? fechaLocal() : aDiaLocal(fecha);
  if (!sinFecha && dia === null) {
    avisos.push(`La fecha "${String(fecha)}" no se pudo leer (se necesita aaaa-mm-dd), así que la observación queda sin fecha. No se le puso la de hoy.`);
  }

  return {
    ok: true,
    avisos,
    observacion: {
      id: id || idDeObservacion(),
      parcelaId,
      vueloId: vueloId || null,
      fotoId: fotoId || null,
      fecha: dia,
      texto: t,
      tipo: tipo || null,
      quien: deIA ? (quien || "Revisión de fotos con IA") : (quien || null),
      origen,
      // Una revisión de IA es una OPINIÓN sobre unas fotos. Nace sin
      // confirmar y así se queda hasta que alguien la mire: si naciera
      // confirmada, en seis meses nadie distinguiría lo que Fito vio con sus
      // ojos de lo que un modelo creyó ver en una foto.
      esOpinion: deIA,
      confirmada: false,
      confirmadaPor: null,
      // Marca de tiempo: ésta sí va en UTC, que es como se guardan.
      creadoEn: new Date().toISOString(),
      soloInsercion: true,
    },
    dice: deIA
      ? "Queda anotada como observación de la IA, sin confirmar. No cuenta como dato ni dispara nada: alguien tiene que ir a ver."
      : "Queda anotada en la bitácora de la parcela. No se edita ni se borra: si estaba mal, se anota otra que lo diga.",
  };
}

// Todo lo de una parcela en una sola respuesta: cuántos vuelos, cuándo fue el
// último, la línea del tiempo y lo que se anotó — separando lo que vio una
// persona de lo que opinó la IA, porque no pesan igual.
//
// Ésta es la pantalla del dueño, así que lo que se quedó fuera va escrito: un
// "3 fotos" cuando había 5 se ve completo y nadie vuelve a preguntar.
export function resumenDeParcela({ parcela, fotos, observaciones, hoy, cada = 30 }) {
  const dia = (hoy === null || hoy === undefined || hoy === "") ? fechaLocal() : aDiaLocal(hoy);
  const id = parcela?.id || null;
  const linea = lineaDelTiempo(fotos, id, { parcelas: parcela ? [parcela] : [] });

  const obs = (observaciones || []).filter(o => o?.parcelaId === id);
  const dePersona = obs.filter(o => o.origen !== "ia");
  const deIA = obs.filter(o => o.origen === "ia");
  const sinConfirmar = deIA.filter(o => !o.confirmada);

  const dias = (linea.ultimo && dia) ? diasEntre(linea.ultimo, dia) : null;
  const ritmo = num(parcela?.volarCadaDias) ?? num(cada);

  const enVuelos = linea.vuelos.reduce((s, v) => s + v.cuantas, 0);
  const fueraDeVuelos = linea.fotosFueraDeVuelos;

  const partes = [];
  if (linea.cuantosVuelos === 0) {
    partes.push(`De ${parcela?.nombre || "esta parcela"} no hay ni un vuelo. No es que esté bien ni mal: es que no se ha visto.`);
  } else {
    partes.push(`${linea.cuantosVuelos} vuelo(s), el último el ${linea.ultimo}${dias !== null ? ` (hace ${dias} día(s))` : ""}.`);
    if (dias === null) partes.push("No se pudo calcular cuántos días han pasado desde entonces, así que no se dice si va al día.");
    if (ritmo !== null && dias !== null && dias > ritmo) partes.push(`Lleva más de los ${ritmo} días que se dijeron.`);
    if (linea.cuantosVuelos === 1) partes.push("Con un solo vuelo todavía no hay con qué comparar.");
  }
  if (fueraDeVuelos > 0) {
    const porQue = [
      linea.sinFecha.length > 0 ? `${linea.sinFecha.length} sin fecha` : null,
      linea.fechaIlegible.length > 0 ? `${linea.fechaIlegible.length} con una fecha que no se pudo leer` : null,
    ].filter(Boolean).join(" y ");
    partes.push(
      `Ojo con la cuenta de fotos: entraron a un vuelo ${enVuelos} de ${enVuelos + fueraDeVuelos};` +
      ` las otras ${fueraDeVuelos} no (${porQue}). No se les puso la fecha de hoy y no están perdidas:` +
      ` están apartadas hasta que alguien diga de qué día son.`
    );
  }
  if (dePersona.length > 0) partes.push(`${dePersona.length} anotación(es) de la gente.`);
  if (deIA.length > 0) partes.push(`${deIA.length} observación(es) de la IA${sinConfirmar.length > 0 ? `, ${sinConfirmar.length} sin que nadie las haya ido a ver` : ""} — son opiniones sobre fotos, no mediciones.`);

  return {
    parcelaId: id,
    parcelaNombre: parcela?.nombre || null,
    cuantosVuelos: linea.cuantosVuelos,
    cuantasFotos: enVuelos,
    // Lo que no entró, con nombre y por separado.
    fotosSinFecha: linea.sinFecha.length,
    fotosFechaIlegible: linea.fechaIlegible.length,
    fotosFueraDeVuelos: fueraDeVuelos,
    primerVuelo: linea.primero,
    ultimoVuelo: linea.ultimo,
    diasDesdeElUltimo: dias,
    hayComparacion: linea.cuantosVuelos >= 2,
    linea: linea.vuelos,
    observaciones: { todas: obs, dePersona, deIA, sinConfirmar },
    dice: partes.join(" "),
  };
}
