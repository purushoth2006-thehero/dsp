import { describe, expect, it } from 'vitest'
import {
  PACKAGES, PLACES, addDays, bookableDates, isBookableByCustomer, isValidPlace, packageOf, placeKey, placeList, computeStats, formatTime, getSlotConflict, isPast, isValidPhone,
  normalizePhone, toCsv, toLocalDate, validateCustomer,
} from './rules.js'

// Monday 19 Oct 2026, 10:00 local time
const NOW = new Date(2026, 9, 19, 10, 0)

describe('dates', () => {
  it('formats the local date, not UTC', () => {
    expect(toLocalDate(new Date(2026, 9, 19, 0, 30))).toBe('2026-10-19')
    expect(addDays(1, NOW)).toBe('2026-10-20')
    expect(addDays(-19, NOW)).toBe('2026-09-30')
  })

  it('knows which slots are in the past', () => {
    expect(isPast('2026-10-16', '17:00', NOW)).toBe(true)
    expect(isPast('2026-10-19', '09:00', NOW)).toBe(true)
    expect(isPast('2026-10-19', '10:00', NOW)).toBe(true)
    expect(isPast('2026-10-19', '11:00', NOW)).toBe(false)
    expect(isPast('2026-10-20', '09:00', NOW)).toBe(false)
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
  const customers = [{ id: 'c1', name: 'Alice', phone: '9876543210', password: 'secret1' }]
  const good = { name: 'Ravi Kumar', phone: '9123456780', password: 'abcdef' }

  it('accepts a valid new customer', () => {
    expect(validateCustomer(good, customers)).toBeNull()
  })

  it('catches a duplicate phone number regardless of format', () => {
    expect(validateCustomer({ ...good, phone: '+91 98765-43210' }, customers)).toMatch(/mobile/)
  })

  it('lets a customer keep their own phone when editing', () => {
    const edit = { name: 'Alice W', phone: '9876543210', password: '' }
    expect(validateCustomer(edit, customers, { ignoreId: 'c1', requirePassword: false })).toBeNull()
  })

  it('enforces the password rules', () => {
    expect(validateCustomer({ ...good, password: '123' }, customers)).toMatch(/Password/)
    expect(validateCustomer({ ...good, password: '' }, customers, { requirePassword: false })).toBeNull()
    expect(validateCustomer({ ...good, password: '12' }, customers, { requirePassword: false })).toMatch(/Password/)
  })
})

describe('places, days and packages', () => {
  it('compares typed places without caring about capitals or spaces', () => {
    expect(placeKey('  Tambaram   Ground ')).toBe('tambaram ground')
    expect(isValidPlace('x')).toBe(false)
    expect(isValidPlace('Potheri')).toBe(true)
    expect(placeList([{ place: 'potheri' }, { place: 'Avadi  Road' }, { place: 'avadi road' }])).toEqual([...PLACES, 'Avadi Road'])
  })

  it('lets customers book only today and tomorrow', () => {
    expect(bookableDates(NOW)).toEqual(['2026-10-19', '2026-10-20'])
    expect(isBookableByCustomer('2026-10-20', NOW)).toBe(true)
    expect(isBookableByCustomer('2026-10-21', NOW)).toBe(false)
    expect(isBookableByCustomer('2026-10-16', NOW)).toBe(false)
  })

  it('has Diamond (20 lessons) and Gold (10 lessons), and maps the old names', () => {
    expect(PACKAGES.diamond.lessons).toBe(20)
    expect(PACKAGES.gold.lessons).toBe(10)
    expect(packageOf({ package: 'standard' }).id).toBe('diamond')
    expect(packageOf({ package: 'ladies' }).id).toBe('gold')
    expect(packageOf({}).id).toBe('diamond')
  })
})

describe('getSlotConflict', () => {
  const appts = [{ id: 'a1', customerId: 'c1', date: '2026-10-20', time: '10:00', place: PLACES[0], attendance: null }]
  const slot = { date: '2026-10-20', time: '10:00', place: PLACES[1] }

  it('is null for a free future slot', () => {
    expect(getSlotConflict({ ...slot, time: '11:00' }, appts, { customerId: 'c2', now: NOW })).toBeNull()
  })

  it('blocks past slots', () => {
    expect(getSlotConflict({ ...slot, date: '2026-10-19', time: '09:00' }, appts, { customerId: 'c2', now: NOW }).code).toBe('past')
  })

  it('blocks the same place and time for another customer', () => {
    const c = getSlotConflict({ ...slot, place: PLACES[0] }, appts, { customerId: 'c2', now: NOW })
    expect(c.code).toBe('booked')
  })

  it('blocks the same customer from two lessons at one time, even at another place', () => {
    expect(getSlotConflict(slot, appts, { customerId: 'c1', now: NOW }).code).toBe('mine')
  })

  it('ignores the appointment being rescheduled', () => {
    const same = { ...slot, place: PLACES[0] }
    expect(getSlotConflict(same, appts, { customerId: 'c1', ignoreId: 'a1', now: NOW })).toBeNull()
  })
})

describe('computeStats', () => {
  const data = {
    customers: [{ id: 'c1' }, { id: 'c2' }],
    appointments: [
      { id: 'a1', customerId: 'c1', date: '2026-10-19', time: '09:00', place: PLACES[0], attendance: 'present' },
      { id: 'a2', customerId: 'c1', date: '2026-10-19', time: '11:00', place: PLACES[0], attendance: null },
      { id: 'a3', customerId: 'c2', date: '2026-10-16', time: '10:00', place: PLACES[1], attendance: null },
      { id: 'a4', customerId: 'c2', date: '2026-10-20', time: '10:00', place: PLACES[1], attendance: null },
      { id: 'a5', customerId: 'c2', date: '2026-10-15', time: '10:00', place: PLACES[1], attendance: 'absent' },
    ],
  }

  it('summarises the day', () => {
    const s = computeStats(data, NOW, [PLACES[0], PLACES[1]])
    expect(s.customers).toBe(2)
    expect(s.today).toBe(2)
    expect(s.upcoming).toBe(2)
    expect(s.present).toBe(1)
    expect(s.absent).toBe(1)
    expect(s.rate).toBe(50)
    expect(s.unmarked).toBe(1)
    expect(s.byPlace).toEqual([
      { place: PLACES[0], count: 1 },
      { place: PLACES[1], count: 1 },
    ])
    // Upcoming lessons day by day: the rest of today (11:00) and tomorrow.
    expect(s.byDay).toEqual([
      { date: '2026-10-19', count: 1, byPlace: [{ place: PLACES[0], count: 1 }, { place: PLACES[1], count: 0 }] },
      { date: '2026-10-20', count: 1, byPlace: [{ place: PLACES[0], count: 0 }, { place: PLACES[1], count: 1 }] },
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

describe('toCsv text columns', () => {
  it('keeps dates and phone numbers as text in Excel', () => {
    const csv = toCsv([{ phone: '9876543210' }], [{ label: 'Mobile', value: (r) => r.phone, text: true }])
    expect(csv.split('\r\n')[1]).toBe('"=""9876543210"""')
  })
})
