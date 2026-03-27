import type { Paper } from '../types';

/** Classify a single paper via the /api/papers/classify route */
export async function classifyPaper(
  paper: Paper,
  config: { apiKey: string; baseUrl: string; model: string }
): Promise<string[]> {
  const res = await fetch('/api/papers/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: paper.title,
      venue: paper.venue,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Classification failed: ${text}`);
  }

  const data = await res.json();
  return (data.categories as string[]) ?? [];
}

/**
 * Classify a batch of papers with rate-limiting.
 * Calls onProgress after each paper, calls onError on individual failure (continues).
 * Returns a map of paperId → categories.
 */
export async function classifyBatch(
  papers: Paper[],
  config: { apiKey: string; baseUrl: string; model: string },
  callbacks?: {
    onProgress?: (done: number, total: number, paperId: string, categories: string[]) => void;
    onError?: (paperId: string, error: string) => void;
  }
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    try {
      const categories = await classifyPaper(paper, config);
      results.set(paper.id, categories);
      callbacks?.onProgress?.(i + 1, papers.length, paper.id, categories);
    } catch (err) {
      callbacks?.onError?.(paper.id, String(err));
    }
    // Throttle: 250ms between requests to avoid rate limits
    if (i < papers.length - 1) await new Promise((r) => setTimeout(r, 250));
  }

  return results;
}
