import Anthropic from '@anthropic-ai/sdk'
import { AnalysisOutput } from './types'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

const client = new Anthropic()

const MIN_RELEVANCE = 6

export async function analyzeWithClaude(prompt: string): Promise<AnalysisOutput | null> {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    const clean = raw
      .replace(/^```json\n?/m, '')
      .replace(/^```\n?/m, '')
      .replace(/```$/m, '')
      .trim()

    const parsed = JSON.parse(clean) as AnalysisOutput

    if (!parsed.summary || !parsed.impact_analysis || !parsed.action_strategy) {
      console.warn('  ⚠ Incomplete JSON from Claude:', clean.substring(0, 120))
      return null
    }

    const score = parsed.relevance_score ?? 0
    if (score < MIN_RELEVANCE) {
      console.log(`  ⏭ Skipped (relevance ${score}/10 — below threshold)`)
      return null
    }

    return parsed
  } catch (err) {
    console.error('  ✗ Claude API error:', (err as Error).message)
    return null
  }
}
