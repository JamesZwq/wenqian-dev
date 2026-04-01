"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useIsMobileContext } from "./IsMobileContext";

// ------------------------------------------------------------
// Tiny hand-rolled 2D physics (circle bodies + spatial hash)
// ------------------------------------------------------------

type Vec2 = { x: number; y: number };

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

type ColorKey = "accent" | "accent2" | "warn" | "text";
type Palette = Record<ColorKey, string>;

type Body = {
  key: string;
  id: number;
  ch: string;
  ck: ColorKey;

  x: number;
  y: number;
  vx: number;
  vy: number;

  hx: number;
  hy: number;

  r: number;
  fs: number;
  invM: number;
};

type World = {
  w: number;
  h: number;
  bodies: Body[];
  nextId: number;

  axExt: number;
  ayExt: number;

  gravityOn: boolean;
  collisionsOn: boolean;
  returnAlpha: number;
  isClearing: boolean; 
};

const OFFSET = 32768;

function packKey(cx: number, cy: number) {
  return (((cx + OFFSET) & 0xffff) << 16) | ((cy + OFFSET) & 0xffff);
}

function unpackKey(key: number): { cx: number; cy: number } {
  const cx = ((key >>> 16) & 0xffff) - OFFSET;
  const cy = (key & 0xffff) - OFFSET;
  return { cx, cy };
}

// 复用 Map 和数组，避免每帧 GC
const _shGrid = new Map<number, number[]>();
const _shPool: number[][] = [];

function buildSpatialHash(bodies: Body[], cell: number) {
  // 回收旧数组到池
  for (const arr of _shGrid.values()) {
    arr.length = 0;
    _shPool.push(arr);
  }
  _shGrid.clear();

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const cx = Math.floor(b.x / cell);
    const cy = Math.floor(b.y / cell);
    const key = packKey(cx, cy);
    let arr = _shGrid.get(key);
    if (!arr) {
      arr = _shPool.pop() || [];
      _shGrid.set(key, arr);
    }
    arr.push(i);
  }
  return _shGrid;
}

function resolveCircleCircle(a: Body, b: Body, restitution: number, mu: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const r = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r || d2 === 0) return;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;

  const penetration = r - d;
  const invMassSum = a.invM + b.invM;
  if (invMassSum <= 0) return;

  const slop = 0.3;
  const percent = 0.85;
  const corr = Math.max(0, penetration - slop) * (percent / invMassSum);
  a.x -= nx * corr * a.invM;
  a.y -= ny * corr * a.invM;
  b.x += nx * corr * b.invM;
  b.y += ny * corr * b.invM;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;

  const jn = (-(1 + restitution) * vn) / invMassSum;
  const impNx = nx * jn;
  const impNy = ny * jn;
  a.vx -= impNx * a.invM;
  a.vy -= impNy * a.invM;
  b.vx += impNx * b.invM;
  b.vy += impNy * b.invM;

  const tvx = rvx - vn * nx;
  const tvy = rvy - vn * ny;
  const tLen = Math.hypot(tvx, tvy);
  if (tLen < 1e-6) return;
  const tx = tvx / tLen;
  const ty = tvy / tLen;

  const vt = rvx * tx + rvy * ty;
  let jt = -vt / invMassSum;
  const maxFric = mu * jn;
  jt = clamp(jt, -maxFric, maxFric);

  const impTx = tx * jt;
  const impTy = ty * jt;
  a.vx -= impTx * a.invM;
  a.vy -= impTy * a.invM;
  b.vx += impTx * b.invM;
  b.vy += impTy * b.invM;
}

function resolveWalls(b: Body, w: number, h: number, restitution: number, wallFriction: number) {
  if (b.x - b.r < 0) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * restitution; b.vy *= 1 - wallFriction; }
  if (b.x + b.r > w) { b.x = w - b.r; if (b.vx > 0) b.vx = -b.vx * restitution; b.vy *= 1 - wallFriction; }
  if (b.y - b.r < 0) { b.y = b.r; if (b.vy < 0) b.vy = -b.vy * restitution; b.vx *= 1 - wallFriction; }
  if (b.y + b.r > h) { b.y = h - b.r; if (b.vy > 0) b.vy = -b.vy * restitution; b.vx *= 1 - wallFriction; }
}

function stepWorld(world: World, dt: number) {
  const bodies = world.bodies;
  const GRAV = 1500;
  const airDrag = 1.05;
  const maxSpeed = 3500; 
  const restitution = 0.42;
  const mu = 0.25;
  const wallFriction = 0.05;
  const k = 220;
  const c = 30;
  const ayG = world.gravityOn ? GRAV : 0;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    let ax = world.axExt;
    let ay = world.ayExt + ayG;

    if (world.returnAlpha > 0) {
      const alpha = world.returnAlpha;
      const dx = b.x - b.hx;
      const dy = b.y - b.hy;
      ax += (-k * dx - c * b.vx) * alpha;
      ay += (-k * dy - c * b.vy) * alpha;
    }

    b.vx += ax * dt;
    b.vy += ay * dt;
    const drag = Math.exp(-airDrag * dt);
    b.vx *= drag; b.vy *= drag;

    const sp = Math.hypot(b.vx, b.vy);
    if (sp > maxSpeed) {
      const s = maxSpeed / sp;
      b.vx *= s; b.vy *= s;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    
    if (!world.isClearing) {
      resolveWalls(b, world.w, world.h, restitution, wallFriction);
    }
  }

  if (!world.collisionsOn) return;

  let maxR = 0;
  for (let i = 0; i < bodies.length; i++) maxR = Math.max(maxR, bodies[i].r);
  const cell = Math.max(12, maxR * 2.6);

  const grid = buildSpatialHash(bodies, cell);
  const neighborOffsets = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]] as const;

  const iters = 2;
  for (let iter = 0; iter < iters; iter++) {
    for (const [key, indices] of grid.entries()) {
      const { cx, cy } = unpackKey(key);
      for (let ii = 0; ii < indices.length; ii++) {
        const a = bodies[indices[ii]];
        for (let jj = ii + 1; jj < indices.length; jj++) {
          resolveCircleCircle(a, bodies[indices[jj]], restitution, mu);
        }
      }
      for (let kOff = 1; kOff < neighborOffsets.length; kOff++) {
        const off = neighborOffsets[kOff];
        const nk = packKey(cx + off[0], cy + off[1]);
        const nIdx = grid.get(nk);
        if (!nIdx) continue;
        for (let ii = 0; ii < indices.length; ii++) {
          const a = bodies[indices[ii]];
          for (let jj = 0; jj < nIdx.length; jj++) {
            resolveCircleCircle(a, bodies[nIdx[jj]], restitution, mu);
          }
        }
      }
    }
  }

  for (let i = 0; i < bodies.length; i++) {
    if (!world.isClearing) {
      resolveWalls(bodies[i], world.w, world.h, restitution, wallFriction);
    }
  }
}

// ------------------------------------------------------------
// Layout Generators (Static ASCII + Dynamic Text)
// ------------------------------------------------------------

const ASCII_ART = `
  ██╗    ██╗███████╗███╗   ██╗ ██████╗ ██╗ █████╗ ███╗   ██╗
  ██║    ██║██╔════╝████╗  ██║██╔═══██╗██║██╔══██╗████╗  ██║
  ██║ █╗ ██║█████╗  ██╔██╗ ██║██║   ██║██║███████║██╔██╗ ██║
  ██║███╗██║██╔══╝  ██║╚██╗██║██║▄▄ ██║██║██╔══██║██║╚██╗██║
  ╚███╔███╔╝███████╗██║ ╚████║╚██████╔╝██║██║  ██║██║ ╚████║
   ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝ ╚══▀▀═╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
`;

function buildAsciiBodies(world: World, pad: number, isSm: boolean, isMd: boolean) {
  const asciiFont = isMd ? 10 : isSm ? 8 : 6;
  const asciiCW = asciiFont * 0.62;
  const asciiLH = asciiFont * 1.25;
  const asciiR = Math.max(1.8, asciiCW * 0.46);
  const asciiLines = ASCII_ART.trimEnd().split("\n");

  let y = pad + asciiFont;
  for (let li = 0; li < asciiLines.length; li++) {
    const line = asciiLines[li];
    let x = pad;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch !== " ") {
        world.bodies.push({
          key: `ascii_${li}_${ci}`, id: world.nextId++,
          ch, ck: "accent", x, y, vx: 0, vy: 0, hx: x, hy: y,
          r: asciiR, fs: asciiFont, invM: 1,
        });
      }
      x += asciiCW;
    }
    y += asciiLH;
  }
  return y + (isSm ? 24 : 16);
}

function syncTextBodies(world: World, history: string[], currentInput: string, promptStr: string, startY: number, pad: number, isSm: boolean, isMd: boolean, readOnly?: boolean) {
  const font = isMd ? 16 : isSm ? 14 : 12;
  const cw = font * 0.62;
  const lh = isMd ? 24 : isSm ? 20 : 16;
  const typedR = Math.max(2.6, cw * 0.46);

  const maxChars = Math.max(10, Math.floor((world.w - pad * 2) / cw));
  const rawLines = readOnly ? [...history] : [...history, `${promptStr}${currentInput}`];

  type RenderLine = { text: string; isCmd: boolean; originalIndex: number; subIndex: number };
  const wrappedLines: RenderLine[] = [];

  for (let li = 0; li < rawLines.length; li++) {
    const rawLine = rawLines[li];
    const isCmd = rawLine.startsWith("wenqian@unsw:");

    if (rawLine.length === 0) {
      wrappedLines.push({ text: "", isCmd, originalIndex: li, subIndex: 0 });
      continue;
    }

    let remaining = rawLine;
    let subIdx = 0;

    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        wrappedLines.push({ text: remaining, isCmd, originalIndex: li, subIndex: subIdx });
        break;
      }

      let breakPt = remaining.lastIndexOf(" ", maxChars);
      if (breakPt === -1 || breakPt === 0) breakPt = maxChars;

      wrappedLines.push({ text: remaining.slice(0, breakPt), isCmd, originalIndex: li, subIndex: subIdx++ });
      remaining = remaining.slice(breakPt).trimStart();
    }
  }

  const availableHeight = world.h - startY - pad;
  const maxLines = Math.max(1, Math.floor(availableHeight / lh));
  const displayLines = wrappedLines.slice(-maxLines);

  // Build a lookup map for O(1) body access instead of O(n) .find() per character
  const bodyMap = new Map<string, Body>();
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    if (b.key.startsWith('text_') || b.key === 'cursor') {
      bodyMap.set(b.key, b);
    }
  }

  const desiredKeys = new Set<string>();
  let y = startY;

  for (let i = 0; i < displayLines.length; i++) {
    const { text, isCmd, originalIndex, subIndex } = displayLines[i];
    let x = pad;
    const isCurrentInputLine = (originalIndex === rawLines.length - 1);
    const isLastSubLine = (i === displayLines.length - 1);

    for (let ci = 0; ci < text.length; ci++) {
      const ch = text[ci];
      if (ch !== " ") {
        const key = `text_${originalIndex}_${subIndex}_${ci}`;
        desiredKeys.add(key);

        const existing = bodyMap.get(key);
        if (existing) {
          existing.hx = x; existing.hy = y; existing.ch = ch; existing.ck = isCmd ? "accent2" : "accent";
        } else {
          world.bodies.push({
            key, id: world.nextId++, ch, ck: isCmd ? "accent2" : "accent",
            x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
            hx: x, hy: y, r: typedR, fs: font, invM: 1,
          });
        }
      }
      x += cw;
    }

    if (isCurrentInputLine && isLastSubLine) {
      const ux = x + Math.min(4, cw * 0.5);
      const key = `cursor`;
      desiredKeys.add(key);
      const existing = bodyMap.get(key);
      if (existing) {
        existing.hx = ux; existing.hy = y;
      } else {
        world.bodies.push({
          key, id: world.nextId++, ch: "_", ck: "warn",
          x: ux, y, vx: 0, vy: 0, hx: ux, hy: y, r: typedR, fs: font, invM: 1,
        });
      }
    }
    y += text.length === 0 ? Math.max(8, lh * 0.6) : lh;
  }

  world.bodies = world.bodies.filter(b => !b.key.startsWith('text_') && b.key !== 'cursor' || desiredKeys.has(b.key));
}

// ------------------------------------------------------------
// Utilities & Boot/Clear Animations
// ------------------------------------------------------------

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: pick("--pixel-accent", "#818cf8"), accent2: pick("--pixel-accent-2", "#a78bfa"),
    warn: pick("--pixel-warn", "#fbbf24"), text: pick("--pixel-text", "#e8e5f5"),
  };
}

const FALLBACK_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function hash01(n: number) { return (Math.sin(n * 999.123 + 0.12345) * 43758.5453) % 1; }
function smoothstep01(u: number) { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); }

function initBootExplosion(world: World) {
  const cx = world.w * 0.5; const cy = world.h * 0.5;
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    const r0 = 10 * Math.sqrt(Math.abs(hash01(b.id + 17)));
    const a0 = hash01(b.id + 91) * Math.PI * 2;
    b.x = cx + Math.cos(a0) * r0; b.y = cy + Math.sin(a0) * r0;

    const dx = b.hx - cx; const dy = b.hy - cy;
    const d = Math.hypot(dx, dy) || 1;
    let nx = dx / d; let ny = dy / d;

    const jitter = (hash01(b.id + 203) * 2 - 1) * 0.44;
    const cs = Math.cos(jitter); const sn = Math.sin(jitter);
    nx = nx * cs - ny * sn; ny = nx * sn + ny * cs;

    const base = clamp(d * 2.2 + 260, 420, 1750);
    const sp = base * (0.8 + 0.6 * hash01(b.id + 777));
    b.vx = nx * sp; b.vy = ny * sp;
  }
}

// 核心修改：接受光标的动态坐标作为震源
function initClearExplosion(world: World, cx: number, cy: number) {
  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];
    const dx = b.x - cx; 
    const dy = b.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    let nx = dx / d; let ny = dy / d;

    const jitter = (hash01(b.id + 404) * 2 - 1) * 0.5;
    const cs = Math.cos(jitter); const sn = Math.sin(jitter);
    nx = nx * cs - ny * sn; ny = nx * sn + ny * cs;

    const base = clamp(d * 2.0 + 1200, 1500, 3500); 
    const sp = base * (0.8 + 0.6 * hash01(b.id + 999));
    b.vx = nx * sp; b.vy = ny * sp;
  }
}

// 通用的冲击波绘制函数，支持自定义原点、最大半径和颜色
// 通用的冲击波绘制函数，支持自定义原点、最大半径和颜色
function drawShockwave(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number, elapsedMs: number, pal: Palette, colorKey: ColorKey) {
  const DUR = 700;
  const u = clamp(elapsedMs / DUR, 0, 1);
  if (u <= 0 || u >= 1) return;
  
  const eased = 1 - Math.pow(1 - u, 3);
  const r = eased * maxR;

  ctx.save();
  // 只保留向外扩散的线框圆环（冲击波）
  ctx.globalAlpha = 0.14 * (1 - u); 
  ctx.lineWidth = 2; 
  ctx.strokeStyle = pal[colorKey];
  ctx.beginPath(); 
  ctx.arc(cx, cy, r, 0, Math.PI * 2); 
  ctx.stroke();
  
  // 删除了原本在这里绘制中心实心圆圈 (ctx.fill) 的代码

  ctx.restore();
}

// ------------------------------------------------------------
// Virtual File System Mock
// ------------------------------------------------------------
const VFS_STRUCTURE: Record<string, { type: "dir", children: string[] }> = {
  "~": { type: "dir", children: ["about.txt", "resume.pdf", "research", "src"] },
  "~/research": { type: "dir", children: ["sigmod_2025.pdf", "icdm_workshop.pdf"] },
  "~/src": { type: "dir", children: ["core_decomp.cpp", "hypergraph.py"] },
};

const VFS_CONTENTS: Record<string, string> = {
  "~/about.txt": "Wenqian Zhang (张文谦)\nPh.D. Candidate @ UNSW. Strong coding ability & independent research formulation.",
  "~/resume.pdf": "[PDF Data corrupted... Just kidding, hire me!]",
  "~/src/core_decomp.cpp": "int main() { printf(\"Efficient Distributed Core Graph Decomposition\\n\"); return 0; }",
  "~/src/hypergraph.py": "def accelerate_core_decomposition():\n    print('Billion-Scale Hypergraphs Handled!')",
};

// ------------------------------------------------------------
// React Component
// ------------------------------------------------------------

export default function PhysicsTerminal({ className, title }: { className?: string; title?: string }) {
  const isMobile = useIsMobileContext();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [uiDragging, setUiDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [cwd, setCwd] = useState("~");
  
  const [history, setHistory] = useState<string[]>([
    "System Bootstrap...",
    "Loading User Profile...",
    "wenqian@unsw:~$ whoami",
    "Wenqian Zhang",
    "wenqian@unsw:~$ export MARITAL_STATUS=\"Married\"",
    "wenqian@unsw:~$ export WIFE=\"Kino\"",
    "wenqian@unsw:~$ role",
    "Ph.D. Candidate @ UNSW (Computer Science)",
    "wenqian@unsw:~$ education",
    "B.Sc. in CS (High Distinction) -> MPhil -> Ph.D. @ UNSW",
    "wenqian@unsw:~$ research",
    "• Accelerating Core Decomposition in Billion-Scale Hypergraphs [SIGMOD Accepted]",
    "• Efficient Distributed Core Graph Decomposition [ICDM Workshop]",
    "wenqian@unsw:~$ READY."
  ]);
  const [currentInput, setCurrentInput] = useState("");

  const dragRef = useRef({ active: false, pid: -1, sx: 0, sy: 0, tx: 0, ty: 0 });
  const boxPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxTargetRef = useRef<Vec2>({ x: 0, y: 0 });

  const worldRef = useRef<World | null>(null);
  const asciiBottomYRef = useRef<number>(0);
  
  const returnStartRef = useRef<number | null>(null);
  const bootStartRef = useRef<number | null>(null);
  
  const isClearingRef = useRef(false);
  const clearStartRef = useRef<number | null>(null);
  // 新增：记录清屏时的震源坐标
  const clearCenterRef = useRef<{x: number, y: number} | null>(null);

  const paletteRef = useRef<Palette>({ accent: "#818cf8", accent2: "#a78bfa", warn: "#fbbf24", text: "#e8e5f5" });
  const fontFamilyRef = useRef<string>(FALLBACK_FONT_FAMILY);

  useEffect(() => {
    const el = contentRef.current;
    const cvs = canvasRef.current;
    if (!el || !cvs) return;

    const ro = new ResizeObserver(() => {
      paletteRef.current = readPalette(el);
      fontFamilyRef.current = getComputedStyle(el).fontFamily || FALLBACK_FONT_FAMILY;

      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(rect.width * dpr));
      cvs.height = Math.max(1, Math.floor(rect.height * dpr));
      cvs.style.width = `${rect.width}px`;
      cvs.style.height = `${rect.height}px`;

      const w = rect.width;
      const h = rect.height;
      const isSm = w >= 640;
      const isMd = w >= 768;
      const pad = isMd ? 32 : isSm ? 24 : 16;

      const newWorld: World = { w, h, bodies: [], nextId: 0, axExt: 0, ayExt: 0, gravityOn: false, collisionsOn: false, returnAlpha: 1, isClearing: false };
      asciiBottomYRef.current = buildAsciiBodies(newWorld, pad, isSm, isMd);
      worldRef.current = newWorld;

      initBootExplosion(newWorld);
      bootStartRef.current = nowMs();
      returnStartRef.current = null;

      syncTextBodies(newWorld, history, currentInput, `wenqian@unsw:${cwd}$ `, asciiBottomYRef.current, pad, isSm, isMd, isMobile);
    });

    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const isSm = world.w >= 640;
    const isMd = world.w >= 768;
    const pad = isMd ? 32 : isSm ? 24 : 16;
    
    syncTextBodies(world, history, currentInput, `wenqian@unsw:${cwd}$ `, asciiBottomYRef.current, pad, isSm, isMd, isMobile);
    
    if (!dragRef.current.active && returnStartRef.current !== null && !isClearingRef.current) {
      returnStartRef.current = Math.max(returnStartRef.current, nowMs() - 250); 
    }
  }, [history, currentInput, cwd, isMobile]);

  const resolvePath = useCallback((current: string, target: string) => {
    if (!target || target === "~" || target === "/") return "~";
    if (target === ".") return current;
    if (target === "..") {
      if (current === "~") return "~";
      const parts = current.split('/');
      parts.pop();
      return parts.join('/') || "~";
    }
    const fullPath = target.startsWith("~/") ? target : (current === "~" ? `~/${target}` : `${current}/${target}`);
    return fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
  }, []);


  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    const promptStr = `wenqian@unsw:${cwd}$ `;
    
    if (!trimmed) {
      setHistory(prev => [...prev, promptStr]);
      return;
    }

    const newHistory = [...history, `${promptStr}${cmd}`];
    const args = trimmed.split(/\s+/);
    const baseCmd = args[0].toLowerCase();

    switch (baseCmd) {
      case "help":
        newHistory.push("Commands: whoami, role, education, research, clear, ls, pwd, cd, cat, sudo");
        break;
      case "whoami":
        newHistory.push("Wenqian Zhang");
        break;
      case "role":
        newHistory.push("Ph.D. Candidate @ UNSW");
        break;
      case "education":
        newHistory.push("B.Sc. in CS (High Distinction) -> MPhil -> Ph.D. @ UNSW");
        break;
      case "research":
        newHistory.push("• Accelerating Core Decomposition in Billion-Scale Hypergraphs [SIGMOD Accepted]");
        newHistory.push("• Efficient Distributed Core Graph Decomposition [ICDM Workshop]");
        break;
      case "pwd":
        newHistory.push(cwd.replace("~", "/home/wenqian"));
        break;
      case "ls":
        if (VFS_STRUCTURE[cwd]) {
          const files = VFS_STRUCTURE[cwd].children.map(f => VFS_STRUCTURE[`${cwd}/${f}`] ? `${f}/` : f);
          newHistory.push(files.join("    "));
        }
        break;
      case "cd":
        {
          const target = args[1];
          const newPath = resolvePath(cwd, target);
          if (VFS_STRUCTURE[newPath]) setCwd(newPath);
          else newHistory.push(`bash: cd: ${target}: No such file or directory`);
        }
        break;
      case "cat":
        {
          const target = args[1];
          if (!target) newHistory.push("cat: missing operand");
          else {
            const filePath = resolvePath(cwd, target);
            if (VFS_CONTENTS[filePath]) newHistory.push(...VFS_CONTENTS[filePath].split('\n'));
            else if (VFS_STRUCTURE[filePath]) newHistory.push(`cat: ${target}: Is a directory`);
            else newHistory.push(`cat: ${target}: No such file or directory`);
          }
        }
        break;
      case "sudo":
        newHistory.push("wenqian is not in the sudoers file. This incident will be reported.");
        break;
      case "clear":
        if (worldRef.current) {
          // 核心修改：在清除之前，找到物理世界中光标(cursor)的位置
          const cursor = worldRef.current.bodies.find(b => b.key === "cursor");
          // 如果找到了光标就以光标为中心，否则退回屏幕中央
          const cx = cursor ? cursor.x : worldRef.current.w / 2;
          const cy = cursor ? cursor.y : worldRef.current.h / 2;
          
          clearCenterRef.current = { x: cx, y: cy };
          initClearExplosion(worldRef.current, cx, cy);
        }
        isClearingRef.current = true;
        clearStartRef.current = nowMs();
        
        setTimeout(() => {
          setHistory([]);
          isClearingRef.current = false;
        }, 600);
        return; 
      default:
        newHistory.push(`bash: ${baseCmd}: command not found`);
    }
    setHistory(newHistory);
  }, [history, cwd, resolvePath]);

  useEffect(() => {
    if (isMobile) return; // 手机端只读，不监听键盘
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!hasInteracted) setHasInteracted(true);
      if (isClearingRef.current) {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleCommand(currentInput);
        setCurrentInput("");
      } else if (e.key === "Backspace") {
        setCurrentInput(prev => prev.slice(0, -1));
      } else if (e.key.length === 1) {
        if (e.key === " ") e.preventDefault();
        setCurrentInput(prev => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentInput, handleCommand, hasInteracted, isMobile]);


  // 物理渲染主循环
  useEffect(() => {
    let raf = 0; let last = nowMs(); let acc = 0;
    const FIXED_DT = 1 / 60; const SPRING_MAX_STEP = 1 / 120; const MAX_BOX_V = 6000;
    const cachedDpr = window.devicePixelRatio || 1;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      // Skip physics & rendering when tab hidden or scrolled far past hero
      if (document.hidden || window.scrollY > window.innerHeight * 1.3) {
        last = nowMs(); return;
      }
      const t = nowMs(); let dt = clamp((t - last) / 1000, 0, 0.033); last = t;

      const world = worldRef.current; const cvs = canvasRef.current;
      if (!world || !cvs) return;

      world.isClearing = isClearingRef.current;

      const dragging = dragRef.current.active;
      const target = dragging ? boxTargetRef.current : { x: 0, y: 0 };
      boxTargetRef.current = target;

      const k = dragging ? 1400 : 900; const c = dragging ? 75 : 55;
      const pos = boxPosRef.current; const vel = boxVelRef.current;

      let remain = dt; let axBox = 0, ayBox = 0;
      while (remain > 0) {
        const h = Math.min(remain, SPRING_MAX_STEP);
        axBox = -k * (pos.x - target.x) - c * vel.x; ayBox = -k * (pos.y - target.y) - c * vel.y;
        vel.x = clamp(vel.x + axBox * h, -MAX_BOX_V, MAX_BOX_V);
        vel.y = clamp(vel.y + ayBox * h, -MAX_BOX_V, MAX_BOX_V);
        pos.x += vel.x * h; pos.y += vel.y * h;
        remain -= h;
      }

      if (outerRef.current) outerRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

      world.axExt = dragging ? -axBox : 0; world.ayExt = dragging ? -ayBox : 0; world.gravityOn = dragging;

      const bootStart = bootStartRef.current;
      const bootElapsed = bootStart !== null ? t - bootStart : 1e9;
      const bootActive = bootStart !== null && bootElapsed < 1400;
      if (bootStart !== null && !bootActive) bootStartRef.current = null;

      const clearStart = clearStartRef.current;
      const clearElapsed = clearStart !== null ? t - clearStart : 1e9;
      const clearActive = clearStart !== null && clearElapsed < 700;
      if (clearStart !== null && !clearActive) clearStartRef.current = null;

      world.collisionsOn = dragging || (bootActive && bootElapsed > 120 && bootElapsed < 900);
      if (world.isClearing) world.collisionsOn = false;

      if (dragging) {
        world.returnAlpha = 0; returnStartRef.current = null;
      } else if (bootActive) {
        world.returnAlpha = smoothstep01((bootElapsed - 220) / 880); returnStartRef.current = null;
      } else if (world.isClearing) {
        world.returnAlpha = 0; returnStartRef.current = null;
      } else {
        if (returnStartRef.current === null) returnStartRef.current = t;
        const u = clamp((t - returnStartRef.current) / 320, 0, 1);
        world.returnAlpha = u * u * (3 - 2 * u);
      }

      acc += dt;
      while (acc >= FIXED_DT) { stepWorld(world, FIXED_DT); acc -= FIXED_DT; }

      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const dpr = cachedDpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "middle"; ctx.textAlign = "left";

      const pal = paletteRef.current; const ff = fontFamilyRef.current || FALLBACK_FONT_FAMILY;

      // 绘制开机动画 (中心蓝绿色)
      if (bootActive) {
        drawShockwave(ctx, world.w * 0.5, world.h * 0.5, Math.min(world.w, world.h) * 0.72, bootElapsed, pal, "accent2");
      }
      
      // 绘制清屏爆炸动画 (光标位置，橘红色，半径更大以覆盖全屏)
      if (clearActive && clearCenterRef.current) {
        const { x, y } = clearCenterRef.current;
        const maxR = Math.hypot(world.w, world.h); 
        drawShockwave(ctx, x, y, maxR, clearElapsed, pal, "warn");
      }
      
      ctx.globalAlpha = bootActive ? clamp(bootElapsed / 180, 0, 1) : 1;

      for (let i = 0; i < world.bodies.length; i++) {
        const b = world.bodies[i];
        ctx.fillStyle = pal[b.ck] ?? pal.accent;
        ctx.font = `${b.fs}px ${ff}`;
        ctx.fillText(b.ch, b.x, b.y);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onTerminalPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault(); if (e.button !== 0) return;
    const pid = e.pointerId; (e.currentTarget as HTMLElement).setPointerCapture(pid);
    const pos = boxPosRef.current; boxTargetRef.current = { x: pos.x, y: pos.y };
    setUiDragging(true); dragRef.current = { active: true, pid, sx: e.clientX, sy: e.clientY, tx: pos.x, ty: pos.y };
  };

  const onTerminalPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragRef.current.active || dragRef.current.pid !== e.pointerId) return;
    e.preventDefault();
    boxTargetRef.current = { x: dragRef.current.tx + (e.clientX - dragRef.current.sx), y: dragRef.current.ty + (e.clientY - dragRef.current.sy) };
  };

  const endDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragRef.current.active || dragRef.current.pid !== e.pointerId) return;
    dragRef.current.active = false; setUiDragging(false); dragRef.current.pid = -1;
    boxTargetRef.current = { x: 0, y: 0 };
  };

  return (
    <div ref={outerRef} className={["relative z-20 w-[95vw] max-w-3xl mx-3 sm:mx-4", className].filter(Boolean).join(" ")} style={{willChange: "transform" ,  zIndex: 1}}>
      <div className={`relative w-full transition-transform duration-150 ease-out ${uiDragging ? "" : "hover:scale-[1.02] active:scale-[0.98]"}`}>
        <div
            className="rounded-2xl border border-white/20 dark:border-white/[0.08] bg-gradient-to-b from-white/12 to-white/6 dark:from-white/[0.07] dark:to-white/[0.02] backdrop-blur-3xl backdrop-saturate-150 shadow-xl shadow-[var(--pixel-glow)] ring-1 ring-inset ring-white/20 dark:ring-white/[0.06] select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDownCapture={onTerminalPointerDown}
            onPointerMoveCapture={onTerminalPointerMove}
            onPointerUpCapture={endDrag}
            onPointerCancelCapture={endDrag}
          >
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-white/15 dark:border-white/[0.06] bg-white/10 dark:bg-white/[0.03] rounded-t-2xl select-none">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]" />
            </div>
            <span className="font-mono text-[10px] sm:text-[12px] text-[var(--pixel-accent)] ml-2 sm:ml-4 tracking-tight truncate">
              {title ?? "WENQIAN.ZHANG — BASH — 80x24"}
            </span>
          </div>

          <div
            ref={contentRef}
            className="relative p-4 sm:p-6 md:p-8 h-[340px] sm:h-[420px] md:h-[480px] font-[family-name:var(--font-jetbrains)] overflow-hidden"
          >
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
            
            {/* 手机端不显示输入提示框 */}
            {!isMobile && (
              <div 
                className={`absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-700 ease-in-out ${
                  hasInteracted ? "opacity-0" : "opacity-70 animate-pulse"
                }`}
              >
                <div className="bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-md border border-[var(--pixel-border)] flex items-center gap-2">
                  <span className="text-[12px] sm:text-[14px] text-[var(--pixel-text)] tracking-wider">
                    &gt; Start typing to interact _
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}