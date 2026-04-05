import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Math Sprint",
  description:
    "Speed arithmetic challenge — race through 10–50 math questions solo or duel a friend in real-time P2P. How fast is your mental math?",
  keywords: [
    "math game online",
    "mental arithmetic game",
    "math speed quiz",
    "arithmetic challenge",
    "math sprint game",
    "p2p math duel",
    "free math game browser",
  ],
  openGraph: {
    title: "Math Sprint | Wenqian Zhang",
    description:
      "How fast can you do mental arithmetic? Solo time trials or P2P online race — no signup needed.",
    images: [
      {
        url: "/api/og?title=Math%20Sprint&subtitle=Speed%20arithmetic%20challenge%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
        width: 1200,
        height: 630,
        alt: "Math Sprint",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Math Sprint | Wenqian Zhang",
    description: "Speed arithmetic challenge — solo or P2P online race!",
    images: [
      "/api/og?title=Math%20Sprint&subtitle=Speed%20arithmetic%20challenge%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Math Sprint",
  description:
    "A speed arithmetic challenge. Race through 10–50 math questions in a solo time trial or a real-time P2P duel against a friend.",
  url: "https://wenqian.dev/math",
  applicationCategory: "GameApplication",
  genre: "Educational, Puzzle",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
