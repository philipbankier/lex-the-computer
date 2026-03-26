import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookie = (await cookies()).get('lex_session');
  if (!cookie) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({ authenticated: true });
}

