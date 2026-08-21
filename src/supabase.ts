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
