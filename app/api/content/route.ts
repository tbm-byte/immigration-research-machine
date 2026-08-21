import { NextRequest, NextResponse } from 'next/server'
import { ai, MODEL } from '@/lib/ai'
import { KB_ORGANIC } from '@/src/kb'
import type { ContentIdea } from '@/lib/constants'

// POST /api/content — generate content ideas from a free topic input
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    topic?: string
    format?: string
    funnel_stage?: 'TOF' | 'MOF' | 'BOF' | 'all'
    count?: number
  }

  const { topic, format, funnel_stage = 'all', count = 10 } = body

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'topic required' }, { status: 400 })
  }

  const formatFilter = format && format !== 'all' ? `All ideas must use the format: "${format}".` : ''
  const stageFilter = funnel_stage !== 'all'
    ? `All ideas must be ${funnel_stage} (${funnel_stage === 'TOF' ? 'top of funnel – awareness' : funnel_stage === 'MOF' ? 'middle of funnel – consideration' : 'bottom of funnel – conversion'}).`
    : 'Mix the funnel stages: roughly 50% TOF, 30% MOF, 20% BOF.'

  const prompt = `You are a social media content strategist for a B2B marketing agency that sells Facebook Ads and Google Ads to immigration law firms.

ORGANIC POSTING STRATEGY:
${KB_ORGANIC}

TOPIC TO CREATE CONTENT ABOUT: "${topic.trim()}"

${stageFilter}
${formatFilter}

Generate exactly ${count} concrete, post-ready content ideas for Instagram and LinkedIn.
These are posts FROM the agency TO immigration law firm owners.

Respond with ONLY a valid JSON array, no markdown:
[
  {
    "funnel_stage": "TOF",
    "format": "Talking Head Reel",
    "hook": "Opening line/visual hook (punchy, under 15 words)",
    "caption_start": "First 2 sentences of the caption",
    "negative_frame": false
  }
]

Formats to use: Talking Head Reel, Carousel (3-7 slides), Short Reel (<30s), Story Sequence (3-5 stories), Static Quote Card, Listicle Post
negative_frame = true if hook uses fear/loss/problem framing ("Why X is killing your firm", "Stop doing Y")`

  try {
    const message = await ai.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const ideas = JSON.parse(clean) as ContentIdea[]
    return NextResponse.json({ ideas })
  } catch (err) {
    console.error('Content generation error:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
