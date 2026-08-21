/**
 * Apify integration — optional enrichment layer.
 * Requires APIFY_API_KEY in .env.
 *
 * Sources:
 *  1. Facebook Ads Library — competitor ad intelligence
 *  2. Twitter/X          — immigration news + attorney posts
 *  3. Reddit             — high-signal community posts (Apify fallback)
 *  4. YouTube            — immigration law channel updates
 *
 * NOTE: Google News is now fetched via direct RSS in sources.ts — no Apify needed.
 */

import { RawArticle } from './types'

const APIFY_BASE = 'https://api.apify.com/v2'
const API_KEY = process.env.APIFY_API_KEY

// ── Facebook Ads keywords ─────────────────────────────────────────────────────
const FB_ADS_KEYWORDS = [
  'immigration attorney',
  'immigration lawyer',
  'visa attorney',
  'deportation defense',
  'H-1B visa',
  'green card attorney',
  'DACA attorney',
  'asylum lawyer',
]

// ── Twitter/X search queries ──────────────────────────────────────────────────
const TWITTER_QUERIES = [
  '#immigrationlaw',
  '#USCIS',
  'immigration attorney tips',
  '#H1B 2026',
  '#DACA news',
  '#immigrationlawyer',
  'immigration law firm marketing',
]

// ── YouTube search terms ──────────────────────────────────────────────────────
const YOUTUBE_SEARCH_TERMS = [
  'immigration law 2026',
  'immigration attorney tips',
  'USCIS update 2026',
  'H1B visa tips',
  'green card process 2026',
]

async function runApifyActor(actorId: string, input: Record<string, unknown>, maxWaitMs = 120000): Promise<unknown[]> {
  const runRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!runRes.ok) {
    console.warn(`  ⚠ Apify ${actorId}: HTTP ${runRes.status}`)
    return []
  }

  const run = await runRes.json() as { data?: { id?: string } }
  const runId = run.data?.id
  if (!runId) { console.warn(`  ⚠ Apify ${actorId}: no runId in response`); return [] }

  const pollInterval = 5000
  const maxPolls = Math.ceil(maxWaitMs / pollInterval)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollInterval))
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${API_KEY}`)
    const status = await statusRes.json() as { data?: { status?: string; defaultDatasetId?: string } }
    const s = status.data?.status ?? ''
    if (s === 'SUCCEEDED') {
      const datasetId = status.data?.defaultDatasetId
      const dataRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${API_KEY}&limit=50`)
      const body = await dataRes.json()
      // Dataset API wraps items in { items: [...] } when content-type is json
      const items = (body as { items?: unknown[] }).items ?? body
      return Array.isArray(items) ? items : []
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(s)) {
      console.warn(`  ⚠ Apify ${actorId}: run ${s}`)
      break
    }
  }
  return []
}

// ── 1. Facebook Ads Library ───────────────────────────────────────────────────
async function fetchFbAds(): Promise<RawArticle[]> {
  const articles: RawArticle[] = []
  try {
    console.log('  📢 Scanning Facebook Ads Library...')
    const keyword = FB_ADS_KEYWORDS[Math.floor(Date.now() / 3600000) % FB_ADS_KEYWORDS.length]

    // apify~facebook-ads-scraper v2 input schema
    const ads = await runApifyActor('apify~facebook-ads-scraper', {
      searchTerms: [keyword],
      country: 'US',
      adStatus: 'ACTIVE',
      mediaType: 'all',
      maxResultsPerPage: 10,   // ← was "maxItems" (wrong field, caused 400)
    }) as Array<Record<string, unknown>>

    for (const ad of ads.slice(0, 5)) {
      const body = (ad.adCreativeBody ?? ad.adCreativeBody1 ?? ad.body ?? '') as string
      const pageName = (ad.pageName ?? ad.advertiserName ?? 'Immigration Firm') as string
      const url = (ad.url ?? ad.adUrl ?? `https://www.facebook.com/ads/library/?q=${encodeURIComponent(keyword)}`) as string
      const caption = (ad.adCreativeLinkCaption ?? ad.caption ?? '') as string
      if (body.length < 30) continue
      articles.push({
        headline: `[FB Ad] ${pageName}: "${body.substring(0, 80)}..."`,
        sourceUrl: url,
        sourceName: `Facebook Ads Library (${keyword})`,
        sourceCategory: 'Paid Media',
        publishedAt: new Date().toISOString(),
        rawContent: `Advertiser: ${pageName}\n\nAd Copy:\n${body}\n\nCaption: ${caption}`,
      })
    }
    console.log(`    → ${articles.length} competitor ads found`)
  } catch (err) {
    console.warn('  ⚠ Facebook Ads Library failed:', (err as Error).message)
  }
  return articles
}

// ── 2. Twitter/X — immigration news & attorney posts ─────────────────────────
// Uses apidojo~tweet-scraper (quacker~twitter-search was removed/404)
async function fetchTwitter(): Promise<RawArticle[]> {
  const articles: RawArticle[] = []
  try {
    console.log('  🐦 Scanning Twitter/X for immigration content...')
    const query = TWITTER_QUERIES[Math.floor(Date.now() / 3600000) % TWITTER_QUERIES.length]

    const tweets = await runApifyActor('apidojo~tweet-scraper', {
      searchTerms: [query],
      maxItems: 20,
      queryType: 'Latest',
      lang: 'en',
    }) as Array<Record<string, unknown>>

    for (const tweet of tweets) {
      // Handle both old (quacker) and new (apidojo) field name conventions
      const text = (tweet.full_text ?? tweet.text ?? '') as string
      if (text.length < 40) continue

      // Author info — apidojo nests under author{}, quacker under user{}
      const author = (tweet.author ?? tweet.user ?? {}) as Record<string, unknown>
      const displayName = (author.name ?? 'Unknown') as string
      const screenName = (author.userName ?? author.screen_name ?? '') as string

      // URL / ID
      const tweetUrl = (tweet.url ?? (tweet.id_str
        ? `https://twitter.com/${screenName}/status/${tweet.id_str}`
        : 'https://twitter.com')) as string

      const likes = ((tweet.likeCount ?? tweet.favorite_count ?? 0) as number)
      const retweets = ((tweet.retweetCount ?? tweet.retweet_count ?? 0) as number)
      const createdAt = (tweet.createdAt ?? tweet.created_at ?? null) as string | null

      articles.push({
        headline: `[Twitter] ${displayName}: "${text.substring(0, 100)}..."`,
        sourceUrl: tweetUrl,
        sourceName: `Twitter/X (${query})`,
        sourceCategory: 'Immigration News',
        publishedAt: createdAt,
        rawContent: `Author: @${screenName} (${likes} likes, ${retweets} retweets)\n\n${text}`,
      })
    }
    console.log(`    → ${articles.length} tweets found`)
  } catch (err) {
    console.warn('  ⚠ Twitter/X scrape failed:', (err as Error).message)
  }
  return articles
}

// ── 3. Reddit top posts (Apify fallback) ─────────────────────────────────────
// startUrls must be array of { url: string } objects, NOT bare strings
async function fetchRedditApify(): Promise<RawArticle[]> {
  const articles: RawArticle[] = []
  try {
    console.log('  🟠 Scanning Reddit immigration communities...')
    const subreddits = ['immigration', 'USCIS', 'ImmigrationLaw', 'h1b']
    const subreddit = subreddits[Math.floor(Date.now() / 3600000) % subreddits.length]

    const posts = await runApifyActor('trudax~reddit-scraper-lite', {
      startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/top/?t=day` }],  // ← was bare string (caused 400)
      maxItems: 10,
    }) as Array<Record<string, unknown>>

    for (const post of posts) {
      const title = (post.title ?? '') as string
      if (!title || title.length < 15) continue
      const url = (post.url ?? post.link ?? `https://reddit.com/r/${subreddit}`) as string
      const text = (post.text ?? post.body ?? title) as string
      const score = (post.score ?? post.ups ?? 0) as number
      const comments = (post.numberOfComments ?? post.num_comments ?? 0) as number
      const createdAt = (post.createdAt ?? post.created_utc
        ? new Date((post.created_utc as number) * 1000).toISOString()
        : null) as string | null

      articles.push({
        headline: `[Reddit r/${subreddit}] ${title}`,
        sourceUrl: url,
        sourceName: `Reddit r/${subreddit} (Apify)`,
        sourceCategory: 'Immigration News',
        publishedAt: createdAt,
        rawContent: `Score: ${score} | Comments: ${comments}\n\n${text}`,
      })
    }
    console.log(`    → ${articles.length} Reddit posts found`)
  } catch (err) {
    console.warn('  ⚠ Reddit Apify scrape failed:', (err as Error).message)
  }
  return articles
}

// ── 4. YouTube — immigration law channel updates ──────────────────────────────
async function fetchYouTube(): Promise<RawArticle[]> {
  const articles: RawArticle[] = []
  try {
    console.log('  📺 Scanning YouTube immigration channels...')
    const searchTerm = YOUTUBE_SEARCH_TERMS[Math.floor(Date.now() / 3600000) % YOUTUBE_SEARCH_TERMS.length]

    const videos = await runApifyActor('streamers~youtube-scraper', {
      searchKeywords: [searchTerm],
      maxResults: 8,
      sortBy: 'upload_date',
    }) as Array<Record<string, unknown>>

    for (const v of videos) {
      // Handle multiple possible field name conventions across actor versions
      const title = (v.title ?? v.videoTitle ?? '') as string
      const url = (v.url ?? v.videoUrl ?? v.watchUrl ?? '') as string
      if (!title || !url) continue

      const channelName = (v.channelName ?? v.channelTitle ?? (v.channel as Record<string,unknown>)?.name ?? 'Immigration Channel') as string
      const description = (v.description ?? v.shortDescription ?? '') as string
      const publishedAt = (v.publishedAt ?? v.uploadedAt ?? v.date ?? null) as string | null
      const viewCount = (v.viewCount ?? v.views ?? null) as number | null

      articles.push({
        headline: `[YouTube] ${title}`,
        sourceUrl: url,
        sourceName: `YouTube: ${channelName}`,
        sourceCategory: 'Legal Marketing',
        publishedAt,
        rawContent: `Channel: ${channelName} | Views: ${viewCount?.toLocaleString() ?? '?'}\n\n${description}`,
      })
    }
    console.log(`    → ${articles.length} YouTube videos found`)
  } catch (err) {
    console.warn('  ⚠ YouTube scrape failed:', (err as Error).message)
  }
  return articles
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchApifyInsights(): Promise<RawArticle[]> {
  if (!API_KEY) return []

  const [fbAds, twitter, reddit, youtube] = await Promise.allSettled([
    fetchFbAds(),
    fetchTwitter(),
    fetchRedditApify(),
    fetchYouTube(),
  ])

  const all: RawArticle[] = [
    ...(fbAds.status    === 'fulfilled' ? fbAds.value    : []),
    ...(twitter.status  === 'fulfilled' ? twitter.value  : []),
    ...(reddit.status   === 'fulfilled' ? reddit.value   : []),
    ...(youtube.status  === 'fulfilled' ? youtube.value  : []),
  ]

  console.log(`    → ${all.length} total from Apify sources`)
  return all
}
