const pool = require('../config/database');

// Verificar si el usuario tiene acceso global
const tieneAccesoGlobal = (usuario) => {
  return usuario?.rol?.toLowerCase() === 'superadministrador';
};

// Construir la condición de acceso a laboratorios
const agregarRestriccionAcceso = (
  condiciones,
  valores,
  usuario
) => {
  if (!usuario || !Number.isSafeInteger(Number(usuario.idUsuario))) {
    return false;
  }

  if (tieneAccesoGlobal(usuario)) {
    return true;
  }

  valores.push(Number(usuario.idUsuario));

  condiciones.push(`
    EXISTS (
      SELECT 1
      FROM public.usuario_sede us
      INNER JOIN public.usuario_laboratorio ul
        ON us.id_usuario_sede = ul.id_usuario_sede
      WHERE us.id_usuario = $${valores.length}
        AND us.id_sede = l.id_sede
        AND ul.id_sede = l.id_sede
        AND ul.id_laboratorio = e.id_laboratorio
    )
  `);

  return true;
};

// Obtener equipos con búsquedas, filtros y permisos
const obtenerEquipos = async (req, res) => {
  try {
    const condiciones = [];
    const valores = [];

    // Restringir según los laboratorios asignados
    if (!agregarRestriccionAcceso(
      condiciones,
      valores,
      req.usuario
    )) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    // Filtros de texto
    const filtrosTexto = {
      nombre: 'e.nombre',
      numero_serie: 'e.numero_serie',
      placa_institucional: 'e.placa_institucional',
      marca: 'e.marca',
      modelo: 'e.modelo'
    };

    for (const [campo, columna] of Object.entries(filtrosTexto)) {
      const valor = req.query[campo];

      if (valor !== undefined) {
        if (
          typeof valor !== 'string' ||
          !valor.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: `El filtro ${campo} no es válido`
          });
        }

        valores.push(`%${valor.trim()}%`);

        condiciones.push(
          `${columna} ILIKE $${valores.length}`
        );
      }
    }

    // Filtros por identificador
    const filtrosId = {
      id_categoria: 'e.id_categoria',
      id_estado: 'e.id_estado',
      id_laboratorio: 'e.id_laboratorio',
      id_sede: 's.id_sede'
    };

    for (const [campo, columna] of Object.entries(filtrosId)) {
      const valor = req.query[campo];

      if (valor !== undefined) {
        if (
          typeof valor !== 'string' ||
          !/^[1-9]\d*$/.test(valor) ||
          !Number.isSafeInteger(Number(valor))
        ) {
          return res.status(400).json({
            success: false,
            message: `El filtro ${campo} debe ser un ID válido`
          });
        }

        valores.push(Number(valor));

        condiciones.push(
          `${columna} = $${valores.length}`
        );
      }
    }

    // Consulta principal
    let consulta = `
      SELECT
        e.id_equipo,
        e.nombre,
        e.numero_serie,
        e.placa_institucional,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,

        e.id_categoria,
        c.nombre AS categoria,

        e.id_estado,
        es.nombre AS estado,

        e.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,

        s.id_sede,
        s.nombre AS sede

      FROM public.equipo e

      INNER JOIN public.categoria c
        ON e.id_categoria = c.id_categoria

      INNER JOIN public.estado es
        ON e.id_estado = es.id_estado

      INNER JOIN public.laboratorio l
        ON e.id_laboratorio = l.id_laboratorio

      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede
    `;

    // Aplicar restricciones y filtros
    if (condiciones.length > 0) {
      consulta += `
        WHERE ${condiciones.join(' AND ')}
      `;
    }

    consulta += `
      ORDER BY e.id_equipo DESC
    `;

    const resultado = await pool.query(
      consulta,
      valores
    );

    return res.status(200).json({
      success: true,
      total: resultado.rowCount,
      data: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al obtener equipos:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los equipos'
    });
  }
};

// Obtener un equipo por ID respetando los permisos
const obtenerEquipoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(Number(id))
    ) {
      return res.status(400).json({
        success: false,
        message: 'El identificador del equipo no es válido'
      });
    }

    const condiciones = [];
    const valores = [Number(id)];

    // Filtrar por el equipo solicitado
    condiciones.push('e.id_equipo = $1');

    // Agregar autorización por laboratorio
    if (!agregarRestriccionAcceso(
      condiciones,
      valores,
      req.usuario
    )) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sin autorización válida'
      });
    }

    const consulta = `
      SELECT
        e.id_equipo,
        e.nombre,
        e.numero_serie,
        e.placa_institucional,
        e.marca,
        e.modelo,
        e.anio,
        e.caracteristicas,
        e.comentarios,
        e.ubicacion_detalle,

        e.id_categoria,
        c.nombre AS categoria,

        e.id_estado,
        es.nombre AS estado,

        e.id_laboratorio,
        l.codigo AS codigo_laboratorio,
        l.nombre AS laboratorio,

        s.id_sede,
        s.nombre AS sede

      FROM public.equipo e

      INNER JOIN public.categoria c
        ON e.id_categoria = c.id_categoria

      INNER JOIN public.estado es
        ON e.id_estado = es.id_estado

      INNER JOIN public.laboratorio l
        ON e.id_laboratorio = l.id_laboratorio

      INNER JOIN public.sede s
        ON l.id_sede = s.id_sede

      WHERE ${condiciones.join(' AND ')}
    `;

    const resultado = await pool.query(
      consulta,
      valores
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado o sin acceso autorizado'
      });
    }

    return res.status(200).json({
      success: true,
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error(
      'Error al obtener equipo por ID:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Error al consultar el equipo'
    });
  }
};

module.exports = {
  obtenerEquipos,
  obtenerEquipoPorId
};
