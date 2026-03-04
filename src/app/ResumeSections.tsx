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
import DraggableFloat from "./components/DraggableFloat";

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center h-5 px-2 border border-[color-mix(in_oklab,var(--pixel-border)_45%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-sm text-[10px] font-mono text-[var(--pixel-text)]">
      {children}
    </span>
  );
}

function ToolLogo({ id }: { id: "spark" | "flink" | "k8s" | "docker" | "linux" | "unsw" }) {
  // 极简单色“logo”，用 currentColor 保持主题一致
  const common = "w-4 h-4 sm:w-[18px] sm:h-[18px] flex-shrink-0";

  if (id === "unsw") {
    return (
      <span
        className="inline-flex items-center justify-center w-8 h-5 border border-[color-mix(in_oklab,var(--pixel-border)_45%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-sm font-[family-name:var(--font-press-start)] text-[9px] text-[var(--pixel-text)]"
        aria-label="UNSW"
      >
        UNSW
      </span>
    );
  }

  // 这些图形不追求 1:1 品牌复刻，目标是“有辨识度 + 不花 + 统一质感”
  return (
    <svg
      viewBox="0 0 24 24"
      className={common}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {id === "spark" && (
        <>
          <path d="M12 2l1.4 5.2L19 6l-3.8 3.2L17 14l-5-2.8L7 14l1.8-4.8L5 6l5.6 1.2L12 2z" />
        </>
      )}
      {id === "flink" && (
        <>
          <path d="M13 2L6 13h6l-1 9 7-11h-6l1-9z" />
        </>
      )}
      {id === "k8s" && (
        <>
          <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
          <path d="M12 7v10" />
          <path d="M8 9l8 6" />
          <path d="M16 9l-8 6" />
        </>
      )}
      {id === "docker" && (
        <>
          <path d="M4 14h16" />
          <path d="M6 14v-3h3v3" />
          <path d="M9 14v-3h3v3" />
          <path d="M12 14v-3h3v3" />
          <path d="M15 14v-3h3v3" />
          <path d="M7 11V8h3v3" />
          <path d="M10 11V8h3v3" />
          <path d="M13 11V8h3v3" />
          <path d="M5 14c0 4 3 6 7 6s7-2 7-6" />
        </>
      )}
      {id === "linux" && (
        <>
          <path d="M12 3c2.2 0 4 1.8 4 4v4c0 2-1.2 3.8-4 3.8S8 13 8 11V7c0-2.2 1.8-4 4-4z" />
          <path d="M9.5 18.5c.5 1.2 1.4 2 2.5 2s2-.8 2.5-2" />
          <path d="M10 8h.01" />
          <path d="M14 8h.01" />
        </>
      )}
    </svg>
  );
}

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
    <div className="p-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
      <Icon />
    </div>
    <h2 className="font-[family-name:var(--font-press-start)] text-sm md:text-base text-[var(--pixel-accent)] tracking-widest uppercase">
      [ {children} ]
    </h2>
  </motion.div>
);

const TimelineItem = ({
  year,
  title,
  place,
  logo,
  desc,
  highlight,
}: {
  year: string;
  title: string;
  place: string;
  logo?: React.ReactNode;
  desc: string;
  highlight?: string;
}) => (
  <motion.div
    variants={itemVariants}
    className="relative pl-8 md:pl-0 md:grid md:grid-cols-12 gap-6 mb-12"
  >
    <div className="absolute left-0 top-2 bottom-[-48px] w-px bg-[color-mix(in_oklab,var(--pixel-border)_30%,transparent)] md:left-auto md:right-1/2 md:mr-[-1px]" />
    <div className="absolute left-[-4px] top-2 w-3 h-3 bg-[var(--pixel-border)] md:left-auto md:right-1/2 md:mr-[-6px] z-10" />

    <div className="md:col-span-5 md:text-right md:pr-8">
      <span className="inline-block px-3 py-1 border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)] text-xs sm:text-sm font-mono text-[var(--pixel-text)] mb-2">
        {year}
      </span>
      <h3 className="font-[family-name:var(--font-press-start)] text-xs sm:text-sm text-[var(--pixel-accent)]">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-[var(--pixel-text)] inline-flex items-center gap-2">
        {logo}
        <span>{place}</span>
      </p>
    </div>
    <div className="md:col-span-2" />
    <div className="md:col-span-5 md:pl-8 mt-2 md:mt-0">
      <p className="text-sm sm:text-base text-[var(--pixel-text)] font-[family-name:var(--font-jetbrains)] leading-relaxed">
        {desc}
      </p>
      {highlight && (
        <div className="mt-2 flex items-center gap-2 text-sm text-[var(--pixel-text)] font-mono">
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
    Accepted:
      "border-[var(--pixel-border)] text-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)]",
    Published:
      "border-[color-mix(in_oklab,var(--pixel-accent-2)_80%,transparent)] text-[var(--pixel-accent-2)] bg-[color-mix(in_oklab,var(--pixel-accent-2)_10%,transparent)]",
    'Under Review':
      "border-[color-mix(in_oklab,var(--pixel-warn)_80%,transparent)] text-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)]",
  };
  const statusKey = status.split(" - ")[0];

  return (
    <DraggableFloat
      variants={itemVariants}
      whileHover={{
        scale: 1.02,
        borderColor: "var(--pixel-border)",
        boxShadow: "0 0 20px var(--pixel-glow)",
      }}
      className="p-5 border-2 border-[color-mix(in_oklab,var(--pixel-border)_40%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl"
    >
      <div className="flex justify-between items-start mb-3">
        <span
          className={`px-2 py-1 border text-[10px] font-mono ${statusColors[statusKey] || "border-[var(--pixel-border)] text-[var(--pixel-text)]"}`}
        >
          {status}
        </span>
      </div>
      <h3 className="font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)] mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-xs text-[var(--pixel-text)] font-mono mb-3">{meta}</p>
      <p className="text-sm text-[var(--pixel-text)] font-[family-name:var(--font-jetbrains)] border-l-2 border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)] pl-4">
        {desc}
      </p>
    </DraggableFloat>
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
      <div className="flex items-center gap-2 font-[family-name:var(--font-jetbrains)] text-sm sm:text-base text-[var(--pixel-text)]">
        <span className="inline-flex transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6">
          <Icon size={16} className="text-[var(--pixel-accent)]" />
        </span>{" "}
        {name}
        {highlight && (
          <span className="text-xs px-2 py-0.5 border border-[color-mix(in_oklab,var(--pixel-border)_50%,transparent)] text-[var(--pixel-accent)]">
            LOW_LEVEL
          </span>
        )}
      </div>
      <span className="text-xs sm:text-sm font-mono text-[var(--pixel-text)]">{level}%</span>
    </div>
    <div className="h-2 w-full bg-[var(--pixel-card-bg)] backdrop-blur-sm border border-[color-mix(in_oklab,var(--pixel-border)_30%,transparent)] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${level}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] as const }}
        className="h-full bg-[var(--pixel-accent)]"
      />
    </div>
  </div>
);

export default function ResumeSections() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28 space-y-16 sm:space-y-24 md:space-y-32">
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
            logo={<ToolLogo id="unsw" />}
            desc="Topic: Efficient Algorithms for Large-scale Graph Analysis."
            highlight="Faculty Scholarship, Top 2 Most Welcoming Demonstration"
          />
          <TimelineItem
            year="Sep 2023 - Aug 2025"
            title="MPhil in Computer Science"
            place="UNSW"
            logo={<ToolLogo id="unsw" />}
            desc="Thesis: Scalable Core Decomposition in Large Networks."
            highlight="Postdoctoral Writing Fellowship"
          />
          <TimelineItem
            year="Sep 2020 - Aug 2023"
            title="B.Sc. in Computer Science"
            place="UNSW"
            logo={<ToolLogo id="unsw" />}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
        className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 lg:gap-20"
      >
        <div>
          <SectionTitle icon={IconTerminal}>Technical Arsenal</SectionTitle>
          <p className="text-[var(--pixel-text)] text-sm mb-4 sm:mb-6 -mt-4 font-[family-name:var(--font-jetbrains)]">
            Languages & Systems — C++/Rust for low-level performance.
          </p>
          <DraggableFloat className="group p-4 sm:p-6 border-2 border-[color-mix(in_oklab,var(--pixel-border)_40%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl">
            <h4 className="text-[10px] font-mono text-[var(--pixel-text)] uppercase tracking-wider mb-5">
              Languages
            </h4>
            <SkillBar name="C++" level={95} icon={Cpu} highlight />
            <SkillBar name="Rust" level={90} icon={Cpu} highlight />
            <SkillBar name="Java" level={85} icon={Database} />
            <SkillBar name="Python" level={82} icon={Database} />
            <SkillBar name="SQL" level={88} icon={Database} />
          </DraggableFloat>
        </div>
        <div>
          <h4 className="text-[10px] font-mono text-[var(--pixel-text)] uppercase tracking-wider mb-5 mt-10 sm:mt-12 md:mt-0">
            Systems & Tools
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 sm:mb-12">
            {[
              { id: "spark" as const, label: "Apache Spark" },
              { id: "flink" as const, label: "Apache Flink" },
              { id: "k8s" as const, label: "Kubernetes" },
              { id: "docker" as const, label: "Docker" },
              { id: "linux" as const, label: "Linux" },
            ].map((tech) => (
              <DraggableFloat
                key={tech.id}
                variants={itemVariants}
                whileHover={{
                  scale: 1.03,
                  borderColor: "var(--pixel-border)",
                  boxShadow: "0 0 16px var(--pixel-glow)",
                }}
                className="group px-3 py-3 border-2 border-[color-mix(in_oklab,var(--pixel-border)_35%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl font-[family-name:var(--font-jetbrains)] text-base sm:text-lg text-[var(--pixel-text)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[color-mix(in_oklab,var(--pixel-text)_85%,transparent)]">
                    <ToolLogo id={tech.id} />
                  </span>
                  <span className="inline-block transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-translate-y-0.5">
                    {tech.label}
                  </span>
                </div>
              </DraggableFloat>
            ))}
          </div>

          <SectionTitle icon={IconUsers}>Teaching Experience</SectionTitle>
          <ul className="space-y-4">
            <li>
              <DraggableFloat
                variants={itemVariants}
                className="group flex items-start gap-4 p-4 border-2 border-[color-mix(in_oklab,var(--pixel-border)_30%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl"
              >
                <div className="mt-1 w-2 h-2 rounded-full bg-[var(--pixel-accent-2)] flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-150 group-hover:shadow-[0_0_8px_var(--pixel-accent-2)]" />
                <div>
                  <strong className="block text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[10px] mb-1">
                    Database Systems (COMP3311/9311)
                  </strong>
                  <span className="text-[var(--pixel-text)] text-sm">
                    Instructed 500+ students on SQL and Relational Algebra.
                  </span>
                </div>
              </DraggableFloat>
            </li>
            <li>
              <DraggableFloat
                variants={itemVariants}
                className="group flex items-start gap-4 p-4 border-2 border-[color-mix(in_oklab,var(--pixel-border)_30%,transparent)] bg-[var(--pixel-card-bg)] backdrop-blur-xl"
              >
                <div className="mt-1 w-2 h-2 rounded-full bg-[var(--pixel-warn)] flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-150 group-hover:shadow-[0_0_8px_var(--pixel-warn)]" />
                <div>
                  <strong className="block text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[10px] mb-1">
                    Data Analytics for Graphs (COMP9312)
                  </strong>
                  <span className="text-[var(--pixel-text)] text-sm">
                    Taught advanced graph theory and algorithms.
                  </span>
                </div>
              </DraggableFloat>
            </li>
          </ul>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="text-center py-8 sm:py-12 border-t-2 border-[color-mix(in_oklab,var(--pixel-border)_20%,transparent)]">
        <p className="text-[var(--pixel-text)] text-xs font-[family-name:var(--font-jetbrains)]">
          © 2026 Wenqian Zhang. Built with Next.js, Tailwind & Framer Motion.
        </p>
      </footer>
    </div>
  );
}
