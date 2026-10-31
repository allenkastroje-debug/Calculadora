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
