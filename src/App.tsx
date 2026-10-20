import { useEffect, useMemo, useState } from 'react'
import { LogOut, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Panorama } from './components/Panorama'
import { MunicipalityDetail } from './components/MunicipalityDetail'
import { ImportPanel } from './components/ImportPanel'
import { Simulator } from './components/Simulator'
import { Methodology } from './components/Methodology'
import { buildMunicipalitySummaries, unpackBase } from './utils'
import { clearAnalyses, clearBaseOverride, loadBaseOverride, loadStoredAnalyses, removeAnalysis, saveAnalysis, saveBaseOverride } from './db'
import type { ListFileAnalysis, MunicipalityConfig, MunicipalitySelectionResult, PackedBaseData, SelectionResultsData, ViewName, WorkerRequest, WorkerResponse } from './types'
import { useAuth } from './auth'
import { AccessManagement } from './components/AccessManagement'

function runWorker(action: WorkerRequest['action'], file: File): Promise<ListFileAnalysis | PackedBaseData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/excel.worker.ts', import.meta.url), { type: 'module' })
    const id = crypto.randomUUID()
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return
      worker.terminate()
      if (event.data.ok && event.data.data) resolve(event.data.data)
      else reject(new Error(event.data.error ?? 'No se pudo procesar el archivo.'))
    }
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)) }
    worker.postMessage({ id, action, file } satisfies WorkerRequest)
  })
}

function mergeAnalyses(bundled: ListFileAnalysis[], stored: ListFileAnalysis[]): ListFileAnalysis[] {
  const map = new Map<string, ListFileAnalysis>()
  bundled.forEach((item) => map.set(`${item.municipalityCode}:${item.fileName}`, { ...item, bundled: true }))
  stored.forEach((item) => map.set(`${item.municipalityCode}:${item.fileName}`, { ...item, bundled: false }))
  return [...map.values()]
}

export default function App() {
  const { user, isRoot, signOutUser } = useAuth()
  const [view, setView] = useState<ViewName>('panorama')
  const [packedBase, setPackedBase] = useState<PackedBaseData | null>(null)
  const [fullBase, setFullBase] = useState<PackedBaseData | null>(null)
  const [analyses, setAnalyses] = useState<ListFileAnalysis[]>([])
  const [municipalityConfigs, setMunicipalityConfigs] = useState<MunicipalityConfig[]>([])
  const [selectionResults, setSelectionResults] = useState<MunicipalitySelectionResult[]>([])
  const [selectedCode, setSelectedCode] = useState('007')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [loadingFull, setLoadingFull] = useState(false)
  const [hasOverride, setHasOverride] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [accessManagerOpen, setAccessManagerOpen] = useState(false)

  useEffect(() => {
    async function boot() {
      try {
        const [included, override, stored, config, selection] = await Promise.all([
          fetch('/data/base-operativa.json').then((response) => response.json()) as Promise<PackedBaseData>,
          loadBaseOverride(),
          loadStoredAnalyses(),
          fetch('/data/municipios-config.json').then((response) => response.json()) as Promise<{ municipalities: MunicipalityConfig[] }>,
          fetch('/data/seleccion-municipal.json').then((response) => response.json()) as Promise<SelectionResultsData>,
        ])
        setPackedBase(override ?? included)
        setHasOverride(Boolean(override))
        setMunicipalityConfigs(config.municipalities)
        setSelectionResults(selection.results)
        let bundled: ListFileAnalysis[] = []
        try {
          const response = await fetch('/data/listados-resumen.json')
          if (response.ok) {
            const json = await response.json()
            bundled = Array.isArray(json) ? json : json.analyses ?? []
          }
        } catch { bundled = [] }
        setAnalyses(mergeAnalyses(bundled, stored))
      } catch (event) {
        setError(event instanceof Error ? event.message : 'No se pudo iniciar la aplicación.')
      }
    }
    boot()
  }, [])

  const baseRows = useMemo(() => packedBase ? unpackBase(packedBase) : [], [packedBase])
  const summaries = useMemo(() => buildMunicipalitySummaries(baseRows, analyses), [baseRows, analyses])
  const selected = summaries.find((item) => item.code === selectedCode) ?? summaries[0]
  const selectedConfig = municipalityConfigs.find((item) => item.code === selected?.code)
  const selectedResult = selectionResults.find((item) => item.code === selected?.code)
  const selectedFiles = analyses.filter((item) => item.municipalityCode === selected?.code)
  const searchResults = globalSearch.trim() ? summaries.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 8) : []

  function selectMunicipality(code: string, open = false) {
    setSelectedCode(code)
    setGlobalSearch('')
    if (open) setView('municipio')
  }

  async function importFiles(files: File[]) {
    const candidates = files.filter((file) => /^TB_.*_LISTADO_TOTAL\.xls(x)?$/i.test(file.name))
    setError('')
    if (!candidates.length) { setError('No se encontraron archivos con el nombre TB_*_LISTADO_TOTAL.xls/xlsx.'); return }
    for (let index = 0; index < candidates.length; index += 1) {
      const file = candidates[index]
      setBusy(`Procesando ${index + 1} de ${candidates.length}: ${file.name}`)
      try {
        const parsed = await runWorker('parse-list', file) as ListFileAnalysis
        await saveAnalysis(parsed)
        setAnalyses((current) => {
          const key = `${parsed.municipalityCode}:${parsed.fileName}`
          return [...current.filter((item) => `${item.municipalityCode}:${item.fileName}` !== key), { ...parsed, bundled: false }]
        })
      } catch (event) {
        setError(`${file.name}: ${event instanceof Error ? event.message : String(event)}`)
      }
    }
    setBusy('')
  }

  async function importBase(file: File) {
    setError('')
    setBusy(`Convirtiendo ${file.name} a datos locales…`)
    try {
      const parsed = await runWorker('parse-base', file) as PackedBaseData
      await saveBaseOverride(parsed)
      setPackedBase(parsed)
      setFullBase(null)
      setHasOverride(true)
    } catch (event) {
      setError(event instanceof Error ? event.message : String(event))
    } finally { setBusy('') }
  }

  async function resetBase() {
    await clearBaseOverride()
    const included = await fetch('/data/base-operativa.json').then((response) => response.json()) as PackedBaseData
    setPackedBase(included)
    setHasOverride(false)
    setFullBase(null)
  }

  async function loadFullBase() {
    setLoadingFull(true)
    try { setFullBase(await fetch('/data/base-maestra.json').then((response) => response.json())) }
    catch (event) { setError(event instanceof Error ? event.message : String(event)) }
    finally { setLoadingFull(false) }
  }

  async function removeFile(file: ListFileAnalysis) {
    await removeAnalysis(file)
    setAnalyses((current) => current.filter((item) => item.id !== file.id))
  }

  async function clearImported() {
    await clearAnalyses()
    setAnalyses((current) => current.filter((item) => item.bundled))
  }

  return (
    <div className="app-shell">
      <div className={mobileNav ? 'mobile-sidebar open' : 'mobile-sidebar'}><Sidebar view={view} onView={(next) => { setView(next); setMobileNav(false) }} /></div>
      {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
      <Sidebar view={view} onView={setView} />
      <div className="content-shell">
        <div className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="global-search"><Search size={17} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar municipio por nombre o código…" />{globalSearch && <button onClick={() => setGlobalSearch('')}><X size={15} /></button>}
            {searchResults.length > 0 && <div className="search-results">{searchResults.map((item) => <button key={item.code} onClick={() => selectMunicipality(item.code, true)}><span>{item.code}</span><strong>{item.name}</strong><small>{item.eligibleUpms} UPM</small></button>)}</div>}
          </div>
          <label className="municipality-switcher"><span>{selected?.code ?? '—'}</span><div><small>Municipio</small><select aria-label="Seleccionar municipio" value={selected?.code ?? ''} onChange={(event) => selectMunicipality(event.target.value, true)}>{summaries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div></label>
          <div className="user-session"><span>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</span><div><small>{isRoot ? 'Administrador root' : 'Sesión autorizada'}</small><strong>{user?.email}</strong></div>{isRoot && <button title="Administrar accesos" aria-label="Administrar accesos" onClick={() => setAccessManagerOpen(true)}><ShieldCheck size={17} /></button>}<button title="Cerrar sesión" aria-label="Cerrar sesión" onClick={signOutUser}><LogOut size={16} /></button></div>
        </div>
        <main>
          {!packedBase && !error ? <div className="loading-screen"><span className="spinner large" /><h2>Preparando el explorador local…</h2></div> : null}
          {view === 'panorama' && packedBase && <Panorama summaries={summaries} selectedCode={selected?.code ?? ''} onSelect={(code) => selectMunicipality(code)} onOpenMunicipality={() => setView('municipio')} baseRows={baseRows} selectionResults={selectionResults} />}
          {view === 'municipio' && packedBase && <MunicipalityDetail summary={selected} config={selectedConfig} selectionResult={selectedResult} baseRows={baseRows} files={selectedFiles} fullBase={fullBase} loadingFull={loadingFull} onLoadFull={loadFullBase} onOpenSelection={() => setView('simulador')} />}
          {view === 'archivos' && <ImportPanel metadata={packedBase?.metadata ?? null} files={analyses} busy={busy} error={error} hasOverride={hasOverride} onFiles={importFiles} onBase={importBase} onRemove={removeFile} onClear={clearImported} onResetBase={resetBase} />}
          {view === 'simulador' && packedBase && <Simulator key={selected?.code} summary={selected} config={selectedConfig} selectionResult={selectedResult} baseRows={baseRows} files={selectedFiles} />}
          {view === 'metodologia' && <Methodology />}
        </main>
        <footer>Explorador EHE PBA · ejecución local · límites de partidos: ARBA Datos Abiertos (junio 2026)</footer>
      </div>
      {accessManagerOpen && <AccessManagement onClose={() => setAccessManagerOpen(false)} />}
    </div>
  )
}
