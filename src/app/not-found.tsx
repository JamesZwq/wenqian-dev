'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Home, MoveLeft, Terminal, Share2, Binary, Cpu, Network } from 'lucide-react';

/**
 * 背景组件：动态图结构 (Dynamic Graph Structure)
 * 象征着文谦在图论和分布式系统领域的研究背景
 */
const GraphBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);
    resize();

    // 初始化节点
    const nodeCount = 45;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // 绘制连线：体现图论中的边
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        n1.x += n1.vx;
        n1.y += n1.vy;

        // 边界碰撞检查
        if (n1.x < 0 || n1.x > width) n1.vx *= -1;
        if (n1.y < 0 || n1.y > height) n1.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - dist / 180)})`;
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // 绘制节点：体现图论中的顶点
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />;
};

export default function NotFound() {
  const [text, setText] = useState('');
  const fullText = "Status: Node Pruned. Error 404: Requested vertex is outside the k-core.";
  
  // 模拟终端打字机效果
  useEffect(() => {
    let currentIndex = 0;
    const timer = setInterval(() => {
      setText(fullText.slice(0, currentIndex));
      currentIndex++;
      if (currentIndex > fullText.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100 font-mono flex flex-col items-center justify-center p-6 transition-colors duration-500 overflow-hidden relative selection:bg-blue-500/30">
      <GraphBackground />

      {/* 顶部标识符 */}
      <div className="absolute top-8 left-8 flex items-center gap-3 opacity-60">
        <Cpu size={18} className="text-blue-500" />
        <span className="text-xs font-bold tracking-[0.3em] uppercase">Wenqian_Zhang // Node_Explorer</span>
      </div>

      <main className="relative z-10 max-w-2xl w-full">
        <div className="relative mb-16">
          {/* 背景装饰数字 */}
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none select-none tracking-tighter opacity-5 dark:opacity-10 absolute -top-20 left-1/2 -translate-x-1/2 italic">
            404
          </h1>

          {/* 终端卡片 */}
          <div className="relative bg-white/40 dark:bg-zinc-900/60 backdrop-blur-2xl border border-slate-200 dark:border-zinc-800 p-6 md:p-10 rounded-3xl shadow-2xl shadow-blue-500/5 overflow-hidden group">
            <div className="flex gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-400/50" />
              <div className="w-3 h-3 rounded-full bg-amber-400/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <Terminal size={22} className="mt-1 text-blue-500 shrink-0" />
                <div className="text-lg md:text-xl font-medium leading-relaxed">
                  <span className="text-blue-500 font-bold">$ </span>
                  {text}
                  <span className="inline-block w-2 h-5 ml-1 bg-blue-500 animate-pulse align-middle" />
                </div>
              </div>

              <div className="pl-8 py-4 border-l-2 border-slate-200 dark:border-zinc-800 space-y-3">
                <p className="text-slate-500 dark:text-zinc-400 text-sm italic leading-relaxed">
                  "抱歉，你正在访问的路径（节点）已从全局图中丢失。它可能在上一轮的 Core Decomposition 过程中被作为孤立分量剔除，或者从未存在于这个 Billion-Scale 图形中。"
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] rounded uppercase font-bold tracking-wider">Vertex_Missing</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 text-[10px] rounded uppercase font-bold tracking-wider">Unreachable_Path</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 交互导航：在实际项目中建议把 <a> 换回 <Link> */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a 
            href="/"
            className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all duration-300 shadow-xl shadow-blue-600/20 active:scale-95 w-full sm:w-auto justify-center"
          >
            <Home size={18} />
            <span className="font-bold">重新连接主图 (Home)</span>
            <MoveLeft size={18} className="rotate-180 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
          </a>
          
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-3 px-8 py-4 bg-transparent border border-slate-200 dark:border-zinc-800 hover:border-blue-500 text-slate-600 dark:text-zinc-300 rounded-2xl transition-all duration-300 active:scale-95 w-full sm:w-auto justify-center"
          >
            <Network size={18} className="text-blue-500" />
            <span className="font-bold">回退上一跳 (Back)</span>
          </button>
        </div>
      </main>

      {/* 底部信息栏 */}
      <footer className="absolute bottom-8 w-full px-8 flex flex-col items-center gap-4 opacity-40">
        <div className="flex items-center gap-6 text-[10px] tracking-[0.4em] uppercase font-bold">
          <span className="flex items-center gap-2"><Binary size={12} className="text-blue-500"/> ICDM</span>
          <span className="flex items-center gap-2"><Share2 size={12} className="text-blue-500"/> SIGMOD</span>
          <span className="flex items-center gap-2"><Network size={12} className="text-blue-500"/> UNSW PhD</span>
        </div>
        <p className="text-[10px] text-center">
          DECENTRALIZED ERROR MANAGEMENT SYSTEM // © 2024 WENQIAN ZHANG
        </p>
      </footer>

      {/* 浮动算法装饰 */}
      <div className="absolute -left-24 bottom-1/4 -rotate-90 opacity-[0.03] select-none pointer-events-none hidden xl:block">
        <pre className="text-xs">
          {`
            while (V.isNotEmpty()) {
              node = V.pop();
              if (deg(node) < k) {
                G.remove(node); // 404 Triggered
                notifyNeighbors(node);
              }
            }
          `}
        </pre>
      </div>
    </div>
  );
}
