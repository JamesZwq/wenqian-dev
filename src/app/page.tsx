import ParallaxHero from "./ParallaxHero";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import ThemeToggle from "./components/ThemeToggle";
import MouseProvider from "./components/MouseProvider";
import MouseReactiveBackground from "./components/MouseReactiveBackground";
import PixelKeyboardHandler from "./components/PixelKeyboardHandler";

export default function Home() {
  return (
    <MouseProvider>
      <PixelKeyboardHandler />
      <main className="relative min-h-screen bg-[var(--pixel-bg)] text-[var(--pixel-text)] selection:bg-[color-mix(in_oklab,var(--pixel-accent)_30%,transparent)] selection:text-[var(--pixel-bg)]">
        <MouseReactiveBackground />

        {/* Theme toggle - pixel style */}
        <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[100]">
          <ThemeToggle />
        </div>

        <div className="relative z-10">
          <ParallaxHero />
          <ExtraSections />
          <ResumeSections />
        </div>
      </main>
    </MouseProvider>
  );
}
