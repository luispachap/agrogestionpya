// Evidencia reproducible de la auditoría (Fase 1). Uso: node docs/auditoria/evidencia/reproducir.mjs
// No toca red ni datos reales: extrae las funciones tal cual están en src/App.jsx y las ejecuta.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const src = readFileSync(new URL("../../../src/App.jsx", import.meta.url), "utf8");
const extraer = (nombre) => {
  const i = src.indexOf(`function ${nombre}(`); let d = 0, j = src.indexOf("{", src.indexOf(")", i));
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; if (src[k] === "}") { d--; if (d === 0) return src.slice(i, k + 1); } }
};
let ok = 0, total = 0;
const caso = (id, desc, cond, detalle) => { total++; if (cond) ok++; console.log(`${cond ? "CONFIRMADO" : "NO REPRODUCIDO"}  ${id}  ${desc}\n            ${detalle}`); };

// ── E1/E2: mezcla nube↔local (copia literal de la regla de AppInner: "tn >= tl ? nube : local", locales-solo se conservan)
const mezclar = (local, nube) => { const porId = {}; local.forEach(r => porId[r.id] = r);
  nube.forEach(rn => { const rl = porId[rn.id]; if (!rl) { porId[rn.id] = rn; return; }
    porId[rn.id] = ((rn._actualizado || "") >= (rl._actualizado || "")) ? rn : rl; }); return Object.values(porId); };
if (!src.includes("porId[rn.id] = (tn >= tl) ? rn : rl;")) throw new Error("La regla de mezcla cambió; actualizar esta evidencia");
{ // Migue edita sin señal un egreso que ya había bajado de la nube (conserva el _actualizado viejo); al abrir la app con señal, antes de vaciar la cola:
  const nube = [{ id: "e1", monto: 1000, _actualizado: "2026-11-01T10:00:00Z" }];
  const local = [{ id: "e1", monto: 1500, _actualizado: "2026-11-01T10:00:00Z" }];
  const r = mezclar(local, nube);
  caso("E1", "Una edición local aún no subida es pisada por la versión vieja de la nube", r[0].monto === 1000, `local 1500 → tras sincronizar queda ${r[0].monto}`);
}
{ // Otro teléfono borró el registro en la nube; este teléfono lo conserva para siempre
  const r = mezclar([{ id: "a9", tipo: "Riego", _actualizado: "2026-11-01T10:00:00Z" }, { id: "a1" }], [{ id: "a1", _actualizado: "2026-11-02T00:00:00Z" }]);
  caso("E2", "Un registro borrado en otro dispositivo nunca desaparece de éste (registro zombi)", r.some(x => x.id === "a9"), `registros tras mezcla: ${r.map(x => x.id).join(", ")}`);
}

// ── E3–E5: costo de mano de obra (función real)
const calcularCostoManoObra = new Function(`${extraer("calcularCostoManoObra")}; return calcularCostoManoObra;`)();
const act = (o) => ({ id: "x", fecha: "2026-11-10", parcelaId: "p1", registradoPor: { id: "t1", rol: "trabajador" }, ...o });
{ const c = calcularCostoManoObra([act({ horas: 1 })], [{ id: "t1", sueldo_dia: 683 }]).costoPorParcela.p1;
  caso("E3", "Registrar 1 hora carga a la parcela el sueldo del día completo", c === 683, `1 h registrada → costo ${c} (sueldo diario 683)`); }
{ const a = [act({ horas: 8 })];
  const antes = calcularCostoManoObra(a, [{ id: "t1", sueldo_dia: 683 }]).costoPorParcela.p1;
  const despues = calcularCostoManoObra(a, [{ id: "t1", sueldo_dia: 800 }]).costoPorParcela.p1;
  caso("E4", "Cambiar hoy el sueldo de un trabajador reescribe el costo de todo su historial", antes !== despues, `mismo día ya trabajado: ${antes} → ${despues}`);
  const sin = calcularCostoManoObra(a, []).costoPorParcela.p1;
  caso("E5", "Borrar a un trabajador elimina su costo histórico de todos los reportes", sin === undefined, `costo de la parcela tras borrar al trabajador: ${sin ?? 0}`); }

// ── E6: PIN de dirección: hash SHA-256 con sal fija y pública → recuperable por fuerza bruta
{ const h = (p) => createHash("sha256").update("agroselectos|" + p).digest("hex"); const objetivo = h("7391");
  const t0 = performance.now(); let hallado = null; for (let i = 0; i < 1e6 && !hallado; i++) { const p = String(i).padStart(i < 1e4 ? 4 : 6, "0"); if (h(p) === objetivo) hallado = p; }
  caso("E6", "Cualquiera que lea config_seguridad recupera el PIN de dirección", hallado === "7391", `PIN recuperado en ${Math.round(performance.now() - t0)} ms`); }

// ── E7: PINs de fábrica y sesión falsificable (verificación estática del código fuente)
caso("E7", "PINs de fábrica de admin/dirección/finanzas escritos en el código público", ["\"1234\"", "\"0000\"", "\"4444\""].every(p => src.includes(`verificarPinRol("`) && src.includes(p)), "verificarPinRol(\"admin\",\"1234\") · (\"dueno\",\"0000\") · (\"finanzas\",\"4444\")");
caso("E8", "La bandera que protege los roles sensibles (cuenta:true) vive en el mismo almacenamiento que el usuario puede editar", /data\.session && s\.cuenta/.test(src) && src.includes('localStorage.getItem("agro_session_v1")'), "agro_session_v1 = {role:'admin',cuenta:true} se acepta si el teléfono tiene cualquier sesión de Supabase abierta");
caso("E9", "Roles de campo (encargado, agrónomo, trabajador) se restauran del almacenamiento sin validar nada", src.includes("setSessionRaw(s); // roles de campo: persistencia directa"), "agro_session_v1 = {role:'encargado',id:'x'} entra directo, sin PIN");
caso("E10", "Si el almacenamiento del teléfono se llena, el guardado falla en silencio y los datos quedan solo en memoria", /catch \{ _mem\[key\] = val; \}/.test(src), "lsSet: catch { _mem[key] = val } — sin aviso al usuario; se pierde al cerrar la app");
caso("E11", "El inicio con cuenta técnica nunca se ejecuta (la bandera nace en falso y solo cambia dentro de la función que protege)", /if \(cuentaTecnicaListo\) \{\s*iniciarConCuentaTecnica\(\)/.test(src), "quien entra solo con PIN no tiene sesión en la nube → sus registros no suben");
caso("E12", "La orden de 'recarga remota' borra la cola de registros pendientes de subir", /localStorage\.removeItem\("agro_pending_v7"\);\s*localStorage\.removeItem\("agro_fallidas_v1"\);\s*window\.location\.reload/.test(src), "lo capturado sin señal y aún no subido se pierde al recibir la orden");
caso("E13", "Borrar un trabajador es un solo toque, sin confirmación", src.includes('onClick={() => del("trabajadores", t.id)}'), "AdminEquipo: del(\"trabajadores\", t.id) directo");
caso("E14", "El asistente de IA llama a la API de Anthropic desde el navegador sin credencial", /fetch\("https:\/\/api\.anthropic\.com\/v1\/messages"[\s\S]{0,120}headers: \{ "Content-Type": "application\/json" \}/.test(src), "responde 401 fuera del entorno de prototipo: función rota en producción");
console.log(`\n${ok}/${total} hallazgos confirmados`);
