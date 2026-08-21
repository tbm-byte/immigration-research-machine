import { NextRequest, NextResponse } from 'next/server'
import { insertDQ, deleteDQ, getDQRows, getDQReasonCounts } from '../../../src/supabase'
import type { DQEntry } from '../../../src/supabase'

// POST /api/dq — save a disqualified lead
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as DQEntry
    if (!body.firm_name || !body.platform || !body.reason) {
      return NextResponse.json({ error: 'firm_name, platform, and reason are required' }, { status: 400 })
    }
    await insertDQ(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/dq — list all DQ'd leads + reason counts (for AI training display)
export async function GET() {
  try {
    const [rows, reasonCounts] = await Promise.all([getDQRows(), getDQReasonCounts()])
    return NextResponse.json({ leads: rows, reasonCounts, total: rows.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/dq?id=... — remove a DQ entry (un-disqualify)
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await deleteDQ(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
