import ParallaxHero from "./ParallaxHero";
import ResumeSections from "./ResumeSections";
import ExtraSections from "./ExtraSections";
import MouseProvider from "./components/MouseProvider";
import PixelKeyboardHandler from "./components/PixelKeyboardHandler";
import Background from "./background/background";
import CursorPet from "./components/CursorPet";
import PetJailToggle from "./components/PetJailToggle";
import BackgroundModeToggle from "./components/BackgroundModeToggle";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <MouseProvider>
      <PixelKeyboardHandler />
      <main className="relative min-h-screen bg-[var(--pixel-bg)] text-[var(--pixel-text)] selection:bg-[color-mix(in_oklab,var(--pixel-accent)_30%,transparent)] selection:text-[var(--pixel-bg)]">
        <Background />
        <CursorPet />
        <PetJailToggle />
        <BackgroundModeToggle />
        <ThemeToggle />

        <div className="relative z-10">
          <ParallaxHero />
          <ExtraSections />
          <ResumeSections />
        </div>
      </main>
    </MouseProvider>
  );
}
