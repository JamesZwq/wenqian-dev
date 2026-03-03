"use client";

import React, { useState, useEffect } from "react";
import { motion, useTransform } from "framer-motion";
import { useMouse } from "./components/MouseProvider";
import DraggableFloat from "./components/DraggableFloat";
import { useIsMobile } from "./hooks/useIsMobile";

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
  "Large-Scale Graph Analysis | SIGMOD 2025 | SIGMOD 2026",
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
    <div className="font-[family-name:var(--font-jetbrains)] text-[var(--pixel-text)] text-sm md:text-base">
      {display}
      {!done && <span className="animate-blink inline-block w-2 h-4 ml-0.5 bg-[var(--pixel-accent)] align-middle" />}
      {done && isCommand && <br />}
      {done && isReady && (
        <span className="inline-block ml-2 text-[#ff6b35] font-bold animate-pulse">_</span>
      )}
    </div>
  );
}

export default function ParallaxHero() {
  const isMobile = useIsMobile();
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
      {/* Main terminal window - parallax + draggable card */}
      <motion.div
        style={{ x: isMobile ? 0 : windowX, y: isMobile ? 0 : windowY }}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: 0.1,
          duration: 0.5,
          ease: [0.22, 0.61, 0.36, 1],
        }}
        className="relative z-20 w-[95vw] max-w-3xl mx-3 sm:mx-4 will-change-transform"
      >
        <DraggableFloat className="w-full">
          {/* Terminal frame - ASCII style border */}
          <div
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] shadow-[0_0_30px_var(--pixel-glow)]"
          >
            {/* Title bar */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#27c93f]" />
              </div>
              <span className="font-[family-name:var(--font-press-start)] text-[8px] sm:text-[10px] text-[var(--pixel-accent)] ml-2 sm:ml-4 tracking-widest truncate">
                WENQIAN.ZHANG — BASH — 80x24
              </span>
            </div>

            {/* Terminal content */}
            <div className="p-4 sm:p-6 md:p-8 h-[340px] sm:h-[420px] md:h-[480px] font-[family-name:var(--font-jetbrains)]">
              {/* ASCII Art header */}
              <motion.pre
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-[var(--pixel-accent)] text-[6px] sm:text-[8px] md:text-[10px] leading-tight mb-4 sm:mb-6 overflow-x-auto whitespace-pre"
              >
                {ASCII_ART}
              </motion.pre>

              {/* Typewriter output */}
              <div className="space-y-1 font-[family-name:var(--font-jetbrains)] text-xs sm:text-sm md:text-base">
                {TYPED_LINES.slice(0, lineIndex).map((line, i) => (
                  <div key={i} className="text-[var(--pixel-accent)]">
                    {line.startsWith(">") ? (
                      <>
                        <span className="text-[var(--pixel-accent-2)]">{line}</span>
                        <br />
                      </>
                    ) : line === "READY" ? (
                      <span>
                        {line}
                        <span className="text-[var(--pixel-warn)] font-bold ml-1">_</span>
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
        </DraggableFloat>
      </motion.div>

      {/* CTA Buttons - Pixel style */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        // 轻微“弹簧”感的进场，而不是简单淡入
        transition={{
          delay: 0.4,
          type: "spring",
          stiffness: 420,
          damping: 26,
          mass: 0.7,
        }}
        className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-[90vw] sm:w-auto max-w-sm sm:max-w-none px-2"
      >
        <motion.a
          href="#publications"
          whileHover={{ scale: 1.04, boxShadow: "0 0 16px rgba(0,255,136,0.45)" }}
          whileTap={{ scale: 0.97 }}
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 border-2 border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)] text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] transition-colors touch-manipulation"
        >
          [ VIEW_PUBS ]
        </motion.a>
        <motion.a
          href="#"
          whileHover={{ scale: 1.04, boxShadow: "0 0 16px rgba(0,212,255,0.45)" }}
          whileTap={{ scale: 0.97 }}
          className="min-h-[44px] flex items-center justify-center px-5 py-3 sm:px-6 border-2 border-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)] text-[var(--pixel-accent-2)] font-[family-name:var(--font-press-start)] text-xs tracking-wider hover:bg-[color-mix(in_oklab,var(--pixel-accent-2)_20%,transparent)] transition-colors touch-manipulation"
        >
          [ DOWNLOAD_CV ]
        </motion.a>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        // Scroll 提示稍微比按钮晚一点，“浮”上来
        transition={{
          delay: 0.75,
          type: "spring",
          stiffness: 380,
          damping: 28,
          mass: 0.7,
        }}
        className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30"
      >
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-[color-mix(in_oklab,var(--pixel-accent)_60%,transparent)] font-[family-name:var(--font-press-start)] text-[9px] sm:text-[10px]"
        >
          [ SCROLL ]
        </motion.span>
      </motion.div>
    </section>
  );
}
