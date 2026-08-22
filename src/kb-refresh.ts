/**
 * KB Refresh — updates the internal Knowledge Base in Supabase.
 *
 * Pulls from two sources:
 *  1. Legal marketing RSS feeds (already in sources.ts) → summarised into dense KB entries
 *  2. Winning FB ads (running ≥ 30 days) from the Ads Library → saved as patterns
 *
 * Run via: `app/api/kb/refresh/route.ts` or directly with `tsx src/kb-refresh.ts`
 */

import crypto from 'crypto'
import { upsertKbDocuments, getKbDocumentHashes, type KbDocument } from './supabase'
import { SOURCES } from './sources'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const APIFY_KEY     = process.env.APIFY_API_KEY
const MODEL         = 'claude-haiku-4-5-20251001'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 40)
}

async function fetchRss(url: string, maxItems = 3): Promise<Array<{ title: string; link: string; content: string }>> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'IRM-KB-Refresh/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const xml = await res.text()

    const items: Array<{ title: string; link: string; content: string }> = []
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)
    for (const m of itemMatches) {
      if (items.length >= maxItems) break
      const block = m[1]
      const title   = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1]
                    ?? block.match(/<title>(.*?)<\/title>/i)?.[1] ?? '').trim()
      const link    = (block.match(/<link>(.*?)<\/link>/i)?.[1]
                    ?? block.match(/<guid>(https?:\/\/.*?)<\/guid>/i)?.[1] ?? '').trim()
      const desc    = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1]
                    ?? block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '').trim()
      const stripped = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)
      if (title && (link || stripped)) items.push({ title, link, content: stripped })
    }
    return items
  } catch {
    return []
  }
}

async function summariseWithClaude(source: string, title: string, body: string): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are curating a knowledge base for a B2B agency that sells Facebook and Google Ads to immigration law firms.

Extract the single most useful, actionable insight from this article for law firm marketing. Be dense and specific — include any numbers, tactics, or frameworks mentioned. Skip fluff.

Source: ${source}
Title: ${title}
Content: ${body}

Write 3–5 sentences max. Start directly with the insight — no preamble.`,
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { content?: Array<{ type: string; text: string }> }
    return data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : null
  } catch {
    return null
  }
}

// ── Part 1: Legal Marketing RSS ───────────────────────────────────────────────

async function refreshLegalMarketingRss(): Promise<KbDocument[]> {
  console.log('📚 Fetching legal marketing RSS feeds…')

  const legalSources = SOURCES.filter(s =>
    (s.category === 'Legal Marketing' || s.category === 'General Marketing') &&
    s.feedType === 'rss'
  )

  const docs: KbDocument[] = []
  for (const src of legalSources) {
    const items = await fetchRss(src.url, Math.min(src.maxArticles ?? 2, 3))
    for (const item of items) {
      const summary = await summariseWithClaude(src.name, item.title, item.content)
      if (!summary) continue

      const content = `[${src.name}] ${item.title}\n\n${summary}\n\nSource: ${item.link}`
      const doc: KbDocument = {
        source:       src.name,
        title:        item.title,
        content,
        content_hash: hash(content),
        category:     'legal_marketing',
      }
      docs.push(doc)
    }
    await new Promise(r => setTimeout(r, 500)) // gentle rate limiting
  }

  console.log(`  → ${docs.length} legal marketing docs ready`)
  return docs
}

// ── Part 2: Winning FB Ads (running ≥ 30 days) ───────────────────────────────

async function refreshWinningAds(): Promise<KbDocument[]> {
  if (!APIFY_KEY) {
    console.log('⚠ Skipping winning ads — no APIFY_API_KEY')
    return []
  }

  console.log('🏆 Fetching winning Facebook Ads (≥30 days)…')
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: ['immigration attorney', 'immigration lawyer', 'deportation defense', 'visa attorney'],
          adType: 'ALL',
          country: 'US',
          activeStatus: 'ACTIVE',
          startDateMin: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), // 90 days ago
          maxItems: 100,
        }),
      }
    )
    if (!runRes.ok) throw new Error(`Apify start failed: ${runRes.status}`)
    const runData = await runRes.json() as { data?: { id?: string } }
    const runId   = runData.data?.id
    if (!runId) throw new Error('No run ID from Apify')

    // Poll until done (max 3 min)
    let attempt = 0
    while (attempt++ < 36) {
      await new Promise(r => setTimeout(r, 5_000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)
      const statusData = await statusRes.json() as { data?: { status?: string } }
      if (statusData.data?.status === 'SUCCEEDED') break
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData.data?.status ?? '')) {
        throw new Error(`Apify run ${statusData.data?.status}`)
      }
    }

    const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&clean=true`)
    const ads = await itemsRes.json() as Array<Record<string, unknown>>

    // Filter to ads running ≥ 30 days
    const now = Date.now()
    const winners = ads.filter(ad => {
      const start = ad.startDate ? new Date(ad.startDate as string).getTime() : null
      return start && (now - start) / 864e5 >= 30
    })

    console.log(`  → ${winners.length} winning ads (of ${ads.length} fetched)`)

    const docs: KbDocument[] = []
    for (const ad of winners.slice(0, 50)) {
      const pageName    = String(ad.pageName ?? ad.pageId ?? 'Unknown firm')
      const adText      = String(ad.adCreativeBody ?? ad.adCreativeTitle ?? '').slice(0, 800)
      const daysLive    = ad.startDate ? Math.floor((now - new Date(ad.startDate as string).getTime()) / 864e5) : null
      const categories  = Array.isArray(ad.adCategories) ? (ad.adCategories as string[]).join(', ') : ''

      if (!adText) continue

      const content = `[Winning FB Ad – ${daysLive ?? '?'} days running]\n\nFirm: ${pageName}\n${categories ? `Categories: ${categories}\n` : ''}Ad copy:\n${adText}`
      const doc: KbDocument = {
        source:       'Meta Ads Library',
        title:        `Winning Ad: ${pageName}`,
        content,
        content_hash: hash(content),
        category:     'winning_ads',
      }
      docs.push(doc)
    }
    return docs
  } catch (err) {
    console.warn('  ⚠ Winning ads fetch failed:', (err as Error).message)
    return []
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runKbRefresh(): Promise<{ added: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  const allDocs: KbDocument[] = []

  try {
    const rssResult = await refreshLegalMarketingRss()
    allDocs.push(...rssResult)
  } catch (err) {
    errors.push(`RSS: ${(err as Error).message}`)
  }

  try {
    const adsResult = await refreshWinningAds()
    allDocs.push(...adsResult)
  } catch (err) {
    errors.push(`Ads: ${(err as Error).message}`)
  }

  if (allDocs.length === 0) {
    return { added: 0, skipped: 0, errors }
  }

  // Dedup against existing docs
  const existingHashes = await getKbDocumentHashes().catch(() => new Set<string>())
  const newDocs   = allDocs.filter(d => !existingHashes.has(d.content_hash))
  const skipped   = allDocs.length - newDocs.length

  let added = 0
  if (newDocs.length > 0) {
    added = await upsertKbDocuments(newDocs)
  }

  console.log(`✅ KB refresh done — ${added} new docs, ${skipped} unchanged, ${errors.length} errors`)
  return { added, skipped, errors }
}
