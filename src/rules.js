// Pure business rules: no React and no browser APIs, so everything here is easy to test.

export const BRAND = 'Sridhar Driving School'
export const TOTAL_LESSONS = 20
// A customer booking for themselves may hold at most this many upcoming lessons at once.
export const MAX_UPCOMING_PER_CUSTOMER = 5
export const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
export const PLACES = ['Mcity_Petrol_Bunk', 'ZeroPoint', 'Potheri']
export const ATTENDANCE = { PRESENT: 'present', ABSENT: 'absent' }
export const ROLES = { ADMIN: 'admin', CUSTOMER: 'customer' }
export const MIN_PASSWORD = 6

// ---------- dates and times (wall-clock time at the school, never UTC) ----------

export const SCHOOL_TZ = 'Asia/Kolkata'

const pad = (n) => String(n).padStart(2, '0')

// The current wall-clock time at the school, as a Date whose local getters (getHours, getDate...)
// return the school's time. The server runs in UTC, so "has this slot passed?" must use this.
export function nowInZone(tz = SCHOOL_TZ, base = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(base)
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

export const toLocalDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const toLocalTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function addDays(n, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}

// A slot counts as past once its start time has been reached.
export function isPast(date, time, now = new Date()) {
  const today = toLocalDate(now)
  if (date !== today) return date < today
  return time <= toLocalTime(now)
}

export function formatDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

export const byDateTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time)

// ---------- customer validation ----------

export function normalizePhone(value) {
  let p = String(value ?? '').replace(/[\s()-]/g, '')
  if (p.startsWith('+91')) p = p.slice(3)
  else if (p.length === 12 && p.startsWith('91')) p = p.slice(2)
  return p
}

export const isValidPhone = (v) => /^[6-9]\d{9}$/.test(normalizePhone(v))

export const normalizeEmail = (v) => String(v ?? '').trim().toLowerCase()

export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(v))

// Returns an error message, or null when the form is fine.
export function validateCustomer(form, customers, { ignoreId = null, requirePassword = true } = {}) {
  if (String(form.name ?? '').trim().length < 2) return 'Please enter the full name.'
  if (!isValidEmail(form.email)) return 'Please enter a valid email address.'
  if (!isValidPhone(form.phone)) return 'Enter a valid 10-digit mobile number, e.g. 9876543210.'

  const password = form.password ?? ''
  if ((requirePassword || password) && password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`
  }

  const others = customers.filter((c) => c.id !== ignoreId)
  if (others.some((c) => normalizeEmail(c.email) === normalizeEmail(form.email))) {
    return 'A customer with that email already exists.'
  }
  if (others.some((c) => normalizePhone(c.phone) === normalizePhone(form.phone))) {
    return 'A customer with that mobile number already exists.'
  }
  return null
}

// ---------- appointment rules ----------

// Returns null when the slot is free, otherwise { code, message }.
export function getSlotConflict(slot, appointments, { customerId, ignoreId = null, now = new Date() } = {}) {
  const { date, time, place } = slot
  if (!date || !time || !place) return { code: 'incomplete', message: 'Please choose a date, time and place.' }
  if (isPast(date, time, now)) {
    return { code: 'past', message: 'That time has already passed. Please choose a later slot.' }
  }

  const sameSlot = appointments.filter((a) => a.id !== ignoreId && a.date === date && a.time === time)
  if (customerId && sameSlot.some((a) => a.customerId === customerId)) {
    return { code: 'mine', message: 'You already have a lesson at that time.' }
  }
  if (sameSlot.some((a) => a.place === place)) {
    return { code: 'booked', message: `${place} is already booked at ${formatTime(time)} on ${formatDate(date)}. Pick another slot.` }
  }
  return null
}

// ---------- dashboard numbers ----------

export function computeStats(data, now = new Date(), places = PLACES) {
  const { customers, appointments } = data
  const today = toLocalDate(now)
  const past = (a) => isPast(a.date, a.time, now)

  const present = appointments.filter((a) => a.attendance === ATTENDANCE.PRESENT).length
  const absent = appointments.filter((a) => a.attendance === ATTENDANCE.ABSENT).length
  const marked = present + absent
  const upcomingList = appointments.filter((a) => !past(a))

  return {
    customers: customers.length,
    today: appointments.filter((a) => a.date === today).length,
    todayList: appointments.filter((a) => a.date === today).sort(byDateTime),
    upcoming: upcomingList.length,
    present,
    absent,
    rate: marked ? Math.round((present / marked) * 100) : null,
    unmarked: appointments.filter((a) => past(a) && !a.attendance).length,
    byPlace: places.map((place) => ({ place, count: upcomingList.filter((a) => a.place === place).length })),
  }
}

// ---------- CSV export ----------

// Cells starting with = + - @ are prefixed with ' so spreadsheets never run them as formulas.
export function toCsv(rows, columns) {
  const esc = (value) => {
    let s = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))
  return [header, ...body].join('\r\n')
}
