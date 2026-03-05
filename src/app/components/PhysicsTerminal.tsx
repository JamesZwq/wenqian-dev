"use client";

import React, { useEffect, useRef, useState } from "react";

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
  id: number;
  ch: string;
  ck: ColorKey; // color key (resolved to real color at draw time)

  // local coordinates in the terminal content box
  x: number;
  y: number;
  vx: number;
  vy: number;

  // home (original) location
  hx: number;
  hy: number;

  r: number; // collision radius (circle)
  fs: number; // render font size (px)
  invM: number;
};

type World = {
  w: number;
  h: number;
  bodies: Body[];

  // external acceleration in local frame (pseudo-force from terminal acceleration)
  axExt: number;
  ayExt: number;

  // whether "gravity" + collisions are active (only while dragging terminal)
  gravityOn: boolean;
  collisionsOn: boolean;

  // spring return strength [0..1]
  returnAlpha: number;
};

const OFFSET = 32768; // for spatial hash key packing

function packKey(cx: number, cy: number) {
  // cx,cy expected in [-32768,32767]
  return (((cx + OFFSET) & 0xffff) << 16) | ((cy + OFFSET) & 0xffff);
}

function unpackKey(key: number): { cx: number; cy: number } {
  const cx = ((key >>> 16) & 0xffff) - OFFSET;
  const cy = (key & 0xffff) - OFFSET;
  return { cx, cy };
}

function buildSpatialHash(bodies: Body[], cell: number) {
  const grid = new Map<number, number[]>();
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const cx = Math.floor(b.x / cell);
    const cy = Math.floor(b.y / cell);
    const key = packKey(cx, cy);
    let arr = grid.get(key);
    if (!arr) {
      arr = [];
      grid.set(key, arr);
    }
    arr.push(i);
  }
  return grid;
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

  // positional correction (split by inverse mass)
  const penetration = r - d;
  const invMassSum = a.invM + b.invM;
  if (invMassSum <= 0) return;

  const slop = 0.3; // px
  const percent = 0.85;
  const corr = Math.max(0, penetration - slop) * (percent / invMassSum);
  a.x -= nx * corr * a.invM;
  a.y -= ny * corr * a.invM;
  b.x += nx * corr * b.invM;
  b.y += ny * corr * b.invM;

  // relative velocity
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return; // separating

  // normal impulse
  const jn = (-(1 + restitution) * vn) / invMassSum;
  const impNx = nx * jn;
  const impNy = ny * jn;
  a.vx -= impNx * a.invM;
  a.vy -= impNy * a.invM;
  b.vx += impNx * b.invM;
  b.vy += impNy * b.invM;

  // friction impulse
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
  // Left
  if (b.x - b.r < 0) {
    b.x = b.r;
    if (b.vx < 0) b.vx = -b.vx * restitution;
    b.vy *= 1 - wallFriction;
  }
  // Right
  if (b.x + b.r > w) {
    b.x = w - b.r;
    if (b.vx > 0) b.vx = -b.vx * restitution;
    b.vy *= 1 - wallFriction;
  }
  // Top
  if (b.y - b.r < 0) {
    b.y = b.r;
    if (b.vy < 0) b.vy = -b.vy * restitution;
    b.vx *= 1 - wallFriction;
  }
  // Bottom
  if (b.y + b.r > h) {
    b.y = h - b.r;
    if (b.vy > 0) b.vy = -b.vy * restitution;
    b.vx *= 1 - wallFriction;
  }
}

function stepWorld(world: World, dt: number) {
  const bodies = world.bodies;

  // Tunables
  const GRAV = 1500; // px/s^2 (active only while dragging)
  const airDrag = 1.05; // 1/s
  const maxSpeed = 2600;

  const restitution = 0.42;
  const mu = 0.25;
  const wallFriction = 0.05;

  // Spring back to home (only after release; scaled by returnAlpha)
  const k = 220; // 1/s^2 (stiffness)
  const c = 30; // 1/s   (damping; ~critical)

  const ayG = world.gravityOn ? GRAV : 0;

  // integrate (semi-implicit Euler)
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];

    // external acceleration (pseudo-force from terminal movement)
    let ax = world.axExt;
    let ay = world.ayExt + ayG;

    // return spring
    if (world.returnAlpha > 0) {
      const alpha = world.returnAlpha;
      const dx = b.x - b.hx;
      const dy = b.y - b.hy;
      ax += (-k * dx - c * b.vx) * alpha;
      ay += (-k * dy - c * b.vy) * alpha;
    }

    b.vx += ax * dt;
    b.vy += ay * dt;

    // air drag
    const drag = Math.exp(-airDrag * dt);
    b.vx *= drag;
    b.vy *= drag;

    // clamp
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > maxSpeed) {
      const s = maxSpeed / sp;
      b.vx *= s;
      b.vy *= s;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    resolveWalls(b, world.w, world.h, restitution, wallFriction);
  }

  // collisions (spatial hash) — only while dragging
  if (!world.collisionsOn) return;

  let maxR = 0;
  for (let i = 0; i < bodies.length; i++) maxR = Math.max(maxR, bodies[i].r);
  const cell = Math.max(12, maxR * 2.6);

  const grid = buildSpatialHash(bodies, cell);

  const neighborOffsets = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ] as const;

  // iterate a couple times to reduce jitter
  const iters = 2;
  for (let iter = 0; iter < iters; iter++) {
    for (const [key, indices] of grid.entries()) {
      const { cx, cy } = unpackKey(key);

      // within-cell pairs
      for (let ii = 0; ii < indices.length; ii++) {
        const aIdx = indices[ii];
        const a = bodies[aIdx];
        for (let jj = ii + 1; jj < indices.length; jj++) {
          resolveCircleCircle(a, bodies[indices[jj]], restitution, mu);
        }
      }

      // neighbor cells (avoid duplicates using directed offsets)
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

  // Collisions can push bodies slightly outside the content box (especially near the floor).
  // Re-apply wall constraints after collision resolution to keep everything strictly in-bounds.
  for (let i = 0; i < bodies.length; i++) {
    resolveWalls(bodies[i], world.w, world.h, restitution, wallFriction);
  }
}

// ------------------------------------------------------------
// UI: Draggable terminal + physics canvas
// ------------------------------------------------------------

type PhysicsTerminalProps = {
  className?: string;
  title?: string;
};

const ASCII_ART = `
  ██╗    ██╗███████╗███╗   ██╗ ██████╗ ██╗ █████╗ ███╗   ██╗
  ██║    ██║██╔════╝████╗  ██║██╔═══██╗██║██╔══██╗████╗  ██║
  ██║ █╗ ██║█████╗  ██╔██╗ ██║██║   ██║██║███████║██╔██╗ ██║
  ██║███╗██║██╔══╝  ██║╚██╗██║██║▄▄ ██║██║██╔══██║██║╚██╗██║
  ╚███╔███╔╝███████╗██║ ╚████║╚██████╔╝██║██║  ██║██║ ╚████║
   ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝ ╚══▀▀═╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
`;

const TYPED_LINES = [
  "> whoami",
  "Wenqian Zhang",
  "",
  "> role",
  "Ph.D. Candidate @ UNSW",
  "",
  "> research",
  "Large-Scale Graph Analysis | SIGMOD 2025 | SIGMOD 2026",
  "",
  "> status",
  "READY",
];

function buildBodies(w: number, h: number): Body[] {
  // Match the non-physics terminal's responsive typography/padding:
  // - content padding: p-4 / p-6 / p-8  => 16 / 24 / 32
  // - ASCII: 6px / 8px / 10px
  // - body text: 12px / 14px / 16px  (Tailwind: text-xs / text-sm / text-base)
  //
  // Note: collision radii may overlap at "home" positions. That's OK because we
  // disable collisions during return-to-home.

  const isSm = w >= 640;
  const isMd = w >= 768;

  const pad = isMd ? 32 : isSm ? 24 : 16;

  const bodies: Body[] = [];
  let id = 0;

  // ---------- ASCII block (leading-tight) ----------
  const asciiFont = isMd ? 10 : isSm ? 8 : 6; // px
  const asciiCW = asciiFont * 0.62;
  const asciiLH = asciiFont * 1.25; // leading-tight
  const asciiR = Math.max(1.8, asciiCW * 0.46);

  const asciiLines = ASCII_ART.trimEnd().split("\n");

  let y = pad + asciiFont; // roughly aligns to <pre> baseline inside padded box
  for (let li = 0; li < asciiLines.length; li++) {
    const line = asciiLines[li];
    let x = pad;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch !== " ") {
        bodies.push({
          id: id++,
          ch,
          ck: "accent",
          x,
          y,
          vx: 0,
          vy: 0,
          hx: x,
          hy: y,
          r: asciiR,
          fs: asciiFont,
          invM: 1,
        });
      }
      x += asciiCW;
      if (x > w - pad) break;
    }
    y += asciiLH;
    if (y > h - 140) break;
  }

  // margin-bottom: mb-4 / mb-6  => 16 / 24
  y += isSm ? 24 : 16;

  // ---------- Typed lines (Tailwind defaults) ----------
  const font = isMd ? 16 : isSm ? 14 : 12;
  const cw = font * 0.62;
  // Tailwind: text-xs -> 16px lh, text-sm -> 20px, text-base -> 24px
  const lh = isMd ? 24 : isSm ? 20 : 16;
  const typedR = Math.max(2.6, cw * 0.46);

  for (let li = 0; li < TYPED_LINES.length; li++) {
    const line = TYPED_LINES[li];
    let x = pad;

    const isCmd = line.startsWith(">");
    const isReady = line === "READY";

    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch !== " ") {
        bodies.push({
          id: id++,
          ch,
          ck: isCmd ? "accent2" : "accent", // READY letters are accent; underscore handled below
          x,
          y,
          vx: 0,
          vy: 0,
          hx: x,
          hy: y,
          r: typedR,
          fs: font,
          invM: 1,
        });
      }
      x += cw;
      if (x > w - pad) break;
    }

    // In the non-physics version: READY has a warning-colored underscore after it.
    if (isReady) {
      const gap = Math.min(4, cw * 0.5); // roughly "ml-1"
      const ux = pad + cw * line.length + gap;
      if (ux < w - pad) {
        bodies.push({
          id: id++,
          ch: "_",
          ck: "warn",
          x: ux,
          y,
          vx: 0,
          vy: 0,
          hx: ux,
          hy: y,
          r: typedR,
          fs: font,
          invM: 1,
        });
      }
    }

    // match space-y-1 (~4px) by not using lh too aggressively on empty lines
    y += line.length === 0 ? Math.max(8, lh * 0.6) : lh;
    if (y > h - pad) break;
  }

  return bodies;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);

  // NOTE: canvas does NOT resolve CSS var(...) strings, so we resolve them here.
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;

  return {
    accent: pick("--pixel-accent", "#00ff88"),
    accent2: pick("--pixel-accent-2", "#00d4ff"),
    warn: pick("--pixel-warn", "#ff6b35"),
    text: pick("--pixel-text", "#e6e6e6"),
  };
}

const FALLBACK_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';


function hash01(n: number) {
  // deterministic pseudo-random in [0,1)
  const s = Math.sin(n * 999.123 + 0.12345) * 43758.5453;
  return s - Math.floor(s);
}

function smoothstep01(u: number) {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function initBootExplosion(world: World) {
  const cx = world.w * 0.5;
  const cy = world.h * 0.5;

  for (let i = 0; i < world.bodies.length; i++) {
    const b = world.bodies[i];

    // Start in a tight cluster around the center (avoid exact same point).
    const r0 = 10 * Math.sqrt(hash01(b.id + 17));
    const a0 = hash01(b.id + 91) * Math.PI * 2;
    b.x = cx + Math.cos(a0) * r0;
    b.y = cy + Math.sin(a0) * r0;

    // Velocity biased toward the body's home position, with some angular spread.
    const dx = b.hx - cx;
    const dy = b.hy - cy;
    const d = Math.hypot(dx, dy) || 1;

    let nx = dx / d;
    let ny = dy / d;

    // ±~25° jitter so the blast looks organic.
    const jitter = (hash01(b.id + 203) * 2 - 1) * 0.44;
    const cs = Math.cos(jitter);
    const sn = Math.sin(jitter);
    const rx = nx * cs - ny * sn;
    const ry = nx * sn + ny * cs;
    nx = rx;
    ny = ry;

    // Speed scales with distance-to-home (farther glyphs fly faster).
    const base = clamp(d * 2.2 + 260, 420, 1750);
    const sp = base * (0.8 + 0.6 * hash01(b.id + 777));

    b.vx = nx * sp;
    b.vy = ny * sp;
  }
}

function drawBootShockwave(ctx: CanvasRenderingContext2D, w: number, h: number, elapsedMs: number, pal: Palette) {
  // A subtle expanding ring + center flash during boot.
  const DUR = 700;
  const u = clamp(elapsedMs / DUR, 0, 1);
  if (u <= 0 || u >= 1) return;

  const eased = 1 - Math.pow(1 - u, 3); // easeOutCubic
  const r = eased * Math.min(w, h) * 0.72;

  const cx = w * 0.5;
  const cy = h * 0.5;

  ctx.save();
  ctx.globalAlpha = 0.14 * (1 - u);
  ctx.lineWidth = 2;
  ctx.strokeStyle = pal.accent2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Center flash
  ctx.globalAlpha = 0.08 * (1 - u);
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 18 * (1 - 0.4 * u), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


export default function PhysicsTerminal({ className, title }: PhysicsTerminalProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const paletteRef = useRef<Palette>({
    accent: "#00ff88",
    accent2: "#00d4ff",
    warn: "#ff6b35",
    text: "#e6e6e6",
  });

  const fontFamilyRef = useRef<string>(FALLBACK_FONT_FAMILY);

  const rootClass = ["relative z-20 w-[95vw] max-w-3xl mx-3 sm:mx-4", className].filter(Boolean).join(" ");

  const [glitch, setGlitch] = useState(false);
  const [uiDragging, setUiDragging] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setGlitch((g) => !g), 3000);
    return () => window.clearInterval(t);
  }, []);

  // Drag state
  const dragRef = useRef<{ active: boolean; pid: number; sx: number; sy: number; tx: number; ty: number }>({
    active: false,
    pid: -1,
    sx: 0,
    sy: 0,
    tx: 0,
    ty: 0,
  });

  // Box spring (screen space) — gives the "DraggableFloat" feel:
  // - during drag: slightly lag behind pointer (elastic)
  // - on release: snaps back to origin (0,0)
  const boxPosRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxVelRef = useRef<Vec2>({ x: 0, y: 0 });
  const boxTargetRef = useRef<Vec2>({ x: 0, y: 0 });

  // physics world lives in refs (no React re-render per frame)
  const worldRef = useRef<World | null>(null);

  // release return timing (glyph spring ramp)
  const returnStartRef = useRef<number | null>(null);

  // Boot animation (initial load): glyphs start from center and explode to home.
  const bootStartRef = useRef<number | null>(null);

  // Resize + rebuild bodies when content box size changes
  useEffect(() => {
    const el = contentRef.current;
    const cvs = canvasRef.current;
    if (!el || !cvs) return;

    const ro = new ResizeObserver(() => {
      // Resolve palette + font family from the *actual* computed styles
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
      worldRef.current = {
        w,
        h,
        bodies: buildBodies(w, h),
        axExt: 0,
        ayExt: 0,
        gravityOn: false,
        collisionsOn: false,
        returnAlpha: 1,
      };

      // Boot: start glyphs in the center cluster, then blast them toward home.
      if (worldRef.current) {
        initBootExplosion(worldRef.current);
      }
      bootStartRef.current = nowMs();

      // reset return animation
      returnStartRef.current = null;
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Animation loop (box spring + glyph physics + render)
  useEffect(() => {
    let raf = 0;
    let last = nowMs();
    let acc = 0;
    const FIXED_DT = 1 / 120; // seconds
    const SPRING_MAX_STEP = 1 / 240; // seconds (stabilizes Safari/low-FPS)
    const MAX_BOX_V = 6000; // px/s safety clamp

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const t = nowMs();
      let dt = (t - last) / 1000;
      last = t;

      // avoid huge steps when tab was inactive
      dt = clamp(dt, 0, 0.033);

      const world = worldRef.current;
      const cvs = canvasRef.current;
      const el = contentRef.current;
      if (!world || !cvs || !el) return;

      // --- box spring integration (screen space) ---
      const dragging = dragRef.current.active;

      const target = dragging ? boxTargetRef.current : { x: 0, y: 0 };
      // keep targetRef coherent (helps if user re-grabs mid-snap)
      boxTargetRef.current = target;

      // tuned to feel like DraggableFloat's dragElastic + dragSnapToOrigin
      const k = dragging ? 1400 : 900; // stiffness
      const c = dragging ? 75 : 55; // damping

      const pos = boxPosRef.current;
      const vel = boxVelRef.current;

      // Safari can produce larger frame deltas; sub-step the spring to avoid "teleporting".
      let remain = dt;
      let axBox = 0;
      let ayBox = 0;

      while (remain > 0) {
        const h = Math.min(remain, SPRING_MAX_STEP);

        axBox = -k * (pos.x - target.x) - c * vel.x;
        ayBox = -k * (pos.y - target.y) - c * vel.y;

        vel.x += axBox * h;
        vel.y += ayBox * h;

        // safety clamp for rare spikes
        vel.x = clamp(vel.x, -MAX_BOX_V, MAX_BOX_V);
        vel.y = clamp(vel.y, -MAX_BOX_V, MAX_BOX_V);

        pos.x += vel.x * h;
        pos.y += vel.y * h;

        remain -= h;
      }


      // apply transform directly (avoid React re-render per frame)
      if (outerRef.current) {
        outerRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }

      // --- drive glyph world from box acceleration (pseudo-force) ---
      world.axExt = dragging ? -axBox : 0;
      world.ayExt = dragging ? -ayBox : 0;
      world.gravityOn = dragging;

      // Boot (initial load) timing
      const bootStart = bootStartRef.current;
      const bootElapsed = bootStart !== null ? t - bootStart : 1e9;
      const bootActive = bootStart !== null && bootElapsed < 1400;
      if (bootStart !== null && !bootActive) bootStartRef.current = null;

      // Collisions only while dragging, or briefly during the boot blast.
      // (We disable them before the final settle so glyphs can reach exact home positions.)
      const bootCollisions = bootActive && bootElapsed > 120 && bootElapsed < 900;
      world.collisionsOn = dragging || bootCollisions;

      // Return-to-home spring:
      // - while dragging: off
      // - while booting: ramp in after the initial blast
      // - otherwise: ramp in after release (as before)
      if (dragging) {
        world.returnAlpha = 0;
        returnStartRef.current = null;
      } else if (bootActive) {
        // start pulling them home after the initial "explosion"
        const u = (bootElapsed - 220) / 880;
        world.returnAlpha = smoothstep01(u);
        returnStartRef.current = null;
      } else {
        if (returnStartRef.current === null) returnStartRef.current = t;
        const u = clamp((t - returnStartRef.current) / 320, 0, 1); // ms
        world.returnAlpha = u * u * (3 - 2 * u); // smoothstep
      }

      // fixed-step physics
      acc += dt;
      while (acc >= FIXED_DT) {
        stepWorld(world, FIXED_DT);
        acc -= FIXED_DT;
      }

      // --- render ---
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;

      // IMPORTANT:
      // Clear in *device pixel* space to avoid bottom/right "ghost trails"
      // caused by fractional CSS pixels + transforms while dragging.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Draw in CSS pixel space (scaled by DPR).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const pal = paletteRef.current;
      const ff = fontFamilyRef.current || FALLBACK_FONT_FAMILY;

      // Boot visuals: slight fade-in + shockwave ring
      if (bootActive) {
        drawBootShockwave(ctx, world.w, world.h, bootElapsed, pal);
      }
      const fadeIn = bootActive ? clamp(bootElapsed / 180, 0, 1) : 1;
      ctx.globalAlpha = fadeIn;

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

  // Drag handlers (entire terminal as handle)
  const onTerminalPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Prevent text selection / native drag.
    e.preventDefault();
    if (e.button !== 0) return;
    const pid = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(pid);

    // start drag from current box position (prevents a "jump" if you grab mid-snap)
    const pos = boxPosRef.current;
    boxTargetRef.current = { x: pos.x, y: pos.y };

    setUiDragging(true);

    dragRef.current = {
      active: true,
      pid,
      sx: e.clientX,
      sy: e.clientY,
      tx: pos.x,
      ty: pos.y,
    };
  };

  const onTerminalPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragRef.current.active || dragRef.current.pid !== e.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;

    boxTargetRef.current = {
      x: dragRef.current.tx + dx,
      y: dragRef.current.ty + dy,
    };
  };

  const endDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragRef.current.active || dragRef.current.pid !== e.pointerId) return;
    dragRef.current.active = false;
    setUiDragging(false);
    dragRef.current.pid = -1;
    boxTargetRef.current = { x: 0, y: 0 };
  };

  return (
    <div ref={outerRef} className={rootClass} style={{ willChange: "transform" }}>
      {/* Scale-on-hover wrapper (matches DraggableFloat hover/tap feel without interfering with translate transform) */}
      <div className={`relative w-full transition-transform duration-150 ease-out ${uiDragging ? "" : "hover:scale-[1.02] active:scale-[0.98]"}`}>
        <div
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] shadow-[0_0_30px_var(--pixel-glow)] select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDownCapture={onTerminalPointerDown}
            onPointerMoveCapture={onTerminalPointerMove}
            onPointerUpCapture={endDrag}
            onPointerCancelCapture={endDrag}
          >
          {/* Title bar (drag handle) */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] select-none">

            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[#27c93f]" />
            </div>
            <span className="font-[family-name:var(--font-press-start)] text-[10px] sm:text-[12px] text-[var(--pixel-accent)] ml-2 sm:ml-4 tracking-widest truncate" style={{ fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
              {title ?? "WENQIAN.ZHANG — BASH — 80x24"}
            </span>
          </div>

          {/* Terminal content */}
          <div
            ref={contentRef}
            className="relative p-4 sm:p-6 md:p-8 h-[340px] sm:h-[420px] md:h-[480px] font-[family-name:var(--font-jetbrains)]"
          >
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
          </div>
        </div>

        {/* Glitch overlay (matches the non-physics terminal) */}
        {glitch && (
          <div
            className="absolute inset-0 pointer-events-none mix-blend-difference"
            style={{
              background: "linear-gradient(90deg, transparent 48%, #ff00ff 50%, transparent 52%)",
              opacity: 0.03,
            }}
          />
        )}
      </div>
    </div>
  );
}
