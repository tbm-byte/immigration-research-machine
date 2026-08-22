import { NextResponse } from 'next/server'
import { runKbRefresh } from '../../../../src/kb-refresh'

export const maxDuration = 300  // 5-min Vercel timeout

export async function POST() {
  try {
    const result = await runKbRefresh()
    return NextResponse.json(result)
  } catch (err) {
    console.error('KB refresh error:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
