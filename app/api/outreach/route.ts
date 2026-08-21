import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// Allowed fields for PATCH — prevents mass-assignment attacks
const PATCHABLE = new Set([
  'firm_name', 'contact_name', 'platform', 'social_handle', 'mobile_number',
  'linkedin_url', 'website_url', 'status', 'draft_message', 'notes',
  'outreach_date', 'replied', 'genuine_interest', 'booked', 'sold',
  'next_action_date', 'next_action',
])

// GET /api/outreach — return all outreach contacts
export async function GET() {
  const { data, error } = await supabase
    .from('outreach_contacts')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/outreach — create a new contact
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    firm_name, contact_name, platform, social_handle, mobile_number,
    linkedin_url, website_url, insight_id, insight_headline, draft_message, notes,
  } = body

  const trimmedFirm = (firm_name ?? '').toString().trim()
  if (!trimmedFirm) return NextResponse.json({ error: 'firm_name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('outreach_contacts')
    .insert({
      firm_name: trimmedFirm,
      contact_name: contact_name?.trim() || null,
      platform: platform ?? null,
      social_handle: social_handle?.trim().replace(/^@/, '') || null,
      mobile_number: mobile_number?.trim() || null,
      linkedin_url: linkedin_url ?? null,
      website_url: website_url ?? null,
      status: 'spotted',
      insight_id: insight_id ?? null,
      insight_headline: insight_headline ?? null,
      draft_message: draft_message ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/outreach — update allowed fields only
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...rawUpdates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Strip any fields not in the allowlist
  const updates: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(rawUpdates)) {
    if (PATCHABLE.has(key)) updates[key] = val
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('outreach_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/outreach — remove a contact
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('outreach_contacts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
