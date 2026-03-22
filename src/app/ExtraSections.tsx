"use client";

import React, { useRef, useCallback } from "react";
import { motion, useTransform, useMotionValue } from "framer-motion";
import {
  Rocket,
  Mail,
  Github,
  Linkedin,
  Target,
  Layers,
  Cpu,
  Award,
  ChevronRight,
} from "lucide-react";
import ScrollProgress from "./components/ScrollProgress";
import BackToTop from "./components/BackToTop";
import ResearchDetailModal from "./components/ResearchDetailModal";
import DraggableFloat from "./components/DraggableFloat";
import { useScrollLag } from "./components/ScrollLagContext";

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = React.useState(0);
  const lastDisplayRef = useRef(-1);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          const end = value;
          const duration = 1200;
          const startTime = performance.now();
          lastDisplayRef.current = -1;
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const display = Math.floor(easeOut * end);
            if (display !== lastDisplayRef.current) {
              lastDisplayRef.current = display;
              setCount(display);
            }
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

const sectionTitleClass =
  "font-sans text-base md:text-lg font-bold text-[var(--pixel-accent)] tracking-tight uppercase";

const SectionTitle = ({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="flex items-center gap-4 mb-10"
  >
    <div className="p-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
      <Icon size={20} />
    </div>
    <h2 className={`${sectionTitleClass}`}>
      {children}
    </h2>
  </motion.div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

type ResearchTopic = "Core Decomposition" | "Hypergraph Analytics" | "Distributed Systems" | null;

export default function ExtraSections() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollLag = useScrollLag();
  const zeroProgress = useMotionValue(0);
  const scrollYProgress = scrollLag?.scrollYProgress ?? zeroProgress;
  const parallaxY = useTransform(scrollYProgress, [0, 0.3], [0, 80]);
  const [modalTopic, setModalTopic] = React.useState<ResearchTopic>(null);
  const handleCloseModal = useCallback(() => setModalTopic(null), []);

  return (
    <>
      <ScrollProgress />
      <BackToTop />
      <ResearchDetailModal
        isOpen={!!modalTopic}
        onClose={handleCloseModal}
        topic={modalTopic}
      />

      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28">
        {/* Stats */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 sm:mb-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { value: 7, suffix: "x", label: "Efficiency", icon: Rocket, iconHover: "group-hover:-translate-y-2 group-hover:-rotate-12" },
              { value: 36, suffix: "x", label: "Memory ↓", icon: Layers, iconHover: "group-hover:scale-110 group-hover:rotate-6" },
              { value: 500, suffix: "+", label: "Students", icon: Target, iconHover: "group-hover:scale-110 group-hover:translate-y-[-2px]" },
              { value: 3, suffix: "", label: "Papers", icon: Award, iconHover: "group-hover:scale-110 group-hover:rotate-6" },
            ].map(({ value, suffix, label, icon: Icon, iconHover }, i) => (
              <DraggableFloat
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{
                  scale: 1.05,
                  borderColor: "var(--pixel-border)",
                  boxShadow: "0 8px 32px var(--pixel-glow)",
                }}
                className="group p-4 sm:p-5 rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl text-center font-mono"
              >
                <span className={`inline-block transition-transform duration-300 ease-out ${iconHover}`}>
                  <Icon className="mx-auto mb-2 text-[var(--pixel-accent)]" size={24} />
                </span>
                <div className="text-2xl md:text-3xl font-bold text-[var(--pixel-accent)]">
                  <AnimatedCounter value={value} suffix={suffix} />
                </div>
                <p className="text-xs text-[var(--pixel-text)] mt-1">{label}</p>
              </DraggableFloat>
            ))}
          </div>
        </motion.section>

        {/* Projects */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
          className="mb-16 sm:mb-24"
        >
          <SectionTitle icon={Rocket}>Projects</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                title: "Billion-Scale Hypergraph Engine",
                tech: "C++ · Rust · Spark",
                desc: "High-performance in-memory engine for core decomposition on hypergraphs with 10^9+ hyperedges.",
              },
              {
                title: "Distributed Graph Analytics",
                tech: "Kubernetes · Flink · Java",
                desc: "Cloud-native deployment of graph algorithms with auto-scaling and fault tolerance.",
              },
            ].map((project, i) => (
              <DraggableFloat
                key={project.title}
                variants={itemVariants}
                whileHover={{
                  x: 4,
                  borderColor: "var(--pixel-border)",
                  boxShadow: "0 8px 32px var(--pixel-glow)",
                }}
                className="group p-4 sm:p-5 rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_40%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl hover:border-[var(--pixel-border)] transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-sans text-sm font-semibold text-[var(--pixel-accent)]">
                    {project.title}
                  </h3>
                  <span className="text-xs font-mono text-[var(--pixel-accent-2)]">
                    {project.tech}
                  </span>
                </div>
                <p className="text-sm text-[var(--pixel-text)] font-mono">
                  {project.desc}
                </p>
              </DraggableFloat>
            ))}
          </div>
        </motion.section>

        {/* Research Focus */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-16 sm:mb-24"
        >
          <SectionTitle icon={Layers}>Research Focus</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                title: "Core Decomposition" as const,
                desc: "Scalable algorithms for k-core and nucleus decomposition in billion-scale graphs.",
                icon: Layers,
              },
              {
                title: "Hypergraph Analytics" as const,
                desc: "Efficient computation on high-order relational structures.",
                icon: Cpu,
              },
              {
                title: "Distributed Systems" as const,
                desc: "Spark/Flink deployment, Kubernetes orchestration for graph workloads.",
                icon: Rocket,
              },
            ].map((item, i) => (
              <DraggableFloat
                key={item.title}
                variants={itemVariants}
                onClick={() => setModalTopic(item.title)}
                whileHover={{
                  scale: 1.02,
                  borderColor: "var(--pixel-border)",
                  boxShadow: "0 8px 32px var(--pixel-glow)",
                }}
                className="group p-4 sm:p-5 rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_40%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl cursor-pointer touch-manipulation"
              >
                <div className="w-10 h-10 rounded-xl border border-[var(--pixel-border)] flex items-center justify-center mb-4">
                  <span
                    className={`inline-flex items-center justify-center transition-transform duration-300 ease-out ${
                      item.title === "Core Decomposition"
                        ? "group-hover:scale-110 group-hover:rotate-6"
                        : item.title === "Hypergraph Analytics"
                          ? "group-hover:scale-110 group-hover:-rotate-6"
                          : "group-hover:-translate-y-1 group-hover:-rotate-12"
                    }`}
                  >
                    <item.icon className="text-[var(--pixel-accent)]" size={20} />
                  </span>
                </div>
                <h3 className="font-sans text-sm font-semibold text-[var(--pixel-accent)] mb-2 flex items-center justify-between">
                  {item.title}
                  <ChevronRight size={20} className="text-[var(--pixel-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-[var(--pixel-text)] font-mono">
                  {item.desc}
                </p>
                <p className="mt-2 text-xs text-[var(--pixel-accent-2)] font-mono">Click to learn more →</p>
              </DraggableFloat>
            ))}
          </div>
        </motion.section>

        {/* Fun Facts - Beyond Academia */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-16 sm:mb-24"
        >
          <SectionTitle icon={Target}>Beyond Academia</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { text: "Coffee-powered debugging", emoji: "☕" },
              { text: "Lo-fi beats while writing", emoji: "🎵" },
              { text: "Strategic games enthusiast", emoji: "🎮" },
              { text: "Piano performance — just nailed my last piece", emoji: "🎹" },
            ].map((fact, i) => (
              <DraggableFloat
                key={fact.text}
                variants={itemVariants}
                whileHover={{ scale: 1.03, borderColor: "var(--pixel-border)" }}
                className="group p-4 rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_30%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl font-mono touch-manipulation"
              >
                <span className="text-xl block mb-2 transition-transform duration-300 ease-out group-hover:scale-125 group-hover:rotate-12">{fact.emoji}</span>
                <p className="text-sm text-[var(--pixel-text)] font-medium">{fact.text}</p>
              </DraggableFloat>
            ))}
          </div>
        </motion.section>

        {/* Parallax Divider */}
        <motion.div
          style={{ y: parallaxY }}
          className="mb-16 sm:mb-24 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--pixel-accent)_50%,transparent)] to-transparent"
        />

        {/* Contact */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <SectionTitle icon={Mail}>Get in Touch</SectionTitle>
          <p className="text-[var(--pixel-text)] max-w-xl mx-auto mb-6 sm:mb-8 font-mono text-sm px-1">
            Interested in collaboration, research discussions, or just saying hi?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { href: "mailto:wenqian@example.com", icon: Mail, label: "Email" },
              { href: "#", icon: Github, label: "GitHub" },
              { href: "#", icon: Linkedin, label: "LinkedIn" },
            ].map(({ href, icon: Icon, label }) => (
              <motion.a
                key={label}
                href={href}
                whileHover={{ scale: 1.05, boxShadow: "0 8px 32px var(--pixel-glow)" }}
                whileTap={{ scale: 0.98 }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[var(--pixel-border)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)] text-[var(--pixel-accent)] font-sans text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)] transition-colors touch-manipulation"
              >
                <Icon size={16} /> {label}
              </motion.a>
            ))}
          </div>
        </motion.section>
      </div>
    </>
  );
}
