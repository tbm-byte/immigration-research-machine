import { createClient } from '@supabase/supabase-js'
import { ProcessedInsight } from './types'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },  // suppress Node.js localStorage warning
})

export async function getExistingHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()

  const { data, error } = await supabase
    .from('news_insights')
    .select('content_hash')
    .in('content_hash', hashes)

  if (error) throw new Error(`Supabase query error: ${error.message}`)
  return new Set((data ?? []).map((r: { content_hash: string }) => r.content_hash))
}

export async function insertInsights(insights: ProcessedInsight[]): Promise<string[]> {
  if (insights.length === 0) return []

  const { data, error } = await supabase
    .from('news_insights')
    .upsert(insights, { onConflict: 'content_hash', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`Supabase insert error: ${error.message}`)
  return (data ?? []).map((r: { id: string }) => r.id)
}

// ── Disqualified leads ─────────────────────────────────────────────────────────

export interface DQEntry {
  firm_name:     string
  platform:      string
  social_handle: string | null
  website_url:   string | null
  reason:        string
}

export interface DQRow extends DQEntry {
  id:         string
  created_at: string
}

/** Unique key for a lead — used to match future search results */
export function dqKey(platform: string, handle: string | null, firmName: string): string {
  return `${platform}:${(handle ?? firmName).toLowerCase()}`
}

export async function insertDQ(entry: DQEntry): Promise<void> {
  const { error } = await supabase.from('disqualified_leads').insert(entry)
  if (error) throw new Error(`DQ insert error: ${error.message}`)
}

export async function deleteDQ(id: string): Promise<void> {
  const { error } = await supabase.from('disqualified_leads').delete().eq('id', id)
  if (error) throw new Error(`DQ delete error: ${error.message}`)
}

export async function getDQRows(): Promise<DQRow[]> {
  const { data, error } = await supabase
    .from('disqualified_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`DQ fetch error: ${error.message}`)
  return (data ?? []) as DQRow[]
}

/** Returns a Set of "platform:handle_or_firm" keys for fast filtering */
export async function getDQKeys(): Promise<Set<string>> {
  const rows = await getDQRows()
  return new Set(rows.map(r => dqKey(r.platform, r.social_handle, r.firm_name)))
}

/** Returns reason → count map for adaptive scoring */
export async function getDQReasonCounts(): Promise<Record<string, number>> {
  const rows = await getDQRows()
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.reason] = (counts[r.reason] ?? 0) + 1
  return counts
}
