"use client";

import dynamic from "next/dynamic";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import MouseProvider from "./components/MouseProvider";
import { ScrollLagProvider } from "./components/ScrollLagContext";
import { IsMobileProvider, useIsMobileContext } from "./components/IsMobileContext";
import PetBedToggle from "./components/PetBedToggle";
import BackgroundModeToggle from "./components/BackgroundModeToggle";
import ThemeToggle from "./components/ThemeToggle";
import FpsCounter from "./components/FpsCounter";
import FloatingNav from "./components/FloatingNav";

const PhysicsTerminal = dynamic(
  () => import("./components/PhysicsTerminal"),
  { ssr: false }
);

const CursorPet = dynamic(
  () => import("./components/CursorPet"),
  { ssr: false }
);

function HeroSection() {
  const isMobile = useIsMobileContext();
  return (
    <section className={`relative min-h-screen w-full overflow-hidden flex flex-col ${isMobile ? "" : "justify-center"}`}>
      {/* 手机端：终端居中于"按钮之上"的区域，底部预留按钮高度，不顶到最上 */}
      <div className={`flex-1 flex justify-center min-h-0 ${isMobile ? "flex items-center" : "flex items-center"}`}>
        <PhysicsTerminal />
      </div>
      {/* 手机端预留底部空间给按钮（bottom-14 ≈ 3.5rem，按钮块约 7rem），终端自然在按钮之上 */}
      {isMobile && <div className="h-28 flex-shrink-0" aria-hidden />}

      {/* CTA Buttons */}
      <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row flex-wrap justify-center gap-2.5 w-[90vw] sm:w-auto max-w-sm sm:max-w-none px-2">
        <a
          href="#publications"
          className="group min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 rounded-xl border border-[var(--pixel-accent)]/40 bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)] text-[var(--pixel-accent)] font-sans text-sm font-semibold tracking-tight hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] hover:shadow-lg hover:shadow-[var(--pixel-glow)] transition-all touch-manipulation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100 transition-opacity"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Publications
        </a>
        <a
          href="/cv.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="group min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 rounded-xl border border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] text-[var(--pixel-accent-2)] font-sans text-sm font-semibold tracking-tight hover:bg-[color-mix(in_oklab,var(--pixel-accent-2)_20%,transparent)] hover:shadow-lg hover:shadow-[color-mix(in_oklab,var(--pixel-accent-2)_20%,transparent)] transition-all touch-manipulation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100 transition-opacity"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download CV
        </a>
      </div>

      {/* Scroll 提示 - 手机端不显示 */}
      {!isMobile && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 animate-bounce">
          <span className="text-[color-mix(in_oklab,var(--pixel-accent)_50%,transparent)] font-mono text-[10px] tracking-[0.2em] uppercase">
            scroll
          </span>
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="text-[var(--pixel-accent)] opacity-50">
            <path d="M8 0 L8 16 M2 10 L8 16 L14 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  return (
    <MouseProvider>
      <IsMobileProvider>
        <ScrollLagProvider>
          <main className="relative min-h-screen selection:bg-[color-mix(in_oklab,var(--pixel-accent)_30%,transparent)] selection:text-[var(--pixel-bg)]">
            <CursorPet />
            <PetBedToggle />
            <BackgroundModeToggle />
            <ThemeToggle />
            <FpsCounter />
            <FloatingNav />

            <div className="relative z-10">
              <HeroSection />
              <ExtraSections />
              <ResumeSections />
            </div>
          </main>
        </ScrollLagProvider>
      </IsMobileProvider>
    </MouseProvider>
  );
}
