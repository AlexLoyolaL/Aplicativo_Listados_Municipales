/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import type { ListFileAnalysis, PackedBaseData, PreviewRow, RadioAnalysis, Scalar, WorkerRequest, WorkerResponse } from '../types'

const VALID_TYPES = new Set(['A', 'FD', 'B1', 'B2', 'B3', 'C', 'D', 'VE', 'H'])
const CORE_COLUMNS = ['codradio','latitud','longitud','fraccion','radio','codpart','partido','codloc','localidad','loc_mas_5000','viviendas_mora_presentes','CLUSTER_ID','UPMs_automaticas','UPM_valida','Cant_Radios','UPM_seleccionada','UPM_seleccionada2']

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function findKey(keys: string[], candidates: string[]): string | undefined {
  const normalized = new Map(keys.map((key) => [normalize(key), key]))
  return candidates.map(normalize).map((candidate) => normalized.get(candidate)).find(Boolean)
}

function clean(value: unknown): Scalar {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
  return String(value)
}

function padded(value: unknown, length: number): string {
  const raw = String(value ?? '').trim().replace(/\.0$/, '').replace(/\D/g, '')
  return raw ? raw.padStart(length, '0') : ''
}

function parseList(file: File, workbook: XLSX.WorkBook): ListFileAnalysis {
  const codeFromName = file.name.match(/TB[_\s-]?(\d{3})/i)?.[1] ?? ''
  const radioMap = new Map<string, RadioAnalysis>()
  const seen = new Set<string>()
  const allHeaders = new Set<string>()
  const types: Record<string, number> = {}
  const invalidTypes: Record<string, number> = {}
  const preview: PreviewRow[] = []
  const warnings: string[] = []
  let totalRows = 0
  let validRows = 0
  let duplicateRows = 0
  let parsedSheets = 0

  workbook.SheetNames.forEach((sheetName) => {
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: null, raw: true })
    if (!records.length) return
    const keys = Object.keys(records[0])
    const fractionKey = findKey(keys, ['FRACCION', 'FRACCIÓN', 'FRAC'])
    const radioKey = findKey(keys, ['RADIO', 'RAD'])
    const typeKey = findKey(keys, ['TIPO_VIV', 'TIPOVIV', 'TIPO_VIVIENDA', 'TIPOVIVIENDA'])
    const departmentKey = findKey(keys, ['DPTO', 'DEPTO', 'CODPART', 'PARTIDO'])
    if (!fractionKey || !radioKey || !typeKey) return
    parsedSheets += 1
    keys.forEach((key) => allHeaders.add(key))
    records.forEach((record) => {
      const values = Object.fromEntries(keys.map((key) => [key, clean(record[key])]))
      const signature = JSON.stringify(keys.map((key) => values[key]))
      const duplicate = seen.has(signature)
      if (duplicate) duplicateRows += 1
      else seen.add(signature)
      const type = String(record[typeKey] ?? '').trim().toUpperCase() || '(vacío)'
      const valid = VALID_TYPES.has(type)
      types[type] = (types[type] ?? 0) + 1
      if (!valid) invalidTypes[type] = (invalidTypes[type] ?? 0) + 1
      totalRows += 1
      if (valid && !duplicate) validRows += 1
      const part = padded(record[departmentKey ?? ''] ?? codeFromName, 3).slice(-3) || codeFromName
      const fraction = padded(record[fractionKey], 2)
      const radio = padded(record[radioKey], 2)
      const codradio = part && fraction && radio ? `06${part}${fraction}${radio}` : `${part}-${fraction}-${radio}`
      const current = radioMap.get(codradio) ?? { codradio, fraccion: fraction, radio, total: 0, valid: 0, invalid: 0, duplicates: 0, types: {} }
      current.total += 1
      current.valid += valid && !duplicate ? 1 : 0
      current.invalid += valid ? 0 : 1
      current.duplicates += duplicate ? 1 : 0
      current.types[type] = (current.types[type] ?? 0) + 1
      radioMap.set(codradio, current)
      if (preview.length < 200) preview.push({ sheet: sheetName, values })
    })
  })

  if (!parsedSheets) warnings.push('No se encontró ninguna hoja con columnas de fracción, radio y tipo de vivienda.')
  if (!codeFromName) warnings.push('No se pudo obtener el código municipal desde el nombre del archivo.')
  if (duplicateRows) warnings.push(`${duplicateRows.toLocaleString('es-AR')} filas son duplicadas exactas.`)
  const radios = [...radioMap.values()].sort((a, b) => a.codradio.localeCompare(b.codradio))
  return {
    id: `${codeFromName || 'sin-codigo'}-${file.name}-${file.lastModified}`,
    fileName: file.name,
    municipalityCode: codeFromName,
    importedAt: new Date().toISOString(),
    sheets: workbook.SheetNames,
    headers: [...allHeaders],
    totalRows,
    validRows,
    invalidRows: totalRows - validRows,
    duplicateRows,
    radios,
    simpleRadioCount: new Set(radios.map((radio) => radio.radio)).size,
    compositeRadioCount: radios.length,
    types,
    invalidTypes,
    preview,
    warnings,
  }
}

function parseBase(file: File, workbook: XLSX.WorkBook): PackedBaseData {
  const sheetName = workbook.SheetNames[0]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: null, raw: true })
  const sourceColumns = records.length ? Object.keys(records[0]) : []
  const lookup = new Map(sourceColumns.map((column) => [normalize(column), column]))
  const selected = CORE_COLUMNS.map((column) => lookup.get(normalize(column)))
  const missing = CORE_COLUMNS.filter((_column, index) => !selected[index])
  if (missing.length) throw new Error(`Faltan columnas esenciales: ${missing.join(', ')}`)
  const rows = records.map((record) => selected.map((column) => clean(record[column!])))
  return {
    metadata: {
      sourceFile: file.name,
      sheet: sheetName,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      columnCount: CORE_COLUMNS.length,
    },
    columns: CORE_COLUMNS,
    rows,
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, action, file } = event.data
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true })
    const data = action === 'parse-list' ? parseList(file, workbook) : parseBase(file, workbook)
    const response: WorkerResponse = { id, ok: true, data }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = { id, ok: false, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}

export {}
