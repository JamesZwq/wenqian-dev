import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Math Sprint",
  description:
    "Speed arithmetic challenge. Race through 10–50 math questions solo or challenge a friend in a real-time P2P duel.",
  openGraph: {
    title: "Math Sprint | Wenqian Zhang",
    description:
      "How fast can you do mental arithmetic? Solo time trials or P2P online race — no signup needed.",
    images: [
      {
        url: "/api/og?title=Math%20Sprint&subtitle=Speed%20arithmetic%20challenge%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
        width: 1200,
        height: 630,
        alt: "Math Sprint",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Math Sprint | Wenqian Zhang",
    description: "Speed arithmetic challenge — solo or P2P online race!",
    images: ["/api/og?title=Math%20Sprint&subtitle=Speed%20arithmetic%20challenge%20%E2%80%94%20solo%20or%20P2P%20race&tag=game"],
  },
};

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return children;
}
