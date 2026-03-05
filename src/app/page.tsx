"use client";

import dynamic from "next/dynamic";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import MouseProvider from "./components/MouseProvider";
import { ScrollLagProvider } from "./components/ScrollLagContext";
import { IsMobileProvider } from "./components/IsMobileContext";
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
              <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
                <PhysicsTerminal />

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

                {/* Scroll 提示 */}
                <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30">
                  <span className="animate-bounce text-[color-mix(in_oklab,var(--pixel-accent)_60%,transparent)] font-[family-name:var(--font-press-start)] text-[9px] sm:text-[10px]">
                    [ SCROLL ]
                  </span>
                </div>
              </section>

              <ExtraSections />
              <ResumeSections />
            </div>
          </main>
        </ScrollLagProvider>
      </IsMobileProvider>
    </MouseProvider>
  );
}

