import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'APIFY_API_KEY not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${apiKey}`, {
      next: { revalidate: 60 }, // cache 60s
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Apify API error' }, { status: 502 })
    }

    const data = await res.json()
    const plan = data.data?.plan ?? {}
    const usage = data.data?.monthlyUsage ?? {}

    return NextResponse.json({
      monthlyLimit: plan.monthlyUsage ?? null,         // total compute units in plan
      monthlyUsed: usage.monthlyUsage ?? null,          // used so far
      unitLimit: plan.maxActorComputeUnits ?? null,
      unitUsed: usage.actorComputeUnits ?? null,
      plan: plan.id ?? 'unknown',
    })
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 502 })
  }
}
