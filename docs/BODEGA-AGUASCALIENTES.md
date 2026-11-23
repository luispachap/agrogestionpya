# La bodega de Aguascalientes en AgroGestión (propuesta, 23 nov)

**Estado: SÓLO PROPUESTA.** No hay nada construido de esto todavía, salvo lo que ya existía (ver «Lo que ya hay»).
Se estudia con Luis y con la gente de la bodega antes de construir.

## Lo que dijo Luis

> «Tenemos una bodega en Aguascalientes en el CC agropecuario, muchas mercancías entran y salen ahí, particularmente diría
> que una buena parte de la mercancía que se vende allá es originada en nuestros campos, pero por la magnitud es imposible
> que sea al 100%; entonces hay que colaborar con la bodega de Aguascalientes para integrarla al sistema AgroGestión y que
> podamos ver el estatus en tiempo real de la bodega desde acá.»

## Lo que ya hay (y por qué no alcanza)

- **«Enviar cosecha a la bodega de Aguascalientes»** (pantalla de Cosechas, colección `envios_bodega`): saca kilos de la
  cosecha de una parcela con un costo asignado. Sirve para el costo, pero la bodega no captura nada: no se sabe qué hay
  allá, qué se vendió, ni a cuánto.
- **«A nuestra bodega»** en Salida de camión: saca el ajo del inventario de terminado como si se vendiera, sin cobro. El
  ajo sigue siendo nuestro, pero la app deja de verlo.
- **El ajo terminado** ya tiene lotes con identidad (cultivo + calibre o categoría), movimientos que se unen entre
  teléfonos y existencia que se calcula. Es la base natural para la bodega.

## La idea: un mismo inventario, dos lugares

1. **Un lugar más: «Bodega Aguascalientes».** El ajo terminado se lleva por lugar. Mandar a la bodega es un
   **traspaso** (como `alm_transferencia` del almacén): sale de aquí y entra allá con la misma traza (de qué estibas y
   parcelas viene). No es venta ni ingreso.
2. **Lo que entra de terceros va aparte.** La bodega también recibe mercancía que no es nuestra (Luis: «imposible que sea
   al 100%»). Cada entrada dice de quién es: **propia** (con su traza hasta la parcela) o **de un tercero** (proveedor,
   a consignación o comprada para reventa). Nunca se revuelven: el costo y la utilidad de lo propio salen de nuestros
   campos; lo de terceros tiene su propio costo de compra.
3. **La bodega captura en la misma app.** Un perfil de «encargado de bodega» (o el de siempre con su lugar) registra
   entradas, ventas, mermas y conteos a ciegas allá, con su teléfono. Sin señal funciona igual que en el rancho.
4. **Ver la bodega en tiempo real desde acá.** Una pantalla «Bodega Aguascalientes»: existencia por producto y calibre
   (propia y de terceros, aparte), lo que llegó hoy, lo que se vendió y a cuánto, lo que lleva días sin moverse y las
   diferencias de conteo. Es la misma información, vista desde el rancho.
5. **Las ventas de allá cierran la cuenta del ajo propio.** Una venta en la bodega de ajo propio liga su precio al lote
   (y por ahí a la parcela y a la temporada): así se sabe cuánto rindió de verdad cada parcela, también lo que se vendió
   en Aguascalientes.
6. **Los gastos de la bodega** (renta, luz, personal, fletes) son gastos generales de la bodega, como ya se hace con el
   trabajo de bodega: no suben el costo de una parcela.

## Lo que hay que preguntar antes de construir

- ¿Quién captura en la bodega y con qué aparato? ¿Hay señal allá?
- ¿Qué se vende allá además del ajo (otros productos, de quién)? ¿A consignación o comprado?
- ¿Cómo se vende: por caja, por kilo, por tarima? ¿Con remisión, con factura, de contado, a crédito?
- ¿Allá ya llevan algún control (cuaderno, Excel, sistema)? Ese papel entra por «Importar documentos» como histórico.
- ¿Qué quiere ver Luis desde acá todos los días, y qué sólo al cierre del mes?
- ¿La bodega es del mismo RFC que el rancho o de otro? (Varios RFC, una sola empresa: `socios.js`.)

## En qué orden se construiría

1. El lugar y el traspaso del ajo terminado (y que «a nuestra bodega» se vuelva traspaso).
2. Entradas de terceros, aparte de lo propio.
3. Ventas y conteos en la bodega, y la pantalla para verla desde acá.
4. La liga del precio de venta con el lote, la parcela y la temporada.

Cada paso con su recorrido `auditoria_*` y dos teléfonos (rancho y bodega), como todo lo demás.
