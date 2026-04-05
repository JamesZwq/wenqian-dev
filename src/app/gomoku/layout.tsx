import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gomoku",
  description:
    "Play Five in a Row (Gomoku) against AI or challenge a friend via P2P — no signup, no server required. Easy, Medium, Hard AI modes.",
  keywords: [
    "gomoku",
    "five in a row",
    "gomoku online",
    "free browser game",
    "board game online",
    "p2p game no signup",
    "play gomoku",
  ],
  openGraph: {
    title: "Gomoku | Wenqian Zhang",
    description:
      "Play Five in a Row against AI (easy/medium/hard) or a friend online via P2P. Browser-to-browser, no signup.",
    images: [
      {
        url: "/api/og?title=Gomoku&subtitle=Five%20in%20a%20Row%20%E2%80%94%20vs%20AI%20or%20P2P%20online&tag=game",
        width: 1200,
        height: 630,
        alt: "Gomoku — Five in a Row",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gomoku | Wenqian Zhang",
    description: "Five in a Row — play vs AI or challenge a friend via P2P!",
    images: [
      "/api/og?title=Gomoku&subtitle=Five%20in%20a%20Row%20%E2%80%94%20vs%20AI%20or%20P2P%20online&tag=game",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Gomoku — Five in a Row",
  description:
    "Play Five in a Row (Gomoku) against an AI opponent or a friend via peer-to-peer browser connection. No signup or server required.",
  url: "https://wenqian.dev/gomoku",
  applicationCategory: "GameApplication",
  genre: "Board Game",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function GomokuLayout({ children }: { children: React.ReactNode }) {
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
