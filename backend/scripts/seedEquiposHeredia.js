// Carga los equipos del Excel institucional de Heredia a la base de datos de Neon
// Ejecutar con: cd backend && node scripts/seedEquiposHeredia.js

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Cargar variables de entorno desde backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Reutilizar el pool de conexión hacia Neon PostgreSQL
const pool = require('../src/config/database');

// Ruta predeterminada al archivo Excel institucional (admite override por argumento o variable de entorno)
const EXCEL_PATH =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ||
  process.env.EXCEL_SEED_PATH ||
  'C:\\Users\\oscar\\Desktop\\-\\PES-OSCAR_MONOGA\\Proyección de mantenimientos Ingenierias y Tics 2026-ANUAL.xlsx';


const CATEGORIAS_REQUERIDAS = [
  {
    nombre: 'Cómputo Portátil',
    descripcion: 'Computadoras portátiles (laptops) de uso académico y de laboratorio'
  },
  {
    nombre: 'Cómputo de Escritorio',
    descripcion: 'Estaciones de trabajo y computadoras de escritorio de laboratorio'
  },
  {
    nombre: 'Servidores',
    descripcion: 'Servidores físicos de rack y torre para virtualización e infraestructura'
  },
  {
    nombre: 'Redes y Telecomunicaciones',
    descripcion: 'Switches, routers, racks de comunicaciones y equipos de red (Cisco)'
  },
  {
    nombre: 'Pantallas y Audiovisual',
    descripcion: 'Tótems publicitarios, pantallas táctiles LCD y proyecciones'
  },
  {
    nombre: 'Maquinaria y Automatización',
    descripcion: 'Tornos, fresadoras, impresoras 3D, bandas automatizadas, hornos y climatización'
  },
  {
    nombre: 'Equipos de Ensayo y Medición',
    descripcion: 'Balanzas, mezcladoras, prensas, compactadores, bombas de vacío y equipos de ensayo'
  }
];

const LABORATORIOS_REQUERIDOS = [
  {
    codigo: 'B1-LI',
    nombre: 'Laboratorio de Informática (B1-LI)'
  },
  {
    codigo: 'B1-CISCO1',
    nombre: 'Laboratorio de Redes y Telecomunicaciones Cisco (B1-CISCO1)'
  },
  {
    codigo: 'LAB-LINKTECH',
    nombre: 'Laboratorio Linktech (Ingeniería en Sistemas)'
  },
  {
    codigo: 'E-MULTIFUNCIONAL',
    nombre: 'Edificio E - Laboratorio Multifuncional'
  },
  {
    codigo: 'LAB-MAT-CONST',
    nombre: 'Laboratorio de Materiales de Construcción'
  },
  {
    codigo: 'LAB-PAVIMENTOS',
    nombre: 'Laboratorio de Pavimentos'
  },
  {
    codigo: 'LAB-FLUIDOS',
    nombre: 'Laboratorio de Fluidos e Hidráulica'
  },
  {
    codigo: 'LAB-ESTRUCTURAS',
    nombre: 'Laboratorio de Estructuras'
  }
];


// Busca un usuario para asociarlo al trigger de auditoría de equipo
async function resolverUsuarioResponsable(client) {
  const res = await client.query(`
    SELECT u.id_usuario, u.nombre_completo, r.nombre AS rol
    FROM public.usuario u
    LEFT JOIN public.rol r ON u.id_rol = r.id_rol
    WHERE u.activo = true
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(r.nombre, '')) = 'superadministrador' THEN 1
        WHEN LOWER(COALESCE(r.nombre, '')) = 'administrador' THEN 2
        ELSE 3
      END,
      u.id_usuario ASC
    LIMIT 1
  `);

  if (res.rowCount > 0) {
    return res.rows[0].id_usuario;
  }

  // Respaldo: cualquier usuario existente en la tabla
  const fallback = await client.query(
    'SELECT id_usuario FROM public.usuario ORDER BY id_usuario ASC LIMIT 1'
  );

  if (fallback.rowCount === 0) {
    throw new Error(
      'No existe ningún registro en public.usuario para asociar los triggers de auditoría (app.usuario_id).'
    );
  }

  return fallback.rows[0].id_usuario;
}

// Revisa si ya existe la sede Heredia o la crea
async function asegurarSedeHeredia(client) {
  const buscar = await client.query(
    `SELECT id_sede FROM public.sede WHERE LOWER(TRIM(nombre)) = 'heredia' LIMIT 1`
  );

  if (buscar.rowCount > 0) {
    return buscar.rows[0].id_sede;
  }

  const insertar = await client.query(
    `INSERT INTO public.sede (nombre) VALUES ('Heredia') RETURNING id_sede`
  );

  return insertar.rows[0].id_sede;
}

// Revisa si existe el estado 'Operativo' o lo crea
async function asegurarEstadoOperativo(client) {
  // 1. Verificar si ya existe por nombre 'Operativo'
  const porNombre = await client.query(
    `SELECT id_estado FROM public.estado WHERE LOWER(TRIM(nombre)) = 'operativo' LIMIT 1`
  );
  if (porNombre.rowCount > 0) {
    return porNombre.rows[0].id_estado;
  }

  // 2. Verificar si el id_estado = 1 está libre para insertar 'Operativo' con id 1
  const porIdUno = await client.query(
    `SELECT id_estado FROM public.estado WHERE id_estado = 1 LIMIT 1`
  );

  if (porIdUno.rowCount === 0) {
    const insUno = await client.query(`
      INSERT INTO public.estado (id_estado, nombre, descripcion)
      OVERRIDING SYSTEM VALUE
      VALUES (1, 'Operativo', 'Equipo en correcto funcionamiento y disponible en laboratorio')
      ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id_estado
    `);
    return insUno.rows[0].id_estado;
  }

  // 3. Si el ID 1 estaba ocupado por otro estado, insertar 'Operativo' con la secuencia
  const insSeq = await client.query(`
    INSERT INTO public.estado (nombre, descripcion)
    VALUES ('Operativo', 'Equipo en correcto funcionamiento y disponible en laboratorio')
    ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id_estado
  `);

  return insSeq.rows[0].id_estado;
}

// Crea o actualiza las categorías en la base de datos
async function asegurarCategorias(client) {
  const mapaCategorias = {};

  for (const cat of CATEGORIAS_REQUERIDAS) {
    const res = await client.query(
      `
      INSERT INTO public.categoria (nombre, descripcion)
      VALUES ($1, $2)
      ON CONFLICT (nombre)
      DO UPDATE SET descripcion = COALESCE(public.categoria.descripcion, EXCLUDED.descripcion)
      RETURNING id_categoria, nombre
      `,
      [cat.nombre, cat.descripcion]
    );
    mapaCategorias[cat.nombre] = res.rows[0].id_categoria;
  }

  return mapaCategorias;
}

// Revisa o crea los laboratorios de la sede
async function asegurarLaboratorios(client, idSedeHeredia) {
  const mapaLaboratorios = {};

  for (const lab of LABORATORIOS_REQUERIDOS) {
    const existente = await client.query(
      `
      SELECT id_laboratorio
      FROM public.laboratorio
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM($1))
        AND id_sede = $2
      LIMIT 1
      `,
      [lab.codigo, idSedeHeredia]
    );

    if (existente.rowCount > 0) {
      mapaLaboratorios[lab.codigo] = existente.rows[0].id_laboratorio;
    } else {
      const insertado = await client.query(
        `
        INSERT INTO public.laboratorio (id_sede, codigo, nombre)
        VALUES ($1, $2, $3)
        RETURNING id_laboratorio
        `,
        [idSedeHeredia, lab.codigo, lab.nombre]
      );
      mapaLaboratorios[lab.codigo] = insertado.rows[0].id_laboratorio;
    }
  }

  return mapaLaboratorios;
}


// Limpia saltos de línea y espacios en blanco
function limpiarTexto(valor) {
  if (valor === undefined || valor === null) return '';
  return String(valor).replace(/\r\n/g, '\n').trim();
}

// Deja el texto en una sola línea limpia
function limpiarLinea(valor) {
  return limpiarTexto(valor).replace(/\s+/g, ' ').trim();
}

// Relaciona el texto de ubicación del Excel con el laboratorio
function resolverCodigoLaboratorio(ubicacionTexto) {
  const u = limpiarLinea(ubicacionTexto).toLowerCase();

  if (u.includes('b1-li') || u.includes('b1 li')) {
    return { codigo: 'B1-LI', ubicacionDetalle: 'Laboratorio B1-LI' };
  }
  if (u.includes('cisco')) {
    return { codigo: 'B1-CISCO1', ubicacionDetalle: 'Laboratorio B1-CISCO1 (Cisco)' };
  }
  if (u.includes('linktech')) {
    return { codigo: 'LAB-LINKTECH', ubicacionDetalle: 'Laboratorio Linktech' };
  }
  if (u.includes('multifuncional')) {
    return {
      codigo: 'E-MULTIFUNCIONAL',
      ubicacionDetalle: 'Edificio E - Laboratorio Multifuncional'
    };
  }
  if (u.includes('materiales de construc')) {
    return {
      codigo: 'LAB-MAT-CONST',
      ubicacionDetalle: 'Laboratorio de Materiales de Construcción'
    };
  }
  if (u.includes('pavimentos')) {
    return { codigo: 'LAB-PAVIMENTOS', ubicacionDetalle: 'Laboratorio de Pavimentos' };
  }
  if (u.includes('fluidos') || u.includes('hidr')) {
    return {
      codigo: 'LAB-FLUIDOS',
      ubicacionDetalle: 'Laboratorio de Fluidos e Hidráulica'
    };
  }
  if (u.includes('estructuras')) {
    return { codigo: 'LAB-ESTRUCTURAS', ubicacionDetalle: 'Laboratorio de Estructuras' };
  }

  return {
    codigo: 'E-MULTIFUNCIONAL',
    ubicacionDetalle: limpiarLinea(ubicacionTexto).slice(0, 100) || 'Sede Heredia'
  };
}

// Extrae las placas de la celda del Excel
function extraerPlacas(celdaPlaca) {
  const raw = limpiarTexto(celdaPlaca);
  if (!raw) return [];

  const tokens = raw
    .split(/[;\r\n,]+/)
    .map((t) => t.trim().replace(/\s+/g, ''))
    .filter((t) => t.length > 0 && !/^(n\/a|na|sinasignar|pendiente|-)$/i.test(t));

  return tokens;
}

// Busca si viene el año en las observaciones
function inferirAnio(nombreEquipo, textoObservaciones) {
  const texto = `${nombreEquipo} ${textoObservaciones}`;

  // Año explícito (ej. "Equipo comprado el 2021")
  const matchAnioExplicito = texto.match(/\b(201[0-9]|202[0-6])\b/);
  if (matchAnioExplicito) {
    return parseInt(matchAnioExplicito[1], 10);
  }

  // Sin año explícito en el Excel no se estima: queda NULL
  return null;
}

// Clasifica el equipo según el texto que viene en el Excel
function clasificarEquipo(nombreCrudo, codigoLab, detalleMantenimiento, observacionesVidaUtil) {
  // Quitar prefijo numérico de lote (ej. "4 Laptop HP EliteBook 840 G9" -> "Laptop HP EliteBook 840 G9")
  let nombreBase = limpiarLinea(nombreCrudo).replace(/^\d+\s+(?=[A-Za-zÁÉÍÓÚáéíóú])/i, '');
  if (nombreBase.endsWith('.')) {
    nombreBase = nombreBase.slice(0, -1).trim();
  }

  const nLower = nombreBase.toLowerCase();
  const obsLower = `${detalleMantenimiento} ${observacionesVidaUtil}`.toLowerCase();

  let categoria = 'Equipos de Ensayo y Medición';
  let marca = 'Genérico';
  let modelo = 'Estándar';
  let caracteristicas = limpiarLinea(detalleMantenimiento) || 'Equipo de laboratorio Sede Heredia';

  // 1. Laptops HP EliteBook 840 G9
  if (nLower.includes('laptop') || nLower.includes('elitebook')) {
    nombreBase = 'Laptop HP EliteBook 840 G9';
    categoria = 'Cómputo Portátil';
    marca = 'HP';
    modelo = 'EliteBook 840 G9';
    caracteristicas =
      'Portátil empresarial 14", conectividad Bluetooth y Wi-Fi, Windows / Office 365 instalado.';
  }
  // 2. Computadoras de escritorio (Linktech)
  else if (nLower.includes('computadora')) {
    nombreBase = 'Computadora de Escritorio Laboratorio';
    categoria = 'Cómputo de Escritorio';
    marca = 'HP / Clon Institucional';
    modelo = 'Workstation Académica';
    caracteristicas =
      'Estación de trabajo para entornos virtuales (NetBeans, Packet Tracer); actualización proyectada a SSD 480 GB y >= 8 GB RAM.';
  }
  // 3. Servidores y Racks Cisco
  else if (nLower.includes('servidor')) {
    if (codigoLab === 'B1-CISCO1' || obsLower.includes('routers y switches cisco')) {
      nombreBase = 'Servidor y Rack de Comunicaciones Cisco';
      categoria = 'Redes y Telecomunicaciones';
      marca = 'Cisco';
      modelo = 'Rack Integrado (Routers & Switches Cisco)';
      caracteristicas =
        'Servidor e infraestructura de routers y switches Cisco integrados en rack con arreglo RAID.';
    } else {
      nombreBase = 'Servidor de Laboratorio B1-LI';
      categoria = 'Servidores';
      marca = 'HP / Dell';
      modelo = 'Servidor de Rack (Virtualización)';
      caracteristicas =
        'Servidor para virtualización local (VMware / Windows Server) con controladora RAID, fuentes redundantes y tarjetas de red.';
    }
  }
  // 4. Tótems publicitarios / Pantallas táctiles
  else if (nLower.includes('tótem') || nLower.includes('totem') || nLower.includes('pantalla')) {
    nombreBase = 'Tótem Publicitario Pantalla Táctil LCD';
    categoria = 'Pantallas y Audiovisual';
    marca = 'LG / Institucional';
    modelo = 'Kiosco Táctil LCD';
    caracteristicas = 'Pantalla táctil LCD vertical con conectividad a Internet y sistema integrado.';
  }
  // 5. Impresora Dremel 3D
  else if (nLower.includes('impresora') && nLower.includes('3d')) {
    nombreBase = 'Impresora 3D Dremel';
    categoria = 'Maquinaria y Automatización';
    marca = 'Dremel';
    modelo = 'DigiLab 3D';
    caracteristicas = 'Impresora 3D de filamento con extrusor hotend y ventilación activa.';
  }
  // 6. Tornos, fresadoras, banda automatizada, hornos, cuarto frío, aire acondicionado
  else if (
    nLower.includes('torno') ||
    nLower.includes('fresadora') ||
    nLower.includes('banda') ||
    nLower.includes('aire acondicionado') ||
    nLower.includes('cuarto frio') ||
    nLower.includes('horno de fundicion')
  ) {
    categoria = 'Maquinaria y Automatización';
    if (nLower.includes('torno cnc')) {
      nombreBase = 'Torno CNC';
      modelo = 'CNC Industrial';
    } else if (nLower.includes('torno convencional')) {
      nombreBase = 'Torno Convencional';
      modelo = 'Paralelo Convencional';
    } else if (nLower.includes('fresadora')) {
      nombreBase = 'Fresadora Industrial';
      modelo = 'Vertical de Torreta';
    } else if (nLower.includes('banda automatizada')) {
      nombreBase = 'Estación de Banda Automatizada con PLC';
      modelo = 'Celda Automatizada 5 Estaciones';
      caracteristicas =
        'Sistema automatizado de banda transportadora con barras de seguridad, sensores de brazo robótico y controladores PLC.';
    } else if (nLower.includes('banda')) {
      nombreBase = 'Banda Transportadora';
      modelo = 'Cinta Transportadora Didáctica';
    }
  }
  // 7. Equipos de Ingeniería Civil / Materiales / Industrial (Forney, Quincy Lab, Humboldt, etc.)
  else {
    categoria = 'Equipos de Ensayo y Medición';

    if (nLower.includes('forney')) {
      marca = 'Forney';
      if (nLower.includes('f-25ex')) {
        nombreBase = 'Máquina Electrohidráulica de Compresión Forney';
        modelo = 'F-25EX-F-CPILOT';
      } else {
        nombreBase = 'Marco de Carga de Velocidad Múltiple Forney';
        modelo = 'Velocidad Múltiple';
      }
    } else if (nLower.includes('quincy')) {
      marca = 'Quincy Lab';
      modelo = 'LBB2';
      nombreBase = 'Horno de Convección Quincy Lab LBB2';
    } else if (nLower.includes('lbb2')) {
      modelo = 'LBB2';
      nombreBase = 'Horno de Convección LBB2';
    } else if (nLower.includes('mezcladora de morteros')) {
      const mMod = nombreBase.match(/modelo\s+([A-Za-z0-9-]+)/i);
      marca = 'Humboldt';
      modelo = mMod ? mMod[1].toUpperCase() : 'H-3841';
      nombreBase = `Mezcladora de Morteros ${modelo}`;
    } else if (nLower.includes('gt-500') || nLower.includes('ventilador de niebla')) {
      modelo = 'GT-500';
      nombreBase = 'Ventilador de Niebla Industrial GT-500';
    } else if (nLower.includes('marshall')) {
      marca = 'Humboldt';
      modelo = 'Marshall Impact Compactor';
      nombreBase = 'Compactador Marshall';
    } else if (nLower.includes('mesa ergonómica') || nLower.includes('mesa ergonomica')) {
      nombreBase = 'Mesa Ergonómica de Laboratorio';
      modelo = 'Estación Ergonómica Ajustable';
    }
  }

  const anio = inferirAnio(nombreBase, `${detalleMantenimiento} ${observacionesVidaUtil}`);

  // Solo se conserva marca/modelo si aparecen literalmente en el Excel.
  // Nada se inventa: lo que no esté en la fuente queda en NULL.
  const textoFuente = `${nombreCrudo} ${detalleMantenimiento} ${observacionesVidaUtil}`.toLowerCase();
  const marcaFinal = marca && textoFuente.includes(marca.toLowerCase()) ? marca : null;
  const modeloFinal = modelo && textoFuente.includes(modelo.toLowerCase()) ? modelo : null;
  const detalleLimpio = limpiarLinea(detalleMantenimiento);

  return {
    nombre: nombreBase.slice(0, 100),
    categoria,
    marca: marcaFinal ? marcaFinal.slice(0, 50) : null,
    modelo: modeloFinal ? modeloFinal.slice(0, 100) : null,
    anio,
    caracteristicas: detalleLimpio
      ? `Detalle de mantenimiento 2026: ${detalleLimpio}`
      : null
  };
}

// Lee las hojas 'Mantenimientos 2026' y 'MANT-Anexo 5' del Excel
function leerFilasExcelHeredia(workbook) {
  const registrosExtraidos = [];
  let totalFilasAnalizadas = 0;
  let filasHerediaDetectadas = 0;

  // --------------------------------------------------------------------------
  // 1. Hoja: "Mantenimientos 2026"
  // --------------------------------------------------------------------------
  if (workbook.Sheets['Mantenimientos 2026']) {
    const filasHoja1 = XLSX.utils.sheet_to_json(workbook.Sheets['Mantenimientos 2026'], {
      header: 1,
      defval: ''
    });

    for (let idx = 6; idx < filasHoja1.length; idx++) {
      const fila = filasHoja1[idx];
      if (!fila || !fila.some((celda) => limpiarTexto(celda) !== '')) continue;

      const sede = limpiarLinea(fila[2]);
      const ubicacion = limpiarLinea(fila[3]);
      const nombreEquipo = limpiarLinea(fila[4]);
      const celdaPlaca = fila[5];
      const tipoMant = limpiarLinea(fila[6]);
      const carreras = limpiarLinea(fila[7]);
      const detalleMant = limpiarTexto(fila[9]);
      const proveedor = limpiarLinea(fila[11]);
      const obsVidaUtil = limpiarTexto(fila[15]);

      if (!nombreEquipo) continue;
      totalFilasAnalizadas++;

      // Caso especial fila 47: "Horno de Conveccion" en "Edificio E Laboratorio Multifuncional" viene con la celda Sede en blanco
      const esHeredia =
        /heredia/i.test(sede) ||
        (sede === '' && /edificio\s*e\s*laboratorio\s*multifuncional/i.test(ubicacion));

      if (!esHeredia) continue;
      filasHerediaDetectadas++;

      const { codigo: codigoLab, ubicacionDetalle } = resolverCodigoLaboratorio(ubicacion);
      const info = clasificarEquipo(nombreEquipo, codigoLab, detalleMant, obsVidaUtil);
      const placas = extraerPlacas(celdaPlaca);

      // Si el nombre indica cantidad explícita (ej. "4 Laptop HP EliteBook 840 G9") pero solo hay 3 placas listadas,
      // o si no tiene placa asignada (ej. Servidor B1-LI o Servidor B1-CISCO1), generamos identificador único institucional.
      const matchCantidad = nombreEquipo.match(/^(\d+)\s+/);
      const cantidadDeclarada = matchCantidad ? parseInt(matchCantidad[1], 10) : 1;

      const listaPlacasFinal = [...placas];

      if (listaPlacasFinal.length === 0) {
        for (let c = 1; c <= cantidadDeclarada; c++) {
          const sufijo = cantidadDeclarada > 1 ? `-0${c}` : '-01';
          listaPlacasFinal.push(`SIN-PLACA-${codigoLab}-${idx}${sufijo}`);
        }
      } else if (cantidadDeclarada > listaPlacasFinal.length) {
        const faltantes = cantidadDeclarada - listaPlacasFinal.length;
        for (let c = 1; c <= faltantes; c++) {
          listaPlacasFinal.push(`PEND-${codigoLab}-F${idx}-0${c}`);
        }
      }

      const comentariosPartes = [
        tipoMant ? `Mantenimiento 2026: ${tipoMant}` : null,
        obsVidaUtil ? `Estado/Vida útil: ${limpiarLinea(obsVidaUtil)}` : null,
        carreras ? `Carreras: ${carreras}` : null,
        proveedor ? `Proveedor sugerido: ${proveedor}` : null
      ].filter(Boolean);

      for (const placa of listaPlacasFinal) {
        registrosExtraidos.push({
          origen: `Mantenimientos 2026 (fila ${idx + 1})`,
          codigoLab,
          ubicacion_detalle: ubicacionDetalle,
          categoriaNombre: info.categoria,
          nombre: info.nombre,
          placa_institucional: placa.slice(0, 100),
          numero_serie: null, // El Excel no incluye números de serie; no se inventan
          marca: info.marca,
          modelo: info.modelo,
          anio: info.anio,
          caracteristicas: info.caracteristicas,
          comentarios: comentariosPartes.join(' | ') || 'Migrado desde Proyección Anual 2026'
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Hoja: "MANT-Anexo 5"
  // --------------------------------------------------------------------------
  if (workbook.Sheets['MANT-Anexo 5']) {
    const filasAnexo = XLSX.utils.sheet_to_json(workbook.Sheets['MANT-Anexo 5'], {
      header: 1,
      defval: ''
    });

    for (let idx = 7; idx < filasAnexo.length; idx++) {
      const fila = filasAnexo[idx];
      if (!fila || !fila.some((celda) => limpiarTexto(celda) !== '')) continue;

      const sede = limpiarLinea(fila[2]);
      const ubicacion = limpiarLinea(fila[3]);
      const carrera = limpiarLinea(fila[4]);
      const cantMant = fila[5];
      const celdaPlaca = fila[6];
      const nombreEquipo = limpiarLinea(fila[7]);
      const tipoMant = limpiarLinea(fila[11]);
      const justificacion = limpiarTexto(fila[12]);
      const obsVidaUtil = limpiarTexto(fila[13]);

      if (!nombreEquipo) continue;
      totalFilasAnalizadas++;

      if (!/heredia/i.test(sede)) continue;
      filasHerediaDetectadas++;

      const { codigo: codigoLab, ubicacionDetalle } = resolverCodigoLaboratorio(ubicacion);
      const info = clasificarEquipo(nombreEquipo, codigoLab, justificacion, obsVidaUtil);
      const placas = extraerPlacas(celdaPlaca);

      // En Anexo 5, la fila "6 Computadoras" en Laboratorio linktech indica 6 equipos sin placa individual
      const matchCantidadNombre = nombreEquipo.match(/^(\d+)\s+computadoras/i);
      const cantidadEquipos = matchCantidadNombre
        ? parseInt(matchCantidadNombre[1], 10)
        : Math.max(placas.length, 1);

      const listaPlacasFinal = [...placas];
      if (listaPlacasFinal.length === 0) {
        for (let c = 1; c <= cantidadEquipos; c++) {
          const num = String(c).padStart(2, '0');
          listaPlacasFinal.push(`SIN-PLACA-${codigoLab}-A5-${idx}-${num}`);
        }
      }

      const detalleValido =
        justificacion && !/^\d+$/.test(limpiarLinea(justificacion))
          ? justificacion
          : obsVidaUtil;

      const comentariosPartes = [
        tipoMant ? `Mantenimiento Anexo 5: ${limpiarLinea(tipoMant)}` : null,
        obsVidaUtil ? `Observaciones: ${limpiarLinea(obsVidaUtil)}` : null,
        carrera ? `Carrera: ${carrera}` : null,
        cantMant ? `Mantenimientos requeridos/año: ${cantMant}` : null
      ].filter(Boolean);

      for (const placa of listaPlacasFinal) {
        registrosExtraidos.push({
          origen: `MANT-Anexo 5 (fila ${idx + 1})`,
          codigoLab,
          ubicacion_detalle: ubicacionDetalle,
          categoriaNombre: info.categoria,
          nombre: info.nombre,
          placa_institucional: placa.slice(0, 100),
          numero_serie: null, // El Excel no incluye números de serie; no se inventan
          marca: info.marca,
          modelo: info.modelo,
          anio: info.anio,
          caracteristicas:
            info.caracteristicas,
          comentarios: comentariosPartes.join(' | ') || 'Migrado desde MANT-Anexo 5 (2026)'
        });
      }
    }
  }

  return {
    totalFilasAnalizadas,
    filasHerediaDetectadas,
    registrosExtraidos
  };
}


async function ejecutarSeed() {
  console.log('Cargando inventario de la Sede Heredia a Neon PostgreSQL...');

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`[ERROR] No se encontró el archivo Excel en la ruta:\n  ${EXCEL_PATH}`);
    process.exit(1);
  }

  console.log(`[1/4] Leyendo archivo Excel:\n      ${EXCEL_PATH}`);
  const workbook = XLSX.readFile(EXCEL_PATH);

  const {
    totalFilasAnalizadas,
    filasHerediaDetectadas,
    registrosExtraidos
  } = leerFilasExcelHeredia(workbook);

  console.log(`      -> Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
  console.log(`      -> Filas de equipos leídas en el archivo: ${totalFilasAnalizadas}`);
  console.log(`      -> Filas pertenecientes a Sede Heredia:   ${filasHerediaDetectadas}`);
  console.log(`      -> Activos individuales desglosados:      ${registrosExtraidos.length}`);

  const client = await pool.connect();

  let insertados = 0;
  let actualizados = 0;
  let omitidos = 0;

  // Con --actualizar se corrigen los campos descriptivos de placas ya existentes
  // (útil para repetir la carga tras mejorar el mapeo). Sin la bandera, se omiten.
  const ACTUALIZAR = process.argv.includes('--actualizar');
  const clausulaConflicto = ACTUALIZAR
    ? `ON CONFLICT (placa_institucional) DO UPDATE SET
         id_categoria = EXCLUDED.id_categoria,
         nombre = EXCLUDED.nombre,
         numero_serie = EXCLUDED.numero_serie,
         marca = EXCLUDED.marca,
         modelo = EXCLUDED.modelo,
         anio = EXCLUDED.anio,
         caracteristicas = EXCLUDED.caracteristicas,
         comentarios = EXCLUDED.comentarios`
    : 'ON CONFLICT (placa_institucional) DO NOTHING';
  const detalleInsertados = [];
  const detalleOmitidos = [];

  try {
    await client.query('BEGIN');

    // Resolver el usuario técnico/administrador para los triggers trg_historial_estado y trg_historial_ubicacion
    const idUsuarioAuditoria = await resolverUsuarioResponsable(client);
    await client.query("SELECT set_config('app.usuario_id', $1, true)", [
      String(idUsuarioAuditoria)
    ]);

    console.log('\n[2/4] Asegurando catálogos maestros en PostgreSQL (Sede, Estado, Categorías, Laboratorios)...');
    const idSedeHeredia = await asegurarSedeHeredia(client);
    const idEstadoOperativo = await asegurarEstadoOperativo(client);
    const mapaCategorias = await asegurarCategorias(client);
    const mapaLaboratorios = await asegurarLaboratorios(client, idSedeHeredia);

    console.log(`      -> Sede Heredia (id_sede = ${idSedeHeredia})`);
    console.log(`      -> Estado Operativo (id_estado = ${idEstadoOperativo})`);
    console.log(`      -> Categorías aseguradas: ${Object.keys(mapaCategorias).length}`);
    console.log(`      -> Laboratorios asegurados en Heredia: ${Object.keys(mapaLaboratorios).join(', ')}`);

    console.log('\n[3/4] Insertando equipos en public.equipo (ON CONFLICT DO NOTHING)...');

    for (const item of registrosExtraidos) {
      const idLaboratorio = mapaLaboratorios[item.codigoLab];
      const idCategoria = mapaCategorias[item.categoriaNombre];

      const insertQuery = `
        INSERT INTO public.equipo (
          id_laboratorio,
          id_categoria,
          id_estado,
          nombre,
          numero_serie,
          placa_institucional,
          marca,
          modelo,
          anio,
          caracteristicas,
          comentarios,
          ubicacion_detalle
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ${clausulaConflicto}
        RETURNING id_equipo, placa_institucional, nombre, (xmax = 0) AS insertado;
      `;

      const valores = [
        idLaboratorio,
        idCategoria,
        idEstadoOperativo,
        item.nombre,
        item.numero_serie,
        item.placa_institucional,
        item.marca,
        item.modelo,
        item.anio,
        item.caracteristicas,
        item.comentarios,
        item.ubicacion_detalle
      ];

      const resInsert = await client.query(insertQuery, valores);

      if (resInsert.rowCount > 0 && resInsert.rows[0].insertado) {
        insertados++;
        detalleInsertados.push({
          id_equipo: resInsert.rows[0].id_equipo,
          laboratorio: item.codigoLab,
          placa: item.placa_institucional,
          nombre: item.nombre
        });
      } else if (resInsert.rowCount > 0) {
        actualizados++;
      } else {
        omitidos++;
        detalleOmitidos.push({
          origen: item.origen,
          laboratorio: item.codigoLab,
          placa: item.placa_institucional,
          nombre: item.nombre
        });
      }
    }

    await client.query('COMMIT');

    console.log('\n[4/4] Resumen de ejecución del Seeder:');
    console.log('----------------------------------------------------------------------');
    console.log(`  Total de filas leídas en el Excel (ambas hojas) : ${totalFilasAnalizadas}`);
    console.log(`  Filas filtradas de Sede Heredia                 : ${filasHerediaDetectadas}`);
    console.log(`  Total de activos procesados (desglosados)       : ${registrosExtraidos.length}`);
    console.log(`  Equipos insertados exitosamente                 : ${insertados}`);
    console.log(`  Equipos actualizados (--actualizar)             : ${actualizados}`);
    console.log(`  Equipos omitidos (duplicados por placa)         : ${omitidos}`);
    console.log('----------------------------------------------------------------------');

    if (detalleInsertados.length > 0) {
      console.log('\nDetalle de equipos insertados:');
      console.table(detalleInsertados);
    }

    if (detalleOmitidos.length > 0) {
      console.log('\nDetalle de equipos omitidos (placa ya existente):');
      console.table(detalleOmitidos);
    }

    console.log('Carga de inventario completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Se produjo un fallo durante la siembra. Transacción revertida (ROLLBACK):');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutarSeed();

