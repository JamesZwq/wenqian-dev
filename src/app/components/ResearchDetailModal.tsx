"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// ========== Animated Models ==========

const KCoreModel = () => (
  <div className="w-full aspect-square max-w-[320px] mx-auto">
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <defs>
        <linearGradient id="kcoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <filter id="kcoreGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* k-core boundary - "peeling" visualization */}
      <motion.circle
        cx="100"
        cy="100"
        r="75"
        fill="none"
        stroke="url(#kcoreGrad)"
        strokeWidth="2"
        strokeDasharray="8 4"
        opacity="0.4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.4 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      {/* Edges - flowing animation */}
      <g>
        <motion.path
          d="M100 50 L70 100"
          fill="none"
          stroke="url(#kcoreGrad)"
          strokeWidth="2"
          opacity="0.7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d="M100 50 L130 100"
          fill="none"
          stroke="url(#kcoreGrad)"
          strokeWidth="2"
          opacity="0.7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        />
        <motion.path
          d="M70 100 L100 150"
          fill="none"
          stroke="url(#kcoreGrad)"
          strokeWidth="2"
          opacity="0.7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
        <motion.path
          d="M130 100 L100 150"
          fill="none"
          stroke="url(#kcoreGrad)"
          strokeWidth="2"
          opacity="0.7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        <motion.path
          d="M70 100 L130 100"
          fill="none"
          stroke="url(#kcoreGrad)"
          strokeWidth="2"
          opacity="0.7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
      </g>
      {/* Nodes - each has degree ≥ 2 (k=2 core) */}
      <circle cx="100" cy="50" r="12" fill="url(#kcoreGrad)" filter="url(#kcoreGlow)" className="animate-[float_2s_ease-in-out_infinite]" />
      <circle cx="70" cy="100" r="12" fill="url(#kcoreGrad)" filter="url(#kcoreGlow)" className="animate-[float_2s_ease-in-out_infinite]" style={{ animationDelay: "0.2s" }} />
      <circle cx="130" cy="100" r="12" fill="url(#kcoreGrad)" filter="url(#kcoreGlow)" className="animate-[float_2s_ease-in-out_infinite]" style={{ animationDelay: "0.4s" }} />
      <circle cx="100" cy="150" r="12" fill="url(#kcoreGrad)" filter="url(#kcoreGlow)" className="animate-[float_2s_ease-in-out_infinite]" style={{ animationDelay: "0.6s" }} />
      {/* Label */}
      <text x="100" y="185" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">k=2 core: all nodes have ≥2 neighbors</text>
    </svg>
  </div>
);

const HypergraphModel = () => (
  <div className="w-full aspect-square max-w-[320px] mx-auto">
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <defs>
        <linearGradient id="hyperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <filter id="hyperGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Hyperedge region - connects 3+ nodes (vs graph edge = 2) */}
      <motion.ellipse
        cx="100"
        cy="100"
        rx="55"
        ry="45"
        fill="url(#hyperGrad)"
        fillOpacity="0.15"
        stroke="url(#hyperGrad)"
        strokeWidth="2"
        strokeDasharray="6 4"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, type: "spring", stiffness: 100 }}
        className="animate-[spin_30s_linear_infinite]"
        style={{ animationDirection: "reverse" }}
      />
      {/* Nodes - hyperedge connects ALL of these */}
      {[
        { cx: 80, cy: 70, delay: 0 },
        { cx: 120, cy: 70, delay: 0.1 },
        { cx: 100, cy: 130, delay: 0.2 },
        { cx: 60, cy: 120, delay: 0.3 },
        { cx: 140, cy: 120, delay: 0.4 },
      ].map((n, i) => (
        <motion.circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r={i < 3 ? 10 : 8}
          fill="url(#hyperGrad)"
          filter="url(#hyperGlow)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + n.delay, type: "spring", stiffness: 200 }}
          className="animate-[float_2s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      {/* Radial lines to hyperedge center */}
      <line x1="80" y1="70" x2="100" y2="100" stroke="url(#hyperGrad)" strokeWidth="1" opacity="0.4" />
      <line x1="120" y1="70" x2="100" y2="100" stroke="url(#hyperGrad)" strokeWidth="1" opacity="0.4" />
      <line x1="100" y1="130" x2="100" y2="100" stroke="url(#hyperGrad)" strokeWidth="1" opacity="0.4" />
      <text x="100" y="185" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">Hyperedge: 1 edge connects 5 nodes</text>
    </svg>
  </div>
);

const DistributedModel = () => (
  <div className="w-full aspect-square max-w-[320px] mx-auto">
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <defs>
        <linearGradient id="distGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        <filter id="distGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Communication lines - data flow */}
      {[
        { cx: 50, cy: 50 },
        { cx: 150, cy: 50 },
        { cx: 50, cy: 150 },
        { cx: 150, cy: 150 },
      ].map((pos, i) => (
        <g key={i}>
          <motion.path
            d={`M 100 100 L ${pos.cx} ${pos.cy}`}
            fill="none"
            stroke="url(#distGrad)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            className="animate-[dash_2s_linear_infinite]"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        </g>
      ))}
      {/* Central coordinator - Master */}
      <motion.circle
        cx="100"
        cy="100"
        r="22"
        fill="url(#distGrad)"
        filter="url(#distGlow)"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <text x="100" y="105" textAnchor="middle" className="text-[8px] fill-white font-bold">M</text>
      {/* Worker nodes */}
      {[
        { cx: 50, cy: 50 },
        { cx: 150, cy: 50 },
        { cx: 50, cy: 150 },
        { cx: 150, cy: 150 },
      ].map((pos, i) => (
        <g key={i}>
          <motion.rect
            x={pos.cx - 18}
            y={pos.cy - 12}
            width="36"
            height="24"
            rx="5"
            fill="url(#distGrad)"
            opacity="0.85"
            filter="url(#distGlow)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 200 }}
          />
          <circle cx={pos.cx - 6} cy={pos.cy - 4} r="3" fill="white" opacity="0.9" />
        </g>
      ))}
      <text x="100" y="188" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">Master → Workers (Spark/Flink)</text>
    </svg>
  </div>
);

// ========== Modal Content Types ==========

const researchContent = {
  "Core Decomposition": {
    model: <KCoreModel />,
    title: "What is K-Core?",
    description:
      "The k-core of a graph is the largest subgraph where every node has at least k neighbors. It's found by iteratively removing nodes with degree < k until no more can be removed.",
    bullets: [
      "Used in social network analysis (influence, cohesion)",
      "Foundation for nucleus decomposition (dense subgraph discovery)",
      "Challenging at billion-scale: memory & I/O bottlenecks",
    ],
    formula: "deg(v) ≥ k, ∀v ∈ k-core",
  },
  "Hypergraph Analytics": {
    model: <HypergraphModel />,
    title: "What is a Hypergraph?",
    description:
      "A hypergraph generalizes graphs: each hyperedge can connect any number of nodes (not just 2). Perfect for modeling many-to-many relationships.",
    bullets: [
      "Graph: edge connects 2 nodes (e.g., friendship)",
      "Hypergraph: hyperedge connects 3+ nodes (e.g., co-authorship, group membership)",
      "Core decomposition on hypergraphs is NP-hard; we design efficient approximations",
    ],
    formula: "H = (V, E) where e ∈ E, |e| ≥ 2",
  },
  "Distributed Systems": {
    model: <DistributedModel />,
    title: "Distributed Graph Computation",
    description:
      "Graph algorithms run across multiple machines. A coordinator partitions the graph; workers compute in parallel; results are aggregated.",
    bullets: [
      "Apache Spark / Flink for data-parallel execution",
      "Kubernetes for orchestration & auto-scaling",
      "Key challenges: load balancing, communication cost, fault tolerance",
    ],
    formula: "Partition → Compute → Aggregate",
  },
};

// ========== Main Modal Component ==========

export default function ResearchDetailModal({
  isOpen,
  onClose,
  topic,
}: {
  isOpen: boolean;
  onClose: () => void;
  topic: keyof typeof researchContent | null;
}) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const content = topic ? researchContent[topic] : null;

  return (
    <AnimatePresence>
      {isOpen && content && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/70"
          />

          {/* Slide Panel - Pixel style */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg z-[201] bg-[var(--pixel-bg)] border-l-2 border-[var(--pixel-border)] overflow-y-auto"
            style={{ boxShadow: "-10px 0 40px rgba(0,255,136,0.1)" }}
          >
            <div className="sticky top-0 z-10 flex justify之间 items-center p-4 bg-[var(--pixel-bg)] border-b-2 border-[var(--pixel-border)]">
              <h2 className="font-[family-name:var(--font-press-start)] text-xs text-[var(--pixel-accent)]">
                [ {topic} ]
              </h2>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 border-2 border-[var(--pixel-border)] text-[var(--pixel-accent)] hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
              >
                <X size={20} />
              </motion.button>
            </div>

            <div className="p-6 space-y-6 font-[family-name:var(--font-jetbrains)]">
              {/* Animated Model */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 border-2 border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)] bg-[var(--pixel-bg-alt)] text-[var(--pixel-muted)]"
              >
                {content.model}
              </motion.div>

              {/* Title & Description */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-base font-bold text-[#00d4ff] mb-2">
                  {content.title}
                </h3>
                <p className="text-[#6b7b6f] text-sm leading-relaxed">
                  {content.description}
                </p>
              </motion.div>

              {/* Formula / Key Concept */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 border-l-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] font-mono text-sm text-[var(--pixel-accent)]"
              >
                {content.formula}
              </motion.div>

              {/* Bullet Points */}
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                {content.bullets.map((bullet, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-1.5 w-2 h-2 bg-[var(--pixel-accent)] flex-shrink-0" />
                    <span className="text-[#6b7b6f] text-sm">
                      {bullet}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
