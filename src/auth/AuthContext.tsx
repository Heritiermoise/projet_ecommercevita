/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost, setStoredToken, getStoredToken } from '../lib/api'

export type Role = 'client' | 'admin'

export type AuthUser = {
  id: number
  email: string
  nom?: string | null
  prenom?: string | null
  telephone?: string | null
  role: Role
}

type LoginBody = {
  email: string
  motDePasse: string
}

type RegisterBody = {
  email: string
  motDePasse: string
  nom?: string | null
  prenom?: string | null
  telephone?: string | null
  role: Role
}

type AuthResponse = {
  token: string
  user: AuthUser
}

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (body: LoginBody) => Promise<AuthUser>
  register: (body: RegisterBody) => Promise<AuthUser>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('auth_user')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(true)

  const logout = () => {
    setStoredToken(null)
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }

  const refreshMe = async () => {
    // Désactivé car api/me n'existe pas encore en PHP
    return
  }

  useEffect(() => {
    setLoading(false)
  }, [])

  const login = async (body: LoginBody) => {
    const res = await apiPost<AuthResponse>('/api/auth/login', body)
    setStoredToken(res.token)
    localStorage.setItem('auth_user', JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  const register = async (body: RegisterBody) => {
    const res = await apiPost<AuthResponse>('/api/auth/register', body)
    setStoredToken(res.token)
    localStorage.setItem('auth_user', JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider />')
  return ctx
}
