import 'dotenv/config'
import { SOURCES } from './sources'
import { fetchSource } from './parser'
import { computeHash } from './hasher'
import { getExistingHashes, insertInsights } from './supabase'
import { analyzeWithClaude } from './anthropic'
import { buildPrompt } from './prompts'
import { fetchApifyInsights } from './apify'
import { RawArticle, ProcessedInsight } from './types'

const BATCH_SIZE = 3
const BATCH_DELAY_MS = 2000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function processBatch(articles: RawArticle[]): Promise<ProcessedInsight[]> {
  const results = await Promise.allSettled(
    articles.map(async (article) => {
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
      console.log(`  ✅ ${article.sourceName}: ${article.headline.substring(0, 55)}...`)
      return insight
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ProcessedInsight | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is ProcessedInsight => v !== null)
}

async function main() {
  const t0 = Date.now()
  console.log('\n🚀 Immigration Intelligence Pipeline v3')
  console.log(`   ${new Date().toISOString()}\n`)

  // Stage 1 — Fetch RSS/HTML sources
  console.log(`📡 Fetching ${SOURCES.length} sources...`)
  const fetched = await Promise.allSettled(SOURCES.map(fetchSource))
  let rawArticles = fetched
    .filter((r): r is PromiseFulfilledResult<RawArticle[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
  const failCount = fetched.filter(r => r.status === 'rejected').length
  console.log(`   ${rawArticles.length} articles from ${SOURCES.length - failCount}/${SOURCES.length} sources`)

  // Stage 1b — Optional Apify enrichment
  if (process.env.APIFY_API_KEY) {
    console.log('\n🕷️  Fetching Apify intelligence...')
    const apifyArticles = await fetchApifyInsights()
    console.log(`   ${apifyArticles.length} articles from Apify`)
    rawArticles = [...rawArticles, ...apifyArticles]
  }

  console.log('')

  // Stage 2 — Deduplicate
  console.log('🔍 Deduplicating...')
  const hashes = rawArticles.map(a => computeHash(a.headline, a.sourceName))
  const seen = await getExistingHashes(hashes)
  const newArticles = rawArticles.filter(a => !seen.has(computeHash(a.headline, a.sourceName)))
  console.log(`   ${newArticles.length} new (${rawArticles.length - newArticles.length} already seen)\n`)

  if (newArticles.length === 0) {
    console.log('ℹ️  No new content today. Done.')
    return
  }

  // Stage 3 — Claude AI analysis
  console.log(`🤖 Analyzing ${newArticles.length} articles with claude-haiku-4-5-20251001...`)
  const insights: ProcessedInsight[] = []

  for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
    const batch = newArticles.slice(i, i + BATCH_SIZE)
    const n = Math.floor(i / BATCH_SIZE) + 1
    const total = Math.ceil(newArticles.length / BATCH_SIZE)
    console.log(`  Batch ${n}/${total}`)
    insights.push(...await processBatch(batch))
    if (i + BATCH_SIZE < newArticles.length) await sleep(BATCH_DELAY_MS)
  }
  console.log(`   ${insights.length} saved (${newArticles.length - insights.length} filtered as low-relevance)\n`)

  // Stage 4 — Save to Supabase
  console.log('💾 Saving to Supabase...')
  const ids = await insertInsights(insights)
  console.log(`   ${ids.length} rows saved\n`)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`✅ Done in ${elapsed}s — ${ids.length} insights ready in the brief`)
}

main().catch(err => {
  console.error('❌ Pipeline failed:', err)
  process.exit(1)
})
