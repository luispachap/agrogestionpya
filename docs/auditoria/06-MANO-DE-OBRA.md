# 06 · Costo de mano de obra, vuelto a verificar sobre la versión correcta

Los tres hallazgos del diagnóstico se repitieron sobre `src/calculos.js` (la
versión publicada). Los tres seguían ahí.

| # | Hallazgo | Estado |
|---|---|---|
| E4 | Subirle el sueldo a alguien **reescribía el costo de todos los meses pasados** (el cálculo usaba el sueldo de hoy) | **Corregido en rama, con prueba.** Cada actividad nueva guarda la "foto" del sueldo de ese día |
| E5 | Borrar a un trabajador **borraba en silencio todo lo que había costado** | **Corregido en rama, con prueba** para lo capturado de hoy en adelante. Para lo viejo, ya no desaparece callado: el cálculo devuelve la lista de días sin costo |
| E3 | Una hora de trabajo carga el día completo | **No se tocó: es regla de pago, decide Luis y Migue** (D-4) |

## Lo que hay que decidir (D-4), con el detalle encontrado

Hoy conviven **dos reglas distintas** en la app:

- La pantalla de registro del administrador calcula `sueldo × horas ÷ 8` y lo
  deja guardado: 1 hora = un octavo del día.
- Todo lo demás reparte **el día completo** entre las parcelas donde estuvo:
  1 hora en una sola parcela = el día entero cargado a esa parcela.

Si a la persona se le paga el día completo aunque trabaje medio, la segunda es
correcta como *costo*. Si se le paga por hora, es la primera. Lo que no puede
seguir es que dependa de por cuál pantalla se capturó.

## Actualización del 19 de noviembre — no se congelan sueldos sin evidencia

Por instrucción de Luis, **no** se van a "congelar" los registros viejos con el
sueldo de hoy. En su lugar:

- Cada cambio de sueldo queda **anotado** en la ficha del trabajador: desde qué
  día, cuánto, y cuánto ganaba antes.
- El costo de un día usa, en este orden: el sueldo guardado al capturar; el que
  diga el historial para esa fecha; el que tenía antes del primer cambio anotado
  (consta que lo tenía, no desde cuándo); y sólo al final el de hoy.
- Los dos últimos casos se marcan **"estimado"** y se suman aparte del total.
- **Devengado** (cuánto se ganó cada persona cada día, por día, por hora o a
  destajo) y **distribución** (cuánto le toca a cada parcela y labor) son dos
  cuentas separadas que siempre suman lo mismo. Ocho pruebas.

Lo que falta: enseñar en pantalla la parte estimada y los días sin costo, y que
Luis y Migue digan qué modalidad lleva cada quien (D-4). Las cuentas nuevas
están listas pero **todavía no alimentan los reportes**: los totales de hoy no
cambiaron.
