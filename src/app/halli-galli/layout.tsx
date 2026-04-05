import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Halli Galli",
  description:
    "Play Halli Galli online with a friend via P2P — ring the bell when any fruit totals exactly 5! No signup, browser-to-browser.",
  keywords: [
    "halli galli online",
    "halli galli game",
    "fruit card game online",
    "ring the bell game",
    "p2p card game",
    "free online card game",
    "play halli galli browser",
  ],
  openGraph: {
    title: "Halli Galli | Wenqian Zhang",
    description:
      "Ring the bell when any fruit totals 5! P2P card game — no signup, direct browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Halli%20Galli&subtitle=Ring%20the%20bell%20when%20any%20fruit%20totals%205!&tag=game",
        width: 1200,
        height: 630,
        alt: "Halli Galli",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Halli Galli | Wenqian Zhang",
    description: "Ring the bell when any fruit totals 5! P2P card game online.",
    images: [
      "/api/og?title=Halli%20Galli&subtitle=Ring%20the%20bell%20when%20any%20fruit%20totals%205!&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Halli Galli",
  description:
    "Play Halli Galli online with a friend via peer-to-peer browser connection. Ring the bell when any fruit type totals exactly 5 across the played cards. No signup required.",
  url: "https://wenqian.dev/halli-galli",
  applicationCategory: "GameApplication",
  genre: "Card Game",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function HalliGalliLayout({ children }: { children: React.ReactNode }) {
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
