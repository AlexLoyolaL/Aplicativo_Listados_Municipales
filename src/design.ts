import type { BaseRow, ListFileAnalysis, MunicipalitySelectionResult } from './types'
import { isEligibleBaseRow } from './utils'

export const DWELLINGS_PER_OPERATIONAL_UPM = 20
export const MIN_DWELLINGS_FOR_ROTATION = 65

export type DesignMethod = 'san_martin' | 'viamonte' | 'deficit' | 'error' | 'no_list'

export interface SourceUpmDesign {
  upm: string
  stratum: string
  radios: string[]
  listedRadios: number
  available: number
  complete: boolean
  sanMartinEligible: boolean
  viamonteCapacity: number
}

export interface MunicipalityDesign {
  method: DesignMethod
  methodLabel: string
  reason: string
  requiredOperationalUpms: number
  operationalTarget: number
  sourceUpms: SourceUpmDesign[]
  completeSourceUpms: number
  sanMartinEligibleUpms: number
  viamonteCapacity: number
  canSelect: boolean
}

function listByRadio(files: ListFileAnalysis[]): Map<string, number> {
  const result = new Map<string, number>()
  files.forEach((file) => file.radios.forEach((radio) => {
    result.set(radio.codradio, (result.get(radio.codradio) ?? 0) + radio.valid)
  }))
  return result
}

export function analyzeMunicipalityDesign(
  code: string,
  target: number,
  baseRows: BaseRow[],
  files: ListFileAnalysis[],
  selectionResult?: MunicipalitySelectionResult,
): MunicipalityDesign {
  const requiredOperationalUpms = Math.ceil(Math.max(0, target) / DWELLINGS_PER_OPERATIONAL_UPM)
  const operationalTarget = requiredOperationalUpms * DWELLINGS_PER_OPERATIONAL_UPM
  const listed = listByRadio(files)
  const grouped = new Map<string, SourceUpmDesign>()

  baseRows.filter((row) => row.codpart === code && isEligibleBaseRow(row)).forEach((row) => {
    const current = grouped.get(row.UPMs_automaticas) ?? {
      upm: row.UPMs_automaticas,
      stratum: `C${row.CLUSTER_ID ?? '—'}`,
      radios: [],
      listedRadios: 0,
      available: 0,
      complete: false,
      sanMartinEligible: false,
      viamonteCapacity: 0,
    }
    if (!current.radios.includes(row.codradio)) current.radios.push(row.codradio)
    grouped.set(current.upm, current)
  })

  if (!grouped.size && selectionResult?.sourceFrame === 'LISTADO_TOTAL_RADIO') {
    files.forEach((file) => file.radios.forEach((radio) => {
      const upm = `RADIO_${radio.codradio}`
      grouped.set(upm, {
        upm,
        stratum: 'Listado',
        radios: [radio.codradio],
        listedRadios: 0,
        available: 0,
        complete: false,
        sanMartinEligible: false,
        viamonteCapacity: 0,
      })
    }))
  }

  const sourceUpms = [...grouped.values()].map((item) => {
    const listedRadios = item.radios.filter((radio) => (listed.get(radio) ?? 0) > 0).length
    const available = item.radios.reduce((sum, radio) => sum + (listed.get(radio) ?? 0), 0)
    const complete = item.radios.length > 0 && listedRadios === item.radios.length
    return {
      ...item,
      listedRadios,
      available,
      complete,
      sanMartinEligible: available >= MIN_DWELLINGS_FOR_ROTATION,
      viamonteCapacity: Math.floor(available / DWELLINGS_PER_OPERATIONAL_UPM),
    }
  }).sort((a, b) => a.stratum.localeCompare(b.stratum) || a.upm.localeCompare(b.upm))

  const completeSourceUpms = sourceUpms.filter((item) => item.complete).length
  const sanMartinEligibleUpms = sourceUpms.filter((item) => item.sanMartinEligible).length
  const viamonteCapacity = sourceUpms.reduce((sum, item) => sum + item.viamonteCapacity, 0)

  if (selectionResult) {
    const method = selectionResult.method
    const labels: Record<typeof method, string> = {
      san_martin: 'Método San Martín ponderado',
      viamonte: 'Método Viamonte: todas las UPM',
      deficit: 'Déficit UPM + viviendas',
      error: 'Sin salida generada por R',
    }
    const defaults: Record<typeof method, string> = {
      san_martin: 'Hay suficientes UPM fuente aptas; se selecciona un subconjunto por estrato y PPS.',
      viamonte: 'Están presentes todas las UPM fuente esperadas; se utilizan todas.',
      deficit: 'Se utilizan todas las UPM fuente recibidas y se agregan bloques de 20 viviendas de forma proporcional hasta alcanzar el objetivo.',
      error: 'El proceso R no pudo generar una selección para este municipio.',
    }
    return {
      method,
      methodLabel: labels[method],
      reason: selectionResult.reason || defaults[method],
      requiredOperationalUpms: selectionResult.operationalUpms ?? requiredOperationalUpms,
      operationalTarget: selectionResult.operationalTarget ?? operationalTarget,
      sourceUpms,
      completeSourceUpms,
      sanMartinEligibleUpms: selectionResult.sanMartinEligibleUpms ?? sanMartinEligibleUpms,
      viamonteCapacity: selectionResult.viamonteCapacity ?? viamonteCapacity,
      canSelect: selectionResult.status === 'ok',
    }
  }

  if (!files.length) {
    return {
      method: 'no_list',
      methodLabel: 'Sin diagnóstico',
      reason: 'Falta cargar el archivo TB_LISTADO_TOTAL del municipio.',
      requiredOperationalUpms,
      operationalTarget,
      sourceUpms,
      completeSourceUpms,
      sanMartinEligibleUpms,
      viamonteCapacity,
      canSelect: false,
    }
  }
  if (sanMartinEligibleUpms >= requiredOperationalUpms) {
    return {
      method: 'san_martin',
      methodLabel: 'Método San Martín ponderado',
      reason: `${sanMartinEligibleUpms} UPM fuente aptas para ${requiredOperationalUpms} UPM operativas requeridas. Corresponde sortear un subconjunto por estrato y PPS.`,
      requiredOperationalUpms,
      operationalTarget,
      sourceUpms,
      completeSourceUpms,
      sanMartinEligibleUpms,
      viamonteCapacity,
      canSelect: true,
    }
  }
  if (viamonteCapacity < requiredOperationalUpms) {
    return {
      method: 'error',
      methodLabel: 'Capacidad insuficiente',
      reason: `El marco puede formar ${viamonteCapacity} UPM operativas de 20 viviendas y se necesitan ${requiredOperationalUpms}.`,
      requiredOperationalUpms,
      operationalTarget,
      sourceUpms,
      completeSourceUpms,
      sanMartinEligibleUpms,
      viamonteCapacity,
      canSelect: false,
    }
  }
  if (completeSourceUpms < sourceUpms.length) {
    return {
      method: 'deficit',
      methodLabel: 'Déficit UPM + viviendas',
      reason: `Se usan las UPM fuente recibidas y se agregan bloques de 20 viviendas proporcionalmente hasta completar ${requiredOperationalUpms} UPM operativas.`,
      requiredOperationalUpms,
      operationalTarget,
      sourceUpms,
      completeSourceUpms,
      sanMartinEligibleUpms,
      viamonteCapacity,
      canSelect: true,
    }
  }
  return {
    method: 'viamonte',
    methodLabel: 'Método Viamonte: todas las UPM',
    reason: `No hay ${requiredOperationalUpms} UPM fuente aptas para un sorteo 20×4. Se usan las ${sourceUpms.length} UPM fuente y se distribuyen proporcionalmente las UPM operativas.`,
    requiredOperationalUpms,
    operationalTarget,
    sourceUpms,
    completeSourceUpms,
    sanMartinEligibleUpms,
    viamonteCapacity,
    canSelect: true,
  }
}

function allocateBounded(
  total: number,
  weights: number[],
  capacities: number[],
  keys: string[],
  minimums = weights.map(() => 0),
): number[] {
  if (!weights.length || total <= 0) return weights.map(() => 0)
  const weightSum = weights.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (weightSum <= 0 || capacities.reduce((sum, value) => sum + value, 0) < total) return weights.map(() => 0)
  const exact = weights.map((weight) => total * Math.max(0, weight) / weightSum)
  const result = exact.map((value, index) => Math.min(capacities[index], Math.max(Math.floor(value), minimums[index] ?? 0)))
  while (result.reduce((sum, value) => sum + value, 0) > total) {
    const candidates = result.map((value, index) => ({ index, score: value - exact[index] }))
      .filter(({ index }) => result[index] > (minimums[index] ?? 0))
      .sort((a, b) => b.score - a.score || weights[a.index] - weights[b.index] || keys[a.index].localeCompare(keys[b.index]))
    if (!candidates.length) break
    result[candidates[0].index] -= 1
  }
  while (result.reduce((sum, value) => sum + value, 0) < total) {
    const candidates = result.map((value, index) => ({ index, score: exact[index] - value }))
      .filter(({ index }) => result[index] < capacities[index])
      .sort((a, b) => b.score - a.score || weights[b.index] - weights[a.index] || keys[a.index].localeCompare(keys[b.index]))
    if (!candidates.length) break
    result[candidates[0].index] += 1
  }
  return result
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ppsSystematic(items: SourceUpmDesign[], count: number, random: () => number): SourceUpmDesign[] {
  if (count <= 0) return []
  if (count >= items.length) return [...items]
  const total = items.reduce((sum, item) => sum + item.available, 0)
  const step = total / count
  const start = random() * step
  const cuts = Array.from({ length: count }, (_, index) => start + index * step)
  const selectedIndexes: number[] = []
  let cumulative = 0
  let cutIndex = 0
  items.forEach((item, index) => {
    cumulative += item.available
    while (cutIndex < cuts.length && cuts[cutIndex] < cumulative) {
      if (!selectedIndexes.includes(index)) selectedIndexes.push(index)
      cutIndex += 1
    }
  })
  while (selectedIndexes.length < count) {
    const free = items.map((_item, index) => index).filter((index) => !selectedIndexes.includes(index))
    free.sort((a, b) => items[b].available - items[a].available || items[a].upm.localeCompare(items[b].upm))
    selectedIndexes.push(free[0])
  }
  return selectedIndexes.sort((a, b) => a - b).map((index) => items[index])
}

export function selectSanMartinUpms(design: MunicipalityDesign, seed: number): Set<string> {
  if (design.method !== 'san_martin') return new Set()
  const eligible = design.sourceUpms.filter((item) => item.sanMartinEligible)
  const strata = [...new Set(design.sourceUpms.map((item) => item.stratum))].sort()
  const frameCounts = strata.map((stratum) => design.sourceUpms.filter((item) => item.stratum === stratum).length)
  const eligibleCounts = strata.map((stratum) => eligible.filter((item) => item.stratum === stratum).length)
  const exact = frameCounts.map((count) => design.requiredOperationalUpms * count / design.sourceUpms.length)
  const minimums = design.requiredOperationalUpms >= strata.length ? strata.map((_item, index) => eligibleCounts[index] > 0 ? 1 : 0) : strata.map(() => 0)
  const initial = exact.map((value, index) => Math.min(eligibleCounts[index], Math.max(minimums[index], Math.round(value))))
  let difference = design.requiredOperationalUpms - initial.reduce((sum, value) => sum + value, 0)
  while (difference > 0) {
    const candidates = initial.map((value, index) => ({ index, score: exact[index] - value }))
      .filter(({ index }) => initial[index] < eligibleCounts[index])
      .sort((a, b) => b.score - a.score || strata[a.index].localeCompare(strata[b.index]))
    if (!candidates.length) break
    initial[candidates[0].index] += 1
    difference -= 1
  }
  while (difference < 0) {
    const candidates = initial.map((value, index) => ({ index, score: value - exact[index] }))
      .filter(({ index }) => initial[index] > minimums[index])
      .sort((a, b) => b.score - a.score || strata[a.index].localeCompare(strata[b.index]))
    if (!candidates.length) break
    initial[candidates[0].index] -= 1
    difference += 1
  }
  const random = seededRandom(seed)
  const selected = new Set<string>()
  strata.forEach((stratum, index) => {
    const candidates = eligible.filter((item) => item.stratum === stratum)
      .sort((a, b) => b.available - a.available || a.upm.localeCompare(b.upm))
    ppsSystematic(candidates, initial[index], random).forEach((item) => selected.add(item.upm))
  })
  return selected
}

export function allocateViamonteUpms(design: MunicipalityDesign): Map<string, number> {
  const result = new Map<string, number>()
  if (design.method !== 'viamonte' && design.method !== 'deficit') return result
  const strata = [...new Set(design.sourceUpms.map((item) => item.stratum))].sort()
  const stratumItems = strata.map((stratum) => design.sourceUpms.filter((item) => item.stratum === stratum))
  const weights = stratumItems.map((items) => items.reduce((sum, item) => sum + item.available, 0))
  const capacities = stratumItems.map((items) => items.reduce((sum, item) => sum + item.viamonteCapacity, 0))
  const minimums = design.requiredOperationalUpms >= strata.length && capacities.every((value) => value >= 1) ? strata.map(() => 1) : strata.map(() => 0)
  const byStratum = allocateBounded(design.requiredOperationalUpms, weights, capacities, strata, minimums)
  stratumItems.forEach((items, stratumIndex) => {
    const sourceMinimums = byStratum[stratumIndex] >= items.length && items.every((item) => item.viamonteCapacity >= 1) ? items.map(() => 1) : items.map(() => 0)
    const assigned = allocateBounded(
      byStratum[stratumIndex],
      items.map((item) => item.available),
      items.map((item) => item.viamonteCapacity),
      items.map((item) => item.upm),
      sourceMinimums,
    )
    items.forEach((item, index) => result.set(item.upm, assigned[index]))
  })
  return result
}
