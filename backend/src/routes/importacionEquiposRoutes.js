const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');

const pool = require('../config/database');
const { verificarToken } = require('../middlewares/authMiddleware');

const {
  puedeRegistrarInventario,
} = require('../utils/permisosInventario');

const router = express.Router();

const MAX_FILAS = 200;
const MAX_ARCHIVO = 5 * 1024 * 1024;

const CAMPOS = [
  'nombre',
  'numero_serie',
  'placa_institucional',
  'marca',
  'modelo',
  'anio',
  'caracteristicas',
  'comentarios',
  'ubicacion_detalle',
  'id_categoria',
  'id_estado',
  'id_laboratorio',
];

const LIMITES = {
  nombre: 150,
  numero_serie: 100,
  placa_institucional: 100,
  marca: 100,
  modelo: 100,
  ubicacion_detalle: 255,
};

// Límites de esta operación para evitar cargas excesivas.
// No son límites adicionales de las columnas de PostgreSQL.
const MAX_TEXTO_LARGO = 10000;

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function esId(valor) {
  return (
    Number.isSafeInteger(valor) &&
    valor > 0 &&
    valor <= 2147483647
  );
}

function esSuperadministrador(usuario) {
  return normalizar(usuario?.rol) === 'superadministrador';
}

function errorSolicitud(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function responderError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error('Error de importación de equipos:', error);

  return res.status(500).json({
    success: false,
    message: 'No fue posible completar la importación.',
  });
}

// Todas las rutas requieren sesión y permiso de registro.
router.use(verificarToken);

router.use((req, res, next) => {
  if (!puedeRegistrarInventario(req.usuario)) {
    return res.status(403).json({
      success: false,
      message: 'No tiene permisos para importar equipos.',
    });
  }

  return next();
});

const subirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ARCHIVO,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter(req, file, callback) {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      return callback(
        errorSolicitud('Seleccione un archivo Excel con extensión .xlsx.')
      );
    }

    return callback(null, true);
  },
}).single('archivo');

function recibirArchivo(req, res, next) {
  subirArchivo(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'El archivo no puede superar 5 MB.',
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.status
            ? error.message
            : 'Debe enviar un único archivo Excel en el campo archivo.',
      });
    }

    return next();
  });
}

// Los encabezados pueden ser los de nuestra plantilla institucional
// o nombres equivalentes a los campos del sistema.
const ALIAS = {
  nombre: ['nombre', 'nombre del equipo'],
  numero_serie: ['numero de serie', 'numero_serie', 'serie'],
  placa_institucional: [
    'placa',
    'placa institucional',
    'placa_institucional',
    'codigo de activo placa',
  ],
  marca: ['marca'],
  modelo: ['modelo'],
  anio: ['anio', 'año', 'año del equipo'],
  caracteristicas: ['caracteristicas', 'características'],
  comentarios: ['comentarios', 'observaciones'],
  ubicacion_detalle: [
    'ubicacion detallada',
    'ubicacion_detalle',
    'detalle de ubicacion',
  ],
  categoria: ['categoria', 'categoría', 'tipo de equipo'],
  estado: ['estado', 'estado del equipo'],
  sede: ['sede', 'ubicacion sede'],
  laboratorio: [
    'laboratorio',
    'codigo de laboratorio',
    'ubicacion codigo de lab',
  ],
  id_categoria: ['id_categoria'],
  id_estado: ['id_estado'],
  id_laboratorio: ['id_laboratorio'],
  anio_modelo: ['año del equipo y modelo'],
};

const DATOS_ADICIONALES = [
  ['Cursos', 'cursos que lo utilizan'],
  ['Carreras', 'carrera que lo utilizan'],
  ['Software instalado', 'sofwares intalados'],
  ['Membresías instaladas', 'membresias instaladas'],
  ['Licencias instaladas', 'licencias instaladas'],
  ['Renovaciones', 'renovacion de los sofwares o licencias fechas'],
];

function textoCelda(celda) {
  const valor = celda.value;

  if (valor == null) return '';

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === 'object') {
    if ('formula' in valor || 'sharedFormula' in valor) {
      throw errorSolicitud(
        `La celda ${celda.address} contiene una fórmula. Reemplácela por su valor antes de importar.`
      );
    }

    if ('error' in valor) {
      throw errorSolicitud(
        `La celda ${celda.address} contiene un error de Excel.`
      );
    }

    if (Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text).join('').trim();
    }

    if ('hyperlink' in valor) {
      return String(valor.text ?? '').trim();
    }
  }

  return String(celda.text ?? valor).trim();
}

function buscarEncabezados(hoja) {
  for (
    let numero = 1;
    numero <= Math.min(hoja.rowCount, 20);
    numero += 1
  ) {
    const fila = hoja.getRow(numero);
    const columnas = new Map();

    fila.eachCell((celda, columna) => {
      const nombre = normalizar(celda.text);

      if (nombre) {
        columnas.set(nombre, columna);
      }
    });

    const tieneNombre = ALIAS.nombre.some((alias) =>
      columnas.has(normalizar(alias))
    );

    if (tieneNombre) {
      return {
        fila: numero,
        columnas,
      };
    }
  }

  throw errorSolicitud(
    'No se encontró el encabezado Nombre del equipo en las primeras 20 filas.'
  );
}

function columnaDe(columnas, campo) {
  for (const alias of ALIAS[campo] || []) {
    const columna = columnas.get(normalizar(alias));

    if (columna) return columna;
  }

  return null;
}

function leerCampo(fila, columnas, campo) {
  const columna = columnaDe(columnas, campo);

  return columna
    ? textoCelda(fila.getCell(columna))
    : '';
}

function idDesdeTexto(valor) {
  if (!/^[1-9]\d*$/.test(String(valor))) return null;

  const id = Number(valor);
  return esId(id) ? id : null;
}

// Consulta fresca de catálogos y laboratorios autorizados.
async function cargarCatalogos(cliente, usuario) {
  const categorias = await cliente.query(`
    SELECT id_categoria, nombre
    FROM public.categoria
    ORDER BY nombre
  `);

  const estados = await cliente.query(`
    SELECT id_estado, nombre
    FROM public.estado
    ORDER BY nombre
  `);

  const laboratorios = await cliente.query(
    `
      SELECT
        l.id_laboratorio,
        l.id_sede,
        l.codigo,
        l.nombre,
        s.nombre AS nombre_sede
      FROM public.laboratorio l
      INNER JOIN public.sede s
        ON s.id_sede = l.id_sede
      WHERE $2::boolean OR EXISTS (
        SELECT 1
        FROM public.usuario_sede us
        INNER JOIN public.usuario_laboratorio ul
          ON ul.id_usuario_sede = us.id_usuario_sede
        WHERE us.id_usuario = $1
          AND us.id_sede = l.id_sede
          AND ul.id_sede = l.id_sede
          AND ul.id_laboratorio = l.id_laboratorio
      )
      ORDER BY s.nombre, l.nombre
    `,
    [
      usuario.idUsuario,
      esSuperadministrador(usuario),
    ]
  );

  return {
    categorias: categorias.rows,
    estados: estados.rows,
    laboratorios: laboratorios.rows,
  };
}

function buscarId(lista, campoId, nombre) {
  if (!nombre) return null;

  const coincidencias = lista.filter(
    (elemento) => normalizar(elemento.nombre) === normalizar(nombre)
  );

  return coincidencias.length === 1
    ? coincidencias[0][campoId]
    : null;
}

function buscarLaboratorio(catalogos, laboratorio, sede) {
  if (!laboratorio) return null;

  const coincidencias = catalogos.laboratorios.filter((elemento) => {
    const coincideLaboratorio =
      normalizar(elemento.codigo) === normalizar(laboratorio) ||
      normalizar(elemento.nombre) === normalizar(laboratorio);

    const coincideSede =
      !sede ||
      normalizar(elemento.nombre_sede) === normalizar(sede);

    return coincideLaboratorio && coincideSede;
  });

  return coincidencias.length === 1
    ? coincidencias[0].id_laboratorio
    : null;
}

// Validaciones que se repiten después de editar la revisión.
function validarFila(entrada, catalogos) {
  const errores = [];
  const datos = {};

  if (
    !entrada ||
    typeof entrada !== 'object' ||
    Array.isArray(entrada)
  ) {
    return {
      datos,
      errores: ['La fila no contiene un objeto válido.'],
    };
  }

  for (const campo of CAMPOS) {
    if (campo.startsWith('id_')) {
      const valor = entrada[campo];

      if (!esId(valor)) {
        errores.push(`Seleccione un valor válido para ${campo}.`);
      }

      datos[campo] = valor;
      continue;
    }

    if (campo === 'anio') {
      const valor = entrada.anio;

      if (valor === '' || valor == null) {
        datos.anio = null;
      } else {
        const anio = typeof valor === 'number'
          ? valor
          : /^\d{4}$/.test(String(valor))
            ? Number(valor)
            : NaN;

        if (
          !Number.isInteger(anio) ||
          anio < 1900 ||
          anio > 2100
        ) {
          errores.push('El año debe estar entre 1900 y 2100.');
        }

        datos.anio = anio;
      }

      continue;
    }

    const valor = entrada[campo];

    if (valor != null && typeof valor !== 'string') {
      errores.push(`El campo ${campo} debe ser texto.`);
      datos[campo] = null;
      continue;
    }

    const texto = String(valor ?? '').trim();

    datos[campo] = texto || null;

    if (campo === 'nombre' && !texto) {
      errores.push('El nombre del equipo es obligatorio.');
    }

    const limite = LIMITES[campo] || MAX_TEXTO_LARGO;

    if (Array.from(texto).length > limite) {
      errores.push(
        `El campo ${campo} supera el límite de ${limite} caracteres.`
      );
    }
  }

  if (
    esId(datos.id_categoria) &&
    !catalogos.categorias.some(
      (categoria) => categoria.id_categoria === datos.id_categoria
    )
  ) {
    errores.push('La categoría seleccionada no existe.');
  }

  if (
    esId(datos.id_estado) &&
    !catalogos.estados.some(
      (estado) => estado.id_estado === datos.id_estado
    )
  ) {
    errores.push('El estado seleccionado no existe.');
  }

  if (
    esId(datos.id_laboratorio) &&
    !catalogos.laboratorios.some(
      (laboratorio) =>
        laboratorio.id_laboratorio === datos.id_laboratorio
    )
  ) {
    errores.push(
      'El laboratorio no existe o no está autorizado para su cuenta.'
    );
  }

  return { datos, errores };
}

// Detectar duplicados en todas las filas y en PostgreSQL.
// Se comparan los valores recortados, conservando la distinción
// entre mayúsculas y minúsculas de las restricciones existentes.
async function validarLote(cliente, filas, catalogos) {
  const resultados = filas.map((fila, indice) => ({
    fila:
      Number.isSafeInteger(fila?.fila) && fila.fila > 0
        ? fila.fila
        : indice + 1,
    ...validarFila(fila, catalogos),
  }));

  for (const campo of ['numero_serie', 'placa_institucional']) {
    const grupos = new Map();

    for (const resultado of resultados) {
      const valor = resultado.datos[campo];

      if (!valor) continue;

      if (!grupos.has(valor)) {
        grupos.set(valor, []);
      }

      grupos.get(valor).push(resultado);
    }

    for (const [valor, grupo] of grupos) {
      if (grupo.length > 1) {
        for (const resultado of grupo) {
          resultado.errores.push(
            `${campo}: «${valor}» está repetido en el archivo.`
          );
        }
      }
    }
  }

  const series = resultados
    .map((resultado) => resultado.datos.numero_serie)
    .filter(Boolean);

  const placas = resultados
    .map((resultado) => resultado.datos.placa_institucional)
    .filter(Boolean);

  const existentes = await cliente.query(
    `
      SELECT numero_serie, placa_institucional
      FROM public.equipo
      WHERE numero_serie = ANY($1::text[])
         OR placa_institucional = ANY($2::text[])
    `,
    [series, placas]
  );

  const seriesExistentes = new Set(
    existentes.rows.map((equipo) => equipo.numero_serie)
  );

  const placasExistentes = new Set(
    existentes.rows.map((equipo) => equipo.placa_institucional)
  );

  for (const resultado of resultados) {
    if (
      resultado.datos.numero_serie &&
      seriesExistentes.has(resultado.datos.numero_serie)
    ) {
      resultado.errores.push(
        'El número de serie ya está registrado.'
      );
    }

    if (
      resultado.datos.placa_institucional &&
      placasExistentes.has(resultado.datos.placa_institucional)
    ) {
      resultado.errores.push(
        'La placa institucional ya está registrada.'
      );
    }
  }

  return resultados;
}

// POST /api/importacion-equipos/leer
// Recibe el archivo y devuelve la revisión. No inserta equipos.
router.post('/leer', recibirArchivo, async (req, res) => {
  try {
    if (!req.file) {
      throw errorSolicitud('Seleccione un archivo Excel.');
    }

    const libro = new ExcelJS.Workbook();

    try {
      await libro.xlsx.load(req.file.buffer);
    } catch {
      throw errorSolicitud(
        'No fue posible leer el archivo. Compruebe que sea un .xlsx válido y sin contraseña.'
      );
    }

    const hoja = libro.worksheets.find(
      (elemento) => normalizar(elemento.name) === 'inventario'
    );

    if (!hoja) {
      throw errorSolicitud(
        'El archivo debe contener una hoja llamada Inventario.'
      );
    }

    if (hoja.rowCount > 10000 || hoja.columnCount > 100) {
      throw errorSolicitud(
        'La hoja supera el tamaño permitido para esta importación.'
      );
    }

    const encabezados = buscarEncabezados(hoja);
    const catalogos = await cargarCatalogos(pool, req.usuario);
    const filas = [];
    const originales = new Map();

    for (
      let numero = encabezados.fila + 1;
      numero <= hoja.rowCount;
      numero += 1
    ) {
      const fila = hoja.getRow(numero);
      const columnas = encabezados.columnas;
      const leer = (campo) => leerCampo(fila, columnas, campo);

      const datos = {
        fila: numero,
        nombre: leer('nombre'),
        numero_serie: leer('numero_serie'),
        placa_institucional: leer('placa_institucional'),
        marca: leer('marca'),
        modelo: leer('modelo'),
        anio: leer('anio'),
        caracteristicas: leer('caracteristicas'),
        comentarios: leer('comentarios'),
        ubicacion_detalle: leer('ubicacion_detalle'),
      };

      const categoria = leer('categoria');
      const estado = leer('estado');
      const sede = leer('sede');
      const laboratorio = leer('laboratorio');
      const anioModelo = leer('anio_modelo');

      const idCategoriaOriginal = leer('id_categoria');
      const idEstadoOriginal = leer('id_estado');
      const idLaboratorioOriginal = leer('id_laboratorio');

      const adicionales = [];

      for (const [etiqueta, encabezado] of DATOS_ADICIONALES) {
        const columna = columnas.get(normalizar(encabezado));

        if (!columna) continue;

        const texto = textoCelda(fila.getCell(columna));

        if (texto) {
          adicionales.push(`${etiqueta}: ${texto}`);
        }
      }

      // Conservar el texto combinado para que la persona
      // lo revise y separe sin perder información.
      if (anioModelo) {
        adicionales.push(`Año y modelo original: ${anioModelo}`);
      }

      const tieneInformacion =
        Object.entries(datos).some(
          ([campo, valor]) => campo !== 'fila' && Boolean(valor)
        ) ||
        Boolean(
          categoria ||
          estado ||
          sede ||
          laboratorio ||
          idCategoriaOriginal ||
          idEstadoOriginal ||
          idLaboratorioOriginal ||
          adicionales.length
        );

      // Ignorar filas que solo tienen el número consecutivo.
      if (!tieneInformacion) continue;

      if (filas.length >= MAX_FILAS) {
        throw errorSolicitud(
          `Puede importar hasta ${MAX_FILAS} equipos por archivo.`
        );
      }

      datos.caracteristicas = [
        datos.caracteristicas,
        ...adicionales,
      ].filter(Boolean).join('\n');

      datos.id_categoria = idCategoriaOriginal
        ? idDesdeTexto(idCategoriaOriginal)
        : buscarId(
            catalogos.categorias,
            'id_categoria',
            categoria
          );

      datos.id_estado = idEstadoOriginal
        ? idDesdeTexto(idEstadoOriginal)
        : buscarId(
            catalogos.estados,
            'id_estado',
            estado
          );

      datos.id_laboratorio = idLaboratorioOriginal
        ? idDesdeTexto(idLaboratorioOriginal)
        : buscarLaboratorio(
            catalogos,
            laboratorio,
            sede
          );

      originales.set(numero, {
        categoria,
        estado,
        sede,
        laboratorio,
        anio_modelo: anioModelo,
      });

      filas.push(datos);
    }

    if (filas.length === 0) {
      throw errorSolicitud(
        'La hoja Inventario no contiene equipos para importar.'
      );
    }

    const revision = await validarLote(pool, filas, catalogos);

    return res.json({
      success: true,
      message: 'Archivo leído. Revise los datos antes de confirmar.',
      data: {
        archivo: req.file.originalname,
        catalogos,
        filas: revision.map((resultado) => ({
          fila: resultado.fila,
          ...resultado.datos,
          originales: originales.get(resultado.fila),
          errores: resultado.errores,
        })),
        total: revision.length,
        validos: revision.filter(
          (resultado) => resultado.errores.length === 0
        ).length,
      },
    });
  } catch (error) {
    return responderError(res, error);
  }
});

// POST /api/importacion-equipos/confirmar
// Recibe las filas seleccionadas y corregidas.
// Valida nuevamente y registra las que no tengan errores.
router.post('/confirmar', async (req, res) => {
  let cliente;
  let transaccion = false;

  try {
    const filas = req.body?.filas;

    if (
      !Array.isArray(filas) ||
      filas.length === 0 ||
      filas.length > MAX_FILAS
    ) {
      throw errorSolicitud(
        `Envíe entre 1 y ${MAX_FILAS} equipos para importar.`
      );
    }

    cliente = await pool.connect();

    await cliente.query('BEGIN');
    transaccion = true;

    // Volver a comprobar la cuenta y el permiso al confirmar.
    // El bloqueo evita que esta cuenta cambie durante la escritura.
    const cuenta = await cliente.query(
      `
        SELECT
          u.activo,
          u.permiso_inventario,
          r.nombre AS rol
        FROM public.usuario u
        INNER JOIN public.rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1
        FOR SHARE OF u
      `,
      [req.usuario.idUsuario]
    );

    const usuario = cuenta.rows[0];

    if (
      !usuario ||
      !usuario.activo ||
      !puedeRegistrarInventario(usuario)
    ) {
      throw errorSolicitud(
        'Su cuenta ya no tiene permisos para importar equipos.',
        403
      );
    }

    const catalogos = await cargarCatalogos(cliente, {
      ...usuario,
      idUsuario: req.usuario.idUsuario,
    });

    const revision = await validarLote(
      cliente,
      filas,
      catalogos
    );

    await cliente.query(
      "SELECT set_config('app.usuario_id', $1, true)",
      [String(req.usuario.idUsuario)]
    );

    const resultados = [];

    for (const resultado of revision) {
      if (resultado.errores.length > 0) {
        resultados.push({
          fila: resultado.fila,
          importado: false,
          errores: resultado.errores,
        });
        continue;
      }

      await cliente.query('SAVEPOINT fila_importacion');

      try {
        const valores = CAMPOS.map(
          (campo) => resultado.datos[campo]
        );

        const parametros = CAMPOS.map(
          (_, indice) => `$${indice + 1}`
        );

        const insertado = await cliente.query(
          `
            INSERT INTO public.equipo (
              ${CAMPOS.join(', ')}
            )
            VALUES (${parametros.join(', ')})
            RETURNING id_equipo
          `,
          valores
        );

        await cliente.query(
          'RELEASE SAVEPOINT fila_importacion'
        );

        resultados.push({
          fila: resultado.fila,
          importado: true,
          id_equipo: insertado.rows[0].id_equipo,
          errores: [],
        });
      } catch (error) {
        await cliente.query(
          'ROLLBACK TO SAVEPOINT fila_importacion'
        );

        await cliente.query(
          'RELEASE SAVEPOINT fila_importacion'
        );

        if (
          !['23505', '23503', '23502', '23514', '22001'].includes(
            error.code
          )
        ) {
          throw error;
        }

        const mensaje =
          error.code === '23505'
            ? 'La placa o el número de serie ya fue registrado.'
            : error.code === '23503'
              ? 'Una categoría, estado o laboratorio ya no está disponible.'
              : 'Los datos no cumplen las restricciones de la base de datos.';

        resultados.push({
          fila: resultado.fila,
          importado: false,
          errores: [mensaje],
        });
      }
    }

    await cliente.query('COMMIT');
    transaccion = false;

    const importados = resultados.filter(
      (resultado) => resultado.importado
    ).length;

    return res.json({
      success: true,
      message:
        `Se importaron ${importados} de ${resultados.length} equipos.`,
      data: {
        importados,
        rechazados: resultados.length - importados,
        resultados,
      },
    });
  } catch (error) {
    if (cliente && transaccion) {
      try {
        await cliente.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Error al revertir la importación:',
          rollbackError
        );
      }
    }

    return responderError(res, error);
  } finally {
    cliente?.release();
  }
});

module.exports = router;