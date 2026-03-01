"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Terminal,
  Users,
  Database,
  Cpu,
  Zap,
} from "lucide-react";

// ========== Animation Variants ==========
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ========== Sub-components ==========

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
    transition={{ duration: 0.6 }}
    className="flex items-center gap-4 mb-14"
  >
    <motion.div
      initial={{ scale: 0 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="p-3.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl text-blue-500 dark:text-blue-400 shadow-lg"
    >
      <Icon size={28} />
    </motion.div>
    <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
      {children}
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
    className="relative pl-10 md:pl-0 md:grid md:grid-cols-12 gap-8 mb-16 group"
  >
    <div className="absolute left-0 top-2 bottom-[-64px] w-px bg-gradient-to-b from-blue-400/50 to-transparent dark:from-blue-500/30 md:left-auto md:right-1/2 md:mr-[-0.5px]" />
    <div className="absolute left-[-6px] top-2 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-zinc-900 md:left-auto md:right-1/2 md:mr-[-8px] z-10 group-hover:scale-125 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-300" />

    <div className="md:col-span-5 md:text-right md:pr-10">
      <span className="inline-block px-4 py-1.5 rounded-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border border-white/20 dark:border-white/10 text-sm font-mono text-zinc-600 dark:text-zinc-400 mb-3">
        {year}
      </span>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="text-zinc-500 dark:text-zinc-400 font-medium">{place}</p>
    </div>
    <div className="md:col-span-2" />
    <div className="md:col-span-5 md:pl-10 mt-3 md:mt-0">
      <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
        {desc}
      </p>
      {highlight && (
        <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
          <Zap size={14} /> {highlight}
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
    Accepted:
      "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    Published:
      "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    "Under Review":
      "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  };
  const statusKey = status.split(" - ")[0];

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        scale: 1.03,
        y: -8,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      className="p-6 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.25)] dark:hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.15)] transition-shadow duration-300"
    >
      <div className="flex justify-between items-start mb-4">
        <span
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${statusColors[statusKey] || "bg-zinc-500/20"}`}
        >
          {status}
        </span>
      </div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 font-mono">
        {meta}
      </p>
      <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed border-l-2 border-blue-500/50 pl-4">
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
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-200">
        <Icon size={18} className="text-blue-500" /> {name}
        {highlight && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
            底层性能
          </span>
        )}
      </div>
      <span className="text-xs font-mono text-zinc-500">{level}%</span>
    </div>
    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${level}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as const }}
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full"
      />
    </div>
  </div>
);

// ========== Main Component ==========

export default function ResumeSections() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 space-y-32 md:space-y-40">
      {/* About & Education */}
      <motion.section
        id="education"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={containerVariants}
      >
        <SectionTitle icon={GraduationCap}>About & Education</SectionTitle>
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

      {/* Publications - Card Waterfall */}
      <motion.section
        id="publications"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={containerVariants}
      >
        <SectionTitle icon={BookOpen}>Publications</SectionTitle>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Technical Arsenal */}
      <motion.section
        id="skills"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={containerVariants}
        className="grid md:grid-cols-2 gap-16 lg:gap-24"
      >
        <div>
          <SectionTitle icon={Terminal}>Technical Arsenal</SectionTitle>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8 -mt-6">
            Languages & Systems — emphasizing C++/Rust for low-level performance.
          </p>
          <div className="p-8 rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl">
            <h4 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6">
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
          <h4 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-6 mt-12 md:mt-0">
            Systems & Tools
          </h4>
          <div className="flex flex-wrap gap-3 mb-16">
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
                className="px-4 py-2.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border border-white/20 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-default"
              >
                {tech}
              </motion.span>
            ))}
          </div>

          <SectionTitle icon={Users}>Teaching Experience</SectionTitle>
          <ul className="space-y-6">
            <motion.li
              variants={itemVariants}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10"
            >
              <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
              <div>
                <strong className="block text-zinc-900 dark:text-zinc-100 text-lg mb-1">
                  Database Systems (COMP3311/9311)
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Instructed 500+ students on SQL and Relational Algebra.
                </span>
              </div>
            </motion.li>
            <motion.li
              variants={itemVariants}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10"
            >
              <div className="mt-1 w-3 h-3 rounded-full bg-purple-500 flex-shrink-0" />
              <div>
                <strong className="block text-zinc-900 dark:text-zinc-100 text-lg mb-1">
                  Data Analytics for Graphs (COMP9312)
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Taught advanced graph theory and algorithms.
                </span>
              </div>
            </motion.li>
          </ul>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="text-center py-16 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          © 2026 Wenqian Zhang. Built with Next.js, Tailwind & Framer Motion.
        </p>
      </footer>
    </div>
  );
}
