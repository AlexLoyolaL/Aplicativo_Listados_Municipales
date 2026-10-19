import { AlertTriangle, ArrowRight, Database, FileCheck2, Home, Map as MapIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MunicipalitySummary } from '../types'
import { fmt } from '../utils'
import { ProvinceMap } from './ProvinceMap'

interface Props {
  summaries: MunicipalitySummary[]
  selectedCode: string
  onSelect: (code: string) => void
  onOpenMunicipality: () => void
  baseRows: number
  listFileCount: number
}

export function Panorama({ summaries, selectedCode, onSelect, onOpenMunicipality, baseRows, listFileCount }: Props) {
  const totalEligible = summaries.reduce((sum, item) => sum + item.eligibleUpms, 0)
  const totalValid = summaries.reduce((sum, item) => sum + item.listValid, 0)
  const issues = summaries.filter((item) => item.issueCount > 0).length
  const chartData = summaries.filter((item) => item.hasList).sort((a, b) => b.listValid - a.listValid).slice(0, 8).map((item) => ({ name: item.name, listado: item.listValid, mora: item.mora }))

  return (
    <>
      <header className="page-heading">
        <div><span className="eyebrow">Visión general</span><h1>Explorador municipal</h1><p>Base maestra, marcos de viviendas y UPM en un solo lugar.</p></div>
        <div className="source-pill"><Database size={16} /> Base precalculada en JSON</div>
      </header>
      <section className="metric-grid">
        <article className="metric-card"><div className="metric-icon green"><MapIcon /></div><div><span>Municipios en la base</span><strong>{fmt.format(summaries.length)}</strong><small>{fmt.format(baseRows)} radios</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><FileCheck2 /></div><div><span>Listados cargados</span><strong>{fmt.format(listFileCount)}</strong><small>{fmt.format(totalValid)} viviendas válidas</small></div></article>
        <article className="metric-card"><div className="metric-icon coral"><Home /></div><div><span>UPM municipales aptas</span><strong>{fmt.format(totalEligible)}</strong><small>localidades de 5.000 y más</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><AlertTriangle /></div><div><span>Municipios con alertas</span><strong>{fmt.format(issues)}</strong><small>tipos inválidos, duplicados o radios</small></div></article>
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
      <section className="panel chart-panel">
        <div className="panel-title"><div><span className="eyebrow">Comparación rápida</span><h2>Listado válido vs. MORA en radios aptos</h2></div></div>
        {chartData.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9e5" /><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number) => fmt.format(value)} /><Bar dataKey="mora" name="MORA" fill="#b8cec9" radius={[5, 5, 0, 0]} /><Bar dataKey="listado" name="Listado válido" fill="#237c78" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="empty-chart">El gráfico aparecerá cuando se carguen listados.</div>}
      </section>
    </>
  )
}
