// Canonical date formatting for the whole app: always DD/MM/YYYY with a Gregorian (ค.ศ.) year,
// never the Thai Buddhist calendar. Built with raw getters (no toLocale*) so output is identical
// on server + client and never shifts to the Buddhist era / Thai month names.
// Accepts Date | ISO string | epoch number | null; returns '' for empty/invalid input.

type DateInput = Date | string | number | null | undefined

function toDate(d: DateInput): Date | null {
  if (d === null || d === undefined || d === '') return null
  const date = d instanceof Date ? d : new Date(d)
  return isNaN(date.getTime()) ? null : date
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** DD/MM/YYYY */
export function formatDate(d: DateInput): string {
  const date = toDate(d)
  if (!date) return ''
  return `${p2(date.getDate())}/${p2(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** DD/MM/YYYY HH:mm */
export function formatDateTime(d: DateInput): string {
  const date = toDate(d)
  if (!date) return ''
  return `${formatDate(date)} ${p2(date.getHours())}:${p2(date.getMinutes())}`
}

/** DD/MM/YYYY HH:mm:ss */
export function formatDateTimeSec(d: DateInput): string {
  const date = toDate(d)
  if (!date) return ''
  return `${formatDate(date)} ${p2(date.getHours())}:${p2(date.getMinutes())}:${p2(date.getSeconds())}`
}

/** MM/YYYY (month-only labels) */
export function formatMonth(d: DateInput): string {
  const date = toDate(d)
  if (!date) return ''
  return `${p2(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** DD/MM (compact, e.g. chart axis ticks) */
export function formatDateShort(d: DateInput): string {
  const date = toDate(d)
  if (!date) return ''
  return `${p2(date.getDate())}/${p2(date.getMonth() + 1)}`
}
