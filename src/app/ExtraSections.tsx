"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
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

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          let start = 0;
          const end = value;
          const duration = 1200;
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

const sectionTitleClass = "font-[family-name:var(--font-press-start)] text-xs md:text-sm text-[#00ff88] tracking-widest uppercase";

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
    <div className="p-2 border-2 border-[#00ff88] bg-[#0a0a0b] text-[#00ff88]">
      <Icon size={20} />
    </div>
    <h2 className={`${sectionTitleClass}`}>
      [ {children} ]
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

      <div ref={ref} className="max-w-5xl mx-auto px-6 py-20 md:py-28">
        {/* Stats - Pixel blocks */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 7, suffix: "x", label: "Efficiency", icon: Rocket },
              { value: 36, suffix: "x", label: "Memory ↓", icon: Layers },
              { value: 500, suffix: "+", label: "Students", icon: Target },
              { value: 3, suffix: "", label: "Papers", icon: Award },
            ].map(({ value, suffix, label, icon: Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{
                  scale: 1.05,
                  borderColor: "#00ff88",
                  boxShadow: "0 0 20px rgba(0,255,136,0.2)",
                }}
                className="p-5 border-2 border-[#00ff88]/50 bg-[#0a0a0b] text-center font-[family-name:var(--font-jetbrains)]">
                <Icon className="mx-auto mb-2 text-[#00ff88]" size={24} />
                <div className="text-2xl md:text-3xl font-bold text-[#00ff88]">
                  <AnimatedCounter value={value} suffix={suffix} />
                </div>
                <p className="text-xs text-[#6b7b6f] mt-1">{label}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Projects */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
          className="mb-24"
        >
          <SectionTitle icon={Rocket}>Projects</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
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
                whileHover={{
                  x: 4,
                  borderColor: "#00ff88",
                  boxShadow: "0 0 15px rgba(0,255,136,0.15)",
                }}
                className="group p-5 border-2 border-[#00ff88]/40 bg-[#0a0a0b] hover:border-[#00ff88] transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-[family-name:var(--font-press-start)] text-[10px] text-[#00ff88]">
                    {project.title}
                  </h3>
                  <span className="text-[10px] font-mono text-[#00d4ff]">
                    {project.tech}
                  </span>
                </div>
                <p className="text-sm text-[#6b7b6f] font-[family-name:var(--font-jetbrains)]">
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
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-24"
        >
          <SectionTitle icon={Layers}>Research Focus</SectionTitle>
          <div className="grid md:grid-cols-3 gap-4">
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
              <motion.div
                key={item.title}
                variants={itemVariants}
                onClick={() => setModalTopic(item.title)}
                whileHover={{
                  scale: 1.02,
                  borderColor: "#00ff88",
                  boxShadow: "0 0 20px rgba(0,255,136,0.2)",
                }}
                className="p-5 border-2 border-[#00ff88]/40 bg-[#0a0a0b] cursor-pointer group"
              >
                <div className="w-10 h-10 border-2 border-[#00ff88] flex items-center justify-center mb-4">
                  <item.icon className="text-[#00ff88]" size={20} />
                </div>
                <h3 className="font-[family-name:var(--font-press-start)] text-[10px] text-[#00ff88] mb-2 flex items-center justify-between">
                  {item.title}
                  <ChevronRight size={20} className="text-[#00ff88] opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-[#6b7b6f] font-[family-name:var(--font-jetbrains)]">
                  {item.desc}
                </p>
                <p className="mt-2 text-[10px] text-[#00d4ff] font-mono">Click to learn more →</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Fun Facts - Beyond Academia */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="mb-24"
        >
          <SectionTitle icon={Target}>Beyond Academia</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { text: "Coffee-powered debugging", emoji: "☕" },
              { text: "Lo-fi beats while writing", emoji: "🎵" },
              { text: "Strategic games enthusiast", emoji: "🎮" },
              { text: "Open source contributor", emoji: "✨" },
            ].map((fact, i) => (
              <motion.div
                key={fact.text}
                variants={itemVariants}
                whileHover={{ scale: 1.03, borderColor: "#00ff88" }}
                className="p-4 border-2 border-[#00ff88]/30 bg-[#0a0a0b] font-[family-name:var(--font-jetbrains)]"
              >
                <span className="text-xl block mb-2">{fact.emoji}</span>
                <p className="text-sm text-[#6b7b6f] font-medium">{fact.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Parallax Divider */}
        <motion.div
          style={{ y: parallaxY }}
          className="mb-24 h-px bg-gradient-to-r from-transparent via-[#00ff88]/50 to-transparent"
        />

        {/* Contact */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <SectionTitle icon={Mail}>Get in Touch</SectionTitle>
          <p className="text-[#6b7b6f] max-w-xl mx-auto mb-8 font-[family-name:var(--font-jetbrains)] text-sm">
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
                whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(0,255,136,0.3)" }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2.5 border-2 border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88] font-[family-name:var(--font-press-start)] text-[10px] flex items-center gap-2 hover:bg-[#00ff88]/20 transition-colors"
              >
                <Icon size={16} /> [ {label} ]
              </motion.a>
            ))}
          </div>
        </motion.section>
      </div>
    </>
  );
}
