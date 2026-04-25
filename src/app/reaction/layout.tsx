import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reaction",
  description:
    "F1-style starting lights reaction time test. 5 rounds, measure your reflexes in milliseconds. Solo or race a friend via P2P.",
  keywords: [
    "reaction time test",
    "f1 reaction lights",
    "reflex test online",
    "speed test game",
    "reaction p2p race",
  ],
  openGraph: {
    title: "Reaction | Wenqian Zhang",
    description:
      "F1-style reaction test — 5 rounds, fastest wins. Solo or P2P race, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Reaction&subtitle=F1-style%20reaction%20test%20%E2%80%94%205%20rounds%2C%20fastest%20wins&tag=game",
        width: 1200,
        height: 630,
        alt: "Reaction",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reaction | Wenqian Zhang",
    description: "F1-style reaction test — 5 rounds, fastest wins. Solo or P2P race!",
    images: [
      "/api/og?title=Reaction&subtitle=F1-style%20reaction%20test%20%E2%80%94%205%20rounds%2C%20fastest%20wins&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Reaction",
  description:
    "F1-style starting lights reaction time test. 5 lights extinguish after a random 1.0–3.0 second delay; click as fast as possible to measure reflexes in milliseconds. 5 rounds per session. Solo mode tracks best single time and best 5-round average; P2P mode races two players over identical delays — lower average wins.",
  url: "https://wenqian.dev/reaction",
  applicationCategory: "GameApplication",
  genre: "Reaction / Reflex",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function ReactionLayout({ children }: { children: React.ReactNode }) {
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
