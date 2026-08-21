import { NextRequest, NextResponse } from 'next/server'
import { scrapeLeads } from '@/src/lead-scraper'
import { scrapeFbAdsLeads } from '@/src/fb-ads-scraper'
import { getDQKeys, getDQReasonCounts, dqKey } from '@/src/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    keywords?:  string[]
    location?:  string
    platforms?: ('instagram' | 'linkedin' | 'facebook')[]
    limit?:     number
    // Facebook Ads options
    country?:     string
    adsPerUrl?:   number
    activeOnly?:  boolean
  }

  const keywords  = body.keywords  ?? ['immigration attorney', 'immigration lawyer']
  const location  = body.location  ?? 'United States'
  const platforms = body.platforms ?? ['instagram', 'linkedin']
  const limit     = Math.min(Math.max(body.limit ?? 50, 10), 250)

  if (!process.env.APIFY_API_KEY) {
    return NextResponse.json(
      { error: 'APIFY_API_KEY not set — add it to .env to enable lead scraping.' },
      { status: 400 },
    )
  }

  try {
    // Fetch DQ data in parallel with lead scraping
    const [dqKeys, dqReasonCounts] = await Promise.all([
      getDQKeys().catch(() => new Set<string>()),
      getDQReasonCounts().catch(() => ({} as Record<string, number>)),
    ])

    // Adaptive scoring: if "Too large" is the top DQ reason, pass a stricter size cap
    const topDQReason = Object.entries(dqReasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const strictSize = topDQReason === 'Too large' && (dqReasonCounts['Too large'] ?? 0) >= 3

    // Separate facebook from IG/LinkedIn platforms
    const socialPlatforms = platforms.filter(
      (p): p is 'instagram' | 'linkedin' => p === 'instagram' || p === 'linkedin',
    )
    const includeFacebook = platforms.includes('facebook')

    const [socialLeads, fbLeads] = await Promise.allSettled([
      socialPlatforms.length > 0
        ? scrapeLeads({ keywords, location, platforms: socialPlatforms, limit })
        : Promise.resolve([]),
      includeFacebook
        ? scrapeFbAdsLeads({
            keywords,
            country:    body.country   ?? 'US',
            limit:      Math.ceil(limit / (socialPlatforms.length > 0 ? 2 : 1)),
            adsPerUrl:  body.adsPerUrl ?? 60,
            activeOnly: body.activeOnly ?? true,
          })
        : Promise.resolve([]),
    ])

    const allLeads = [
      ...(socialLeads.status === 'fulfilled' ? socialLeads.value : []),
      ...(fbLeads.status     === 'fulfilled' ? fbLeads.value     : []),
    ]

    // Filter out DQ'd leads (exact match on platform:handle or platform:firm_name)
    const leads = allLeads.filter(l => {
      const key = dqKey(l.platform, l.social_handle, l.firm_name)
      if (dqKeys.has(key)) return false
      // Adaptive: if "Too large" is dominant, also auto-filter very large firms
      if (strictSize && l.follower_count != null && l.follower_count > 20_000) return false
      return true
    })

    const dqFiltered = allLeads.length - leads.length

    const errors: string[] = []
    if (socialLeads.status === 'rejected') errors.push(`Social: ${(socialLeads.reason as Error).message}`)
    if (fbLeads.status     === 'rejected') errors.push(`FB Ads: ${(fbLeads.reason     as Error).message}`)

    return NextResponse.json({
      leads,
      count: leads.length,
      dqFiltered,
      topDQReason: topDQReason ?? null,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
