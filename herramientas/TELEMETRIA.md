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
