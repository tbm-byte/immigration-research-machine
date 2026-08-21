import { NextRequest, NextResponse } from 'next/server'
import { ai, MODEL } from '@/lib/ai'
import type { SavedResearch } from '@/lib/constants'

export type ResearchResult = Omit<SavedResearch, 'id' | 'created_at' | 'query'>

// ── Fetch Google News RSS ────────────────────────────────────────────────────
async function fetchGoogleNewsRss(query: string): Promise<Array<{ title: string; link: string; description: string; source: string }>> {
  const encoded = encodeURIComponent(query)
  const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'ImmigrationResearchBot/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()

    const items: Array<{ title: string; link: string; description: string; source: string }> = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const block = match[1]
      const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) ?? /<title>([\s\S]*?)<\/title>/.exec(block))?.[1]?.trim() ?? ''
      const link = (/<link>([\s\S]*?)<\/link>/.exec(block))?.[1]?.trim() ?? ''
      const desc = (/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block) ?? /<description>([\s\S]*?)<\/description>/.exec(block))?.[1]?.trim() ?? ''
      const source = (/<source[^>]*>([\s\S]*?)<\/source>/.exec(block))?.[1]?.trim() ?? 'Google News'
      if (title && link) items.push({ title, link, description: desc.replace(/<[^>]*>/g, ' ').substring(0, 600), source })
    }
    return items
  } catch {
    return []
  }
}

// ── Fetch Reddit ─────────────────────────────────────────────────────────────
async function fetchRedditSearch(query: string): Promise<Array<{ title: string; link: string; description: string; source: string }>> {
  try {
    const encoded = encodeURIComponent(query)
    const url = `https://www.reddit.com/r/immigration+USCIS+ImmigrationLaw+h1b/search.json?q=${encoded}&sort=relevance&t=week&limit=5`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ImmigrationResearchBot/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json() as { data?: { children?: Array<{ data?: { title?: string; permalink?: string; selftext?: string; subreddit?: string } }> } }
    return (data.data?.children ?? [])
      .filter(p => p.data?.title && p.data.permalink)
      .slice(0, 4)
      .map(p => ({
        title: p.data!.title!,
        link: `https://reddit.com${p.data!.permalink}`,
        description: (p.data!.selftext ?? '').substring(0, 500),
        source: `Reddit r/${p.data!.subreddit ?? 'immigration'}`,
      }))
  } catch {
    return []
  }
}

// ── Batch analyse with Claude — one call for all articles ────────────────────
async function batchAnalyse(query: string, articles: Array<{ title: string; link: string; description: string; source: string }>): Promise<ResearchResult[]> {
  const articlesJson = articles.map((a, i) => `${i + 1}. Title: ${a.title}\n   Source: ${a.source}\n   Content: ${a.description}`).join('\n\n')

  const prompt = `You are a research analyst for an immigration law firm marketing agency.

User query: "${query}"

Analyse EACH of the following ${articles.length} articles. For each one, return a JSON object. Respond with ONLY a JSON array of objects (no markdown, no extra text).

ARTICLES:
${articlesJson}

JSON schema for each item:
{
  "index": 1,
  "relevance_score": 1-10,
  "headline": "the article title",
  "source": "the source name",
  "url": "the article URL (use placeholder if not given)",
  "summary": "2-3 sentence summary focused on immigration law firm marketing",
  "impact_analysis": "How does this affect immigration law firms or their clients?",
  "action_strategy": "1 concrete marketing/sales action to take based on this insight",
  "pitch_angle": "One-line hook to use when pitching immigration firms on this topic",
  "social_post_angles": ["post idea 1", "post idea 2", "post idea 3"]
}

Only include items where relevance_score >= 5. If an article is irrelevant, omit it entirely.
Return just the array, no wrapper object.`

  try {
    const message = await ai.messages.create({
      model: MODEL,
      max_tokens: 2500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(clean) as Array<{
      index: number
      relevance_score: number
      headline: string
      source: string
      url: string
      summary: string
      impact_analysis: string
      action_strategy: string
      pitch_angle: string
      social_post_angles: string[]
    }>

    return parsed
      .filter(r => r.relevance_score >= 5)
      .map(r => {
        // Use original URL from fetched articles if available
        const original = articles[r.index - 1]
        return {
          headline: r.headline,
          source: r.source,
          url: original?.link ?? r.url,
          summary: r.summary ?? '',
          impact_analysis: r.impact_analysis ?? '',
          action_strategy: r.action_strategy ?? '',
          pitch_angle: r.pitch_angle ?? '',
          social_post_angles: r.social_post_angles ?? [],
          relevance_score: r.relevance_score,
        }
      })
      .sort((a, b) => b.relevance_score - a.relevance_score)
  } catch {
    return []
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json() as { query?: string }
    if (!query || query.trim().length < 3) {
      return NextResponse.json({ error: 'query required (min 3 chars)' }, { status: 400 })
    }

    const trimmed = query.trim()

    // Fetch from multiple sources in parallel
    const [newsItems, redditItems] = await Promise.all([
      fetchGoogleNewsRss(trimmed),
      fetchRedditSearch(trimmed),
    ])

    const allItems = [...newsItems, ...redditItems].slice(0, 10)
    if (allItems.length === 0) {
      return NextResponse.json({ results: [], query: trimmed, total: 0 })
    }

    // Single batched Claude call — faster and cheaper than per-article calls
    const results = await batchAnalyse(trimmed, allItems)

    return NextResponse.json({ results, query: trimmed, total: results.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
