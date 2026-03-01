"use client";

import React from "react";
import { motion } from "framer-motion";
import { Database, Cpu } from "lucide-react";
import {
  IconGraduation,
  IconBook,
  IconTerminal,
  IconUsers,
  IconZap,
} from "./components/RefinedIcons";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

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
      <Icon />
    </div>
    <h2 className="font-[family-name:var(--font-press-start)] text-xs md:text-sm text-[#00ff88] tracking-widest uppercase">
      [ {children} ]
    </h2>
  </motion.div>
);

const TimelineItem = ({
  year,
  title,
  place,
  desc,
  highlight,
}: {
  year: string;
  title: string;
  place: string;
  desc: string;
  highlight?: string;
}) => (
  <motion.div
    variants={itemVariants}
    className="relative pl-8 md:pl-0 md:grid md:grid-cols-12 gap-6 mb-12"
  >
    <div className="absolute left-0 top-2 bottom-[-48px] w-px bg-[#00ff88]/30 md:left-auto md:right-1/2 md:mr-[-1px]" />
    <div className="absolute left-[-4px] top-2 w-3 h-3 bg-[#00ff88] md:left-auto md:right-1/2 md:mr-[-6px] z-10" />

    <div className="md:col-span-5 md:text-right md:pr-8">
      <span className="inline-block px-3 py-1 border border-[#00ff88]/50 text-[10px] font-mono text-[#6b7b6f] mb-2">
        {year}
      </span>
      <h3 className="font-[family-name:var(--font-press-start)] text-[10px] text-[#00ff88]">
        {title}
      </h3>
      <p className="text-sm text-[#6b7b6f]">{place}</p>
    </div>
    <div className="md:col-span-2" />
    <div className="md:col-span-5 md:pl-8 mt-2 md:mt-0">
      <p className="text-sm text-[#e0ffe8] font-[family-name:var(--font-jetbrains)] leading-relaxed">
        {desc}
      </p>
      {highlight && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#00d4ff] font-mono">
          <IconZap /> {highlight}
        </div>
      )}
    </div>
  </motion.div>
);

const PublicationCard = ({
  status,
  title,
  meta,
  desc,
}: {
  status: string;
  title: string;
  meta: string;
  desc: string;
}) => {
  const statusColors: Record<string, string> = {
    Accepted: "border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10",
    Published: "border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/10",
    "Under Review": "border-[#ff6b35] text-[#ff6b35] bg-[#ff6b35]/10",
  };
  const statusKey = status.split(" - ")[0];

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        scale: 1.02,
        borderColor: "#00ff88",
        boxShadow: "0 0 20px rgba(0,255,136,0.15)",
      }}
      className="p-5 border-2 border-[#00ff88]/40 bg-[#0a0a0b]"
    >
      <div className="flex justify-between items-start mb-3">
        <span
          className={`px-2 py-1 border text-[10px] font-mono ${statusColors[statusKey] || "border-[#6b7b6f]"}`}
        >
          {status}
        </span>
      </div>
      <h3 className="font-[family-name:var(--font-press-start)] text-[10px] text-[#00ff88] mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-xs text-[#6b7b6f] font-mono mb-3">{meta}</p>
      <p className="text-sm text-[#6b7b6f] font-[family-name:var(--font-jetbrains)] border-l-2 border-[#00ff88]/50 pl-4">
        {desc}
      </p>
    </motion.div>
  );
};

const SkillBar = ({
  name,
  level,
  icon: Icon,
  highlight,
}: {
  name: string;
  level: number;
  icon: React.ElementType;
  highlight?: boolean;
}) => (
  <div className="mb-5">
    <div className="flex justify-between mb-2">
      <div className="flex items-center gap-2 font-[family-name:var(--font-jetbrains)] text-sm text-[#e0ffe8]">
        <Icon size={16} className="text-[#00ff88]" /> {name}
        {highlight && (
          <span className="text-[10px] px-2 py-0.5 border border-[#00ff88]/50 text-[#00ff88]">
            LOW_LEVEL
          </span>
        )}
      </div>
      <span className="text-[10px] font-mono text-[#6b7b6f]">{level}%</span>
    </div>
    <div className="h-2 w-full bg-[#121214] border border-[#00ff88]/30 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${level}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] as const }}
        className="h-full bg-[#00ff88]"
      />
    </div>
  </div>
);

export default function ResumeSections() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 space-y-24 md:space-y-32">
      {/* Education */}
      <motion.section
        id="education"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={containerVariants}
      >
        <SectionTitle icon={IconGraduation}>About & Education</SectionTitle>
        <div className="relative">
          <TimelineItem
            year="Sep 2025 - Present"
            title="Ph.D. in Computer Science"
            place="UNSW (University of New South Wales)"
            desc="Topic: Efficient Algorithms for Large-scale Graph Analysis."
            highlight="Faculty Scholarship, Top 2 Most Welcoming Demonstration"
          />
          <TimelineItem
            year="Sep 2023 - Aug 2025"
            title="MPhil in Computer Science"
            place="UNSW"
            desc="Thesis: Scalable Core Decomposition in Large Networks."
            highlight="Postdoctoral Writing Fellowship"
          />
          <TimelineItem
            year="Sep 2020 - Aug 2023"
            title="B.Sc. in Computer Science"
            place="UNSW"
            desc="Graduated with Distinction."
            highlight="Dean's List 2022"
          />
        </div>
      </motion.section>

      {/* Publications */}
      <motion.section
        id="publications"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={containerVariants}
      >
        <SectionTitle icon={IconBook}>Publications</SectionTitle>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PublicationCard
            status="Accepted - SIGMOD 2025"
            title="Accelerating Core Decomposition in Billion-Scale Hypergraphs"
            meta="First Author"
            desc="Improved efficiency by 7x and reduced memory by 36x compared to state-of-the-art."
          />
          <PublicationCard
            status="Published - ICDM Workshop 2023"
            title="Efficient Distributed Core Graph Decomposition"
            meta="First Author"
            desc="Optimized algorithms deployed on Spark/Flink via Kubernetes clusters."
          />
          <PublicationCard
            status="Under Review - SIGMOD"
            title="Nucleus Decomposition Revisited: An Efficient Counting-Based Approach"
            meta="Co-Author"
            desc="Proposing a novel counting-based framework for dense subgraph discovery."
          />
        </div>
      </motion.section>

      {/* Skills & Teaching */}
      <motion.section
        id="skills"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={containerVariants}
        className="grid md:grid-cols-2 gap-16 lg:gap-20"
      >
        <div>
          <SectionTitle icon={IconTerminal}>Technical Arsenal</SectionTitle>
          <p className="text-[#6b7b6f] text-sm mb-6 -mt-4 font-[family-name:var(--font-jetbrains)]">
            Languages & Systems — C++/Rust for low-level performance.
          </p>
          <div className="p-6 border-2 border-[#00ff88]/40 bg-[#0a0a0b]">
            <h4 className="text-[10px] font-mono text-[#6b7b6f] uppercase tracking-wider mb-5">
              Languages
            </h4>
            <SkillBar name="C++" level={95} icon={Cpu} highlight />
            <SkillBar name="Rust" level={90} icon={Cpu} highlight />
            <SkillBar name="Java" level={85} icon={Database} />
            <SkillBar name="Python" level={82} icon={Database} />
            <SkillBar name="SQL" level={88} icon={Database} />
          </div>
        </div>
        <div>
          <h4 className="text-[10px] font-mono text-[#6b7b6f] uppercase tracking-wider mb-5 mt-12 md:mt-0">
            Systems & Tools
          </h4>
          <div className="flex flex-wrap gap-2 mb-12">
            {[
              "Apache Spark",
              "Apache Flink",
              "Kubernetes",
              "Docker",
              "Linux",
            ].map((tech, i) => (
              <motion.span
                key={tech}
                variants={itemVariants}
                whileHover={{
                  borderColor: "#00ff88",
                  color: "#00ff88",
                }}
                className="px-3 py-2 border border-[#00ff88]/40 text-[#6b7b6f] text-sm font-[family-name:var(--font-jetbrains)] hover:bg-[#00ff88]/5 transition-colors"
              >
                {tech}
              </motion.span>
            ))}
          </div>

          <SectionTitle icon={IconUsers}>Teaching Experience</SectionTitle>
          <ul className="space-y-4">
            <motion.li
              variants={itemVariants}
              className="flex items-start gap-4 p-4 border-2 border-[#00ff88]/30 bg-[#0a0a0b]"
            >
              <div className="mt-1 w-2 h-2 bg-[#00d4ff] flex-shrink-0" />
              <div>
                <strong className="block text-[#00ff88] font-[family-name:var(--font-press-start)] text-[10px] mb-1">
                  Database Systems (COMP3311/9311)
                </strong>
                <span className="text-[#6b7b6f] text-sm">
                  Instructed 500+ students on SQL and Relational Algebra.
                </span>
              </div>
            </motion.li>
            <motion.li
              variants={itemVariants}
              className="flex items-start gap-4 p-4 border-2 border-[#00ff88]/30 bg-[#0a0a0b]"
            >
              <div className="mt-1 w-2 h-2 bg-[#ff6b35] flex-shrink-0" />
              <div>
                <strong className="block text-[#00ff88] font-[family-name:var(--font-press-start)] text-[10px] mb-1">
                  Data Analytics for Graphs (COMP9312)
                </strong>
                <span className="text-[#6b7b6f] text-sm">
                  Taught advanced graph theory and algorithms.
                </span>
              </div>
            </motion.li>
          </ul>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="text-center py-12 border-t-2 border-[#00ff88]/20">
        <p className="text-[#6b7b6f] text-xs font-[family-name:var(--font-jetbrains)]">
          © 2026 Wenqian Zhang. Built with Next.js, Tailwind & Framer Motion.
        </p>
      </footer>
    </div>
  );
}
