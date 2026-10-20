import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { LockKeyhole, LogIn, ShieldAlert } from 'lucide-react'
import { firebaseAuth, firebaseConfigured, firestore, initialAuthorizedEmails, rootEmail } from './firebase'

type AuthStatus = 'checking' | 'signed_out' | 'authorized' | 'unauthorized' | 'error' | 'unconfigured'

interface AuthContextValue {
  user: User | null
  isRoot: boolean
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('popup-closed-by-user')) return 'Se cerró la ventana antes de completar el acceso.'
  if (code.includes('popup-blocked')) return 'El navegador bloqueó la ventana de Google. Habilitá las ventanas emergentes e intentá nuevamente.'
  if (code.includes('unauthorized-domain')) return 'Este dominio todavía no está autorizado en Firebase Authentication.'
  if (code.includes('network-request-failed')) return 'No se pudo contactar a Firebase. Revisá la conexión a internet.'
  return 'No se pudo verificar la cuenta. Intentá nuevamente.'
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return context
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(firebaseConfigured ? 'checking' : 'unconfigured')
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const blockedEmail = useRef('')

  useEffect(() => {
    if (!firebaseAuth || !firestore) return
    const auth = firebaseAuth
    const database = firestore
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return
      if (!nextUser) {
        setUser(null)
        setStatus(blockedEmail.current ? 'unauthorized' : 'signed_out')
        return
      }

      setStatus('checking')
      const normalizedEmail = nextUser.email?.trim().toLowerCase() ?? ''
      const usesGoogle = nextUser.providerData.some((provider) => provider.providerId === 'google.com')
      try {
        if (usesGoogle && normalizedEmail === rootEmail) {
          await Promise.allSettled(initialAuthorizedEmails.map((authorizedEmail) => setDoc(
            doc(database, 'authorizedUsers', authorizedEmail),
            { email: authorizedEmail, active: true, role: 'user', updatedAt: serverTimestamp() },
            { merge: true },
          )))
          if (!active) return
          blockedEmail.current = ''
          setEmail(normalizedEmail)
          setUser(nextUser)
          setStatus('authorized')
          return
        }
        const permission = normalizedEmail && usesGoogle
          ? await getDoc(doc(database, 'authorizedUsers', normalizedEmail))
          : null
        if (!active) return
        if (permission?.exists() && permission.data().active === true) {
          blockedEmail.current = ''
          setEmail(normalizedEmail)
          setUser(nextUser)
          setStatus('authorized')
          return
        }
        blockedEmail.current = normalizedEmail || 'Cuenta sin correo verificable'
        setEmail(blockedEmail.current)
        await signOut(auth)
        if (active) setStatus('unauthorized')
      } catch (error) {
        blockedEmail.current = normalizedEmail
        setEmail(normalizedEmail)
        await signOut(auth)
        if (active) {
          setMessage(authMessage(error))
          setStatus('unauthorized')
        }
      }
    })
    return () => { active = false; unsubscribe() }
  }, [])

  async function signIn() {
    if (!firebaseAuth) return
    blockedEmail.current = ''
    setMessage('')
    setStatus('checking')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(firebaseAuth, provider)
    } catch (error) {
      setMessage(authMessage(error))
      setStatus('error')
    }
  }

  async function signOutUser() {
    blockedEmail.current = ''
    setEmail('')
    setUser(null)
    if (firebaseAuth) await signOut(firebaseAuth)
    setStatus('signed_out')
  }

  if (status === 'authorized') {
    return <AuthContext.Provider value={{ user, isRoot: user?.email?.toLowerCase() === rootEmail, signOutUser }}>{children}</AuthContext.Provider>
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>EHE · PBA</span><strong>Explorador municipal</strong></div>
        {status === 'unconfigured' ? <>
          <div className="auth-icon warning"><ShieldAlert /></div>
          <span className="eyebrow">Configuración pendiente</span>
          <h1>Falta conectar Firebase</h1>
          <p>Copiá <code>.env.example</code> como <code>.env.local</code> y completá las claves de la aplicación web creada en Firebase.</p>
          <div className="auth-help">Después habilitá Google en Authentication y agregá los correos permitidos en la colección <b>authorizedUsers</b>.</div>
        </> : status === 'checking' ? <>
          <span className="spinner large" />
          <h1>Verificando acceso…</h1>
          <p>Estamos comprobando la cuenta y sus permisos.</p>
        </> : status === 'unauthorized' ? <>
          <div className="auth-icon warning"><ShieldAlert /></div>
          <span className="eyebrow">Acceso denegado</span>
          <h1>Esta cuenta no está autorizada</h1>
          <p><b>{email}</b> inició sesión con Google, pero no figura en la lista de acceso.</p>
          {message && <div className="auth-error">{message}</div>}
          <button className="google-button" onClick={signIn}><LogIn size={18} /> Usar otra cuenta de Google</button>
        </> : <>
          <div className="auth-icon"><LockKeyhole /></div>
          <span className="eyebrow">Acceso restringido</span>
          <h1>Ingresar al aplicativo</h1>
          <p>Solo pueden acceder las cuentas de Google incluidas en la lista de personas autorizadas.</p>
          {message && <div className="auth-error">{message}</div>}
          <button className="google-button" onClick={signIn}><LogIn size={18} /> Continuar con Google</button>
        </>}
      </section>
    </main>
  )
}
