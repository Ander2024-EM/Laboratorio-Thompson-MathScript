# Laboratorio Interactivo de Thompson · MathScript

Laboratorio web estático para estudiar los doce AFND-λ del capítulo 3. Conserva las transiciones y la numeración de `referencias/Modelos_Verificados_Thompson_MathScript.json`. El documento Word del capítulo y el HTML anterior se usan como fuentes académica y visual, respectivamente; `referencias/` permanece fuera del repositorio mediante `.gitignore`.

## Ejecutar

Con Python instalado, desde la raíz:

```bash
python -m http.server 8000 --directory docs/laboratorio-thompson
```

Abrir `http://localhost:8000`. También se puede servir la carpeta `docs/laboratorio-thompson/` con cualquier servidor web estático. Se requiere servidor local porque los modelos se cargan con `fetch`.

## Publicación

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) ejecuta las pruebas y publica únicamente `docs/laboratorio-thompson/` en GitHub Pages. La página principal es `index.html` dentro de esa carpeta. HTML, CSS, JavaScript y JSON usan rutas relativas; no hay servidor backend ni dependencias externas para ejecutar el laboratorio.

## Probar

```bash
node --test tests/engine.test.mjs
```

Las pruebas recorren las 76 entradas verificadas del JSON, además de cerraduras λ, clases de caracteres, prefijos, alfabeto formal, prioridad y consistencia de trazas.

## Uso y arquitectura

- `docs/laboratorio-thompson/models.json`: copia exacta de los doce modelos verificados y la conexión opcional q72.
- `engine.js`: cálculo matemático de `Mueve`, λ-cerradura, aceptación y unificación; no depende del DOM ni de expresiones regulares para reconocer lexemas.
- `app.js`: visualización SVG, controles de simulación, lecciones, preguntas y exportación de trazas.
- `style.css`: presentación adaptable de tema oscuro basada en el laboratorio anterior.

La vista principal muestra cada autómata individual. La vista q72 ilustra la unificación y aplica prioridad a palabras reservadas cuando un lexema completo también coincide con TOKEN_ID. No es un Lexer de programas completos. TOKEN_STRING sigue identificado como extensión pendiente de confirmación docente.

El progreso de la práctica se guarda solo en `localStorage`, si está disponible. El botón **Reiniciar progreso** lo borra. Ningún servicio externo es necesario.
