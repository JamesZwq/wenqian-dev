"use client";

import { useEffect, useRef } from "react";

type Piece = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: "black" | "white";
  r: number;
  rotation: number;
  rotationSpeed: number;
};

interface GomokuExplosionProps {
  pieces: Array<{ x: number; y: number; color: "black" | "white" }>;
  onComplete: () => void;
  centerX: number;
  centerY: number;
}

export default function GomokuExplosion({ pieces, onComplete, centerX, centerY }: GomokuExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // 创建物理棋子
    const physicsPieces: Piece[] = pieces.map((p, i) => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const dist = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);
      
      // 添加一些随机抖动
      const jitter = (Math.random() - 0.5) * 0.5;
      const finalAngle = angle + jitter;
      
      // 爆炸速度：距离越远，速度越大
      const baseSpeed = 300 + dist * 1.5;
      const speed = baseSpeed * (0.8 + Math.random() * 0.4);
      
      return {
        id: i,
        x: p.x,
        y: p.y,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
        color: p.color,
        r: 13, // 棋子半径
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      };
    });

    const GRAVITY = 800;
    const DURATION = 1500; // 1.5秒动画
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const dt = 1 / 60; // 固定时间步长

      if (elapsed >= DURATION) {
        onComplete();
        return;
      }

      // 清空画布
      ctx.clearRect(0, 0, rect.width, rect.height);

      // 更新和绘制每个棋子
      physicsPieces.forEach((piece) => {
        // 物理更新
        piece.vy += GRAVITY * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rotation += piece.rotationSpeed * dt;

        // 空气阻力
        piece.vx *= 0.99;
        piece.vy *= 0.99;

        // 透明度渐变（最后500ms淡出）
        const fadeStart = DURATION - 500;
        const alpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / 500 : 1;

        // 绘制棋子
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);

        // 绘制圆形棋子
        ctx.beginPath();
        ctx.arc(0, 0, piece.r, 0, Math.PI * 2);
        ctx.fillStyle = piece.color === "black" ? "#000000" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = piece.color === "black" ? "#333333" : "#cccccc";
        ctx.lineWidth = 1;
        ctx.stroke();

        // 添加高光效果
        if (piece.color === "white") {
          ctx.beginPath();
          ctx.arc(-piece.r * 0.3, -piece.r * 0.3, piece.r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fill();
        }

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [pieces, onComplete, centerX, centerY]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
