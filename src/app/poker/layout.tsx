import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Texas Hold'em",
  description:
    "Play heads-up No-Limit Texas Hold'em poker with a friend via P2P — no signup, no server. Pure browser-to-browser.",
  keywords: [
    "texas holdem online",
    "poker browser game",
    "p2p poker",
    "heads up poker",
    "no limit holdem",
    "free poker game",
    "play poker online no signup",
  ],
  openGraph: {
    title: "Texas Hold'em | Wenqian Zhang",
    description:
      "Heads-up No-Limit Texas Hold'em via P2P. Browser-to-browser, no signup.",
    images: [
      {
        url: "/api/og?title=Texas%20Hold'em&subtitle=Heads-up%20No-Limit%20Poker%20%E2%80%94%20P2P%20online&tag=game",
        width: 1200,
        height: 630,
        alt: "Texas Hold'em Poker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Texas Hold'em | Wenqian Zhang",
    description: "Heads-up P2P poker — challenge a friend directly in your browser!",
    images: [
      "/api/og?title=Texas%20Hold'em&subtitle=Heads-up%20No-Limit%20Poker%20%E2%80%94%20P2P%20online&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Texas Hold'em Poker",
  description:
    "Play heads-up No-Limit Texas Hold'em poker with a friend via peer-to-peer browser connection. No signup, no server required.",
  url: "https://wenqian.dev/poker",
  applicationCategory: "GameApplication",
  genre: "Card Game",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function PokerLayout({ children }: { children: React.ReactNode }) {
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
