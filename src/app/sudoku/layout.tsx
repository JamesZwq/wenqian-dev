import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sudoku",
  description:
    "Play Sudoku solo or race a friend via P2P — same puzzle, fastest solver wins! No signup, no server, browser-to-browser.",
  keywords: [
    "sudoku online",
    "play sudoku free",
    "sudoku browser game",
    "sudoku multiplayer",
    "p2p sudoku race",
    "sudoku puzzle online",
    "free sudoku no ads",
  ],
  openGraph: {
    title: "Sudoku | Wenqian Zhang",
    description:
      "Sudoku solo or P2P race — same puzzle, fastest wins. No signup, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Sudoku&subtitle=Solo%20or%20P2P%20race%20%E2%80%94%20same%20puzzle%2C%20fastest%20wins&tag=game",
        width: 1200,
        height: 630,
        alt: "Sudoku",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sudoku | Wenqian Zhang",
    description: "Sudoku solo or P2P race — same puzzle, fastest solver wins!",
    images: [
      "/api/og?title=Sudoku&subtitle=Solo%20or%20P2P%20race%20%E2%80%94%20same%20puzzle%2C%20fastest%20wins&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sudoku",
  description:
    "Play Sudoku solo or challenge a friend to a race via peer-to-peer browser connection. Both players get the same puzzle — fastest solver wins. No signup required.",
  url: "https://wenqian.dev/sudoku",
  applicationCategory: "GameApplication",
  genre: "Puzzle",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function SudokuLayout({ children }: { children: React.ReactNode }) {
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
