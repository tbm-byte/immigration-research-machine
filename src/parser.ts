import { parse as parseHtml } from 'node-html-parser'
import Parser from 'rss-parser'
import { RawArticle, SourceConfig } from './types'

const rssParser = new Parser({ timeout: 8000 })

export async function fetchSource(source: SourceConfig): Promise<RawArticle[]> {
  if (source.feedType === 'rss') return fetchRss(source)
  if (source.feedType === 'reddit') return fetchReddit(source)
  return fetchHtml(source)
}

async function fetchRss(source: SourceConfig): Promise<RawArticle[]> {
  try {
    const feed = await rssParser.parseURL(source.url)
    return feed.items
      .slice(0, source.maxArticles)
      .filter(item => !!item.title)
      .map(item => ({
        headline: item.title!.trim(),
        sourceUrl: item.link || source.url,
        sourceName: source.name,
        sourceCategory: source.category,
        publishedAt: item.pubDate || item.isoDate || null,
        rawContent: stripHtml(
          item.contentSnippet || item.content || item.summary || ''
        ).substring(0, 1500),
      }))
  } catch (err) {
    console.warn(`  [SKIP] ${source.name} (RSS): ${(err as Error).message}`)
    return []
  }
}

async function fetchHtml(source: SourceConfig): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'ImmigrationResearchBot/1.0 (news aggregator)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()
    const root = parseHtml(html)

    // Try selectors in priority order — more specific first
    const selectors = [
      'article h2 a', 'article h3 a',
      '.entry-title a', '.post-title a',
      '.card-title a', '.article-title a',
      '.kb-article a', '.article-card a',
      '.news-listing a', '.views-row a',
      '.field-content a', 'h2 a[href]',
      'h3 a[href]', 'li a[href]',
    ]

    let links: { text: string; href: string }[] = []
    for (const sel of selectors) {
      const els = root.querySelectorAll(sel)
      if (els.length >= 2) {
        links = els.map(el => ({
          text: el.text.trim(),
          href: el.getAttribute('href') || '',
        }))
        break
      }
    }

    // Deduplicate by href within this source fetch
    const seen = new Set<string>()
    const unique = links.filter(l => {
      if (seen.has(l.href)) return false
      seen.add(l.href)
      return true
    })

    return unique
      .filter(l => l.text.length > 15 && l.href)
      .slice(0, source.maxArticles)
      .map(l => ({
        headline: l.text,
        sourceUrl: resolveUrl(l.href, source.url),
        sourceName: source.name,
        sourceCategory: source.category,
        publishedAt: null,
        rawContent: l.text,
      }))
  } catch (err) {
    console.warn(`  [SKIP] ${source.name} (HTML): ${(err as Error).message}`)
    return []
  }
}

// ── Reddit JSON API ───────────────────────────────────────────────────────────
// Uses Reddit's free JSON API — no auth required for public subreddits.
// source.url should be the subreddit JSON endpoint, e.g. https://www.reddit.com/r/immigration/new.json
async function fetchReddit(source: SourceConfig): Promise<RawArticle[]> {
  try {
    const url = source.url.endsWith('.json') ? source.url : `${source.url}.json`
    const res = await fetch(`${url}?limit=${source.maxArticles * 2}&t=day`, {
      headers: {
        'User-Agent': 'ImmigrationResearchBot/1.0 (news aggregator)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json() as {
      data?: {
        children?: Array<{
          data?: {
            title?: string
            url?: string
            permalink?: string
            selftext?: string
            score?: number
            num_comments?: number
            author?: string
            created_utc?: number
          }
        }>
      }
    }

    const posts = data.data?.children ?? []
    return posts
      .filter(p => {
        const d = p.data
        if (!d?.title || !d.permalink) return false
        // Filter out low-quality posts: too short, removed, etc.
        if (d.title.length < 15) return false
        if (d.selftext === '[removed]' || d.selftext === '[deleted]') return false
        return true
      })
      .slice(0, source.maxArticles)
      .map(p => {
        const d = p.data!
        const postUrl = `https://reddit.com${d.permalink}`
        const body = d.selftext && d.selftext.length > 30
          ? d.selftext.substring(0, 1200)
          : `[Link post] ${d.url ?? postUrl}`
        return {
          headline: d.title!.trim(),
          sourceUrl: postUrl,
          sourceName: source.name,
          sourceCategory: source.category,
          publishedAt: d.created_utc
            ? new Date(d.created_utc * 1000).toISOString()
            : null,
          rawContent: `Score: ${d.score ?? 0} | Comments: ${d.num_comments ?? 0}\n\n${body}`,
        }
      })
  } catch (err) {
    console.warn(`  [SKIP] ${source.name} (Reddit): ${(err as Error).message}`)
    return []
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http')) return href
  try {
    const base = new URL(baseUrl)
    return `${base.origin}${href.startsWith('/') ? '' : '/'}${href}`
  } catch {
    return href
  }
}
