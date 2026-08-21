import { NextResponse } from 'next/server'
import { SOURCES } from '../../../src/sources'
import { fetchSource } from '../../../src/parser'
import { computeHash } from '../../../src/hasher'
import { getExistingHashes, insertInsights } from '../../../src/supabase'
import { analyzeWithClaude } from '../../../src/anthropic'
import { buildPrompt } from '../../../src/prompts'
import { fetchApifyInsights } from '../../../src/apify'
import type { RawArticle, ProcessedInsight } from '../../../src/types'

const BATCH_SIZE = 3
const BATCH_DELAY_MS = 2000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function processBatch(articles: RawArticle[]): Promise<ProcessedInsight[]> {
  const settled = await Promise.allSettled(
    articles.map(async (article): Promise<ProcessedInsight | null> => {
      const output = await analyzeWithClaude(buildPrompt(article))
      if (!output) return null
      const insight: ProcessedInsight = {
        headline:           article.headline,
        source_url:         article.sourceUrl,
        source_origin:      article.sourceName,
        source_category:    article.sourceCategory,
        published_at:       article.publishedAt,
        raw_content:        article.rawContent,
        summary:            output.summary,
        impact_analysis:    output.impact_analysis,
        action_strategy:    output.action_strategy,
        training_note:      output.training_note ?? '',
        pitch_angle:        output.pitch_angle ?? '',
        social_post_angles: output.social_post_angles ?? [],
        dm_opener:          output.dm_opener ?? '',
        processed_by:       'claude-haiku-4-5-20251001',
        content_hash:       computeHash(article.headline, article.sourceName),
        run_date:           new Date().toISOString().split('T')[0],
      }
      return insight
    })
  )
  const out: ProcessedInsight[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value !== null) out.push(r.value)
  }
  return out
}

export async function POST() {
  try {
    // Stage 1 — Fetch sources
    const fetched = await Promise.allSettled(SOURCES.map(fetchSource))
    let rawArticles = fetched
      .filter((r): r is PromiseFulfilledResult<RawArticle[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    // Stage 1b — Apify enrichment
    if (process.env.APIFY_API_KEY) {
      const apifyArticles = await fetchApifyInsights()
      rawArticles = [...rawArticles, ...apifyArticles]
    }

    // Stage 2 — Deduplicate
    const hashes = rawArticles.map(a => computeHash(a.headline, a.sourceName))
    const seen = await getExistingHashes(hashes)
    const newArticles = rawArticles.filter(a => !seen.has(computeHash(a.headline, a.sourceName)))

    if (newArticles.length === 0) {
      return NextResponse.json({ added: 0, message: 'No new content — brief is already up to date.' })
    }

    // Stage 3 — Claude analysis
    const insights: ProcessedInsight[] = []
    for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
      const batch = newArticles.slice(i, i + BATCH_SIZE)
      insights.push(...await processBatch(batch))
      if (i + BATCH_SIZE < newArticles.length) await sleep(BATCH_DELAY_MS)
    }

    // Stage 4 — Save
    const ids = await insertInsights(insights)

    return NextResponse.json({
      added: ids.length,
      message: `Brief updated — ${ids.length} new insight${ids.length === 1 ? '' : 's'} added.`,
    })
  } catch (err) {
    console.error('run-brief error:', err)
    return NextResponse.json({ error: 'Pipeline failed. Check server logs.' }, { status: 500 })
  }
}
