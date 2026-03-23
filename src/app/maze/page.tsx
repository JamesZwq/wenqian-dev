"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { generateMaze, generateGoal, canMove, type Maze } from "./mazeGenerator";
import { usePeerConnection } from "../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../features/p2p/config";
import P2PConnectionPanel from "../../features/p2p/components/P2PConnectionPanel";
import { P2PStatusPanel } from "../../features/p2p/components/P2PStatusPanel";
import SettingsPanel, {
  DEFAULT_SETTINGS,
  type GameSettings,
} from "./SettingsPanel";
import {
  spawnItem,
  nextSpawnDelay,
  bfsShortestPath,
  ITEM_META,
  MAX_INVENTORY,
  type MazeItem,
  type ItemType,
  type ActiveEffect,
  type InventorySlot,
} from "./items";

type Position = { row: number; col: number };
type Trail = { row: number; col: number; timestamp: number; playerId: number };
type RevealCell = { row: number; col: number; delay: number };
type Direction = "up" | "down" | "left" | "right";
type AnimatedCircleProps = {
  x: number;
  y: number;
  radius: number;
  fill: string;
};

type QueueMove = {
  playerId: 1 | 2;
  direction: Direction;
  source: "local" | "remote";
};

type GameMode = "menu" | "single" | "local" | "remote";

type MazePacket =
  | {
      type: "maze_sync";
      maze: Maze;
      settings: GameSettings;
      goalPos: Position;
      timestamp: number;
    }
  | {
      type: "bomb";
      row: number;
      col: number;
      direction: Direction;
      timestamp: number;
    }
  | {
      type: "move";
      playerId: 1 | 2;
      direction: Direction;
      timestamp: number;
    }
  | {
      type: "game_over";
      winner: 1 | 2;
      elapsedTime: number;
      timestamp: number;
    }
  | {
      type: "ping";
      sentAt: number;
    }
  | {
      type: "pong";
      sentAt: number;
    }
  | {
      type: "menu_exit";
      timestamp: number;
    }
  | {
      type: "item_spawn";
      item: MazeItem;
      timestamp: number;
    }
  | {
      type: "item_pickup";
      itemId: string;
      playerId: 1 | 2;
      timestamp: number;
    }
  | {
      type: "item_use";
      playerId: 1 | 2;
      itemType: ItemType;
      timestamp: number;
    }
  | {
      type: "item_effect";
      effect: ActiveEffect;
      timestamp: number;
    };

const MOVE_DURATION = 0.07;
const MOVE_UNLOCK_MS = 50;
const INPUT_QUEUE_LIMIT = 12;

function AnimatedCircle({ x, y, radius, fill }: AnimatedCircleProps) {
  return (
    <motion.circle
      cx={x}
      cy={y}
      r={radius}
      fill={fill}
      initial={false}
      animate={{ cx: x, cy: y }}
      transition={{
        duration: MOVE_DURATION,
        ease: "linear",
      }}
    />
  );
}

export default function MazePage() {
  const [cellSize, setCellSize] = useState(30);
  const joinPeerId = useJoinParam();
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [maze, setMaze] = useState<Maze | null>(null);
  const [generationMaze, setGenerationMaze] = useState<Maze | null>(null);
  const [revealCells, setRevealCells] = useState<RevealCell[]>([]);
  const [mazeGenerationProgress, setMazeGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const [mode, setMode] = useState<GameMode>("menu");
  const [player1Pos, setPlayer1Pos] = useState<Position>({ row: 0, col: 0 });
  const [player2Pos, setPlayer2Pos] = useState<Position | null>(null);
  const [goalPos, setGoalPos] = useState<Position>({ row: 0, col: 0 });
  const [trail, setTrail] = useState<Trail[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameEndTime, setGameEndTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [, setInputQueueVersion] = useState(0);

  const [myRemotePlayerId, setMyRemotePlayerId] = useState<1 | 2 | null>(null);
  const [remotePeerLabel, setRemotePeerLabel] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<
    number | null
  >(null);

  // Item system state
  const [fieldItems, setFieldItems] = useState<MazeItem[]>([]);
  const [p1Inventory, setP1Inventory] = useState<InventorySlot[]>([
    null,
    null,
  ]);
  const [p2Inventory, setP2Inventory] = useState<InventorySlot[]>([
    null,
    null,
  ]);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [xrayPath, setXrayPath] = useState<{ row: number; col: number }[]>([]);
  const [bombMode, setBombMode] = useState<{
    playerId: 1 | 2;
    active: boolean;
  } | null>(null);

  // D-pad state (mobile)
  const [dpadVisible, setDpadVisible] = useState(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const generationIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const generationTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const moveUnlockTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const buildCleanupTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const itemSpawnTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const effectCleanupRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const isMovingRef = useRef(false);
  const inputQueueRef = useRef<QueueMove[]>([]);
  const mazeRef = useRef<Maze | null>(null);
  const modeRef = useRef<GameMode>("menu");
  const player1PosRef = useRef<Position>({ row: 0, col: 0 });
  const player2PosRef = useRef<Position | null>(null);
  const goalPosRef = useRef<Position>({ row: 0, col: 0 });
  const gameEndTimeRef = useRef<number | null>(null);
  const myRemotePlayerIdRef = useRef<1 | 2 | null>(null);
  const sendRef = useRef<((payload: MazePacket) => void) | null>(null);
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const fieldItemsRef = useRef<MazeItem[]>([]);
  const p1InventoryRef = useRef<InventorySlot[]>([null, null]);
  const p2InventoryRef = useRef<InventorySlot[]>([null, null]);
  const activeEffectsRef = useRef<ActiveEffect[]>([]);

  const mazeRows = settings.rows;
  const mazeCols = settings.cols;
  const totalCells = useMemo(() => mazeRows * mazeCols, [mazeRows, mazeCols]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    fieldItemsRef.current = fieldItems;
  }, [fieldItems]);

  useEffect(() => {
    p1InventoryRef.current = p1Inventory;
  }, [p1Inventory]);

  useEffect(() => {
    p2InventoryRef.current = p2Inventory;
  }, [p2Inventory]);

  useEffect(() => {
    activeEffectsRef.current = activeEffects;
  }, [activeEffects]);

  useEffect(() => {
    const updateCellSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const horizontalPadding = viewportWidth < 768 ? 32 : 96;
      const verticalReserved = viewportWidth < 768 ? 280 : 300;

      const maxBoardWidth = viewportWidth - horizontalPadding;
      const maxBoardHeight = viewportHeight - verticalReserved;

      const nextSize = Math.floor(
        Math.min(maxBoardWidth / mazeCols, maxBoardHeight / mazeRows)
      );

      setCellSize(Math.max(14, Math.min(30, nextSize)));
    };

    updateCellSize();
    window.addEventListener("resize", updateCellSize);
    return () => window.removeEventListener("resize", updateCellSize);
  }, [mazeCols, mazeRows]);

  useEffect(() => {
    mazeRef.current = maze;
  }, [maze]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    player1PosRef.current = player1Pos;
  }, [player1Pos]);

  useEffect(() => {
    player2PosRef.current = player2Pos;
  }, [player2Pos]);

  useEffect(() => {
    gameEndTimeRef.current = gameEndTime;
  }, [gameEndTime]);

  useEffect(() => {
    myRemotePlayerIdRef.current = myRemotePlayerId;
  }, [myRemotePlayerId]);

  const clearBuildTimers = useCallback(() => {
    if (generationIntervalRef.current)
      clearInterval(generationIntervalRef.current);
    if (generationTimeoutRef.current)
      clearTimeout(generationTimeoutRef.current);
    if (buildCleanupTimeoutRef.current)
      clearTimeout(buildCleanupTimeoutRef.current);
    generationIntervalRef.current = undefined;
    generationTimeoutRef.current = undefined;
    buildCleanupTimeoutRef.current = undefined;
  }, []);

  const clearItemTimers = useCallback(() => {
    if (itemSpawnTimeoutRef.current) clearTimeout(itemSpawnTimeoutRef.current);
    if (effectCleanupRef.current) clearTimeout(effectCleanupRef.current);
    itemSpawnTimeoutRef.current = undefined;
    effectCleanupRef.current = undefined;
  }, []);

  useEffect(() => {
    return () => {
      clearBuildTimers();
      clearItemTimers();
      if (moveUnlockTimeoutRef.current)
        clearTimeout(moveUnlockTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [clearBuildTimers, clearItemTimers]);

  // Effect cleanup timer — removes expired effects
  useEffect(() => {
    if (activeEffects.length === 0) return;

    const now = Date.now();
    const nextExpiry = Math.min(...activeEffects.map((e) => e.expiresAt));
    const delay = Math.max(0, nextExpiry - now);

    effectCleanupRef.current = setTimeout(() => {
      const current = Date.now();
      setActiveEffects((prev) => prev.filter((e) => e.expiresAt > current));
      // Clear xray path if X_RAY effect expired
      setXrayPath((prev) => {
        const hasXray = activeEffectsRef.current.some(
          (e) => e.type === "X_RAY" && e.expiresAt > current
        );
        return hasXray ? prev : [];
      });
    }, delay);

    return () => {
      if (effectCleanupRef.current) clearTimeout(effectCleanupRef.current);
    };
  }, [activeEffects]);

  const formatQueueLabel = useCallback(
    (move: { playerId: 1 | 2; direction: Direction }) => {
      const dirMap: Record<Direction, string> = {
        up: "↑",
        down: "↓",
        left: "←",
        right: "→",
      };
      return `P${move.playerId}${dirMap[move.direction]}`;
    },
    []
  );

  const resetItemState = useCallback(() => {
    setFieldItems([]);
    setP1Inventory([null, null]);
    setP2Inventory([null, null]);
    setActiveEffects([]);
    setXrayPath([]);
    setBombMode(null);
    fieldItemsRef.current = [];
    p1InventoryRef.current = [null, null];
    p2InventoryRef.current = [null, null];
    activeEffectsRef.current = [];
    clearItemTimers();
  }, [clearItemTimers]);

  const resetRuntimeState = useCallback(
    (nextMode: GameMode, withPlayer2: boolean) => {
      isMovingRef.current = false;
      inputQueueRef.current = [];
      setInputQueueVersion((v) => v + 1);
      setMode(nextMode);
      setWinner(null);
      setGameEndTime(null);
      setGameStartTime(null);
      setElapsedTime(0);
      setTrail([]);
      setPlayer1Pos({ row: 0, col: 0 });
      setPlayer2Pos(withPlayer2 ? { row: 0, col: 0 } : null);
      player1PosRef.current = { row: 0, col: 0 };
      player2PosRef.current = withPlayer2 ? { row: 0, col: 0 } : null;
      gameEndTimeRef.current = null;
      resetItemState();
    },
    [resetItemState]
  );

  // Schedule item spawning
  const scheduleItemSpawn = useCallback(() => {
    const s = settingsRef.current;
    if (!s.itemsEnabled) return;

    const delay = nextSpawnDelay(s.itemFrequency);
    itemSpawnTimeoutRef.current = setTimeout(() => {
      const currentMaze = mazeRef.current;
      if (!currentMaze || gameEndTimeRef.current) return;

      const newItem = spawnItem(
        currentMaze,
        fieldItemsRef.current,
        player1PosRef.current,
        player2PosRef.current
      );

      if (newItem) {
        setFieldItems((prev) => [...prev, newItem]);

        // Sync in remote mode if we're host
        if (
          modeRef.current === "remote" &&
          myRemotePlayerIdRef.current === 1
        ) {
          sendRef.current?.({
            type: "item_spawn",
            item: newItem,
            timestamp: Date.now(),
          });
        }
      }

      scheduleItemSpawn();
    }, delay);
  }, []);

  const finalizeBuiltMaze = useCallback(
    (nextMaze: Maze, withPlayer2: boolean, precomputedGoal?: Position) => {
      const goal = precomputedGoal ?? generateGoal(nextMaze, settingsRef.current.difficulty);
      setMaze(nextMaze);
      mazeRef.current = nextMaze;
      setGoalPos(goal);
      goalPosRef.current = goal;
      setPlayer1Pos({ row: 0, col: 0 });
      setPlayer2Pos(withPlayer2 ? { row: 0, col: 0 } : null);
      player1PosRef.current = { row: 0, col: 0 };
      player2PosRef.current = withPlayer2 ? { row: 0, col: 0 } : null;
      setGameStartTime(Date.now());
      setIsGenerating(false);

      buildCleanupTimeoutRef.current = setTimeout(() => {
        setGenerationMaze(null);
        setRevealCells([]);
        setMazeGenerationProgress(1);
      }, 260);

      // Start item spawning if enabled and not remote guest
      if (
        settingsRef.current.itemsEnabled &&
        !(
          modeRef.current === "remote" && myRemotePlayerIdRef.current === 2
        )
      ) {
        scheduleItemSpawn();
      }
    },
    [scheduleItemSpawn]
  );

  const runBuildAnimation = useCallback(
    (nextMaze: Maze, nextMode: GameMode, withPlayer2: boolean, precomputedGoal?: Position) => {
      clearBuildTimers();
      clearItemTimers();
      resetRuntimeState(nextMode, withPlayer2);

      const rows = nextMaze.length;
      const cols = nextMaze[0].length;

      setGenerationMaze(nextMaze);
      setRevealCells([]);
      setMazeGenerationProgress(0);
      setIsGenerating(true);

      const revealOrder: RevealCell[] = [];
      const centerRow = (rows - 1) / 2;
      const centerCol = (cols - 1) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.hypot(r - centerRow, c - centerCol);
          const delay = dist * 46 + ((r + c) % 3) * 16;
          revealOrder.push({ row: r, col: c, delay });
        }
      }

      revealOrder.sort((a, b) => a.delay - b.delay);

      const totalDuration = 900;
      const startedAt = performance.now();
      const totalC = rows * cols;

      generationIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - startedAt;
        const progress = Math.min(elapsed / totalDuration, 1);
        setMazeGenerationProgress(progress);

        const visibleCount = Math.min(
          totalC,
          Math.floor(progress * revealOrder.length * 1.05)
        );
        setRevealCells(revealOrder.slice(0, visibleCount));

        if (progress >= 1) {
          if (generationIntervalRef.current) {
            clearInterval(generationIntervalRef.current);
            generationIntervalRef.current = undefined;
          }
          finalizeBuiltMaze(nextMaze, withPlayer2, precomputedGoal);
        }
      }, 16);

      generationTimeoutRef.current = setTimeout(() => {
        if (generationIntervalRef.current) {
          clearInterval(generationIntervalRef.current);
          generationIntervalRef.current = undefined;
        }
        setMazeGenerationProgress(1);
        finalizeBuiltMaze(nextMaze, withPlayer2);
      }, totalDuration + 50);
    },
    [
      clearBuildTimers,
      clearItemTimers,
      finalizeBuiltMaze,
      resetRuntimeState,
    ]
  );

  // Apply item effect
  const applyItemEffect = useCallback(
    (playerId: 1 | 2, itemType: ItemType) => {
      const now = Date.now();
      const meta = ITEM_META[itemType];
      const opponentId: 1 | 2 = playerId === 1 ? 2 : 1;

      if (itemType === "BOMB") {
        // Enter bomb mode — player picks direction then presses space
        setBombMode({ playerId, active: true });
        return;
      }

      let effect: ActiveEffect | null = null;

      switch (itemType) {
        case "SPEED_BOOST":
          effect = {
            type: "SPEED_BOOST",
            targetPlayer: playerId,
            expiresAt: now + meta.duration,
          };
          break;
        case "SLOW_TRAP":
          effect = {
            type: "SLOW_TRAP",
            targetPlayer: opponentId,
            expiresAt: now + meta.duration,
          };
          break;
        case "FOG":
          effect = {
            type: "FOG",
            targetPlayer: opponentId,
            expiresAt: now + meta.duration,
          };
          break;
        case "X_RAY": {
          const currentMaze = mazeRef.current;
          const pos =
            playerId === 1
              ? player1PosRef.current
              : player2PosRef.current;
          if (currentMaze && pos) {
            const path = bfsShortestPath(
              currentMaze,
              pos.row,
              pos.col,
              goalPosRef.current.row,
              goalPosRef.current.col
            );
            setXrayPath(path);
          }
          effect = {
            type: "X_RAY",
            targetPlayer: playerId,
            expiresAt: now + meta.duration,
          };
          break;
        }
        case "FREEZE":
          effect = {
            type: "FREEZE",
            targetPlayer: opponentId,
            expiresAt: now + meta.duration,
          };
          break;
      }

      if (effect) {
        setActiveEffects((prev) => [...prev, effect]);

        if (modeRef.current === "remote" && sendRef.current) {
          sendRef.current({
            type: "item_effect",
            effect,
            timestamp: now,
          });
        }
      }
    },
    []
  );

  // Use item from inventory
  const useItem = useCallback(
    (playerId: 1 | 2) => {
      if (gameEndTimeRef.current || isGenerating) return;
      if (!settingsRef.current.itemsEnabled) return;

      const inv =
        playerId === 1
          ? p1InventoryRef.current
          : p2InventoryRef.current;
      const firstItem = inv.find((s) => s !== null);
      if (!firstItem) return;

      // Remove from inventory
      const setInv = playerId === 1 ? setP1Inventory : setP2Inventory;
      setInv((prev) => {
        const idx = prev.findIndex((s) => s !== null);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = null;
        return next;
      });

      // Sync in remote
      if (modeRef.current === "remote" && sendRef.current) {
        sendRef.current({
          type: "item_use",
          playerId,
          itemType: firstItem.type,
          timestamp: Date.now(),
        });
      }

      applyItemEffect(playerId, firstItem.type);
    },
    [applyItemEffect, isGenerating]
  );

  // Bomb wall break
  const executeBomb = useCallback(
    (playerId: 1 | 2, direction: Direction) => {
      const currentMaze = mazeRef.current;
      if (!currentMaze) return;

      const pos =
        playerId === 1
          ? player1PosRef.current
          : player2PosRef.current;
      if (!pos) return;

      const cell = currentMaze[pos.row][pos.col];
      const wallMap: Record<Direction, "top" | "bottom" | "left" | "right"> = {
        up: "top",
        down: "bottom",
        left: "left",
        right: "right",
      };
      const oppositeWall: Record<Direction, "top" | "bottom" | "left" | "right"> = {
        up: "bottom",
        down: "top",
        left: "right",
        right: "left",
      };
      const dr: Record<Direction, number> = {
        up: -1,
        down: 1,
        left: 0,
        right: 0,
      };
      const dc: Record<Direction, number> = {
        up: 0,
        down: 0,
        left: -1,
        right: 1,
      };

      const wall = wallMap[direction];
      if (!cell.walls[wall]) {
        setBombMode(null);
        return; // No wall to break
      }

      const nr = pos.row + dr[direction];
      const nc = pos.col + dc[direction];
      const rows = currentMaze.length;
      const cols = currentMaze[0].length;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
        setBombMode(null);
        return; // Can't break outer wall
      }

      // Break the wall
      const newMaze = currentMaze.map((row) =>
        row.map((c) => ({
          ...c,
          walls: { ...c.walls },
        }))
      );
      newMaze[pos.row][pos.col].walls[wall] = false;
      newMaze[nr][nc].walls[oppositeWall[direction]] = false;

      setMaze(newMaze);
      mazeRef.current = newMaze;
      setBombMode(null);

      // Sync bomb to remote peer
      if (modeRef.current === "remote") {
        sendRef.current?.({
          type: "bomb",
          row: pos.row,
          col: pos.col,
          direction,
          timestamp: Date.now(),
        });
      }
    },
    []
  );

  const handleRemotePacket = useCallback(
    (payload: MazePacket) => {
      if (!payload?.type) return;

      setLastRemoteMessageAt(Date.now());

      if (payload.type === "maze_sync") {
        // Apply remote settings
        if (payload.settings) {
          setSettings(payload.settings);
          settingsRef.current = payload.settings;
        }
        runBuildAnimation(payload.maze, "remote", true, payload.goalPos);
        return;
      }

      if (payload.type === "bomb") {
        const currentMaze = mazeRef.current;
        if (!currentMaze) return;
        const { row, col, direction } = payload;
        const wallMap: Record<Direction, "top" | "bottom" | "left" | "right"> = {
          up: "top", down: "bottom", left: "left", right: "right",
        };
        const oppositeWall: Record<Direction, "top" | "bottom" | "left" | "right"> = {
          up: "bottom", down: "top", left: "right", right: "left",
        };
        const dr: Record<Direction, number> = { up: -1, down: 1, left: 0, right: 0 };
        const dc: Record<Direction, number> = { up: 0, down: 0, left: -1, right: 1 };
        const nr = row + dr[direction];
        const nc = col + dc[direction];
        const rows = currentMaze.length;
        const cols = currentMaze[0].length;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
        const newMaze = currentMaze.map((r) =>
          r.map((c) => ({ ...c, walls: { ...c.walls } }))
        );
        newMaze[row][col].walls[wallMap[direction]] = false;
        newMaze[nr][nc].walls[oppositeWall[direction]] = false;
        setMaze(newMaze);
        mazeRef.current = newMaze;
        return;
      }

      if (payload.type === "move") {
        inputQueueRef.current.push({
          playerId: payload.playerId,
          direction: payload.direction,
          source: "remote",
        });
        setInputQueueVersion((v) => v + 1);
        return;
      }

      if (payload.type === "game_over") {
        gameEndTimeRef.current = payload.timestamp;
        setGameEndTime(payload.timestamp);
        setElapsedTime(payload.elapsedTime);
        setWinner(payload.winner);
        inputQueueRef.current = [];
        setInputQueueVersion((v) => v + 1);
        return;
      }

      if (payload.type === "ping") {
        sendRef.current?.({
          type: "pong",
          sentAt: payload.sentAt,
        });
        return;
      }

      if (payload.type === "pong") {
        setLatencyMs(Math.max(0, Date.now() - payload.sentAt));
        return;
      }

      if (payload.type === "menu_exit") {
        setMode("menu");
        setMaze(null);
        setGenerationMaze(null);
        setRevealCells([]);
        setWinner(null);
        setTrail([]);
        setMyRemotePlayerId(null);
        setRemotePeerLabel(null);
        resetItemState();
        return;
      }

      // Item-related packets
      if (payload.type === "item_spawn") {
        setFieldItems((prev) => [...prev, payload.item]);
        return;
      }

      if (payload.type === "item_pickup") {
        setFieldItems((prev) =>
          prev.filter((i) => i.id !== payload.itemId)
        );
        return;
      }

      if (payload.type === "item_use") {
        // Remote player used an item — remove from their inventory locally
        const setInv =
          payload.playerId === 1 ? setP1Inventory : setP2Inventory;
        setInv((prev) => {
          const idx = prev.findIndex((s) => s !== null);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = null;
          return next;
        });
        applyItemEffect(payload.playerId, payload.itemType);
        return;
      }

      if (payload.type === "item_effect") {
        setActiveEffects((prev) => [...prev, payload.effect]);
        return;
      }
    },
    [runBuildAnimation, resetItemState, applyItemEffect]
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
  } = usePeerConnection<MazePacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    onData: handleRemotePacket,
    acceptIncomingConnections: true,
    onConnected: ({ direction }) => {
      const assignedPlayerId = direction === "outgoing" ? 1 : 2;
      setMyRemotePlayerId(assignedPlayerId);
      setMode("remote");
      setLastRemoteMessageAt(Date.now());
      setRemotePeerLabel(
        direction === "outgoing" ? "outgoing peer" : "incoming peer"
      );

      if (direction === "outgoing") {
        const s = settingsRef.current;
        const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
        const goal = generateGoal(nextMaze, s.difficulty);
        runBuildAnimation(nextMaze, "remote", true, goal);
        send({
          type: "maze_sync",
          maze: nextMaze,
          settings: s,
          goalPos: goal,
          timestamp: Date.now(),
        });
      }
    },
    onDisconnected: () => {
      setMyRemotePlayerId(null);
      setRemotePeerLabel(null);
      setLatencyMs(null);
      setLastRemoteMessageAt(null);
      if (modeRef.current === "remote") {
        setMode("menu");
      }
    },
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    if (!isConnected) {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = undefined;
      }
      setLatencyMs(null);
      return;
    }

    pingIntervalRef.current = setInterval(() => {
      send({
        type: "ping",
        sentAt: Date.now(),
      });
    }, 2000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = undefined;
      }
    };
  }, [isConnected, send]);

  useEffect(() => {
    if (gameStartTime && !gameEndTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - gameStartTime);
      }, 50);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [gameStartTime, gameEndTime]);

  // Check if a player is frozen
  const isPlayerFrozen = useCallback(
    (playerId: 1 | 2) => {
      const now = Date.now();
      return activeEffects.some(
        (e) =>
          e.type === "FREEZE" &&
          e.targetPlayer === playerId &&
          e.expiresAt > now
      );
    },
    [activeEffects]
  );

  // Get effective move delay for a player
  const getEffectiveMoveDelay = useCallback(
    (playerId: 1 | 2) => {
      const now = Date.now();
      let delay = MOVE_UNLOCK_MS;

      for (const e of activeEffectsRef.current) {
        if (e.expiresAt <= now) continue;
        if (
          e.type === "SPEED_BOOST" &&
          e.targetPlayer === playerId
        ) {
          delay = Math.floor(delay / 2);
        }
        if (
          e.type === "SLOW_TRAP" &&
          e.targetPlayer === playerId
        ) {
          delay = delay * 2;
        }
      }

      return delay;
    },
    []
  );

  const processNextMoveRef = useRef<() => void>(() => {});

  const processNextMove = useCallback(() => {
    if (isGenerating || isMovingRef.current || gameEndTimeRef.current) {
      return;
    }

    const currentMaze = mazeRef.current;
    if (!currentMaze) {
      return;
    }

    const nextMove = inputQueueRef.current.shift();
    if (!nextMove) {
      return;
    }

    setInputQueueVersion((v) => v + 1);

    // Check if player is frozen
    const now = Date.now();
    const frozen = activeEffectsRef.current.some(
      (e) =>
        e.type === "FREEZE" &&
        e.targetPlayer === nextMove.playerId &&
        e.expiresAt > now
    );
    if (frozen) {
      processNextMoveRef.current();
      return;
    }

    const currentPos =
      nextMove.playerId === 1
        ? player1PosRef.current
        : player2PosRef.current;

    if (!currentPos) {
      processNextMoveRef.current();
      return;
    }

    if (
      !canMove(currentMaze, currentPos.row, currentPos.col, nextMove.direction)
    ) {
      processNextMoveRef.current();
      return;
    }

    let newRow = currentPos.row;
    let newCol = currentPos.col;

    switch (nextMove.direction) {
      case "up":
        newRow -= 1;
        break;
      case "down":
        newRow += 1;
        break;
      case "left":
        newCol -= 1;
        break;
      case "right":
        newCol += 1;
        break;
    }

    const newPos = { row: newRow, col: newCol };
    isMovingRef.current = true;

    setTrail((prev) => [
      ...prev,
      {
        row: newRow,
        col: newCol,
        timestamp: Date.now(),
        playerId: nextMove.playerId,
      },
    ]);

    if (nextMove.playerId === 1) {
      player1PosRef.current = newPos;
      setPlayer1Pos(newPos);
    } else {
      player2PosRef.current = newPos;
      setPlayer2Pos(newPos);
    }

    if (
      modeRef.current === "remote" &&
      nextMove.source === "local" &&
      isConnected
    ) {
      send({
        type: "move",
        playerId: nextMove.playerId,
        direction: nextMove.direction,
        timestamp: Date.now(),
      });
    }

    // Check for item pickup — auto-use immediately on mobile
    if (settingsRef.current.itemsEnabled) {
      const pickedItem = fieldItemsRef.current.find(
        (item) => item.row === newRow && item.col === newCol
      );
      if (pickedItem) {
        // Remove from field
        setFieldItems((prev) =>
          prev.filter((i) => i.id !== pickedItem.id)
        );

        // Apply effect immediately (no inventory step)
        applyItemEffect(nextMove.playerId, pickedItem.type);

        // Sync pickup + use
        if (
          modeRef.current === "remote" &&
          nextMove.source === "local" &&
          sendRef.current
        ) {
          sendRef.current({
            type: "item_pickup",
            itemId: pickedItem.id,
            playerId: nextMove.playerId,
            timestamp: Date.now(),
          });
          sendRef.current({
            type: "item_use",
            playerId: nextMove.playerId,
            itemType: pickedItem.type,
            timestamp: Date.now(),
          });
        }
      }
    }

    if (moveUnlockTimeoutRef.current) {
      clearTimeout(moveUnlockTimeoutRef.current);
    }

    const rows = currentMaze.length;
    const cols = currentMaze[0].length;

    if (newRow === goalPosRef.current.row && newCol === goalPosRef.current.col) {
      const finishedAt = Date.now();
      const finalElapsed = gameStartTime
        ? finishedAt - gameStartTime
        : elapsedTime;

      gameEndTimeRef.current = finishedAt;
      setGameEndTime(finishedAt);
      setElapsedTime(finalElapsed);
      setWinner(nextMove.playerId);
      inputQueueRef.current = [];
      setInputQueueVersion((v) => v + 1);
      isMovingRef.current = false;

      if (
        modeRef.current === "remote" &&
        nextMove.source === "local" &&
        isConnected
      ) {
        send({
          type: "game_over",
          winner: nextMove.playerId,
          elapsedTime: finalElapsed,
          timestamp: finishedAt,
        });
      }

      return;
    }

    const moveDelay = getEffectiveMoveDelay(nextMove.playerId);
    moveUnlockTimeoutRef.current = setTimeout(() => {
      isMovingRef.current = false;
      processNextMoveRef.current();
    }, moveDelay);
  }, [
    elapsedTime,
    gameStartTime,
    isConnected,
    isGenerating,
    send,
    getEffectiveMoveDelay,
  ]);

  useEffect(() => {
    processNextMoveRef.current = processNextMove;
    if (
      !isGenerating &&
      !isMovingRef.current &&
      inputQueueRef.current.length > 0
    ) {
      processNextMoveRef.current();
    }
  }, [isGenerating, processNextMove]);

  const queueMove = useCallback(
    (playerId: 1 | 2, direction: Direction) => {
      if (
        modeRef.current === "menu" ||
        isGenerating ||
        gameEndTimeRef.current
      ) {
        return;
      }

      if (modeRef.current === "single" && playerId !== 1) {
        return;
      }

      if (modeRef.current === "remote") {
        if (!isConnected || myRemotePlayerIdRef.current !== playerId) {
          return;
        }
      }

      const queue = inputQueueRef.current;
      const last = queue[queue.length - 1];
      if (
        last &&
        last.playerId === playerId &&
        last.direction === direction &&
        last.source === "local"
      ) {
        return;
      }

      if (queue.length >= INPUT_QUEUE_LIMIT) {
        queue.shift();
      }

      queue.push({ playerId, direction, source: "local" });
      setInputQueueVersion((v) => v + 1);
      processNextMoveRef.current();
    },
    [isConnected, isGenerating]
  );

  const handleTouchMove = useCallback(
    (direction: Direction) => {
      if (mode === "remote") {
        if (myRemotePlayerIdRef.current) {
          queueMove(myRemotePlayerIdRef.current, direction);
        }
        return;
      }

      queueMove(1, direction);
    },
    [mode, queueMove]
  );

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    // Double-tap detection for D-pad toggle
    if (modeRef.current === "menu") return;
    const now = Date.now();
    const last = lastTapRef.current;
    const dt = now - last.time;
    const dist = Math.hypot(touch.clientX - last.x, touch.clientY - last.y);
    lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    if (dt < 350 && dist < 60) {
      e.preventDefault();
      setDpadVisible((v) => !v);
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    }
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 20;
    touchStartRef.current = null;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    let direction: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? "right" : "left";
    } else {
      direction = dy > 0 ? "down" : "up";
    }
    handleTouchMove(direction);
  }, [handleTouchMove]);

  const handleTouchUseItem = useCallback(() => {
    if (mode === "remote") {
      if (myRemotePlayerIdRef.current) {
        useItem(myRemotePlayerIdRef.current);
      }
      return;
    }
    useItem(1);
  }, [mode, useItem]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "menu" || isGenerating) return;

      // Bomb mode: pick direction with arrow/WASD, confirm with space
      if (bombMode?.active) {
        const dirKeys: Record<string, Direction> = {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
          w: "up",
          W: "up",
          s: "down",
          S: "down",
          a: "left",
          A: "left",
          d: "right",
          D: "right",
        };
        if (e.key in dirKeys) {
          e.preventDefault();
          executeBomb(bombMode.playerId, dirKeys[e.key]);
          return;
        }
        if (e.key === "Escape") {
          setBombMode(null);
          return;
        }
        return;
      }

      const localRemotePlayer = myRemotePlayerIdRef.current;

      // Item use keys
      if (mode === "remote") {
        if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E") {
          if (localRemotePlayer) {
            e.preventDefault();
            useItem(localRemotePlayer);
            return;
          }
        }
      } else if (mode === "local") {
        if (e.key === "q" || e.key === "Q") {
          e.preventDefault();
          useItem(1);
          return;
        }
        if (e.key === "/") {
          e.preventDefault();
          useItem(2);
          return;
        }
      } else if (mode === "single") {
        if (e.key === "q" || e.key === "Q") {
          e.preventDefault();
          useItem(1);
          return;
        }
      }

      if (mode === "remote") {
        if (!localRemotePlayer) return;

        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
          e.preventDefault();
          queueMove(localRemotePlayer, "up");
          return;
        }
        if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
          e.preventDefault();
          queueMove(localRemotePlayer, "down");
          return;
        }
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
          e.preventDefault();
          queueMove(localRemotePlayer, "left");
          return;
        }
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
          e.preventDefault();
          queueMove(localRemotePlayer, "right");
          return;
        }
        return;
      }

      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        queueMove(1, "up");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        queueMove(1, "down");
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        queueMove(1, "left");
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        queueMove(1, "right");
      }

      if (mode === "local") {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          queueMove(2, "up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          queueMove(2, "down");
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          queueMove(2, "left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          queueMove(2, "right");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, mode, queueMove, useItem, bombMode, executeBomb]);

  const startSingleGame = useCallback(() => {
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    setMyRemotePlayerId(null);
    runBuildAnimation(nextMaze, "single", true); // withPlayer2=true for AI
  }, [runBuildAnimation]);

  // AI greedy loop — runs for player 2 in single mode
  // Greedy: at each step pick the direction that minimises Manhattan distance to goal.
  // Speed: 20% faster than the player's base move delay (MOVE_UNLOCK_MS * 0.8).
  const aiIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const AI_MOVE_MS = Math.round(MOVE_UNLOCK_MS * 0.8); // 40ms — 20% faster than player

  useEffect(() => {
    if (mode !== "single" || isGenerating || gameEndTime) {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = undefined;
      }
      return;
    }

    aiIntervalRef.current = setInterval(() => {
      const currentMaze = mazeRef.current;
      const pos = player2PosRef.current;
      const goal = goalPosRef.current;
      if (!currentMaze || !pos || gameEndTimeRef.current) return;

      const DIRS: [Direction, number, number][] = [
        ["up",    -1,  0],
        ["down",   1,  0],
        ["left",   0, -1],
        ["right",  0,  1],
      ];

      // Greedy: pick the walkable direction that minimises Manhattan distance to goal
      let bestDir: Direction | null = null;
      let bestDist = Infinity;
      for (const [dir, dr, dc] of DIRS) {
        if (!canMove(currentMaze, pos.row, pos.col, dir)) continue;
        const nr = pos.row + dr;
        const nc = pos.col + dc;
        const dist = Math.abs(nr - goal.row) + Math.abs(nc - goal.col);
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = dir;
        }
      }

      if (bestDir) {
        // Push directly to the queue as a "local" move for player 2
        const queue = inputQueueRef.current;
        if (queue.length < INPUT_QUEUE_LIMIT) {
          queue.push({ playerId: 2, direction: bestDir, source: "local" });
          processNextMoveRef.current();
        }
      }
    }, AI_MOVE_MS);

    return () => {
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = undefined;
      }
    };
  }, [mode, isGenerating, gameEndTime]);

  const startLocalGame = useCallback(() => {
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    setMyRemotePlayerId(null);
    runBuildAnimation(nextMaze, "local", true);
  }, [runBuildAnimation]);

  const startRemoteRound = useCallback(() => {
    if (!isConnected || myRemotePlayerIdRef.current !== 1) return;
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    const goal = generateGoal(nextMaze, s.difficulty);
    runBuildAnimation(nextMaze, "remote", true, goal);
    send({
      type: "maze_sync",
      maze: nextMaze,
      settings: s,
      goalPos: goal,
      timestamp: Date.now(),
    });
  }, [isConnected, runBuildAnimation, send]);

  const exitToMenu = useCallback(() => {
    if (modeRef.current === "remote" && isConnected) {
      send({ type: "menu_exit", timestamp: Date.now() });
    }
    setMode("menu");
    setMaze(null);
    setGenerationMaze(null);
    setRevealCells([]);
    setWinner(null);
    setTrail([]);
    setElapsedTime(0);
    setGameStartTime(null);
    setGameEndTime(null);
    setMyRemotePlayerId(null);
    setRemotePeerLabel(null);
    setLatencyMs(null);
    setLastRemoteMessageAt(null);
    resetItemState();
  }, [isConnected, send, resetItemState]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, "0")}s`;
  };

  const displayMaze = isGenerating
    ? generationMaze ?? maze
    : maze ?? generationMaze;

  const generationRevealLookup = useMemo(() => {
    const revealed = new Set<string>();
    for (const cell of revealCells) {
      revealed.add(`${cell.row}-${cell.col}`);
    }
    return revealed;
  }, [revealCells]);

  const revealedCellCount = generationRevealLookup.size;
  const queueSnapshot = inputQueueRef.current;
  const remoteStatusLabel =
    myRemotePlayerId === 1
      ? "REMOTE P1 / HOST"
      : myRemotePlayerId === 2
        ? "REMOTE P2 / GUEST"
        : "NOT ASSIGNED";

  const connectionDescription = [
    "Share your peer ID with a friend.",
    "Or enter their peer ID to establish a direct remote race session.",
  ];

  // Fog visibility check
  const fogVisibleCells = useMemo(() => {
    const now = Date.now();
    // Check if P1 is fogged
    const p1Fogged = activeEffects.some(
      (e) => e.type === "FOG" && e.targetPlayer === 1 && e.expiresAt > now
    );
    const p2Fogged = activeEffects.some(
      (e) => e.type === "FOG" && e.targetPlayer === 2 && e.expiresAt > now
    );
    return { p1Fogged, p2Fogged };
  }, [activeEffects]);

  // For fog: determine which cells should be dimmed for the local view
  const foggedCells = useMemo(() => {
    if (!displayMaze) return null;
    const { p1Fogged, p2Fogged } = fogVisibleCells;

    // In single mode, only P1 matters
    // In local mode, we show fog overlay for affected player's side
    // In remote mode, only our player matters
    let foggedPlayer: 1 | 2 | null = null;
    if (mode === "remote") {
      if (
        (myRemotePlayerId === 1 && p1Fogged) ||
        (myRemotePlayerId === 2 && p2Fogged)
      ) {
        foggedPlayer = myRemotePlayerId;
      }
    } else if (mode === "single" && p1Fogged) {
      foggedPlayer = 1;
    }
    // In local mode, we just show the fog effect visually but both can see

    if (!foggedPlayer) return null;

    const pos =
      foggedPlayer === 1 ? player1Pos : player2Pos;
    if (!pos) return null;

    const visible = new Set<string>();
    const fogRadius = 2;
    for (
      let r = Math.max(0, pos.row - fogRadius);
      r <= Math.min(displayMaze.length - 1, pos.row + fogRadius);
      r++
    ) {
      for (
        let c = Math.max(0, pos.col - fogRadius);
        c <= Math.min(displayMaze[0].length - 1, pos.col + fogRadius);
        c++
      ) {
        visible.add(`${r}-${c}`);
      }
    }
    return visible;
  }, [displayMaze, fogVisibleCells, mode, myRemotePlayerId, player1Pos, player2Pos]);

  // Settings gear button
  const SettingsGearButton = (
    <button
      onClick={() => setSettingsOpen(true)}
      className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] backdrop-blur-xl transition-colors hover:text-[var(--pixel-accent)]"
      title="Settings"
    >
      CFG
    </button>
  );

  // Inventory UI component
  const InventoryUI = ({
    playerId,
    inventory,
  }: {
    playerId: 1 | 2;
    inventory: InventorySlot[];
  }) => {
    const accentColor =
      playerId === 1 ? "var(--pixel-accent)" : "var(--pixel-accent-2)";

    return (
      <div className="flex items-center gap-1.5">
        <span
          className="font-sans font-semibold text-[8px]"
          style={{ color: accentColor }}
        >
          P{playerId}
        </span>
        {inventory.map((slot, i) => (
          <div
            key={i}
            className="flex h-7 w-7 items-center justify-center border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-xs"
            title={slot ? ITEM_META[slot.type].label : "Empty"}
          >
            {slot ? ITEM_META[slot.type].emoji : "·"}
          </div>
        ))}
      </div>
    );
  };

  const displayRows = displayMaze?.length ?? mazeRows;
  const displayCols = displayMaze?.[0]?.length ?? mazeCols;

  return (
    <div className="relative min-h-screen overflow-hidden">
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

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={(s) => {
          setSettings(s);
          settingsRef.current = s;
        }}
        onClose={() => {
          setSettingsOpen(false);
          // Auto-regenerate maze if currently in a game
          const m = modeRef.current;
          if (m === "single" || m === "local" || (m === "remote" && myRemotePlayerIdRef.current === 1)) {
            const s = settingsRef.current;
            const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
            if (m === "remote") {
              const goal = generateGoal(nextMaze, s.difficulty);
              runBuildAnimation(nextMaze, "remote", true, goal);
              sendRef.current?.({
                type: "maze_sync",
                maze: nextMaze,
                settings: s,
                goalPos: goal,
                timestamp: Date.now(),
              });
            } else {
              runBuildAnimation(nextMaze, m, m === "local");
            }
          }
        }}
      />

      <div className="container relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center px-3 py-6 md:px-4 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 text-center md:mb-8"
        >
          <h1 className="mb-2 font-sans font-semibold text-xl tracking-tight text-[var(--pixel-accent)] md:mb-3 md:text-5xl">
            MAZE RUNNER
          </h1>
          <p className="font-mono text-[11px] text-[var(--pixel-muted)] md:text-sm">
            &gt; Single / local versus / remote P2P maze race
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
                onClick={startSingleGame}
                className="w-full rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                SINGLE PLAYER
              </button>
              <button
                onClick={startLocalGame}
                className="w-full rounded-xl border border-[var(--pixel-warn)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-warn)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                LOCAL VS
              </button>
              <button
                onClick={() => setMode("remote")}
                className="w-full rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-8 py-4 font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent-2)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-[var(--pixel-bg-alt)]"
              >
                REMOTE P2P
              </button>
              <div className="mt-2">{SettingsGearButton}</div>
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
                autoConnectPeerId={joinPeerId}
                onConnect={connect}
                onRetry={retryLastConnection}
                onClearError={clearError}
                onReinitialize={reinitialize}
              />
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setMode("menu")}
                  className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)]"
                >
                  MENU
                </button>
                {SettingsGearButton}
              </div>
            </motion.div>
          )}

          {mode !== "menu" &&
            (mode !== "remote" || isConnected) &&
            displayMaze && (
              <motion.div
                key="game"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex w-full max-w-[900px] flex-wrap items-center justify-center gap-2 md:gap-4">
                  <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-xs text-[var(--pixel-accent)] backdrop-blur-xl md:px-4 md:text-sm">
                    {isGenerating
                      ? `BUILD ${Math.round((revealedCellCount / totalCells) * 100)}%`
                      : formatTime(elapsedTime)}
                  </div>


                  {mode === "remote" && (
                    <div className="rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-mono text-[10px] uppercase text-[var(--pixel-accent-2)] backdrop-blur-xl">
                      {remoteStatusLabel}
                    </div>
                  )}

                  <button
                    onClick={exitToMenu}
                    className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-muted)] backdrop-blur-xl transition-colors hover:text-[var(--pixel-accent)]"
                  >
                    MENU
                  </button>

                  <button
                    onClick={() => {
                      if (mode === "single") startSingleGame();
                      else if (mode === "local") startLocalGame();
                      else if (mode === "remote") startRemoteRound();
                    }}
                    disabled={mode === "remote" && myRemotePlayerId !== 1}
                    className="rounded-xl border border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-sans font-semibold text-[10px] text-[var(--pixel-accent-2)] backdrop-blur-xl transition-colors hover:bg-[var(--pixel-bg-alt)] disabled:opacity-40"
                  >
                    NEW_MAZE
                  </button>

                  {SettingsGearButton}
                </div>

                <div className="relative max-w-full overflow-auto rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-2 backdrop-blur-xl md:p-4">
                  <svg
                    width={displayCols * cellSize}
                    height={displayRows * cellSize}
                    className="block"
                    style={{ touchAction: "none" }}
                    onTouchStart={handleSwipeStart}
                    onTouchEnd={handleSwipeEnd}
                  >
                    {displayMaze.map((row, r) =>
                      row.map((cell, c) => (
                        <g key={`${r}-${c}`}>
                          {cell.walls.top && (
                            <line
                              x1={c * cellSize}
                              y1={r * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={r * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.right && (
                            <line
                              x1={(c + 1) * cellSize}
                              y1={r * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.bottom && (
                            <line
                              x1={c * cellSize}
                              y1={(r + 1) * cellSize}
                              x2={(c + 1) * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                          {cell.walls.left && (
                            <line
                              x1={c * cellSize}
                              y1={r * cellSize}
                              x2={c * cellSize}
                              y2={(r + 1) * cellSize}
                              stroke="var(--pixel-border)"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      ))
                    )}

                    <AnimatePresence>
                      {(isGenerating || generationMaze) && (
                        <motion.g
                          key="build-overlay"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{
                            opacity: 0,
                            transition: { duration: 0.26, ease: "easeOut" },
                          }}
                        >
                          <rect
                            x={0}
                            y={0}
                            width={displayCols * cellSize}
                            height={displayRows * cellSize}
                            fill="var(--pixel-bg)"
                            opacity={0.92}
                          />

                          {displayMaze.map((row, r) =>
                            row.map((cell, c) => {
                              const isRevealed =
                                generationRevealLookup.has(`${r}-${c}`);
                              if (!isRevealed) return null;

                              return (
                                <motion.g
                                  key={`visible-${r}-${c}`}
                                  initial={{ opacity: 0, scale: 0.82 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{
                                    duration: 0.13,
                                    ease: "easeOut",
                                  }}
                                  style={{
                                    transformOrigin: `${c * cellSize + cellSize / 2}px ${r * cellSize + cellSize / 2}px`,
                                  }}
                                >
                                  <motion.rect
                                    x={c * cellSize + 2}
                                    y={r * cellSize + 2}
                                    width={cellSize - 4}
                                    height={cellSize - 4}
                                    fill="var(--pixel-bg)"
                                    opacity={0.96}
                                    initial={{ opacity: 0, scale: 0.65 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{
                                      duration: 0.13,
                                      ease: "easeOut",
                                    }}
                                  />
                                  <motion.rect
                                    x={c * cellSize + 4}
                                    y={r * cellSize + 4}
                                    width={cellSize - 8}
                                    height={cellSize - 8}
                                    fill="var(--pixel-accent)"
                                    initial={{ opacity: 0, scale: 0.45 }}
                                    animate={{ opacity: 0.05, scale: 1 }}
                                    transition={{
                                      duration: 0.14,
                                      ease: "easeOut",
                                    }}
                                  />
                                  {cell.walls.top && (
                                    <line
                                      x1={c * cellSize}
                                      y1={r * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={r * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.right && (
                                    <line
                                      x1={(c + 1) * cellSize}
                                      y1={r * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.bottom && (
                                    <line
                                      x1={c * cellSize}
                                      y1={(r + 1) * cellSize}
                                      x2={(c + 1) * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                  {cell.walls.left && (
                                    <line
                                      x1={c * cellSize}
                                      y1={r * cellSize}
                                      x2={c * cellSize}
                                      y2={(r + 1) * cellSize}
                                      stroke="var(--pixel-border)"
                                      strokeWidth="2"
                                    />
                                  )}
                                </motion.g>
                              );
                            })
                          )}

                          {isGenerating && (
                            <>
                              <motion.rect
                                x={0}
                                y={
                                  mazeGenerationProgress *
                                    displayRows *
                                    cellSize -
                                  20
                                }
                                width={displayCols * cellSize}
                                height={40}
                                fill="var(--pixel-bg)"
                                opacity={0.32}
                                initial={false}
                                animate={{
                                  y:
                                    mazeGenerationProgress *
                                      displayRows *
                                      cellSize -
                                    20,
                                }}
                                transition={{
                                  ease: "linear",
                                  duration: 0.06,
                                }}
                              />
                              <motion.line
                                x1={0}
                                x2={displayCols * cellSize}
                                y1={
                                  mazeGenerationProgress *
                                  displayRows *
                                  cellSize
                                }
                                y2={
                                  mazeGenerationProgress *
                                  displayRows *
                                  cellSize
                                }
                                stroke="var(--pixel-accent)"
                                strokeWidth="2"
                                opacity={0.42}
                                initial={false}
                                animate={{
                                  y1:
                                    mazeGenerationProgress *
                                    displayRows *
                                    cellSize,
                                  y2:
                                    mazeGenerationProgress *
                                    displayRows *
                                    cellSize,
                                }}
                                transition={{
                                  ease: "linear",
                                  duration: 0.06,
                                }}
                              />
                            </>
                          )}
                        </motion.g>
                      )}
                    </AnimatePresence>

                    {/* Start cell */}
                    <rect
                      x={2}
                      y={2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      fill="var(--pixel-accent)"
                      opacity="0.2"
                    />
                    {/* End cell */}
                    <rect
                      x={goalPos.col * cellSize + 2}
                      y={goalPos.row * cellSize + 2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      fill="var(--pixel-warn)"
                      opacity="0.3"
                    />

                    {/* X-Ray path */}
                    {xrayPath.length > 1 &&
                      xrayPath.map((p, i) => (
                        <rect
                          key={`xray-${i}`}
                          x={p.col * cellSize + 4}
                          y={p.row * cellSize + 4}
                          width={cellSize - 8}
                          height={cellSize - 8}
                          fill="#00CED1"
                          opacity="0.25"
                          rx="2"
                        />
                      ))}

                    {/* Field items */}
                    {!isGenerating &&
                      settings.itemsEnabled &&
                      fieldItems.map((item) => {
                        const meta = ITEM_META[item.type];
                        const cx = item.col * cellSize + cellSize / 2;
                        const cy = item.row * cellSize + cellSize / 2;
                        const r = Math.max(5, cellSize * 0.3);
                        return (
                          <g key={item.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill={meta.color}
                              opacity="0.3"
                            />
                            <text
                              x={cx}
                              y={cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.max(8, cellSize * 0.4)}
                            >
                              {meta.emoji}
                            </text>
                          </g>
                        );
                      })}

                    {/* Trail */}
                    {trail.map((t, i) => {
                      const age = Date.now() - t.timestamp;
                      const opacity = Math.max(0, 1 - age / 1600);
                      const color =
                        t.playerId === 1
                          ? "var(--pixel-accent)"
                          : "var(--pixel-accent-2)";
                      return (
                        <motion.circle
                          key={i}
                          cx={t.col * cellSize + cellSize / 2}
                          cy={t.row * cellSize + cellSize / 2}
                          r={Math.max(3.5, cellSize * 0.15)}
                          fill={color}
                          opacity={opacity * 0.28}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: opacity * 0.28 }}
                          transition={{ duration: 0.06, ease: "linear" }}
                        />
                      );
                    })}

                    {/* Fog overlay */}
                    {foggedCells &&
                      !isGenerating &&
                      displayMaze.map((row, r) =>
                        row.map((_, c) => {
                          if (foggedCells.has(`${r}-${c}`)) return null;
                          return (
                            <rect
                              key={`fog-${r}-${c}`}
                              x={c * cellSize}
                              y={r * cellSize}
                              width={cellSize}
                              height={cellSize}
                              fill="var(--pixel-bg)"
                              opacity={0.85}
                            />
                          );
                        })
                      )}

                    {/* Player 1 */}
                    {!isGenerating && (
                      <AnimatedCircle
                        x={player1Pos.col * cellSize + cellSize / 2}
                        y={player1Pos.row * cellSize + cellSize / 2}
                        radius={Math.max(5, cellSize * 0.27)}
                        fill={
                          isPlayerFrozen(1)
                            ? "#87CEEB"
                            : "var(--pixel-accent)"
                        }
                      />
                    )}

                    {/* Player 2 */}
                    {player2Pos && !isGenerating && (
                      <AnimatedCircle
                        x={player2Pos.col * cellSize + cellSize / 2}
                        y={player2Pos.row * cellSize + cellSize / 2}
                        radius={Math.max(5, cellSize * 0.27)}
                        fill={
                          isPlayerFrozen(2)
                            ? "#87CEEB"
                            : "var(--pixel-accent-2)"
                        }
                      />
                    )}
                  </svg>
                </div>

                {/* Controls info + inventory */}
                <div className="flex flex-wrap justify-center gap-4 text-xs font-mono text-[var(--pixel-muted)]">
                  {mode === "single" && (
                    <div>
                      <span className="text-[var(--pixel-accent)]">P1:</span>{" "}
                      WASD
                    </div>
                  )}
                  {mode === "local" && (
                    <>
                      <div>
                        <span className="text-[var(--pixel-accent)]">
                          P1:
                        </span>{" "}
                        WASD
                      </div>
                      <div>
                        <span className="text-[var(--pixel-accent-2)]">
                          P2:
                        </span>{" "}
                        Arrows
                      </div>
                    </>
                  )}
                  {mode === "remote" && (
                    <div>
                      <span className="text-[var(--pixel-accent-2)]">
                        REMOTE:
                      </span>{" "}
                      WASD/Arrows
                    </div>
                  )}
                </div>

                {/* Bomb mode indicator */}
                {bombMode?.active && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-[#FF4500] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[9px] text-[#FF4500]"
                  >
                    BOMB: Press arrow key to choose wall direction (ESC to
                    cancel)
                  </motion.div>
                )}

                {/* Active effects display */}
                {activeEffects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeEffects.map((e, i) => {
                      const meta = ITEM_META[e.type];
                      const remaining = Math.max(
                        0,
                        Math.ceil((e.expiresAt - Date.now()) / 1000)
                      );
                      return (
                        <div
                          key={i}
                          className="border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-2 py-1 font-mono text-[9px]"
                          style={{ color: meta.color }}
                        >
                          {meta.emoji} P{e.targetPlayer} {remaining}s
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Backpack UI */}
                {settings.itemsEnabled && !isGenerating && (
                  <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 backdrop-blur-xl">
                    <InventoryUI playerId={1} inventory={p1Inventory} />
                    {player2Pos !== null && (
                      <InventoryUI playerId={2} inventory={p2Inventory} />
                    )}
                  </div>
                )}

                {/* Mobile: double-tap hint */}
                {(mode === "single" || mode === "local" || mode === "remote") && (
                  <div className="mt-1 text-center font-mono text-[9px] text-[var(--pixel-muted)] md:hidden">
                    Double-tap anywhere to {dpadVisible ? "hide" : "show"} D-pad
                  </div>
                )}

                {winner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-[var(--pixel-accent)] bg-[var(--pixel-card-bg)] px-6 py-4 text-center backdrop-blur-xl"
                  >
                    <div className="mb-2 font-sans font-semibold text-lg text-[var(--pixel-accent)]">
                      {mode === "single"
                        ? "COMPLETED!"
                        : mode === "remote"
                          ? winner === myRemotePlayerId
                            ? "YOU WIN!"
                            : "REMOTE WINS!"
                          : `PLAYER ${winner} WINS!`}
                    </div>
                    <div className="font-mono text-sm text-[var(--pixel-text)]">
                      Time: {formatTime(elapsedTime)}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

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

      {/* Mobile D-pad — double-tap maze to toggle, fixed at bottom center */}
      {mode !== "menu" && (mode !== "remote" || isConnected) && displayMaze && (
        <AnimatePresence>
            {dpadVisible && (
              <motion.div
                key="dpad"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden"
                style={{ touchAction: "none" }}
              >
                <div className="grid grid-cols-3 gap-2">
                  {/* Row 1: empty, Up, empty */}
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("up"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ↑
                  </button>
                  <div />
                  {/* Row 2: Left, (center gap), Right */}
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("left"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ←
                  </button>
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("right"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    →
                  </button>
                  {/* Row 3: empty, Down, empty */}
                  <div />
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleTouchMove("down"); }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-2xl text-[var(--pixel-accent)] shadow-lg active:scale-90 active:bg-[color-mix(in_oklab,var(--pixel-accent)_20%,transparent)]"
                    style={{ touchAction: "none" }}
                  >
                    ↓
                  </button>
                  <div />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      )}
    </div>
  );
}
