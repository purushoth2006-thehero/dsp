import { useEffect, useMemo, useState } from 'react'
import { AppContext } from './appContext.js'
import { STORAGE_KEY, loadData, loadSession, saveData, saveSession, uid } from '../store.js'
import {
  ATTENDANCE, ROLES, getSlotConflict, isPast, normalizeEmail, normalizePhone, validateCustomer,
} from '../rules.js'

const OK = { ok: true }
const fail = (error) => ({ ok: false, error })

const buildCustomer = (form) => ({
  id: uid('c'),
  name: form.name.trim(),
  email: normalizeEmail(form.email),
  phone: normalizePhone(form.phone),
  password: form.password,
})

// A lesson that has started or already has attendance is history: it can't be moved or cancelled.
const isLocked = (appt, now) => Boolean(appt.attendance) || isPast(appt.date, appt.time, now)

export default function AppProvider({ children }) {
  const [data, setData] = useState(loadData)
  const [rawSession, setRawSession] = useState(loadSession)

  useEffect(() => { saveData(data) }, [data])

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setData(loadData()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // A session only counts while its customer still exists (they may have been removed in another tab).
  const session = useMemo(() => {
    if (!rawSession) return null
    if (rawSession.role === ROLES.ADMIN) return rawSession
    return data.customers.some((c) => c.id === rawSession.id) ? rawSession : null
  }, [rawSession, data.customers])

  const startSession = (s) => { saveSession(s); setRawSession(s) }

  // ----- authentication -----

  const loginAdmin = (username, password) => {
    if (username.trim() === data.admin.username && password === data.admin.password) {
      startSession({ role: ROLES.ADMIN })
      return OK
    }
    return fail('Invalid admin credentials.')
  }

  const loginCustomer = (identifier, password) => {
    const email = normalizeEmail(identifier)
    const phone = normalizePhone(identifier)
    const found = data.customers.find(
      (c) => (normalizeEmail(c.email) === email || (phone && normalizePhone(c.phone) === phone)) && c.password === password
    )
    if (!found) return fail('Invalid email/mobile number or password.')
    startSession({ role: ROLES.CUSTOMER, id: found.id })
    return OK
  }

  const logout = () => startSession(null)

  // ----- customers -----

  const register = (form) => {
    const error = validateCustomer(form, data.customers)
    if (error) return fail(error)
    const customer = buildCustomer(form)
    setData((d) => ({ ...d, customers: [...d.customers, customer] }))
    startSession({ role: ROLES.CUSTOMER, id: customer.id })
    return OK
  }

  const addCustomer = (form) => {
    const error = validateCustomer(form, data.customers)
    if (error) return fail(error)
    setData((d) => ({ ...d, customers: [...d.customers, buildCustomer(form)] }))
    return OK
  }

  const updateCustomer = (id, form) => {
    const error = validateCustomer(form, data.customers, { ignoreId: id, requirePassword: false })
    if (error) return fail(error)
    setData((d) => ({
      ...d,
      customers: d.customers.map((c) => (c.id !== id ? c : {
        ...c,
        name: form.name.trim(),
        email: normalizeEmail(form.email),
        phone: normalizePhone(form.phone),
        password: form.password ? form.password : c.password,
      })),
    }))
    return OK
  }

  const removeCustomer = (id) => {
    setData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      appointments: d.appointments.filter((a) => a.customerId !== id),
    }))
    return OK
  }

  // ----- appointments -----

  const bookAppointment = (customerId, slot) => {
    const conflict = getSlotConflict(slot, data.appointments, { customerId, now: new Date() })
    if (conflict) return fail(conflict.message)
    const appointment = { id: uid('a'), customerId, ...slot, attendance: null }
    setData((d) => ({ ...d, appointments: [...d.appointments, appointment] }))
    return OK
  }

  const rescheduleAppointment = (id, slot) => {
    const appt = data.appointments.find((a) => a.id === id)
    if (!appt) return fail('That lesson no longer exists.')
    const now = new Date()
    if (isLocked(appt, now)) return fail('Lessons that have started or been marked cannot be changed.')
    const conflict = getSlotConflict(slot, data.appointments, { customerId: appt.customerId, ignoreId: id, now })
    if (conflict) return fail(conflict.message)
    setData((d) => ({
      ...d,
      appointments: d.appointments.map((a) => (a.id === id ? { ...a, ...slot } : a)),
    }))
    return OK
  }

  const cancelAppointment = (id) => {
    const appt = data.appointments.find((a) => a.id === id)
    if (!appt) return fail('That lesson no longer exists.')
    if (isLocked(appt, new Date())) return fail('Lessons that have started or been marked cannot be cancelled.')
    setData((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== id) }))
    return OK
  }

  // value: 'present', 'absent' or null (clear)
  const setAttendance = (id, value) => {
    if (value !== null && !Object.values(ATTENDANCE).includes(value)) return fail('Invalid attendance value.')
    setData((d) => ({
      ...d,
      appointments: d.appointments.map((a) => (a.id === id ? { ...a, attendance: value } : a)),
    }))
    return OK
  }

  const value = {
    data, session,
    loginAdmin, loginCustomer, logout, register,
    addCustomer, updateCustomer, removeCustomer,
    bookAppointment, rescheduleAppointment, cancelAppointment, setAttendance,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
