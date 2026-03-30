import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "P2P Chat",
  description:
    "End-to-end encrypted peer-to-peer chat — browser-to-browser, no server required. RSA key exchange, real-time messaging.",
  openGraph: {
    title: "P2P Chat | Wenqian Zhang",
    description:
      "E2E encrypted peer-to-peer chat. Browser-to-browser messaging with RSA key exchange — no signup, no server.",
    images: [
      {
        url: "/api/og?title=P2P%20Chat&subtitle=End-to-end%20encrypted%20browser-to-browser%20messaging&tag=chat",
        width: 1200,
        height: 630,
        alt: "P2P Chat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "P2P Chat | Wenqian Zhang",
    description: "E2E encrypted browser-to-browser chat. No server, no signup.",
    images: ["/api/og?title=P2P%20Chat&subtitle=End-to-end%20encrypted%20browser-to-browser%20messaging&tag=chat"],
  },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
