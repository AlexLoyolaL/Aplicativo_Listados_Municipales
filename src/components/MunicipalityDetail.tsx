import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Database, Download, Home, Layers3, Search, Waypoints } from 'lucide-react'
import type { BaseRow, ListFileAnalysis, MunicipalityConfig, MunicipalitySelectionResult, MunicipalitySummary, PackedBaseData } from '../types'
import { downloadCsv, fmt, isEligibleBaseRow } from '../utils'
import { analyzeMunicipalityDesign } from '../design'

interface Props {
  summary: MunicipalitySummary | undefined
  config: MunicipalityConfig | undefined
  selectionResult: MunicipalitySelectionResult | undefined
  baseRows: BaseRow[]
  files: ListFileAnalysis[]
  fullBase: PackedBaseData | null
  loadingFull: boolean
  onLoadFull: () => void
  onOpenSelection: () => void
}

interface UpmRow {
  upm: string
  stratum: string
  radios: string[]
  mora: number
  listado: number
  selected: boolean
}

export function MunicipalityDetail({ summary, config, selectionResult, baseRows, files, fullBase, loadingFull, onLoadFull, onOpenSelection }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'upm' | 'radio'>('upm')
  const [selectedRadio, setSelectedRadio] = useState('')
  const [showInspector, setShowInspector] = useState(false)
  const rows = useMemo(() => baseRows.filter((row) => row.codpart === summary?.code), [baseRows, summary?.code])
  const eligible = useMemo(() => rows.filter(isEligibleBaseRow), [rows])
  const listRadios = useMemo(() => {
    const map = new Map<string, number>()
    files.forEach((file) => file.radios.forEach((radio) => map.set(radio.codradio, (map.get(radio.codradio) ?? 0) + radio.valid)))
    return map
  }, [files])
  const upms = useMemo(() => {
    const map = new Map<string, UpmRow>()
    eligible.forEach((row) => {
      const current = map.get(row.UPMs_automaticas) ?? { upm: row.UPMs_automaticas, stratum: `C${row.CLUSTER_ID ?? '—'}`, radios: [], mora: 0, listado: 0, selected: false }
      current.radios.push(row.codradio)
      current.mora += row.viviendas_mora_presentes ?? 0
      current.listado += listRadios.get(row.codradio) ?? 0
      current.selected ||= row.UPM_seleccionada === 1 || row.UPM_seleccionada2 === 1
      map.set(current.upm, current)
    })
    return [...map.values()].sort((a, b) => a.upm.localeCompare(b.upm))
  }, [eligible, listRadios])
  const filteredUpms = upms.filter((row) => row.upm.toLowerCase().includes(query.toLowerCase()) || row.stratum.toLowerCase().includes(query.toLowerCase()))
  const filteredRadios = rows.filter((row) => row.codradio.includes(query) || row.localidad.toLowerCase().includes(query.toLowerCase()))
  const firstFile = files[0]
  const eligibleListRadios = new Set(eligible.filter((row) => listRadios.has(row.codradio)).map((row) => row.codradio)).size
  const unmapped = [...listRadios.keys()].filter((code) => !rows.some((row) => row.codradio === code)).length
  const design = useMemo(() => analyzeMunicipalityDesign(summary?.code ?? '', config?.sampleTarget ?? 0, baseRows, files, selectionResult), [baseRows, config?.sampleTarget, files, selectionResult, summary?.code])

  const fullRecord = useMemo(() => {
    if (!fullBase || !selectedRadio) return null
    const index = fullBase.columns.indexOf('codradio')
    const row = fullBase.rows.find((candidate) => String(candidate[index] ?? '') === selectedRadio)
    return row ? Object.fromEntries(fullBase.columns.map((column, i) => [column, row[i]])) : null
  }, [fullBase, selectedRadio])

  function exportCurrentTable() {
    const exportRows = mode === 'upm'
      ? filteredUpms.map((row) => ({ UPM: row.upm, Estrato: row.stratum, Radios: row.radios.join(', '), MORA: row.mora, Listado_valido: row.listado, Diferencia: row.listado - row.mora }))
      : filteredRadios.map((row) => ({ codradio: row.codradio, Fraccion: row.fraccion, Radio: row.radio, Localidad: row.localidad, UPM: row.UPMs_automaticas, MORA: row.viviendas_mora_presentes, Listado_valido: listRadios.get(row.codradio) ?? 0, Apta_municipal: isEligibleBaseRow(row) ? 'Sí' : 'No' }))
    downloadCsv(`${summary?.code ?? 'municipio'}_${mode}.csv`, exportRows)
  }

  if (!summary) return <div className="panel empty-state">No hay un municipio seleccionado.</div>
  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Municipio {summary.code}</span><h1>{summary.name}</h1><p>Conciliación entre la base maestra y los listados de viviendas.</p></div><div className={files.length ? 'status-pill ok' : 'status-pill'}>{files.length ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{files.length ? `${files.length} listado${files.length > 1 ? 's' : ''}` : 'Sin listado cargado'}</div></header>
      <section className={`design-status ${design.method}`}>
        <div><span className="eyebrow">Método de selección</span><h2>{design.methodLabel}</h2><p>{design.reason}</p></div>
        <div className="design-facts"><span><b>{fmt.format(design.requiredOperationalUpms)}</b> UPM requeridas</span><span><b>{fmt.format(design.sanMartinEligibleUpms)}</b> aptas San Martín</span><span><b>{fmt.format(selectionResult?.sourceUpmsMissing ?? 0)}</b> UPM fuente faltantes</span></div>
        <button className="secondary-button" disabled={!design.canSelect} onClick={onOpenSelection}>{design.canSelect ? 'Ver selección' : 'Sin selección'} <ArrowRight size={15} /></button>
      </section>
      <section className="metric-grid detail-metrics">
        <article className="metric-card"><div className="metric-icon green"><Layers3 /></div><div><span>UPM aptas</span><strong>{fmt.format(summary.eligibleUpms)}</strong><small>{fmt.format(summary.eligibleRadios)} radios compuestos</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><Database /></div><div><span>Viviendas MORA</span><strong>{fmt.format(summary.mora)}</strong><small>en radios municipales aptos</small></div></article>
        <article className="metric-card"><div className="metric-icon coral"><Home /></div><div><span>Listado válido</span><strong>{files.length ? fmt.format(summary.listValid) : '—'}</strong><small>{files.length ? `${fmt.format(summary.listRows)} filas totales` : 'cargá el TB_LISTADO_TOTAL'}</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><Waypoints /></div><div><span>Radios del listado aptos</span><strong>{files.length ? fmt.format(eligibleListRadios) : '—'}</strong><small>{unmapped ? `${unmapped} sin correspondencia` : 'todos vinculados con la base'}</small></div></article>
      </section>

      {firstFile && <section className="explain-strip"><AlertCircle size={19} /><div><strong>Cómo leer los radios del listado</strong><p>La columna RADIO sola tiene <b>{firstFile.simpleRadioCount}</b> valores distintos. La clave correcta FRACCIÓN + RADIO tiene <b>{firstFile.compositeRadioCount}</b> combinaciones; al cruzarlas con la base quedan <b>{eligibleListRadios}</b> radios municipales aptos.</p></div></section>}

      <section className="panel">
        <div className="table-toolbar">
          <div className="segmented"><button className={mode === 'upm' ? 'active' : ''} onClick={() => setMode('upm')}>Por UPM</button><button className={mode === 'radio' ? 'active' : ''} onClick={() => setMode('radio')}>Por radio</button></div>
          <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar UPM, estrato, radio…" /></label>
          <button className="secondary-button" onClick={exportCurrentTable}><Download size={16} /> CSV</button>
        </div>
        <div className="data-table-wrap">
          {mode === 'upm' ? <table className="data-table"><thead><tr><th>UPM fuente</th><th>Estrato</th><th>Radios</th><th className="number">MORA</th><th className="number">Listado válido</th><th className="number">Diferencia</th><th>Lectura</th></tr></thead><tbody>{filteredUpms.map((row) => { const difference = row.listado - row.mora; return <tr key={row.upm}><td><strong>{row.upm}</strong></td><td><span className="cluster-tag">{row.stratum}</span></td><td>{row.radios.map((r) => r.slice(-4)).join(', ')}</td><td className="number">{fmt.format(row.mora)}</td><td className="number">{files.length ? fmt.format(row.listado) : '—'}</td><td className={`number ${difference < 0 ? 'negative' : difference > 0 ? 'positive' : ''}`}>{files.length ? `${difference > 0 ? '+' : ''}${fmt.format(difference)}` : '—'}</td><td>{!files.length ? <span className="muted">Sin cruce</span> : row.listado >= 20 ? <span className="mini-status ok">Operativa</span> : <span className="mini-status warn">Menos de 20</span>}</td></tr>})}</tbody></table> : <table className="data-table"><thead><tr><th>Codradio</th><th>Fracción</th><th>Radio</th><th>Localidad</th><th>UPM</th><th className="number">MORA</th><th className="number">Listado válido</th><th>Marco</th></tr></thead><tbody>{filteredRadios.map((row) => <tr key={row.codradio}><td><button className="link-button" onClick={() => { setSelectedRadio(row.codradio); setShowInspector(true) }}>{row.codradio}</button></td><td>{String(row.fraccion ?? '—')}</td><td>{String(row.radio ?? '—')}</td><td>{row.localidad || '—'}</td><td>{row.UPMs_automaticas || '—'}</td><td className="number">{fmt.format(row.viviendas_mora_presentes ?? 0)}</td><td className="number">{files.length ? fmt.format(listRadios.get(row.codradio) ?? 0) : '—'}</td><td>{isEligibleBaseRow(row) ? <span className="mini-status ok">Municipal apto</span> : <span className="mini-status muted">Fuera del marco</span>}</td></tr>)}</tbody></table>}
        </div>
      </section>

      <section className="panel inspector-panel">
        <button className="inspector-toggle" onClick={() => setShowInspector(!showInspector)}><div><span className="eyebrow">66 columnas disponibles</span><h2>Ficha completa de un radio</h2></div><ChevronDown className={showInspector ? 'rotated' : ''} /></button>
        {showInspector && <div className="inspector-body">
          <label>Radio<select value={selectedRadio} onChange={(event) => setSelectedRadio(event.target.value)}><option value="">Elegir…</option>{rows.map((row) => <option key={row.codradio} value={row.codradio}>{row.codradio} · {row.localidad}</option>)}</select></label>
          {!fullBase && <button className="primary-button" disabled={loadingFull} onClick={onLoadFull}>{loadingFull ? 'Cargando JSON completo…' : 'Cargar ficha completa'}</button>}
          {fullRecord && <div className="record-grid">{Object.entries(fullRecord).map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value ?? '—')}</strong></div>)}</div>}
          {fullBase && selectedRadio && !fullRecord && <div className="empty-state">No se encontró este radio en el JSON completo.</div>}
        </div>}
      </section>
    </>
  )
}
