import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface DblpVenueHit {
  info: {
    venue?: string;
    acronym?: string;
    type?: string;
    url?: string;
  };
  url?: string;
}

interface DblpVenueResponse {
  result?: {
    hits?: {
      hit?: DblpVenueHit | DblpVenueHit[];
      '@total'?: string;
    };
  };
}

/** Extract DBLP stream key from a dblp.org URL.
 *  e.g. "https://dblp.org/db/conf/sigmod/" → "conf/sigmod"
 *       "https://dblp.org/db/journals/pacmmod/" → "journals/pacmmod"
 */
function extractKey(url: string): string {
  const m = url.match(/dblp\.org\/db\/([^#?]+?)\/?$/);
  return m ? m[1] : '';
}

function inferType(raw: string, key: string): 'conference' | 'journal' {
  const t = raw.toLowerCase();
  if (t.includes('journal') || t.includes('magazine') || t.includes('transaction')) return 'journal';
  if (key.startsWith('journals/')) return 'journal';
  return 'conference';
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ venues: [] });

  const url = `https://dblp.org/search/venue/api?q=${encodeURIComponent(q)}&format=json&h=20`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PaperManager/1.0 (academic research tool)' },
    });

    if (!res.ok) return NextResponse.json({ venues: [] });

    const data: DblpVenueResponse = await res.json();
    const hits = data.result?.hits?.hit;
    if (!hits) return NextResponse.json({ venues: [] });

    const list = Array.isArray(hits) ? hits : [hits];

    const venues = list
      .map((h) => {
        const infoUrl = h.info.url ?? h.url ?? '';
        const key = extractKey(infoUrl);
        return {
          name: h.info.venue ?? '',
          acronym: h.info.acronym ?? '',
          type: inferType(h.info.type ?? '', key),
          dblpKey: key,
          url: infoUrl,
        };
      })
      .filter((v) => v.dblpKey.length > 0 && v.name.length > 0);

    return NextResponse.json({ venues });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
