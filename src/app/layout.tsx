import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";
import ClientLayout from "./components/ClientLayout";
import AnimatedFavicon from "./components/AnimatedFavicon";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://wenqian.me"
  ),
  title: {
    default: "Wenqian Zhang | Ph.D. @ UNSW",
    template: "%s | Wenqian Zhang",
  },
  description:
    "Wenqian Zhang — UNSW CS Ph.D. | Large-Scale Graph Analysis | SIGMOD 2025 | Distributed Systems",
  openGraph: {
    type: "website",
    siteName: "Wenqian Zhang",
    title: "Wenqian Zhang | Ph.D. @ UNSW",
    description:
      "Wenqian Zhang — UNSW CS Ph.D. researching large-scale graph systems, SIGMOD 2025. Explore interactive P2P web apps and research.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Wenqian Zhang | Ph.D. @ UNSW",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wenqian Zhang | Ph.D. @ UNSW",
    description:
      "Wenqian Zhang — UNSW CS Ph.D. | Large-Scale Graph Analysis | SIGMOD 2025",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var setting = localStorage.getItem('theme-setting') || 'system';
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var effective = setting === 'system' ? (prefersDark ? 'dark' : 'light') : setting;
                  var root = document.documentElement;
                  root.dataset.theme = effective;
                  root.classList.toggle('dark', effective === 'dark');
                  root.style.colorScheme = effective;
                } catch (e) {
                  // ignore
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased text-[var(--pixel-text)]`}
      >
        <ThemeProvider>
          <AnimatedFavicon />
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
