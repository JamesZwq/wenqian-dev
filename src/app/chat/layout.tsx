import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "P2P Chat",
  description:
    "End-to-end encrypted peer-to-peer chat — browser-to-browser, no server, no account. RSA key exchange, real-time messaging.",
  keywords: [
    "p2p chat online",
    "encrypted browser chat",
    "anonymous chat no signup",
    "peer to peer messaging",
    "end to end encrypted chat",
    "webrtc chat",
    "private chat no server",
  ],
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
    images: [
      "/api/og?title=P2P%20Chat&subtitle=End-to-end%20encrypted%20browser-to-browser%20messaging&tag=chat",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "P2P Chat",
  description:
    "End-to-end encrypted peer-to-peer chat application. Direct browser-to-browser messaging using RSA key exchange and WebRTC. No signup, no server, no data stored.",
  url: "https://wenqian.dev/chat",
  applicationCategory: "CommunicationApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with WebRTC support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Wenqian Zhang", url: "https://wenqian.dev" },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
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
