# Telemetría: cómo usarla

1. Instala Python 3.8 o superior (python.org) si no lo tienes.
2. Doble clic en `iniciar-receptor.bat` (Windows) o `python3 receptor-telemetria.py` (Mac/Linux). Deja la ventana abierta.
3. En Forza Horizon 6: Ajustes › HUD y jugabilidad › Data Out = Sí. IP: 127.0.0.1 si el juego y el receptor están en la misma PC (si juegas en Xbox, la IP de la PC). Puerto: 9999. No uses puertos 5200–5300.
4. Abre la página en el navegador de esa misma PC (Chrome, Edge o Firefox), pestaña **Telemetría**, y pulsa Conectar.
5. Monta tu reglaje en el juego, elige el tipo, pulsa Iniciar, da 3–5 vueltas y pulsa Detener.

Si aparece un aviso de que los datos no cuadran: ejecuta
`python receptor-telemetria.py --volcar captura.bin`, conduce 5 segundos y envíame `captura.bin`.
(El formato del paquete se dedujo de la documentación oficial; falta verificarlo con una captura real.)

`sim.py` es un simulador para probar sin el juego: `python sim.py sub` (también sob, bot, trac, lock, bal).

## Guardar y comparar pruebas
- Al pulsar **Finalizar prueba N** se analiza y se guarda sola (nombre y notas opcionales).
- En «Pruebas guardadas» ves el ranking y la marca «mejor hasta ahora».
- «Comparar pruebas»: elige A y B; la tabla marca con ✓ la mejor en cada punto y da un veredicto.
- Los datos viven en el navegador (localStorage). Usa «Descargar datos (.json)» o «Copiar datos» para guardarlos fuera y dárselos a Claude, e «Importar…» para volver a cargarlos.

## Objetivo del reglaje y valores del juego
- En la Calculadora y en las Recomendaciones hay un selector **Objetivo del reglaje** (equilibrado, respuesta al salir de curva, aceleración, estabilidad al frenar y entrar, giro ágil, velocidad punta). Cambia los valores calculados y lo que la telemetría considera un problema.
- En la prueba guiada puedes anotar los **valores del reglaje en el juego** («Cargar los recomendados» los rellena). Se guardan con la prueba y en la comparación se ve qué cambió entre A y B.
- La telemetría mide además la aceleración media al salir de curva y el 0–100 km/h (arranca desde parado, acelerador a fondo, sin levantar).

## Datos para Claude
«Descargar datos para Claude (.json)» incluye pruebas, perfiles, coche, piezas, reglajes y umbrales. Claude no guarda memoria por su cuenta entre conversaciones: pásale ese archivo cuando quieras que calibre las reglas o prepare un coche nuevo.

## HUD aparte (hud.html)
Tablero estilo SimHub que usa el mismo receptor. Se abre desde la pestaña Telemetría («Abrir el HUD en una ventana aparte») o directamente en `hud.html`.
- **Muestra:** barra de revoluciones con zona de corte, velocidad, marcha, acelerador, freno, volante, agarre de cada rueda, posición, tiempo de vuelta, última y mejor vuelta, número de vuelta, velocidad máxima, potencia y par.
- **Aviso de cambio (adaptativo):** el HUD ya no usa solo un porcentaje fijo. Mientras conduces aprende, por coche, la curva de potencia (acelerador a fondo, sin frenar y sin derrapar) y la relación de cada marcha. Con eso calcula la rpm a la que conviene cambiar: el punto donde, al subir de marcha, la potencia que tendrás ya no es menor que la que dejas. Sale en la barra como una línea blanca y en el diagnóstico. El HUD se pone rojo con antelación: calcula hacia dónde van las rpm y avisa «Adelantar el aviso» milisegundos antes (280 por defecto). Con «Auto» activado, mide cuánto tardas en cambiar tras el aviso y ajusta ese margen solo. También avisa si las rpm llegan al tope (98 %). Hasta que haya datos de al menos dos marchas usa el porcentaje fijo (92 % por defecto).
- **Para que aprenda:** haz 2 o 3 aceleraciones a fondo por las marchas, en recta. Se guarda en el navegador. «Olvidar la curva» la borra (hazlo si cambias las piezas del coche).
- **Diagnóstico:** en Ajustes › «Diagnóstico de datos» ves los valores crudos que llegan (rpm, marcha, acelerador, potencia…), el modo de aviso, las relaciones aprendidas y la curva de potencia.
- **Controles:** km/h o mph, tecla H para ocultar la barra, fondo transparente para usarlo como «Fuente de navegador» en OBS. Clic en «Vel. máx» para reiniciarla.
- No usa ni guarda posición ni mapa.

## HUD 2 (hud2.html)
Tablero circular inspirado en un cuadro de instrumentos deportivo: cuentarrevoluciones con aguja, marcha a la izquierda, velocidad a la derecha, y relojes pequeños de boost, potencia y par (las escalas se ajustan solas). Usa el mismo núcleo y el mismo aviso de cambio (marca ámbar en el tacómetro y todo en rojo). Mismos controles que el HUD 1.

## Registro para revisar cambios (--registro)
`python receptor-telemetria.py --registro carrera.csv` guarda ~30 filas por segundo (tiempo, velocidad, rpm, marcha, acelerador, freno, potencia, par, boost). Si el aviso sigue sin coincidir con lo que sientes, envíame ese CSV tras una carrera.

## HUD 3 (hud3.html) y selector (huds.html)
`huds.html` es una página para elegir entre los tres HUD con una vista previa de cada uno; se abre desde la pestaña Telemetría. El HUD 3 se basa en un cuadro de dos relojes: tacómetro a la izquierda (con mini indicador de boost y barra de par), velocímetro a la derecha (con barra de potencia), marcha y velocidad digital al centro, y arriba posición, vuelta, velocidad máxima y tiempo de vuelta, con mejor y última vuelta abajo. Se quitaron las cosas que el juego no envía o no hacen falta: combustible (ilimitado), temperatura del agua y diferencia con el rival (gap).
