import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sudoku",
  description:
    "Play Sudoku solo or race a friend via P2P — same puzzle, fastest solver wins!",
  openGraph: {
    title: "Sudoku | Wenqian Zhang",
    description:
      "Sudoku solo or P2P race — same puzzle, fastest wins. No signup, browser-to-browser.",
    images: [
      {
        url: "/api/og?title=Sudoku&subtitle=Solo%20or%20P2P%20race%20%E2%80%94%20same%20puzzle%2C%20fastest%20wins&tag=game",
        width: 1200,
        height: 630,
        alt: "Sudoku",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sudoku | Wenqian Zhang",
    description: "Sudoku solo or P2P race — same puzzle, fastest solver wins!",
    images: ["/api/og?title=Sudoku&subtitle=Solo%20or%20P2P%20race%20%E2%80%94%20same%20puzzle%2C%20fastest%20wins&tag=game"],
  },
};

export default function SudokuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
