import { BRAND, formatDate, formatTime, trainerName } from '../src/rules.js'

export const REMINDER_KINDS = ['day-before', 'same-day']

// The text sent to the customer. `variables` are the same values for an approved WhatsApp template:
// {{1}} name, {{2}} day (today / tomorrow), {{3}} date, {{4}} time, {{5}} place, {{6}} trainer.
export function buildReminder(kind, appt, customer) {
  const when = kind === 'day-before' ? 'tomorrow' : 'today'
  const firstName = customer.name.trim().split(/\s+/)[0]
  const values = [firstName, when, formatDate(appt.date), formatTime(appt.time), appt.place, trainerName(appt.trainerId)]
  return {
    text: `Hello ${firstName}, reminder from ${BRAND}: you have a driving class ${when} (${values[2]}) at ${values[3]} at ${values[4]} with ${values[5]}. Please arrive on time.`,
    variables: Object.fromEntries(values.map((v, i) => [String(i + 1), v])),
  }
}

// Sends every reminder that is due and not sent yet. A lesson is marked only when at least one channel worked,
// so a failed send is retried the next time this runs.
export async function sendReminders({ service, notifier, kind }) {
  if (notifier.channels.length === 0) {
    return { kind, configured: false, due: 0, sent: 0, failed: 0 }
  }
  const due = await service.dueReminders(kind)
  const results = await Promise.all(due.map(async ({ appointment, customer }) => {
    const outcome = await notifier.send(customer.phone, buildReminder(kind, appointment, customer))
    if (outcome.sent.length > 0) await service.markReminded(appointment.id, kind)
    return outcome
  }))
  return {
    kind,
    configured: true,
    channels: notifier.channels,
    due: due.length,
    sent: results.filter((r) => r.sent.length > 0).length,
    failed: results.filter((r) => r.sent.length === 0).length,
    errors: [...new Set(results.flatMap((r) => r.failed.map((f) => `${f.channel}: ${f.error}`)))],
  }
}
