import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') ?? '';
  const h = searchParams.get('h') ?? '50';
  const f = searchParams.get('f') ?? '0';

  if (!q) return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });

  const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(q)}&format=json&h=${h}&f=${f}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PaperManager/1.0 (academic research tool)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `DBLP returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
