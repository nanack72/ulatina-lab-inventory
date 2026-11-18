const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('../src/app');

let servidorTest = null;
let urlApiActiva = process.env.TEST_API_URL || null;

function obtenerCredencialesTest() {
  const correo = process.env.TEST_ADMIN_EMAIL;
  const contrasena = process.env.TEST_ADMIN_PASSWORD;

  if (!correo || !contrasena) {
    throw new Error(
      'Configuración incompleta: Se requieren las variables TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en el archivo backend/.env para ejecutar las pruebas automatizadas.'
    );
  }

  return { correo, contrasena };
}

async function obtenerBaseUrl() {
  if (urlApiActiva) {
    return urlApiActiva;
  }

  // 1. Verificar si ya hay un servidor ejecutándose en localhost:3000
  try {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 600);
    const respuesta = await fetch('http://localhost:3000/api/health', {
      signal: controlador.signal
    });
    clearTimeout(temporizador);

    if (respuesta.ok) {
      urlApiActiva = 'http://localhost:3000/api';
      return urlApiActiva;
    }
  } catch {
    // Si no responde en el puerto 3000, levantamos una instancia efímera de la aplicación
  }

  // 2. Levantar la aplicación en un puerto libre asignado por el sistema operativo
  if (!servidorTest) {
    await new Promise((resolve, reject) => {
      servidorTest = app.listen(0, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    const puerto = servidorTest.address().port;
    urlApiActiva = `http://localhost:${puerto}/api`;
  }

  return urlApiActiva;
}

function cerrarServidorTest() {
  if (servidorTest) {
    servidorTest.close();
    servidorTest = null;
    urlApiActiva = null;
  }
}

module.exports = {
  obtenerBaseUrl,
  cerrarServidorTest,
  obtenerCredencialesTest
};
