"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import CodeInput from "./CodeInput";

interface P2PConnectionSetupProps {
  peerId: string;
  onConnect: (remotePeerId: string) => void;
  isConnecting?: boolean;
  connectionError?: string | null;
  title?: string;
  description?: string[];
}

export default function P2PConnectionSetup({
  peerId,
  onConnect,
  isConnecting = false,
  connectionError = null,
  title = "CONNECTION_SETUP",
  description = [
    "> Share your ID with a friend",
    "> Or enter their ID to connect",
  ],
}: P2PConnectionSetupProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  
  useEffect(() => {
    if (connectionError) {
      setResetSignal(prev => prev + 1);
    }
  }, [connectionError]);

  const handleCopy = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] backdrop-blur-xl shadow-[0_0_30px_var(--pixel-glow)]"
      >
        <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)]">
          <div className="flex gap-1 md:gap-1.5">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-[var(--pixel-warn)] animate-pulse" />
            <div className="w-2 h-2 md:w-3 md:h-3 bg-[var(--pixel-accent-2)]" />
            <div className="w-2 h-2 md:w-3 md:h-3 bg-[var(--pixel-accent)]" />
          </div>
          <span className="font-[family-name:var(--font-press-start)] text-[8px] md:text-[10px] text-[var(--pixel-accent)] ml-2 md:ml-4 tracking-widest truncate">
            {title}
          </span>
        </div>

        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 md:mb-8">
            <label className="block text-[var(--pixel-accent)] font-[family-name:var(--font-press-start)] text-[8px] md:text-[10px] mb-2 tracking-wider">
              [ YOUR_PEER_ID ]
            </label>
            <div className="relative">
              <input
                type="text"
                value={peerId}
                readOnly
                className="w-full px-3 md:px-4 py-2 md:py-3 pr-16 md:pr-20 bg-[var(--pixel-bg)] border-2 border-[var(--pixel-border)] text-[var(--pixel-accent)] font-[family-name:var(--font-jetbrains)] text-sm md:text-base focus:outline-none focus:shadow-[0_0_10px_var(--pixel-glow)] transition-shadow"
                placeholder="Generating..."
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopy}
                disabled={!peerId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 md:px-3 py-1 font-[family-name:var(--font-press-start)] text-[7px] md:text-[8px] transition-colors min-w-[40px] md:min-w-[50px] text-center ${
                  peerId 
                    ? "bg-[var(--pixel-accent)] text-[var(--pixel-bg)] hover:bg-[var(--pixel-accent-2)] cursor-pointer" 
                    : "bg-[var(--pixel-muted)] text-[var(--pixel-bg)] cursor-not-allowed opacity-50"
                }`}
              >
                {copySuccess ? "✓" : "COPY"}
              </motion.button>
            </div>
            {!peerId && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-[var(--pixel-muted)] font-[family-name:var(--font-jetbrains)] text-xs"
              >
                &gt; Initializing peer connection...
              </motion.p>
            )}
          </div>

          <div className="mb-6 md:mb-8">
            <CodeInput
              length={6}
              label="CONNECT_TO_PEER"
              onComplete={onConnect}
              disabled={!peerId}
              status={isConnecting ? "connecting" : connectionError ? "error" : "idle"}
              resetSignal={resetSignal}
            />
            
            <AnimatePresence mode="wait">
              {isConnecting && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 flex items-center gap-2 text-[var(--pixel-accent-2)] font-[family-name:var(--font-jetbrains)] text-xs justify-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-[var(--pixel-accent-2)] border-t-transparent rounded-full"
                  />
                  <span>&gt; Establishing secure connection...</span>
                </motion.div>
              )}
              
              {connectionError && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="mt-4 p-3 border-2 border-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)]"
                >
                  <div className="flex items-start gap-2">
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: 2 }}
                      className="text-[var(--pixel-warn)] font-[family-name:var(--font-press-start)] text-xs"
                    >
                      ⚠
                    </motion.span>
                    <div className="flex-1">
                      <p className="text-[var(--pixel-warn)] font-[family-name:var(--font-press-start)] text-[8px] mb-1">
                        [ CONNECTION_ERROR ]
                      </p>
                      <p className="text-[var(--pixel-text)] font-[family-name:var(--font-jetbrains)] text-xs mb-2">
                        {connectionError}
                      </p>
                      <p className="text-[var(--pixel-muted)] font-[family-name:var(--font-jetbrains)] text-[10px]">
                        &gt; Connection reset. You can try again.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-[var(--pixel-muted)] font-[family-name:var(--font-jetbrains)] text-xs space-y-1">
            {description.map((line, index) => (
              <motion.p
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
