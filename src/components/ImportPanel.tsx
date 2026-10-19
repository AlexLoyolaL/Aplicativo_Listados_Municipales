import { useRef, useState } from 'react'
import { Database, FilePlus2, FolderOpen, HardDrive, RotateCcw, Trash2, UploadCloud } from 'lucide-react'
import type { BaseMetadata, ListFileAnalysis } from '../types'
import { fmt } from '../utils'

interface Props {
  metadata: BaseMetadata | null
  files: ListFileAnalysis[]
  busy: string
  error: string
  hasOverride: boolean
  onFiles: (files: File[]) => void
  onBase: (file: File) => void
  onRemove: (file: ListFileAnalysis) => void
  onClear: () => void
  onResetBase: () => void
}

export function ImportPanel({ metadata, files, busy, error, hasOverride, onFiles, onBase, onRemove, onClear, onResetBase }: Props) {
  const listInput = useRef<HTMLInputElement>(null)
  const baseInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  async function chooseDirectory() {
    if (!window.showDirectoryPicker) {
      listInput.current?.click()
      return
    }
    try {
      const handle = await window.showDirectoryPicker()
      const selected: File[] = []
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /^TB_.*_LISTADO_TOTAL\.xls(x)?$/i.test(entry.name)) selected.push(await entry.getFile())
      }
      onFiles(selected)
    } catch (event) {
      if ((event as DOMException).name !== 'AbortError') listInput.current?.click()
    }
  }

  function acceptDropped(list: FileList | null) {
    const selected = [...(list ?? [])].filter((file) => /\.xls(x)?$/i.test(file.name))
    if (selected.length) onFiles(selected)
  }

  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Administración local</span><h1>Archivos de trabajo</h1><p>Los datos se procesan dentro de este navegador y quedan guardados solo en esta computadora.</p></div><div className="source-pill"><HardDrive size={16} /> Almacenamiento local</div></header>
      <section className="file-grid">
        <article className="panel source-card">
          <div className="source-card-icon"><Database /></div>
          <div><span className="eyebrow">Base maestra</span><h2>{metadata?.sourceFile ?? 'Cargando…'}</h2><p>{metadata ? `${fmt.format(metadata.rowCount)} registros · ${metadata.columnCount} columnas · hoja ${metadata.sheet}` : 'Preparando la base JSON'}</p><small>{hasOverride ? 'Base reemplazada localmente' : 'Base JSON incluida con la aplicación'}</small></div>
          <div className="source-actions"><button className="secondary-button" onClick={() => baseInput.current?.click()}><FilePlus2 size={16} /> Reemplazar Excel</button>{hasOverride && <button className="icon-button" title="Volver a la base incluida" onClick={onResetBase}><RotateCcw size={17} /></button>}</div>
          <input ref={baseInput} hidden type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && onBase(event.target.files[0])} />
        </article>
        <article className="panel privacy-card"><div className="source-card-icon shield"><HardDrive /></div><div><span className="eyebrow">Privacidad</span><h2>No hay servidor</h2><p>No se configuran cuentas, APIs, analítica ni sincronización. Borrar los datos del navegador elimina las importaciones guardadas.</p></div></article>
      </section>

      <section className="panel import-panel">
        <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptDropped(event.dataTransfer.files) }}>
          <div className="upload-icon"><UploadCloud /></div><h2>Agregar TB_LISTADO_TOTAL</h2><p>Podés elegir toda la carpeta o varios archivos .xls/.xlsx. Se guardan resúmenes, no copias de los archivos originales.</p>
          <div className="drop-actions"><button className="primary-button" onClick={chooseDirectory}><FolderOpen size={17} /> Elegir carpeta</button><button className="secondary-button" onClick={() => listInput.current?.click()}><FilePlus2 size={17} /> Elegir archivos</button></div>
          <input ref={listInput} hidden type="file" multiple accept=".xlsx,.xls" onChange={(event) => acceptDropped(event.target.files)} />
          {busy && <div className="progress-note"><span className="spinner" />{busy}</div>}
          {error && <div className="error-note">{error}</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><div><span className="eyebrow">Inventario</span><h2>{files.length} listados disponibles</h2></div>{files.some((file) => !file.bundled) && <button className="danger-button" onClick={onClear}><Trash2 size={16} /> Borrar importados</button>}</div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Municipio</th><th>Archivo</th><th className="number">Filas</th><th className="number">Válidas</th><th className="number">Inválidas</th><th className="number">Duplicadas exactas</th><th>Origen</th><th /></tr></thead><tbody>{files.slice().sort((a, b) => a.municipalityCode.localeCompare(b.municipalityCode)).map((file) => <tr key={`${file.municipalityCode}-${file.fileName}`}><td><span className="cluster-tag">{file.municipalityCode || '—'}</span></td><td><strong>{file.fileName}</strong></td><td className="number">{fmt.format(file.totalRows)}</td><td className="number">{fmt.format(file.validRows)}</td><td className="number">{fmt.format(file.invalidRows)}</td><td className="number">{fmt.format(file.duplicateRows)}</td><td>{file.bundled ? <span className="mini-status ok">Precargado</span> : <span className="mini-status">Importado</span>}</td><td>{!file.bundled && <button className="icon-button" title="Quitar resumen" onClick={() => onRemove(file)}><Trash2 size={16} /></button>}</td></tr>)}</tbody></table>{!files.length && <div className="empty-state">Todavía no hay listados. Elegí la carpeta “Listados Originales”.</div>}</div>
      </section>
    </>
  )
}
