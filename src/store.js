<<<<<<< HEAD
import { ATTENDANCE, addDays } from './rules.js'

export const STORAGE_KEY = 'driving_school_data_v1'
const SESSION_KEY = 'driving_school_session_v1'

// Demo data. Dates are relative to today so a fresh visitor always sees upcoming lessons.
const seed = () => ({
  admin: { username: 'admin', password: 'admin123' },
  customers: [
    { id: 'c1', name: 'Alice Wong', email: 'alice@example.com', phone: '9876543210', password: 'pass123' },
    { id: 'c2', name: 'Ben Carter', email: 'ben@example.com', phone: '9876543211', password: 'pass123' },
    { id: 'c3', name: 'Chloe Diaz', email: 'chloe@example.com', phone: '9876543212', password: 'pass123' },
  ],
  appointments: [
    { id: 'a0', customerId: 'c1', date: addDays(-3), time: '10:00', place: 'Downtown Center', attendance: ATTENDANCE.PRESENT },
    { id: 'a1', customerId: 'c1', date: addDays(1), time: '10:00', place: 'Downtown Center', attendance: null },
    { id: 'a2', customerId: 'c1', date: addDays(3), time: '14:00', place: 'North Branch', attendance: null },
    { id: 'a3', customerId: 'c2', date: addDays(2), time: '09:00', place: 'Airport Branch', attendance: null },
  ],
})

// Fills in anything missing so older saved data keeps working.
function normalize(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  return {
    admin: d.admin?.username ? d.admin : seed().admin,
    customers: Array.isArray(d.customers) ? d.customers : [],
    appointments: Array.isArray(d.appointments) ? d.appointments.map((a) => ({ attendance: null, ...a })) : [],
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* storage full or blocked: the app still works for this tab */ }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* corrupt or unavailable storage: fall back to demo data */ }
  const data = seed()
  saveData(data)
  return data
}

// The login session lives in sessionStorage: it survives a refresh but ends when the tab closes.
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

export const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 9)
=======
const KEY = 'driving_school_data_v1'

const seed = () => ({
  admin: { username: 'admin', password: 'admin123' },
  customers: [
    { id: 'c1', name: 'Alice Wong', email: 'alice@example.com', phone: '555-0101', password: 'pass123' },
    { id: 'c2', name: 'Ben Carter', email: 'ben@example.com', phone: '555-0102', password: 'pass123' },
    { id: 'c3', name: 'Chloe Diaz', email: 'chloe@example.com', phone: '555-0103', password: 'pass123' },
  ],
  appointments: [
    { id: 'a1', customerId: 'c1', date: '2026-10-10', time: '10:00', place: 'Downtown Center', attendance: null },
    { id: 'a2', customerId: 'c1', date: '2026-10-13', time: '14:00', place: 'North Branch', attendance: null },
    { id: 'a3', customerId: 'c2', date: '2026-10-11', time: '09:00', place: 'Airport Branch', attendance: null },
  ],
})

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore corrupt state */ }
  const data = seed()
  localStorage.setItem(KEY, JSON.stringify(data))
  return data
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export const uid = (p) => p + Math.random().toString(36).slice(2, 9)

export const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
export const PLACES = ['Downtown Center', 'North Branch', 'Airport Branch']
>>>>>>> 1348fe2c352b1b47665f26caaedeb784de5dacbd
