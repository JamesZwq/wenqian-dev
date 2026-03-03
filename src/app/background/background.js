"use client";

import "./styles.css";
import { Suspense, useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { Scene } from "./Scene";
import { transition } from "./settings";
import { useTheme } from "../components/ThemeProvider";

export default function Background() {
  const [isFullscreen, setFullscreen] = useState(false);
  const { theme } = useTheme();

  // 进入页面后，稍微延时再切到全屏状态，做一个柔和的过渡
  useEffect(() => {
    setFullscreen(false);
    const timer = setTimeout(() => {
      setFullscreen(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <MotionConfig transition={transition}>
      <div
        className="fixed inset-0 z-0"
        data-is-fullscreen={isFullscreen}
      >
        <motion.div className="w-screen h-screen" layout>
          <Suspense fallback={null}>
            <Scene theme={theme} isFullscreen={isFullscreen} />
          </Suspense>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
