import { NextResponse } from 'next/server';
import { askCollection } from '@/lib/insights/ask';

/** "Ask the collection" (home page): the curated questions and excerpts that answer a visitor's question. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (query.length < 3) return NextResponse.json({ error: 'Ask a question of at least 3 characters.' }, { status: 400 });

  try {
    return NextResponse.json(await askCollection(query));
  } catch (err) {
    console.error('[ask]', err);
    return NextResponse.json({ error: 'Something went wrong finding answers. Please try again.' }, { status: 500 });
  }
}
