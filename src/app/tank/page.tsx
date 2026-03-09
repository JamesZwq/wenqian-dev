"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "../../features/p2p/components/P2PStatusPanel";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOT_COUNT,
  BOT_BULLET_SPEED,
  BOT_FIRE_COOLDOWN_MS,
  BOT_MOVE_SPEED,
  BULLET_RADIUS,
  BULLET_TTL_MS,
  MAX_HP,
  PICKUP_KINDS,
  PICKUP_SPAWN_INTERVAL_MS,
  PICKUP_TTL_MS,
  PLAYER_BULLET_SPEED,
  PLAYER_FIRE_COOLDOWN_MS,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
  PLAYER_SPAWNS,
  SNAPSHOT_INTERVAL_MS,
  WALLS,
  BOT_SPAWNS,
} from "./config";
import type {
  ArenaSnapshot,
  BuffInstance,
  BulletState,
  ExplosionState,
  GameInput,
  GameMode,
  PickupKind,
  PickupState,
  PlayerId,
  TankPacket,
  TankState,
  Vector2,
} from "./types";
import { ArenaView } from "./components/ArenaView";
import { GameHUD } from "./components/GameHUD";
import { MobileControls } from "./components/MobileControls";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Vector2, b: Vector2) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = (x: number, y: number) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

const randomId = () => Math.random().toString(36).slice(2, 10);

function rectCircleIntersects(
  x: number,
  y: number,
  r: number,
  rect: { x: number; y: number; width: number; height: number }
) {
  const closestX = clamp(x, rect.x, rect.x + rect.width);
  const closestY = clamp(y, rect.y, rect.y + rect.height);
  return Math.hypot(x - closestX, y - closestY) <= r;
}

function collidesWithWalls(x: number, y: number, radius: number) {
  if (x - radius < 0 || x + radius > ARENA_WIDTH || y - radius < 0 || y + radius > ARENA_HEIGHT) {
    return true;
  }
  return WALLS.some((wall) => rectCircleIntersects(x, y, radius, wall));
}

function createBuff(kind: PickupKind, now: number): BuffInstance {
  const duration =
    kind === "damage_boost"
      ? 9000
      : kind === "rapid_fire"
      ? 9000
      : kind === "speed_boost"
      ? 7000
      : kind === "bullet_speed"
      ? 9000
      : 0;
  return { kind, expiresAt: now + duration };
}

function spawnPickup(now: number): PickupState {
  const kind = PICKUP_KINDS[Math.floor(Math.random() * PICKUP_KINDS.length)];
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = 120 + Math.random() * (ARENA_WIDTH - 240);
    const y = 120 + Math.random() * (ARENA_HEIGHT - 240);
    if (!collidesWithWalls(x, y, 26)) {
      return {
        id: randomId(),
        kind,
        x,
        y,
        radius: 20,
        ttlMs: PICKUP_TTL_MS,
        pulse: Math.random() * Math.PI * 2,
      };
    }
  }
  return {
    id: randomId(),
    kind,
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    radius: 20,
    ttlMs: PICKUP_TTL_MS,
    pulse: 0,
  };
}

function createTank(
  playerId: PlayerId | 0,
  x: number,
  y: number,
  team: "player" | "enemy",
  seedOffset = 0
): TankState {
  const isEnemy = team === "enemy";
  return {
    id: randomId(),
    playerId,
    x,
    y,
    angle: isEnemy ? Math.PI : 0,
    turretAngle: isEnemy ? Math.PI : 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    radius: PLAYER_RADIUS,
    baseMoveSpeed: isEnemy ? BOT_MOVE_SPEED + seedOffset * 8 : PLAYER_MOVE_SPEED,
    fireCooldownMs: isEnemy ? BOT_FIRE_COOLDOWN_MS - seedOffset * 20 : PLAYER_FIRE_COOLDOWN_MS,
    fireCooldownRemaining: 0,
    bulletSpeed: isEnemy ? BOT_BULLET_SPEED : PLAYER_BULLET_SPEED,
    bulletDamage: 1,
    speedMultiplier: 1,
    alive: true,
    respawnInvulnerableMs: 1200,
    activeBuffs: [],
    damageBoostShotsLeft: 0,
    team,
  };
}

function createSinglePlayerMatch(): ArenaSnapshot {
  const player = createTank(1, PLAYER_SPAWNS[1].x, PLAYER_SPAWNS[1].y, "player");
  const enemies = BOT_SPAWNS.slice(0, BOT_COUNT).map((spawn, idx) =>
    createTank(0, spawn.x, spawn.y, "enemy", idx)
  );
  return {
    tanks: [player, ...enemies],
    bullets: [],
    pickups: [spawnPickup(Date.now())],
    explosions: [],
    winner: null,
    elapsedMs: 0,
    startedAt: Date.now(),
  };
}

function createRemoteMatch(): ArenaSnapshot {
  const p1 = createTank(1, PLAYER_SPAWNS[1].x, PLAYER_SPAWNS[1].y, "player");
  const p2 = createTank(2, PLAYER_SPAWNS[2].x, PLAYER_SPAWNS[2].y, "player");
  p2.angle = Math.PI;
  p2.turretAngle = Math.PI;
  return {
    tanks: [p1, p2],
    bullets: [],
    pickups: [spawnPickup(Date.now())],
    explosions: [],
    winner: null,
    elapsedMs: 0,
    startedAt: Date.now(),
  };
}

function findNearestEnemy(tank: TankState, tanks: TankState[]) {
  let nearest: TankState | null = null;
  let nearestDistance = Infinity;
  for (const candidate of tanks) {
    if (candidate.id === tank.id || !candidate.alive) continue;
    if (tank.team === candidate.team && tank.playerId !== 1 && candidate.playerId !== 2) continue;
    const d = distance(tank, candidate);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = candidate;
    }
  }
  return nearest;
}

function applyPickup(tank: TankState, pickup: PickupState, now: number) {
  if (pickup.kind === "heal") {
    tank.hp = clamp(tank.hp + 1, 0, tank.maxHp);
    return;
  }
  if (pickup.kind === "damage_boost") {
    tank.damageBoostShotsLeft += 4;
    tank.activeBuffs = [
      ...tank.activeBuffs.filter((buff) => buff.kind !== "damage_boost"),
      createBuff(pickup.kind, now),
    ];
    return;
  }
  tank.activeBuffs = [
    ...tank.activeBuffs.filter((buff) => buff.kind !== pickup.kind),
    createBuff(pickup.kind, now),
  ];
}

function refreshBuffDerivedStats(tank: TankState, now: number) {
  tank.activeBuffs = tank.activeBuffs.filter((buff) => buff.expiresAt > now);
  tank.speedMultiplier = tank.activeBuffs.some((buff) => buff.kind === "speed_boost") ? 1.3 : 1;
  tank.bulletSpeed = tank.activeBuffs.some((buff) => buff.kind === "bullet_speed")
    ? PLAYER_BULLET_SPEED * 1.45
    : tank.team === "enemy"
    ? BOT_BULLET_SPEED
    : PLAYER_BULLET_SPEED;

  tank.fireCooldownMs = tank.activeBuffs.some((buff) => buff.kind === "rapid_fire")
    ? Math.round((tank.team === "enemy" ? BOT_FIRE_COOLDOWN_MS : PLAYER_FIRE_COOLDOWN_MS) * 0.65)
    : tank.team === "enemy"
    ? BOT_FIRE_COOLDOWN_MS
    : PLAYER_FIRE_COOLDOWN_MS;

  tank.bulletDamage = tank.damageBoostShotsLeft > 0 ? 2 : 1;
}

function shootFromTank(tank: TankState, tanks: TankState[]): BulletState | null {
  if (!tank.alive || tank.fireCooldownRemaining > 0) return null;

  let angle = tank.turretAngle;
  const target = findNearestEnemy(tank, tanks);
  if (target) {
    angle = Math.atan2(target.y - tank.y, target.x - tank.x);
    tank.turretAngle = angle;
  }

  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  tank.fireCooldownRemaining = tank.fireCooldownMs;
  const damage = tank.damageBoostShotsLeft > 0 ? 2 : tank.bulletDamage;

  if (tank.damageBoostShotsLeft > 0) tank.damageBoostShotsLeft -= 1;

  return {
    id: randomId(),
    ownerId: tank.id,
    ownerPlayerId: tank.playerId,
    x: tank.x + dir.x * (tank.radius + 16),
    y: tank.y + dir.y * (tank.radius + 16),
    vx: dir.x * tank.bulletSpeed,
    vy: dir.y * tank.bulletSpeed,
    radius: BULLET_RADIUS,
    damage,
    ttlMs: BULLET_TTL_MS,
  };
}

function updateTankMovement(tank: TankState, input: GameInput, dtSec: number) {
  let moveX = 0;
  let moveY = 0;

  if (input.up) moveY -= 1;
  if (input.down) moveY += 1;
  if (input.left) moveX -= 1;
  if (input.right) moveX += 1;

  if (moveX === 0 && moveY === 0) return;

  const dir = normalize(moveX, moveY);
  const speed = tank.baseMoveSpeed * tank.speedMultiplier;
  const nextX = tank.x + dir.x * speed * dtSec;
  const nextY = tank.y + dir.y * speed * dtSec;

  tank.angle = Math.atan2(dir.y, dir.x);
  tank.turretAngle = tank.angle;

  if (!collidesWithWalls(nextX, tank.y, tank.radius)) tank.x = nextX;
  if (!collidesWithWalls(tank.x, nextY, tank.radius)) tank.y = nextY;
}

function updateBot(tank: TankState, tanks: TankState[], _dtSec: number, now: number): GameInput {
  const target = tanks.find((item) => item.playerId === 1) ?? tanks[0];
  const dx = target.x - tank.x;
  const dy = target.y - tank.y;
  const dist = Math.hypot(dx, dy) || 1;
  const fire = dist < 560;
  const preferred = normalize(dx, dy);

  let moveX = preferred.x;
  let moveY = preferred.y;

  if (dist < 180) {
    moveX = -preferred.x;
    moveY = -preferred.y;
  }

  if (Math.floor(now / 900 + tank.x) % 2 === 0) {
    moveX += -preferred.y * 0.7;
    moveY += preferred.x * 0.7;
  }

  tank.turretAngle = Math.atan2(dy, dx);

  return {
    up: moveY < -0.2,
    down: moveY > 0.2,
    left: moveX < -0.2,
    right: moveX > 0.2,
    fire,
  };
}

function cloneSnapshot(snapshot: ArenaSnapshot): ArenaSnapshot {
  return JSON.parse(JSON.stringify(snapshot));
}

export default function TankPage() {
  const [viewportScale, setViewportScale] = useState(1);
  const [mode, setMode] = useState<GameMode>("menu");
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [winner, setWinner] = useState<PlayerId | null>(null);
  const [myRemotePlayerId, setMyRemotePlayerId] = useState<PlayerId | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);
  const [remotePeerLabel, setRemotePeerLabel] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const snapshotRef = useRef<ArenaSnapshot | null>(null);
  const runningRef = useRef(false);
  const modeRef = useRef<GameMode>("menu");
  const winnerRef = useRef<PlayerId | null>(null);
  const myRemotePlayerIdRef = useRef<PlayerId | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const pickupSpawnTimerRef = useRef(0);
  const stateBroadcastAccumulatorRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const sendRef = useRef<((payload: TankPacket) => void) | null>(null);

  const localInputRef = useRef<GameInput>({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  });
  const remoteInputRef = useRef<GameInput>({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  useEffect(() => {
    myRemotePlayerIdRef.current = myRemotePlayerId;
  }, [myRemotePlayerId]);

  useEffect(() => {
    const saved = window.localStorage.getItem("steel_duel_guide_seen");
    if (!saved) {
      setShowGuide(true);
    }
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const horizontalPadding = viewportWidth < 768 ? 24 : 120;
      const verticalReserved = viewportWidth < 768 ? 420 : 280;
      const scale = Math.min(
        (viewportWidth - horizontalPadding) / ARENA_WIDTH,
        (viewportHeight - verticalReserved) / ARENA_HEIGHT,
        1
      );
      setViewportScale(Math.max(0.34, scale));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const applyFrame = useCallback((next: ArenaSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(cloneSnapshot(next));
    setWinner(next.winner);
  }, []);

  const emitFlash = useCallback((message: string) => {
    setFlashMessage(message);
    window.setTimeout(() => setFlashMessage(null), 900);
  }, []);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastFrameTimeRef.current = null;
  }, []);

  const updateWorld = useCallback(
    (dtMs: number) => {
      const world = snapshotRef.current;
      if (!world || world.winner) return;

      const dtSec = dtMs / 1000;
      const now = Date.now();

      world.elapsedMs += dtMs;
      pickupSpawnTimerRef.current += dtMs;
      stateBroadcastAccumulatorRef.current += dtMs;

      if (pickupSpawnTimerRef.current >= PICKUP_SPAWN_INTERVAL_MS) {
        pickupSpawnTimerRef.current = 0;
        if (world.pickups.length < 4) {
          world.pickups.push(spawnPickup(now));
        }
      }

      const localPlayerId = myRemotePlayerIdRef.current;

      for (const tank of world.tanks) {
        refreshBuffDerivedStats(tank, now);
        tank.fireCooldownRemaining = Math.max(0, tank.fireCooldownRemaining - dtMs);
        tank.respawnInvulnerableMs = Math.max(0, tank.respawnInvulnerableMs - dtMs);
        if (!tank.alive) continue;

        let input: GameInput = {
          up: false,
          down: false,
          left: false,
          right: false,
          fire: false,
        };

        if (modeRef.current === "single") {
          if (tank.playerId === 1) input = localInputRef.current;
          else input = updateBot(tank, world.tanks, dtSec, now);
        } else if (modeRef.current === "remote") {
          if (tank.playerId === localPlayerId) input = localInputRef.current;
          else input = remoteInputRef.current;
        }

        updateTankMovement(tank, input, dtSec);
        const shot = input.fire ? shootFromTank(tank, world.tanks) : null;
        if (shot) world.bullets.push(shot);
      }

      for (const bullet of world.bullets) {
        bullet.x += bullet.vx * dtSec;
        bullet.y += bullet.vy * dtSec;
        bullet.ttlMs -= dtMs;
      }

      const aliveTanks = world.tanks.filter((tank) => tank.alive);
      const nextBullets: BulletState[] = [];

      for (const bullet of world.bullets) {
        if (bullet.ttlMs <= 0 || collidesWithWalls(bullet.x, bullet.y, bullet.radius)) {
          continue;
        }

        let hit = false;
        for (const tank of aliveTanks) {
          if (tank.id === bullet.ownerId || !tank.alive || tank.respawnInvulnerableMs > 0) continue;
          if (distance({ x: bullet.x, y: bullet.y }, tank) <= bullet.radius + tank.radius) {
            tank.hp = Math.max(0, tank.hp - bullet.damage);
            world.explosions.push({
              id: randomId(),
              x: bullet.x,
              y: bullet.y,
              ttlMs: 220,
              maxTtlMs: 220,
              kind: tank.hp <= 0 ? "blast" : "hit",
            });
            if (tank.hp <= 0) {
              tank.alive = false;
            }
            hit = true;
            break;
          }
        }

        if (!hit) nextBullets.push(bullet);
      }

      world.bullets = nextBullets;

      world.pickups = world.pickups.filter((pickup) => {
        pickup.ttlMs -= dtMs;
        pickup.pulse += dtSec * 4;
        if (pickup.ttlMs <= 0) return false;

        for (const tank of world.tanks) {
          if (!tank.alive) continue;
          if (distance(tank, pickup) <= tank.radius + pickup.radius) {
            applyPickup(tank, pickup, now);
            world.explosions.push({
              id: randomId(),
              x: pickup.x,
              y: pickup.y,
              ttlMs: 300,
              maxTtlMs: 300,
              kind: "pickup",
            });
            if (tank.playerId === localPlayerId || (modeRef.current === "single" && tank.playerId === 1)) {
              emitFlash(`${pickup.kind.toUpperCase()} ONLINE`);
            }
            return false;
          }
        }
        return true;
      });

      world.explosions = world.explosions
        .map((explosion) => ({ ...explosion, ttlMs: explosion.ttlMs - dtMs }))
        .filter((explosion) => explosion.ttlMs > 0);

      if (modeRef.current === "single") {
        const player = world.tanks.find((tank) => tank.playerId === 1);
        const enemies = world.tanks.filter((tank) => tank.team === "enemy" && tank.alive);
        if (!player?.alive) {
          world.winner = 2;
        } else if (enemies.length === 0) {
          world.winner = 1;
        }
      } else if (modeRef.current === "remote") {
        const p1 = world.tanks.find((tank) => tank.playerId === 1);
        const p2 = world.tanks.find((tank) => tank.playerId === 2);
        if (p1 && !p1.alive) world.winner = 2;
        if (p2 && !p2.alive) world.winner = 1;
      }

      if (world.winner && !winnerRef.current) {
        winnerRef.current = world.winner;
        if (modeRef.current === "remote" && myRemotePlayerIdRef.current === 1) {
          sendRef.current?.({
            type: "game_over",
            winner: world.winner,
            elapsedMs: world.elapsedMs,
            timestamp: now,
          });
        }
        stopLoop();
      }

      applyFrame(world);

      if (
        modeRef.current === "remote" &&
        myRemotePlayerIdRef.current === 1 &&
        stateBroadcastAccumulatorRef.current >= SNAPSHOT_INTERVAL_MS
      ) {
        stateBroadcastAccumulatorRef.current = 0;
        sendRef.current?.({
          type: "state",
          snapshot: cloneSnapshot(world),
          timestamp: now,
        });
      }
    },
    [applyFrame, emitFlash, stopLoop]
  );

  const loop = useCallback(
    (frameTime: number) => {
      if (!runningRef.current) return;
      const last = lastFrameTimeRef.current ?? frameTime;
      const dt = Math.min(24, frameTime - last);
      lastFrameTimeRef.current = frameTime;
      updateWorld(dt);
      frameRef.current = requestAnimationFrame(loop);
    },
    [updateWorld]
  );

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    lastFrameTimeRef.current = null;
    frameRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const handleRemotePacket = useCallback(
    (packet: TankPacket) => {
      setLastRemoteMessageAt(Date.now());

      if (packet.type === "match_start") {
        applyFrame(packet.snapshot);
        if (myRemotePlayerIdRef.current === 2) startLoop();
        return;
      }

      if (packet.type === "input") {
        if (packet.playerId === 2) remoteInputRef.current = packet.input;
        return;
      }

      if (packet.type === "state") {
        if (myRemotePlayerIdRef.current === 2) {
          applyFrame(packet.snapshot);
        }
        return;
      }

      if (packet.type === "game_over") {
        setWinner(packet.winner);
        setSnapshot((prev) =>
          prev ? { ...prev, winner: packet.winner, elapsedMs: packet.elapsedMs } : prev
        );
        stopLoop();
        return;
      }

      if (packet.type === "ping") {
        sendRef.current?.({ type: "pong", sentAt: packet.sentAt });
        return;
      }

      if (packet.type === "pong") {
        setLatencyMs(Math.max(0, Date.now() - packet.sentAt));
        return;
      }

      if (packet.type === "menu_exit") {
        stopLoop();
        setMode("menu");
        setSnapshot(null);
        setWinner(null);
        setMyRemotePlayerId(null);
        setRemotePeerLabel(null);
      }
    },
    [applyFrame, startLoop, stopLoop]
  );

  const {
    phase,
    localPeerId,
    error,
    isConnected,
    connect,
    send,
    clearError,
    retryLastConnection,
    reinitialize,
  } = usePeerConnection<TankPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    onData: handleRemotePacket,
    acceptIncomingConnections: true,
    onConnected: ({ direction }) => {
      const rolePlayer: PlayerId = direction === "outgoing" ? 1 : 2;
      setMyRemotePlayerId(rolePlayer);
      setRemotePeerLabel(direction === "outgoing" ? "outgoing peer" : "incoming peer");
      setMode("remote");
      setLastRemoteMessageAt(Date.now());

      if (direction === "outgoing") {
        const next = createRemoteMatch();
        localInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
        remoteInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
        applyFrame(next);
        startLoop();
        send({
          type: "match_start",
          seed: Date.now(),
          snapshot: cloneSnapshot(next),
          timestamp: Date.now(),
        });
      }
    },
    onDisconnected: () => {
      setLatencyMs(null);
      setLastRemoteMessageAt(null);
      setRemotePeerLabel(null);
      setMyRemotePlayerId(null);
      if (modeRef.current === "remote") {
        stopLoop();
        setMode("menu");
      }
    },
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    if (!isConnected) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
      setLatencyMs(null);
      return;
    }

    pingIntervalRef.current = setInterval(() => {
      send({ type: "ping", sentAt: Date.now() });
    }, 2000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    };
  }, [isConnected, send]);

  const setInputKey = useCallback(
    (key: keyof GameInput, pressed: boolean) => {
      localInputRef.current = { ...localInputRef.current, [key]: pressed };
      if (modeRef.current === "remote" && myRemotePlayerIdRef.current === 2 && isConnected) {
        send({
          type: "input",
          playerId: 2,
          input: localInputRef.current,
          timestamp: Date.now(),
        });
      }
    },
    [isConnected, send]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current === "menu") return;

      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") setInputKey("up", true);
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") setInputKey("down", true);
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") setInputKey("left", true);
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") setInputKey("right", true);
      if (e.key === " ") {
        e.preventDefault();
        setInputKey("fire", true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") setInputKey("up", false);
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") setInputKey("down", false);
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") setInputKey("left", false);
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") setInputKey("right", false);
      if (e.key === " ") setInputKey("fire", false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setInputKey]);

  const startSingle = useCallback(() => {
    stopLoop();
    setMode("single");
    setMyRemotePlayerId(1);
    const world = createSinglePlayerMatch();
    applyFrame(world);
    startLoop();
  }, [applyFrame, startLoop, stopLoop]);

  const startRemoteRound = useCallback(() => {
    if (!isConnected || myRemotePlayerId !== 1) return;
    const world = createRemoteMatch();
    localInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
    remoteInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
    applyFrame(world);
    startLoop();
    send({
      type: "match_start",
      seed: Date.now(),
      snapshot: cloneSnapshot(world),
      timestamp: Date.now(),
    });
  }, [applyFrame, isConnected, myRemotePlayerId, send, startLoop]);

  const exitToMenu = useCallback(() => {
    if (modeRef.current === "remote" && isConnected) {
      send({ type: "menu_exit", timestamp: Date.now() });
    }
    stopLoop();
    setMode("menu");
    setSnapshot(null);
    setWinner(null);
    setMyRemotePlayerId(null);
    setRemotePeerLabel(null);
    setLatencyMs(null);
    setLastRemoteMessageAt(null);
    localInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
    remoteInputRef.current = { up: false, down: false, left: false, right: false, fire: false };
  }, [isConnected, send, stopLoop]);

  const localTank = useMemo(() => {
    if (!snapshot) return null;
    const pid = mode === "remote" ? myRemotePlayerId : 1;
    return snapshot.tanks.find((tank) => tank.playerId === pid) ?? null;
  }, [mode, myRemotePlayerId, snapshot]);

  const opponentTank = useMemo(() => {
    if (!snapshot) return null;
    if (mode === "single") {
      return snapshot.tanks.find((tank) => tank.team === "enemy" && tank.alive) ?? null;
    }
    const pid = myRemotePlayerId === 1 ? 2 : 1;
    return snapshot.tanks.find((tank) => tank.playerId === pid) ?? null;
  }, [mode, myRemotePlayerId, snapshot]);

  const enemyCount = useMemo(
    () => snapshot?.tanks.filter((tank) => tank.team === "enemy" && tank.alive).length ?? 0,
    [snapshot]
  );

  const connectionDescription = [
    "Share your peer ID with a friend.",
    "Or enter their peer ID to establish a direct remote duel.",
  ];

  const closeGuide = useCallback(() => {
    setShowGuide(false);
    window.localStorage.setItem("steel_duel_guide_seen", "1");
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-accent)] shadow-[0_0_10px_var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-[10px]"
        >
          ← BACK
        </Link>
      </motion.div>

      <div className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
        <button
          onClick={() => setShowGuide(true)}
          className="inline-flex border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[8px] tracking-wider text-[var(--pixel-muted)] shadow-[0_0_10px_var(--pixel-glow)] backdrop-blur-md transition-colors hover:text-[var(--pixel-accent)] md:text-[10px]"
        >
          HELP
        </button>
      </div>

      <div className="container relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-3 py-6 md:px-4 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 text-center md:mb-8"
        >
          <h1 className="mb-2 font-[family-name:var(--font-press-start)] text-xl tracking-wider text-[var(--pixel-accent)] md:mb-3 md:text-5xl">
            [ STEEL_DUEL ]
          </h1>
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--pixel-muted)] md:text-sm">
            &gt; arena shooter · bots · buffs · remote duel
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex max-w-[760px] flex-col items-center gap-4"
            >
              <button
                onClick={startSingle}
                className="w-full border-2 border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-[family-name:var(--font-press-start)] text-sm tracking-wider text-[var(--pixel-accent)] shadow-[0_0_20px_var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                [ SINGLE_PLAYER ]
              </button>

              <button
                onClick={() => setMode("remote")}
                className="w-full border-2 border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-[family-name:var(--font-press-start)] text-sm tracking-wider text-[var(--pixel-accent-2)] shadow-[0_0_20px_var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                [ REMOTE_P2P ]
              </button>
            </motion.div>
          )}

          {mode === "remote" && !isConnected && (
            <motion.div
              key="remote-setup"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-[760px] px-2 md:px-0"
            >
              <P2PConnectionPanel
                localPeerId={localPeerId}
                phase={phase}
                connectTimeoutMs={P2P_CONNECT_TIMEOUT_MS}
                error={error}
                description={connectionDescription}
                onConnect={connect}
                onRetry={retryLastConnection}
                onClearError={clearError}
                onReinitialize={reinitialize}
              />
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setMode("menu")}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-muted)]"
                >
                  MENU
                </button>
              </div>
            </motion.div>
          )}

          {mode !== "menu" && snapshot && (mode !== "remote" || isConnected) && (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex w-full flex-col items-center gap-4"
            >
              <GameHUD
                mode={mode === "single" ? "single" : "remote"}
                elapsedMs={snapshot.elapsedMs}
                localTank={localTank}
                opponentTank={opponentTank}
                enemyCount={enemyCount}
                winner={winner}
                isHost={myRemotePlayerId === 1}
              />

              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                <button
                  onClick={exitToMenu}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-muted)]"
                >
                  MENU
                </button>

                <button
                  onClick={() => {
                    if (mode === "single") startSingle();
                    else startRemoteRound();
                  }}
                  disabled={mode === "remote" && myRemotePlayerId !== 1}
                  className="border-2 border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent-2)] disabled:opacity-40"
                >
                  NEW_MATCH
                </button>

                <div className="hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[10px] uppercase text-[var(--pixel-muted)] md:block">
                  controls: move WASD / arrows · hold space or FIRE to shoot
                </div>
              </div>

              <ArenaView
                tanks={snapshot.tanks}
                bullets={snapshot.bullets}
                pickups={snapshot.pickups}
                explosions={snapshot.explosions}
                viewportScale={viewportScale}
              />

              <MobileControls
                hidden={mode === "menu"}
                onMove={(direction) => {
                  if (direction === "up") {
                    setInputKey("up", true);
                    window.setTimeout(() => setInputKey("up", false), 120);
                  }
                  if (direction === "down") {
                    setInputKey("down", true);
                    window.setTimeout(() => setInputKey("down", false), 120);
                  }
                  if (direction === "left") {
                    setInputKey("left", true);
                    window.setTimeout(() => setInputKey("left", false), 120);
                  }
                  if (direction === "right") {
                    setInputKey("right", true);
                    window.setTimeout(() => setInputKey("right", false), 120);
                  }
                }}
                onFirePress={() => setInputKey("fire", true)}
                onFireRelease={() => setInputKey("fire", false)}
              />

              <div className="flex flex-wrap justify-center gap-4 text-xs font-[family-name:var(--font-jetbrains)] text-[var(--pixel-muted)]">
                <div>
                  <span className="text-[var(--pixel-accent)]">MOVE:</span> WASD or Arrow Keys
                </div>
                <div>
                  <span className="text-[var(--pixel-warn)]">FIRE:</span> Space / mobile fire button
                </div>
                <div>
                  <span className="text-[var(--pixel-accent-2)]">PICKUPS:</span> heal, fire-rate,
                  damage, bullet speed, move speed
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {flashMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 top-20 z-50 -translate-x-1/2 border-2 border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)] backdrop-blur-xl"
          >
            {flashMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-[760px] border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 backdrop-blur-xl md:p-6"
            >
              <div className="mb-4 font-[family-name:var(--font-press-start)] text-sm text-[var(--pixel-accent)] md:text-lg">
                [ OPERATION GUIDE ]
              </div>

              <div className="grid gap-4 font-[family-name:var(--font-jetbrains)] text-sm text-[var(--pixel-text)] md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-[var(--pixel-accent)]">Basic Controls</div>
                  <div>• Move with WASD or Arrow Keys</div>
                  <div>• Hold Space to keep firing</div>
                  <div>• On mobile, use the bottom directional pad and FIRE button</div>
                  <div>• Use cover. Walls block both movement and bullets</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[var(--pixel-accent-2)]">Modes</div>
                  <div>• Single Player: fight multiple AI tanks</div>
                  <div>• Remote P2P: host is Player 1, guest is Player 2</div>
                  <div>• In remote mode, only host can start a new round</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[var(--pixel-warn)]">Buffs</div>
                  <div>• Heal: restore 1 HP</div>
                  <div>• Rapid Fire: lower shot cooldown</div>
                  <div>• Damage Boost: stronger next shots</div>
                  <div>• Bullet Speed / Speed Boost: faster projectiles or movement</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[var(--pixel-accent)]">Objective</div>
                  <div>• Everyone starts with 3 HP</div>
                  <div>• Single Player: eliminate all bots</div>
                  <div>• Remote Duel: deplete the rival's HP first</div>
                  <div>• Watch cooldown, buffs, and latency panels</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  onClick={closeGuide}
                  className="border-2 border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-4 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)]"
                >
                  GOT IT
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {mode === "remote" && (
        <P2PStatusPanel
          isConnected={isConnected}
          phase={phase}
          role={
            myRemotePlayerId === 1
              ? "host / player 1"
              : myRemotePlayerId === 2
              ? "guest / player 2"
              : "unknown"
          }
          localPeerId={localPeerId}
          remotePeerId={remotePeerLabel}
          latencyMs={latencyMs}
          lastRemoteMessageAt={lastRemoteMessageAt}
        />
      )}
    </div>
  );
}