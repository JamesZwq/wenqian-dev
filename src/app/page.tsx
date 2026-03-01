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
      <main className="relative min-h-screen bg-[#0a0a0b] text-[#e0ffe8] selection:bg-[#00ff88]/30 selection:text-[#0a0a0b]">
        <MouseReactiveBackground />

        {/* Theme toggle - pixel style */}
        <div className="fixed top-4 right-4 z-[100]">
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
