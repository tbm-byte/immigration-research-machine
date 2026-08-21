import { NextRequest, NextResponse } from 'next/server'
import { ai, MODEL } from '@/lib/ai'
import { KB_ORGANIC } from '@/src/kb'
import type { ContentIdea } from '@/lib/constants'

export type { ContentIdea }

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    headline?: string
    summary?: string
    category?: string
    source_origin?: string
  }

  const { headline, summary, category, source_origin } = body

  if (!headline?.trim()) {
    return NextResponse.json({ error: 'headline required' }, { status: 400 })
  }

  const prompt = `You are a social media content strategist for an immigration law firm marketing agency.
You create Instagram/LinkedIn content using the organic posting framework below.

ORGANIC STRATEGY:
${KB_ORGANIC}

NEWS INSIGHT TO RIFF ON:
Headline: ${headline}
Category: ${category ?? 'General'}
Source: ${source_origin ?? 'Unknown'}
Summary: ${summary ?? 'Not provided'}

Generate exactly 5 content post ideas based on this news insight.
Each idea must be a concrete, post-ready concept for the AGENCY's Instagram or LinkedIn.

Respond with ONLY a valid JSON array — no markdown, no text outside the array:
[
  {
    "funnel_stage": "TOF",
    "format": "Talking Head Reel",
    "hook": "The opening line or visual/verbal hook (under 15 words, punchy)",
    "caption_start": "First 2 sentences of the caption that would appear below the video",
    "negative_frame": true
  }
]

Rules:
- Mix funnel stages: aim for 3 TOF, 1 MOF, 1 BOF
- Mix formats: Talking Head Reel, Carousel, Short Reel (<30s), Story Sequence, Static Image
- negative_frame: true if the hook uses negative/fear/loss framing ("Why X fails", "Stop doing Y")
- Hooks must be specific and use the news as a timing hook where possible
- Make it about immigration law firm owners — speak their language
- Each post should be standalone and actionable without reading the news article
- The agency talks TO firm owners, not about them`

  try {
    const message = await ai.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const clean = raw
      .replace(/^```json\n?/m, '')
      .replace(/^```\n?/m, '')
      .replace(/```$/m, '')
      .trim()

    const ideas = JSON.parse(clean) as ContentIdea[]
    return NextResponse.json({ ideas })
  } catch (err) {
    console.error('Content ideas error:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
