// Shared Anthropic client — import this in all API routes instead of instantiating separately
import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY — set it in .env.local')
}

export const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const MODEL = 'claude-haiku-4-5-20251001'
