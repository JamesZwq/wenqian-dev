import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pattern",
  description:
    "Memory test — watch the sequence of colors, then repeat. How many rounds can you remember? Solo or race a friend via P2P.",
  keywords: [
    "simon says online",
    "pattern memory game",
    "color sequence memory",
    "memory test online",
    "p2p memory game",
  ],
  openGraph: {
    title: "Pattern | Wenqian Zhang",
    description:
      "Memory test — watch the color sequence, then repeat. Solo or P2P race, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Pattern&subtitle=Watch%20the%20sequence%2C%20then%20repeat&tag=game",
        width: 1200,
        height: 630,
        alt: "Pattern",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pattern | Wenqian Zhang",
    description: "Memory test — watch the color sequence, then repeat. Solo or P2P race!",
    images: [
      "/api/og?title=Pattern&subtitle=Watch%20the%20sequence%2C%20then%20repeat&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pattern",
  description:
    "Pattern is a Simon Says-style memory test. Watch a sequence of colored quadrants light up, then repeat the sequence by clicking the colors in order. Each round adds one more color. Solo mode tracks your best round; P2P mode lets two players race the same sequence — highest round wins.",
  url: "https://wenqian.dev/pattern",
  applicationCategory: "GameApplication",
  genre: "Memory",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC and Web Audio support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function PatternLayout({ children }: { children: React.ReactNode }) {
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
