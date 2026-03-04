"use client";

import React, { useEffect, useMemo, useRef } from "react";

type ItemSpec = {
  id: string;
  text: string;
  // 初始（“原位”）位置：盒子内容区内坐标（px）
  x: number;
  y: number;
};

type Vec2 = { x: number; y: number };

type Particle = {
  id: string;
  text: string;

  // 当前状态
  p: Vec2;
  v: Vec2;

  // 原位（锚点）
  rest: Vec2;

  // 半径（用于粗略碰撞）
  r: number;

  // 渲染节点引用
  el: HTMLSpanElement | null;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function PhysicsTerminalBox(props: {
  className?: string;
  width?: number; // 外框宽（px）
  height?: number; // 外框高（px）
  padding?: number; // 内容 padding
  items?: ItemSpec[];
  title?: string;
}) {
  const {
    className,
    width = 860,
    height = 520,
    padding = 24,
    title = "TERMINAL",
  } = props;

  // 你可以替换成自己的 items（字/图标都行）
  const items: ItemSpec[] = useMemo(() => {
    return (
      props.items ?? [
        { id: "a", text: "> whoami", x: 24, y: 24 },
        { id: "b", text: "Wenqian Zhang", x: 24, y: 56 },
        { id: "c", text: "> role", x: 24, y: 104 },
        { id: "d", text: "Ph.D. Candidate @ UNSW", x: 24, y: 136 },
        { id: "e", text: "> research", x: 24, y: 184 },
        { id: "f", text: "Large-Scale Graph Analysis", x: 24, y: 216 },
        { id: "g", text: "SIGMOD 2025 | SIGMOD 2026", x: 24, y: 248 },
        { id: "h", text: "> status", x: 24, y: 296 },
        { id: "i", text: "READY", x: 24, y: 328 },
        { id: "j", text: "★", x: 520, y: 96 },
        { id: "k", text: "◎", x: 640, y: 180 },
        { id: "l", text: "⚑", x: 700, y: 280 },
      ]
    );
  }, [props.items]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  // 盒子拖拽状态
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  // 盒子位置、速度、加速度（用于“晃动/惯性”）
  const boxPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxAccRef = useRef<Vec2>({ x: 0, y: 0 });

  const lastPointerRef = useRef<Vec2>({ x: 0, y: 0 });
  const lastTimeRef = useRef<number>(0);

  // 模拟参数（可调）
  const paramsRef = useRef({
    gravity: 2200, // px/s^2 向下
    bounce: 0.45, // 碰撞反弹系数
    airDrag: 0.985, // 空气阻尼（每帧乘）
    floorFriction: 0.92, // 在底边摩擦
    // 回到原位的弹簧（松手后更强；拖拽中更弱）
    springKIdle: 90, // N-ish
    springKDrag: 18,
    dampC: 14, // 阻尼系数（与速度成正比）
    // 晃动强度：终端加速度注入到粒子
    inertialGain: 1.0,
    // 松手瞬间“回弹”更像橡皮：给一点额外收敛
    snapBoost: 1.15,
  });

  // 初始化粒子
  useEffect(() => {
    const ps: Particle[] = items.map((it) => {
      // 粗略半径：跟文字长度相关（更像“字块”）
      const approxW = Math.max(10, it.text.length * 8);
      const r = clamp(approxW * 0.42, 10, 38);

      return {
        id: it.id,
        text: it.text,
        p: { x: it.x, y: it.y },
        v: { x: 0, y: 0 },
        rest: { x: it.x, y: it.y },
        r,
        el: null,
      };
    });
    particlesRef.current = ps;
  }, [items]);

  // 绑定/更新 DOM 引用
  const setParticleEl = (id: string) => (el: HTMLSpanElement | null) => {
    const p = particlesRef.current.find((x) => x.id === id);
    if (p) p.el = el;
  };

  // 指针拖拽：移动盒子，同时记录速度/加速度用于“晃动”
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const onPointerDown = (e: PointerEvent) => {
      // 只允许主键
      if (pointerIdRef.current != null) return;

      pointerIdRef.current = e.pointerId;
      draggingRef.current = true;
      box.setPointerCapture(e.pointerId);

      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      lastTimeRef.current = performance.now();

      // 拖拽开始时，避免突然注入巨大加速度
      boxVelRef.current = { x: 0, y: 0 };
      boxAccRef.current = { x: 0, y: 0 };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      if (pointerIdRef.current !== e.pointerId) return;

      const now = performance.now();
      const dt = Math.max(1 / 240, (now - lastTimeRef.current) / 1000);

      const prev = lastPointerRef.current;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;

      // 更新盒子位置（直接位移）
      const bp = boxPosRef.current;
      bp.x += dx;
      bp.y += dy;
      boxPosRef.current = bp;

      // 速度/加速度
      const newVel = { x: dx / dt, y: dy / dt };
      const prevVel = boxVelRef.current;
      const newAcc = { x: (newVel.x - prevVel.x) / dt, y: (newVel.y - prevVel.y) / dt };
      boxVelRef.current = newVel;
      boxAccRef.current = newAcc;

      // 写 transform
      box.style.transform = `translate3d(${bp.x}px, ${bp.y}px, 0)`;

      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      lastTimeRef.current = now;
    };

    const endDrag = (e: PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;

      draggingRef.current = false;
      pointerIdRef.current = null;

      // 松手瞬间：给粒子一个“回弹收敛”boost（更像弹性回位）
      const P = particlesRef.current;
      const snap = paramsRef.current.snapBoost;
      for (const p of P) {
        p.v.x *= snap;
        p.v.y *= snap;
      }

      try {
        box.releasePointerCapture(e.pointerId);
      } catch {}
    };

    box.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      box.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  // 主循环：物理积分 + 边界碰撞 + DOM 更新（不触发 React rerender）
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let alive = true;

    const tick = (t: number) => {
      if (!alive) return;

      const lastT = lastTimeRef.current || t;
      const dt = clamp((t - lastT) / 1000, 1 / 240, 1 / 30);
      lastTimeRef.current = t;

      const { gravity, bounce, airDrag, floorFriction, springKIdle, springKDrag, dampC, inertialGain } =
        paramsRef.current;

      // 内容区域边界（盒子内部坐标）
      const rect = content.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      // 拖拽时：粒子更“散”，回原位更弱；松手：回弹更强
      const k = draggingRef.current ? springKDrag : springKIdle;

      // 终端加速度（屏幕系） -> 在终端内部参考系里等效为惯性力 -acc
      const accBox = boxAccRef.current;
      const inertial = { x: -accBox.x * inertialGain, y: -accBox.y * inertialGain };

      const P = particlesRef.current;

      for (const p of P) {
        // 弹簧回原位：F = k*(rest - p) - c*v
        const dx = p.rest.x - p.p.x;
        const dy = p.rest.y - p.p.y;

        const axSpring = k * dx - dampC * p.v.x;
        const aySpring = k * dy - dampC * p.v.y;

        // 重力 + 惯性（晃动注入） + 弹簧
        const ax = axSpring + inertial.x;
        const ay = aySpring + inertial.y + gravity;

        // 半隐式欧拉
        p.v.x += ax * dt;
        p.v.y += ay * dt;

        p.v.x *= airDrag;
        p.v.y *= airDrag;

        p.p.x += p.v.x * dt;
        p.p.y += p.v.y * dt;

        // 与盒子边界碰撞（圆形粒子 vs AABB）
        const r = p.r;

        // 左
        if (p.p.x < r) {
          p.p.x = r;
          p.v.x = -p.v.x * bounce;
        }
        // 右
        if (p.p.x > W - r) {
          p.p.x = W - r;
          p.v.x = -p.v.x * bounce;
        }
        // 上
        if (p.p.y < r) {
          p.p.y = r;
          p.v.y = -p.v.y * bounce;
        }
        // 下
        if (p.p.y > H - r) {
          p.p.y = H - r;
          p.v.y = -p.v.y * bounce;
          p.v.x *= floorFriction; // 落地摩擦
        }

        // 写 DOM transform（用 translate3d 更稳）
        if (p.el) {
          p.el.style.transform = `translate3d(${p.p.x}px, ${p.p.y}px, 0)`;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className={
        "select-none touch-none " +
        (className ?? "")
      }
      style={{
        width,
        height,
        // transform 由拖拽逻辑写入
        willChange: "transform",
      }}
    >
      {/* 终端外观你可以换成你现有的像素风框 */}
      <div
        className="w-full h-full border-2 border-[rgba(0,255,136,0.35)] bg-[rgba(10,16,12,0.92)] shadow-[0_0_30px_rgba(0,255,136,0.15)]"
        style={{ borderRadius: 10, overflow: "hidden" }}
      >
        <div className="h-10 px-3 flex items-center gap-2 border-b-2 border-[rgba(0,255,136,0.25)] bg-[rgba(10,16,12,0.98)]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-sm bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-sm bg-[#27c93f]" />
          </div>
          <div className="text-[10px] tracking-widest text-[rgba(0,255,136,0.9)] font-mono">
            {title} — DRAG ME
          </div>
        </div>

        {/* 内容区：粒子在这里面碰撞 */}
        <div
          ref={contentRef}
          className="relative w-full h-[calc(100%-40px)]"
          style={{ padding }}
        >
          {/* 粒子层 */}
          {items.map((it) => (
            <span
              key={it.id}
              ref={setParticleEl(it.id)}
              className="absolute left-0 top-0 inline-block font-mono text-[14px] text-[rgba(0,255,136,0.95)]"
              style={{
                transform: `translate3d(${it.x}px, ${it.y}px, 0)`,
                willChange: "transform",
                userSelect: "none",
                whiteSpace: "pre",
                // 让“字块”更像实体
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(0,255,136,0.06)",
                border: "1px solid rgba(0,255,136,0.14)",
                boxShadow: "0 0 10px rgba(0,255,136,0.08)",
              }}
            >
              {it.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}