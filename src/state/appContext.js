import { createContext, useContext } from 'react'

export const AppContext = createContext(null)

export const useApp = () => useContext(AppContext)

// Where each kind of signed-in user lands.
export const homeFor = (session) => {
  if (!session) return '/login'
  return session.role === 'admin' ? '/admin' : '/customer'
}
