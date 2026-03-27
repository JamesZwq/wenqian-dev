import { NextRequest, NextResponse } from 'next/server';

const CATEGORIES = [
  'Large Language Models',
  'Computer Vision',
  'Natural Language Processing',
  'Reinforcement Learning',
  'Graph Neural Networks',
  'Generative Models',
  'Multimodal Learning',
  'Optimization & Theory',
  'Federated Learning',
  'Robotics',
  'Speech & Audio',
  'Data Management',
  'Systems & Infrastructure',
  'Fairness & Ethics',
  'Recommendation Systems',
  'Knowledge Graphs',
  'Security & Privacy',
  'Embodied AI',
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, venue, apiKey, baseUrl, model } = body as {
    title: string;
    venue: string;
    apiKey: string;
    baseUrl: string;
    model: string;
  };

  if (!apiKey || !title) {
    return NextResponse.json({ error: 'Missing apiKey or title' }, { status: 400 });
  }

  const prompt = `You are a computer science research classifier. Given a paper title and its publication venue, return 1-2 sub-field tags.

Available tags:
${CATEGORIES.join(', ')}

Paper Title: "${title}"
Venue: "${venue}"

Respond with ONLY a JSON array of 1-2 tag strings, e.g. ["Large Language Models", "Natural Language Processing"].
If unsure, pick the single best match. Do not add explanation.`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `LLM error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? '[]') as string;
    const match = raw.match(/\[[\s\S]*?\]/);
    const categories: string[] = match ? JSON.parse(match[0]) : [];

    return NextResponse.json({ categories: categories.filter((c) => CATEGORIES.includes(c)) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
