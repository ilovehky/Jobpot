export const WORK_TYPES = ['remote', 'hybrid', 'onsite'] as const
export type WorkType = (typeof WORK_TYPES)[number]

export class ValidationError extends Error {}

export function readEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Enter a valid email address.')
  }
  return email
}

export function readPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  if (password.length < 8) throw new ValidationError('Use at least 8 characters for your password.')
  if (password.length > 200) throw new ValidationError('Use 200 characters or fewer for your password.')
  return password
}

export function readName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) throw new ValidationError('Enter your name.')
  if (name.length > 100) throw new ValidationError('Use 100 characters or fewer for your name.')
  return name
}

export function readUrl(value: unknown, label: string): string {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && url.length <= 500) return url
  } catch {
    // Falls through to the error below.
  }
  throw new ValidationError(`Enter a full ${label} link starting with https://`)
}

export function readList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new ValidationError(`Send ${label} as a list.`)
  const seen = new Set<string>()
  const items: string[] = []
  for (const raw of value) {
    const item = typeof raw === 'string' ? raw.trim() : ''
    if (!item || seen.has(item.toLowerCase())) continue
    if (item.length > 100) throw new ValidationError(`Keep each ${label} under 100 characters.`)
    seen.add(item.toLowerCase())
    items.push(item)
  }
  if (items.length > 10) throw new ValidationError(`Add up to 10 ${label}.`)
  return items
}

export function readWorkTypes(value: unknown): WorkType[] {
  if (!Array.isArray(value)) throw new ValidationError('Send work types as a list.')
  return WORK_TYPES.filter((type) => value.includes(type))
}
