"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Peer, { DataConnection } from "peerjs";
import Link from "next/link";

type Message = {
  id: string;
  text: string;
  sender: "me" | "peer";
  timestamp: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
};

export default function ChatPage() {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerId, setRemotePeerId] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleIdRef = useRef(0);

  // 初始化 Peer
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
      setConnectionStatus("idle");
    });

    peer.on("connection", (conn) => {
      connRef.current = conn;
      setupConnection(conn);
      setConnected(true);
      setConnectionStatus("connected");
      createConnectionParticles();
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setConnectionStatus("error");
    });

    return () => {
      peer.destroy();
    };
  }, []);

  const setupConnection = (conn: DataConnection) => {
    conn.on("data", (data) => {
      const msg = data as { text: string; timestamp: number };
      const newMessage: Message = {
        id: `${Date.now()}-${Math.random()}`,
        text: msg.text,
        sender: "peer",
        timestamp: msg.timestamp,
      };
      setMessages((prev) => [...prev, newMessage]);
      createMessageParticles();
    });

    conn.on("close", () => {
      setConnected(false);
      setConnectionStatus("idle");
    });
  };

  const connectToPeer = useCallback(() => {
    if (!peerRef.current || !remotePeerId.trim()) return;
    
    setConnectionStatus("connecting");
    const conn = peerRef.current.connect(remotePeerId.trim());
    connRef.current = conn;

    conn.on("open", () => {
      setConnected(true);
      setConnectionStatus("connected");
      setupConnection(conn);
      createConnectionParticles();
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
      setConnectionStatus("error");
      setTimeout(() => setConnectionStatus("idle"), 2000);
    });
  }, [remotePeerId]);

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !connRef.current) return;

    const msg = {
      text: inputText.trim(),
      timestamp: Date.now(),
    };

    connRef.current.send(msg);

    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      text: msg.text,
      sender: "me",
      timestamp: msg.timestamp,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    createMessageParticles();
  }, [inputText]);

  const createConnectionParticles = () => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        maxLife: 1,
        color: `hsl(${160 + Math.random() * 40}, 80%, 60%)`,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  const createMessageParticles = () => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: Math.random() * window.innerWidth,
        y: window.innerHeight * 0.8,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3 - 1,
        life: 1,
        maxLife: 1,
        color: `hsl(${280 + Math.random() * 40}, 70%, 65%)`,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  // 粒子动画循环
  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setParticles((prev) => {
        return prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 0.01,
          }))
          .filter((p) => p.life > 0);
      });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // 绘制粒子到 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [particles]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 overflow-hidden">
      {/* 背景粒子 Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* 背景网格动画 */}
      <div className="fixed inset-0 z-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }} />
      </div>

      {/* 返回按钮 */}
      <Link href="/">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-6 left-6 z-50 px-4 py-2 bg-purple-600/20 backdrop-blur-md border border-purple-400/30 rounded-lg text-purple-200 hover:bg-purple-600/30 transition-all duration-300 flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-300">←</span>
          <span className="font-mono text-sm">Back Home</span>
        </motion.button>
      </Link>

      {/* 主容器 */}
      <div className="relative z-10 container mx-auto px-4 py-8 h-screen flex flex-col">
        {/* 标题区域 */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
              style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Quantum Chat
          </h1>
          <p className="text-purple-300/80 font-mono text-sm md:text-base">
            Peer-to-Peer Encrypted Communication
          </p>
        </motion.div>

        {/* 连接区域 */}
        {!connected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto w-full mb-8"
          >
            <div className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-2xl shadow-purple-500/20">
              {/* Your ID */}
              <div className="mb-6">
                <label className="block text-cyan-400 font-mono text-sm mb-2">Your Peer ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={peerId}
                    readOnly
                    className="w-full px-4 py-3 bg-slate-950/80 border border-cyan-500/40 rounded-lg text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                    placeholder="Generating..."
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(peerId);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 rounded text-cyan-300 text-xs transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Connect to Peer */}
              <div className="mb-6">
                <label className="block text-purple-400 font-mono text-sm mb-2">Connect to Peer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={remotePeerId}
                    onChange={(e) => setRemotePeerId(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && connectToPeer()}
                    className="flex-1 px-4 py-3 bg-slate-950/80 border border-purple-500/40 rounded-lg text-purple-300 font-mono text-sm focus:outline-none focus:border-purple-400 transition-colors"
                    placeholder="Enter peer ID..."
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={connectToPeer}
                    disabled={connectionStatus === "connecting"}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-mono text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-purple-500/50"
                  >
                    {connectionStatus === "connecting" ? "..." : "Connect"}
                  </motion.button>
                </div>
              </div>

              {/* Status */}
              <AnimatePresence>
                {connectionStatus === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-red-400 text-sm font-mono text-center"
                  >
                    ⚠ Connection failed. Please check the peer ID.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* 聊天区域 */}
        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 flex flex-col max-w-4xl mx-auto w-full"
          >
            {/* 连接状态指示器 */}
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 font-mono text-sm">Connected</span>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 bg-slate-900/40 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-4 md:p-6 overflow-y-auto mb-4 shadow-2xl shadow-purple-500/10">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className={`mb-4 flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                        msg.sender === "me"
                          ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                          : "bg-slate-800/80 text-cyan-100 border border-cyan-500/20 shadow-lg shadow-cyan-500/10"
                      }`}
                    >
                      <p className="font-mono text-sm md:text-base break-words">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.sender === "me" ? "text-purple-200" : "text-cyan-400/60"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 px-4 py-3 bg-slate-950/80 backdrop-blur-md border border-purple-500/40 rounded-xl text-purple-100 font-mono text-sm focus:outline-none focus:border-purple-400 transition-colors shadow-lg"
                placeholder="Type your message..."
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendMessage}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl text-white font-mono font-bold transition-all duration-300 shadow-lg shadow-purple-500/50"
              >
                Send
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        
        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        /* 自定义滚动条 */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
}
