import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Halli Galli",
  description:
    "Play Halli Galli online with a friend via P2P — ring the bell when any fruit totals exactly 5!",
  openGraph: {
    title: "Halli Galli | Wenqian Zhang",
    description:
      "Ring the bell when any fruit totals 5! P2P card game — no signup, direct browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Halli%20Galli&subtitle=Ring%20the%20bell%20when%20any%20fruit%20totals%205!&tag=game",
        width: 1200,
        height: 630,
        alt: "Halli Galli",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Halli Galli | Wenqian Zhang",
    description: "Ring the bell when any fruit totals 5! P2P card game online.",
    images: ["/api/og?title=Halli%20Galli&subtitle=Ring%20the%20bell%20when%20any%20fruit%20totals%205!&tag=game"],
  },
};

export default function HalliGalliLayout({ children }: { children: React.ReactNode }) {
  return children;
}
