// ============================================================
//  AgroGestión — El núcleo de la lectura con IA de la importación
//
//  Aquí está TODO lo que cuesta dinero: la memoria (no pagar dos veces), el
//  apartado contra el tope, la llamada a la API y la anotación del costo real.
//  Va aparte de `index.ts` (que sólo comprueba quién llama) para poder
//  comprobarlo de verdad, con la llave real, sin tener que entrar con la cuenta
//  de nadie. No sabe nada de sesiones: recibe el pedido y de qué cuenta es.
// ============================================================
const FUNCION = "interpretar-documento";
// Precios en dólares por millón de unidades de texto (= millonésimas de dólar por unidad).
// Leídos de la lista oficial de precios el 20 nov 2026. Si cambian, se cambian aquí.
const MODELOS: Record<string, { modelo: string; entrada: number; salida: number; maxSalida: number }> = {
  economico: { modelo: "claude-haiku-5-5", entrada: 0.10, salida: 0.50, maxSalida: 4000 },
  superior: { modelo: "claude-sonnet-5-5", entrada: 2, salida: 10, maxSalida: 4000 },
};
// Para apartar: lo MÁS que puede pesar la petición. Generoso a propósito: apartar de más no cuesta, quedarse corto sí.
const UNIDADES_POR_IMAGEN = 12000, UNIDADES_FIJAS = 2500, MAX_IMAGENES = 4, MAX_TEXTO = 24000, MAX_BASE64_POR_IMAGEN = 1_600_000;

const BASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLICA = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const cabServicio = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };
const rpc = async (nombre: string, cuerpo: unknown) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${nombre}`, { method: "POST", headers: cabServicio, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error(`${nombre}: ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

const INSTRUCCIONES = `Lees documentos de un rancho de ajo en Zacatecas, México: tickets, notas, facturas impresas, listas de raya y nóminas hechas a mano o en hojas desordenadas, bitácoras de diésel y de actividades. Te llegan como foto, como escaneo o como texto.

Tu trabajo es decir QUÉ ES el documento y copiar sus datos a los campos pedidos. Reglas que no se rompen:

- NO ADIVINES. Si un dato no se alcanza a leer o no viene, déjalo como texto vacío "" y escribe en "no_se_leyo" qué fue. Un número inventado que se ve razonable es peor que un hueco.
- Si dudas entre dos dígitos, el campo va vacío. No escojas "el más probable".
- Copia los importes como números con punto decimal y sin signo ni comas: 23200.00
- Las fechas van como AAAA-MM-DD. En México el día va primero: 12/08/2026 es el 12 de agosto. Si el documento no trae el año, deja la fecha vacía y dilo en "avisos".
- No calcules ni corrijas. Si el total impreso no coincide con la suma de sus renglones, copia lo impreso y dilo en "avisos".
- Un renglón de "TOTAL" o "SUMA" no es un renglón: va en "total".
- De una persona copia sólo su nombre y lo que se le pagó o su puesto. NUNCA copies CURP, número de seguridad social, RFC de personas físicas ni números de cuenta o de tarjeta.
- "confianza": alta si todo se lee claro; media si hubo algo dudoso pero lo principal está; baja si la imagen está borrosa, cortada o no estás seguro de qué es.
- Si no es un documento del rancho o no se entiende, clase "otro" o "ilegible", sin renglones.

Clases: ticket (compra de mostrador), factura (factura impresa con datos fiscales), nota (nota o remisión sin impuestos), nomina (pagos al personal: lista de raya, nómina), personal (lista de personas con puesto o sueldo, sin pagos), combustible (cargas de diésel o gasolina), actividades (trabajos en parcelas), gastos (relación de varios gastos o compras), proveedores (lista de proveedores), estado_cuenta (del banco), otro, ilegible.

En "renglones" usa sólo los campos que apliquen y deja los demás vacíos:
- ticket, factura, nota: un renglón por artículo (concepto, cantidad, unidad, importe). El proveedor, la fecha, el folio y el total van arriba.
- nomina: un renglón por persona (nombre, importe = lo que se le pagó, dias, puesto, fecha si la trae).
- personal: nombre, puesto, importe = sueldo por día si lo trae, fecha = fecha de ingreso si la trae.
- combustible: fecha, vehiculo, litros, importe.
- actividades: fecha, concepto = la actividad, parcela, nombre, importe.
- gastos: fecha, nombre = proveedor, concepto, importe.
- proveedores: nombre, concepto = giro.

Responde solamente con el JSON pedido.`;

const INSTRUCCIONES_HOJA = `Te llegan los primeros renglones de una hoja de cálculo de un rancho de ajo en México, como texto: cada renglón empieza con su número y las celdas van separadas por " | ", cada una con el número de su columna (c0, c1, c2…).

Tu trabajo NO es copiar los datos: es decir qué clase de hoja es, en qué renglón están los encabezados, y qué columna trae cada dato. Con eso la app lee toda la hoja ella sola.

- "renglon_encabezado": el número del renglón donde están los títulos de las columnas. Si la hoja no trae títulos, el número del renglón anterior al primer dato, y dilo en "avisos".
- En "columnas", para cada dato escribe el número de su columna (sólo el número: "0", "3"). Si la hoja no trae ese dato, déjalo vacío "". No supongas una columna que no está.
- Clases: nomina (pagos al personal), personal (lista de personas sin pagos), combustible, actividades, gastos (compras, gastos o pagos a proveedores), proveedores, estado_cuenta, otro.
- "confianza": alta, media o baja.

Responde solamente con el JSON pedido.`;

const S = { type: "string" };
const ESQUEMA_DOCUMENTO = {
  type: "object", additionalProperties: false,
  required: ["clase", "confianza", "emisor", "fecha", "folio", "subtotal", "total", "moneda", "renglones", "no_se_leyo", "avisos"],
  properties: {
    clase: { type: "string", enum: ["ticket", "factura", "nota", "nomina", "personal", "combustible", "actividades", "gastos", "proveedores", "estado_cuenta", "otro", "ilegible"] },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    emisor: S, fecha: S, folio: S, subtotal: S, total: S, moneda: S,
    renglones: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["fecha", "nombre", "concepto", "cantidad", "unidad", "importe", "litros", "vehiculo", "parcela", "dias", "puesto"],
      properties: { fecha: S, nombre: S, concepto: S, cantidad: S, unidad: S, importe: S, litros: S, vehiculo: S, parcela: S, dias: S, puesto: S } } },
    no_se_leyo: { type: "array", items: S }, avisos: { type: "array", items: S },
  },
};
const CAMPOS_HOJA = ["fecha", "nombre", "puesto", "sueldo", "ingreso", "dias", "importe", "proveedor", "concepto", "litros", "vehiculo", "horometro", "parcela", "actividad", "personas", "folio", "periodo"];
const ESQUEMA_HOJA = {
  type: "object", additionalProperties: false, required: ["clase", "confianza", "renglon_encabezado", "columnas", "avisos"],
  properties: {
    clase: { type: "string", enum: ["nomina", "personal", "combustible", "actividades", "gastos", "proveedores", "estado_cuenta", "otro"] },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    renglon_encabezado: S,
    columnas: { type: "object", additionalProperties: false, required: CAMPOS_HOJA, properties: Object.fromEntries(CAMPOS_HOJA.map((c) => [c, S])) },
    avisos: { type: "array", items: S },
  },
};

// Llama a la API. Si el servidor no acepta el formato estructurado, se intenta UNA vez pidiéndolo sólo con palabras
// (una petición rechazada por mal formada no se cobra).
async function preguntar(llave: string, cuerpo: Record<string, unknown>, esquema: unknown) {
  const cab = { "x-api-key": llave, "anthropic-version": "2023-06-01", "content-type": "application/json" };
  let r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: cab, body: JSON.stringify({ ...cuerpo, output_config: { format: { type: "json_schema", schema: esquema } } }) });
  let formato = "estructurado", rechazo = "";
  if (r.status === 400) {
    const t = await r.text();
    if (/output_config|json_schema|format|schema/i.test(t)) {
      const sistema = `${cuerpo.system}\n\nEl JSON debe cumplir exactamente este esquema (JSON Schema), sin texto antes ni después:\n${JSON.stringify(esquema)}`;
      formato = "con_palabras"; rechazo = t.slice(0, 300);
      r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: cab, body: JSON.stringify({ ...cuerpo, system: sistema }) });
    } else return { ok: false as const, estado: 400, dice: t.slice(0, 300) };
  }
  if (!r.ok) return { ok: false as const, estado: r.status, dice: (await r.text()).slice(0, 300) };
  return { ok: true as const, datos: await r.json(), formato, rechazo };
}
const sacarJson = (texto: string) => { const a = texto.indexOf("{"), b = texto.lastIndexOf("}"); if (a < 0 || b <= a) throw new Error("sin JSON"); return JSON.parse(texto.slice(a, b + 1)); };


export type Pedido = { huella?: string; nivel?: string; modo?: string; nombre?: string; imagenes?: { tipoMedio?: string; base64?: string }[]; texto?: string };
type Salida = { estado: number; cuerpo: Record<string, unknown> };
const responder = (cuerpo: Record<string, unknown>, estado = 200): Salida => ({ estado, cuerpo });

export async function interpretar(c: Pedido, cuenta: string | null): Promise<Salida> {
  const llave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!llave) return responder({ error: "sin_llave", dice: "La lectura con IA todavía no está configurada en el servidor. El documento queda guardado; se puede capturar a mano." }, 503);
  if (!BASE || !SERVICIO) return responder({ error: "sin_libreta", dice: "No se pudo comprobar el presupuesto de IA: no se llama a la IA sin poder llevar la cuenta." }, 503);

  const nivel = c.nivel === "superior" ? "superior" : "economico", m = MODELOS[nivel];
  const modo = c.modo === "hoja" ? "hoja" : "documento";
  const huella = String(c.huella || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(huella)) return responder({ error: "sin_huella", dice: "Falta la huella del documento." }, 400);
  const imagenes = (c.imagenes || []).filter((i) => i?.base64).slice(0, MAX_IMAGENES);
  const texto = String(c.texto || "").slice(0, MAX_TEXTO);
  if (imagenes.length === 0 && !texto.trim()) return responder({ error: "sin_contenido", dice: "No llegó nada que leer." }, 400);
  if (imagenes.some((i) => (i.base64 as string).length > MAX_BASE64_POR_IMAGEN || !/^image\/(jpeg|png|webp)$/.test(i.tipoMedio || ""))) return responder({ error: "imagen_no_valida", dice: "La imagen pesa demasiado o no es JPG, PNG ni WebP. La app debe reducirla antes de mandarla." }, 413);

  // ¿Ya se leyó este mismo documento con este nivel (o uno mejor)? Se devuelve eso: no cuesta.
  const llaveMemoria = `${huella}:${modo}`;
  try {
    const niveles = nivel === "superior" ? "eq.superior" : "in.(economico,superior)";
    const r = await fetch(`${BASE}/rest/v1/uso_ia?select=resultado,modelo,nivel,microusd&funcion=eq.${FUNCION}&huella=eq.${llaveMemoria}&estado=eq.hecha&nivel=${niveles}&resultado=not.is.null&order=cuando.desc&limit=1`, { headers: cabServicio });
    const filas = r.ok ? await r.json() : [];
    if (filas[0]?.resultado) {
      await fetch(`${BASE}/rest/v1/uso_ia`, { method: "POST", headers: { ...cabServicio, Prefer: "return=minimal" }, body: JSON.stringify({ huella: llaveMemoria, funcion: FUNCION, cuenta: cuenta ?? null, de_cache: true, modelo: filas[0].modelo, nivel: filas[0].nivel, microusd: 0, estado: "hecha" }) }).catch(() => {});
      return responder({ ok: true, deMemoria: true, modo, lectura: filas[0].resultado, uso: { modelo: filas[0].modelo, nivel: filas[0].nivel, microusd: 0, microusdOriginal: filas[0].microusd ?? null } });
    }
  } catch { /* si no se pudo consultar la memoria, se sigue: el tope protege igual */ }

  // Apartar lo máximo que puede costar. Sin reserva no hay llamada.
  const unidadesMax = UNIDADES_FIJAS + imagenes.length * UNIDADES_POR_IMAGEN + Math.ceil(texto.length / 2);
  const maxMicro = Math.ceil(unidadesMax * m.entrada + m.maxSalida * m.salida);
  let reserva: string | null = null;
  try { reserva = await rpc("reservar_ia", { p_funcion: FUNCION, p_huella: llaveMemoria, p_cuenta: cuenta ?? null, p_modelo: m.modelo, p_nivel: nivel, p_microusd_max: maxMicro }); }
  catch { return responder({ error: "sin_libreta", dice: "No se pudo comprobar el presupuesto de IA: no se llama a la IA sin poder llevar la cuenta." }, 503); }
  if (!reserva) return responder({ error: "sin_presupuesto", dice: "Se llegó al tope autorizado para leer documentos con IA. No se gasta más hasta que un superadministrador autorice subirlo. El documento queda guardado." }, 429);
  const cerrar = (entrada: number | null, salida: number | null, micro: number | null, resultado: unknown, fallo: boolean) =>
    rpc("cerrar_ia", { p_id: reserva, p_entrada: entrada, p_salida: salida, p_microusd: micro, p_resultado: resultado, p_fallo: fallo }).catch(() => {});

  try {
    const contenido: unknown[] = imagenes.map((i) => ({ type: "image", source: { type: "base64", media_type: i.tipoMedio, data: i.base64 } }));
    const nombre = String(c.nombre || "").slice(0, 120);
    contenido.push({ type: "text", text: modo === "hoja" ? `Archivo: ${nombre}\n\n${texto}` : `Archivo: ${nombre}${imagenes.length > 1 ? ` (${imagenes.length} páginas del mismo documento)` : ""}${texto ? `\n\nTexto del documento:\n${texto}` : ""}` });
    const r = await preguntar(llave, { model: m.modelo, max_tokens: m.maxSalida, system: modo === "hoja" ? INSTRUCCIONES_HOJA : INSTRUCCIONES, messages: [{ role: "user", content: contenido }] }, modo === "hoja" ? ESQUEMA_HOJA : ESQUEMA_DOCUMENTO);
    if (!r.ok) {
      await cerrar(null, null, null, null, true);
      const sinSaldo = r.estado === 400 && /credit balance/i.test(r.dice), malaLlave = r.estado === 401 || r.estado === 403;
      return responder({ error: sinSaldo ? "sin_saldo" : malaLlave ? "llave_invalida" : "fallo_la_lectura",
        dice: sinSaldo ? "La cuenta de la IA se quedó sin saldo. El documento queda guardado." : malaLlave ? "La llave de la IA que está en el servidor no es válida. Hay que volver a ponerla." : `No se pudo leer con IA (${r.estado}). El documento queda guardado y se puede reintentar.`, detalle: r.dice }, 502);
    }
    const d = r.datos, entrada = Number(d.usage?.input_tokens ?? 0) + Number(d.usage?.cache_creation_input_tokens ?? 0) + Number(d.usage?.cache_read_input_tokens ?? 0), salida = Number(d.usage?.output_tokens ?? 0);
    const micro = Math.ceil(entrada * m.entrada + salida * m.salida);
    const bloque = (d.content || []).find((b: { type: string }) => b.type === "text");
    let lectura: unknown = null;
    try { lectura = sacarJson(bloque?.text ?? ""); } catch { /* se cobra igual: la API sí contestó */ }
    if (!lectura || d.stop_reason === "refusal") {
      // La API contestó (y cobró), pero no sirvió: se anota el costo real y se dice.
      await rpc("cerrar_ia", { p_id: reserva, p_entrada: entrada, p_salida: salida, p_microusd: micro, p_resultado: null, p_fallo: false }).catch(() => {});
      return responder({ error: "respuesta_ilegible", dice: "La IA contestó algo que no se pudo usar. El documento queda guardado; se puede reintentar con el nivel superior.", uso: { modelo: m.modelo, nivel, entrada, salida, microusd: micro } }, 502);
    }
    const cortada = d.stop_reason === "max_tokens";
    await cerrar(entrada, salida, micro, lectura, false);
    return responder({ ok: true, modo, lectura, cortada, uso: { modelo: m.modelo, modeloQueContesto: d.model ?? null, formato: r.formato, ...(r.rechazo ? { rechazoDelFormato: r.rechazo } : {}), nivel, entrada, salida, microusd: micro } });
  } catch (e) {
    await cerrar(null, null, null, null, true);
    return responder({ error: "fallo_la_lectura", dice: `No se pudo leer con IA (${e instanceof Error ? e.message : String(e)}). El documento queda guardado y se puede reintentar.` }, 502);
  }
}
