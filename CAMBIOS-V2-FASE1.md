# Banco de Reglajes 2.0 — Fase 1

## Alcance
Se conserva la estructura existente, los cuatro HUD, el selector, la calculadora y el catálogo actual. No se agregan vehículos ni se modifica la ficha del Toyota 86.

## Corrección adicional: tiempos de vuelta (Fase 1.1)

El JSON de cuatro pruebas reales recibido el 28-11-2026 contenía entre 4.106 y 4.514 muestras por prueba y duraciones de 178–203 s, pero las cuatro tenían `M.laps` vacío. El análisis identificó que el guardado dependía exclusivamente de un cambio del contador de vuelta y de que `LastLap` ya estuviera actualizado en ese mismo paquete.

- Ahora se detecta el cruce tanto por cambio del contador como por reinicio del cronómetro de vuelta (`CurrentLap`).
- Se elimina el descarte forzado de la primera vuelta completada cuando la grabación empezó después de la salida.
- Se evita duplicar el mismo cruce si el contador y el cronómetro se actualizan en paquetes consecutivos.
- Si `LastLap` aún no está disponible, se usa el tiempo de vuelta que acaba de terminar como respaldo, siempre que sea plausible.
- Las próximas exportaciones incluyen en el registro resumido el número de vuelta, el cronómetro actual y el tiempo de la última vuelta, para poder diagnosticar mejor futuros casos.
- La caché PWA sube a `v11`.

## Cambios aplicados

### Núcleo compartido de HUD (`js/hudcore.js`)
- Descarta paquetes incompletos o con campos numéricos/arrays inválidos antes de usarlos.
- Evita aprender relaciones de marcha a velocidades muy bajas o cerca del corte de rpm.
- Mantiene el aprendizaje de potencia condicionado a acelerador casi a fondo, sin frenar ni patinar.
- Suaviza la curva de potencia con un promedio triangular de bins vecinos para reducir el efecto de picos aislados.
- Reinicia la estimación de velocidad de subida de rpm al cambiar de marcha, evitando que la caída de rpm contamine la predicción.
- Añade 120 rpm de histéresis al pre-aviso amarillo para evitar parpadeos cerca del umbral.
- Conserva la prioridad del aviso rojo sobre el amarillo.

### Telemetría y análisis (`js/app.js`)
- Valida la estructura y los valores numéricos de cada muestra antes de mostrarla o grabarla.
- Descarta muestras incompletas en lugar de permitir que rompan la vista o contaminen el análisis.
- Exige al menos 300 muestras y 9 segundos de duración para generar un análisis (aproximadamente 10 s a 30 Hz).
- Añade al informe duración, frecuencia media, saltos de recepción superiores a 250 ms y muestras descartadas.
- Advierte cuando una prueba dura menos de 30 segundos o presenta demasiados saltos/muestras descartadas.
- Advierte en la comparación cuando alguna prueba tiene calidad de datos limitada.

### Documentación
- Actualiza las referencias a los cuatro HUD y los valores predeterminados de aviso.
- Incrementa la versión de caché del service worker (`v9` → `v10` en Fase 1; `v10` → `v11` en la corrección de vueltas) para que GitHub Pages/PWA no mantenga los scripts antiguos.
- Añade las condiciones de calidad de prueba y los cambios de esta fase.

## Pruebas realizadas
- `node --check js/hudcore.js` — correcto.
- `node --check js/app.js` — correcto.
- `node --test tests/*.test.js` — 8 pruebas correctas (4 de HUD y 4 de detección de vueltas):
- `node --test tests/hudcore.test.js` — 4 pruebas correctas: migración de ajustes, histéresis amarilla, prioridad roja y descarte de muestras inválidas.
- `python -m py_compile herramientas/receptor-telemetria.py herramientas/sim.py` — correcto.
- `python -m unittest discover -s tests -p 'test_*.py' -v` — prueba del paquete simulado y del parser correcta.

## Pendiente de validar con el juego real
- Los desplazamientos y unidades del paquete Data Out de FH6.
- La calidad de los campos de deslizamiento, temperatura, potencia y par.
- La precisión del punto de cambio aprendido con coches y configuraciones reales.
- Los umbrales de recomendaciones de la calculadora.

Las pruebas automatizadas usan el simulador incluido; no sustituyen una sesión real de FH6.
