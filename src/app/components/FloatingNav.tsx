"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      href: "/chat",
      label: "P2P Chat",
      icon: "💬",
      color: "var(--pixel-warn)",
      description: "Encrypted peer-to-peer messaging"
    },
    {
      href: "/gomoku",
      label: "Gomoku",
      icon: "⚫",
      color: "var(--pixel-accent)",
      description: "Five in a Row multiplayer game"
    },
    {
      href: "/maze",
      label: "Maze Runner",
      icon: "🏃",
      color: "var(--pixel-accent-2)",
      description: "P2P maze race with items & power-ups"
    },
    {
      href: "/math",
      label: "Math Sprint",
      icon: "🧮",
      color: "var(--pixel-accent)",
      description: "Speed arithmetic challenge"
    },
    {
      href: "/flash-count",
      label: "Flash Count",
      icon: "🧊",
      color: "var(--pixel-accent-2)",
      description: "Count 3D blocks before they vanish"
    },
    {
      href: "/poker",
      label: "Texas Hold'em",
      icon: "♠️",
      color: "var(--pixel-warn)",
      description: "Heads-up P2P poker, blinds escalate"
    },
  ];

  return (
    <div className="fixed top-6 left-6 z-50">
      {/* 主按钮 */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans text-sm font-semibold tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-all hover:shadow-2xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-base">{isOpen ? "✕" : "☰"}</span>
        <span className="hidden sm:inline">MENU</span>
      </motion.button>

      {/* 下拉菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-full mt-3 w-80 rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm overflow-hidden"
          >
            {/* 标题 */}
            <div className="border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3 rounded-t-2xl">
              <h3 className="font-sans text-sm font-semibold tracking-tight text-[var(--pixel-accent)]">
                P2P Applications
              </h3>
            </div>

            {/* 菜单项 */}
            <div className="p-2">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="group relative block rounded-xl border border-transparent p-4 transition-all hover:border-[var(--pixel-border)] hover:bg-[var(--pixel-bg-alt)]"
                  >
                    <div className="flex items-start gap-3">
                      {/* 图标 */}
                      <span className="text-2xl transition-transform group-hover:scale-110">
                        {item.icon}
                      </span>

                      {/* 内容 */}
                      <div className="flex-1">
                        <div className="mb-1 font-sans text-sm font-semibold tracking-tight" style={{ color: item.color }}>
                          {item.label}
                        </div>
                        <div className="font-mono text-xs text-[var(--pixel-muted)]">
                          {item.description}
                        </div>
                      </div>

                      {/* 箭头 */}
                      <motion.span
                        className="text-[var(--pixel-accent)] opacity-0 transition-opacity group-hover:opacity-100"
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="border-t border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-2 rounded-b-2xl">
              <p className="font-mono text-[10px] text-[var(--pixel-muted)]">
                &gt; Browser-to-browser, no server required
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 点击外部关闭 */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
