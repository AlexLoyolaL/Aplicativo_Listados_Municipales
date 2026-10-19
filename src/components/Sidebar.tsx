import { BarChart3, BookOpen, Building2, Calculator, Files, MapPinned, ShieldCheck } from 'lucide-react'
import type { ViewName } from '../types'

const items: Array<{ id: ViewName; label: string; icon: typeof BarChart3 }> = [
  { id: 'panorama', label: 'Panorama', icon: BarChart3 },
  { id: 'municipio', label: 'Municipio', icon: Building2 },
  { id: 'archivos', label: 'Archivos', icon: Files },
  { id: 'simulador', label: 'Selección UPM', icon: Calculator },
  { id: 'metodologia', label: 'Metodología', icon: BookOpen },
]

interface Props {
  view: ViewName
  onView: (view: ViewName) => void
}

export function Sidebar({ view, onView }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><MapPinned size={22} /></div>
        <div><strong>EHE · PBA</strong><span>Explorador municipal</span></div>
      </div>
      <nav>
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => onView(id)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="local-note">
        <ShieldCheck size={17} />
        <div><strong>100% local</strong><span>Sin nube ni envíos externos</span></div>
      </div>
    </aside>
  )
}
