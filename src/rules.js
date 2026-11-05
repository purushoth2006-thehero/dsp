// Pure business rules: no React and no browser APIs, so everything here is easy to test.

export const BRAND = 'Sridhar Driving School'

// The admin picks a package when creating a customer. It decides how many lessons the course has.
// Reaching the last lesson removes the customer's profile.
export const PACKAGES = {
  diamond: { id: 'diamond', label: 'Diamond (20 lessons)', lessons: 20 },
  gold: { id: 'gold', label: 'Gold (10 lessons)', lessons: 10 },
}
export const DEFAULT_PACKAGE = 'diamond'
// Customers saved before the packages were renamed.
const LEGACY_PACKAGES = { standard: 'diamond', ladies: 'gold' }
export const packageId = (id) => (PACKAGES[id] ? id : (LEGACY_PACKAGES[id] ?? DEFAULT_PACKAGE))
export const packageOf = (customer) => PACKAGES[packageId(customer?.package)]
export const lessonsFor = (customer) => packageOf(customer).lessons
// A customer booking for themselves may hold at most this many upcoming lessons at once.
export const MAX_UPCOMING_PER_CUSTOMER = 5
export const TIME_SLOTS = ['06:00', '07:30', '09:00', '10:30', '12:30', '16:30']
// Suggested places. A lesson's place is typed by whoever books it, so any name is allowed.
export const PLACES = ['Mcity_Petrol_Bunk', 'ZeroPoint', 'Potheri']
export const cleanPlace = (v) => String(v ?? '').trim().replace(/\s+/g, ' ')
export const placeKey = (v) => cleanPlace(v).toLowerCase()
export const isValidPlace = (v) => cleanPlace(v).length >= 2 && cleanPlace(v).length <= 40
// The suggested places plus any other place that has been typed, each name once.
export function placeList(appointments = [], base = PLACES) {
  const seen = new Set(base.map(placeKey))
  const extra = []
  for (const a of appointments) {
    const k = placeKey(a.place)
    if (k && !seen.has(k)) { seen.add(k); extra.push(cleanPlace(a.place)) }
  }
  return [...base, ...extra]
}
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

// Returns an error message, or null when the form is fine.
export function validateCustomer(form, customers, { ignoreId = null, requirePassword = true } = {}) {
  if (String(form.name ?? '').trim().length < 2) return 'Please enter the full name.'
  if (!isValidPhone(form.phone)) return 'Enter a valid 10-digit mobile number, e.g. 9876543210.'
  if (form.package !== undefined && !PACKAGES[form.package]) return 'Please choose a package.'

  const password = form.password ?? ''
  if ((requirePassword || password) && password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`
  }

  const others = customers.filter((c) => c.id !== ignoreId)
  if (others.some((c) => normalizePhone(c.phone) === normalizePhone(form.phone))) {
    return 'A student with that mobile number already exists.'
  }
  return null
}

// ---------- appointment rules ----------

// Days the school is closed (Sunday and Wednesday) for lessons (0 = Sunday ... 3 = Wednesday). Change this list to change the weekly leave.
export const CLOSED_WEEKDAYS = [0, 3]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function closedDayName(date) {
  const [y, m, d] = String(date).split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return CLOSED_WEEKDAYS.includes(day) ? DAY_NAMES[day] : null
}

// Customers can book only today and tomorrow (school time). The admin can schedule any later day.
export const bookableDates = (now = new Date()) => [toLocalDate(now), addDays(1, now)]
export const isBookableByCustomer = (date, now = new Date()) => bookableDates(now).includes(date)

// Returns null when the slot is free, otherwise { code, message }.
export function getSlotConflict(slot, appointments, { customerId, ignoreId = null, now = new Date() } = {}) {
  const { date, time, place } = slot
  if (!date || !time || !cleanPlace(place)) return { code: 'incomplete', message: 'Please choose a date, time and place.' }
  const closed = closedDayName(date)
  if (closed) return { code: 'closed', message: `The school is closed on ${closed}s. Please choose another day.` }
  if (isPast(date, time, now)) {
    return { code: 'past', message: 'That time has already passed. Please choose a later slot.' }
  }

  const sameSlot = appointments.filter((a) => a.id !== ignoreId && a.date === date && a.time === time)
  if (customerId && sameSlot.some((a) => a.customerId === customerId)) {
    return { code: 'mine', message: 'You already have a lesson at that time.' }
  }
  if (sameSlot.some((a) => placeKey(a.place) === placeKey(place))) {
    return { code: 'booked', message: `${cleanPlace(place)} is already booked at ${formatTime(time)} on ${formatDate(date)}. Pick another slot.` }
  }
  return null
}

// ---------- dashboard numbers ----------

export function computeStats(data, now = new Date(), basePlaces = PLACES) {
  const { customers, appointments } = data
  const places = placeList(appointments, basePlaces)
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
    // Upcoming lessons counted day by day (days with no lessons are left out).
    byDay: [...new Set(upcomingList.map((a) => a.date))].sort().map((date) => {
      const day = upcomingList.filter((a) => a.date === date)
      return { date, count: day.length, byPlace: places.map((place) => ({ place, count: day.filter((a) => placeKey(a.place) === placeKey(place)).length })) }
    }),
    byPlace: places.map((place) => ({ place, count: upcomingList.filter((a) => placeKey(a.place) === placeKey(place)).length })),
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
  // Columns marked `text` (dates, mobile numbers) are written as ="value" so Excel keeps them exactly as
  // written instead of showing ##### for dates or 9.88E+09 for phone numbers.
  const cell = (c, r) => {
    const v = c.value(r)
    return c.text && v ? `"=""${String(v).replace(/"/g, '')}"""` : esc(v)
  }
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(c, r)).join(','))
  return [header, ...body].join('\r\n')
}

// ---------- sorting ----------

// Sorts rows by one of `keys` ({ key: row => value }), ascending or descending, keeping ties in date/time order.
export function sortRows(rows, keys, key, dir = 'asc') {
  const get = keys[key] ?? Object.values(keys)[0]
  const sign = dir === 'desc' ? -1 : 1
  const cmp = (x, y) => (typeof x === 'number' && typeof y === 'number'
    ? x - y
    : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true, sensitivity: 'base' }))
  return [...rows].sort((a, b) => sign * cmp(get(a), get(b)) || (a.date ? byDateTime(a, b) : 0))
}

// ---------- batches ----------

// Splits lessons into batches by start time (6:00 AM batch, 7:30 AM batch, ...), in time order.
// Each row keeps its place in the order it came in, so a chosen sort still applies inside every batch.
export function groupByBatch(rows) {
  const times = [...new Set([...TIME_SLOTS, ...rows.map((r) => r.time)])].sort()
  return times
    .map((time) => ({ time, rows: rows.filter((r) => r.time === time) }))
    .filter((g) => g.rows.length > 0)
}
