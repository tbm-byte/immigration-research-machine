/**
 * Facebook Ads Library pipeline — TypeScript port of the Python prospecting pipeline.
 *
 * Sources: adlibrary.py · config.py · normalize.py · filters.py · outreach.py
 *
 * Actor: curious_coder/facebook-ads-library-scraper (ID: XtaWFhbtfxyzqrFmd)
 * Input:  { urls: [{ url, method: "GET" }], count: N, scrapeAdDetails: false }
 * Billed per ad scraped (~$0.75/1,000).
 */

import type { FirmLead } from './lead-scraper'

const APIFY_BASE = 'https://api.apify.com/v2'
const API_KEY    = process.env.APIFY_API_KEY

// ── Actor ID ──────────────────────────────────────────────────────────────────
const FB_ADS_ACTOR = 'XtaWFhbtfxyzqrFmd'   // curious_coder/facebook-ads-library-scraper

// ── Keywords (from config.py) — ordered by signal quality ────────────────────
export const FB_KEYWORDS: Record<string, string> = {
  'abogado de inmigracion':             'general',
  'I-601A waiver attorney':             'waivers_rfe',
  'deportation defense attorney':       'removal',
  'abogado de deportacion':             'removal',
  'EB-5 immigration attorney':          'business',
  'RFE response attorney':              'waivers_rfe',
  'immigration attorney':               'general',
  'marriage green card attorney':       'family',
  'asylum lawyer':                      'removal',
  'provisional waiver attorney':        'waivers_rfe',
  'immigration lawyer':                 'general',
  'green card lawyer':                  'family',
  'tarjeta verde abogado':             'family',
  'consulta de inmigracion':           'general',
  'cancellation of removal attorney':   'removal',
  'bond hearing attorney immigration':  'removal',
  'ICE detention lawyer':               'removal',
  'EB-2 NIW attorney':                  'business',
  'E-2 visa lawyer':                    'business',
  'K-1 visa attorney':                  'family',
  'adjustment of status lawyer':        'family',
  'VAWA attorney':                      'family',
  'U visa lawyer':                      'other',
  'citizenship lawyer':                 'citizenship',
  'naturalization attorney':            'citizenship',
  'immigration law firm':               'general',
  'hardship waiver immigration':        'waivers_rfe',
  'H-1B attorney':                      'business',
  'O-1 visa attorney':                  'business',
  'DACA renewal lawyer':                'other',
  'TPS attorney':                       'other',
}

const CATEGORY_LABEL: Record<string, string> = {
  family: 'Family / Marriage', waivers_rfe: 'Waivers / RFE',
  removal: 'Removal Defence',  citizenship: 'Citizenship',
  business: 'Business / Investor', other: 'Other', general: 'General',
}

const CATEGORY_PROSE: Record<string, string> = {
  family: 'family-based', waivers_rfe: 'waiver',
  removal: 'deportation defence', citizenship: 'citizenship',
  business: 'investor visa', other: 'immigration', general: 'immigration',
}

// ── Filtering markers (from config.py) ───────────────────────────────────────
const NOT_A_FIRM = ['avvo','justia','findlaw','lawyers.com','legalzoom','rocketlawyer',
  'yelp','thumbtack','angi','nolo','martindale','superlawyers','lawinfo',
  'attorneys.com','lawyer.com','expertise.com','boundless']

const LEAD_VENDORS = ['lead generation','buy leads','exclusive leads','pay per lead',
  'marketing for lawyers','law firm marketing','grow your law firm',
  'attorney marketing','seo for lawyers','case acquisition']

const NOTARIO_MARKERS = ['notario','notary public immigration','document preparation',
  'immigration consultant','forms assistance','not an attorney',
  'we are not lawyers','paralegal services']

const LEGAL_CAT_MARKERS = ['lawyer','law firm','law practice','legal','attorney',
  'solicitor','notary','immigration','criminal','personal injury','bankruptcy']

const LEGAL_NAME_MARKERS = ['law','legal','attorney','abogad','esq','lawyer',
  'immigration','inmigracion','inmigración','counsel','juris','advocat']

const CATEGORY_MARKERS: Record<string, string[]> = {
  family:       ['green card','marriage','spouse','fiance','fiancé','i-130',
                 'family petition','tarjeta verde','matrimonio','esposa','esposo',
                 'adjustment of status','k-1','vawa'],
  waivers_rfe:  ['waiver','i-601','rfe','request for evidence','provisional',
                 'hardship','perdon','perdón'],
  removal:      ['deportation','removal','detained','detention','ice ','bond hearing',
                 'asylum','asilo','deportacion','deportación','corte de inmigracion'],
  citizenship:  ['citizenship','naturalization','n-400','ciudadania','ciudadanía'],
  business:     ['eb-5','eb-2','niw','e-2 visa','h-1b','l-1 visa','o-1 visa',
                 'investor visa','employment visa','visa sponsorship'],
}

const SPANISH_MARKERS = ['abogado','abogada','inmigracion','inmigración','deportacion',
  'deportación','ciudadania','ciudadanía','tarjeta verde','asilo','consulta gratis',
  'ayudamos','llame','llámenos','nosotros','usted','familia','gratuita',
  'perdón','residencia','permiso de trabajo','cita','hoy mismo']

const GENERIC_LANDING = ['contact','contacto','contact-us','get-started',
  'consultation','free-consultation','schedule','appointment']

const PREMIUM_CATS = new Set(['waivers_rfe','business','removal'])

const WAVE_THRESHOLDS: [string, number][] = [
  ['WAVE 1', 8], ['WAVE 2', 6], ['WAVE 3', 4], ['WAVE 4', 0],
]

const FIT_WEIGHTS: Record<string, number> = {
  ad_live_60d: 3, ad_live_30d: 2, ad_live_any: 1,
  bilingual: 3, spanish_only: 2,
  many_creatives: 2, some_creatives: 1,
  premium_category: 2, has_phone: 1,
  right_size: 1, likely_too_big: -2,
}

const LIKES_FLOOR   = 500
const LIKES_TOO_BIG = 50_000

// ── URL builder ───────────────────────────────────────────────────────────────
function buildLibraryUrl(keyword: string, country = 'US', activeOnly = true): string {
  const status = activeOnly ? 'active' : 'all'
  return (
    `https://www.facebook.com/ads/library/` +
    `?active_status=${status}&ad_type=all&country=${country}` +
    `&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered&media_type=all`
  )
}

// ── Apify helpers ─────────────────────────────────────────────────────────────
async function runFbActor(urls: string[], count: number, maxWaitMs = 120_000): Promise<unknown[]> {
  if (!API_KEY) return []

  const payload = {
    urls: urls.map(u => ({ url: u, method: 'GET' })),
    count,
    scrapeAdDetails: false,
  }

  const runRes = await fetch(`${APIFY_BASE}/acts/${FB_ADS_ACTOR}/runs?token=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!runRes.ok) {
    const txt = await runRes.text()
    console.warn(`  ⚠ FB Ads actor HTTP ${runRes.status}: ${txt.slice(0, 200)}`)
    return []
  }
  const run = await runRes.json() as { data?: { id?: string } }
  const runId = run.data?.id
  if (!runId) return []

  const poll = 5000
  const maxPolls = Math.ceil(maxWaitMs / poll)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, poll))
    const sRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${API_KEY}`)
    const s    = await sRes.json() as { data?: { status?: string; defaultDatasetId?: string } }
    const st   = s.data?.status ?? ''
    if (st === 'SUCCEEDED') {
      const did = s.data!.defaultDatasetId
      const dRes = await fetch(`${APIFY_BASE}/datasets/${did}/items?token=${API_KEY}&limit=1000&clean=true&format=json`)
      const raw = await dRes.json()
      const items = (raw as { items?: unknown[] }).items ?? raw
      return Array.isArray(items) ? items : []
    }
    if (['FAILED','ABORTED','TIMED-OUT'].includes(st)) {
      console.warn(`  ⚠ FB Ads run ended: ${st}`)
      break
    }
  }
  return []
}

// ── Normalizer (port of normalize.py) ────────────────────────────────────────
function deep(obj: unknown, dotted: string): unknown {
  let cur = obj
  for (const part of dotted.split('.')) {
    if (Array.isArray(cur)) cur = cur[0]
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
    if (cur === undefined) return undefined
  }
  return cur
}

// Path candidates for each field (mirrors normalize.py PATHS)
const PATHS: Record<string, string[]> = {
  page_name:       ['pageName','page_name','snapshot.page_name','advertiserName',
                    'snapshot.current_page_name','pageInfo.name'],
  page_id:         ['pageID','pageId','page_id','snapshot.page_id'],
  page_url:        ['snapshot.page_profile_uri','pageUrl','page_url','url'],
  ad_id:           ['adArchiveID','adArchiveId','ad_archive_id','adid','adId','id'],
  body:            ['snapshot.body.text','snapshot.body.markup.__html','snapshot.body',
                    'adText','ad_creative_body','body.text','body','text'],
  title:           ['snapshot.title','snapshot.link_title','title','headline',
                    'ad_creative_link_title'],
  description:     ['snapshot.link_description','description'],
  caption:         ['snapshot.caption','caption'],
  link:            ['snapshot.link_url','snapshot.cta_link','linkUrl','link_url'],
  start:           ['startDate','start_date','startDateFormatted','snapshot.creation_time',
                    'adDeliveryStartTime','ad_delivery_start_time'],
  cta:             ['snapshot.cta_text','snapshot.cta_type','ctaText','ctaType'],
  platforms:       ['publisherPlatform','publisher_platform','publisherPlatforms','platforms'],
  page_categories: ['snapshot.page_categories','page_categories'],
  page_likes:      ['snapshot.page_like_count','page_like_count'],
  display_format:  ['snapshot.display_format'],
}

function firstVal(raw: Record<string, unknown>, key: string): unknown {
  for (const path of PATHS[key] ?? []) {
    let val = deep(raw, path)
    // body sometimes arrives as { text: "..." } one level lower
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const v = val as Record<string, unknown>
      val = v['text'] ?? v['markup'] ?? undefined
      if (typeof val === 'object' && val !== null) {
        val = (val as Record<string, unknown>)['__html']
      }
    }
    if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) {
      return val
    }
  }
  return undefined
}

function firstStr(raw: Record<string, unknown>, key: string, def = ''): string {
  const v = firstVal(raw, key)
  return typeof v === 'string' ? v : (v != null ? String(v) : def)
}

function cardText(raw: Record<string, unknown>): string {
  const cards = deep(raw, 'snapshot.cards')
  if (!Array.isArray(cards)) return ''
  const parts: string[] = []
  for (const card of cards.slice(0, 6)) {
    if (typeof card !== 'object' || !card) continue
    const c = card as Record<string, unknown>
    for (const k of ['body','title','link_description','caption']) {
      let v = c[k]
      if (typeof v === 'object' && v !== null) v = (v as Record<string,unknown>)['text']
      if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    }
  }
  return parts.join(' ')
}

const AD_PHONE_RE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g
const DOMAIN_RE   = /^[a-z0-9][a-z0-9.-]{2,80}\.[a-z]{2,12}$/

function parseDate(value: unknown): Date | null {
  if (value == null || value === '' || typeof value === 'boolean') return null
  if (typeof value === 'number') {
    let ts = value
    if (ts > 1e11) ts /= 1000
    if (ts < 946684800) return null
    try { return new Date(ts * 1000) } catch { return null }
  }
  const text = String(value).trim()
  try { return new Date(text) } catch { return null }
}

function extractPhone(text: string): string {
  const matches = [...text.matchAll(new RegExp(AD_PHONE_RE.source, 'g'))]
  const tollfree = new Set(['800','888','877','866','855','844','833'])
  for (const m of matches) {
    if (!tollfree.has(m[1])) return `(${m[1]}) ${m[2]}-${m[3]}`
  }
  for (const m of matches) return `(${m[1]}) ${m[2]}-${m[3]}`
  return ''
}

function isSpanish(text: string): boolean {
  const low = text.toLowerCase()
  return SPANISH_MARKERS.filter(m => low.includes(m)).length >= 2
}

function detectCategories(text: string, kwCategory: string): string[] {
  const low = text.toLowerCase()
  const found = new Set<string>()
  for (const [cat, marks] of Object.entries(CATEGORY_MARKERS)) {
    if (marks.some(m => low.includes(m))) found.add(cat)
  }
  if (kwCategory !== 'general' && kwCategory !== 'other') found.add(kwCategory)
  return found.size > 0 ? [...found] : ['general']
}

interface NormalizedAd {
  firm: string; page_id: string; page_url: string; ad_id: string
  keyword: string; keyword_category: string; body: string
  start_date: string; days_live: number | null
  link: string; domain: string; cta: string; platforms: string
  page_categories: string[]; page_likes: number | null
  is_spanish: boolean; categories: string[]
  ad_phone: string; ad_url: string
}

function normalizeAd(raw: Record<string, unknown>, keyword: string): NormalizedAd | null {
  const page = firstStr(raw, 'page_name')
  if (!page) return null

  const body = [
    firstStr(raw,'body'), firstStr(raw,'title'),
    firstStr(raw,'description'), cardText(raw),
  ].filter(Boolean).join(' ').substring(0, 4000)

  const start    = parseDate(firstVal(raw, 'start'))
  const days_live = start ? Math.floor((Date.now() - start.getTime()) / 86_400_000) : null

  let link = firstStr(raw, 'link')
  if (!link.startsWith('http')) link = ''
  let domain = ''
  if (link) {
    try { domain = new URL(link).hostname.replace(/^www\./, '') } catch {}
  }
  if (!domain) {
    const cap = firstStr(raw,'caption').trim().toLowerCase().replace(/^www\./,'').split('/')[0]
    if (DOMAIN_RE.test(cap) && !cap.match(/\.(jpg|png|mp4)$/)) domain = cap
  }

  const plats = firstVal(raw, 'platforms')
  const platStr = Array.isArray(plats)
    ? plats.map(p => String(p).trim()).filter(Boolean).join(', ')
    : (typeof plats === 'string' ? plats : '')

  const rawCats = firstVal(raw, 'page_categories')
  const page_categories = Array.isArray(rawCats) ? rawCats.map(String) : []

  const rawLikes = firstVal(raw, 'page_likes')
  const page_likes = typeof rawLikes === 'number' ? rawLikes
    : (rawLikes != null ? Number(rawLikes) || null : null)

  const adId = firstStr(raw, 'ad_id')
  const kwCat = FB_KEYWORDS[keyword] ?? 'general'

  return {
    firm: page.trim().substring(0, 160),
    page_id: firstStr(raw, 'page_id'),
    page_url: firstStr(raw, 'page_url'),
    ad_id: adId || '',
    keyword,
    keyword_category: kwCat,
    body,
    start_date: start ? start.toISOString().split('T')[0] : '',
    days_live: (days_live != null && days_live >= 0 && days_live < 4000) ? days_live : null,
    link,
    domain,
    cta: firstStr(raw,'cta').substring(0, 40),
    platforms: platStr,
    page_categories,
    page_likes,
    is_spanish: isSpanish(body),
    categories: detectCategories(body, kwCat),
    ad_phone: extractPhone(body),
    ad_url: adId && /^\d+$/.test(adId)
      ? `https://www.facebook.com/ads/library/?id=${adId}` : '',
  }
}

// ── Rollup (port of normalize.py rollup) ─────────────────────────────────────
interface FirmRollup {
  firm: string; page_id: string; page_url: string; domain: string
  categories: string[]; category_labels: string; language: string
  days_live: number | null; ad_count: number; generic_landing: boolean
  keywords_hit: string[]; ad_bodies: string[]
  page_categories: string[]; page_likes: number | null
  ad_phone: string; ad_url: string
}

function rollupFirms(ads: NormalizedAd[]): FirmRollup[] {
  const groups = new Map<string, NormalizedAd[]>()
  for (const a of ads) {
    const key = a.page_id || a.firm.toLowerCase()
    const g = groups.get(key) ?? []
    g.push(a)
    groups.set(key, g)
  }

  const firms: FirmRollup[] = []
  for (const group of groups.values()) {
    const allCats = new Set<string>(group.flatMap(a => a.categories).filter(c => c !== 'general'))
    const cats = allCats.size > 0 ? [...allCats].sort() : ['general']

    const spanish = group.some(a => a.is_spanish)
    const english = group.some(a => !a.is_spanish)
    const language = spanish && english ? 'Both' : spanish ? 'Spanish only' : 'English only'

    const dayValues = group.map(a => a.days_live).filter((d): d is number => d != null)
    const links = group.map(a => a.link).filter(Boolean)
    const generic = links.length > 0 && links.every(l => {
      try {
        const path = new URL(l).pathname.replace(/^\/|\/$/g, '')
        return !path || GENERIC_LANDING.some(g => path.toLowerCase().includes(g))
      } catch { return false }
    })

    firms.push({
      firm: group[0].firm,
      page_id: group[0].page_id,
      page_url: group[0].page_url,
      domain: group.find(a => a.domain)?.domain ?? '',
      categories: cats,
      category_labels: cats.map(c => CATEGORY_LABEL[c] ?? c).join(', '),
      language,
      days_live: dayValues.length ? Math.max(...dayValues) : null,
      ad_count: group.length,
      generic_landing: generic,
      keywords_hit: [...new Set(group.map(a => a.keyword))].sort(),
      ad_bodies: group.map(a => a.body),
      page_categories: [...new Set(group.flatMap(a => a.page_categories))].sort(),
      page_likes: group.find(a => a.page_likes != null)?.page_likes ?? null,
      ad_phone: group.find(a => a.ad_phone)?.ad_phone ?? '',
      ad_url: group.find(a => a.ad_url)?.ad_url ?? '',
    })
  }
  return firms
}

// ── Filter (port of filters.py) ───────────────────────────────────────────────
function disqualify(firm: FirmRollup): string {
  const name   = firm.firm.toLowerCase()
  const bodies = firm.ad_bodies.join(' ').toLowerCase()
  const domain = firm.domain.toLowerCase()
  const hay    = `${name} ${domain}`

  if (NOT_A_FIRM.some(m => hay.includes(m)))      return 'directory or legal marketplace'
  if (LEAD_VENDORS.some(m => hay.includes(m) || bodies.includes(m))) return 'lead vendor or marketing agency'
  if (NOTARIO_MARKERS.some(m => bodies.includes(m)))   return 'non-attorney immigration service'

  const cats = firm.page_categories.join(' ').toLowerCase()
  if (cats && !LEGAL_CAT_MARKERS.some(m => cats.includes(m))) {
    if (!LEGAL_NAME_MARKERS.some(m => name.includes(m))) {
      return `not a legal practice (${cats.substring(0, 34)})`
    }
  }
  if (!firm.page_url) return 'no Facebook page to message'
  return ''
}

// ── Scorer (port of filters.py) ───────────────────────────────────────────────
function scoreFirm(firm: FirmRollup): { score: number; reasons: string[] } {
  let pts = 0
  const why: string[] = []

  const d = firm.days_live
  if (d != null) {
    if (d >= 60)  { pts += FIT_WEIGHTS.ad_live_60d; why.push(`${d}d live`) }
    else if (d >= 30) { pts += FIT_WEIGHTS.ad_live_30d; why.push(`${d}d live`) }
    else          { pts += FIT_WEIGHTS.ad_live_any;  why.push(`${d}d live`) }
  }

  if (firm.language === 'Both')         { pts += FIT_WEIGHTS.bilingual;  why.push('bilingual') }
  else if (firm.language === 'Spanish only') { pts += FIT_WEIGHTS.spanish_only; why.push('Spanish') }

  if (firm.ad_count >= 5)  { pts += FIT_WEIGHTS.many_creatives;  why.push(`${firm.ad_count} creatives`) }
  else if (firm.ad_count >= 2) { pts += FIT_WEIGHTS.some_creatives; why.push(`${firm.ad_count} creatives`) }

  if (firm.categories.some(c => PREMIUM_CATS.has(c))) {
    pts += FIT_WEIGHTS.premium_category; why.push('specific case type')
  }
  if (firm.ad_phone) { pts += FIT_WEIGHTS.has_phone; why.push('phone in ad') }

  const likes = firm.page_likes
  if (likes != null) {
    if (likes > LIKES_TOO_BIG) { pts += FIT_WEIGHTS.likely_too_big; why.push(`${likes.toLocaleString()} likes — likely too big`) }
    else if (likes >= LIKES_FLOOR) { pts += FIT_WEIGHTS.right_size; why.push(`${likes.toLocaleString()} likes`) }
  }

  return { score: Math.max(0, Math.min(pts, 10)), reasons: why }
}

function wave(fit: number): string {
  for (const [label, threshold] of WAVE_THRESHOLDS) {
    if (fit >= threshold) return label
  }
  return 'WAVE 4'
}

// ── DM copy (port of outreach.py) ─────────────────────────────────────────────
function shortObservation(firm: FirmRollup): string {
  const cat = CATEGORY_PROSE[firm.categories[0]] ?? 'immigration'
  const d   = firm.days_live
  if (d != null && d >= 60) return `your ${cat} ads have been running a while now`
  if (firm.language === 'Both') return `you're running ${cat} ads in both languages`
  if (firm.language === 'Spanish only') return `you're running ${cat} ads in Spanish`
  return `your ${cat} ads running`
}

function observation(firm: FirmRollup): string {
  const bits: string[] = []
  const cats = firm.category_labels.toLowerCase()
  const d    = firm.days_live

  if (d != null && d > 0) {
    if (d >= 365) bits.push(`${cats} ads live over a year`)
    else if (d >= 84) bits.push(`${cats} ads live ~${Math.round(d / 30)} months`)
    else { const w = Math.max(1, Math.round(d / 7)); bits.push(`${cats} ads live ~${w} week${w !== 1 ? 's' : ''}`) }
  } else {
    bits.push(`${cats} ads running`)
  }

  if (firm.language === 'English only') bits.push('English-only creative')
  else if (firm.language === 'Spanish only') bits.push('Spanish-only creative')
  else bits.push('running both languages')

  if (firm.ad_count >= 5) bits.push(`${firm.ad_count} variations in rotation`)
  if (firm.generic_landing) bits.push('pointing to a generic contact page')

  const line = bits.join(', ')
  return line[0].toUpperCase() + line.slice(1)
}

function question(firm: FirmRollup): string {
  const d = firm.days_live
  if (d != null && d >= 60) return 'what does an inquiry cost you right now?'
  if (firm.ad_count >= 5)   return 'which of your ads actually brings in cases that retain?'
  return 'when an inquiry comes in, how long before someone calls them?'
}

function buildDm(firm: FirmRollup): string {
  return (
    `Hi — noticed ${shortObservation(firm)}.\n\n` +
    `Can I ask for your help with something? I'm building the first client ` +
    `acquisition benchmark for immigration firms — 25 firms, all anonymous.\n\n` +
    `One question: ${question(firm)}\n\n` +
    `I'll send you what the other 24 said.\n\nBen\nTBM — client acquisition for immigration firms`
  )
}

// ── Dedup ─────────────────────────────────────────────────────────────────────
function dedupeAds(ads: NormalizedAd[]): NormalizedAd[] {
  const seen = new Set<string>()
  return ads.filter(a => {
    const key = `${a.page_id || a.firm.toLowerCase()}:${a.ad_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeFbAdsLeads(params: {
  keywords?: string[]
  country?: string
  limit?: number        // max firms to return (after filtering + scoring)
  adsPerUrl?: number    // ads per keyword URL (default 60)
  urlsPerRun?: number   // keyword URLs per actor run (default 6)
  activeOnly?: boolean
}): Promise<FirmLead[]> {
  if (!API_KEY) throw new Error('APIFY_API_KEY not set')

  const {
    keywords   = Object.keys(FB_KEYWORDS),
    country    = 'US',
    limit      = 50,
    adsPerUrl  = 60,
    urlsPerRun = 6,
    activeOnly = true,
  } = params

  // Build keyword→url pairs in priority order
  const pairs = keywords.map(kw => ({ kw, url: buildLibraryUrl(kw, country, activeOnly) }))

  // Batch into groups of urlsPerRun
  const batches: typeof pairs[] = []
  for (let i = 0; i < pairs.length; i += urlsPerRun) {
    batches.push(pairs.slice(i, i + urlsPerRun))
  }

  const allAds: NormalizedAd[] = []
  const seenFirmIds = new Set<string>()

  for (const batch of batches) {
    // Early stop if we already have enough unique firms after filtering
    if (seenFirmIds.size >= limit * 2) {
      console.log(`  ⚡ FB Ads early stop: ${seenFirmIds.size} firms found, stopping keyword sweep`)
      break
    }

    console.log(`  📢 FB Ads batch: ${batch.map(b => b.kw).join(', ')}`)
    const urls = batch.map(b => b.url)

    try {
      const rawItems = await runFbActor(urls, adsPerUrl)
      console.log(`    → ${rawItems.length} raw ads`)

      for (const raw of rawItems) {
        if (typeof raw !== 'object' || !raw) continue
        // Attribute to the best matching keyword in this batch
        const rawRec = raw as Record<string, unknown>
        const bodyText = [
          rawRec['adText'], rawRec['snapshot'] ? (rawRec['snapshot'] as Record<string,unknown>)['body'] : '',
        ].join(' ').toString().toLowerCase()
        let bestKw = batch[0].kw
        let bestHits = 0
        for (const { kw } of batch) {
          const hits = kw.toLowerCase().split(' ').filter(t => t.length > 3 && bodyText.includes(t)).length
          if (hits > bestHits) { bestKw = kw; bestHits = hits }
        }

        const ad = normalizeAd(rawRec, bestKw)
        if (!ad) continue
        allAds.push(ad)
        seenFirmIds.add(ad.page_id || ad.firm.toLowerCase())
      }
    } catch (err) {
      console.warn(`  ⚠ FB Ads batch failed:`, (err as Error).message)
    }
  }

  console.log(`  📊 FB Ads: ${allAds.length} total ads, ${seenFirmIds.size} unique firms`)

  // Dedupe, rollup, filter, score
  const dedupedAds = dedupeAds(allAds)
  const firms      = rollupFirms(dedupedAds)

  const scored: Array<FirmRollup & { fit: number; wave: string; why: string; obs: string; dm: string }> = []
  const skipped: Array<{ firm: string; reason: string }> = []

  for (const firm of firms) {
    const reason = disqualify(firm)
    if (reason) { skipped.push({ firm: firm.firm, reason }); continue }
    const { score, reasons } = scoreFirm(firm)
    scored.push({
      ...firm,
      fit:  score,
      wave: wave(score),
      why:  reasons.join('; '),
      obs:  observation(firm),
      dm:   buildDm(firm),
    })
  }

  // Sort: fit desc, then days_live desc
  scored.sort((a, b) =>
    b.fit !== a.fit
      ? b.fit - a.fit
      : (b.days_live ?? 0) - (a.days_live ?? 0)
  )

  console.log(`  ✅ FB Ads: ${scored.length} qualified firms (${skipped.length} skipped)`)
  if (skipped.length > 0) {
    const reasons = skipped.reduce<Record<string, number>>((acc, s) => {
      const k = s.reason.split('(')[0].trim()
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
    console.log('    Skipped:', JSON.stringify(reasons))
  }

  // Convert to FirmLead[]
  return scored.slice(0, limit).map<FirmLead>(f => ({
    firm_name:       f.firm,
    platform:        'facebook',
    social_handle:   null,
    profile_url:     f.page_url,
    website_url:     f.domain ? `https://${f.domain}` : null,
    bio:             f.ad_bodies[0]?.substring(0, 300) ?? null,
    follower_count:  f.page_likes,
    location:        null,
    contact_name:    null,
    // FB-specific
    fit_score:       f.fit,
    wave:            f.wave,
    ad_count:        f.ad_count,
    days_live:       f.days_live,
    language:        f.language,
    categories:      f.categories,
    category_labels: f.category_labels,
    dm:              f.dm,
    observation:     f.obs,
    ad_phone:        f.ad_phone || null,
    ad_url:          f.ad_url   || null,
  }))
}
