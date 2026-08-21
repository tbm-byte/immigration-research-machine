import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import type { ResearchResult } from '../route'

// POST /api/research/save — persist a research result
export async function POST(req: NextRequest) {
  const body = await req.json() as { query?: string; result?: ResearchResult }
  const { query, result } = body

  if (!query?.trim() || !result?.headline) {
    return NextResponse.json({ error: 'query and result required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_research')
    .insert({
      query: query.trim(),
      headline: result.headline,
      source: result.source,
      url: result.url,
      summary: result.summary,
      impact_analysis: result.impact_analysis,
      action_strategy: result.action_strategy,
      pitch_angle: result.pitch_angle,
      social_post_angles: result.social_post_angles,
      relevance_score: result.relevance_score,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// GET /api/research/save — list saved research (most recent first)
export async function GET() {
  const { data, error } = await supabase
    .from('saved_research')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// DELETE /api/research/save — delete a saved item
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('saved_research')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
