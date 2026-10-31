# Banco de Reglajes

Calculadora de reglajes y piezas para Forza Horizon 6. Es una página estática: no necesita servidor ni instalar nada.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página |
| `styles.css` | Colores y estilos. Tus cambios de interfaz van al final, en el bloque «TUS CAMBIOS DE INTERFAZ» |
| `js/app.js` | La calculadora, el selector de coches y la tienda de piezas |
| `data/index.json` | Lista de los coches que se cargan |
| `data/cars/` | Un archivo `.json` por coche. `_plantilla.json` sirve de modelo |
| `data/img/` | Tarjeta de cada coche |
| `data/img/stage/<coche>/` | Fotos del coche que cambian de ángulo según la pieza (opcional) |
| `data/brands/` | Logo de cada marca |
| `manifest.webmanifest`, `sw.js`, `icons/` | Permiten instalarla en el teléfono y usarla sin conexión |
| `borradores/` | Datos guardados que no se cargan (motores cambiados del 86) |
| `.nojekyll` | Archivo vacío. Déjalo, evita que GitHub procese la carpeta |

## Subirla a GitHub Pages

1. En github.com crea un repositorio nuevo, **Public**, sin espacios en el nombre (por ejemplo `banco-de-reglajes`).
2. **Add file → Upload files**. Arrastra el *contenido* de esta carpeta (no la carpeta en sí), de modo que `index.html` quede en la raíz. Incluye `.nojekyll`; si tu sistema lo oculta, créalo después con **Add file → Create new file**.
3. **Commit changes**.
4. **Settings → Pages → Deploy from a branch**, rama `main`, carpeta `/ (root)`, **Save**.
5. En uno o dos minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
6. En el teléfono ábrela y usa «Añadir a pantalla de inicio» del navegador.

Importante: no funciona abriendo `index.html` desde los archivos del dispositivo. Los coches se leen con `fetch`, que exige abrirla desde una dirección web.

## Añadir un coche

1. Copia `data/cars/_plantilla.json` como `data/cars/marca-modelo-año.json` y rellénalo (mira `toyota-86-2013.json` como ejemplo).
2. Añade ese nombre de archivo a la lista de `data/index.json`.
3. Sube la tarjeta a `data/img/` y ponle la ruta en el campo `img` del coche.
4. Opcional: para que la pestaña Piezas muestre fotos en vez de la silueta, añade un campo `stage` al coche con una foto por ángulo (`all`, `engine`, `rear`, `fwheel`, `rwheel`, `frontend`, `wing`, `side`, `under`, `cabin`). Los ángulos que falten usan `all`.
5. Si la marca es nueva, sube su logo a `data/brands/` con el nombre de la marca en minúsculas y sin acentos (`nissan.png`).

Los nombres de archivo distinguen mayúsculas de minúsculas: `Toyota.png` no es `toyota.png`.

## Cambiar la interfaz

Edita el final de `styles.css`. Los colores principales están en las variables de `:root` (`--accent`, `--bg`, `--surface`, `--rear`…).

## Actualizar

Al subir archivos nuevos al repositorio, GitHub tarda uno o dos minutos en publicarlos. Con conexión la página siempre intenta cargar la última versión; si no la ves, recárgala una vez.


## Rangos fijos
Barras estabilizadoras (1–65), rebote (1–20) y compresión (1–20) son fijos para todos los coches y no hace falta indicarlos en el JSON.

## Telemetría
La pestaña «Telemetría» lee los datos en vivo del juego (Data Out) mediante un pequeño programa receptor que corre en tu PC. Instrucciones en `herramientas/TELEMETRIA.md`. Funciona al abrir la página desde Chrome, Edge o Firefox en la misma PC del receptor.

## Secciones
1. **Calculadora**: rellenas tú todos los datos (Reglajes) y puedes usar el Diagnóstico por síntomas.
2. **Coche**: eliges un coche de la lista, ves sus specs y piezas (Specs y piezas) y pasas a las Recomendaciones para ese coche.
3. **Telemetría**: pruebas el reglaje en pista, comparas pruebas y guardas el perfil (Perfiles).

Nota: la Calculadora y la Telemetría no llevan subpestañas; solo «Coche» tiene Specs y piezas / Recomendaciones. El diagnóstico por síntomas está al pie de la Calculadora y los perfiles al pie de la Telemetría.
