import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Info, RotateCw, Shuffle } from 'lucide-react'
import type { BaseRow, ListFileAnalysis, MunicipalityConfig, MunicipalitySummary } from '../types'
import { downloadCsv, fmt } from '../utils'
import { allocateViamonteUpms, analyzeMunicipalityDesign, selectSanMartinUpms } from '../design'

interface Props {
  summary: MunicipalitySummary | undefined
  config: MunicipalityConfig | undefined
  baseRows: BaseRow[]
  files: ListFileAnalysis[]
}

interface SelectionRow {
  upm: string
  stratum: string
  radios: number
  listedRadios: number
  available: number
  complete: boolean
  sanMartinEligible: boolean
  capacity: number
  assigned: number
  selected: boolean
  firstNumber: number | null
  lastNumber: number | null
}

export function Simulator({ summary, config, baseRows, files }: Props) {
  const [target, setTarget] = useState(config?.sampleTarget ?? 0)
  const [draw, setDraw] = useState(0)
  const design = useMemo(
    () => analyzeMunicipalityDesign(summary?.code ?? '', target, baseRows, files),
    [baseRows, files, summary?.code, target],
  )
  const selectedSanMartin = useMemo(
    () => selectSanMartinUpms(design, 2026000 + Number(summary?.code ?? 0) + draw * 1009),
    [design, draw, summary?.code],
  )
  const viamonteAllocation = useMemo(() => allocateViamonteUpms(design), [design])
  const rows = useMemo<SelectionRow[]>(() => {
    let nextNumber = (config?.provincialUpms ?? 0) + 1
    return design.sourceUpms.map((item) => {
      const assigned = design.method === 'san_martin'
        ? (selectedSanMartin.has(item.upm) ? 1 : 0)
        : (viamonteAllocation.get(item.upm) ?? 0)
      const firstNumber = assigned > 0 ? nextNumber : null
      const lastNumber = assigned > 0 ? nextNumber + assigned - 1 : null
      nextNumber += assigned
      return {
        upm: item.upm,
        stratum: item.stratum,
        radios: item.radios.length,
        listedRadios: item.listedRadios,
        available: item.available,
        complete: item.complete,
        sanMartinEligible: item.sanMartinEligible,
        capacity: item.viamonteCapacity,
        assigned,
        selected: assigned > 0,
        firstNumber,
        lastNumber,
      }
    })
  }, [config?.provincialUpms, design.method, design.sourceUpms, selectedSanMartin, viamonteAllocation])

  const selectedSources = rows.filter((row) => row.selected).length
  const assignedOperational = rows.reduce((sum, row) => sum + row.assigned, 0)
  const firstMunicipalNumber = assignedOperational ? (config?.provincialUpms ?? 0) + 1 : null
  const lastMunicipalNumber = assignedOperational ? (config?.provincialUpms ?? 0) + assignedOperational : null

  function exportSelection() {
    const method = design.method === 'san_martin' ? 'General San Martín' : 'General Viamonte'
    downloadCsv(`seleccion_upm_${summary?.code ?? 'municipio'}.csv`, rows.filter((row) => row.selected).map((row) => ({
      Codigo_municipio: summary?.code,
      Municipio: summary?.name,
      Metodo: method,
      UPM_fuente: row.upm,
      Estrato: row.stratum,
      Radios_marco: row.radios,
      Radios_con_listado: row.listedRadios,
      Viviendas_validas: row.available,
      UPM_operativas_asignadas: row.assigned,
      Primera_UPM_municipal: row.firstNumber,
      Ultima_UPM_municipal: row.lastNumber,
    })))
  }

  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Diseño municipal</span><h1>Selección de UPM</h1><p>Diagnostica el método y selecciona las UPM correspondientes.</p></div><div className={`status-pill ${design.canSelect ? 'ok' : ''}`}>{design.canSelect ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{design.canSelect ? 'Selección disponible' : 'Requiere revisión'}</div></header>
      <section className="simulator-layout">
        <article className="panel simulator-controls">
          <span className="eyebrow">Parámetros</span><h2>{summary?.name ?? 'Elegí un municipio'}</h2>
          <label>Tamaño de muestra municipal<input type="number" min="1" value={target} onChange={(event) => setTarget(Number(event.target.value))} /></label>
          <label>Viviendas por UPM<input type="number" value={20} disabled /></label>
          <div className="formula-box"><span>UPM operativas requeridas</span><strong>{fmt.format(design.requiredOperationalUpms)}</strong><small>objetivo operativo: {fmt.format(design.operationalTarget)} viviendas</small></div>
          <div className="info-note"><Info size={17} /><p>El valor inicial proviene del archivo definitivo de tamaños de muestra. Podés cambiarlo para probar otro escenario.</p></div>
          {design.method === 'san_martin' && <button className="primary-button full-button" onClick={() => setDraw((value) => value + 1)}><Shuffle size={16} /> Sortear nuevamente</button>}
          <button className="secondary-button full-button" disabled={!design.canSelect || assignedOperational === 0} onClick={exportSelection}><Download size={16} /> Exportar selección</button>
        </article>
        <article className="panel simulation-result">
          <div className="panel-title"><div><span className="eyebrow">Diagnóstico</span><h2>{design.methodLabel}</h2></div><div className="source-pill"><RotateCw size={16} /> Rotación 25% · 10 años</div></div>
          <div className={`method-explanation ${design.method}`}><strong>{design.canSelect ? 'La selección se puede realizar.' : 'La selección no se puede completar.'}</strong><p>{design.reason}</p></div>
          <div className="simulation-kpis four"><div><span>UPM fuente</span><strong>{fmt.format(design.sourceUpms.length)}</strong><small>{design.completeSourceUpms} con cobertura completa</small></div><div><span>Aptas tipo San Martín</span><strong>{fmt.format(design.sanMartinEligibleUpms)}</strong><small>mínimo 65 viviendas y cobertura completa</small></div><div><span>Capacidad tipo Viamonte</span><strong>{fmt.format(design.viamonteCapacity)}</strong><small>UPM operativas de 20</small></div><div><span>Resultado</span><strong>{fmt.format(assignedOperational)}</strong><small>{selectedSources} UPM fuente participan</small></div></div>
          {assignedOperational > 0 && <div className="selection-numbering"><span>Numeración municipal</span><strong>{firstMunicipalNumber === lastMunicipalNumber ? firstMunicipalNumber : `${firstMunicipalNumber} a ${lastMunicipalNumber}`}</strong><small>continúa después de {config?.provincialUpms ?? 0} UPM provinciales</small></div>}
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>UPM fuente</th><th>Estrato</th><th className="number">Radios</th><th className="number">Con listado</th><th className="number">Viviendas válidas</th><th>Cobertura</th><th>Apta 20×4</th><th className="number">Capacidad</th><th className="number">UPM asignadas</th><th>Numeración</th></tr></thead><tbody>{rows.map((row) => <tr key={row.upm} className={row.selected ? 'selected-row' : ''}><td><strong>{row.upm}</strong></td><td><span className="cluster-tag">{row.stratum}</span></td><td className="number">{row.radios}</td><td className="number">{row.listedRadios}</td><td className="number">{fmt.format(row.available)}</td><td>{row.complete ? <span className="mini-status ok">Completa</span> : <span className="mini-status warn">Incompleta</span>}</td><td>{row.sanMartinEligible ? <span className="mini-status ok">Sí</span> : <span className="mini-status muted">No</span>}</td><td className="number">{row.capacity}</td><td className="number"><strong>{row.assigned}</strong></td><td>{row.firstNumber === null ? '—' : row.firstNumber === row.lastNumber ? row.firstNumber : `${row.firstNumber}–${row.lastNumber}`}</td></tr>)}</tbody></table>{!rows.length && <div className="empty-state">No hay UPM fuente en el marco municipal.</div>}</div>
        </article>
      </section>
    </>
  )
}
