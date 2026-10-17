import { describe, expect, it } from 'vitest'
import {
  addDays, computeStats, formatTime, getSlotConflict, isPast, isValidPhone,
  normalizePhone, toCsv, toLocalDate, validateCustomer,
} from './rules.js'

// Saturday 17 Oct 2026, 10:00 local time
const NOW = new Date(2026, 9, 17, 10, 0)

describe('dates', () => {
  it('formats the local date, not UTC', () => {
    expect(toLocalDate(new Date(2026, 9, 17, 0, 30))).toBe('2026-10-17')
    expect(addDays(1, NOW)).toBe('2026-10-18')
    expect(addDays(-17, NOW)).toBe('2026-09-30')
  })

  it('knows which slots are in the past', () => {
    expect(isPast('2026-10-16', '17:00', NOW)).toBe(true)
    expect(isPast('2026-10-17', '09:00', NOW)).toBe(true)
    expect(isPast('2026-10-17', '10:00', NOW)).toBe(true)
    expect(isPast('2026-10-17', '11:00', NOW)).toBe(false)
    expect(isPast('2026-10-18', '09:00', NOW)).toBe(false)
  })

  it('formats times for display', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('13:30')).toBe('1:30 PM')
    expect(formatTime('12:00')).toBe('12:00 PM')
  })
})

describe('phone numbers', () => {
  it('accepts common Indian formats', () => {
    expect(isValidPhone('9876543210')).toBe(true)
    expect(isValidPhone('+91 98765 43210')).toBe(true)
    expect(isValidPhone('919876543210')).toBe(true)
  })

  it('rejects bad numbers', () => {
    expect(isValidPhone('555-0101')).toBe(false)
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('5876543210')).toBe(false)
  })

  it('does not strip a leading 91 from a normal 10-digit number', () => {
    expect(normalizePhone('9123456789')).toBe('9123456789')
  })
})

describe('validateCustomer', () => {
  const customers = [{ id: 'c1', name: 'Alice', email: 'alice@example.com', phone: '9876543210', password: 'secret1' }]
  const good = { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9123456780', password: 'abcdef' }

  it('accepts a valid new customer', () => {
    expect(validateCustomer(good, customers)).toBeNull()
  })

  it('catches duplicate email regardless of case and duplicate phone regardless of format', () => {
    expect(validateCustomer({ ...good, email: ' ALICE@example.com ' }, customers)).toMatch(/email/)
    expect(validateCustomer({ ...good, phone: '+91 98765-43210' }, customers)).toMatch(/mobile/)
  })

  it('lets a customer keep their own email and phone when editing', () => {
    const edit = { name: 'Alice W', email: 'alice@example.com', phone: '9876543210', password: '' }
    expect(validateCustomer(edit, customers, { ignoreId: 'c1', requirePassword: false })).toBeNull()
  })

  it('enforces the password rules', () => {
    expect(validateCustomer({ ...good, password: '123' }, customers)).toMatch(/Password/)
    expect(validateCustomer({ ...good, password: '' }, customers, { requirePassword: false })).toBeNull()
    expect(validateCustomer({ ...good, password: '12' }, customers, { requirePassword: false })).toMatch(/Password/)
  })
})

describe('getSlotConflict', () => {
  const appts = [{ id: 'a1', customerId: 'c1', date: '2026-10-18', time: '10:00', place: 'Downtown Center', attendance: null }]
  const slot = { date: '2026-10-18', time: '10:00', place: 'North Branch' }

  it('is null for a free future slot', () => {
    expect(getSlotConflict({ ...slot, time: '11:00' }, appts, { customerId: 'c2', now: NOW })).toBeNull()
  })

  it('blocks past slots', () => {
    expect(getSlotConflict({ ...slot, date: '2026-10-17', time: '09:00' }, appts, { customerId: 'c2', now: NOW }).code).toBe('past')
  })

  it('blocks the same place and time for another customer', () => {
    const c = getSlotConflict({ ...slot, place: 'Downtown Center' }, appts, { customerId: 'c2', now: NOW })
    expect(c.code).toBe('booked')
  })

  it('blocks the same customer from two lessons at one time, even at another place', () => {
    expect(getSlotConflict(slot, appts, { customerId: 'c1', now: NOW }).code).toBe('mine')
  })

  it('ignores the appointment being rescheduled', () => {
    const same = { ...slot, place: 'Downtown Center' }
    expect(getSlotConflict(same, appts, { customerId: 'c1', ignoreId: 'a1', now: NOW })).toBeNull()
  })
})

describe('computeStats', () => {
  const data = {
    customers: [{ id: 'c1' }, { id: 'c2' }],
    appointments: [
      { id: 'a1', customerId: 'c1', date: '2026-10-17', time: '09:00', place: 'Downtown Center', attendance: 'present' },
      { id: 'a2', customerId: 'c1', date: '2026-10-17', time: '11:00', place: 'Downtown Center', attendance: null },
      { id: 'a3', customerId: 'c2', date: '2026-10-16', time: '10:00', place: 'North Branch', attendance: null },
      { id: 'a4', customerId: 'c2', date: '2026-10-18', time: '10:00', place: 'North Branch', attendance: null },
      { id: 'a5', customerId: 'c2', date: '2026-10-15', time: '10:00', place: 'North Branch', attendance: 'absent' },
    ],
  }

  it('summarises the day', () => {
    const s = computeStats(data, NOW, ['Downtown Center', 'North Branch'])
    expect(s.customers).toBe(2)
    expect(s.today).toBe(2)
    expect(s.upcoming).toBe(2)
    expect(s.present).toBe(1)
    expect(s.absent).toBe(1)
    expect(s.rate).toBe(50)
    expect(s.unmarked).toBe(1)
    expect(s.byPlace).toEqual([
      { place: 'Downtown Center', count: 1 },
      { place: 'North Branch', count: 1 },
    ])
  })

  it('has no rate before any attendance is marked', () => {
    expect(computeStats({ customers: [], appointments: [] }, NOW).rate).toBeNull()
  })
})

describe('toCsv', () => {
  const columns = [
    { label: 'Name', value: (r) => r.name },
    { label: 'Note', value: (r) => r.note },
  ]

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([{ name: 'Smith, J', note: 'said "hi"\nbye' }], columns)
    expect(csv).toBe('Name,Note\r\n"Smith, J","said ""hi""\nbye"')
  })

  it('neutralises spreadsheet formulas', () => {
    const csv = toCsv([{ name: '=HYPERLINK("x")', note: '+1' }], columns)
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",'+1`)
  })
})
