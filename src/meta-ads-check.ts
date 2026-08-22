/**
 * Meta Ads check — uses the Apify `curious_coder/facebook-ads-library-scraper`
 * actor to check if IG firms are running active Meta ads.
 *
 * Reuses APIFY_API_KEY — no extra token needed.
 * Cost: $0.75 / 1,000 ads scraped. Capped at 10 ads per firm = ~$0.0075/firm.
 *
 * Strategy: one Apify run with N search URLs (one per firm), then map
 * results back by which input URL each ad came from.
 */

const APIFY_KEY  = process.env.APIFY_API_KEY
const ACTOR_ID   = 'curious_coder~facebook-ads-library-scraper'
const APIFY_BASE = 'https://api.apify.com/v2'

// How many ads to pull per firm (keep low to limit cost + latency)
const ADS_PER_FIRM = 10

export interface MetaAdsResult {
  meta_ads_active: boolean
  fb_ad_count:     number
  fb_page_id:      string | null
  fb_page_name:    string | null
  fb_page_url:     string | null
}

/** Build a Meta Ads Library search URL for a given firm name / handle */
function buildSearchUrl(searchTerm: string): string {
  const clean = searchTerm.replace(/^@/, '').trim()
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type:       'all',
    country:       'US',
    q:             clean,
  })
  return `https://www.facebook.com/ads/library/?${params.toString()}`
}

interface ApifyAdItem {
  url?:      string   // which input URL this item came from (injected by actor)
  pageName?: string
  pageId?:   string
  pageUrl?:  string
  snapshot_url?: string
  [key: string]: unknown
}

/**
 * Check an array of IG firms against the Meta Ads Library via Apify.
 * @param firms - { key, searchTerm } pairs — key is used for the output Map
 * @returns Map of key → MetaAdsResult (only firms with hits are included)
 */
export async function checkMetaAds(
  firms: Array<{ key: string; searchTerm: string }>
): Promise<Map<string, MetaAdsResult>> {
  if (!APIFY_KEY || firms.length === 0) return new Map()

  const unique = firms.filter(f => f.searchTerm.trim())
  if (unique.length === 0) return new Map()

  // Build one search URL per firm and remember the mapping
  const urlToKey: Record<string, string> = {}
  const inputUrls: string[] = []

  for (const f of unique) {
    const url = buildSearchUrl(f.searchTerm)
    inputUrls.push(url)
    urlToKey[url] = f.key
  }

  console.log(`  📱 Meta Ads check: running Apify actor for ${unique.length} IG firms…`)

  try {
    // Start the actor run
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls:             inputUrls,
          limitPerInputUrl: ADS_PER_FIRM,
          totalRecords:     unique.length * ADS_PER_FIRM,
          scrapeAdDetails:  false,  // faster, we only need page info
        }),
      }
    )
    if (!runRes.ok) {
      const txt = await runRes.text()
      console.warn(`  ⚠ Meta Ads actor start failed ${runRes.status}: ${txt.slice(0, 200)}`)
      return new Map()
    }
    const runData = await runRes.json() as { data?: { id?: string } }
    const runId   = runData.data?.id
    if (!runId) throw new Error('No run ID from Apify (meta ads check)')

    // Poll until done (max 3 min — 60s should be plenty for small batch)
    let done = false
    for (let attempt = 0; attempt < 36; attempt++) {
      await new Promise(r => setTimeout(r, 5_000))
      const statusRes  = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_KEY}`)
      const statusData = await statusRes.json() as { data?: { status?: string } }
      const status     = statusData.data?.status ?? ''
      if (status === 'SUCCEEDED') { done = true; break }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
        console.warn(`  ⚠ Meta Ads actor run ${status}`)
        return new Map()
      }
    }

    if (!done) {
      console.warn('  ⚠ Meta Ads actor timed out waiting')
      return new Map()
    }

    // Fetch items
    const itemsRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&clean=true`
    )
    const items = await itemsRes.json() as ApifyAdItem[]

    // Group items by source URL
    // The actor includes the source URL in each item as `url` or a similar field
    const adsByKey: Record<string, ApifyAdItem[]> = {}

    for (const item of items) {
      // Try to find which firm this ad belongs to by matching the source URL
      const sourceUrl = item.url ?? item.snapshot_url ?? ''

      // Find the closest matching input URL (the actor may encode/trim the URL)
      let matchedKey: string | null = null
      for (const [inputUrl, key] of Object.entries(urlToKey)) {
        // Match by the q= search param (firm name) appearing in the source URL
        const qParam = new URL(inputUrl).searchParams.get('q') ?? ''
        if (qParam && sourceUrl.includes(encodeURIComponent(qParam))) {
          matchedKey = key
          break
        }
        // Fallback: match by pageName containing the search term
        if (qParam && item.pageName?.toLowerCase().includes(qParam.toLowerCase())) {
          matchedKey = key
          break
        }
      }

      // Last resort: try to match by pageName substring against firm search terms
      if (!matchedKey && item.pageName) {
        for (const f of unique) {
          const term = f.searchTerm.replace(/^@/, '').toLowerCase()
          if (
            item.pageName.toLowerCase().includes(term) ||
            term.includes(item.pageName.toLowerCase().slice(0, 8))
          ) {
            matchedKey = f.key
            break
          }
        }
      }

      if (matchedKey) {
        ;(adsByKey[matchedKey] ??= []).push(item)
      }
    }

    // Build result map
    const resultMap = new Map<string, MetaAdsResult>()
    for (const [key, ads] of Object.entries(adsByKey)) {
      const first    = ads[0]
      const pageId   = first.pageId ?? null
      const pageName = first.pageName ?? null

      resultMap.set(key, {
        meta_ads_active: ads.length > 0,
        fb_ad_count:     ads.length,
        fb_page_id:      pageId,
        fb_page_name:    pageName,
        fb_page_url:     first.pageUrl ?? (pageId ? `https://www.facebook.com/${pageId}` : null),
      })
    }

    console.log(`  📱 Meta Ads check: ${resultMap.size}/${unique.length} firms have active ads`)
    return resultMap

  } catch (err) {
    console.warn('  ⚠ Meta Ads Apify check failed:', (err as Error).message)
    return new Map()
  }
}
