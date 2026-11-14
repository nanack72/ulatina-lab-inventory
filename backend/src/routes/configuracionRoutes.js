const express = require('express');
const pool = require('../config/database');
const { verificarToken } = require('../middlewares/authMiddleware');
const { permitirRoles } = require('../middlewares/permisosMiddleware');

const router = express.Router();

// Todas las operaciones de esta sección requieren Superadministrador.
router.use(
  verificarToken,
  permitirRoles('Superadministrador')
);

// Los nombres SQL provienen únicamente de esta lista fija.
const CATALOGOS = {
  categorias: {
    tabla: 'categoria',
    id: 'id_categoria',
    campos: {
      nombre: { max: 100, obligatorio: true },
      descripcion: { max: 255, obligatorio: false },
    },
  },
  estados: {
    tabla: 'estado',
    id: 'id_estado',
    campos: {
      nombre: { max: 100, obligatorio: true },
      descripcion: { max: 255, obligatorio: false },
    },
  },
  sedes: {
    tabla: 'sede',
    id: 'id_sede',
    campos: {
      nombre: { max: 150, obligatorio: true },
    },
  },
  laboratorios: {
    tabla: 'laboratorio',
    id: 'id_laboratorio',
    campos: {
      codigo: { max: 50, obligatorio: true },
      nombre: { max: 150, obligatorio: true },
      id_sede: { tipo: 'id', obligatorio: true },
    },
  },
};

router.param('catalogo', (req, res, next, catalogo) => {
  if (!Object.prototype.hasOwnProperty.call(CATALOGOS, catalogo)) {
    return res.status(404).json({
      success: false,
      message: 'Catálogo no encontrado.',
    });
  }

  req.catalogoConfig = CATALOGOS[catalogo];
  next();
});

router.param('id', (req, res, next, valor) => {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    return res.status(400).json({
      success: false,
      message: 'Identificador no válido.',
    });
  }

  req.registroId = id;
  next();
});

function validarDatos(configuracion, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Debe enviar los datos del registro.' };
  }

  const datos = {};

  for (const [campo, reglas] of Object.entries(configuracion.campos)) {
    const valor = body[campo];

    if (reglas.tipo === 'id') {
      const id =
        typeof valor === 'number' || typeof valor === 'string'
          ? Number(valor)
          : NaN;

      if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
        return { error: 'Seleccione una sede válida.' };
      }

      datos[campo] = id;
      continue;
    }

    if (valor === null || valor === undefined) {
      if (reglas.obligatorio) {
        return { error: `El campo ${campo} es obligatorio.` };
      }

      datos[campo] = null;
      continue;
    }

    if (typeof valor !== 'string') {
      return { error: `El campo ${campo} debe ser texto.` };
    }

    const texto = valor.trim();

    if (reglas.obligatorio && !texto) {
      return { error: `El campo ${campo} es obligatorio.` };
    }

    if (Array.from(texto).length > reglas.max) {
      return {
        error: `El campo ${campo} admite hasta ${reglas.max} caracteres.`,
      };
    }

    datos[campo] = texto || null;
  }

  return { datos };
}

function responderError(res, error, operacion) {
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con esos datos únicos.',
    });
  }

  if (error.code === '23503') {
    return res.status(409).json({
      success: false,
      message:
        operacion === 'eliminar'
          ? 'No se puede eliminar: el registro está relacionado con equipos, historiales u otras asignaciones.'
          : 'No se puede guardar: la sede no existe o el cambio afecta asignaciones relacionadas.',
    });
  }

  console.error(`Error de configuración al ${operacion}:`, error);

  return res.status(500).json({
    success: false,
    message: 'No fue posible completar la operación.',
  });
}

// Consultar el catálogo completo.
router.get('/:catalogo', async (req, res) => {
  const config = req.catalogoConfig;

  try {
    let consulta;

    if (config.tabla === 'laboratorio') {
      consulta = `
        SELECT
          l.id_laboratorio,
          l.codigo,
          l.nombre,
          l.id_sede,
          s.nombre AS nombre_sede
        FROM public.laboratorio l
        INNER JOIN public.sede s ON s.id_sede = l.id_sede
        ORDER BY l.id_laboratorio DESC
      `;
    } else {
      const columnas = [
        config.id,
        ...Object.keys(config.campos),
      ].join(', ');

        consulta = `
        SELECT ${columnas}
        FROM public.${config.tabla}
        ORDER BY ${config.id} DESC
        `;
    }

    const resultado = await pool.query(consulta);

    return res.json({
      success: true,
      data: resultado.rows,
    });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

// Crear.
router.post('/:catalogo', async (req, res) => {
  const config = req.catalogoConfig;
  const validacion = validarDatos(config, req.body);

  if (validacion.error) {
    return res.status(400).json({
      success: false,
      message: validacion.error,
    });
  }

  const campos = Object.keys(config.campos);
  const valores = campos.map((campo) => validacion.datos[campo]);
  const parametros = campos.map((_, indice) => `$${indice + 1}`);

  try {
    const resultado = await pool.query(
      `
        INSERT INTO public.${config.tabla} (${campos.join(', ')})
        VALUES (${parametros.join(', ')})
        RETURNING ${config.id}, ${campos.join(', ')}
      `,
      valores
    );

    return res.status(201).json({
      success: true,
      message: 'Registro creado correctamente.',
      data: resultado.rows[0],
    });
  } catch (error) {
    return responderError(res, error, 'crear');
  }
});

// Editar.
router.put('/:catalogo/:id', async (req, res) => {
  const config = req.catalogoConfig;
  const validacion = validarDatos(config, req.body);

  if (validacion.error) {
    return res.status(400).json({
      success: false,
      message: validacion.error,
    });
  }

  const campos = Object.keys(config.campos);
  const valores = campos.map((campo) => validacion.datos[campo]);

  const asignaciones = campos.map(
    (campo, indice) => `${campo} = $${indice + 1}`
  );

  valores.push(req.registroId);

  try {
    const resultado = await pool.query(
      `
        UPDATE public.${config.tabla}
        SET ${asignaciones.join(', ')}
        WHERE ${config.id} = $${valores.length}
        RETURNING ${config.id}, ${campos.join(', ')}
      `,
      valores
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El registro ya no existe.',
      });
    }

    return res.json({
      success: true,
      message: 'Registro actualizado correctamente.',
      data: resultado.rows[0],
    });
  } catch (error) {
    return responderError(res, error, 'editar');
  }
});

// Eliminar. Las claves foráneas impiden borrar registros en uso.
router.delete('/:catalogo/:id', async (req, res) => {
  const config = req.catalogoConfig;

  try {
    const resultado = await pool.query(
      `
        DELETE FROM public.${config.tabla}
        WHERE ${config.id} = $1
        RETURNING ${config.id}
      `,
      [req.registroId]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'El registro ya no existe.',
      });
    }

    return res.json({
      success: true,
      message: 'Registro eliminado correctamente.',
    });
  } catch (error) {
    return responderError(res, error, 'eliminar');
  }
});

module.exports = router;