"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ARENA_HEIGHT, ARENA_WIDTH, PICKUP_COLORS, PICKUP_LABELS, WALLS } from "../config";
import type { BulletState, ExplosionState, PickupState, TankState } from "../types";

type ArenaViewProps = {
  tanks: TankState[];
  bullets: BulletState[];
  pickups: PickupState[];
  explosions: ExplosionState[];
  viewportScale: number;
};

function TankSprite({ tank }: { tank: TankState }) {
  const bodyColor = tank.team === "player" ? "var(--pixel-accent)" : "var(--pixel-accent-2)";
  const glow = tank.team === "player" ? "rgba(34,211,238,0.45)" : "rgba(249,115,22,0.45)";

  return (
    <motion.g
      initial={false}
      animate={{ x: tank.x, y: tank.y }}
      transition={{ duration: 0.05, ease: "linear" }}
    >
      <motion.g
        initial={false}
        animate={{ rotate: (tank.angle * 180) / Math.PI }}
        transition={{ duration: 0.05, ease: "linear" }}
      >
        <rect
          x={-tank.radius}
          y={-tank.radius * 0.78}
          width={tank.radius * 2}
          height={tank.radius * 1.56}
          rx={8}
          fill={bodyColor}
          opacity={tank.alive ? 1 : 0.25}
          stroke="var(--pixel-border)"
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
        />
        <rect
          x={-tank.radius * 0.82}
          y={-tank.radius}
          width={tank.radius * 0.34}
          height={tank.radius * 2}
          fill="rgba(0,0,0,0.25)"
        />
        <rect
          x={tank.radius * 0.48}
          y={-tank.radius}
          width={tank.radius * 0.34}
          height={tank.radius * 2}
          fill="rgba(0,0,0,0.25)"
        />
      </motion.g>

      <motion.g
        initial={false}
        animate={{ rotate: (tank.turretAngle * 180) / Math.PI }}
        transition={{ duration: 0.04, ease: "linear" }}
      >
        <rect x={0} y={-4} width={tank.radius + 16} height={8} rx={4} fill="rgba(255,255,255,0.85)" />
        <circle r={tank.radius * 0.62} fill="rgba(12,18,30,0.88)" stroke={bodyColor} strokeWidth={3} />
      </motion.g>

      {tank.respawnInvulnerableMs > 0 && (
        <circle
          r={tank.radius + 9}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}
    </motion.g>
  );
}

export function ArenaView({
  tanks,
  bullets,
  pickups,
  explosions,
  viewportScale,
}: ArenaViewProps) {
  const width = ARENA_WIDTH * viewportScale;
  const height = ARENA_HEIGHT * viewportScale;

  return (
    <div className="relative max-w-full overflow-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 backdrop-blur-xl md:p-4">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${ARENA_WIDTH} ${ARENA_HEIGHT}`}
        className="block"
        style={{ shapeRendering: "geometricPrecision" }}
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect x={0} y={0} width={ARENA_WIDTH} height={ARENA_HEIGHT} fill="url(#grid)" />
        <rect x={0} y={0} width={ARENA_WIDTH} height={ARENA_HEIGHT} fill="rgba(255,255,255,0.02)" />

        {WALLS.map((wall, idx) => (
          <g key={idx}>
            <rect
              x={wall.x}
              y={wall.y}
              width={wall.width}
              height={wall.height}
              rx={10}
              fill="rgba(255,255,255,0.08)"
              stroke="var(--pixel-border)"
              strokeWidth={3}
            />
            <rect
              x={wall.x + 6}
              y={wall.y + 6}
              width={Math.max(0, wall.width - 12)}
              height={Math.max(0, wall.height - 12)}
              rx={8}
              fill="rgba(34,211,238,0.05)"
            />
          </g>
        ))}

        {pickups.map((pickup) => (
          <g
            key={pickup.id}
            transform={`translate(${pickup.x}, ${pickup.y}) scale(${1 + Math.sin(pickup.pulse) * 0.06})`}
          >
            <circle r={pickup.radius + 5} fill={PICKUP_COLORS[pickup.kind]} opacity={0.18} />
            <circle
              r={pickup.radius}
              fill="rgba(10,14,24,0.86)"
              stroke={PICKUP_COLORS[pickup.kind]}
              strokeWidth={3}
            />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fill={PICKUP_COLORS[pickup.kind]}
              fontSize="10"
              fontFamily="var(--font-jetbrains)"
            >
              {PICKUP_LABELS[pickup.kind][0]}
            </text>
          </g>
        ))}

        {bullets.map((bullet) => (
          <motion.g
            key={bullet.id}
            initial={false}
            animate={{ x: bullet.x, y: bullet.y }}
            transition={{ duration: 0.03, ease: "linear" }}
          >
            <circle
              r={bullet.radius + 5}
              fill={
                bullet.ownerPlayerId === 1
                  ? "rgba(34,211,238,0.18)"
                  : "rgba(249,115,22,0.18)"
              }
            />
            <circle r={bullet.radius} fill={bullet.ownerPlayerId === 1 ? "#22d3ee" : "#f97316"} />
          </motion.g>
        ))}

        {tanks.map((tank) => (
          <TankSprite key={tank.id} tank={tank} />
        ))}

        <AnimatePresence>
          {explosions.map((explosion) => {
            const progress = 1 - explosion.ttlMs / explosion.maxTtlMs;
            const radius =
              explosion.kind === "blast" ? 18 + progress * 38 : 10 + progress * 24;
            const color =
              explosion.kind === "pickup"
                ? "rgba(74,222,128,0.7)"
                : explosion.kind === "hit"
                ? "rgba(248,113,113,0.75)"
                : "rgba(250,204,21,0.75)";

            return (
              <motion.circle
                key={explosion.id}
                cx={explosion.x}
                cy={explosion.y}
                r={radius}
                fill={color}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
              />
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}