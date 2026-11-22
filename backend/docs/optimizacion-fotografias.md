# Optimización de fotografías · RNF03

Se aplica antes de guardar nuevas fotos de equipos (incluidas las enviadas desde la importación de Excel) y evidencias de mantenimiento. No modifica fotografías previamente guardadas.

## Criterio de salida

- JPG y WEBP: calidad 85. PNG: compresión sin pérdida, nivel 9.
- Máximo 1920 × 1920 píxeles, ajustando dentro del límite y conservando proporción, sin recortar ni ampliar imágenes pequeñas.
- Corrección de orientación EXIF. Transparencias conservadas.
- Si la foto ya es pequeña, no requiere rotación y el resultado pesaría más, se conserva la original.
- Entrada: hasta 5 MB, formato JPG/PNG/WEBP estático y hasta 40 millones de píxeles. La lectura completa rechaza contenido corrupto aunque tenga cabecera de imagen.
- Se conserva el formato para mantener compatibles los nombres de archivo, MIME y URLs. No se crean tablas ni migraciones.
- La respuesta de subida incluye dimensiones y bytes originales/guardados dentro de `data.optimizacion`.

La reducción de tamaño depende de cada foto: no se garantiza un porcentaje fijo ni un peso máximo de salida de 500 KB. Las fotos provenientes de Excel se optimizan al enviarlas al servicio de fotos del equipo, no durante la vista previa.

## Verificación realizada

Seis pruebas automatizadas: reducción proporcional, no ampliación, transparencia y orientación, formatos/tamaños inválidos, persistencia de la foto de equipo optimizada y guardado de una evidencia optimizada conservando su asociación.

Ejemplo sintético con placa y número de serie legibles: JPG de 3000 × 2000 y 183749 bytes -> 1920 × 1280 y 52276 bytes (reducción aproximada del 71,6 %). La imagen resultante se inspeccionó visualmente. No es una prueba con fotografías institucionales ni sustituye la validación de las placas pequeñas en fotos reales.

## Instalación y comprobación

En backend, ejecutar `npm install`, reiniciar el servidor y ejecutar `node --test tests/optimizarFoto.test.js`.

Registrar un equipo con una foto grande y abrirla para comprobar placa, serie y detalles relevantes. Repetir con Excel y evidencias de mantenimiento; verificar acceso y asociación. Las fotos anteriores no se recomprimen automáticamente.

Referencia del procesamiento: https://sharp.pixelplumbing.com/api-resize/ y https://sharp.pixelplumbing.com/api-operation/.
