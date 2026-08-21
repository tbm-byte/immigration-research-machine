import { SourceConfig } from './types'

export const SOURCES: SourceConfig[] = [

  // ── Immigration News — Government & Official ──────────────────────────────

  { name: 'USCIS',
    url: 'https://www.uscis.gov/news/news-releases',
    feedType: 'html', category: 'Immigration News', maxArticles: 3 },

  { name: 'ICE Newsroom',
    url: 'https://www.ice.gov/news/releases',
    feedType: 'html', category: 'Immigration News', maxArticles: 2 },

  { name: 'Federal Register (Immigration)',
    url: 'https://www.federalregister.gov/agencies/executive-office-for-immigration-review.rss',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Department of State (Visas)',
    url: 'https://travel.state.gov/content/travel/en/News/visalaw0.html',
    feedType: 'html', category: 'Immigration News', maxArticles: 2 },

  // ── Google News RSS — direct search feeds (no Apify needed) ─────────────
  // Rotated via URL params — each covers a different angle of the beat

  { name: 'Google News: USCIS updates',
    url: 'https://news.google.com/rss/search?q=USCIS+policy+2026&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 4 },

  { name: 'Google News: immigration enforcement',
    url: 'https://news.google.com/rss/search?q=immigration+enforcement+news&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 4 },

  { name: 'Google News: H-1B visa',
    url: 'https://news.google.com/rss/search?q=H-1B+visa+2026&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'Google News: DACA',
    url: 'https://news.google.com/rss/search?q=DACA+court+ruling&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'Google News: immigration attorney marketing',
    url: 'https://news.google.com/rss/search?q=immigration+law+firm+marketing&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 3 },

  { name: 'Google News: asylum seekers',
    url: 'https://news.google.com/rss/search?q=asylum+seekers+US+2026&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'Google News: green card backlog',
    url: 'https://news.google.com/rss/search?q=green+card+backlog+2026&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Google News: deportation defense',
    url: 'https://news.google.com/rss/search?q=deportation+defense+attorney&hl=en-US&gl=US&ceid=US:en',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  // ── Immigration News — Major Media ────────────────────────────────────────

  { name: 'AP News Immigration',
    url: 'https://rsshub.app/apnews/topics/immigration',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'NPR Immigration',
    url: 'https://feeds.npr.org/1014/rss.xml',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Reuters Immigration',
    url: 'https://feeds.reuters.com/reuters/topNews',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'The Hill Immigration',
    url: 'https://thehill.com/homenews/immigration/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Politico Immigration',
    url: 'https://rss.politico.com/politics-news.xml',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Axios Immigration',
    url: 'https://api.axios.com/feed/immigration',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'NBC News Immigration',
    url: 'https://feeds.nbcnews.com/nbcnews/public/news',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  // ── Immigration News — Specialist Outlets ─────────────────────────────────

  { name: 'National Immigration Forum',
    url: 'https://immigrationforum.org/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'Immigration Impact (AILF)',
    url: 'https://immigrationimpact.com/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'ACLU Immigrants Rights',
    url: 'https://www.aclu.org/taxonomy/term/6/feed',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'American Immigration Council',
    url: 'https://www.americanimmigrationcouncil.org/newsroom/rss',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  // Immigration attorney blogs — highly practical, firm-level perspective
  { name: 'Murthy Law Firm',
    url: 'https://murthy.com/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 3 },

  { name: 'Insightful Immigration Blog',
    url: 'https://blog.cyrusmehta.com/feed',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Hunton Immigration Insights',
    url: 'https://www.huntonlaborblog.com/category/immigration/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Big Immigration Law Blog',
    url: 'https://bigimmigrationlawblog.com/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Visa Lawyer Blog',
    url: 'https://visalawyerblog.com/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'AILA Think Immigration',
    url: 'https://www.aila.org/blog/rss',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'Greg Siskind Visalaw',
    url: 'https://visalaw.com/feed/',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  { name: 'ImmigrationProf Blog',
    url: 'https://lawprofessors.typepad.com/immigration/atom.xml',
    feedType: 'rss', category: 'Immigration News', maxArticles: 2 },

  // ── Reddit — Community Intelligence ──────────────────────────────────────
  // Free JSON API — captures real questions, fears, and buying triggers

  { name: 'Reddit r/immigration',
    url: 'https://www.reddit.com/r/immigration/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 5 },

  { name: 'Reddit r/USCIS',
    url: 'https://www.reddit.com/r/USCIS/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 4 },

  { name: 'Reddit r/ImmigrationLaw',
    url: 'https://www.reddit.com/r/ImmigrationLaw/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 4 },

  { name: 'Reddit r/visa',
    url: 'https://www.reddit.com/r/visa/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 3 },

  { name: 'Reddit r/LegalAdvice (Immigration)',
    url: 'https://www.reddit.com/r/LegalAdvice/search.json?q=immigration&sort=new&restrict_sr=on',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 3 },

  { name: 'Reddit r/h1b',
    url: 'https://www.reddit.com/r/h1b/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 3 },

  { name: 'Reddit r/DACA',
    url: 'https://www.reddit.com/r/DACA/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 2 },

  { name: 'Reddit r/asylumintheusa',
    url: 'https://www.reddit.com/r/asylumintheusa/top.json?t=day',
    feedType: 'reddit', category: 'Immigration News', maxArticles: 2 },

  // ── Legal Marketing ───────────────────────────────────────────────────────

  { name: 'Rankings.io',
    url: 'https://rankings.io/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Juris Digital',
    url: 'https://jurisdigital.com/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Paper Street',
    url: 'https://paperstreet.com/blog/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Postali',
    url: 'https://postali.com/blog/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Law Lytics',
    url: 'https://lawlytics.com/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Spotlight Branding',
    url: 'https://spotlightbranding.com/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Docketwise Blog',
    url: 'https://www.docketwise.com/blog/feed',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'FindLaw For Lawyers',
    url: 'https://legalblogs.findlaw.com/law_and_life/atom.xml',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'Above the Law',
    url: 'https://abovethelaw.com/feed/',
    feedType: 'rss', category: 'Legal Marketing', maxArticles: 2 },

  { name: 'My Legal Academy KB',
    url: 'https://mylegalacademy.com/kb',
    feedType: 'html', category: 'Legal Marketing', maxArticles: 50 },

  // Reddit — Legal marketing community
  { name: 'Reddit r/LawFirm',
    url: 'https://www.reddit.com/r/LawFirm/top.json?t=week',
    feedType: 'reddit', category: 'Legal Marketing', maxArticles: 3 },

  { name: 'Reddit r/Lawyertalk',
    url: 'https://www.reddit.com/r/Lawyertalk/top.json?t=week',
    feedType: 'reddit', category: 'Legal Marketing', maxArticles: 2 },

  // ── General Marketing ──────────────────────────────────────────────────────

  { name: 'Search Engine Journal',
    url: 'https://www.searchenginejournal.com/feed/',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  { name: 'HubSpot Marketing',
    url: 'https://blog.hubspot.com/marketing/rss.xml',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  { name: 'Buffer Blog',
    url: 'https://buffer.com/resources/feed/',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  { name: 'Later Blog (Instagram strategy)',
    url: 'https://later.com/blog/feed/',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  { name: 'Sprout Social',
    url: 'https://sproutsocial.com/insights/feed/',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  { name: 'Marketing Week',
    url: 'https://www.marketingweek.com/feed/',
    feedType: 'rss', category: 'General Marketing', maxArticles: 2 },

  // ── Paid Media & Facebook/Google Ads ──────────────────────────────────────

  { name: 'Search Engine Land',
    url: 'https://searchengineland.com/feed',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'Social Media Examiner',
    url: 'https://www.socialmediaexaminer.com/feed/',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'WordStream',
    url: 'https://www.wordstream.com/blog/feed',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'Jon Loomer Digital',
    url: 'https://www.jonloomer.com/feed/',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'PPC Hero',
    url: 'https://www.ppchero.com/feed/',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'Marketing Land',
    url: 'https://martech.org/feed/',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  { name: 'Meta for Business Blog',
    url: 'https://www.facebook.com/business/news/rss',
    feedType: 'rss', category: 'Paid Media', maxArticles: 2 },

  // Reddit — Paid ads community
  { name: 'Reddit r/PPC',
    url: 'https://www.reddit.com/r/PPC/top.json?t=week',
    feedType: 'reddit', category: 'Paid Media', maxArticles: 3 },

  { name: 'Reddit r/FacebookAds',
    url: 'https://www.reddit.com/r/FacebookAds/top.json?t=week',
    feedType: 'reddit', category: 'Paid Media', maxArticles: 3 },

  { name: 'Reddit r/marketing',
    url: 'https://www.reddit.com/r/marketing/top.json?t=week',
    feedType: 'reddit', category: 'Paid Media', maxArticles: 2 },

  // ── Industry Research ──────────────────────────────────────────────────────

  { name: 'iLawyer Marketing',
    url: 'https://www.ilawyermarketing.com/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'Attorney at Work',
    url: 'https://www.attorneyatwork.com/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'Lawyerist',
    url: 'https://lawyerist.com/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'Law Technology Today',
    url: 'https://www.lawtechnologytoday.org/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'Clio Blog',
    url: 'https://www.clio.com/blog/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'Lawmatics Blog',
    url: 'https://www.lawmatics.com/blog/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  { name: 'LawPay Insights',
    url: 'https://www.lawpay.com/about/blog/feed/',
    feedType: 'rss', category: 'Industry Research', maxArticles: 2 },

  // Reddit — Business development
  { name: 'Reddit r/smallbusiness',
    url: 'https://www.reddit.com/r/smallbusiness/top.json?t=week',
    feedType: 'reddit', category: 'Industry Research', maxArticles: 2 },

  { name: 'Reddit r/Entrepreneur',
    url: 'https://www.reddit.com/r/Entrepreneur/top.json?t=week',
    feedType: 'reddit', category: 'Industry Research', maxArticles: 2 },
]
