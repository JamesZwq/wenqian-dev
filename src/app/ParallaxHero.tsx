"use client";

import React, { useState, useEffect } from "react";
import { motion, useTransform } from "framer-motion";
import { useMouse } from "./components/MouseProvider";

const ASCII_ART = `
  ██╗    ██╗███████╗███╗   ██╗ ██████╗ ██╗ █████╗ ███╗   ██╗
  ██║    ██║██╔════╝████╗  ██║██╔═══██╗██║██╔══██╗████╗  ██║
  ██║ █╗ ██║█████╗  ██╔██╗ ██║██║   ██║██║███████║██╔██╗ ██║
  ██║███╗██║██╔══╝  ██║╚██╗██║██║   ██║██║██╔══██║██║╚██╗██║
  ╚███╔███╔╝███████╗██║ ╚████║╚██████╔╝██║██║  ██║██║ ╚████║
   ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
`;

const TYPED_LINES = [
  "> whoami",
  "Wenqian Zhang",
  "",
  "> role",
  "Ph.D. Candidate @ UNSW",
  "",
  "> research",
  "Large-Scale Graph Analysis | SIGMOD 2025",
  "",
  "> status",
  "READY",
];

function TypewriterLine({ text, delay = 0, onComplete }: { text: string; delay?: number; onComplete?: () => void }) {
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setDone(true);
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        i++;
        setDisplay(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(id);
          setDone(true);
          onComplete?.();
        }
      }, 35);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay, onComplete]);

  const isCommand = text.startsWith(">");
  const isReady = text === "READY";

  return (
    <div className="font-[family-name:var(--font-jetbrains)] text-[#00ff88] text-sm md:text-base">
      {display}
      {!done && <span className="animate-blink inline-block w-2 h-4 ml-0.5 bg-[#00ff88] align-middle" />}
      {done && isCommand && <br />}
      {done && isReady && (
        <span className="inline-block ml-2 text-[#ff6b35] font-bold animate-pulse">_</span>
      )}
    </div>
  );
}

export default function ParallaxHero() {
  const { smoothX, smoothY } = useMouse();
  const [lineIndex, setLineIndex] = useState(0);
  const [glitch, setGlitch] = useState(false);

  const bgX = useTransform(smoothX, [-1, 1], [15, -15]);
  const bgY = useTransform(smoothY, [-1, 1], [15, -15]);
  const windowX = useTransform(smoothX, [-1, 1], [-8, 8]);
  const windowY = useTransform(smoothY, [-1, 1], [-8, 8]);

  const handleLineComplete = () => {
    if (lineIndex < TYPED_LINES.length - 1) {
      setTimeout(() => setLineIndex((i) => i + 1), lineIndex === 0 ? 200 : 80);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setGlitch((g) => !g), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Pixel grid background - mouse reactive */}
      <motion.div
        style={{
          x: bgX,
          y: bgY,
          backgroundImage: "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        className="absolute inset-0 opacity-[0.03]"
      />
      <motion.div
        style={{
          x: bgX,
          y: bgY,
          backgroundImage: "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        className="absolute inset-0 opacity-[0.02]"
      />

      {/* Main terminal window */}
      <motion.div
        style={{ x: windowX, y: windowY }}
        className="relative z-20 w-[95vw] max-w-3xl mx-4"
      >
        {/* Terminal frame - ASCII style border */}
        <div
          className="border-2 border-[#00ff88] bg-[#0a0a0b]/95 shadow-[0_0_30px_rgba(0,255,136,0.2)]"
          style={{
            boxShadow: "0 0 0 1px #00ff88, 0 0 30px rgba(0,255,136,0.15)",
          }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-[#00ff88] bg-[#121214]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-sm bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-sm bg-[#27c93f]" />
            </div>
            <span className="font-[family-name:var(--font-press-start)] text-[10px] text-[#00ff88] ml-4 tracking-widest">
              WENQIAN.ZHANG — BASH — 80x24
            </span>
          </div>

          {/* Terminal content */}
          <div className="p-6 md:p-8 min-h-[400px] font-[family-name:var(--font-jetbrains)]">
            {/* ASCII Art header */}
            <motion.pre
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-[#00ff88] text-[8px] md:text-[10px] leading-tight mb-6 overflow-x-auto whitespace-pre"
            >
              {ASCII_ART}
            </motion.pre>

            {/* Typewriter output */}
            <div className="space-y-1 font-[family-name:var(--font-jetbrains)] text-sm md:text-base">
              {TYPED_LINES.slice(0, lineIndex).map((line, i) => (
                <div key={i} className="text-[#00ff88]">
                  {line.startsWith(">") ? (
                    <>
                      <span className="text-[#00d4ff]">{line}</span>
                      <br />
                    </>
                  ) : line === "READY" ? (
                    <span>
                      {line}
                      <span className="text-[#ff6b35] font-bold ml-1">_</span>
                    </span>
                  ) : (
                    line || <br />
                  )}
                </div>
              ))}
              {lineIndex < TYPED_LINES.length && (
                <TypewriterLine
                  key={lineIndex}
                  text={TYPED_LINES[lineIndex]}
                  delay={0}
                  onComplete={handleLineComplete}
                />
              )}
            </div>
          </div>
        </div>

        {/* Glitch overlay on hover */}
        {glitch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none mix-blend-difference"
            style={{
              background: "linear-gradient(90deg, transparent 48%, #ff00ff 50%, transparent 52%)",
              opacity: 0.03,
            }}
          />
        )}
      </motion.div>

      {/* CTA Buttons - Pixel style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 4, duration: 0.5 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-wrap justify-center gap-4"
      >
        <motion.a
          href="#publications"
          whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0,255,136,0.5)" }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 border-2 border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[#00ff88]/20 transition-colors"
        >
          [ VIEW_PUBS ]
        </motion.a>
        <motion.a
          href="#"
          whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0,212,255,0.5)" }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 border-2 border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[#00d4ff]/20 transition-colors"
        >
          [ DOWNLOAD_CV ]
        </motion.a>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30"
      >
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-[#00ff88]/60 font-[family-name:var(--font-press-start)] text-[10px]"
        >
          [ SCROLL ]
        </motion.span>
      </motion.div>
    </section>
  );
}
