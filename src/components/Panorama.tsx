import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Database, Home, ListChecks, Map as MapIcon, Scale } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BaseRow, MunicipalitySelectionResult, MunicipalitySummary } from '../types'
import { countUpmsByLocalitySize, fmt } from '../utils'
import { ProvinceMap } from './ProvinceMap'

interface Props {
  summaries: MunicipalitySummary[]
  selectedCode: string
  onSelect: (code: string) => void
  onOpenMunicipality: () => void
  baseRows: BaseRow[]
  selectionResults: MunicipalitySelectionResult[]
}

export function Panorama({ summaries, selectedCode, onSelect, onOpenMunicipality, baseRows, selectionResults }: Props) {
  const populationCounts = useMemo(() => countUpmsByLocalitySize(baseRows), [baseRows])
  const diagnostics = useMemo(() => {
    const resultByMunicipality = new Map(selectionResults.map((result) => [result.code, result]))
    return summaries.map((summary) => {
      return { summary, result: resultByMunicipality.get(summary.code) }
    })
  }, [selectionResults, summaries])

  const sanMartin = diagnostics.filter((item) => item.result?.method === 'san_martin')
  const viamonte = diagnostics.filter((item) => item.result?.method === 'viamonte')
  const deficit = diagnostics.filter((item) => item.result?.method === 'deficit')
  const errors = diagnostics.filter((item) => !item.result || item.result.method === 'error')
  const chartData = summaries.filter((item) => item.hasList).sort((a, b) => b.listValid - a.listValid).slice(0, 8).map((item) => ({ name: item.name, listado: item.listValid, mora: item.mora }))
  const methodGroups = [
    {
      key: 'san-martin',
      title: 'Método San Martín',
      subtitle: 'Ponderación y sorteo de un subconjunto de UPM.',
      items: sanMartin,
    },
    {
      key: 'viamonte',
      title: 'Método Viamonte',
      subtitle: 'Se usan todas las UPM fuente disponibles.',
      items: viamonte,
    },
    {
      key: 'deficit',
      title: 'Déficit UPM + viviendas',
      subtitle: 'Se usan las UPM recibidas y se agregan viviendas proporcionalmente.',
      items: deficit,
    },
  ]

  function openMunicipality(code: string) {
    onSelect(code)
    onOpenMunicipality()
  }

  return (
    <>
      <header className="page-heading">
        <div><span className="eyebrow">Visión general</span><h1>Explorador municipal</h1><p>Inventario de UPM y método operativo de los 135 municipios.</p></div>
        <div className="source-pill"><Database size={16} /> {fmt.format(selectionResults.length - errors.length)} diseños generados · {fmt.format(errors.length)} con error</div>
      </header>
      <section className="metric-grid panorama-metrics">
        <article className="metric-card"><div className="metric-icon green"><MapIcon /></div><div><span>Municipios en la base</span><strong>{fmt.format(summaries.length)}</strong><small>{fmt.format(baseRows.length)} radios</small></div></article>
        <article className="metric-card"><div className="metric-icon coral"><Home /></div><div><span>UPM en loc. de 5.000 y más</span><strong>{fmt.format(populationCounts.over5000)}</strong><small>UPM únicas de la base</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><Home /></div><div><span>UPM en loc. de menos de 2.000</span><strong>{populationCounts.hasUnder2000Classification ? fmt.format(populationCounts.under2000) : '—'}</strong><small>{populationCounts.hasUnder2000Classification ? 'UPM únicas de la base' : 'la base importada no trae la variable'}</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><Scale /></div><div><span>Método San Martín</span><strong>{fmt.format(sanMartin.length)}</strong><small>municipios con ponderación</small></div></article>
        <article className="metric-card"><div className="metric-icon green"><ListChecks /></div><div><span>Método Viamonte</span><strong>{fmt.format(viamonte.length)}</strong><small>usan todas las UPM disponibles</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><AlertTriangle /></div><div><span>Déficit UPM + viviendas</span><strong>{fmt.format(deficit.length)}</strong><small>usan UPM recibidas y agregan viviendas</small></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel map-panel">
          <div className="panel-title"><div><span className="eyebrow">Provincia de Buenos Aires</span><h2>Partidos</h2></div><button className="text-button" onClick={onOpenMunicipality}>Abrir detalle <ArrowRight size={15} /></button></div>
          <ProvinceMap summaries={summaries} selectedCode={selectedCode} onSelect={onSelect} />
        </article>
        <article className="panel ranking-panel">
          <div className="panel-title"><div><span className="eyebrow">Cobertura</span><h2>Municipios con listado</h2></div></div>
          <div className="rank-list">
            {summaries.filter((item) => item.hasList).sort((a, b) => b.listValid - a.listValid).slice(0, 8).map((item) => (
              <button key={item.code} onClick={() => onSelect(item.code)}>
                <span className="rank-code">{item.code}</span><span className="rank-name">{item.name}</span><strong>{fmt.format(item.listValid)}</strong>
              </button>
            ))}
            {!summaries.some((item) => item.hasList) && <div className="empty-state">Agregá la carpeta de listados para completar esta vista.</div>}
          </div>
        </article>
      </section>
      <section className="panel method-overview-panel">
        <div className="panel-title"><div><span className="eyebrow">Resultado del código R</span><h2>Municipios por método de selección</h2><p>Clasificación tomada de Resumen_Seleccion_Municipal.xlsx.</p></div></div>
        <div className="method-overview-grid">
          {methodGroups.map((group) => (
            <article className={`method-overview-column ${group.key}`} key={group.key}>
              <div className="method-overview-heading"><div><h3>{group.title}</h3><p>{group.subtitle}</p></div><strong>{fmt.format(group.items.length)}</strong></div>
              <div className="municipality-method-list">
                {group.items.map(({ summary, result }) => (
                  <button className={summary.code === selectedCode ? 'active' : ''} key={summary.code} onClick={() => openMunicipality(summary.code)} title={result?.reason ?? 'Sin resultado del proceso R.'}>
                    <span>{summary.code}</span><div><strong>{summary.name}</strong><small>{result?.reason ?? 'Sin resultado del proceso R.'}</small></div><ArrowRight size={14} />
                  </button>
                ))}
                {!group.items.length && <div className="empty-method-list">No hay municipios en esta categoría.</div>}
              </div>
            </article>
          ))}
        </div>
        {errors.length > 0 && <div className="method-errors"><AlertTriangle size={17} /><div><strong>{errors.length} municipios sin salida generada</strong><p>No constituyen un cuarto método: el proceso R terminó con ERROR para {errors.map(({ summary }) => summary.name).join(', ')}.</p></div></div>}
      </section>
      <section className="panel chart-panel">
        <div className="panel-title"><div><span className="eyebrow">Comparación rápida</span><h2>Listado válido vs. MORA en radios aptos</h2></div></div>
        {chartData.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9e5" /><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number) => fmt.format(value)} /><Bar dataKey="mora" name="MORA" fill="#b8cec9" radius={[5, 5, 0, 0]} /><Bar dataKey="listado" name="Listado válido" fill="#237c78" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="empty-chart">El gráfico aparecerá cuando se carguen listados.</div>}
      </section>
    </>
  )
}
