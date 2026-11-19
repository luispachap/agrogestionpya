# Prueba en teléfonos reales — la hacen Luis y Migue

Esto es lo único que yo no puedo hacer. Se hace en
https://agrogestion-operacion.vercel.app, que es **la base real** — no hay otra
para pruebas. Por eso todo lo que capturen para probar va **marcado "PRUEBA" en
el concepto** y al final se **cancela** (dinero) o se borra desde la app (lo
demás). Nada de eso se pierde ni estorba: queda tachado y con su motivo.
A cada paso: ✔ o ✘ y, si falla, una captura de pantalla.

## 0 · Que lo viejo no entre (lo más importante de este arranque)
Con un teléfono que **sí haya usado la app antes**:
- a. Abrir el sitio y entrar con cuenta. ¿Abre **vacía**: sin parcelas, sin gente, sin gastos?
- b. Respaldo → ¿aparece la tarjeta "Datos de antes en este teléfono"? Descargar. ¿Baja un archivo?
- c. Intentar "Restaurar" con ese archivo o con un respaldo viejo. (Debe negarse y decir por qué.)
- d. Yo reviso en la base que no haya llegado ni un registro que no sea de la prueba.

## A · Entrar
1. Luis entra con su correo y contraseña. ¿Ve todas las pantallas de administrador?
2. Migue igual, en su teléfono. ¿Ve lo mismo?
3. Escribir un PIN cualquiera en Admin. ¿Lo rechaza?

## B · Sincronizar
4. Luis captura un gasto de $123. ¿Aparece en el de Migue en menos de un minuto?
5. Migue lo corrige a $124. ¿Luis ve $124?
6. Luis pone su teléfono en modo avión, captura otro gasto, quita el modo avión. ¿Le llega a Migue, una sola vez?
7. Migue borra una tarea de prueba. ¿Desaparece en el de Luis y **no regresa** al día siguiente?
8. Luis cancela el gasto de $124 con motivo. ¿Migue lo ve tachado? ¿Hay botón de borrar? (No debe haber.)

## C · Fotos
9. Migue toma foto de un ticket en el Buzón de papeles y lo guarda. ¿Luis puede ver la foto?
10. Migue toma **la misma** foto otra vez. ¿La app avisa que ya está?
11. Modo avión, otra foto, guardar. ¿Se guarda? Al volver la señal, ¿Luis la ve?
12. Subir el XML de una factura real. ¿Trae proveedor, fecha y total exactos, sin esperar?

## D · Campo
13. Un encargado entra con su cuenta y, al salir, acepta dejar el teléfono ligado.
14. Un trabajador entra con su PIN en ese teléfono y registra su jornada.
15. ¿Luis ve esa jornada con el nombre **del trabajador**?
16. En ese mismo teléfono, ¿se puede abrir la pantalla del encargado sin su contraseña? (No debe.)
17. El encargado intenta abrir Finanzas. (No debe poder.)

## E · El medidor
18. Luis abre la app: ¿hay algún aviso amarillo o rojo de espacio? (No debe, recién montado.)

## F · Dos semanas en paralelo
Antes de dejar el Excel: Migue lleva la corrida de ajo en la app **y** en su hoja
durante dos semanas. Si los totales coinciden, la app se queda.

Lo que yo reviso por mi lado mientras tanto, directo en la base: que cada
registro traiga qué cuenta lo subió, que no haya duplicados, y que el consumo
medido coincida con lo que marca el panel de Supabase.
