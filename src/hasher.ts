import { createHash } from 'crypto'

export function computeHash(headline: string, sourceName: string): string {
  return createHash('sha256')
    .update(headline.toLowerCase().trim() + sourceName.toLowerCase())
    .digest('hex')
}