import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schulte",
  description:
    "Classic reaction speed test — click numbers 1 to N in order on a shuffled grid. Solo or race a friend via P2P.",
  keywords: [
    "schulte table online",
    "schulte grid",
    "reaction time test",
    "number sequence game",
    "schulte p2p",
  ],
  openGraph: {
    title: "Schulte | Wenqian Zhang",
    description:
      "Classic Schulte Table — click numbers in order. Solo or P2P race, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Schulte&subtitle=Click%20numbers%20in%20order%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
        width: 1200,
        height: 630,
        alt: "Schulte",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Schulte | Wenqian Zhang",
    description: "Classic Schulte Table — click numbers in order. Solo or P2P race!",
    images: [
      "/api/og?title=Schulte&subtitle=Click%20numbers%20in%20order%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Schulte",
  description:
    "Classic Schulte Table reaction speed test — click numbers 1 to N in order on a shuffled grid. Supports 3×3, 4×4, and 5×5 grids. Solo mode tracks best times; P2P mode races two players on the same shuffled puzzle.",
  url: "https://wenqian.dev/schulte",
  applicationCategory: "GameApplication",
  genre: "Reaction / Puzzle",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function SchulteLayout({ children }: { children: React.ReactNode }) {
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
