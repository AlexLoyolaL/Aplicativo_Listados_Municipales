export type Scalar = string | number | boolean | null

export interface BaseMetadata {
  sourceFile: string
  sourceRelativePath?: string
  sheet: string
  generatedAt: string
  rowCount: number
  columnCount: number
}

export interface PackedBaseData {
  metadata: BaseMetadata
  columns: string[]
  rows: Scalar[][]
}

export interface BaseRow {
  codradio: string
  latitud: number | null
  longitud: number | null
  fraccion: number | string | null
  radio: number | string | null
  codpart: string
  partido: string
  codloc: string
  localidad: string
  urb_rur_2000: number | null
  loc_mas_5000: number | null
  viviendas_mora_presentes: number | null
  CLUSTER_ID: number | string | null
  UPMs_automaticas: string
  UPM_valida: number | null
  Cant_Radios: number | null
  UPM_seleccionada: number | null
  UPM_seleccionada2: number | null
}

export interface RadioAnalysis {
  codradio: string
  fraccion: string
  radio: string
  total: number
  valid: number
  invalid: number
  duplicates: number
  types: Record<string, number>
}

export interface PreviewRow {
  sheet: string
  values: Record<string, Scalar>
}

export interface ListFileAnalysis {
  id: string
  fileName: string
  municipalityCode: string
  importedAt: string
  sheets: string[]
  headers: string[]
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateRows: number
  radios: RadioAnalysis[]
  simpleRadioCount: number
  compositeRadioCount: number
  types: Record<string, number>
  invalidTypes: Record<string, number>
  preview: PreviewRow[]
  warnings: string[]
  bundled?: boolean
}

export interface MunicipalitySummary {
  code: string
  name: string
  masterRows: number
  eligibleRadios: number
  eligibleUpms: number
  allUpms: number
  mora: number
  hasList: boolean
  listValid: number
  listRows: number
  issueCount: number
}

export interface MunicipalityConfig {
  code: string
  name: string
  domain: string
  region: string
  provincialUpms: number
  sampleTarget: number
  operationalUpms: number
  operationalTarget: number
}

export type SelectionMethod = 'san_martin' | 'viamonte' | 'deficit' | 'error'

export interface MunicipalitySelectionResult {
  code: string
  name: string
  method: SelectionMethod
  rawMethod: string
  strategy: string
  reason: string
  status: 'ok' | 'error'
  domain: string
  region: string
  provincialUpms: number | null
  sampleTarget: number | null
  operationalTarget: number | null
  availableDwellings: number | null
  selectedDwellings: number | null
  operationalUpms: number | null
  firstMunicipalUpm: number | null
  lastMunicipalUpm: number | null
  originalRows: number | null
  validRows: number | null
  duplicatesRemoved: number | null
  unusedDwellings: number | null
  roundingAdjustment: number | null
  seed: number | null
  control: string
  outputFile: string
  sourceFrame: string
  sourceUpmsMaster: number | null
  sourceUpmsReference: number | null
  sourceUpmsAvailable: number | null
  sourceUpmsMissing: number | null
  sanMartinEligibleUpms: number | null
  viamonteCapacity: number | null
  unmappedRadios: number | null
}

export interface SelectionResultsData {
  generatedAt: string
  sourceFile: string
  sourceSheet: string
  counts: Record<SelectionMethod, number>
  results: MunicipalitySelectionResult[]
}

export type ViewName = 'panorama' | 'municipio' | 'archivos' | 'simulador' | 'metodologia'

export interface WorkerRequest {
  id: string
  action: 'parse-list' | 'parse-base'
  file: File
}

export interface WorkerResponse {
  id: string
  ok: boolean
  data?: ListFileAnalysis | PackedBaseData
  error?: string
}
