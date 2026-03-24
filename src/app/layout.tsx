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
  title: "Wenqian Zhang | Ph.D. @ UNSW",
  description:
    "Wenqian Zhang - UNSW CS Ph.D. | Large-Scale Graph Analysis | SIGMOD 2025 | Distributed Systems",
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
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[var(--pixel-bg)] text-[var(--pixel-text)]`}
      >
        <ThemeProvider>
          <AnimatedFavicon />
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
