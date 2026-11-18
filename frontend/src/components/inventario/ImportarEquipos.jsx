import { useEffect, useRef, useState } from 'react';

import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import {
  leerArchivoEquipos,
  confirmarImportacionEquipos,
} from '../../services/importacionEquiposService';

import AdjuntarFotos from './AdjuntarFotos';
import { MAX_FOTOS_EQUIPO } from '../../utils/limitesFotos';
import { agregarFoto } from '../../services/fotosEquipoService';
import '../../styles/fotosEquipos.css';
import { generarPaginas } from '../../utils/inventario';

import '../../styles/importarEquipos.css';

const POR_PAGINA = 5;

const CAMPOS_TEXTO = [
  { campo: 'nombre', etiqueta: 'Nombre del equipo', max: 150 },
  { campo: 'placa_institucional', etiqueta: 'Placa institucional', max: 100 },
  { campo: 'numero_serie', etiqueta: 'Número de serie', max: 100 },
  { campo: 'marca', etiqueta: 'Marca', max: 100 },
  { campo: 'modelo', etiqueta: 'Modelo', max: 100 },
  { campo: 'ubicacion_detalle', etiqueta: 'Ubicación detallada', max: 255 },
];

export default function ImportarEquipos({
  abierto,
  token,
  onCerrar,
  onImportados,
}) {
  const dialogoRef = useRef(null);
  const operandoRef = useRef(false);

  const [arrastrando, setArrastrando] = useState(false);
  const [avisosFotos, setAvisosFotos] = useState([]);
  const [fotosPendientes, setFotosPendientes] = useState([]);
  const [valoresComunes, setValoresComunes] = useState({});
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState([]);
  const [catalogos, setCatalogos] = useState({
    categorias: [],
    estados: [],
    laboratorios: [],
  });

  const [seleccionadas, setSeleccionadas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paso, setPaso] = useState('archivo');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);

useEffect(() => {
  const dialogo = dialogoRef.current;

  if (!dialogo) return;

  if (abierto && !dialogo.open) {
    dialogo.showModal();
  } else if (!abierto && dialogo.open) {
    dialogo.close();
  }

  return () => {
    if (dialogo.open) {
      dialogo.close();
    }
  };
}, [abierto]);
  useEffect(() => { if (abierto) dialogoRef.current?.querySelector('h2')?.focus(); }, [paso, abierto]);
  useEffect(() => { if (error) dialogoRef.current?.querySelector('[role="alert"]')?.focus(); }, [error]);
  function cerrar() {
    if (operandoRef.current) return;
    onCerrar?.();
  }

  async function leerArchivo() {
    if (operandoRef.current) return;

    if (!archivo) {
      setError('Seleccione un archivo Excel.');
      return;
    }

    if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
      setError('El archivo debe tener extensión .xlsx.');
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      setError('El archivo no puede superar 5 MB.');
      return;
    }

    operandoRef.current = true;
    setOcupado(true);
    setError('');

    try {
      const resultado = await leerArchivoEquipos(archivo, token);

      setFilas(
        resultado.filas.map((fila) => ({
          ...fila,
          modificado: false,
          adjuntos: [],
        }))
      );

      setCatalogos(resultado.catalogos);
      setAvisosFotos(resultado.avisos_fotos || []);
      setSeleccionadas(
        resultado.filas.map((fila) => fila.fila)
      );

      setPagina(1);
      setPaso('revision');
    } catch (err) {
      setError(err.message);
    } finally {
      operandoRef.current = false;
      setOcupado(false);
    }
  }

  function cambiarCampo(numeroFila, campo, valor) {
    setFilas((anteriores) =>
      anteriores.map((fila) =>
        fila.fila === numeroFila
          ? {
              ...fila,
              [campo]: valor,
              modificado: true,
            }
          : fila
      )
    );
  }

  function seleccionarFila(numeroFila, seleccionada) {
    setSeleccionadas((anteriores) =>
      seleccionada
        ? [...new Set([...anteriores, numeroFila])]
        : anteriores.filter((numero) => numero !== numeroFila)
    );
  }

  function nombreCatalogo(lista, campoId, id) {
    return lista.find((elemento) => elemento[campoId] === id)?.nombre;
  }

  async function guardarFotos(cola) {
    const pendientes = [];
    for (const foto of cola) {
      try { await agregarFoto(foto.id, foto.archivo, token); }
      catch (error) { pendientes.push({...foto, error:error.message}); }
    }
    setFotosPendientes(pendientes);
    return pendientes;
  }
  async function reintentarFotos() {
    if (operandoRef.current) return;
    operandoRef.current = true; setOcupado(true);
    try { await guardarFotos(fotosPendientes); }
    finally { operandoRef.current = false; setOcupado(false); }
  }
  async function confirmar() {
    if (operandoRef.current) return;

    const elegidas = filas.filter((fila) =>
      seleccionadas.includes(fila.fila)
    );

    if (elegidas.length === 0) {
      setError('Seleccione al menos un equipo.');
      return;
    }

    const datos = elegidas.map((fila) => ({
      fila: fila.fila,
      nombre: String(fila.nombre ?? '').trim(),
      numero_serie: String(fila.numero_serie ?? '').trim() || null,
      placa_institucional:
        String(fila.placa_institucional ?? '').trim() || null,
      marca: String(fila.marca ?? '').trim() || null,
      modelo: String(fila.modelo ?? '').trim() || null,
      anio: fila.anio === '' || fila.anio == null
        ? null
        : fila.anio,
      caracteristicas:
        String(fila.caracteristicas ?? '').trim() || null,
      comentarios:
        String(fila.comentarios ?? '').trim() || null,
      ubicacion_detalle:
        String(fila.ubicacion_detalle ?? '').trim() || null,
      id_categoria: fila.id_categoria,
      id_estado: fila.id_estado,
      id_laboratorio: fila.id_laboratorio,
    }));

    operandoRef.current = true;
    setOcupado(true);
    setError('');

    try {
      const comprobacion = await confirmarImportacionEquipos(datos, token, true);
      const revisadas = comprobacion.data.filas;
      if (revisadas.some(f => f.errores.length)) {
        setFilas(anteriores => anteriores.map(f => {
          const revisada = revisadas.find(r => r.fila === f.fila);
          return revisada ? {...f, errores:revisada.errores, modificado:false} : f;
        }));
        setError('Hay equipos seleccionados con errores. Corríjalos o desmárquelos para continuar.');
        return;
      }
      const resultado = await confirmarImportacionEquipos(datos, token);
      const cola = [];
      for (const guardado of resultado.data.resultados.filter(f => f.importado)) {
        const fila = elegidas.find(f => f.fila === guardado.fila);
        for (const imagen of fila.imagenes || []) {
          const bytes = Uint8Array.from(atob(imagen.base64), c => c.charCodeAt(0));
          cola.push({id:guardado.id_equipo, nombre:fila.nombre, archivo:new File([bytes], imagen.nombre, {type:imagen.mime})});
        }
        for (const archivo of fila.adjuntos || []) cola.push({id:guardado.id_equipo, nombre:fila.nombre, archivo});
      }
      await guardarFotos([...fotosPendientes, ...cola]);

      const resultados = resultado.data.resultados;

      const importadas = new Set(
        resultados
          .filter((fila) => fila.importado)
          .map((fila) => fila.fila)
      );

      const erroresPorFila = new Map(
        resultados
          .filter((fila) => !fila.importado)
          .map((fila) => [fila.fila, fila.errores])
      );

      // Retirar las filas ya guardadas para que no se vuelvan
      // a enviar al corregir las que tuvieron errores.
      setFilas((anteriores) =>
        anteriores
          .filter((fila) => !importadas.has(fila.fila))
          .map((fila) =>
            erroresPorFila.has(fila.fila)
              ? {
                  ...fila,
                  errores: erroresPorFila.get(fila.fila),
                  modificado: false,
                }
              : fila
          )
      );

      setSeleccionadas(
        resultados
          .filter((fila) => !fila.importado)
          .map((fila) => fila.fila)
      );

      setResumen({
        mensaje: resultado.message,
        importados: resultado.data.importados,
        rechazados: resultado.data.rechazados,
      });

      setPagina(1);
      setPaso('resultado');

      if (resultado.data.importados > 0) {
        onImportados?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      operandoRef.current = false;
      setOcupado(false);
    }
  }

  const totalPaginas = Math.max(
    1,
    Math.ceil(filas.length / POR_PAGINA)
  );

  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const visibles = filas.slice(inicio, inicio + POR_PAGINA);
  const todasSeleccionadas =
    filas.length > 0 &&
    filas.every((fila) => seleccionadas.includes(fila.fila));

  const erroresPendientes = filas.filter(
    (fila) => fila.errores?.length > 0
  ).length;

  return (
    <dialog
      ref={dialogoRef}
      className="imp-dialogo"
      aria-labelledby="imp-titulo"
      onCancel={(evento) => {
        evento.preventDefault();
        cerrar();
      }}
    >
      <div className="imp-encabezado">
        <div>
          <h2 id="imp-titulo" tabIndex={-1}>
            {paso === 'archivo'
              ? 'Importar equipos'
              : paso === 'revision'
                ? 'Revisar equipos'
                : 'Resultado de la importación'}
          </h2>

          <p>
            {paso === 'archivo'
              ? 'Seleccione un Excel para revisar sus datos antes de guardarlos.'
              : paso === 'revision'
                ? 'Corrija los campos y seleccione los equipos que desea importar.'
                : 'Los equipos guardados se han retirado de la revisión.'}
          </p>
        </div>

        <button
          type="button"
          className="imp-cerrar"
          aria-label="Cerrar importación"
          disabled={ocupado}
          onClick={cerrar}
        >
          <X size={20} />
        </button>
      </div>

      <ol className="imp-pasos" aria-label="Pasos de importación">{[['archivo','1. Elegir Excel'],['revision','2. Revisar datos y fotos'],['resultado','3. Resultado']].map(([id,texto]) => <li key={id} aria-current={paso===id?'step':undefined}>{texto}</li>)}</ol>
      {avisosFotos.length > 0 && <details><summary>Avisos sobre imágenes ({avisosFotos.length})</summary><ul>{avisosFotos.map((aviso,i)=><li key={i}>{aviso}</li>)}</ul></details>}
      {error && (
        <div className="imp-alerta imp-error" role="alert" tabIndex={-1}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {paso === 'archivo' && (
        <>
          <div className={`imp-carga ${arrastrando ? 'imp-carga-activa' : ''}`}
            onDragOver={e=>{e.preventDefault();if(!ocupado)setArrastrando(true);}}
            onDragLeave={()=>setArrastrando(false)}
            onDrop={e=>{e.preventDefault();setArrastrando(false);if(ocupado)return;
              if(e.dataTransfer.files.length!==1){setError('Arrastre un único archivo Excel.');return;}
              setArchivo(e.dataTransfer.files[0]);setError('');}}>
            <FileSpreadsheet size={38} aria-hidden="true" />

            <label htmlFor="imp-archivo">
              Arrastre su Excel aquí o selecciónelo
            </label>

            <input
              id="imp-archivo"
              name="archivo"
              type="file"
              accept=".xlsx"
              disabled={ocupado}
              onChange={(evento) => {
                setArchivo(evento.target.files?.[0] ?? null);
                setError('');
              }}
            />

            <p role="status">{archivo ? `Seleccionado: ${archivo.name}` : "Ningún archivo seleccionado"}</p>
            <p>
              Formato .xlsx · Máximo 5 MB y 200 equipos.
            </p>
          </div>

          <div className="imp-instrucciones">
            <p>
              Se leerá la hoja <strong>Inventario</strong>.
              Las filas que solo tengan numeración se ignorarán.
            </p>

            <p>
              Categoría, estado y laboratorio podrán seleccionarse
              en la revisión. Extraeremos las fotos pegadas en la hoja y podrá adjuntar más a cada equipo.
            </p>

            <p>
              Cada foto se asocia a la fila donde comienza su esquina superior izquierda. Revise la asociación antes de guardar. Los tickets no se importan.
            </p>
          </div>
        </>
      )}

      {paso === 'revision' && (
        <>
          <div className="imp-resumen">
            <span>{filas.length} equipos por revisar</span>
            <span>{seleccionadas.length} seleccionados</span>
            <span>{erroresPendientes} con observaciones</span>
          </div>

          <details className="imp-valores-comunes">
            <summary>Completar campos vacíos de varios equipos a la vez</summary>
            <p>Elija valores comunes y aplíquelos a los equipos seleccionados. Los datos que ya tengan un valor se conservan.</p>
            <div className="imp-campos">
              {[
                ['id_categoria', 'Categoría', catalogos.categorias],
                ['id_estado', 'Estado', catalogos.estados],
                ['id_laboratorio', 'Laboratorio', catalogos.laboratorios],
              ].map(([campo, etiqueta, opciones]) => <div className="imp-campo" key={campo}>
                <label htmlFor={`comun-${campo}`}>{etiqueta}</label>
                <select id={`comun-${campo}`} name={campo} disabled={ocupado} value={valoresComunes[campo] || ''}
                  onChange={e => setValoresComunes(v => ({...v, [campo]:Number(e.target.value) || null}))}>
                  <option value="">Sin cambios</option>
                  {opciones.map(o => <option key={o[campo]} value={o[campo]}>{o.nombre_sede ? `${o.nombre_sede} · ` : ''}{o.nombre}</option>)}
                </select>
              </div>)}
            </div>
            <button type="button" className="btn btn-contorno" disabled={ocupado} onClick={() => setFilas(anteriores => anteriores.map(f => {
              if (!seleccionadas.includes(f.fila)) return f;
              const cambios = Object.fromEntries(Object.entries(valoresComunes).filter(([campo,valor]) => valor && !f[campo]));
              return Object.keys(cambios).length ? {...f,...cambios,modificado:true} : f;
            }))}>Aplicar a campos vacíos seleccionados</button>
          </details>

          <div className="imp-seleccion">
            <label>
              <input
                type="checkbox"
                checked={todasSeleccionadas}
                disabled={ocupado}
                onChange={(evento) =>
                  setSeleccionadas(
                    evento.target.checked
                      ? filas.map((fila) => fila.fila)
                      : []
                  )
                }
              />
              Seleccionar todos
            </label>

            <small>
              Se guardarán únicamente los equipos seleccionados
              que superen la validación del servidor.
            </small>
          </div>

          <fieldset
            className="imp-lista"
            disabled={ocupado}
          ><legend>Equipos del archivo</legend>
            {visibles.map((fila) => (
              <article className="imp-equipo" key={fila.fila}>
                <div className="imp-equipo-encabezado">
                  <label className="imp-equipo-seleccion">
                    <input
                      type="checkbox"
                      checked={seleccionadas.includes(fila.fila)}
                      onChange={(evento) =>
                        seleccionarFila(
                          fila.fila,
                          evento.target.checked
                        )
                      }
                    />

                    <span>
                      <strong>
                        {fila.nombre || 'Equipo sin nombre'}
                      </strong>
                      <small>
                        Fila {fila.fila} ·{' '}
                        {fila.placa_institucional || 'Sin placa'}
                      </small>
                    </span>
                  </label>

                  <span
                    className={
                      fila.modificado
                        ? 'imp-etiqueta'
                        : fila.errores?.length
                          ? 'imp-etiqueta imp-etiqueta-error'
                          : 'imp-etiqueta imp-etiqueta-valido'
                    }
                  >
                    {fila.modificado
                      ? 'Pendiente de revalidar'
                      : fila.errores?.length
                        ? 'Requiere revisión'
                        : 'Validación inicial correcta'}
                  </span>
                </div>

                {!fila.modificado && fila.errores?.length > 0 && (
                  <ul className="imp-errores-fila">
                    {fila.errores.map((mensaje, indice) => (
                      <li key={indice}>{mensaje}</li>
                    ))}
                  </ul>
                )}

                <p className="imp-datos-resumen">
                  {nombreCatalogo(
                    catalogos.categorias,
                    'id_categoria',
                    fila.id_categoria
                  ) || 'Sin categoría'}
                  {' · '}
                  {nombreCatalogo(
                    catalogos.estados,
                    'id_estado',
                    fila.id_estado
                  ) || 'Sin estado'}
                  {' · '}
                  {nombreCatalogo(
                    catalogos.laboratorios,
                    'id_laboratorio',
                    fila.id_laboratorio
                  ) || 'Sin laboratorio'}
                </p>

                <details className="imp-fotos-revision"><summary>Fotos ({(fila.imagenes?.length || 0)+(fila.adjuntos?.length || 0)}) · Ver, agregar o quitar</summary>
                  <div className="fotos-galeria">{(fila.imagenes || []).map((imagen,i)=><figure key={i}>
                    <img src={`data:${imagen.mime};base64,${imagen.base64}`} alt={`Foto extraída del Excel para ${fila.nombre || 'este equipo'}`} />
                    <figcaption>{imagen.nombre}</figcaption><button type="button" onClick={()=>setFilas(anteriores=>anteriores.map(f=>f.fila===fila.fila?{...f,imagenes:f.imagenes.filter((_,n)=>n!==i)}:f))}>Quitar foto del Excel</button>
                  </figure>)}</div>
                  <AdjuntarFotos archivos={fila.adjuntos || []} disabled={ocupado} onChange={archivos=>{
                    if(archivos.length+(fila.imagenes?.length||0)>MAX_FOTOS_EQUIPO){setError(`Máximo ${MAX_FOTOS_EQUIPO} fotos por equipo, contando las del Excel.`);return;}
                    setFilas(anteriores=>anteriores.map(f=>f.fila===fila.fila?{...f,adjuntos:archivos}:f));
                  }}/>
                </details>
                <details className="imp-detalles">
                  <summary>Ver y editar datos</summary>

                  {Object.values(fila.originales || {}).some(Boolean) && (
                    <div className="imp-originales">
                      <strong>Datos originales del archivo</strong>

                      {Object.entries(fila.originales)
                        .filter(([, valor]) => Boolean(valor))
                        .map(([campo, valor]) => (
                          <p key={campo}>
                            <span>
                              {campo === 'anio_modelo'
                                ? 'Año y modelo'
                                : campo === 'categoria'
                                  ? 'Categoría'
                                  : campo === 'laboratorio'
                                    ? 'Laboratorio'
                                    : campo === 'sede'
                                      ? 'Sede'
                                      : 'Estado'}
                              :
                            </span>{' '}
                            {valor}
                          </p>
                        ))}
                    </div>
                  )}

                  <div className="imp-campos">
                    {CAMPOS_TEXTO.map(
                      ({ campo, etiqueta, max }) => (
                        <label className="imp-campo" key={campo}>
                          <span>
                            {etiqueta}
                            {campo === 'nombre' ? ' *' : ''}
                          </span>

                          <input
                            type="text"
                            maxLength={max}
                            value={fila[campo] ?? ''}
                            onChange={(evento) =>
                              cambiarCampo(
                                fila.fila,
                                campo,
                                evento.target.value
                              )
                            }
                          />
                        </label>
                      )
                    )}

                    <label className="imp-campo">
                      <span>Año</span>

                      <input
                        type="number"
                        min="1900"
                        max="2100"
                        step="1"
                        value={fila.anio ?? ''}
                        onChange={(evento) =>
                          cambiarCampo(
                            fila.fila,
                            'anio',
                            evento.target.value
                          )
                        }
                      />
                    </label>

                    <label className="imp-campo">
                      <span>Categoría *</span>

                      <select
                        value={fila.id_categoria ?? ''}
                        onChange={(evento) =>
                          cambiarCampo(
                            fila.fila,
                            'id_categoria',
                            evento.target.value
                              ? Number(evento.target.value)
                              : null
                          )
                        }
                      >
                        <option value="">Seleccione una categoría</option>

                        {catalogos.categorias.map((categoria) => (
                          <option
                            key={categoria.id_categoria}
                            value={categoria.id_categoria}
                          >
                            {categoria.nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="imp-campo">
                      <span>Estado *</span>

                      <select
                        value={fila.id_estado ?? ''}
                        onChange={(evento) =>
                          cambiarCampo(
                            fila.fila,
                            'id_estado',
                            evento.target.value
                              ? Number(evento.target.value)
                              : null
                          )
                        }
                      >
                        <option value="">Seleccione un estado</option>

                        {catalogos.estados.map((estado) => (
                          <option
                            key={estado.id_estado}
                            value={estado.id_estado}
                          >
                            {estado.nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="imp-campo">
                      <span>Sede / laboratorio autorizado *</span>

                      <select
                        value={fila.id_laboratorio ?? ''}
                        onChange={(evento) =>
                          cambiarCampo(
                            fila.fila,
                            'id_laboratorio',
                            evento.target.value
                              ? Number(evento.target.value)
                              : null
                          )
                        }
                      >
                        <option value="">Seleccione un laboratorio</option>

                        {catalogos.laboratorios.map((laboratorio) => (
                          <option
                            key={laboratorio.id_laboratorio}
                            value={laboratorio.id_laboratorio}
                          >
                            {laboratorio.nombre_sede}
                            {' · '}
                            {laboratorio.nombre}
                            {' · '}
                            {laboratorio.codigo}
                          </option>
                        ))}
                      </select>
                    </label>

                    {[
                      ['caracteristicas', 'Características'],
                      ['comentarios', 'Comentarios'],
                    ].map(([campo, etiqueta]) => (
                      <label
                        className="imp-campo imp-campo-ancho"
                        key={campo}
                      >
                        <span>{etiqueta}</span>

                        <textarea
                          rows={4}
                          maxLength={10000}
                          value={fila[campo] ?? ''}
                          onChange={(evento) =>
                            cambiarCampo(
                              fila.fila,
                              campo,
                              evento.target.value
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </fieldset>

          <nav
            className="imp-paginacion"
            aria-label="Paginación de equipos por revisar"
          >
            <button
              type="button"
              aria-label="Página anterior"
              disabled={ocupado || paginaActual <= 1}
              onClick={() => setPagina(paginaActual - 1)}
            >
              <ChevronLeft size={15} />
            </button>

            {generarPaginas(paginaActual, totalPaginas).map(
              (numero, indice) =>
                numero === '...' ? (
                  <span key={`puntos-${indice}`}>...</span>
                ) : (
                  <button
                    type="button"
                    key={numero}
                    className={
                      numero === paginaActual ? 'activa' : ''
                    }
                    aria-label={`Ir a la página ${numero}`}
                    aria-current={
                      numero === paginaActual ? 'page' : undefined
                    }
                    disabled={ocupado}
                    onClick={() => setPagina(numero)}
                  >
                    {numero}
                  </button>
                )
            )}

            <button
              type="button"
              aria-label="Página siguiente"
              disabled={ocupado || paginaActual >= totalPaginas}
              onClick={() => setPagina(paginaActual + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </nav>
        </>
      )}

      {paso === 'resultado' && resumen && (
        <div className="imp-resultado" role="status">
          {fotosPendientes.length>0 && <div className="imp-alerta imp-error"><div><strong>Equipos guardados, fotos pendientes: {fotosPendientes.length}</strong>
            <p>Reintente sin importar los equipos de nuevo. Si cierra, podrá agregar las fotos desde el detalle del equipo.</p>
            <ul>{fotosPendientes.map((foto,i)=><li key={i}>{foto.nombre}: {foto.archivo.name} — {foto.error}</li>)}</ul>
            <button type="button" disabled={ocupado} onClick={reintentarFotos}>Reintentar fotos pendientes</button></div></div>}
          {resumen.importados > 0 ? (
            <CheckCircle2 size={38} aria-hidden="true" />
          ) : (
            <AlertCircle size={38} aria-hidden="true" />
          )}

          <h3>{resumen.mensaje}</h3>

          <p>
            {resumen.rechazados > 0
              ? 'Puede volver a la revisión para corregir los equipos rechazados. Los equipos ya importados no se enviarán de nuevo.'
              : 'Los equipos importados ya están disponibles en Inventario.'}
          </p>

          {filas.length > 0 && (
            <p>
              Quedan {filas.length} equipos sin importar,
              incluyendo los que no seleccionó.
            </p>
          )}
        </div>
      )}

      <div className="imp-acciones">
        <button
          type="button"
          className="btn btn-secundario"
          disabled={ocupado}
          onClick={cerrar}
        >
          {paso === 'resultado' ? 'Cerrar' : 'Cancelar'}
        </button>

        {paso === 'archivo' && (
          <button
            type="button"
            className="btn btn-primario"
            disabled={ocupado || !archivo}
            onClick={leerArchivo}
          >
            <Upload size={17} />
            {ocupado ? 'Leyendo archivo...' : 'Leer archivo'}
          </button>
        )}

        {paso === 'revision' && (
          <button
            type="button"
            className="btn btn-primario"
            disabled={ocupado || seleccionadas.length === 0}
            onClick={confirmar}
          >
            {ocupado
              ? 'Comprobando y guardando...'
              : `Comprobar y guardar (${seleccionadas.length})`}
          </button>
        )}

        {paso === 'resultado' && filas.length > 0 && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => {
              setError('');
              setPaso('revision');
            }}
          >
            Revisar pendientes
          </button>
        )}
      </div>
    </dialog>
  );
}
