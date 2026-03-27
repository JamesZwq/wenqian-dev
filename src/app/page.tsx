"use client";

import dynamic from "next/dynamic";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import MouseProvider from "./components/MouseProvider";
import { ScrollLagProvider } from "./components/ScrollLagContext";
import { IsMobileProvider, useIsMobileContext } from "./components/IsMobileContext";
import PetJailToggle from "./components/PetJailToggle";
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
      <div className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-[90vw] sm:w-auto max-w-sm sm:max-w-none px-2">
        <a
          href="#publications"
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 rounded-xl border border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)] text-[var(--pixel-accent)] font-sans text-sm font-semibold tracking-tight hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] hover:shadow-lg transition-all touch-manipulation"
        >
          View Publications
        </a>
        <a
          href="#"
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 rounded-xl border border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] text-[var(--pixel-accent-2)] font-sans text-sm font-semibold tracking-tight hover:bg-[color-mix(in_oklab,var(--pixel-accent-2)_20%,transparent)] hover:shadow-lg transition-all touch-manipulation"
        >
          Download CV
        </a>
        <a
          href="/papers"
          className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 sm:px-6 rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 font-sans text-sm font-semibold tracking-tight hover:bg-emerald-400/20 hover:shadow-lg transition-all touch-manipulation"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Paper Manager
        </a>
      </div>

      {/* Scroll 提示 - 手机端不显示 */}
      {!isMobile && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <span className="animate-bounce text-[color-mix(in_oklab,var(--pixel-accent)_60%,transparent)] font-sans text-sm font-semibold tracking-tight">
            Scroll
          </span>
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
            <PetJailToggle />
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
