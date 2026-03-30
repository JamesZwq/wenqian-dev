import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maze Runner",
  description:
    "Race through procedurally generated mazes with power-ups! Solo, vs AI, local co-op, or P2P online — browser-to-browser.",
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
    images: ["/api/og?title=Maze%20Runner&subtitle=Procedural%20mazes%20with%20power-ups%20%E2%80%94%20solo%20or%20P2P&tag=game"],
  },
};

export default function MazeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
