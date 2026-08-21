import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()

  const appPassword = process.env.APP_PASSWORD
  const appSecret = process.env.APP_SECRET

  if (!appPassword || !appSecret) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (password !== appPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('irm_session', appSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return response
}
