import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, useMap } from 'react-leaflet'
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet'
import L from 'leaflet'
import type { MunicipalitySummary } from '../types'
import { municipalityCode } from '../utils'

type GeoData = GeoJSON.GeoJsonObject & { features?: Array<{ properties?: Record<string, unknown> }> }

interface Props {
  summaries: MunicipalitySummary[]
  selectedCode: string
  onSelect: (code: string) => void
}

function FitProvince({ data }: { data: GeoData }) {
  const map = useMap()
  useEffect(() => {
    const layer = L.geoJSON(data)
    const bounds = layer.getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] })
  }, [data, map])
  return null
}

export function ProvinceMap({ summaries, selectedCode, onSelect }: Props) {
  const [data, setData] = useState<GeoData | null>(null)
  const lookup = useMemo(() => new Map(summaries.map((item) => [item.code, item])), [summaries])

  useEffect(() => {
    fetch('/data/partidos-pba.geojson').then((response) => response.json()).then(setData).catch(() => setData(null))
  }, [])

  const getCode = (feature: { properties?: Record<string, unknown> } | undefined) => municipalityCode(feature?.properties?.municipio_id)
  const style = (feature?: { properties?: Record<string, unknown> }): PathOptions => {
    const code = getCode(feature)
    const summary = lookup.get(code)
    const selected = code === selectedCode
    return {
      color: selected ? '#fb725c' : '#f7f5ef',
      weight: selected ? 2.4 : 0.8,
      fillColor: selected ? '#fb725c' : summary?.hasList ? '#237c78' : summary ? '#aecbc5' : '#d7dedb',
      fillOpacity: selected ? 0.92 : 0.88,
    }
  }

  const onEachFeature = (feature: { properties?: Record<string, unknown> }, layer: Layer) => {
    const code = getCode(feature)
    const summary = lookup.get(code)
    const name = String(feature.properties?.municipio_nombre ?? summary?.name ?? code)
    layer.bindTooltip(`<strong>${name}</strong><br/>Código ${code}${summary ? `<br/>${summary.eligibleUpms} UPM aptas` : ''}`, { sticky: true })
    layer.on({ click: (_event: LeafletMouseEvent) => code && onSelect(code) })
  }

  if (!data) return <div className="map-loading">Cargando mapa local…</div>
  return (
    <div className="map-shell">
      <MapContainer center={[-36.6, -60.2]} zoom={6} zoomControl={true} attributionControl={false} minZoom={5} maxZoom={10}>
        <FitProvince data={data} />
        <GeoJSON key={`${selectedCode}-${summaries.filter((s) => s.hasList).length}`} data={data} style={style as never} onEachFeature={onEachFeature as never} />
      </MapContainer>
      <div className="map-legend"><span><i className="dot imported" />Listado cargado</span><span><i className="dot pending" />Solo base</span></div>
    </div>
  )
}
