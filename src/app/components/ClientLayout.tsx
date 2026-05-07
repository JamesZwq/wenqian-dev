"use client";

import dynamic from "next/dynamic";
import PageTransition from "./PageTransition";
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
      {/* relative + z-10 ensures the page content sits above the fixed
          Background (z-0) and ParticleField canvas (z-3). PageTransition's
          motion.div used to provide this implicitly via its transform-induced
          stacking context, but explicit z-index here is what makes content
          visible regardless of whether motion is present. */}
      <div className="relative z-10">
        <PageTransition>{children}</PageTransition>
      </div>
    </>
  );
}
