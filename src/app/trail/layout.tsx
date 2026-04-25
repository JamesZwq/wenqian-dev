import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trail",
  description:
    "Trail Making test — click numbers and letters in alternating order (1, A, 2, B, ...). Tests visual attention and task switching. Solo or race a friend via P2P.",
  keywords: [
    "trail making test",
    "task switching test",
    "alternating sequence game",
    "cognitive flexibility test",
    "p2p brain game",
  ],
  openGraph: {
    title: "Trail | Wenqian Zhang",
    description:
      "Trail Making test — click 1, A, 2, B... in alternating order. Solo or P2P race, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Trail&subtitle=Click%201%2C%20A%2C%202%2C%20B...%20%E2%80%94%20alternating%20sequence&tag=game",
        width: 1200,
        height: 630,
        alt: "Trail",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trail | Wenqian Zhang",
    description: "Trail Making test — click 1, A, 2, B... in alternating order. Solo or P2P race!",
    images: [
      "/api/og?title=Trail&subtitle=Click%201%2C%20A%2C%202%2C%20B...%20%E2%80%94%20alternating%20sequence&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Trail",
  description:
    "Trail Making cognitive test — click numbers and letters in alternating order (1, A, 2, B, 3, C, ...) on a shuffled grid. Tests visual attention and task switching. Supports 3×3, 4×4, and 5×5 grids. Solo mode tracks best times; P2P mode races two players on the same shuffled puzzle.",
  url: "https://wenqian.dev/trail",
  applicationCategory: "GameApplication",
  genre: "Cognitive Test",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function TrailLayout({ children }: { children: React.ReactNode }) {
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
