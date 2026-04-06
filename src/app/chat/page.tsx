"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import { formatClockTime } from "../../features/p2p/lib/p2p";
import { useChat } from "./hooks/useChat";
import ShareButton from "../components/ShareButton";

const CONNECTION_DESCRIPTION = [
  "> Same P2P layer can be mounted under other routes for mini-games, whiteboards, or co-op demos.",
  "> Error, timeout, and disconnect states are now explicit rather than leaving the UI half-locked.",
  "> Code input is stateless from the connection lifecycle, so retries are predictable.",
];

export default function ChatPage() {
  const {
    messages, inputText, setInputText,
    encryptionReady, messagesEndRef,
    handleSendMessage,
    phase, localPeerId, remotePeerId, error, isConnected, roomCode,
    connect, disconnect, clearError, retryLastConnection, reinitialize,
    joinPeerId,
  } = useChat();

  return (
    <div className="relative min-h-screen overflow-hidden text-[var(--pixel-text)]">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
        >
          ← BACK
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="P2P Chat"
          text="E2E encrypted peer-to-peer chat — browser-to-browser, no server required!"
        />
      </motion.div>

      <div className="container relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-3 py-6 md:px-4 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-5 text-center md:mb-8"
        >
          <h1 className="mb-3 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            P2P CHAT
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Reusable peer-to-peer session layer with explicit loading, retry, and disconnect handling.
          </p>
        </motion.div>

        <div className="w-full max-w-5xl">
          {!isConnected && (
            <P2PConnectionPanel
              localPeerId={localPeerId}
              phase={phase}
              connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
              error={error}
              description={CONNECTION_DESCRIPTION}
              autoConnectPeerId={joinPeerId}
              onConnect={connect}
              onRetry={retryLastConnection}
              onClearError={clearError}
              onReinitialize={reinitialize}
              roomCode={roomCode}
            />
          )}

          {isConnected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="overflow-hidden rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-xl shadow-[var(--pixel-glow)]"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 animate-pulse bg-[var(--pixel-accent)]" />
                    <div className="h-3 w-3 bg-[var(--pixel-accent-2)]" />
                    <div className="h-3 w-3 bg-[var(--pixel-warn)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-accent)] md:text-[10px]">
                      CONNECTED TO {remotePeerId ?? "UNKNOWN"}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-[var(--pixel-muted)]">
                      Local: {localPeerId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`border px-2 py-1 font-sans font-semibold text-[9px] tracking-tight md:text-[10px] ${
                      encryptionReady
                        ? "border-[var(--pixel-accent)] text-[var(--pixel-accent)]"
                        : "border-[var(--pixel-warn)] text-[var(--pixel-warn)]"
                    }`}
                  >
                    {encryptionReady ? "E2EE READY" : "WAITING FOR KEY"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={disconnect}
                  className="rounded-xl border border-[var(--pixel-warn)] px-3 py-2 font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-warn)] transition-colors hover:bg-[var(--pixel-warn)] hover:text-[var(--pixel-bg)]"
                >
                  DISCONNECT
                </button>
              </div>

              {/* Messages */}
              <div className="h-[48vh] overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-4 py-5 [scrollbar-color:var(--pixel-accent)_var(--pixel-bg)] [scrollbar-width:thin] md:h-[520px] md:px-6 md:py-6">
                {messages.length === 0 && (
                  <div className="rounded-none border border-dashed border-[var(--pixel-border)] p-6 text-center">
                    <p className="font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-accent)] md:text-[10px]">
                      CHANNEL READY
                    </p>
                    <p className="mt-2 font-mono text-sm text-[var(--pixel-muted)]">
                      The P2P data channel is open. Waiting for key handshake to secure messages.
                    </p>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      className={`mb-4 flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] border px-4 py-3 ${
                          message.sender === "me"
                            ? "rounded-xl rounded-tr-sm border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                            : "rounded-xl rounded-tl-sm border-[var(--pixel-accent-2)] bg-[var(--pixel-bg)] text-[var(--pixel-accent-2)]"
                        }`}
                      >
                        <p className="font-mono text-sm leading-6 md:text-base">{message.text}</p>
                        <p className="mt-2 font-mono text-[10px] opacity-70 md:text-xs">
                          {formatClockTime(message.timestamp)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-4 md:px-5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="h-12 flex-1 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 font-mono text-sm text-[var(--pixel-text)] focus:outline-none focus:shadow-xl focus:shadow-[var(--pixel-glow)] md:text-base"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 font-sans font-semibold text-[9px] tracking-tight text-[var(--pixel-bg)] transition-transform hover:scale-[1.03] md:px-5 md:text-[10px]"
                  >
                    SEND
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
