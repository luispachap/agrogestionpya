// ============================================================
//  AgroGestión — El mapa del rancho (pantalla)
//
//  No es un sistema aparte: pinta las MISMAS parcelas, ranchos y ciclos que ya
//  existen, y al tocar una parcela enseña lo que el sistema ya sabe de ella.
//  Lo único que el mapa agrega son los límites (evento `limite_geo`): los
//  dibuja una persona, se caminan con el teléfono o se importan de un archivo.
//  Nada se supone: una parcela sin límite sale como «sin límite», no con un
//  cuadro inventado. Toda la cuenta vive en `mapa.js` (pura y probada).
//
//  El mapa (Leaflet) ya lo cargaba la app para ubicar un punto; aquí se usa el
//  mismo. Las capas de fondo salen de CAPAS_BASE: cambiar de proveedor es
//  cambiar ese renglón. Más adelante entran aquí, como capas, las imágenes de
//  satélite por fecha y los levantamientos de dron (docs/MAPA.md).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Ic } from "./icons.jsx";
import { fmt, fechaLocal } from "./calculos.js";
import { guardarLimite, quitarLimite, limitesDe, limiteDe, revisarAnillo, superficieDe, cajaDe, fichaDeParcela, resumenDelMapa, leerArchivoGeografico, sugerirParcela, colorDeCultivo, FUENTES_DE_LIMITE } from "./mapa.js";
import { cultivoEn } from "./ciclos.js";
import PanelSatelite from "./Satelite.jsx";

export const CAPAS_BASE = {
  satelite: { nombre: "Satélite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", opciones: { maxZoom: 21, maxNativeZoom: 18, attribution: "Imagen: Esri, Maxar, Earthstar Geographics" } },
  calles: { nombre: "Caminos", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", opciones: { maxZoom: 21, maxNativeZoom: 19, attribution: "© OpenStreetMap" } },
};
const ha = (n) => `${(Math.round(n * 100) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })} ha`;
const esPunto = (x) => x && x.lat !== "" && x.lat != null && x.lng !== "" && x.lng != null && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng));
const DIA = (f) => (f ? f.split("-").reverse().join("/") : "—");

export default function MapaAgricola({ data, add, upd, session, onClose, onNav }) {
  const L = typeof window !== "undefined" ? window.L : null;
  const hoy = fechaLocal(), quien = { id: session.id, nombre: session.nombre, rol: session.role };
  const sello = () => ({ quien, cuando: new Date().toISOString(), fecha: hoy });
  const puedeEditar = session.role === "admin", veDinero = ["admin", "dueno", "finanzas"].includes(session.role);
  const parcelas = data.parcelas || [], ranchos = data.ranchos || [];
  const limites = useMemo(() => limitesDe(data.eventos || []), [data.eventos]);
  const resumen = useMemo(() => resumenDelMapa(parcelas, limites), [parcelas, limites]);

  const cajaRef = useRef(null), mapa = useRef(null), capas = useRef({}), datosRef = useRef(data); datosRef.current = data;
  const [base, setBase] = useState("satelite");
  const [rancho, setRancho] = useState("");                 // "" = todos
  const [sel, setSel] = useState(null);                     // id de la parcela tocada
  const [edit, setEdit] = useState(null);                   // { de, pts, gps: n, vSel }
  const [panel, setPanel] = useState(null);                 // "faltan" | "capas" | null
  const [dice, setDice] = useState("");
  const [motivo, setMotivo] = useState(null);               // texto del motivo al quitar un límite
  const [imp, setImp] = useState(null);                     // { archivo, figuras: [{..., parcelaId}], avisos, descartadas }
  const [buscando, setBuscando] = useState(false);
  const [sat, setSat] = useState(false);                    // el análisis de satélite de la parcela tocada
  const [capaSat, setCapaSat] = useState(null);             // qué pasada se está viendo encima del fondo
  const editRef = useRef(edit); editRef.current = edit;
  const satRef = useRef(sat); satRef.current = sat;
  const archivoRef = useRef(null);

  const visibles = useMemo(() => parcelas.filter(p => !rancho || p.ranchoId === rancho), [parcelas, rancho]);
  const ficha = useMemo(() => (sel ? fichaDeParcela(data, sel, hoy, limites) : null), [data, sel, hoy, limites]);

  /* ── el mapa: se crea una vez ── */
  useEffect(() => {
    if (!L || !cajaRef.current) return;
    const m = L.map(cajaRef.current, { zoomControl: false, attributionControl: true, maxZoom: 21 }).setView([22.75, -102.55], 11);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
    capas.current = { fondo: null, ranchos: L.layerGroup().addTo(m), parcelas: L.layerGroup().addTo(m), puntos: L.layerGroup().addTo(m), importar: L.layerGroup().addTo(m), edicion: L.layerGroup().addTo(m), yo: L.layerGroup().addTo(m) };
    m.on("click", (ev) => {
      const e = editRef.current;
      if (e) setEdit({ ...e, pts: [...e.pts, [ev.latlng.lat, ev.latlng.lng]], vSel: null });
      else if (!satRef.current) setSel(null);   // con el análisis abierto, tocar el mapa no lo cierra
    });
    m.on("zoomend", () => cajaRef.current?.classList.toggle("mp-lejos", m.getZoom() < 14));
    mapa.current = m; window.__agroMapa = m;
    setTimeout(() => { m.invalidateSize(); encuadrar("", true); }, 120);
    return () => { m.remove(); mapa.current = null; delete window.__agroMapa; };
  }, []);   // eslint-disable-line

  /* ── el fondo ── */
  useEffect(() => {
    const m = mapa.current; if (!m || !L) return;
    if (capas.current.fondo) m.removeLayer(capas.current.fondo);
    capas.current.fondo = L.tileLayer(CAPAS_BASE[base].url, CAPAS_BASE[base].opciones).addTo(m); capas.current.fondo.bringToBack();
  }, [base]);   // eslint-disable-line

  /* ── ranchos y parcelas ── */
  useEffect(() => {
    const m = mapa.current; if (!m || !L) return;
    const c = capas.current; c.ranchos.clearLayers(); c.parcelas.clearLayers(); c.puntos.clearLayers();
    for (const r of ranchos.filter(x => !rancho || x.id === rancho)) {
      const l = limiteDe(limites, "rancho", r.id);
      if (l && !(edit?.de.tipo === "rancho" && edit.de.id === r.id)) L.polygon([l.anillo, ...l.huecos], { color: "#fff", weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(c.ranchos).bindTooltip(r.nombre, { permanent: true, direction: "top", className: "mp-rotulo mp-rancho" });
    }
    for (const p of visibles) {
      const l = limiteDe(limites, "parcela", p.id), ce = cultivoEn(data.siembras || [], p.id, hoy), nombre = ce.cultivos.join(" + ") || "";
      if (l) {
        if (edit?.de.tipo === "parcela" && edit.de.id === p.id) continue;
        const color = colorDeCultivo(nombre), es = sel === p.id;
        const pol = L.polygon([l.anillo, ...l.huecos], { color: es ? "#fff" : color, weight: es ? (sat ? 2.5 : 4) : 2.5, fillColor: color, fillOpacity: es ? (sat ? 0 : 0.42) : 0.22 }).addTo(c.parcelas);
        if (!(es && sat)) pol.bindTooltip(`<b>${escapar(p.nombre)}</b><br>${escapar(nombre || "sin ciclo vigente")} · ${ha(l.ha)}`, { permanent: true, direction: "center", className: "mp-rotulo" });
        pol.on("click", (ev) => { if (editRef.current) return; L.DomEvent.stopPropagation(ev); if (p.id !== sel) setSat(false); setSel(p.id); setPanel(null); });
      } else if (esPunto(p)) {
        const mk = L.circleMarker([Number(p.lat), Number(p.lng)], { radius: 8, color: "#fff", weight: 2, fillColor: "#000", fillOpacity: 0.35, dashArray: "3 3" }).addTo(c.puntos);
        mk.bindTooltip(`${escapar(p.nombre)} · sin límite`, { permanent: true, direction: "top", className: "mp-rotulo mp-falta" });
        mk.on("click", (ev) => { if (editRef.current) return; L.DomEvent.stopPropagation(ev); setSel(p.id); setPanel(null); });
      }
    }
  }, [limites, visibles, sel, sat, rancho, edit?.de?.id, data.siembras]);   // eslint-disable-line

  /* ── el trazo que se está haciendo ── */
  useEffect(() => {
    const m = mapa.current; if (!m || !L) return;
    const g = capas.current.edicion; g.clearLayers(); if (!edit) return;
    const pts = edit.pts;
    const linea = pts.length >= 3 ? L.polygon(pts, { color: "#fff", weight: 3, fillColor: "#E4B23F", fillOpacity: 0.25, interactive: false }).addTo(g) : pts.length === 2 ? L.polyline(pts, { color: "#fff", weight: 3, interactive: false }).addTo(g) : null;
    const icono = (cls) => L.divIcon({ className: "", html: `<div class="mp-esq ${cls}"></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    pts.forEach((p, i) => {
      const mk = L.marker(p, { draggable: true, icon: icono(edit.vSel === i ? "mp-esq-sel" : ""), keyboard: false }).addTo(g);
      mk.on("drag", (ev) => { const q = pts.map((x, k) => (k === i ? [ev.latlng.lat, ev.latlng.lng] : x)); linea?.setLatLngs(q); });
      mk.on("dragend", (ev) => { const ll = ev.target.getLatLng(); setEdit(e => e && ({ ...e, pts: e.pts.map((x, k) => (k === i ? [ll.lat, ll.lng] : x)), vSel: i })); });
      mk.on("click", (ev) => { L.DomEvent.stopPropagation(ev); setEdit(e => e && ({ ...e, vSel: e.vSel === i ? null : i })); });
    });
    // En medio de cada lado, un punto para meter una esquina nueva ahí.
    if (pts.length >= 3) pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length], medio = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      L.marker(medio, { icon: icono("mp-medio"), keyboard: false }).addTo(g).on("click", (ev) => { L.DomEvent.stopPropagation(ev); setEdit(e => e && ({ ...e, pts: [...e.pts.slice(0, i + 1), medio, ...e.pts.slice(i + 1)], vSel: i + 1 })); });
    });
  }, [edit]);   // eslint-disable-line

  /* ── las figuras de un archivo, antes de aceptarlas ── */
  useEffect(() => {
    const m = mapa.current; if (!m || !L) return; const g = capas.current.importar; g.clearLayers(); if (!imp) return;
    imp.figuras.forEach((f, i) => L.polygon([f.anillo, ...f.huecos], { color: "#4CC9F0", weight: 3, dashArray: "8 6", fillOpacity: 0.12, interactive: false }).addTo(g).bindTooltip(`${i + 1}. ${escapar(f.nombre)}`, { permanent: true, direction: "center", className: "mp-rotulo" }));
    const c = cajaDe(imp.figuras.map(f => f.anillo)); if (c) m.fitBounds([[c.sur, c.oeste], [c.norte, c.este]], { padding: [40, 40] });
  }, [imp?.archivo]);   // eslint-disable-line

  function encuadrar(ranchoId = rancho, sinAnimar = false) {
    const m = mapa.current; if (!m) return;
    const ps = parcelas.filter(p => !ranchoId || p.ranchoId === ranchoId), rs = ranchos.filter(r => !ranchoId || r.id === ranchoId);
    const anillos = [...ps.map(p => limiteDe(limites, "parcela", p.id)?.anillo), ...rs.map(r => limiteDe(limites, "rancho", r.id)?.anillo)].filter(Boolean);
    const puntos = [...ps, ...rs].filter(esPunto).map(x => [Number(x.lat), Number(x.lng)]);
    const c = cajaDe([...anillos, ...(puntos.length ? [puntos] : [])]);
    if (!c) return false;
    if (c.sur === c.norte && c.oeste === c.este) m.setView([c.sur, c.oeste], 16, { animate: !sinAnimar });
    else m.fitBounds([[c.sur, c.oeste], [c.norte, c.este]], { padding: [48, 48], maxZoom: 18, animate: !sinAnimar });
    return true;
  }
  // Con una hoja abierta, la parcela se acomoda en la parte del mapa que queda a la vista.
  const acercar = (anillo, conHoja = false) => { const c = cajaDe([anillo]), m = mapa.current; if (!c || !m) return; const ancha = window.innerWidth >= 900;
    m.fitBounds([[c.sur, c.oeste], [c.norte, c.este]], { paddingTopLeft: [40, 150], paddingBottomRight: conHoja ? (ancha ? [440, 40] : [40, Math.round(window.innerHeight * 0.56)]) : [40, 60], maxZoom: 19 }); };
  useEffect(() => { const l = sel && limiteDe(limites, "parcela", sel); if (l) acercar(l.anillo, true); }, [sel]);   // eslint-disable-line
  const verRancho = (id) => { setRancho(id); setSel(null); setSat(false); setTimeout(() => { if (!encuadrar(id)) setDice(id ? "De ese rancho todavía no hay ningún límite ni punto guardado." : "Todavía no hay ningún límite ni punto guardado."); else setDice(""); }, 30); };

  /* ── dónde estoy ── */
  const ubicarme = (comoEsquina) => {
    if (!navigator.geolocation) { setDice("Este aparato no da su ubicación."); return; }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      setBuscando(false); const { latitude: lat, longitude: lng, accuracy } = pos.coords, m = mapa.current; if (!m) return;
      capas.current.yo.clearLayers();
      L.circle([lat, lng], { radius: accuracy, color: "#4CC9F0", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(capas.current.yo);
      L.circleMarker([lat, lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#4CC9F0", fillOpacity: 1, interactive: false }).addTo(capas.current.yo);
      if (comoEsquina) {
        if (accuracy > 15) { setDice(`El teléfono dice estar aquí con ±${Math.round(accuracy)} m. Es demasiado para una esquina: espera a cielo abierto o ponla a mano sobre la imagen.`); m.setView([lat, lng], Math.max(m.getZoom(), 18)); return; }
        setEdit(e => e && ({ ...e, pts: [...e.pts, [lat, lng]], gps: (e.gps || 0) + 1, peor: Math.max(e.peor || 0, accuracy), vSel: null })); setDice(`Esquina puesta donde estás (±${Math.round(accuracy)} m).`);
      } else { m.setView([lat, lng], Math.max(m.getZoom(), 17)); setDice(`Estás aquí (±${Math.round(accuracy)} m).`); }
    }, () => { setBuscando(false); setDice("No se pudo saber dónde estás. Revisa que el aparato tenga permiso de ubicación."); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };

  /* ── trazar, corregir, guardar ── */
  const empezar = (de) => {
    const l = limiteDe(limites, de.tipo, de.id);
    setEdit({ de, pts: l ? l.anillo.map(p => [...p]) : [], gps: 0, vSel: null, corrige: !!l }); setSel(null); setSat(false); setPanel(null); setDice("");
    if (l) acercar(l.anillo);
    else { const x = (de.tipo === "parcela" ? parcelas : ranchos).find(y => y.id === de.id); if (esPunto(x)) mapa.current?.setView([Number(x.lat), Number(x.lng)], 17); }
  };
  const medida = edit && edit.pts.length >= 3 ? superficieDe({ anillo: edit.pts }) : null;
  const revision = edit && edit.pts.length >= 3 ? revisarAnillo(edit.pts) : null;
  const guardar = () => {
    const e = edit, d = datosRef.current;
    const fuente = e.gps && e.gps >= e.pts.length ? "gps" : "dibujado";
    const r = guardarLimite({ de: e.de, anillo: e.pts, fuente, precisionM: fuente === "gps" ? e.peor : null, nota: e.gps && fuente === "dibujado" ? `${e.gps} esquina(s) puestas con la ubicación del teléfono` : "", parcelas: d.parcelas || [], ranchos: d.ranchos || [], ...sello() });
    if (!r.ok) { setDice(r.dice); return; }
    add("eventos", r.evento); setEdit(null); setDice(`Límite guardado: ${ha(r.ha)}.`); if (e.de.tipo === "parcela") setSel(e.de.id);
  };
  const quitar = () => {
    const r = quitarLimite({ de: { tipo: "parcela", id: sel }, motivo: motivo || "", ...sello() });
    if (!r.ok) { setDice(r.dice); return; }
    add("eventos", r.evento); setMotivo(null); setDice("Límite quitado. El trazo anterior queda en su historial.");
  };
  const usarMedida = () => { const p = ficha.parcela, l = ficha.limite; upd("parcelas", { ...p, hectareas: Math.round(l.ha * 100) / 100, superficieDe: "medida en el mapa", superficieEl: hoy, superficieAntes: p.hectareas ?? null }); setDice(`La parcela quedó con ${ha(l.ha)}, la medida del mapa. Antes decía ${p.hectareas ?? "—"} ha.`); };

  /* ── importar un archivo ── */
  const abrirArchivo = async (ev) => {
    const f = ev.target.files?.[0]; ev.target.value = ""; if (!f) return;
    const r = leerArchivoGeografico(f.name, await f.text());
    if (!r.ok) { setDice(r.dice); return; }
    const usadas = new Set();
    setImp({ archivo: f.name, avisos: r.avisos, descartadas: r.descartadas, figuras: r.figuras.map(x => { const s = sugerirParcela(x.nombre, parcelas), id = s && !usadas.has(s) ? s : ""; if (id) usadas.add(id); return { ...x, destino: id ? `parcela:${id}` : "", sugerida: !!id }; }) });
    setSel(null); setPanel(null); setDice("");
  };
  const aceptarImportacion = () => {
    const d = datosRef.current, elegidas = imp.figuras.filter(f => f.destino), repetidas = elegidas.map(f => f.destino).filter((x, i, a) => a.indexOf(x) !== i);
    if (!elegidas.length) { setDice("Falta decir de qué parcela es al menos una figura."); return; }
    if (repetidas.length) { setDice("Dos figuras apuntan a la misma parcela. Cada parcela lleva un solo límite."); return; }
    const hechos = [];
    for (const f of elegidas) {
      const [tipo, id] = f.destino.split(":"), r = guardarLimite({ de: { tipo, id }, anillo: f.anillo, huecos: f.huecos, fuente: "archivo", archivo: imp.archivo, parcelas: d.parcelas || [], ranchos: d.ranchos || [], ...sello() });
      if (!r.ok) { setDice(`«${f.nombre}»: ${r.dice}`); return; } hechos.push(r.evento);
    }
    hechos.forEach(e => add("eventos", e));
    setImp(null); setDice(`${hechos.length} límite(s) guardados desde ${imp.archivo}.`);
  };

  const nombreDe = (de) => (de.tipo === "parcela" ? parcelas : ranchos).find(x => x.id === de.id)?.nombre || "";

  if (!L) return (<div className="mp-pagina"><div className="mp-barra"><button className="mp-boton" aria-label="Cerrar el mapa" onClick={onClose}>✕</button><b>Mapa del rancho</b></div>
    <div className="card" style={{ margin: 16 }}><div className="text-sm">El mapa necesita internet la primera vez que se abre en este aparato. Conéctate y vuelve a entrar.</div></div></div>);

  return (
    <div className="mp-pagina">
      <div ref={cajaRef} className="mp-mapa" aria-label="Mapa del rancho" />

      {/* arriba */}
      <div className="mp-arriba">
        <div className="mp-barra">
          <button className="mp-boton" aria-label="Cerrar el mapa" onClick={onClose}>✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mp-titulo">Mapa del rancho</div>
            <div className="mp-sub">{resumen.total === 0 ? "Todavía no hay parcelas dadas de alta" : `${resumen.conLimite} de ${resumen.total} parcelas con límite${resumen.conLimite ? ` · ${ha(resumen.haMedidas)} medidas` : ""}`}</div>
          </div>
          <button className="mp-boton" aria-label="Capas del mapa" onClick={() => setPanel(p => (p === "capas" ? null : "capas"))}><Ic name="map" e="🗺" /></button>
        </div>
        {!edit && !imp && ranchos.length > 0 && <div className="mp-pildoras">
          <button className={`mp-pildora${rancho === "" ? " activa" : ""}`} onClick={() => verRancho("")}>Todo</button>
          {ranchos.map(r => <button key={r.id} className={`mp-pildora${rancho === r.id ? " activa" : ""}`} onClick={() => verRancho(r.id)}>{r.nombre}</button>)}
        </div>}
        {edit && <div className="mp-aviso">
          <b>{edit.corrige ? "Corrigiendo" : "Trazando"} el límite de {nombreDe(edit.de)}</b>
          <div>{edit.pts.length < 3 ? `Toca cada esquina sobre la imagen, en el orden en que se recorre la orilla. Llevas ${edit.pts.length}.` : revision && !revision.ok ? revision.dice : `${edit.pts.length} esquinas · ${ha(medida.ha)} (${medida.m2.toLocaleString("es-MX")} m²). Arrastra una esquina para afinarla.`}</div>
        </div>}
        {sat && capaSat && !edit && <div className="mp-aviso mp-capa" role="status"><b>Encima: Sentinel-2 del {DIA(capaSat.dia)}</b> ({capaSat.vista === "color" ? "color real" : capaSat.vista === "ndvi" ? "vigor" : "humedad"}, para análisis). El fondo es otra imagen, sin fecha.</div>}
        {dice && <div className="mp-dice" role="status" onClick={() => setDice("")}>{dice}</div>}
      </div>

      {/* botones flotantes */}
      {!edit && !imp && <div className="mp-flotan">
        <button className="mp-boton" aria-label="Ver dónde estoy" disabled={buscando} onClick={() => ubicarme(false)}>◎</button>
        <button className="mp-boton" aria-label="Ver todo" onClick={() => verRancho(rancho)}>⤢</button>
      </div>}

      {/* capas */}
      {panel === "capas" && <div className="mp-hoja mp-chica">
        <div className="mp-hoja-titulo">Fondo del mapa</div>
        <div className="mp-fila">{Object.entries(CAPAS_BASE).map(([k, c]) => <button key={k} className={`mp-pildora${base === k ? " activa" : ""}`} onClick={() => setBase(k)}>{c.nombre}</button>)}</div>
        <div className="mp-nota">La imagen de satélite del fondo es un mosaico de fechas distintas (puede tener meses o años). Sirve para ubicar y trazar; no dice cómo está hoy el cultivo. Para eso está «Satélite», en la ficha de cada parcela: imágenes con fecha, para análisis.</div>
        {Object.keys(Object.fromEntries(visibles.map(p => [cultivoEn(data.siembras || [], p.id, hoy).cultivos.join(" + "), 1]))).length > 0 && <>
          <div className="mp-hoja-titulo" style={{ marginTop: 10 }}>Colores</div>
          <div className="mp-fila">{[...new Set(visibles.filter(p => limiteDe(limites, "parcela", p.id)).map(p => cultivoEn(data.siembras || [], p.id, hoy).cultivos.join(" + ")))].map(n => <span key={n || "sin"} className="mp-leyenda"><i style={{ background: colorDeCultivo(n) }} />{n || "Sin ciclo vigente"}</span>)}</div>
        </>}
        {puedeEditar && <><div className="mp-hoja-titulo" style={{ marginTop: 10 }}>Traer límites de un archivo</div>
          <div className="mp-nota">De Google Earth (KML) o de un programa de mapas (GeoJSON), en latitud y longitud. Nada se guarda hasta que digas de qué parcela es cada figura.</div>
          <input ref={archivoRef} type="file" accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json" style={{ display: "none" }} aria-label="Archivo con límites" onChange={abrirArchivo} />
          <button className="btn btn-outline" style={{ marginTop: 6 }} onClick={() => archivoRef.current?.click()}>Escoger archivo</button></>}
      </div>}

      {/* abajo: lo que falta, o la parcela tocada, o las herramientas de trazo */}
      {!edit && !imp && !ficha && panel !== "capas" && (resumen.sinLimite.length > 0 || resumen.total === 0) && <div className={`mp-hoja${panel === "faltan" ? "" : " mp-cerrada"}`}>
        <button className="mp-asa" aria-label="Parcelas sin límite" onClick={() => setPanel(p => (p === "faltan" ? null : "faltan"))}>
          {resumen.total === 0 ? "Primero da de alta tus ranchos y parcelas" : `${resumen.sinLimite.length} parcela(s) sin límite en el mapa`} <span>{panel === "faltan" ? "▾" : "▴"}</span></button>
        {panel === "faltan" && <>
          <div className="mp-nota">Una parcela sin límite no se dibuja: la app no supone su forma ni su tamaño. {puedeEditar ? "Escoge una para trazarla sobre la imagen, caminarla con el teléfono, o trae los límites de un archivo (botón de capas, arriba)." : "Los traza un administrador."}</div>
          {resumen.total === 0 && <button className="btn btn-outline" onClick={() => onNav?.("parcelas")}>Ir a Parcelas</button>}
          {resumen.sinLimite.filter(p => !rancho || p.ranchoId === rancho).map(p => <div key={p.id} className="mp-renglon">
            <span><b>{p.nombre}</b><small>{ranchos.find(r => r.id === p.ranchoId)?.nombre || "sin rancho"}{Number(p.hectareas) > 0 ? ` · ${p.hectareas} ha capturadas` : ""}{esPunto(p) ? " · tiene un punto" : ""}</small></span>
            {puedeEditar && <button className="mp-pildora activa" aria-label={`Trazar ${p.nombre}`} onClick={() => empezar({ tipo: "parcela", id: p.id })}>Trazar</button>}
          </div>)}
          {puedeEditar && rancho && <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => empezar({ tipo: "rancho", id: rancho })}>{limiteDe(limites, "rancho", rancho) ? "Corregir" : "Trazar"} el contorno del rancho</button>}
        </>}
      </div>}

      {ficha && sat && ficha.limite && !edit && !imp && <PanelSatelite L={L} mapa={mapa.current} parcela={ficha.parcela} limite={ficha.limite} desdeDelCiclo={ficha.cultivo.de === "ciclo" ? ficha.desde : null} eventos={data.eventos} hoy={hoy}
        puedeGuardar={puedeEditar} add={add} quien={quien} onCerrar={() => setSat(false)} onCapa={setCapaSat} />}
      {ficha && !sat && !edit && !imp && <div className="mp-hoja" aria-label={`Ficha de ${ficha.parcela.nombre}`}>
        <div className="mp-cabeza">
          <div style={{ minWidth: 0 }}><div className="mp-nombre">{ficha.parcela.nombre}</div><div className="mp-sub">{ficha.rancho?.nombre || "Sin rancho"}</div></div>
          <button className="mp-boton mp-plano" aria-label="Cerrar la ficha" onClick={() => { setSel(null); setSat(false); setMotivo(null); }}>✕</button>
        </div>
        <div className="mp-fila">
          <span className="mp-chip" style={{ borderColor: colorDeCultivo(ficha.cultivo.nombres.join(" + ")) }}>{ficha.cultivo.nombres.join(" + ") || "Sin cultivo"}</span>
          {ficha.ciclos[0]?.variedad && <span className="mp-chip">{ficha.ciclos[0].variedad}</span>}
          <span className="mp-chip">{ficha.limite ? ha(ficha.limite.ha) : Number(ficha.parcela.hectareas) > 0 ? `${ficha.parcela.hectareas} ha capturadas` : "Sin superficie"}</span>
        </div>
        <div className="mp-nota">{ficha.cultivo.de === "ciclo" ? `Ciclo vigente desde el ${DIA(ficha.desde)}${ficha.ciclos[0]?.fin && ficha.ciclos[0].fin < "2900" ? `, cosecha prevista ${DIA(ficha.ciclos[0].fin)}` : ""}. Lo de abajo es de este ciclo.`
          : ficha.cultivo.de === "anotado" ? "No tiene un ciclo vigente hoy: el cultivo es el anotado en la parcela. Lo de abajo es todo lo registrado."
            : "No tiene ciclo vigente ni cultivo anotado. Lo de abajo es todo lo registrado."}</div>
        {ficha.superficie.estado === "difiere" && <div className="mp-ojo">La parcela dice {ficha.superficie.capturada} ha y el límite mide {ha(ficha.superficie.medida)} ({ficha.superficie.pct > 0 ? "+" : ""}{ficha.superficie.pct} %). Los costos por hectárea usan la capturada.
          {puedeEditar && <button className="mp-pildora" style={{ marginTop: 6 }} onClick={usarMedida}>Usar la medida del mapa</button>}</div>}
        {ficha.superficie.estado === "sin_limite" && <div className="mp-ojo">Sin límite en el mapa: no hay superficie medida.{puedeEditar && <button className="mp-pildora activa" style={{ marginTop: 6 }} onClick={() => empezar({ tipo: "parcela", id: sel })}>Trazar su límite</button>}</div>}
        <div className="mp-datos">
          <Dato t="Actividades" v={ficha.actividades.n} s={ficha.actividades.ultima && `última ${DIA(ficha.actividades.ultima)}`} />
          <Dato t="Riegos" v={ficha.riegos.n} s={ficha.riegos.ultimo && `último ${DIA(ficha.riegos.ultimo)}`} />
          <Dato t="Fertilizaciones" v={ficha.fertilizaciones.n} s={ficha.fertilizaciones.ultima && `última ${DIA(ficha.fertilizaciones.ultima)}`} />
          <Dato t="Aplicaciones" v={ficha.aplicaciones.n} s={ficha.aplicaciones.ultima && `última ${DIA(ficha.aplicaciones.ultima)}`} />
          <Dato t="Cosechas" v={ficha.cosechas} />
          {veDinero && <Dato t="Costo de actividades" v={fmt(ficha.actividades.costo)} />}
          {veDinero && <Dato t="Gastos directos" v={fmt(ficha.gastos.total)} s={ficha.gastos.n ? `${ficha.gastos.n} registro(s)` : ""} />}
        </div>
        {ficha.limite && <div className="mp-nota">Límite: {FUENTES_DE_LIMITE[ficha.limite.fuente].toLowerCase()}{ficha.limite.archivo ? ` (${ficha.limite.archivo})` : ""}{ficha.limite.precisionM != null ? `, ±${ficha.limite.precisionM} m` : ""}, por {ficha.limite.quien || "alguien"} el {DIA(ficha.limite.fecha)}{ficha.limite.anteriores.length ? ` · ${ficha.limite.anteriores.length} trazo(s) anterior(es) guardados` : ""}.</div>}
        <div className="mp-fila" style={{ marginTop: 8 }}>
          {ficha.limite && <button className="mp-pildora activa" aria-label="Ver el satélite de esta parcela" onClick={() => { setSat(true); setDice(""); acercar(ficha.limite.anillo, true); }}>Satélite</button>}
          {ficha.limite && <button className="mp-pildora" onClick={() => acercar(ficha.limite.anillo, true)}>Acercar</button>}
          <button className="mp-pildora" onClick={() => onNav?.("parcelas")}>Abrir en Parcelas</button>
          {puedeEditar && ficha.limite && <button className="mp-pildora" onClick={() => empezar({ tipo: "parcela", id: sel })}>Corregir límite</button>}
          {puedeEditar && ficha.limite && motivo == null && <button className="mp-pildora" onClick={() => setMotivo("")}>Quitar límite</button>}
        </div>
        {motivo != null && <div style={{ marginTop: 8 }}><input className="inp" aria-label="Por qué se quita el límite" placeholder="¿Por qué se quita?" value={motivo} onChange={e => setMotivo(e.target.value)} />
          <div className="mp-fila" style={{ marginTop: 6 }}><button className="mp-pildora" onClick={() => setMotivo(null)}>Cancelar</button><button className="mp-pildora activa" onClick={quitar}>Quitar</button></div></div>}
      </div>}

      {edit && <div className="mp-hoja mp-herramientas">
        <div className="mp-fila">
          <button className="mp-pildora" disabled={!edit.pts.length} onClick={() => setEdit(e => ({ ...e, pts: e.pts.slice(0, -1), vSel: null }))}>Deshacer</button>
          {edit.vSel != null && <button className="mp-pildora" onClick={() => setEdit(e => ({ ...e, pts: e.pts.filter((_, i) => i !== e.vSel), vSel: null }))}>Quitar esa esquina</button>}
          <button className="mp-pildora" disabled={buscando} aria-label="Poner una esquina donde estoy" onClick={() => ubicarme(true)}>{buscando ? "Buscando…" : "Esquina donde estoy"}</button>
        </div>
        <div className="mp-fila" style={{ marginTop: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setEdit(null); setDice(""); }}>Cancelar</button>
          <button className="btn btn-accent" style={{ flex: 2 }} disabled={!revision?.ok} onClick={guardar}>{medida && revision?.ok ? `Guardar · ${ha(medida.ha)}` : "Guardar"}</button>
        </div>
      </div>}

      {imp && <div className="mp-hoja" aria-label="Figuras del archivo">
        <div className="mp-cabeza"><div><div className="mp-nombre">{imp.archivo}</div><div className="mp-sub">{imp.figuras.length} figura(s) · di de qué parcela es cada una</div></div>
          <button className="mp-boton mp-plano" aria-label="Cancelar la importación" onClick={() => setImp(null)}>✕</button></div>
        {imp.avisos.map((a, i) => <div key={i} className="mp-ojo">{a}</div>)}
        {imp.descartadas.map((d, i) => <div key={i} className="mp-ojo">No se leyó «{d.nombre}»: {d.motivo}</div>)}
        {imp.figuras.map((f, i) => <div key={i} className="mp-renglon mp-alto">
          <span><b>{i + 1}. {f.nombre}</b><small>{ha(f.ha)} medidas{f.huecos.length ? ` · con ${f.huecos.length} hueco(s)` : ""}{f.sugerida ? " · se llama igual que una parcela: confirma" : ""}</small></span>
          <select className="inp" aria-label={`Parcela de la figura ${i + 1}`} value={f.destino} onChange={e => setImp(x => ({ ...x, figuras: x.figuras.map((y, k) => (k === i ? { ...y, destino: e.target.value, sugerida: false } : y)) }))}>
            <option value="">No importar</option>
            {parcelas.map(p => <option key={p.id} value={`parcela:${p.id}`}>{p.nombre}{limiteDe(limites, "parcela", p.id) ? " (ya tiene límite: lo corrige)" : ""}</option>)}
            {ranchos.map(r => <option key={r.id} value={`rancho:${r.id}`}>Contorno del rancho {r.nombre}</option>)}
          </select>
        </div>)}
        <div className="mp-fila" style={{ marginTop: 8 }}><button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setImp(null)}>Cancelar</button>
          <button className="btn btn-accent" style={{ flex: 2 }} onClick={aceptarImportacion}>Guardar {imp.figuras.filter(f => f.destino).length} límite(s)</button></div>
      </div>}
    </div>
  );
}
function Dato({ t, v, s }) { return (<div className="mp-dato"><small>{t}</small><b>{v === 0 ? "Sin registros" : v}</b>{s ? <i>{s}</i> : null}</div>); }
const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
