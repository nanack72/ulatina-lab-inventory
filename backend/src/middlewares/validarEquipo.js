const validarEquipo = (req, res, next) => {
  const {
    nombre,
    numero_serie,
    placa_institucional,
    id_laboratorio,
    id_categoria,
    id_estado,
    anio
  } = req.body;

  const errores = [];

  // Validar el nombre del equipo
  if (typeof nombre !== 'string' || !nombre.trim()) {
    errores.push('El nombre del equipo es obligatorio');
  }

  // Validar número de serie
  if (
    typeof numero_serie !== 'string' ||
    !numero_serie.trim()
  ) {
    errores.push('El número de serie es obligatorio');
  }

  // Validar placa institucional
  if (
    typeof placa_institucional !== 'string' ||
    !placa_institucional.trim()
  ) {
    errores.push('La placa institucional es obligatoria');
  }

  // Validar identificadores
  const validarId = (valor) =>
    Number.isSafeInteger(valor) && valor > 0;

  if (!validarId(id_laboratorio)) {
    errores.push('El laboratorio no es válido');
  }

  if (!validarId(id_categoria)) {
    errores.push('La categoría no es válida');
  }

  if (!validarId(id_estado)) {
    errores.push('El estado no es válido');
  }

  // Validar año, cuando se proporciona
  if (
    anio !== undefined &&
    anio !== null &&
    (
      !Number.isInteger(anio) ||
      anio < 1900 ||
      anio > new Date().getFullYear() + 1
    )
  ) {
    errores.push('El año del equipo no es válido');
  }

  if (errores.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errores
    });
  }

  next();
};

module.exports = validarEquipo;
