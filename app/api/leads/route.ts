import { NextRequest, NextResponse } from 'next/server'
import { scrapeLeads } from '@/src/lead-scraper'
import { scrapeFbAdsLeads } from '@/src/fb-ads-scraper'

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

    const leads = [
      ...(socialLeads.status === 'fulfilled' ? socialLeads.value : []),
      ...(fbLeads.status     === 'fulfilled' ? fbLeads.value     : []),
    ]

    const errors: string[] = []
    if (socialLeads.status === 'rejected') errors.push(`Social: ${(socialLeads.reason as Error).message}`)
    if (fbLeads.status     === 'rejected') errors.push(`FB Ads: ${(fbLeads.reason     as Error).message}`)

    return NextResponse.json({
      leads,
      count: leads.length,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
