// Capacitación integral de AgroGestión. Capturas reales de la app, con datos de ejemplo.
const pptxgen = require("pptxgenjs");
const path = require("path");
const { applyTheme } = require("/root/.claude/skills/synced/fa22d7ae-503d-4be8-91a1-937e5d814069_4a4d82e7-0174-4190-b55e-8b8b3de2e257/pptx/scripts/apply_theme.js");

const THEME = { name: "AgroGestion", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "17210E", lt1: "FFFFFF", dk2: "0C1207", lt2: "F1F5E9", accent1: "E4B23F", accent2: "5E8F00", accent3: "2B361B", accent4: "B5701A", accent5: "3D7EA6", accent6: "A33A2B", hlink: "5E8F00", folHlink: "2B361B" } };
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "AgroGestión — Capacitación integral"; pres.author = "Agroselectos P&amp;A"; pres.company = "Agroselectos P&amp;A";
const C = pres.SchemeColor;
const IMG = (n) => path.join(__dirname, "img", `${n}.png`);
const LOGO = "/home/claude/agrogestionpya/public/logo-emblema.png";

pres.defineSlideMaster({ title: "PORTADA", background: { color: C.text2 }, objects: [
  { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 2.2, w: 6.2, h: 1.3, fontSize: 40, bold: true, color: C.background1, align: "left", valign: "top" }, text: "" } },
  { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.6, w: 6.2, h: 1.2, fontSize: 16, color: C.accent1, align: "left", valign: "top" }, text: "" } } ] });
pres.defineSlideMaster({ title: "SECCION", background: { color: C.text2 }, objects: [
  { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.9, w: 8.8, h: 1.0, fontSize: 38, bold: true, color: C.accent1, align: "left", valign: "top" }, text: "" } },
  { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.0, w: 8.2, h: 1.6, fontSize: 16, color: C.background1, align: "left", valign: "top" }, text: "" } } ] });
pres.defineSlideMaster({ title: "CONTENIDO", background: { color: C.background1 }, slideNumber: { x: 9.1, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent3 }, objects: [
  { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.35, w: 9.0, h: 0.8, fontSize: 28, bold: true, color: C.text1, align: "left", valign: "middle" }, text: "" } },
  { text: { text: "AgroGestión · Capacitación · capturas reales con datos de ejemplo", options: { x: 0.5, y: 5.2, w: 7, h: 0.3, fontSize: 10, color: C.accent3, isTextBox: true, margin: 0 } } } ] });

let seccionActual = "";
const seccion = (titulo, texto) => { seccionActual = titulo; pres.addSection({ title: titulo }); const s = pres.addSlide({ masterName: "SECCION", sectionTitle: titulo }); s.addText(titulo, { placeholder: "title" }); s.addText(texto, { placeholder: "body" }); return s; };
const hoja = (titulo) => { const s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: seccionActual }); s.addText(titulo, { placeholder: "title" }); return s; };
const puntos = (s, lista, { x = 0.5, y = 1.35, w = 5.6, h = 3.6, size = 15 } = {}) => s.addText(lista.map((t, i) => (Array.isArray(t)
  ? { text: t[0], options: { bold: true, color: C.accent2, breakLine: true, paraSpaceAfter: 2, fontSize: size } }
  : { text: t, options: { bullet: true, breakLine: i < lista.length - 1, paraSpaceAfter: 7, fontSize: size, color: C.text1 } })), { x, y, w, h, isTextBox: true, valign: "top", margin: 0, objectName: "Puntos" });
const telefono = (s, n, { x = 7.45, y = 1.3, h = 3.8 } = {}) => s.addImage({ path: IMG(n), x, y, w: h * 780 / 1560, h, objectName: `Captura ${n}`, altText: `Captura real de la app: ${n}` });
const nota = (s, texto, { x = 0.5, y = 4.45, w = 5.6 } = {}) => { s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.6, fill: { color: C.background2 }, line: { color: C.background2 }, rectRadius: 0.08, objectName: "Fondo de nota" }); s.addText(texto, { x: x + 0.15, y, w: w - 0.3, h: 0.6, fontSize: 12, italic: true, color: C.accent3, valign: "middle", isTextBox: true, margin: 0, objectName: "Nota" }); };
const conCaptura = (titulo, lista, img, pie, otra) => { const s = hoja(titulo); const w = otra ? 4.6 : 6.6; puntos(s, lista, { w, h: pie ? 2.95 : 3.7, size: otra ? 13.5 : 15 }); if (pie) nota(s, pie, { w }); if (otra) { telefono(s, otra, { x: 5.45 }); telefono(s, img, { x: 7.5 }); } else telefono(s, img); return s; };
const tarjetas = (s, items, { y = 1.4, h = 3.5, cols = items.length } = {}) => { const gap = 0.3, w = (9.0 - gap * (cols - 1)) / cols; items.forEach(([t, d], i) => { const x = 0.5 + (i % cols) * (w + gap), yy = y + Math.floor(i / cols) * (h + gap);
  s.addShape(pres.ShapeType.roundRect, { x, y: yy, w, h, fill: { color: C.background2 }, line: { color: C.background2 }, rectRadius: 0.1, objectName: `Tarjeta ${i + 1}` });
  s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: yy + 0.2, w: 0.5, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Número ${i + 1}` });
  s.addText(String(i + 1), { x: x + 0.2, y: yy + 0.2, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.text2, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: x + 0.85, y: yy + 0.15, w: w - 1.0, h: 0.6, fontSize: 15, bold: true, color: C.text1, valign: "middle", isTextBox: true, margin: 0 });
  s.addText(d, { x: x + 0.2, y: yy + 0.85, w: w - 0.4, h: h - 1.0, fontSize: 12, color: C.text1, valign: "top", isTextBox: true, margin: 0 }); }); };
const tabla = (s, filas, colW, { y = 1.35, size = 12 } = {}) => s.addTable(filas.map((f, i) => f.map(c => ({ text: c, options: i === 0 ? { bold: true, color: C.background1, fill: { color: C.accent3 }, fontSize: size } : { color: C.text1, fill: { color: i % 2 ? C.background1 : C.background2 }, fontSize: size } }))), { x: 0.5, y, w: 9.0, colW, border: { type: "solid", color: "DDE5CF", pt: 0.5 }, margin: [0.05, 0.1, 0.05, 0.1], valign: "middle", objectName: "Tabla" });

/* ── Portada ── */
pres.addSection({ title: "Presentación" }); seccionActual = "Presentación";
{ const s = pres.addSlide({ masterName: "PORTADA", sectionTitle: seccionActual });
  s.addText("AgroGestión: capacitación integral", { placeholder: "title" });
  s.addText("Agroselectos P&A · Cómo se usa, pantalla por pantalla, y quién hace qué", { placeholder: "body" });
  s.addImage({ path: LOGO, x: 7.3, y: 1.4, w: 2.2, h: 2.2, objectName: "Emblema", altText: "Emblema de Agroselectos" });
  s.addNotes("Todas las capturas de este material son de la app real, con datos de ejemplo. Ningún nombre ni cifra es del rancho."); }
{ const s = hoja("Para qué sirve, en tres ideas");
  tarjetas(s, [["Se anota una vez", "Lo que pasa en el rancho se registra una sola vez. De ahí salen solos el costo de la parcela, lo que se le debe a cada quien, la existencia del almacén y los reportes. Nadie lo vuelve a teclear."],
    ["Todos ven lo mismo", "Dueño, finanzas, encargados y agrónomo leen los mismos números. Nada de dinero se borra: se cancela con motivo y queda a la vista quién, cuándo y por qué."],
    ["La app informa, tú decides", "Avisa, propone y explica de dónde sale cada cifra. No descuenta, no paga ni decide por nadie. Y cuando no sabe algo, dice «no sé»: no inventa un cero."]]); }
{ const s = hoja("Cómo vamos a aprenderla: cinco sesiones cortas");
  tabla(s, [["Sesión", "Qué se ve", "Quiénes", "Duración"],
    ["1. Entrar y ubicarse", "Inicio de sesión, credencial, menú y accesos", "Todos", "30 min"],
    ["2. La gente y el día", "Alta de personal, checador, equipos de trabajo, cuadrillas", "Encargados y Migue", "60 min"],
    ["3. El campo y el almacén", "Parcelas, entregas del almacén, compras, importar documentos", "Encargados, almacén, Fito", "60 min"],
    ["4. El dinero", "Pagos al personal, bonos, préstamos, prestaciones", "Migue y administración", "60 min"],
    ["5. Costos y cierres", "Resultados, flujo, cierre de semana y de mes", "Migue, Luis y Rodolfo", "45 min"]], [2.2, 3.8, 2.0, 1.0]);
  nota(s, "Cada sesión termina con un ejercicio en la app, con datos de práctica. Primero se practica; después se usa en serio.", { y: 4.4, w: 9.0 }); }

/* ── Entrar ── */
seccion("1 · Entrar a la app", "Una sola entrada para todos. Nadie escoge su perfil: la app sabe quién eres por tu PIN, tu correo o tu credencial.");
conCaptura("Inicio de sesión: un solo campo", [["Tres formas de entrar"], "Tu PIN (4 a 8 números): la app sabe quién eres y qué te toca ver", "Tu correo y contraseña: para dirección y quien tiene cuenta", "Tu credencial: la enseñas a la cámara y luego escribes tu PIN", ["Lo que cambia"], "Ya no hay tarjetas de «¿quién eres?»", "La credencial sola no abre la app: siempre pide el PIN"], "01-entrada", "Si dos personas tienen el mismo PIN, no entra ninguna: hay que cambiárselo a una.");
conCaptura("Primer acceso y cuentas", [["Dirección y administración"], "Un administrador te invita con tu correo, en Arranque → Cuentas", "Tú creas tu cuenta («Es mi primera vez») y confirmas el correo", ["Personal de campo"], "Entra con el PIN que le pone su encargado", "Quien no tiene PIN entra como externo, con su nombre, y sólo ve lo suyo"], "70-arranque", "Los permisos de pagos y cierres se dan por cuenta y los revisa la base.", "01b-entrada-externo");

/* ── La gente ── */
seccion("2 · La gente y el día", "Alta de personal, credenciales, asistencia, equipos de trabajo y cuadrillas. Lo que aquí se registra es de donde sale la mano de obra.");
conCaptura("Alta de trabajadores", [["En Equipo"], "Nombre, sueldo por día y PIN personal", "Fecha de ingreso: de ahí se calculan aguinaldo y vacaciones", "Cómo se le paga (por día o destajo) va aparte de su relación de trabajo", ["Cuidado con"], "No repetir un PIN", "Sin fecha de ingreso, las prestaciones salen «no se puede calcular», no en cero"], "35-equipo");
conCaptura("Credenciales con código QR", [["En Credenciales"], "Se emite una por persona y se imprimen", "El código no trae nombre, PIN ni sueldo", "Si se pierde, se emite otra y la anterior deja de servir", ["Para qué sirve"], "Checar entrada y salida en segundos", "Entrar a la app junto con el PIN"], "15-credenciales");
conCaptura("Asistencia: el checador", [["En la nave"], "Se acerca la credencial o se teclea el PIN", "La primera marca del día es entrada; la siguiente, salida", ["Checar no es abrir sesión"], "En la tableta del encargado se checa sin abrir la app de nadie", "Entrada sin salida no vale 8 horas: vale «no se sabe»"], "11-checador", "Entrar al rancho no es trabajar en una parcela.", "14-el-dia");
conCaptura("Equipos de trabajo: a qué se asignó cada quien", [["Cada mañana"], "Los que ya checaron salen como «sin asignar»", "Se marcan y se les dice parcela y actividad", "Cambiar de parcela es otra asignación, no una corrección", ["Lo que hace la app"], "Cruza las marcas con la asignación y saca el costo por parcela", "El tiempo sin asignar queda «por aclarar»: no se le carga a nadie solo"], "12-equipos-de-trabajo", "No se teclea además una actividad por esa misma gente: se contaría dos veces.");
conCaptura("Cuadrillas eventuales", [["Los grupos que llegan juntos"], "Quiénes vinieron, a qué parcela y a qué actividad", "Cómo cobran: por día, por destajo (lo de cada quien) o precio por el trabajo", "Cómo llegaron: flete externo, vehículo propio o sin transporte", ["Reglas"], "El vehículo propio no lleva importe aquí: su costo ya está en los gastos del vehículo", "Pagarle al responsable no marca pagado a cada integrante"], "13-cuadrillas");

/* ── Campo y almacén ── */
seccion("3 · El campo y el almacén", "Parcelas, lo que sale del almacén, las compras, los papeles y la maquinaria.");
conCaptura("Parcelas", [["En Ranchos y parcelas"], "Cada parcela con su rancho, cultivo y hectáreas", "Ahí se ve su costo: lo directo y, aparte, lo completo", "Todo lo que se asigna, se entrega o se gasta pide una parcela", ["Para arrancar"], "Empezar con pocas parcelas bien dadas de alta vale más que todas a medias"], "32-parcelas");
conCaptura("Almacén: entregar no es gastar", [["En Entregas del almacén"], "Lo que sale queda a cargo de quien se lo lleva", "Después se cierra: se usó, regresó, lo trae otra persona o se dio de baja", "El costo nace cuando se usa, una sola vez", ["Reglas"], "La existencia se calcula de los movimientos: nadie la escribe a mano", "El conteo es a ciegas: primero cuentas, luego ves lo que decía la app"], "16-entregas-almacen", null, "33-inventario");
conCaptura("Compras del personal: aprobar, recibir y valuar", [["Tres manos, tres pasos"], "El trabajador registra la compra y entrega el ticket", "Se aprueba el gasto: eso no mete nada al almacén", "Alguien confirma que llegó y cuánto", ["Si no se sabe el precio"], "Queda «pendiente de valoración»: no vale cero", "La app avisa cuántos días lleva así"], "40-finanzas-compras", "Un gasto de «insumos» no se supone del almacén: hay que decir qué fue.", "22-trabajador-compra");
conCaptura("Importar documentos por montones", [["Lo que lee solo y sin costo"], "Facturas en XML, hojas de Excel y CSV, tablas de PDF y de Word", ["Lo que hace con ellos"], "Dice qué es cada papel y propone qué hacer; tú confirmas", "Lo anterior al arranque va al histórico: no crea nada de hoy", "No duplica archivos ni facturas"], "61-importar", "Fotos y escaneos se guardan, pero todavía no se leen solos.", "62-importar-como");
{ const s = hoja("Vehículos y maquinaria: lo aplicado contra lo real");
  puntos(s, [["Dos cifras que nunca se suman"], "Cuota por hora: lo que ya cargan las actividades a la parcela (provisional)", "Costo real: operador, combustible, mantenimiento y depreciación", ["Lo que se hace con la diferencia"], "Se reparte entre las parcelas que usaron la máquina, en proporción a la cuota", "Si falta el combustible, la depreciación o un precio, no se baja ningún costo: se conserva la cuota y se dice qué falta", "El uso general del rancho no se le carga a ninguna parcela"], { w: 5.2 });
  // Diagrama: cuota + diferencia = real
  const bx = 6.1, by = 1.5;
  [["Cuota aplicada", "$4,000", C.accent2, 0], ["Diferencia", "+$3,000", C.accent1, 1.15], ["Costo real", "$7,000", C.accent3, 2.3]].forEach(([t, v, col, dy], i) => {
    s.addShape(pres.ShapeType.roundRect, { x: bx, y: by + dy, w: 3.4, h: 0.95, fill: { color: col }, line: { color: col }, rectRadius: 0.1, objectName: `Bloque ${t}` });
    s.addText(t, { x: bx + 0.2, y: by + dy, w: 1.9, h: 0.95, fontSize: 14, bold: true, color: i === 1 ? C.text2 : C.background1, valign: "middle", isTextBox: true, margin: 0 });
    s.addText(v, { x: bx + 1.9, y: by + dy, w: 1.3, h: 0.95, fontSize: 20, bold: true, color: i === 1 ? C.text2 : C.background1, align: "right", valign: "middle", isTextBox: true, margin: 0 }); });
  s.addText("Ejemplo de un mes: la máquina cuesta una sola vez.", { x: bx, y: by + 3.35, w: 3.4, h: 0.3, fontSize: 11, italic: true, color: C.accent3, isTextBox: true, margin: 0 }); }

/* ── El dinero ── */
seccion("4 · El dinero del personal", "Pagos, bonos, préstamos y prestaciones. Lo que corresponde se calcula; lo entregado se registra; lo pendiente es la resta.");
conCaptura("Pagos al personal", [["Cada semana"], "La app calcula lo que le corresponde a cada quien con lo ya registrado", "Se registra lo que se le entregó; lo pendiente es la resta", "Se cierra el cálculo de la semana y, aparte, se confirman los pagos", ["Reglas"], "Pagar no genera costo: el costo nació con el trabajo", "Salir antes no descuenta nada solo: una persona decide", "El recibo interno no sustituye un recibo de nómina timbrado"], "50-pagos");
conCaptura("Bonos, préstamos y prestaciones", [["Bonos"], "Importe, motivo, a quién, periodo y quién autoriza", "Si cuenta para el salario integrado: sí, no o «por revisar»", ["Préstamos"], "Se solicita, se autoriza, se entrega y se abona: la deuda nace con la entrega", ["Prestaciones"], "Se van generando solas desde la fecha de ingreso; la app propone y una persona confirma"], "53-pagos-prestaciones", null, "51-pagos-bonos");

/* ── Costos y cierres ── */
seccion("5 · Costos, flujo y cierres", "Tres cifras distintas que no se mezclan: el resultado, el inventario y el dinero que se movió.");
conCaptura("Costos: directo, indirecto y gastos generales", [["En Finanzas → Resultados"], "Directo: mano de obra, insumos usados y maquinaria de cada parcela", "Indirecto: vehículos, prestaciones, bonos y personal sin parcela", "Gastos generales: van aparte y nunca suben el costo de una parcela", ["Para leerlo bien"], "Los insumos cuentan cuando se usan, no cuando se compran", "Lo «por valuar» y lo «por clasificar» van aparte, a la vista"], "41-finanzas-resultados");
conCaptura("Flujo de efectivo", [["El dinero, el día que se mueve"], "Una compra sale completa el día que se pagó", "Al personal, el día que se le paga", "Un préstamo entregado sale del flujo y no es gasto", ["Por eso"], "La utilidad y el flujo casi nunca dan lo mismo, y está bien", "El inicio y Finanzas leen la misma cuenta: no hay dos utilidades"], "42-finanzas-flujo");
conCaptura("Cierres de semana y de mes", [["Cerrar es tomar una foto"], "Semana: el cálculo de lo que corresponde a cada quien", "Mes: costo por parcela, indirectos y gastos generales", "Lo que cambie después sale como diferencia: la foto no se toca", ["Quién cierra"], "Sólo quien tiene ese permiso en su cuenta", "Reabrir pide motivo y deja la versión anterior guardada"], "60-cierre-de-mes", "Antes de cerrar el mes: revisar lo pendiente de recibir, de valuar y de clasificar.");

/* ── Día a día ── */
seccion("6 · El día a día", "Sin señal, errores frecuentes y cómo se ve una jornada normal.");
{ const s = hoja("Sin conexión: se sigue trabajando");
  tarjetas(s, [["Se guarda en el aparato", "Checar, asignar, entregar del almacén y capturar funcionan sin señal. Queda guardado en el teléfono o la tableta."],
    ["Sube sola al volver la señal", "No hay que hacer nada. Dos aparatos sin señal no se pisan: cada movimiento es un renglón aparte."],
    ["Lo delicado espera validación", "Un pago o un cierre capturado sin señal queda «por validar» y no cuenta hasta que la base lo autoriza con tu cuenta."],
    ["La app lo dice", "Arriba se ve cuánto falta por subir. Si un dato no se pudo leer, lo avisa: un dato que falta no es un cero."]], { cols: 2, h: 1.6 }); }
{ const s = hoja("Errores frecuentes y cómo evitarlos");
  tabla(s, [["Lo que pasa", "Por qué está mal", "Qué hacer"],
    ["Capturar una actividad de quien ya checó y fue asignado", "Su mano de obra se cuenta dos veces", "Sólo asignarlo en Equipos de trabajo"],
    ["Capturar como gasto el pago a un trabajador", "El costo ya existe por su trabajo", "Registrarlo en Pagos al personal"],
    ["Dejar a la gente «sin asignar»", "Ese tiempo no llega a ninguna parcela", "Asignar o aclarar el mismo día"],
    ["Recibir una compra con precio en cero", "El costo sale falso en todo el año", "Dejar el precio vacío: queda por valuar"],
    ["Ponerle importe al viaje del vehículo propio", "Su costo ya está en los gastos del vehículo", "Registrar el viaje sin importe"],
    ["Compartir un PIN o una contraseña", "Ya no se sabe quién hizo qué", "Un PIN por persona; pedir uno nuevo"]], [3.2, 2.9, 2.9], { size: 11 }); }
{ const s = hoja("Una jornada normal");
  const pasos = [["7:00", "Llegada", "Cada quien checa con su credencial en la nave"], ["7:15", "Reparto", "El encargado asigna parcela y actividad; registra las cuadrillas"], ["Durante el día", "Almacén y cambios", "Entregas del almacén; cambios de parcela; compras con su ticket"], ["Salida", "Checar", "Checar salida termina la asignación del día"], ["Tarde", "Revisión", "Aclarar tiempo sin asignar, cerrar entregas, recibir compras"], ["Sábado", "Pagos", "Cerrar la semana, pagar y confirmar los pagos"]];
  pasos.forEach(([h, t, d], i) => { const x = 0.5 + i * 1.52;
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.45, y: 1.55, w: 0.55, h: 0.55, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Paso ${i + 1}` });
    s.addText(String(i + 1), { x: x + 0.45, y: 1.55, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: C.text2, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(h, { x, y: 2.25, w: 1.42, h: 0.3, fontSize: 11, color: C.accent2, bold: true, align: "center", isTextBox: true, margin: 0 });
    s.addText(t, { x, y: 2.55, w: 1.42, h: 0.35, fontSize: 14, bold: true, color: C.text1, align: "center", isTextBox: true, margin: 0 });
    s.addText(d, { x, y: 2.95, w: 1.42, h: 1.5, fontSize: 11, color: C.text1, align: "center", valign: "top", isTextBox: true, margin: 0 }); });
  nota(s, "Si algo no se pudo registrar en su momento, se registra después con su hora real y su motivo: queda dicho quién y cuándo.", { y: 4.45, w: 9.0 }); }

/* ── Por rol ── */
seccion("7 · Lo de cada quien", "Qué usa cada persona, y con qué empieza.");
conCaptura("Migue: finanzas y bodega", [["Todos los días"], "Revisar avisos; aprobar compras y confirmar lo recibido", ["Cada semana"], "Pagos al personal, bonos y préstamos", ["Cada mes"], "Clasificar insumos, valuar lo pendiente y cerrar el mes"], "30-admin-inicio", "Su menú se acomoda a lo que más usa; eso no cambia los permisos.", "31-menu");
conCaptura("Encargados", [["Su barra de abajo"], "Checador, Equipos de trabajo y Tareas", ["Lo que les toca"], "Que todos chequen entrada y salida", "Asignar a cada quien a su parcela y actividad", "Registrar las cuadrillas del día y cómo llegaron", "Entregar del almacén y cerrar cada entrega", ["No les toca"], "Pagos, cierres ni reglas: eso lo autoriza otra cuenta"], "10-encargado-inicio");
conCaptura("Administrativos y agrónomo", [["Administración"], "Importar facturas y hojas; clasificar lo que quede por revisar", "Papeles y Banco: que ningún movimiento se quede sin nombre", "Reportes y cierre de mes, con permiso", ["Agrónomo"], "Catálogo de agroquímicos y bitácora de aplicaciones", "Reentrada y carencia: un producto sin etiqueta capturada nunca dice «ya se puede entrar»"], "61-importar");
conCaptura("Trabajadores", [["Con su PIN o su credencial"], "Registrar lo que hicieron y en qué parcela", "Reportar un problema con foto", "Registrar una compra y entregar el ticket", ["Lo que ven"], "Sólo lo suyo: sus días y sus registros", "No ven sueldos de otros, costos ni finanzas"], "20-trabajador-inicio", "Checar se hace en la nave; no hace falta abrir la app.", "21-trabajador-reporte");
{ const s = hoja("Ejercicios prácticos, con datos de práctica");
  tabla(s, [["Ejercicio", "Quién", "Se logró si…"],
    ["Dar de alta a dos personas, emitir sus credenciales y checar su entrada", "Encargado", "Salen «adentro» en El día y «sin asignar» en Equipos"],
    ["Asignarlas a una parcela, cambiar a una de parcela y checar su salida", "Encargado", "Mano de obra muestra el tiempo y el costo en cada parcela"],
    ["Entregar 2 bultos del almacén y cerrar la entrega: 1 usado, 1 devuelto", "Almacén", "La existencia baja 1 y el costo sale en la parcela"],
    ["Registrar una compra con ticket, aprobarla y recibirla sin precio", "Trabajador y Migue", "Queda «pendiente de valoración», no en cero"],
    ["Importar una factura XML y una hoja de gastos", "Administración", "Se propone el gasto y no se duplica al subirla otra vez"],
    ["Cerrar la semana, registrar un pago y emitir el recibo", "Migue", "Lo pendiente es lo que corresponde menos lo entregado"]], [4.6, 1.7, 2.7], { size: 11 }); }

/* ── Piloto ── */
seccion("8 · El piloto", "Arrancar con poco, comparar contra los controles de hoy, y crecer cuando cuadre.");
{ const s = hoja("Piloto: arrancar con poco");
  tarjetas(s, [["Con qué", "Unos pocos trabajadores de planta, dos o tres parcelas, diez artículos del almacén y una máquina."],
    ["Antes de empezar", "Cuentas y permisos, conteo físico del almacén, saldos iniciales con evidencia y la fecha oficial de inicio."],
    ["Durante dos semanas", "Llevar la app y los controles de hoy al mismo tiempo, y comparar: asistencia, pagos, existencias y costo por parcela."],
    ["Para crecer", "Si las diferencias tienen explicación, se agregan más personas, parcelas y artículos. Si no, se corrige antes de crecer."]], { cols: 2, h: 1.6 }); }
{ const s = hoja("Lo que falta probar en el rancho");
  puntos(s, [["Probado sólo con datos de práctica"], "Todo lo de este material funciona en pruebas automáticas; falta usarlo en un día real", "La cámara del checador en la tableta de la nave, con la luz y el polvo de ahí", "Cargas grandes de documentos reales del rancho", ["Todavía no está activado"], "La lectura de fotos y escaneos con IA (es un gasto por autorizar)", ["Decisiones que siguen siendo de ustedes"], "Qué se hace con cada diferencia, cada falta y cada baja: la app propone y espera"], { w: 9.0, h: 3.7 }); }
{ const s = pres.addSlide({ masterName: "PORTADA", sectionTitle: seccionActual });
  s.addText("Primero se practica, después se usa en serio", { placeholder: "title" });
  s.addText("app.agroselectos.com · Dudas y fallas: se anotan en el momento, con captura de pantalla", { placeholder: "body" });
  s.addImage({ path: LOGO, x: 7.3, y: 1.4, w: 2.2, h: 2.2, objectName: "Emblema", altText: "Emblema de Agroselectos" }); }

(async () => { const f = path.join(__dirname, "AgroGestion-Capacitacion.pptx"); await pres.writeFile({ fileName: f }); await applyTheme(f, THEME); console.log("listo", f); })();
