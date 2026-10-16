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