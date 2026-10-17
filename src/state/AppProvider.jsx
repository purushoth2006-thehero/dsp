import { useCallback, useEffect, useState } from 'react'
import { AppContext } from './appContext.js'
import { request } from '../api.js'

const POLL_MS = 30000

const describeProblem = (res) => {
  const problems = res.data?.problems
  return problems?.length ? `${res.error} ${problems.join(' ')}` : res.error
}

// All data lives on the server. This provider loads what the signed-in person may see and
// refreshes it after every change, every 30 seconds, and when the tab becomes visible again.
export default function AppProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [data, setData] = useState({ customers: [], appointments: [] })
  const [serverError, setServerError] = useState('')

  const refresh = useCallback(
    () => request('GET', '/api/session').then((res) => {
      if (res.ok && res.data && 'session' in res.data) {
        setSession(res.data.session)
        setData({ customers: res.data.customers ?? [], appointments: res.data.appointments ?? [] })
        setServerError('')
      } else {
        setServerError(res.ok ? 'The server did not respond correctly.' : describeProblem(res))
      }
      setLoading(false)
    }),
    []
  )

  useEffect(() => { refresh() }, [refresh])

  const signedIn = Boolean(session)
  useEffect(() => {
    if (!signedIn) return undefined
    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [signedIn, refresh])

  // Sends a change to the server, then reloads the data. Returns { ok, error? }.
  const run = async (method, url, body) => {
    const res = await request(method, url, body)
    await refresh()
    return res.ok ? { ok: true, ...res.data } : { ok: false, error: res.error }
  }

  const value = {
    loading, serverError, session, data, refresh,

    loginAdmin: (username, password) => run('POST', '/api/login', { role: 'admin', username, password }),
    loginCustomer: (identifier, password) => run('POST', '/api/login', { role: 'customer', identifier, password }),
    logout: () => run('POST', '/api/logout', {}),

    addCustomer: (form) => run('POST', '/api/customers', form),
    updateCustomer: (id, form) => run('PUT', `/api/customers/${id}`, form),
    removeCustomer: (id) => run('DELETE', `/api/customers/${id}`),

    bookAppointment: (customerId, slot) => run('POST', '/api/appointments', { customerId, ...slot }),
    rescheduleAppointment: (id, slot) => run('PUT', `/api/appointments/${id}`, slot),
    cancelAppointment: (id) => run('DELETE', `/api/appointments/${id}`),

    // value: 'present', 'absent' or null. Shown immediately, then confirmed by the server.
    setAttendance: (id, attendance) => {
      setData((d) => ({
        ...d,
        appointments: d.appointments.map((a) => (a.id === id ? { ...a, attendance } : a)),
      }))
      return run('PUT', `/api/appointments/${id}/attendance`, { attendance })
    },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
