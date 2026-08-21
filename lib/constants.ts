// Shared types and utilities — safe to import in client components

export type Insight = {
  id: string
  headline: string
  source_url: string
  source_origin: string
  source_category: string
  summary: string | null
  impact_analysis: string | null
  action_strategy: string | null
  training_note: string | null
  pitch_angle: string | null
  social_post_angles: string[] | null
  dm_opener: string | null
  run_date: string
  published_at: string | null
}

export type OutreachContact = {
  id: string
  created_at: string
  updated_at: string
  firm_name: string
  contact_name: string | null
  platform: 'instagram' | 'linkedin' | null
  social_handle: string | null
  mobile_number: string | null
  linkedin_url: string | null
  website_url: string | null
  status: 'spotted' | 'message_ready' | 'sent' | 'replied' | 'call_booked'
  insight_id: string | null
  insight_headline: string | null
  draft_message: string | null
  notes: string | null
  outreach_date: string | null
  replied: boolean
  genuine_interest: boolean
  booked: boolean
  sold: boolean
  next_action_date: string | null
  next_action: string | null
}

export type SavedResearch = {
  id: string
  created_at: string
  query: string
  headline: string
  source: string
  url: string
  summary: string
  impact_analysis: string
  action_strategy: string
  pitch_angle: string
  social_post_angles: string[]
  relevance_score: number
}

export type ContentIdea = {
  funnel_stage: 'TOF' | 'MOF' | 'BOF'
  format: string
  hook: string
  caption_start: string
  negative_frame: boolean
}

export const OUTREACH_COLUMNS: { key: OutreachContact['status']; label: string; emoji: string; color: string }[] = [
  { key: 'spotted',       label: 'Spotted',       emoji: '🔍', color: 'col-spotted' },
  { key: 'message_ready', label: 'Message Ready',  emoji: '✏️', color: 'col-ready' },
  { key: 'sent',          label: 'Sent',           emoji: '📤', color: 'col-sent' },
  { key: 'replied',       label: 'Replied',        emoji: '💬', color: 'col-replied' },
  { key: 'call_booked',   label: 'Call Booked',    emoji: '📅', color: 'col-booked' },
]

export function toStr(val: string | string[] | null | undefined): string {
  if (!val) return ''
  if (Array.isArray(val)) return val.join('\n')
  return val
}

export function toArr(val: string | string[] | null | undefined): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(v => String(v))
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

export const CATEGORIES = [
  { label: 'All',         value: null,                emoji: '✦' },
  { label: 'Immigration', value: 'Immigration News',  emoji: '📋' },
  { label: 'Legal Mktg', value: 'Legal Marketing',   emoji: '⚖️' },
  { label: 'General',    value: 'General Marketing',  emoji: '📣' },
  { label: 'Paid Media', value: 'Paid Media',         emoji: '🎯' },
  { label: 'Research',   value: 'Industry Research',  emoji: '📊' },
]

export const BADGE: Record<string, { cls: string; label: string }> = {
  'Immigration News':  { cls: 'badge-imm',  label: 'Immigration' },
  'Legal Marketing':   { cls: 'badge-leg',  label: 'Legal Mktg' },
  'General Marketing': { cls: 'badge-gen',  label: 'General' },
  'Paid Media':        { cls: 'badge-paid', label: 'Paid Media' },
  'Industry Research': { cls: 'badge-ind',  label: 'Research' },
}
