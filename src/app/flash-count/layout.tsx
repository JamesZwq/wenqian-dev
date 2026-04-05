import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flash Count",
  description:
    "Can you count 3D isometric blocks before they vanish? A unique visual memory and spatial perception challenge — solo sprint or P2P versus mode.",
  keywords: [
    "block counting game",
    "visual memory game",
    "isometric blocks game",
    "flash count",
    "spatial perception game",
    "brain game online",
    "free puzzle game browser",
  ],
  openGraph: {
    title: "Flash Count | Wenqian Zhang",
    description:
      "Count isometric 3D blocks before they disappear! A visual memory challenge — solo sprint or P2P versus mode.",
    images: [
      {
        url: "/api/og?title=Flash%20Count&subtitle=Count%203D%20blocks%20before%20they%20vanish%20%E2%80%94%20visual%20memory&tag=game",
        width: 1200,
        height: 630,
        alt: "Flash Count",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flash Count | Wenqian Zhang",
    description: "Count 3D isometric blocks before they vanish — visual memory challenge!",
    images: [
      "/api/og?title=Flash%20Count&subtitle=Count%203D%20blocks%20before%20they%20vanish%20%E2%80%94%20visual%20memory&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Flash Count",
  description:
    "A visual memory and spatial perception challenge. Count 3D isometric block stacks before they disappear, then guess the total. Solo sprint or P2P versus mode.",
  url: "https://wenqian.dev/flash-count",
  applicationCategory: "GameApplication",
  genre: "Puzzle, Educational",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function FlashCountLayout({ children }: { children: React.ReactNode }) {
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
