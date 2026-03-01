"use client";

import React, { useRef, useCallback } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useMotionValue,
} from "framer-motion";
import { FileText, Download } from "lucide-react";

// ========== 3D Glassmorphism SVG Illustrations (Hand-coded, no external images) ==========

const GraphNetworkSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="graphGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="1" />
        <stop offset="50%" stopColor="#818CF8" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#C084FC" stopOpacity="1" />
      </linearGradient>
      <filter id="graphGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="graphShadow">
        <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#3B82F6" floodOpacity="0.4" />
      </filter>
    </defs>
    <g filter="url(#graphGlow)">
      {/* Edges - interconnected network */}
      <line x1="50" y1="60" x2="150" y2="60" stroke="url(#graphGrad1)" strokeWidth="2.5" opacity="0.7" />
      <line x1="50" y1="60" x2="100" y2="150" stroke="url(#graphGrad1)" strokeWidth="2.5" opacity="0.7" />
      <line x1="150" y1="60" x2="100" y2="150" stroke="url(#graphGrad1)" strokeWidth="2.5" opacity="0.7" />
      <line x1="100" y1="150" x2="180" y2="110" stroke="url(#graphGrad1)" strokeWidth="2" opacity="0.6" />
      <line x1="100" y1="150" x2="20" y2="110" stroke="url(#graphGrad1)" strokeWidth="2" opacity="0.6" />
      {/* Nodes with glow */}
      <circle cx="50" cy="60" r="14" fill="url(#graphGrad1)" filter="url(#graphShadow)" />
      <circle cx="150" cy="60" r="14" fill="url(#graphGrad1)" filter="url(#graphShadow)" />
      <circle cx="100" cy="150" r="18" fill="url(#graphGrad1)" filter="url(#graphShadow)" />
      <circle cx="180" cy="110" r="10" fill="url(#graphGrad1)" filter="url(#graphShadow)" />
      <circle cx="20" cy="110" r="10" fill="url(#graphGrad1)" filter="url(#graphShadow)" />
    </g>
  </svg>
);

const ClusterSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="clusterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <filter id="clusterShadow">
        <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#059669" floodOpacity="0.5" />
      </filter>
    </defs>
    <g transform="translate(40, 30)">
      {/* Stacked server nodes - K8s/Spark style */}
      <rect x="10" y="0" width="100" height="28" rx="6" fill="url(#clusterGrad)" opacity="0.95" filter="url(#clusterShadow)" />
      <circle cx="25" cy="14" r="4" fill="#fff" opacity="0.9" />
      <rect x="15" y="35" width="90" height="28" rx="6" fill="url(#clusterGrad)" opacity="0.75" filter="url(#clusterShadow)" />
      <circle cx="30" cy="49" r="4" fill="#fff" opacity="0.9" />
      <rect x="20" y="70" width="80" height="28" rx="6" fill="url(#clusterGrad)" opacity="0.55" filter="url(#clusterShadow)" />
      <circle cx="35" cy="84" r="4" fill="#fff" opacity="0.9" />
      {/* Connection lines */}
      <line x1="60" y1="28" x2="60" y2="35" stroke="#fff" strokeWidth="1" opacity="0.5" />
      <line x1="60" y1="63" x2="60" y2="70" stroke="#fff" strokeWidth="1" opacity="0.5" />
    </g>
  </svg>
);

const CodeGearSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="rustGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F87171" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
      <filter id="gearShadow">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#EA580C" floodOpacity="0.5" />
      </filter>
    </defs>
    <g transform="translate(100, 100)">
      {/* Gear - C++/Rust performance symbol */}
      <g filter="url(#gearShadow)" className="animate-[spin_12s_linear_infinite]">
        <path
          d="M0,-45 L8,-38 L12,-45 L20,-42 L18,-32 L28,-28 L25,-18 L35,-10 L28,-2 L35,10 L25,18 L28,28 L18,32 L20,42 L12,45 L8,38 L0,45 L-8,38 L-12,45 L-20,42 L-18,32 L-28,28 L-25,18 L-35,10 L-28,2 L-35,-10 L-25,-18 L-28,-28 L-18,-32 L-20,-42 L-12,-45 L-8,-38 Z"
          fill="none"
          stroke="url(#rustGrad)"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <circle r="18" fill="url(#rustGrad)" opacity="0.6" />
      </g>
      {/* Code block accent */}
      <text x="-22" y="8" fill="white" fontSize="20" fontWeight="bold" fontFamily="ui-monospace, monospace">
        {"<>"}
      </text>
    </g>
  </svg>
);

const AwardSVG = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <filter id="medalShadow">
        <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#FBBF24" floodOpacity="0.6" />
      </filter>
    </defs>
    <g transform="translate(100, 90)">
      {/* Medal body - SIGMOD/ICDM style */}
      <circle r="42" fill="url(#goldGrad)" filter="url(#medalShadow)" />
      <circle r="36" fill="url(#blueGrad)" opacity="0.9" />
      <text x="-28" y="8" fill="white" fontSize="18" fontWeight="bold" fontFamily="system-ui">
        SIGMOD
      </text>
      {/* Ribbon */}
      <path d="M-25 42 L-15 95 L0 75 L15 95 L25 42" fill="url(#goldGrad)" opacity="0.9" />
      <path d="M-20 42 L0 70 L20 42" fill="none" stroke="#D97706" strokeWidth="2" opacity="0.5" />
    </g>
  </svg>
);

// ========== Main Parallax Hero Component ==========

export default function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 28, stiffness: 180 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set((clientX / innerWidth) * 2 - 1);
    mouseY.set((clientY / innerHeight) * 2 - 1);
  }, [mouseX, mouseY]);

  // Layer 1: Far background - orbs & grid (reverse micro movement)
  const bgX = useTransform(x, [-1, 1], [15, -15]);
  const bgY = useTransform(y, [-1, 1], [15, -15]);

  // Layer 2: Distributed cluster silhouette
  const silX = useTransform(x, [-1, 1], [35, -35]);
  const silY = useTransform(y, [-1, 1], [10, -10]);

  // Layer 3: Abstract graph (rotate + subtle move)
  const graphRotate = useTransform(x, [-1, 1], [-6, 6]);
  const graphX = useTransform(x, [-1, 1], [-25, 25]);

  // Layer 4: 4 floating cards - fast inverse parallax (different intensities)
  const card1X = useTransform(x, [-1, 1], [-70, 70]);
  const card1Y = useTransform(y, [-1, 1], [-70, 70]);
  const card2X = useTransform(x, [-1, 1], [55, -55]);
  const card2Y = useTransform(y, [-1, 1], [60, -60]);
  const card3X = useTransform(x, [-1, 1], [-65, 65]);
  const card3Y = useTransform(y, [-1, 1], [45, -45]);
  const card4X = useTransform(x, [-1, 1], [50, -50]);
  const card4Y = useTransform(y, [-1, 1], [-55, 55]);

  return (
    <section
      ref={ref}
      onMouseMove={handleMouseMove}
      className="relative h-screen w-full overflow-hidden flex items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, #fafafa 0%, #f4f4f5 50%, #e4e4e7 100%)",
      }}
    >
      {/* Dark mode background */}
      <div
        className="absolute inset-0 dark:block hidden"
        style={{
          background:
            "linear-gradient(160deg, #050505 0%, #0a0a0f 40%, #0f0f1a 100%)",
        }}
      />

      {/* Layer 1: Ambient orbs + grid (extreme far) */}
      <motion.div
        style={{ x: bgX, y: bgY }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <div className="absolute top-[-15%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-blue-400/25 dark:bg-cyan-500/20 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[55vw] h-[55vw] rounded-full bg-purple-500/25 dark:bg-violet-600/20 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-cyan-400/15 dark:bg-blue-500/10 blur-[100px]" />
        {/* Grid lines - subtle */}
        <div
          className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #94a3b8 1px, transparent 1px),
              linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />
      </motion.div>

      {/* Layer 2: Distributed server cluster silhouette */}
      <motion.div
        style={{ x: silX, y: silY }}
        className="absolute bottom-0 left-0 right-0 h-[40%] z-10 pointer-events-none opacity-[0.12] dark:opacity-[0.18]"
      >
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
          <defs>
            <linearGradient id="silGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Server rack silhouettes */}
          <rect x="50" y="120" width="80" height="100" rx="4" fill="url(#silGrad)" />
          <rect x="60" y="130" width="20" height="15" rx="2" fill="#64748b" opacity="0.4" />
          <rect x="60" y="155" width="20" height="15" rx="2" fill="#64748b" opacity="0.4" />
          <rect x="200" y="100" width="80" height="120" rx="4" fill="url(#silGrad)" />
          <rect x="210" y="110" width="20" height="15" rx="2" fill="#64748b" opacity="0.4" />
          <rect x="350" y="130" width="80" height="90" rx="4" fill="url(#silGrad)" />
          <rect x="500" y="110" width="80" height="110" rx="4" fill="url(#silGrad)" />
          <rect x="650" y="125" width="80" height="95" rx="4" fill="url(#silGrad)" />
          <rect x="800" y="105" width="80" height="115" rx="4" fill="url(#silGrad)" />
          <rect x="950" y="120" width="80" height="100" rx="4" fill="url(#silGrad)" />
        </svg>
      </motion.div>

      {/* Layer 3: Abstract graph network + code symbols (midground, slow rotate) */}
      <motion.div
        style={{ rotate: graphRotate, x: graphX }}
        className="absolute z-20 w-[900px] h-[900px] pointer-events-none opacity-[0.06] dark:opacity-[0.12]"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full animate-[spin_90s_linear_infinite]">
          <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="6 6" />
          <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="0.6" fill="none" />
          <line x1="100" y1="30" x2="100" y2="170" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          <line x1="30" y1="100" x2="170" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          <line x1="50" y1="50" x2="150" y2="150" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
          <line x1="150" y1="50" x2="50" y2="150" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
          <circle cx="100" cy="100" r="6" fill="currentColor" opacity="0.5" />
          <circle cx="100" cy="40" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="160" cy="100" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="100" cy="160" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="40" cy="100" r="4" fill="currentColor" opacity="0.4" />
        </svg>
        {/* Code symbols overlay */}
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-mono text-6xl opacity-30 select-none">
          {"{ }"}
        </div>
      </motion.div>

      {/* Layer 4: 4 Floating 3D Glass Cards - fast inverse parallax */}
      <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
        <motion.div
          style={{ x: card1X, y: card1Y }}
          className="absolute top-[18%] left-[12%] w-28 h-28 md:w-44 md:h-44"
        >
          <div className="w-full h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl flex items-center justify-center p-4 transform rotate-[-8deg]">
            <GraphNetworkSVG />
          </div>
        </motion.div>

        <motion.div
          style={{ x: card2X, y: card2Y }}
          className="absolute bottom-[18%] right-[8%] w-24 h-24 md:w-36 md:h-36"
        >
          <div className="w-full h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl flex items-center justify-center p-3 transform rotate-[10deg]">
            <ClusterSVG />
          </div>
        </motion.div>

        <motion.div
          style={{ x: card3X, y: card3Y }}
          className="absolute top-[22%] right-[15%] w-20 h-20 md:w-28 md:h-28"
        >
          <div className="w-full h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl flex items-center justify-center p-3 transform rotate-[5deg]">
            <CodeGearSVG />
          </div>
        </motion.div>

        <motion.div
          style={{ x: card4X, y: card4Y }}
          className="absolute bottom-[28%] left-[18%] w-[72px] h-[72px] md:w-24 md:h-24"
        >
          <div className="w-full h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl flex items-center justify-center p-2 transform rotate-[-12deg]">
            <AwardSVG />
          </div>
        </motion.div>
      </div>

      {/* Layer 5: Main content - minimal mouse influence */}
      <div className="relative z-40 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Shimmer gradient title - 流光渐变文字效果 */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-4">
            <span
              className="dark:hidden inline-block bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_4s_ease-in-out_infinite]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #0f172a 0%, #3b82f6 25%, #8b5cf6 50%, #06b6d4 75%, #0f172a 100%)",
              }}
            >
              Hi, I&apos;m Wenqian Zhang
            </span>
            <span
              className="hidden dark:inline-block bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_4s_ease-in-out_infinite]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #f8fafc 0%, #38bdf8 25%, #a78bfa 50%, #22d3ee 75%, #f8fafc 100%)",
              }}
            >
              Hi, I&apos;m Wenqian Zhang
            </span>
          </h1>

          <p className="text-lg md:text-xl lg:text-2xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 font-medium">
            Ph.D. Candidate @ UNSW | Accelerating Large-Scale Graph Computations
          </p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <motion.a
              href="#publications"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="group relative px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full font-semibold text-lg overflow-hidden transition-shadow hover:shadow-[0_0_50px_-5px_rgba(59,130,246,0.5)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                View Publications <FileText size={18} />
              </span>
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 text-zinc-900 dark:text-white rounded-full font-semibold text-lg transition-all hover:bg-white/60 dark:hover:bg-slate-800/60 flex items-center gap-2"
            >
              Download Resume <Download size={18} />
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
