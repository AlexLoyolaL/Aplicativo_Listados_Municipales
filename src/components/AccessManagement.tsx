import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Check, Plus, ShieldCheck, Trash2, UserRoundCheck, UserRoundX, X } from 'lucide-react'
import { firestore, rootEmail } from '../firebase'

interface AuthorizedUser {
  email: string
  name: string
  active: boolean
}

interface Props {
  onClose: () => void
}

export function AccessManagement({ onClose }: Props) {
  const [users, setUsers] = useState<AuthorizedUser[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')

  async function loadUsers() {
    if (!firestore) return
    setBusy(true)
    setError('')
    try {
      const snapshot = await getDocs(collection(firestore, 'authorizedUsers'))
      const loaded = snapshot.docs.map((item) => ({
        email: item.id,
        name: String(item.data().name ?? ''),
        active: item.data().active === true,
      })).sort((a, b) => a.email.localeCompare(b.email))
      setUsers(loaded)
    } catch {
      setError('No se pudo leer la lista. Verificá que las reglas de Firestore estén desplegadas.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void loadUsers() }, [])

  async function addUser() {
    if (!firestore) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Ingresá un correo válido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setDoc(doc(firestore, 'authorizedUsers', normalizedEmail), {
        email: normalizedEmail,
        name: name.trim(),
        active: true,
        role: 'user',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setEmail('')
      setName('')
      await loadUsers()
    } catch { setError('No se pudo guardar el acceso.') }
    finally { setBusy(false) }
  }

  async function toggleUser(user: AuthorizedUser) {
    if (!firestore) return
    setBusy(true)
    setError('')
    try {
      await updateDoc(doc(firestore, 'authorizedUsers', user.email), { active: !user.active, updatedAt: serverTimestamp() })
      await loadUsers()
    } catch { setError('No se pudo cambiar el estado del acceso.') }
    finally { setBusy(false) }
  }

  async function removeUser(userEmail: string) {
    if (!firestore) return
    setBusy(true)
    setError('')
    try {
      await deleteDoc(doc(firestore, 'authorizedUsers', userEmail))
      setConfirmDelete('')
      await loadUsers()
    } catch { setError('No se pudo eliminar el acceso.') }
    finally { setBusy(false) }
  }

  return <div className="access-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="access-title">
      <header><div><span className="eyebrow">Administración</span><h2 id="access-title">Cuentas autorizadas</h2><p>Solo el usuario root puede modificar esta lista.</p></div><button aria-label="Cerrar" onClick={onClose}><X /></button></header>
      <div className="root-access"><ShieldCheck /><div><strong>{rootEmail}</strong><span>Administrador root permanente</span></div><Check /></div>
      <div className="access-form"><label>Correo de Google<input type="email" placeholder="persona@gmail.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Nombre opcional<input placeholder="Nombre y apellido" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="primary-button" disabled={busy} onClick={addUser}><Plus size={16} /> Agregar acceso</button></div>
      {error && <div className="auth-error">{error}</div>}
      <div className="access-list">
        {busy && !users.length ? <div className="empty-state"><span className="spinner" /> Cargando accesos…</div> : users.map((user) => <article key={user.email} className={user.active ? '' : 'disabled'}><div className="access-user-icon">{user.active ? <UserRoundCheck /> : <UserRoundX />}</div><div><strong>{user.name || user.email}</strong>{user.name && <span>{user.email}</span>}<small>{user.active ? 'Acceso habilitado' : 'Acceso suspendido'}</small></div><button className="secondary-button" disabled={busy} onClick={() => toggleUser(user)}>{user.active ? 'Suspender' : 'Habilitar'}</button>{confirmDelete === user.email ? <div className="delete-confirm"><span>¿Eliminar?</span><button onClick={() => removeUser(user.email)}>Sí</button><button onClick={() => setConfirmDelete('')}>No</button></div> : <button className="icon-button danger" aria-label={`Eliminar ${user.email}`} onClick={() => setConfirmDelete(user.email)}><Trash2 size={15} /></button>}</article>)}
        {!busy && !users.length && !error && <div className="empty-state">Todavía no hay cuentas normales configuradas.</div>}
      </div>
    </section>
  </div>
}
