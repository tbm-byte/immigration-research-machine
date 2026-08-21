import { RawArticle, SourceCategory } from './types'

const CONTEXT = `
AGENCY CONTEXT: You produce intelligence for a B2B marketing agency selling
Facebook Ads and Google Ads to immigration law firms.
KEY EDGE: Facebook delivers $8-$25 per lead vs $50-$150 on Google.
Most firms fail on Facebook because they apply a Google intent model to an
awareness platform — they quit before Meta's algorithm optimizes. This keeps
the auction cheap for agencies that run it correctly.
Always shape outputs around this positioning.`

const SCHEMA = `
Respond with ONLY a valid JSON object — no markdown fences, no text outside JSON:
{
  "relevance_score": 8,
  "summary": "...",
  "impact_analysis": "...",
  "action_strategy": "...",
  "training_note": "...",
  "pitch_angle": "...",
  "social_post_angles": ["angle 1", "angle 2", "angle 3"],
  "dm_opener": "..."
}

RELEVANCE SCORE (integer 1-10):
10 = immigration + marketing gold (policy shift + clear ad angle)
7-9 = directly applicable with minor translation
4-6 = general marketing, immigration application requires effort
1-3 = unrelated brands, irrelevant vertical, no immigration angle
Score < 6 will be filtered out automatically.`

function article(a: RawArticle): string {
  return `
Headline: ${a.headline}
Source: ${a.sourceName}
Published: ${a.publishedAt ?? 'Unknown'}
Content: ${a.rawContent.substring(0, 1500)}`
}

const TEMPLATES: Record<SourceCategory, (a: RawArticle) => string> = {

  'Immigration News': (a) => `You are an expert immigration law firm marketing strategist.
${CONTEXT}
${SCHEMA}

FIELD RULES:
- summary: EXACTLY 2 sentences — (1) what happened factually, (2) legal significance for immigrants or law firms
- impact_analysis: 1 paragraph — which case types see increased demand (H-1B, asylum, deportation defense, family reunification)? How urgent is the intake surge?
- action_strategy: 3 numbered steps — (1) opening hook line for a cold email to a firm owner using this news, (2) which service to lead with and WHY this news makes it credible RIGHT NOW, (3) urgency frame — why act in 7-14 days not next quarter
- training_note: 2 bullet points: • [policy context in plain English — no jargon] • [how this affects law firm lead volume and which case type to focus on]
- pitch_angle: One cold-email subject line + opening sentence. Format: "Subject: [line] | Opening: [sentence]"
- social_post_angles: Array of exactly 3 strings, each a complete social post concept for the AGENCY'S own LinkedIn/Instagram. Format each as: "Hook: [grabby first line] | Angle: [the insight] | CTA: [what to comment/DM]"
- dm_opener: A 2-sentence cold DM to an immigration law firm owner. RULES: (1) Sentence 1 references this specific news as the timing trigger — "Saw that X just happened..." or "Just read that Y..." (2) Sentence 2 is a simple question about THEIR situation — not a pitch, not a CTA to book a call. (3) Make it about THEM, not the sender. (4) Goal: earn a conversation, not sell. (5) Feel handwritten by a peer, not AI. (6) No em dashes, no "I hope this finds you", no "I wanted to reach out". Plain language under a 6th grade reading level.

Article:${article(a)}`.trim(),

  'Legal Marketing': (a) => `You are a senior legal marketing analyst for a B2B agency selling services to immigration law firms.
${CONTEXT}
${SCHEMA}

FIELD RULES:
- summary: EXACTLY 2 sentences — what strategy/tool/trend + why it matters to a law firm marketing agency
- impact_analysis: 1 paragraph — does this apply to immigration firms specifically? Untapped edge or already common? What would adoption look like?
- action_strategy: 2-3 numbered steps — how should our agency implement or pitch this? Could it become a new service offering?
- training_note: 2 bullet points: • [what this tactic/tool is in plain terms] • [how we'd apply it for an immigration firm — one concrete example]
- pitch_angle: One sentence positioning our agency as the expert already applying this for immigration firms.
- social_post_angles: Array of exactly 3 strings. Each is a LinkedIn post angle the AGENCY can publish to attract immigration law firm owners as followers. Format: "Hook: [first line] | Angle: [the insight/take] | CTA: [engagement prompt]"
- dm_opener: A 2-sentence cold DM. Sentence 1 references this specific tactic/finding as your timing hook. Sentence 2 asks a question about THEIR current setup or situation. No pitch. No "happy to hop on a call." End with a question. Plain and direct.

Article:${article(a)}`.trim(),

  'General Marketing': (a) => `You are a growth marketing strategist translating general trends into immigration law firm tactics.
${CONTEXT}
${SCHEMA}

FIELD RULES:
- summary: EXACTLY 2 sentences — key insight + which channel or tactic it describes
- impact_analysis: 1 paragraph — can this apply to immigration law firm marketing? Rate relevance HIGH/MEDIUM/LOW with justification.
- action_strategy: 2 numbered steps — (1) one specific test to run with a law firm client, (2) how to measure success in 30 days
- training_note: 1 bullet: • [how this trend connects to our work — or "Low relevance" if it doesn't]
- pitch_angle: One sentence connecting this to an immigration firm pain point. Or "N/A — general trend" if LOW relevance.
- social_post_angles: Array of exactly 3 strings. Post angles that reframe this general marketing insight specifically for law firm audiences. Format: "Hook: [first line] | Angle: [the take] | CTA: [engagement prompt]"
- dm_opener: 2-sentence DM. Sentence 1 mentions this specific trend as a timely heads-up for their business. Sentence 2 asks a simple question about how they're currently handling [relevant aspect]. Conversational, short, about them. No pitch.

Article:${article(a)}`.trim(),

  'Paid Media': (a) => `You are a paid media specialist with deep expertise in Facebook/Meta Ads and Google Ads for immigration law firms.
${CONTEXT}
${SCHEMA}

FIELD RULES:
- summary: EXACTLY 2 sentences — what changed in paid media + which platforms are affected
- impact_analysis: 1 paragraph — OPPORTUNITY, RISK, or NEUTRAL? Specific to Facebook vs Google for immigration law ad accounts.
- action_strategy: 3 numbered steps — (1) what to change in active campaigns immediately, (2) EXACT opening line for a client value-add email, (3) how to use this in a new business pitch
- training_note: 2 bullet points: • [what changed technically — plain English] • [what to monitor in the ad account this week]
- pitch_angle: "Subject: [client email subject line] | Opening: [first sentence positioning you as ahead of the curve]"
- social_post_angles: Array of exactly 3 strings. Post angles for the AGENCY's LinkedIn showing expertise on this platform change. Format: "Hook: [first line] | Angle: [the take] | CTA: [prompt]"
- dm_opener: 2 sentences. S1: Reference this specific platform update as the reason you're reaching out — like a peer sharing a useful heads-up. S2: A question about how they're currently running [relevant aspect of their ads/marketing]. No CTA, no pitch, no call request. Ends with a "?" always.

Article:${article(a)}`.trim(),

  'Industry Research': (a) => `You are a business development strategist for a B2B agency specializing in immigration law firms.
${CONTEXT}
${SCHEMA}

FIELD RULES:
- summary: EXACTLY 2 sentences — what data is reported + the single most valuable data point
- impact_analysis: 1 paragraph — how do these benchmarks compare to average immigration law firm performance? What gap = selling opportunity?
- action_strategy: 2 numbered steps — (1) EXACT sentence to cite this stat in a proposal, (2) follow-on question to ask a prospect to make the data personally relevant
- training_note: 1 bullet: • [the most quotable stat + one-sentence context for why it matters to our pitch]
- pitch_angle: One sentence citing the most compelling stat in a way that creates urgency to invest in paid marketing now.
- social_post_angles: Array of exactly 3 strings. Data-driven LinkedIn posts the AGENCY can publish to establish credibility with law firm owners. Format: "Hook: [stat or bold claim] | Angle: [the so what] | CTA: [engagement prompt]"
- dm_opener: 2-sentence DM. Lead with the single most surprising data point from this research as a hook — "Just saw that X% of immigration firms are doing Y..." Then ask a question about THEIR situation relative to that benchmark. No pitch, no ask for a call. Ends with a "?".

Article:${article(a)}`.trim(),
}

export function buildPrompt(article: RawArticle): string {
  return TEMPLATES[article.sourceCategory](article)
}
