"use client";

import dynamic from "next/dynamic";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import MouseProvider from "./components/MouseProvider";
import { ScrollLagProvider } from "./components/ScrollLagContext";
import { IsMobileProvider, useIsMobileContext } from "./components/IsMobileContext";
import PixelKeyboardHandler from "./components/PixelKeyboardHandler";
import PetJailToggle from "./components/PetJailToggle";
import BackgroundModeToggle from "./components/BackgroundModeToggle";
import ThemeToggle from "./components/ThemeToggle";
import FpsCounter from "./components/FpsCounter";

const Background = dynamic(() => import("./background/background"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-[var(--pixel-bg)]" />,
});

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
      {/* 手机端：终端居中于“按钮之上”的区域，底部预留按钮高度，不顶到最上 */}
      <div className={`flex-1 flex justify-center min-h-0 ${isMobile ? "flex items-center" : "flex items-center"}`}>
        <PhysicsTerminal />
      </div>
      {/* 手机端预留底部空间给按钮（bottom-14 ≈ 3.5rem，按钮块约 7rem），终端自然在按钮之上 */}
      {isMobile && <div className="h-28 flex-shrink-0" aria-hidden />}

      {/* CTA Buttons - 保留原来的像素按钮风格 */}
      <div className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-[90vw] sm:w-auto max-w-sm sm:max-w-none px-2">
        <a
          href="#publications"
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 border-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)] text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] transition-colors touch-manipulation"
        >
          [ VIEW_PUBS ]
        </a>
        <a
          href="#"
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 border-2 border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] text-[var(--pixel-accent-2)] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[color-mix(in_oklab,var(--pixel-accent-2)_20%,transparent)] transition-colors touch-manipulation"
        >
          [ DOWNLOAD_CV ]
        </a>
      </div>

      {/* Scroll 提示 - 手机端不显示 */}
      {!isMobile && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30">
          <span className="animate-bounce text-[color-mix(in_oklab,var(--pixel-accent)_60%,transparent)] font-[family-name:var(--font-press-start)] text-[9px] sm:text-[10px]">
            [ SCROLL ]
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
          {/* <PixelKeyboardHandler /> */}
          <main className="relative min-h-screen bg-[var(--pixel-bg)] text-[var(--pixel-text)] selection:bg-[color-mix(in_oklab,var(--pixel-accent)_30%,transparent)] selection:text-[var(--pixel-bg)]">
            <Background />
            <CursorPet />
            <PetJailToggle />
            <BackgroundModeToggle />
            <ThemeToggle />
            <FpsCounter />

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

