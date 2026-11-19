# Recorrido del almacén en el rancho

Para hacerlo con Migue, con artículos de verdad y dos teléfonos. Toma unos 40 minutos.
Nada de esto está validado en operación: sólo se ha probado con datos simulados. Este
recorrido es la validación.

**Antes de empezar**

- Dos aparatos con la app abierta: el de Migue (administrador) y el del encargado.
- Tres artículos dados de alta en Inventario, con su conteo inicial hecho: un insumo
  en bultos o litros (por ejemplo urea), el diésel, y una herramienta (una pala).
  A la pala hay que marcarla: Entregas del almacén → Qué hay → "Es herramienta".
- Un trabajador con su credencial y una parcela dadas de alta. El camión, en Maquinaria.
- Papel y pluma: en cada paso se anota **Sí / No** y qué se vio distinto.

Los datos que se capturen son reales. Usen cantidades que de verdad vayan a salir ese día.

---

## 1. Entrega escogiendo el artículo por su código

1. En Entregas del almacén → Qué hay → urea → "Su código". Imprimirlo (o enseñarlo en el otro teléfono).
2. En Entregas → Entregar → "Leer código" y apuntar la cámara al código.
3. Poner 10 bultos, quién los recibe (el trabajador) y para qué parcela. Entregar.

**Debe pasar:** la cámara escoge la urea sola. En "Qué hay" el almacén baja 10 y dice que el trabajador trae 10.
En Mano de obra **no** aparece ningún costo de esos bultos todavía.

- [ ] La cámara leyó el código impreso
- [ ] El almacén bajó y se ve quién lo trae
- [ ] No hay costo todavía

## 2. Uso parcial y devolución

1. En Entregas → Por cerrar → la entrega de urea → "Cerrar: se usó o regresó".
2. Se usó: 6. Regresó al almacén: 3. Guardar.

**Debe pasar:** dice que 1 bulto sigue con el trabajador. El almacén sube 3. En "Lo que se usó hoy" aparecen 6 bultos con su costo.

- [ ] Las cantidades cuadran con lo que pasó físicamente
- [ ] El costo salió una sola vez

## 3. Cambio de responsable

1. Con el bulto que quedó: "Cerrar" → "Se quedó con otra persona": 1, y escoger a otro trabajador.

**Debe pasar:** en "Qué hay" ese bulto ahora lo trae la otra persona. No hay costo nuevo.

- [ ] Cambió de manos sin contarse como gastado

## 4. Sigue en uso

1. Entregar algo que no se va a cerrar hoy. En Por cerrar → "Sigue con…" → poner la fecha de próxima revisión.

**Debe pasar:** deja de salir como pendiente hasta ese día. No registra consumo ni devolución.

- [ ] Quedó "en uso" con su fecha

## 5. Consumo en parcela, anotado por el trabajador

1. Entregarle 2 bultos al trabajador para una parcela.
2. Que el trabajador entre con su PIN en su teléfono (o en el mismo) y registre su actividad en esa parcela, anotando que usó 2 bultos.

**Debe pasar:** al entrar, el trabajador ve "Traes del almacén: 2 bultos". Después de registrar, el encargado ya **no** tiene esa entrega pendiente, y el almacén **no** bajó otros 2.

- [ ] El trabajador vio lo que traía
- [ ] No hubo que capturarlo dos veces
- [ ] El almacén no bajó de más

## 6. Diésel al camión

1. Entregas → Usar directo → diésel → los litros que se le pusieron → "Para un vehículo" → el camión.
2. En Equipos de trabajo, asignar al operador al camión ("Traslado de personal") mientras maneja; al llegar, asignarlo a lo que siga.
3. Registrar a la cuadrilla en Cuadrillas, diciendo que llegó en ese camión.

**Debe pasar:** en Mano de obra → "Lo que costaron los vehículos" aparece el camión con su operador y su diésel. En "A qué benefició cada vehículo" ese costo aparece repartido a la parcela donde trabajó la cuadrilla. El operador sigue ganando su día normal.

- [ ] El diésel quedó cargado al camión, no a una parcela
- [ ] El operador no cobró doble
- [ ] El reparto a la parcela se entiende

## 7. Herramienta

1. Entregar la pala. Al final del día: "Regresó o cambió de manos" → Regresó: 1.
2. (Sólo si de verdad pasa) si se rompe o se pierde: ahí mismo, con causa, qué pasó, valor y foto.

**Debe pasar:** mientras no regresa, se ve quién la trae. Una baja no descuenta nada: queda en "Por revisar" hasta que un administrador escriba qué se decidió.

- [ ] Se sabe quién trae cada herramienta

## 8. Sin señal, dos aparatos

1. Poner los **dos** teléfonos en modo avión.
2. En uno: entregar 5 de urea. En el otro: usar directo 3 de urea en una parcela.
3. Anotar lo que dice cada uno en "Qué hay" (van a decir cosas distintas: es normal).
4. Quitar el modo avión en uno, esperar dos minutos; luego en el otro.

**Debe pasar:** al final los dos dicen exactamente lo mismo, y es la existencia de antes menos 5 menos 3. Ningún movimiento aparece dos veces.

- [ ] Los dos aparatos quedaron iguales
- [ ] La existencia es la correcta
- [ ] Nada se duplicó

## 9. Conteo

1. Conteo y mermas → escoger la urea → contar físicamente y escribir lo contado → Comparar.

**Debe pasar:** la pantalla no enseña cuánto dice el sistema hasta después de escribir lo contado. Si no cuadra, pide la causa.

- [ ] El conteo fue a ciegas
- [ ] La existencia quedó en lo contado

---

## Al terminar

Lo que salió distinto a "debe pasar" es lo que hay que corregir antes de usarlo a diario.
Tres preguntas para Migue:

1. ¿En qué paso se tardó más de lo que tardaría en papel?
2. ¿Qué palabra de la pantalla no es como se dice en el rancho?
3. ¿Qué hace él hoy con el almacén que aquí no se pudo anotar?
