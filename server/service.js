import { randomUUID } from 'node:crypto'
import {
  ATTENDANCE, MAX_UPCOMING_PER_CUSTOMER, PLACES, TIME_SLOTS, TOTAL_LESSONS, byDateTime, getSlotConflict, isPast,
  normalizeEmail, normalizePhone, nowInZone, validateCustomer,
} from '../src/rules.js'
import { DUMMY_HASH, hashPassword, verifyPassword } from './security.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const CUSTOMERS = 'customers'
const APPOINTMENTS = 'appointments'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const str = (v) => (typeof v === 'string' ? v : '')
const newId = (prefix) => prefix + randomUUID().replace(/-/g, '').slice(0, 12)
const publicCustomer = ({ id, name, email, phone }) => ({ id, name, email, phone })
const byName = (a, b) => a.name.localeCompare(b.name)

// Locks make double-booking impossible even when two requests arrive at the same moment.
const slotKey = (a) => `lock:slot:${a.date}|${a.time}|${a.place}`
const custKey = (a) => `lock:cust:${a.customerId}|${a.date}|${a.time}`

function isRealDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function cleanCustomerForm(form) {
  const f = form && typeof form === 'object' ? form : {}
  return { name: str(f.name), email: str(f.email), phone: str(f.phone), password: str(f.password) }
}

function parseDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date) || !isRealDate(date)) throw new HttpError(400, 'Please choose a valid date.')
  return date
}

function parseSlot(input) {
  const { date, time, place } = input && typeof input === 'object' ? input : {}
  parseDate(date)
  if (!TIME_SLOTS.includes(time)) throw new HttpError(400, 'Please choose a valid time slot.')
  if (!PLACES.includes(place)) throw new HttpError(400, 'Please choose a valid place.')
  return { date, time, place }
}

const conflictError = (c) => new HttpError(c.code === 'past' || c.code === 'incomplete' || c.code === 'closed' ? 400 : 409, c.message)

const LOCKED_MESSAGE = 'Lessons that have started or been marked cannot be changed.'

export function createService(store, { now = () => nowInZone() } = {}) {
  const customers = () => store.hgetall(CUSTOMERS)
  const appointments = () => store.hgetall(APPOINTMENTS)

  async function claim(key, apptId) {
    if (await store.setnx(key, apptId)) return true
    const holder = await store.get(key)
    if (holder === apptId) return true
    // A lock whose lesson no longer exists is a leftover from a crash: take it over.
    if (holder && !(await store.hget(APPOINTMENTS, holder))) {
      await store.set(key, apptId)
      return true
    }
    return false
  }

  async function release(key, apptId) {
    if ((await store.get(key)) === apptId) await store.del(key)
  }

  const releaseLocks = (appt) => Promise.all([release(slotKey(appt), appt.id), release(custKey(appt), appt.id)])

  // Deletes a customer and every lesson they have, which frees those slots for others.
  async function deleteCustomerAndLessons(id) {
    const theirs = (await appointments()).filter((a) => a.customerId === id)
    for (const appt of theirs) {
      await store.hdel(APPOINTMENTS, appt.id)
      await releaseLocks(appt)
    }
    await store.hdel(CUSTOMERS, id)
  }

  // A customer may only touch their own lessons. Someone else's lesson looks like it doesn't exist.
  const NOT_FOUND = 'That lesson no longer exists.'
  function assertCanChange(appt, actor) {
    if (actor.role === 'customer' && appt.customerId !== actor.id) throw new HttpError(404, NOT_FOUND)
  }

  return {
    getCustomer: (id) => store.hget(CUSTOMERS, id),

    // What the signed-in person is allowed to see: the admin sees everything, a customer only their own lessons.
    async snapshot(session) {
      if (session.role === 'admin') {
        const [allCustomers, allAppointments] = await Promise.all([customers(), appointments()])
        return {
          customers: allCustomers.map(publicCustomer).sort(byName),
          appointments: allAppointments.sort(byDateTime),
        }
      }
      const own = (await appointments()).filter((a) => a.customerId === session.id).sort(byDateTime)
      return { customers: [publicCustomer(session.customer)], appointments: own }
    },

    async verifyLogin(identifier, password) {
      const id = str(identifier).trim()
      const email = normalizeEmail(id)
      const phone = normalizePhone(id)
      const customer = (await customers()).find(
        (c) => normalizeEmail(c.email) === email || (phone && normalizePhone(c.phone) === phone)
      )
      const ok = await verifyPassword(str(password), customer?.passwordHash ?? DUMMY_HASH)
      return customer && ok ? customer : null
    },

    // ----- customers -----

    async addCustomer(form) {
      const f = cleanCustomerForm(form)
      const error = validateCustomer(f, await customers())
      if (error) throw new HttpError(400, error)
      const customer = {
        id: newId('c'),
        name: f.name.trim(),
        email: normalizeEmail(f.email),
        phone: normalizePhone(f.phone),
        passwordHash: await hashPassword(f.password),
        createdAt: new Date().toISOString(),
      }
      await store.hset(CUSTOMERS, customer.id, customer)
      return publicCustomer(customer)
    },

    async updateCustomer(id, form) {
      const existing = await store.hget(CUSTOMERS, id)
      if (!existing) throw new HttpError(404, 'Customer not found.')
      const f = cleanCustomerForm(form)
      const error = validateCustomer(f, await customers(), { ignoreId: id, requirePassword: false })
      if (error) throw new HttpError(400, error)
      const next = {
        ...existing,
        name: f.name.trim(),
        email: normalizeEmail(f.email),
        phone: normalizePhone(f.phone),
        passwordHash: f.password ? await hashPassword(f.password) : existing.passwordHash,
      }
      await store.hset(CUSTOMERS, id, next)
      return publicCustomer(next)
    },

    async removeCustomer(id) {
      if (!(await store.hget(CUSTOMERS, id))) throw new HttpError(404, 'Customer not found.')
      await deleteCustomerAndLessons(id)
    },

    // ----- lessons -----

    // The slots already taken on one day, without saying who has them. A customer only learns
    // which of those are their own; this is what lets the booking form grey out unavailable times.
    async takenSlots(date, actor) {
      parseDate(date)
      return (await appointments())
        .filter((a) => a.date === date)
        .sort(byDateTime)
        .map((a) => (a.customerId === actor.id
          ? { time: a.time, place: a.place, mine: true, id: a.id }
          : { time: a.time, place: a.place, mine: false }))
    },

    // The admin books for any customer; a customer always books for themselves.
    async bookAppointment(input, actor = { role: 'admin' }) {
      const customerId = actor.role === 'customer' ? actor.id : str(input?.customerId)
      if (!(await store.hget(CUSTOMERS, customerId))) throw new HttpError(404, 'Customer not found.')
      const slot = parseSlot(input)

      const all = await appointments()
      const theirs = all.filter((a) => a.customerId === customerId)

      // The course is 20 lessons. Missed (absent) lessons don't count, so they can be replaced.
      if (theirs.filter((a) => a.attendance !== ATTENDANCE.ABSENT).length >= TOTAL_LESSONS) {
        throw new HttpError(409, `All ${TOTAL_LESSONS} lessons are already booked.`)
      }
      // Stops one student from taking up every free slot.
      if (actor.role === 'customer') {
        const upcoming = theirs.filter((a) => !a.attendance && !isPast(a.date, a.time, now())).length
        if (upcoming >= MAX_UPCOMING_PER_CUSTOMER) {
          throw new HttpError(409, `You can have up to ${MAX_UPCOMING_PER_CUSTOMER} upcoming lessons at a time. Attend or cancel one to book another.`)
        }
      }

      const conflict = getSlotConflict(slot, all, { customerId, now: now() })
      if (conflict) throw conflictError(conflict)

      const appt = { id: newId('a'), customerId, ...slot, attendance: null }
      // Saved first, so a lock can never point at a lesson that doesn't exist yet.
      await store.hset(APPOINTMENTS, appt.id, appt)

      const claimed = []
      for (const key of [slotKey(appt), custKey(appt)]) {
        if (!(await claim(key, appt.id))) {
          await Promise.all(claimed.map((k) => release(k, appt.id)))
          await store.hdel(APPOINTMENTS, appt.id)
          throw new HttpError(409, key.startsWith('lock:slot')
            ? `${appt.place} was just booked at that time. Please pick another slot.`
            : 'This customer already has a lesson at that time.')
        }
        claimed.push(key)
      }
      return appt
    },

    async rescheduleAppointment(id, input, actor = { role: 'admin' }) {
      const appt = await store.hget(APPOINTMENTS, id)
      if (!appt) throw new HttpError(404, NOT_FOUND)
      assertCanChange(appt, actor)
      if (appt.attendance || isPast(appt.date, appt.time, now())) throw new HttpError(409, LOCKED_MESSAGE)

      const slot = parseSlot(input)
      const conflict = getSlotConflict(slot, await appointments(), {
        customerId: appt.customerId, ignoreId: id, now: now(),
      })
      if (conflict) throw conflictError(conflict)

      const next = { ...appt, ...slot }
      const oldKeys = [slotKey(appt), custKey(appt)]
      const newKeys = [slotKey(next), custKey(next)]
      const claimed = []
      for (const [i, key] of newKeys.entries()) {
        if (key === oldKeys[i]) continue
        if (!(await claim(key, id))) {
          await Promise.all(claimed.map((k) => release(k, id)))
          throw new HttpError(409, 'That slot was just taken. Please pick another one.')
        }
        claimed.push(key)
      }
      await store.hset(APPOINTMENTS, id, next)
      await Promise.all(oldKeys.filter((k, i) => k !== newKeys[i]).map((k) => release(k, id)))
      return next
    },

    async cancelAppointment(id, actor = { role: 'admin' }) {
      const appt = await store.hget(APPOINTMENTS, id)
      if (!appt) throw new HttpError(404, NOT_FOUND)
      assertCanChange(appt, actor)
      if (appt.attendance || isPast(appt.date, appt.time, now())) throw new HttpError(409, LOCKED_MESSAGE)
      await store.hdel(APPOINTMENTS, id)
      await releaseLocks(appt)
    },

    // value: 'present', 'absent' or null (clears the mark)
    async setAttendance(id, value) {
      if (value !== null && !Object.values(ATTENDANCE).includes(value)) throw new HttpError(400, 'Invalid attendance value.')
      const appt = await store.hget(APPOINTMENTS, id)
      if (!appt) throw new HttpError(404, 'That lesson no longer exists.')
      const next = { ...appt, attendance: value }
      await store.hset(APPOINTMENTS, id, next)

      // Attending the 20th lesson finishes the course: the profile and its lessons are removed.
      if (value === ATTENDANCE.PRESENT) {
        const attended = (await appointments())
          .filter((a) => a.customerId === next.customerId && a.attendance === ATTENDANCE.PRESENT).length
        const customer = attended >= TOTAL_LESSONS ? await store.hget(CUSTOMERS, next.customerId) : null
        if (customer) {
          await deleteCustomerAndLessons(customer.id)
          return { appointment: next, completed: { name: customer.name } }
        }
      }
      return { appointment: next, completed: null }
    },
  }
}
