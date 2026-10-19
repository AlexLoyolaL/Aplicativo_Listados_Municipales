import Dexie, { type EntityTable } from 'dexie'
import type { ListFileAnalysis, PackedBaseData } from './types'

interface StoredAnalysis extends ListFileAnalysis {
  key: string
}

interface StoredBase {
  key: string
  data: PackedBaseData
}

class MunicipalDatabase extends Dexie {
  analyses!: EntityTable<StoredAnalysis, 'key'>
  bases!: EntityTable<StoredBase, 'key'>

  constructor() {
    super('ehe-municipal-local')
    this.version(1).stores({
      analyses: '&key,municipalityCode,fileName,importedAt',
      bases: '&key',
    })
  }
}

export const db = new MunicipalDatabase()

export async function loadStoredAnalyses(): Promise<ListFileAnalysis[]> {
  return (await db.analyses.toArray()).map(({ key: _key, ...analysis }) => analysis)
}

export async function saveAnalysis(analysis: ListFileAnalysis): Promise<void> {
  await db.analyses.put({ ...analysis, key: `${analysis.municipalityCode}:${analysis.fileName}` })
}

export async function removeAnalysis(analysis: ListFileAnalysis): Promise<void> {
  await db.analyses.delete(`${analysis.municipalityCode}:${analysis.fileName}`)
}

export async function clearAnalyses(): Promise<void> {
  await db.analyses.clear()
}

export async function loadBaseOverride(): Promise<PackedBaseData | undefined> {
  return (await db.bases.get('current'))?.data
}

export async function saveBaseOverride(data: PackedBaseData): Promise<void> {
  await db.bases.put({ key: 'current', data })
}

export async function clearBaseOverride(): Promise<void> {
  await db.bases.delete('current')
}
