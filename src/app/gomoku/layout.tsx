import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gomoku",
  description:
    "Play Five in a Row (Gomoku) against AI or challenge a friend via P2P — no signup, no server required.",
  openGraph: {
    title: "Gomoku | Wenqian Zhang",
    description:
      "Play Five in a Row against AI (easy/medium/hard) or a friend online via P2P. Browser-to-browser, no signup.",
    images: [
      {
        url: "/api/og?title=Gomoku&subtitle=Five%20in%20a%20Row%20%E2%80%94%20vs%20AI%20or%20P2P%20online&tag=game",
        width: 1200,
        height: 630,
        alt: "Gomoku",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gomoku | Wenqian Zhang",
    description: "Five in a Row — play vs AI or challenge a friend via P2P!",
    images: ["/api/og?title=Gomoku&subtitle=Five%20in%20a%20Row%20%E2%80%94%20vs%20AI%20or%20P2P%20online&tag=game"],
  },
};

export default function GomokuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
