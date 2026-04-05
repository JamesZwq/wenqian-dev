import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Halli Galli — wenqian.me",
  description: "Play Halli Galli online with a friend via P2P. Ring the bell when any fruit totals exactly 5!",
};

export default function HalliGalliLayout({ children }: { children: React.ReactNode }) {
  return children;
}
