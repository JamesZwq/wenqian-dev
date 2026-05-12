"use client";

import dynamic from "next/dynamic";
import PageTransition from "./PageTransition";
import { CSSProperties, ReactNode, useEffect, useState } from "react";
import { LIGHT_VISUAL_EFFECTS_QUERY } from "./IsMobileContext";

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

const STATIC_BACKGROUND_STYLE: CSSProperties = {
  backgroundColor: "var(--pixel-bg)",
  background:
    "radial-gradient(circle at 18% 12%, color-mix(in oklab, var(--pixel-accent) 16%, transparent), transparent 32rem), radial-gradient(circle at 82% 18%, color-mix(in oklab, var(--pixel-accent-2) 13%, transparent), transparent 30rem), linear-gradient(135deg, var(--pixel-bg), var(--pixel-bg-alt))",
};

function useLightVisualEffects() {
  const [lightVisuals, setLightVisuals] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(LIGHT_VISUAL_EFFECTS_QUERY);
    const update = () => setLightVisuals(mq.matches);

    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return lightVisuals;
}

function StaticBackground() {
  return (
    <div
      className="fixed inset-0 z-0"
      style={STATIC_BACKGROUND_STYLE}
      aria-hidden="true"
    />
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const lightVisuals = useLightVisualEffects();

  return (
    <>
      {lightVisuals ? (
        <StaticBackground />
      ) : (
        <>
          <Background />
          <ParticleField />
        </>
      )}
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
