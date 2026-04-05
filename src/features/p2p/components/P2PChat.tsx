"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatMessage } from "../hooks/useP2PChat";

const QUICK_EMOJIS = ["🍌", "❤️", "💔", "😂", "🎉", "👍", "🔥", "💪", "😅", "🤣", "😱", "🏆"];
const QUICK_PHRASES = ["GG!", "Nice move!", "Good game", "Rematch?", "Too slow 😏", "LOL"];

interface P2PChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isConnected: boolean;
}

export function P2PChat({ messages, onSend, isConnected }: P2PChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [joinBanner, setJoinBanner] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevConnectedRef = useRef(false);
  const prevMsgCountRef = useRef(0);

  // Join banner
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      setJoinBanner(true);
      const t = setTimeout(() => setJoinBanner(false), 3000);
      return () => clearTimeout(t);
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected]);

  // Unread badge
  useEffect(() => {
    if (!isOpen && messages.length > prevMsgCountRef.current) {
      const added = messages.slice(prevMsgCountRef.current).filter(m => m.from === "opponent");
      if (added.length > 0) setUnread(prev => prev + added.length);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, isOpen]);

  // Clear unread on open
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || !isConnected) return;
      onSend(text.trim());
      setInput("");
    },
    [onSend, isConnected],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [handleSend, input],
  );

  if (!isConnected) return null;

  return (
    <>
      {/* Join banner */}
      <AnimatePresence>
        {joinBanner && (
          <motion.div
            initial={{ opacity: 0, y: -32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ duration: 0.25 }}
            className="fixed top-16 left-1/2 z-[200] -translate-x-1/2 rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-2 font-mono text-sm text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm"
          >
            🔔 Opponent connected!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat widget — fixed bottom-left */}
      <div className="fixed bottom-4 left-4 z-[150] flex flex-col items-start">
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex w-[300px] flex-col overflow-hidden rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-3 py-2 rounded-t-2xl">
                <span className="font-sans text-xs font-semibold text-[var(--pixel-accent)]">
                  💬 CHAT
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-0.5 font-mono text-xs text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Messages */}
              <div className="flex h-48 flex-col gap-1.5 overflow-y-auto p-2">
                {messages.length === 0 ? (
                  <p className="py-6 text-center font-mono text-[10px] text-[var(--pixel-muted)]">
                    Say hello to your opponent! 👋
                  </p>
                ) : (
                  messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick emojis */}
              <div className="flex flex-wrap gap-0.5 border-t border-[var(--pixel-border)] px-2 py-1.5">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleSend(emoji)}
                    className="rounded-lg px-1 py-0.5 text-base hover:bg-[var(--pixel-bg-alt)] transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Quick phrases */}
              <div className="flex flex-wrap gap-1.5 border-t border-[var(--pixel-border)] px-2 py-1.5">
                {QUICK_PHRASES.map(phrase => (
                  <button
                    key={phrase}
                    onClick={() => handleSend(phrase)}
                    className="rounded-lg border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)] transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2 border-t border-[var(--pixel-border)] p-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  maxLength={120}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-2.5 py-1.5 font-mono text-xs text-[var(--pixel-text)] placeholder-[var(--pixel-muted)] outline-none focus:border-[var(--pixel-accent)] transition-colors"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim()}
                  className="rounded-lg border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-2.5 py-1.5 font-mono text-xs font-bold text-[var(--pixel-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  →
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="toggle"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans text-xs font-semibold text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm"
            >
              <span>💬</span>
              <span className="hidden sm:inline">CHAT</span>
              <AnimatePresence>
                {unread > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--pixel-warn)] px-1 font-mono text-[9px] font-bold text-[var(--pixel-bg)]"
                  >
                    {unread}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.from === "system") {
    return (
      <div className="py-0.5 text-center">
        <span className="font-mono text-[10px] text-[var(--pixel-muted)]">{message.text}</span>
      </div>
    );
  }
  const isMe = message.from === "me";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 font-mono text-xs ${
          isMe
            ? "rounded-br-sm bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
            : "rounded-bl-sm border border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] text-[var(--pixel-text)]"
        }`}
      >
        {message.text}
      </div>
    </motion.div>
  );
}
