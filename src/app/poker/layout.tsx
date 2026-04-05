import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Texas Hold'em",
  description:
    "Play heads-up Texas Hold'em poker with a friend via P2P — no signup, no server required.",
  openGraph: {
    title: "Texas Hold'em | Wenqian Zhang",
    description:
      "Heads-up No-Limit Texas Hold'em via P2P. Browser-to-browser, no signup.",
    images: [
      {
        url: "/api/og?title=Texas%20Hold'em&subtitle=Heads-up%20P2P%20Poker&tag=game",
        width: 1200,
        height: 630,
        alt: "Texas Hold'em",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Texas Hold'em | Wenqian Zhang",
    description: "Heads-up P2P poker — challenge a friend!",
    images: ["/api/og?title=Texas%20Hold'em&subtitle=Heads-up%20P2P%20Poker&tag=game"],
  },
};

export default function PokerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
