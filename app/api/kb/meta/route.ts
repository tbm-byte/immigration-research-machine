import { NextResponse } from 'next/server'
import { getKbMeta } from '../../../../src/supabase'

export async function GET() {
  try {
    const meta = await getKbMeta()
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ count: 0, last_updated: null }, { status: 200 })
  }
}
