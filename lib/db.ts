// Server-only — never import this in a 'use client' component
import { createClient } from '@supabase/supabase-js'
import type { Insight, OutreachContact } from './constants'

export type { Insight, OutreachContact } from './constants'
export { toStr, toArr, CATEGORIES, BADGE, OUTREACH_COLUMNS } from './constants'

const supabaseUrl = process.env.SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },  // Node.js — no localStorage needed
})

export async function getInsights(date: string): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('news_insights')
    .select('id, headline, source_url, source_origin, source_category, summary, impact_analysis, action_strategy, training_note, pitch_angle, social_post_angles, dm_opener, run_date, published_at')
    .eq('run_date', date)
    .order('source_category', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Supabase error: ${error.message}`)
  return (data ?? []) as Insight[]
}

export async function getOutreachContacts(): Promise<OutreachContact[]> {
  const { data, error } = await supabase
    .from('outreach_contacts')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Supabase error: ${error.message}`)
  return (data ?? []) as OutreachContact[]
}
