import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse Duel",
  description:
    "Play Pulse Duel online with a friend via P2P. Lock charge, strike, guard, or break on a shared clock and out-read the other side.",
  keywords: [
    "pulse duel",
    "p2p duel game",
    "online mind game",
    "browser versus game",
    "lag compensated p2p game",
    "shared clock duel",
    "web rtc duel game",
  ],
  openGraph: {
    title: "Pulse Duel | Wenqian Zhang",
    description:
      "A fast two-player P2P duel built on shared-clock action locks and lag-compensated round resolution.",
    images: [
      {
        url: "/api/og?title=Pulse%20Duel&subtitle=Shared-clock%20P2P%20duel%20%E2%80%94%20charge,%20strike,%20guard,%20break&tag=game",
        width: 1200,
        height: 630,
        alt: "Pulse Duel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulse Duel | Wenqian Zhang",
    description: "Shared-clock P2P duel — charge, strike, guard, break.",
    images: [
      "/api/og?title=Pulse%20Duel&subtitle=Shared-clock%20P2P%20duel%20%E2%80%94%20charge,%20strike,%20guard,%20break&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pulse Duel",
  description:
    "A two-player peer-to-peer duel game where both players lock one move per pulse on a shared clock. No signup or server required.",
  url: "https://wenqian.dev/pulse-duel",
  applicationCategory: "GameApplication",
  genre: "Strategy Game",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function PulseDuelLayout({ children }: { children: React.ReactNode }) {
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

