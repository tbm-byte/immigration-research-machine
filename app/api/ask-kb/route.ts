import { NextRequest, NextResponse } from 'next/server'
import { ai, MODEL } from '@/lib/ai'
import { KB_FULL } from '@/src/kb'
import { getKbDocuments } from '@/src/supabase'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

async function buildSystem(): Promise<string> {
  // Pull live KB docs from Supabase (best-effort — fall back to static KB if unavailable)
  let dynamicDocs = ''
  try {
    const rows = await getKbDocuments(40)
    if (rows.length > 0) {
      const byCategory: Record<string, typeof rows> = {}
      for (const r of rows) {
        const cat = r.category ?? 'general'
        ;(byCategory[cat] ??= []).push(r)
      }
      const sections: string[] = []
      if (byCategory['legal_marketing']?.length) {
        sections.push('## Recent Legal Marketing Insights\n\n' +
          byCategory['legal_marketing'].map(r => `### ${r.title}\n${r.content}`).join('\n\n'))
      }
      if (byCategory['winning_ads']?.length) {
        sections.push('## Winning Facebook Ads (Currently Running)\n\n' +
          byCategory['winning_ads'].map(r => `### ${r.title}\n${r.content}`).join('\n\n'))
      }
      if (sections.length > 0) {
        dynamicDocs = `\n\n---\n\n# LIVE KNOWLEDGE BASE (updated from web)\n\n${sections.join('\n\n')}`
      }
    }
  } catch (err) {
    console.warn('KB Supabase fetch failed (using static KB only):', (err as Error).message)
  }

  return `You are a knowledgeable advisor for a B2B marketing agency selling Facebook Ads and Google Ads to immigration law firms.

You have access to a detailed paid ads acquisition knowledge base below, plus live-updated intelligence gathered this week from legal marketing blogs and winning Facebook ads. Answer questions using both as your primary sources. Be specific, direct, and reference actual numbers and frameworks when relevant.

When relevant, mention specific benchmarks (e.g. "$8-25 per lead on Facebook vs $50-150 on Google", "70-80% quarterly prepay rate", etc.).

If a question is not covered in the KB, say so clearly rather than making things up.

# CORE KNOWLEDGE BASE

${KB_FULL}${dynamicDocs}

Keep answers concise but complete. Use plain language. Speak like a peer sharing real hard-won knowledge, not like a consultant.`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { question?: string; messages?: ChatMessage[] }
  const { question, messages = [] } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }

  const system = await buildSystem()

  const history = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.text,
  }))

  const anthropicMessages = [
    ...history,
    { role: 'user' as const, content: question.trim() },
  ]

  try {
    const message = await ai.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: anthropicMessages,
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Ask KB error:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
