import type { BaseRow, ListFileAnalysis, MunicipalitySummary, PackedBaseData, Scalar } from './types'

export const VALID_HOUSING_TYPES = new Set(['A', 'FD', 'B1', 'B2', 'B3', 'C', 'D', 'VE', 'H'])

export const fmt = new Intl.NumberFormat('es-AR')
export const fmtDecimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export function pad(value: unknown, length: number): string {
  const numeric = String(value ?? '').trim().replace(/\.0$/, '')
  return numeric ? numeric.padStart(length, '0') : ''
}

export function municipalityCode(value: unknown): string {
  const raw = String(value ?? '').replace(/\D/g, '')
  return raw ? raw.slice(-3).padStart(3, '0') : ''
}

export function radioCode(part: unknown, fraction: unknown, radio: unknown): string {
  const p = municipalityCode(part)
  const f = pad(fraction, 2)
  const r = pad(radio, 2)
  return p && f && r ? `06${p}${f}${r}` : ''
}

export function valueToNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function unpackBase(data: PackedBaseData): BaseRow[] {
  const indexes = Object.fromEntries(data.columns.map((column, index) => [column, index]))
  const read = (row: Scalar[], key: string) => row[indexes[key]] ?? null
  return data.rows.map((row) => ({
    codradio: String(read(row, 'codradio') ?? ''),
    latitud: valueToNumber(read(row, 'latitud')),
    longitud: valueToNumber(read(row, 'longitud')),
    fraccion: read(row, 'fraccion') as string | number | null,
    radio: read(row, 'radio') as string | number | null,
    codpart: municipalityCode(read(row, 'codpart')),
    partido: String(read(row, 'partido') ?? 'Sin nombre'),
    codloc: String(read(row, 'codloc') ?? ''),
    localidad: String(read(row, 'localidad') ?? ''),
    loc_mas_5000: valueToNumber(read(row, 'loc_mas_5000')),
    viviendas_mora_presentes: valueToNumber(read(row, 'viviendas_mora_presentes')),
    CLUSTER_ID: read(row, 'CLUSTER_ID') as string | number | null,
    UPMs_automaticas: String(read(row, 'UPMs_automaticas') ?? ''),
    UPM_valida: valueToNumber(read(row, 'UPM_valida')),
    Cant_Radios: valueToNumber(read(row, 'Cant_Radios')),
    UPM_seleccionada: valueToNumber(read(row, 'UPM_seleccionada')),
    UPM_seleccionada2: valueToNumber(read(row, 'UPM_seleccionada2')),
  }))
}

export function isEligibleBaseRow(row: BaseRow): boolean {
  return row.loc_mas_5000 === 1 && row.UPM_seleccionada2 === 0 && Boolean(row.UPMs_automaticas)
}

export function groupListFiles(files: ListFileAnalysis[]): Map<string, ListFileAnalysis[]> {
  const grouped = new Map<string, ListFileAnalysis[]>()
  files.forEach((file) => {
    const items = grouped.get(file.municipalityCode) ?? []
    items.push(file)
    grouped.set(file.municipalityCode, items)
  })
  return grouped
}

export function buildMunicipalitySummaries(baseRows: BaseRow[], files: ListFileAnalysis[]): MunicipalitySummary[] {
  const listGroups = groupListFiles(files)
  const grouped = new Map<string, BaseRow[]>()
  baseRows.forEach((row) => {
    if (!row.codpart) return
    const rows = grouped.get(row.codpart) ?? []
    rows.push(row)
    grouped.set(row.codpart, rows)
  })

  return [...grouped.entries()].map(([code, rows]) => {
    const eligible = rows.filter(isEligibleBaseRow)
    const fileGroup = listGroups.get(code) ?? []
    const eligibleCodes = new Set(eligible.map((row) => row.codradio))
    const listValid = fileGroup.reduce((sum, item) => sum + item.radios.filter((radio) => eligibleCodes.has(radio.codradio)).reduce((radioSum, radio) => radioSum + radio.valid, 0), 0)
    const listRows = fileGroup.reduce((sum, item) => sum + item.radios.filter((radio) => eligibleCodes.has(radio.codradio)).reduce((radioSum, radio) => radioSum + radio.total, 0), 0)
    const unknownRadios = fileGroup.reduce((sum, item) => {
      const baseCodes = new Set(rows.map((row) => row.codradio))
      return sum + item.radios.filter((radio) => !baseCodes.has(radio.codradio)).length
    }, 0)
    return {
      code,
      name: rows.find((row) => row.partido)?.partido ?? code,
      masterRows: rows.length,
      eligibleRadios: new Set(eligible.map((row) => row.codradio)).size,
      eligibleUpms: new Set(eligible.map((row) => row.UPMs_automaticas)).size,
      allUpms: new Set(rows.map((row) => row.UPMs_automaticas).filter(Boolean)).size,
      mora: eligible.reduce((sum, row) => sum + (row.viviendas_mora_presentes ?? 0), 0),
      hasList: fileGroup.length > 0,
      listValid,
      listRows,
      issueCount: fileGroup.reduce((sum, item) => sum + item.duplicateRows + item.invalidRows, 0) + unknownRadios,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>): void {
  if (!rows.length) return
  const columns = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [columns.map(escape).join(';'), ...rows.map((row) => columns.map((column) => escape(row[column])).join(';'))].join('\r\n')
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
