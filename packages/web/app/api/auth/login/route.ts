import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  (await cookies()).set('lex_session', email, { httpOnly: true, sameSite: 'lax', path: '/' });
  return NextResponse.json({ ok: true });
}

