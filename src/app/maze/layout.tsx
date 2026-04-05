import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maze Runner",
  description:
    "Race through procedurally generated mazes with power-ups and bombs. Solo, vs AI, local co-op, or P2P online — no signup, browser-to-browser.",
  keywords: [
    "maze game online",
    "procedural maze",
    "browser maze game",
    "maze runner online",
    "co-op maze game",
    "p2p multiplayer game",
    "free browser game no download",
  ],
  openGraph: {
    title: "Maze Runner | Wenqian Zhang",
    description:
      "Race through procedurally generated mazes. Solo, vs AI, local co-op, or P2P online with power-ups and bombs.",
    images: [
      {
        url: "/api/og?title=Maze%20Runner&subtitle=Procedural%20mazes%20with%20power-ups%20%E2%80%94%20solo%20or%20P2P&tag=game",
        width: 1200,
        height: 630,
        alt: "Maze Runner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maze Runner | Wenqian Zhang",
    description: "Race through procedural mazes — solo, vs AI, local or P2P!",
    images: [
      "/api/og?title=Maze%20Runner&subtitle=Procedural%20mazes%20with%20power-ups%20%E2%80%94%20solo%20or%20P2P&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Maze Runner",
  description:
    "Race through procedurally generated mazes with power-ups and bombs. Play solo, against AI, locally with a friend, or compete via P2P browser connection.",
  url: "https://wenqian.dev/maze",
  applicationCategory: "GameApplication",
  genre: "Puzzle, Action",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function MazeLayout({ children }: { children: React.ReactNode }) {
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
