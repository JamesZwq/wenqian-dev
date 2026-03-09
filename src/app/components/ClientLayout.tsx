"use client";

import dynamic from "next/dynamic";
import PageTransition from "./PageTransition";
import { ReactNode } from "react";

const Background = dynamic(() => import("../background/background"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-[var(--pixel-bg)]" />,
});

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      <Background />
      <PageTransition>{children}</PageTransition>
    </>
  );
}
