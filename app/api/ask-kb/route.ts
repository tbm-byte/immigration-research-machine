import { NextRequest, NextResponse } from 'next/server'
import { ai, MODEL } from '@/lib/ai'
import { KB_FULL } from '@/src/kb'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

const SYSTEM = `You are a knowledgeable advisor for a B2B marketing agency selling Facebook Ads and Google Ads to immigration law firms.

You have access to a detailed paid ads acquisition knowledge base below. Answer questions using this knowledge base as your primary source. Be specific, direct, and reference actual numbers and frameworks from the KB when relevant.

When relevant, mention specific benchmarks (e.g. "$8-25 per lead on Facebook vs $50-150 on Google", "70-80% quarterly prepay rate", etc.).

If a question is not covered in the KB, say so clearly rather than making things up.

KNOWLEDGE BASE:
${KB_FULL}

Keep answers concise but complete. Use plain language. Speak like a peer sharing real hard-won knowledge, not like a consultant.`

export async function POST(req: NextRequest) {
  const body = await req.json() as { question?: string; messages?: ChatMessage[] }
  const { question, messages = [] } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }

  // Build conversation history for multi-turn memory
  const history = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.text,
  }))

  // Append current question
  const anthropicMessages = [
    ...history,
    { role: 'user' as const, content: question.trim() },
  ]

  try {
    const message = await ai.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM,
      messages: anthropicMessages,
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Ask KB error:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
