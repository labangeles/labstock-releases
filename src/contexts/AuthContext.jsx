import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = cargando
  const [profile, setProfile] = useState(null)
  const [sedes,   setSedes]   = useState([])

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfileAndSedes(session.user.id)
      else setSession(null)
    })

    // Cambios de sesión (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchProfileAndSedes(session.user.id)
      else { setProfile(null); setSedes([]) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfileAndSedes(userId) {
    // Cargar perfil y sedes juntos — ya con token activo
    const [profileRes, sedesRes] = await Promise.all([
      supabase.from('profiles').select('*, sedes(id, nombre)').eq('id', userId).single(),
      supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
    ])
    if (profileRes.data) setProfile(profileRes.data)
    if (sedesRes.data)   setSedes(sedesRes.data)
  }

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const loading = session === undefined

  return (
    <AuthContext.Provider value={{ session, profile, sedes, loading, signIn, signOut,
      refreshProfile: () => fetchProfileAndSedes(session?.user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
