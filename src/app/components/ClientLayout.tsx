"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const Background = dynamic(() => import("../background/background"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-[var(--pixel-bg)]" />,
});

const ParticleField = dynamic(() => import("./ParticleField"), {
  ssr: false,
});

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      <Background />
      <ParticleField />
      {/* DEBUG: PageTransition removed temporarily to diagnose flicker bug.
          If this fixes the user's flicker on /sign-in, PageTransition (the
          site-wide motion.div fade-in wrapper) is the culprit. */}
      {children}
    </>
  );
}
