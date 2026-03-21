"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { 
      href: "/chat", 
      label: "P2P_CHAT", 
      icon: "💬",
      color: "var(--pixel-warn)",
      description: "Encrypted peer-to-peer messaging"
    },
    {
      href: "/gomoku",
      label: "GOMOKU",
      icon: "⚫",
      color: "var(--pixel-accent)",
      description: "Five in a Row multiplayer game"
    },
    {
      href: "/maze",
      label: "MAZE_RUNNER",
      icon: "🏃",
      color: "var(--pixel-accent-2)",
      description: "P2P maze race with items & power-ups"
    },
  ];

  return (
    <div className="fixed top-6 left-6 z-50">
      {/* 主按钮 */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-3 font-[family-name:var(--font-press-start)] text-[10px] tracking-wider text-[var(--pixel-accent)] shadow-[0_0_20px_var(--pixel-glow)] backdrop-blur-xl transition-all hover:shadow-[0_0_30px_var(--pixel-glow)]"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-base">{isOpen ? "✕" : "☰"}</span>
        <span className="hidden sm:inline">MENU</span>
        
        {/* 脉冲指示器 */}
        {/* {!isOpen && (
          <motion.div
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[var(--pixel-accent)]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )} */}
      </motion.button>

      {/* 下拉菜单 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-full mt-3 w-80 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-[0_0_40px_var(--pixel-glow)] backdrop-blur-xl"
          >
            {/* 标题 */}
            <div className="border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3">
              <h3 className="font-[family-name:var(--font-press-start)] text-[10px] tracking-wider text-[var(--pixel-accent)]">
                [ P2P_APPLICATIONS ]
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
                    className="group relative block border-2 border-transparent p-4 transition-all hover:border-[var(--pixel-border)] hover:bg-[var(--pixel-bg-alt)]"
                  >
                    <div className="flex items-start gap-3">
                      {/* 图标 */}
                      <span className="text-2xl transition-transform group-hover:scale-110">
                        {item.icon}
                      </span>
                      
                      {/* 内容 */}
                      <div className="flex-1">
                        <div className="mb-1 font-[family-name:var(--font-press-start)] text-[10px] tracking-wider" style={{ color: item.color }}>
                          {item.label}
                        </div>
                        <div className="font-[family-name:var(--font-jetbrains)] text-xs text-[var(--pixel-muted)]">
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

                    {/* 悬停效果 */}
                    <motion.div
                      className="absolute inset-0 border-2 border-[var(--pixel-accent)] opacity-0 group-hover:opacity-20"
                      initial={false}
                    />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="border-t-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-2">
              <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[var(--pixel-muted)]">
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
