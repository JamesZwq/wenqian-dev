import ParallaxHero from "./ParallaxHero";
import ResumeSections from "./ResumeSections";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-zinc-100 selection:bg-blue-500/30">
      <ParallaxHero />
      <ResumeSections />
    </main>
  );
}
