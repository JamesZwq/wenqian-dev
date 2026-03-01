"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Lightbulb,
  Rocket,
  Sparkles,
  Mail,
  Github,
  Linkedin,
  Twitter,
  Target,
  Layers,
  Cpu,
  Award,
  Coffee,
  Music,
  Gamepad2,
  ChevronRight,
} from "lucide-react";
import ScrollProgress from "./components/ScrollProgress";
import BackToTop from "./components/BackToTop";
import MagneticButton from "./components/MagneticButton";
import TiltCard from "./components/TiltCard";
import ResearchDetailModal from "./components/ResearchDetailModal";

// ========== Animated Counter ==========
function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          let start = 0;
          const end = value;
          const duration = 1500;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeOut * end));
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

// ========== Staggered Text Reveal ==========
const wordVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5 },
  }),
};

// ========== Section Title with Animation ==========
const SectionTitleAnimated = ({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="flex items-center gap-4 mb-14">
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      whileInView={{ scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="p-3.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl text-blue-500 dark:text-blue-400 shadow-lg"
    >
      <Icon size={28} />
    </motion.div>
    <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
      {children}
    </h2>
  </div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

type ResearchTopic = "Core Decomposition" | "Hypergraph Analytics" | "Distributed Systems" | null;

export default function ExtraSections() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const parallaxY = useTransform(scrollYProgress, [0, 0.3], [0, 80]);
  const [modalTopic, setModalTopic] = React.useState<ResearchTopic>(null);

  return (
    <>
      <ScrollProgress />
      <BackToTop />
      <ResearchDetailModal
        isOpen={!!modalTopic}
        onClose={() => setModalTopic(null)}
        topic={modalTopic}
      />

      <div ref={ref} className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        {/* Stats Banner - Animated Numbers */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-32"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: 7, suffix: "x", label: "Efficiency Gain", icon: Rocket },
              { value: 36, suffix: "x", label: "Memory Reduction", icon: Layers },
              { value: 500, suffix: "+", label: "Students Taught", icon: Target },
              { value: 3, suffix: "", label: "Top-Tier Papers", icon: Award },
            ].map(({ value, suffix, label, icon: Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="p-6 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 text-center"
              >
                <Icon className="mx-auto mb-3 text-blue-500" size={32} />
                <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                  <AnimatedCounter value={value} suffix={suffix} />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {label}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Projects / Highlights */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
          className="mb-32"
        >
          <SectionTitleAnimated icon={Rocket}>
            Selected Projects
          </SectionTitleAnimated>
          <div className="grid md:grid-cols-2 gap-6">
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
              <motion.div
                key={project.title}
                variants={itemVariants}
                whileHover={{ x: 5, transition: { type: "spring", stiffness: 400 } }}
                className="group p-6 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {project.title}
                  </h3>
                  <span className="text-xs font-mono text-blue-500 dark:text-blue-400">
                    {project.tech}
                  </span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  {project.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Research Focus */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="mb-32"
        >
          <SectionTitleAnimated icon={Lightbulb}>
            Research Focus
          </SectionTitleAnimated>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Core Decomposition" as const,
                desc: "Scalable algorithms for k-core and nucleus decomposition in billion-scale graphs.",
                icon: Layers,
                color: "from-blue-500 to-cyan-500",
              },
              {
                title: "Hypergraph Analytics" as const,
                desc: "Efficient computation on high-order relational structures.",
                icon: Cpu,
                color: "from-purple-500 to-pink-500",
              },
              {
                title: "Distributed Systems" as const,
                desc: "Spark/Flink deployment, Kubernetes orchestration for graph workloads.",
                icon: Rocket,
                color: "from-amber-500 to-orange-500",
              },
            ].map((item, i) => (
              <TiltCard key={item.title}>
                <motion.div
                  variants={itemVariants}
                  onClick={() => setModalTopic(item.title)}
                  className="group p-6 h-full rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}
                  >
                    <item.icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    {item.title}
                    <ChevronRight size={20} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                  <p className="mt-3 text-xs text-blue-500 dark:text-blue-400 font-medium">
                    Click to learn more →
                  </p>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </motion.section>

        {/* Fun Facts - Beyond Academia */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-32"
        >
          <SectionTitleAnimated icon={Sparkles}>
            Beyond Academia
          </SectionTitleAnimated>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Coffee, text: "Coffee-powered debugging sessions", emoji: "☕" },
              { icon: Music, text: "Lo-fi beats while writing papers", emoji: "🎵" },
              { icon: Gamepad2, text: "Strategic games enthusiast", emoji: "🎮" },
              { icon: Sparkles, text: "Open source contributor", emoji: "✨" },
            ].map((fact, i) => (
              <motion.div
                key={fact.text}
                variants={itemVariants}
                whileHover={{ scale: 1.03, rotate: 1 }}
                className="group p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 cursor-default"
              >
                <span className="text-2xl mb-2 block">{fact.emoji}</span>
                <p className="text-zinc-700 dark:text-zinc-300 text-sm font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {fact.text}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Parallax Divider */}
        <motion.div
          style={{ y: parallaxY }}
          className="mb-32 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
        />

        {/* Contact / Get in Touch */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <SectionTitleAnimated icon={Mail}>Get in Touch</SectionTitleAnimated>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-10">
            Interested in collaboration, research discussions, or just saying hi?
            I&apos;d love to hear from you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <MagneticButton
              href="mailto:wenqian@example.com"
              className="px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold flex items-center gap-2"
            >
              <Mail size={18} /> Email Me
            </MagneticButton>
            <MagneticButton
              href="#"
              className="px-6 py-3 rounded-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 text-zinc-900 dark:text-white font-semibold flex items-center gap-2"
            >
              <Github size={18} /> GitHub
            </MagneticButton>
            <MagneticButton
              href="#"
              className="px-6 py-3 rounded-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 text-zinc-900 dark:text-white font-semibold flex items-center gap-2"
            >
              <Linkedin size={18} /> LinkedIn
            </MagneticButton>
            <MagneticButton
              href="#"
              className="px-6 py-3 rounded-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 text-zinc-900 dark:text-white font-semibold flex items-center gap-2"
            >
              <Twitter size={18} /> Twitter
            </MagneticButton>
          </div>
        </motion.section>
      </div>
    </>
  );
}
