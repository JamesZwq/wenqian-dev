import type { Author, Paper, VenueConfig } from '../types';

// ---------- DBLP raw types ----------

interface DblpAuthorEntry {
  text: string;
  '@pid'?: string;
}

interface DblpHitInfo {
  key: string;
  title?: string;
  year?: string;
  authors?: { author: DblpAuthorEntry | DblpAuthorEntry[] };
  booktitle?: string;
  journal?: string;
  volume?: string;
  number?: string;
  pages?: string;
  url?: string;
  ee?: string | string[];
}

interface DblpHit {
  info: DblpHitInfo;
}

interface DblpResponse {
  result?: {
    hits?: {
      hit?: DblpHit | DblpHit[];
      '@total'?: string;
      '@sent'?: string;
    };
  };
}

// ---------- Parse helpers ----------

function parseAuthors(raw: DblpHitInfo['authors']): Author[] {
  if (!raw) return [];
  const list = Array.isArray(raw.author) ? raw.author : [raw.author];
  return list.map((a) => ({ name: a.text, pid: a['@pid'] }));
}

function parseEe(ee?: string | string[]): string | undefined {
  if (!ee) return undefined;
  const arr = Array.isArray(ee) ? ee : [ee];
  return arr.find((u) => u.includes('arxiv.org') || u.includes('doi.org')) ?? arr[0];
}

function parseDoi(ee?: string | string[]): string | undefined {
  if (!ee) return undefined;
  const arr = Array.isArray(ee) ? ee : [ee];
  const doi = arr.find((u) => u.includes('doi.org'));
  return doi?.replace(/https?:\/\/(dx\.)?doi\.org\//, '');
}

/** Strip HTML tags and decode common entities in DBLP titles */
function cleanTitle(raw?: string): string {
  if (!raw) return 'Unknown Title';
  return raw
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// ---------- Public API ----------

/** Parse a single DBLP hit into our Paper format */
export function parseDblpHit(hit: DblpHit, venue: VenueConfig): Paper {
  const { info } = hit;
  const id = info.key.replace(/\//g, '-');

  return {
    id,
    dblpKey: info.key,
    title: cleanTitle(info.title),
    authors: parseAuthors(info.authors),
    venue: venue.shortName,
    venueType: venue.type,
    year: parseInt(info.year ?? '0') || 0,
    doi: parseDoi(info.ee),
    url: info.url,
    ee: parseEe(info.ee),
    pages: info.pages,
    rating: 0,
    fetchedAt: new Date().toISOString(),
  };
}

/** Fetch papers for one venue from the DBLP proxy route.
 *
 *  NOTE: DBLP's `year:YYYY` query matches ONLY that exact year.
 *  To support "from year X onwards", we fetch a larger batch and filter
 *  client-side using `paper.year >= yearFrom`.
 */
export async function fetchVenuePapers(
  venue: VenueConfig,
  limit = 50,
  yearFrom?: number
): Promise<Paper[]> {
  // Fetch more to compensate for year-filtering reducing the result count.
  // Cap at 300 to avoid excessively large requests.
  const fetchLimit = yearFrom ? Math.min(limit * 3, 300) : limit;
  const query = `streamid:${venue.dblpKey}:`;

  const url = `/api/papers/fetch?q=${encodeURIComponent(query)}&h=${fetchLimit}&f=0`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DBLP fetch failed for ${venue.shortName}: ${err}`);
  }

  const data: DblpResponse = await res.json();
  const hits = data.result?.hits?.hit;
  if (!hits) return [];

  const hitList = Array.isArray(hits) ? hits : [hits];
  let papers = hitList.map((h) => parseDblpHit(h, venue));

  // Client-side year gate: keep papers published in yearFrom or later.
  if (yearFrom) {
    papers = papers.filter((p) => p.year >= yearFrom);
  }

  // Respect the original limit after filtering.
  return papers.slice(0, limit);
}

/** Fetch papers for all enabled venues, calling callbacks for progress/errors */
export async function syncAllVenues(
  venues: VenueConfig[],
  papersPerVenue: number,
  callbacks: {
    onVenueStart?: (venueId: string, name: string) => void;
    onVenueComplete?: (venueId: string, count: number) => void;
    onVenueError?: (venueId: string, error: string) => void;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<Paper[]> {
  const enabled = venues.filter((v) => v.enabled);
  const allPapers: Paper[] = [];
  let done = 0;

  for (const venue of enabled) {
    callbacks.onVenueStart?.(venue.id, venue.shortName);
    try {
      const papers = await fetchVenuePapers(venue, papersPerVenue, venue.yearFrom);
      allPapers.push(...papers);
      callbacks.onVenueComplete?.(venue.id, papers.length);
    } catch (err) {
      callbacks.onVenueError?.(venue.id, String(err));
    }
    done++;
    callbacks.onProgress?.(done, enabled.length);
    // Be polite to DBLP API
    if (done < enabled.length) await new Promise((r) => setTimeout(r, 300));
  }

  return allPapers;
}
