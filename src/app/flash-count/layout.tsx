import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flash Count",
  description:
    "Can you count 3D isometric blocks before they vanish? A unique visual memory and perception challenge.",
  openGraph: {
    title: "Flash Count | Wenqian Zhang",
    description:
      "Count isometric 3D blocks before they disappear! A visual memory challenge — solo sprint or P2P versus mode.",
    images: [
      {
        url: "/api/og?title=Flash%20Count&subtitle=Count%203D%20blocks%20before%20they%20vanish%20%E2%80%94%20visual%20memory%20challenge&tag=game",
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
    images: ["/api/og?title=Flash%20Count&subtitle=Count%203D%20blocks%20before%20they%20vanish%20%E2%80%94%20visual%20memory%20challenge&tag=game"],
  },
};

export default function FlashCountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
