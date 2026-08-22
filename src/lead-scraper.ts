/**
 * Lead Scraper — finds immigration law firm prospects on Instagram and LinkedIn.
 *
 * Instagram:  Two-step:
 *   1. DrF9mzPPEuVizVF4l   → discover usernames from keyword search
 *   2. apify/instagram-profile-scraper  → enrich profiles (ID: dSCLg0C3YEZ83HzYX)
 *
 * LinkedIn:   harvestapi/linkedin-company-search (ID: taHaRcqil3scbchuI)
 *
 * Facebook:   See fb-ads-scraper.ts (curious_coder/facebook-ads-library-scraper)
 */

export interface FirmLead {
  firm_name:      string
  platform:       'instagram' | 'linkedin' | 'facebook'
  social_handle:  string | null
  profile_url:    string
  website_url:    string | null
  bio:            string | null
  follower_count: number | null
  location:       string | null
  contact_name:   string | null

  // ── Facebook Ads only ────────────────────────────────────────────────────
  fit_score?:      number         // 0–10
  wave?:           string         // "WAVE 1" … "WAVE 4"
  ad_count?:       number
  days_live?:      number | null
  language?:       string         // "Both" | "Spanish only" | "English only"
  categories?:     string[]
  category_labels?: string
  dm?:             string         // ready-to-send DM copy
  observation?:    string         // observation line for your records
  ad_phone?:       string | null  // phone number found in the ad body
  ad_url?:         string | null  // permalink to the ad in the Ads Library

  // ── Meta Ads check (IG leads) ─────────────────────────────────────────
  meta_ads_active?:  boolean       // currently running Meta ads
  fb_ad_count?:      number        // number of active ads found
  fb_page_url?:      string | null // link to their Facebook page
  fb_page_name?:     string | null // FB page name (may differ from IG name)
}

const APIFY_BASE = 'https://api.apify.com/v2'
const API_KEY    = process.env.APIFY_API_KEY

// ── Shared runner ─────────────────────────────────────────────────────────────
async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  maxWaitMs = 120_000,
): Promise<unknown[]> {
  if (!API_KEY) return []

  console.log(`  🚀 Starting actor: ${actorId}`)
  const runRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!runRes.ok) {
    const txt = await runRes.text()
    console.warn(`  ⚠ Apify ${actorId}: HTTP ${runRes.status} — ${txt.slice(0, 200)}`)
    return []
  }
  const run = await runRes.json() as { data?: { id?: string } }
  const runId = run.data?.id
  if (!runId) { console.warn(`  ⚠ ${actorId}: no runId`); return [] }

  const poll     = 5_000
  const maxPolls = Math.ceil(maxWaitMs / poll)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, poll))
    const sRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${API_KEY}`)
    const s    = await sRes.json() as { data?: { status?: string; defaultDatasetId?: string } }
    const st   = s.data?.status ?? ''
    console.log(`    poll ${i + 1}/${maxPolls}: ${actorId} → ${st}`)

    if (st === 'SUCCEEDED') {
      const did  = s.data!.defaultDatasetId
      const dRes = await fetch(`${APIFY_BASE}/datasets/${did}/items?token=${API_KEY}&limit=200`)
      const raw  = await dRes.json()
      const items = (raw as { items?: unknown[] }).items ?? raw
      const arr   = Array.isArray(items) ? items : []
      console.log(`  ✅ ${actorId}: ${arr.length} items`)
      return arr
    }
    if (['FAILED','ABORTED','TIMED-OUT'].includes(st)) {
      console.warn(`  ⚠ ${actorId}: run ended as ${st}`)
      break
    }
  }
  return []
}

// ── Legal-term filter ─────────────────────────────────────────────────────────
const LEGAL_TERMS = [
  'attorney','lawyer','law firm','law office','legal',
  'immigration','abogado','abogada','visa','deportation',
  'asylum','daca','uscis','h-1b','h1b','green card',
  'citizenship','naturalization','inmigra',
]

function hasLegalTerms(...texts: (string | undefined | null)[]): boolean {
  const combined = texts.filter(Boolean).join(' ').toLowerCase()
  return LEGAL_TERMS.some(t => combined.includes(t))
}

// ── Instagram: two-step scrape ────────────────────────────────────────────────
//
// Step 1 — username discovery via Google search (apify/google-search-scraper)
//   Queries: site:instagram.com "immigration attorney" -site:instagram.com/p/
//   Google has indexed Instagram profiles, so results are high-signal profile URLs.
//   We extract usernames from the returned URLs.
//
// Step 2 — full profile enrichment via apify/instagram-profile-scraper (dSCLg0C3YEZ83HzYX)
//   Gives us bio, category, follower count for filtering and display.

const GOOGLE_SCRAPER_ACTOR = 'apify~google-search-scraper'

// US state/city signals — added to every query so Google returns US-based profiles
const US_GEO = '("United States" OR "USA" OR "California" OR "New York" OR "Texas" OR "Florida" OR "Illinois" OR "Georgia" OR "New Jersey" OR "Virginia")'
// Explicitly non-US terms to exclude
const NON_US = '-canada -"united kingdom" -australia -"new zealand" -india -pakistan -"south africa"'

function buildGoogleIgQueries(keywords: string[]): string[] {
  // Build two query styles per top keyword:
  //  A) exact phrase + US geo signal
  //  B) exact phrase alone (catches profiles without location text in the page)
  // Cap at 3 keywords × 2 = 6 queries max, but Google caps per run anyway
  const terms = keywords.slice(0, 3)
  const queries: string[] = []
  for (const kw of terms) {
    const noPost = '-site:instagram.com/p/ -site:instagram.com/explore/ -site:instagram.com/reel/ -site:instagram.com/tv/'
    queries.push(`site:instagram.com "${kw}" ${US_GEO} ${NON_US} ${noPost}`)
    queries.push(`site:instagram.com "${kw}" ${NON_US} ${noPost}`)
  }
  return queries.slice(0, 6)
}

// Non-US country indicators — profiles with these in their location are skipped
const NON_US_COUNTRIES = [
  'canada','united kingdom','uk ','australia','new zealand','india','pakistan',
  'south africa','nigeria','ghana','mexico','brazil','philippines',
]

function isNonUS(location: string | null): boolean {
  if (!location) return false
  const loc = location.toLowerCase()
  return NON_US_COUNTRIES.some(c => loc.includes(c))
}

function extractIgUsername(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, '')
    // path should be just the username (no slashes, not 'p', 'explore', 'reel', 'tv', 'stories')
    if (!path || path.includes('/') || ['p','explore','reel','tv','stories','accounts','about'].includes(path)) {
      return null
    }
    return path
  } catch {
    return null
  }
}

export async function scrapeInstagramFirms(keywords: string[], limit = 50): Promise<FirmLead[]> {
  // ── Step 1: discover usernames via Google site: search ─────────────────────
  const discoveredUsernames = new Set<string>()
  const queries = buildGoogleIgQueries(keywords)
  const pagesPerQuery = Math.max(2, Math.ceil((limit * 2) / (queries.length * 10)))

  console.log(`  📸 IG discovery via Google (${queries.length} queries, ${pagesPerQuery} pages each)`)
  const googleItems = await runActor(GOOGLE_SCRAPER_ACTOR, {
    queries:         queries.join('\n'),
    maxPagesPerQuery: pagesPerQuery,
    countryCode:     'us',
    languageCode:    'en',
  }, 180_000) as Array<{ organicResults?: Array<{ url?: string; title?: string }> }>

  for (const page of googleItems) {
    for (const result of page.organicResults ?? []) {
      const username = result.url ? extractIgUsername(result.url) : null
      if (username) {
        discoveredUsernames.add(username)
        console.log(`    found: @${username} — ${result.title?.slice(0, 50) ?? ''}`)
      }
    }
  }
  console.log(`  📸 ${discoveredUsernames.size} unique usernames from Google`)

  if (discoveredUsernames.size === 0) {
    console.warn('  ⚠ IG: no usernames found via Google search')
    return []
  }

  // ── Step 2: enrich with full profile data ───────────────────────────────────
  //   Actor: apify/instagram-profile-scraper (ID: dSCLg0C3YEZ83HzYX)
  //   Input: { usernames: string[], resultsLimit: number }
  console.log(`  📸 IG profile enrichment: ${discoveredUsernames.size} usernames`)
  const profiles = await runActor('dSCLg0C3YEZ83HzYX', {
    usernames: [...discoveredUsernames],
    resultsLimit: discoveredUsernames.size,
  }) as Array<{
    username?:            string
    fullName?:            string
    biography?:           string
    followersCount?:      number
    businessEmail?:       string
    businessPhone?:       string
    externalUrl?:         string
    isBusinessAccount?:   boolean
    businessCategoryName?: string
    city?:                string
    country?:             string
    businessAddressJson?: string
  }>

  console.log(`    ${profiles.length} profiles returned; filtering...`)
  if (profiles.length > 0) {
    const sample = profiles[0] as Record<string, unknown>
    console.log(`    [DEBUG] first profile keys: ${Object.keys(sample).join(', ')}`)
    console.log(`    [DEBUG] sample:`, JSON.stringify(sample).slice(0, 400))
  }

  const results: FirmLead[] = []
  for (const item of profiles) {
    const raw = item as Record<string, unknown>
    // Handle multiple possible field names across actor versions
    const username = (raw.username ?? raw.userName ?? raw.user_name ?? '') as string
    if (!username) continue

    const bio      = ((raw.biography ?? raw.bio ?? raw.description ?? raw.caption ?? '') as string)
    const name     = ((raw.fullName  ?? raw.full_name ?? raw.name ?? username) as string)
    const category = ((raw.businessCategoryName ?? raw.business_category_name ?? raw.category ?? '') as string)

    if (!hasLegalTerms(bio, name, username, category)) {
      console.log(`    skip "${username}" — no legal terms`)
      continue
    }

    // Skip explicitly non-US profiles
    const rawLocForFilter = (raw.city ?? raw.country ?? raw.location ?? '') as string
    if (isNonUS(rawLocForFilter) || isNonUS(bio)) {
      console.log(`    skip "${username}" — non-US location: "${rawLocForFilter}"`)
      continue
    }

    // Strict: bio, display name, username, or FB category must contain a legal term
    if (!hasLegalTerms(bio, name, item.username, category)) continue

    let location: string | null = null
    const addrJson = (raw.businessAddressJson ?? raw.business_address_json ?? '') as string
    if (addrJson) {
      try {
        const addr = JSON.parse(addrJson) as { city_name?: string; country_code?: string }
        location = [addr.city_name, addr.country_code].filter(Boolean).join(', ') || null
      } catch {}
    }
    const city    = (raw.city    ?? raw.addressCity    ?? '') as string
    const country = (raw.country ?? raw.addressCountry ?? '') as string
    if (!location && (city || country)) {
      location = [city, country].filter(Boolean).join(', ') || null
    }

    const followers = (raw.followersCount ?? raw.followers_count ?? raw.followedByCount ?? null) as number | null
    const website   = (raw.externalUrl    ?? raw.external_url    ?? raw.websiteUrl      ?? null) as string | null

    results.push({
      firm_name:      name || username,
      platform:       'instagram',
      social_handle:  username,
      profile_url:    `https://instagram.com/${username}`,
      website_url:    website,
      bio:            bio || null,
      follower_count: followers !== null ? Number(followers) || null : null,
      location,
      contact_name:   null,
    })

    if (results.length >= limit) break
  }

  console.log(`  ✅ IG: ${results.length} relevant firms`)
  return results
}

// ── LinkedIn: company search + profile-by-services ───────────────────────────
//
// Actor 1: harvestapi/linkedin-company-search (ID: taHaRcqil3scbchuI)
//   Input: { mode: "full", query: string, maxItems: number, locations: string[] }
//   Finds law firm company pages.
//
// Actor 2: harvestapi/linkedin-profile-search-by-services (ID: M2FMdjRVeF1HPGFcc)
//   Input: { mode: "Full", search: string, maxItems: number, locations: string[] }
//   Finds individual attorney profiles listed under LinkedIn Services.

type LiRaw = Record<string, unknown>

function liToLead(raw: LiRaw, location: string): FirmLead | null {
  // Company fields
  const name       = (raw.name ?? raw.companyName ?? raw.fullName ?? raw.firstName) as string | undefined
  const profileUrl = (raw.url  ?? raw.linkedinUrl ?? raw.profileUrl) as string | undefined
  if (!name || !profileUrl) return null

  const cleanUrl  = profileUrl.split('?')[0].replace(/\/$/, '')
  const isCompany = cleanUrl.includes('/company/')
  const handle    = isCompany
    ? (cleanUrl.split('/company/')[1]?.split('/')[0] ?? null)
    : (cleanUrl.split('/in/')[1]?.split('/')[0] ?? null)

  const bio = (raw.description ?? raw.about ?? raw.summary ?? raw.headline ?? null) as string | null
  const emp = raw.employees ?? raw.employeeCount ?? raw.followersCount ?? null
  const web = (raw.website ?? raw.websiteUrl ?? null) as string | null

  // location may be a plain string OR an object {linkedinText, countryCode, parsed}
  const rawLoc = raw.location ?? raw.headquarter ?? raw.addressWithCountry ?? location
  const loc: string = typeof rawLoc === 'object' && rawLoc !== null
    ? ((rawLoc as Record<string, unknown>).linkedinText as string)
      ?? ((rawLoc as Record<string, unknown>).countryCode as string)
      ?? location
    : String(rawLoc ?? location)

  // contact_name: for profiles the scraped entity IS the person
  const contact = isCompany
    ? null
    : [raw.firstName, raw.lastName].filter(Boolean).join(' ') || (name as string) || null

  return {
    firm_name:      name,
    platform:       'linkedin',
    social_handle:  handle,
    profile_url:    cleanUrl,
    website_url:    web,
    bio,
    follower_count: emp ? Number(emp) || null : null,
    location:       loc,
    contact_name:   contact as string | null,
  }
}

export async function scrapeLinkedInFirms(keywords: string[], location: string, limit = 50): Promise<FirmLead[]> {
  const seen    = new Set<string>()
  const results: FirmLead[] = []
  const perKw   = Math.ceil(limit / Math.min(keywords.length, 3))

  for (const kw of keywords.slice(0, 3)) {
    if (results.length >= limit) break

    // ── 1. Company search ─────────────────────────────────────────────────────
    console.log(`  💼 LinkedIn company search: "${kw}" in ${location}`)
    const companies = await runActor('taHaRcqil3scbchuI', {
      mode:        'full',
      searchQuery: kw,
      maxItems:    perKw,
      locations:   [location],
    }) as LiRaw[]

    console.log(`    ${companies.length} company results`)
    for (const raw of companies) {
      const lead = liToLead(raw, location)
      if (!lead) continue
      if (seen.has(lead.profile_url)) continue
      // Filter: name, bio, or industry must contain a legal term
      if (!hasLegalTerms(lead.firm_name, lead.bio, String(raw.industry ?? ''))) continue
      seen.add(lead.profile_url)
      results.push(lead)
      if (results.length >= limit) break
    }

    if (results.length >= limit) break

    // ── 2. Profile search by services ─────────────────────────────────────────
    console.log(`  👤 LinkedIn profile search: "${kw}" in ${location}`)
    const profiles = await runActor('M2FMdjRVeF1HPGFcc', {
      mode:      'Full',
      search:    kw,
      maxItems:  perKw,
      locations: [location],
    }) as LiRaw[]

    console.log(`    ${profiles.length} profile results`)
    for (const raw of profiles) {
      const lead = liToLead(raw, location)
      if (!lead) continue
      if (seen.has(lead.profile_url)) continue
      // Filter: name, bio/headline must contain a legal term
      if (!hasLegalTerms(lead.firm_name, lead.bio, String(raw.headline ?? raw.title ?? ''))) continue
      seen.add(lead.profile_url)
      results.push(lead)
      if (results.length >= limit) break
    }
  }

  console.log(`  ✅ LinkedIn: ${results.length} leads`)
  return results
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeLeads(params: {
  keywords:  string[]
  location:  string
  platforms: ('instagram' | 'linkedin')[]
  limit?:    number
}): Promise<FirmLead[]> {
  if (!API_KEY) throw new Error('APIFY_API_KEY is not set. Add it to .env to enable lead scraping.')

  const { keywords, location, platforms, limit = 50 } = params
  const platformCount = platforms.length || 1
  const perPlatform   = Math.ceil(limit / platformCount)

  const [igResults, liResults] = await Promise.allSettled([
    platforms.includes('instagram') ? scrapeInstagramFirms(keywords, perPlatform) : Promise.resolve([]),
    platforms.includes('linkedin')  ? scrapeLinkedInFirms(keywords, location, perPlatform) : Promise.resolve([]),
  ])

  const allResults: FirmLead[] = []
  if (igResults.status === 'fulfilled') allResults.push(...igResults.value)
  else console.warn('Instagram scrape rejected:', igResults.reason)
  if (liResults.status === 'fulfilled') allResults.push(...liResults.value)
  else console.warn('LinkedIn scrape rejected:', liResults.reason)

  // Dedup
  const seen = new Set<string>()
  const deduped = allResults.filter(lead => {
    const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`  📊 Total: ${deduped.length} leads (deduped from ${allResults.length})`)
  return deduped.slice(0, limit)
}
