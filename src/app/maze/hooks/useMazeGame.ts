"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateMaze, generateGoal, canMove } from "../mazeGenerator";
import type { Maze } from "../mazeGenerator";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { DEFAULT_SETTINGS, type GameSettings } from "../SettingsPanel";
import {
  spawnItem, nextSpawnDelay, bfsShortestPath, ITEM_META, MAX_INVENTORY,
  type MazeItem, type ItemType, type ActiveEffect, type InventorySlot,
} from "../items";
import type { Position, Trail, RevealCell, Direction, QueueMove, GameMode, MazePacket } from "../types";
import { MOVE_UNLOCK_MS, INPUT_QUEUE_LIMIT, formatTime } from "../types";

export function useMazeGame() {
  const [cellSize, setCellSize] = useState(30);
  const cellSizeRef = useRef(30);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);
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

  // 星辰连线的稳定坐标 — 只在 xrayPath 变化时计算一次，不会因 re-render 抖动
  const xrayStars = useMemo(() => {
    if (xrayPath.length < 2) return [];
    const half = cellSize / 2;
    const jitter = cellSize * 0.28;
    const totalDur = 1.8;
    const pts: { x: number; y: number; isEnd: boolean; delay: number }[] = [];

    // 用确定性随机 (基于 index 的伪随机) 代替 Math.random
    const pseudo = (seed: number) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    // 起点
    const first = xrayPath[0];
    pts.push({ x: first.col * cellSize + half, y: first.row * cellSize + half, isEnd: false, delay: 0 });

    // 沿路径每隔 2-4 格采样一颗星
    let nextAt = 2 + Math.floor(pseudo(0) * 2);
    for (let i = 1; i < xrayPath.length - 1; i++) {
      if (i >= nextAt) {
        const c = xrayPath[i];
        const ox = (pseudo(i * 2) - 0.5) * jitter;
        const oy = (pseudo(i * 2 + 1) - 0.5) * jitter;
        pts.push({
          x: c.col * cellSize + half + ox,
          y: c.row * cellSize + half + oy,
          isEnd: false,
          delay: (i / xrayPath.length) * totalDur,
        });
        nextAt = i + 2 + Math.floor(pseudo(i * 3) * 2);
      }
    }

    // 终点
    const last = xrayPath[xrayPath.length - 1];
    pts.push({ x: last.col * cellSize + half, y: last.row * cellSize + half, isEnd: true, delay: totalDur });

    return pts;
  }, [xrayPath, cellSize]);

  const [bombMode, setBombMode] = useState<{
    playerId: 1 | 2;
    active: boolean;
  } | null>(null);

  // Bomb blast animation
  type BombBlast = { x: number; y: number; id: number };
  const [bombBlasts, setBombBlasts] = useState<BombBlast[]>([]);
  const bombBlastIdRef = useRef(0);

  // D-pad state (mobile)
  const [dpadVisible, setDpadVisible] = useState(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  // Touch detection — true after any touch event, items auto-use on mobile
  const isTouchRef = useRef(false);

  // AI DFS state (for local vs-AI mode)
  const isAiGameRef = useRef(false);
  const aiVisitedRef = useRef<Set<string>>(new Set());
  const aiStackRef = useRef<Position[]>([]); // explicit DFS stack
  const aiStepRef = useRef<(() => void) | null>(null);

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
      // 只清理过期的持续性状态，不再去动 X-Ray 的路径数据
      setActiveEffects((prev) => prev.filter((e) => e.expiresAt > current));
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
      aiVisitedRef.current = new Set();
      aiStackRef.current = [];
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

      const isSolo = modeRef.current === "single";
      const newItem = spawnItem(
        currentMaze,
        fieldItemsRef.current,
        player1PosRef.current,
        player2PosRef.current,
        isSolo
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

      // Don't clear revealCells yet — keep revealed SVG in DOM so AnimatePresence
      // can fade the whole overlay out smoothly without a jank-inducing mass deletion.
      setMazeGenerationProgress(1);

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

      // Trigger overlay exit animation immediately (no 260ms dark-screen gap)
      setGenerationMaze(null);

      // Clean up reveal data after exit animation completes
      buildCleanupTimeoutRef.current = setTimeout(() => {
        setRevealCells([]);
      }, 300);

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

      // 每 50ms 更新一次（而非 16ms），减少 React re-render 次数 3 倍
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
      }, 50);

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

            // 星辰连线动画总时长：totalDur(1.8s) + 最后一颗星动画(1.4s) + 终点光环(0.9s)
            setTimeout(() => {
              setXrayPath([]);
            }, 4200);
          }

          // X-Ray 是一次性视觉特效，不作为持续性状态加入 ActiveEffects
          // 直接 break，不要给 effect 变量赋值
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

  // Bomb wall break — scans in direction to find the first wall, then breaks it
  const executeBomb = useCallback(
    (playerId: 1 | 2, direction: Direction) => {
      const currentMaze = mazeRef.current;
      if (!currentMaze) return;

      const pos =
        playerId === 1
          ? player1PosRef.current
          : player2PosRef.current;
      if (!pos) return;

      const wallMap: Record<Direction, "top" | "bottom" | "left" | "right"> = {
        up: "top", down: "bottom", left: "left", right: "right",
      };
      const oppositeWall: Record<Direction, "top" | "bottom" | "left" | "right"> = {
        up: "bottom", down: "top", left: "right", right: "left",
      };
      const drMap: Record<Direction, number> = { up: -1, down: 1, left: 0, right: 0 };
      const dcMap: Record<Direction, number> = { up: 0, down: 0, left: -1, right: 1 };

      const wall = wallMap[direction];
      const rows = currentMaze.length;
      const cols = currentMaze[0].length;

      // Scan from player position outward to find the first wall in this direction
      let r = pos.row;
      let c = pos.col;
      while (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (currentMaze[r][c].walls[wall]) {
          // Found a wall — check if neighbor is in bounds (outer walls can't be broken)
          const nr = r + drMap[direction];
          const nc = c + dcMap[direction];
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
            // Outer wall — keep scanning is impossible, bomb fizzles
            setBombMode(null);
            return;
          }

          // Break the wall
          const newMaze = currentMaze.map((row) =>
            row.map((cl) => ({ ...cl, walls: { ...cl.walls } }))
          );
          newMaze[r][c].walls[wall] = false;
          newMaze[nr][nc].walls[oppositeWall[direction]] = false;
          setMaze(newMaze);
          mazeRef.current = newMaze;
          setBombMode(null);

          // Blast animation at the wall midpoint
          const cs = cellSizeRef.current;
          let bx: number, by: number;
          if (direction === "right") { bx = (c + 1) * cs; by = r * cs + cs / 2; }
          else if (direction === "left") { bx = c * cs; by = r * cs + cs / 2; }
          else if (direction === "down") { bx = c * cs + cs / 2; by = (r + 1) * cs; }
          else { bx = c * cs + cs / 2; by = r * cs; }
          const blastId = ++bombBlastIdRef.current;
          setBombBlasts((prev) => [...prev, { x: bx, y: by, id: blastId }]);
          setTimeout(() => {
            setBombBlasts((prev) => prev.filter((b) => b.id !== blastId));
          }, 800);

          // Sync bomb to remote peer
          if (modeRef.current === "remote") {
            sendRef.current?.({
              type: "bomb",
              row: r,
              col: c,
              direction,
              timestamp: Date.now(),
            });
          }
          return;
        }
        // No wall at this cell — advance to next cell in the direction
        r += drMap[direction];
        c += dcMap[direction];
      }

      // Reached maze edge without finding a breakable wall
      setBombMode(null);
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

        // Blast animation for remote bomb
        const cs = cellSizeRef.current;
        let bx: number, by: number;
        if (direction === "right") { bx = (col + 1) * cs; by = row * cs + cs / 2; }
        else if (direction === "left") { bx = col * cs; by = row * cs + cs / 2; }
        else if (direction === "down") { bx = col * cs + cs / 2; by = (row + 1) * cs; }
        else { bx = col * cs + cs / 2; by = row * cs; }
        const blastId = ++bombBlastIdRef.current;
        setBombBlasts((prev) => [...prev, { x: bx, y: by, id: blastId }]);
        setTimeout(() => {
          setBombBlasts((prev) => prev.filter((b) => b.id !== blastId));
        }, 800);
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
      setTrail([]);
      setXrayPath([]);
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

    // Check for item pickup
    if (settingsRef.current.itemsEnabled) {
      const pickedItem = fieldItemsRef.current.find(
        (item) => item.row === newRow && item.col === newCol
      );
      if (pickedItem) {
        // Remove from field
        setFieldItems((prev) =>
          prev.filter((i) => i.id !== pickedItem.id)
        );

        if (isTouchRef.current) {
          // Mobile: auto-use immediately
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
        } else {
          // Desktop: add to inventory, use with Q key
          const setInv = nextMove.playerId === 1 ? setP1Inventory : setP2Inventory;
          setInv((prev) => {
            const idx = prev.findIndex((s) => s === null);
            if (idx === -1) return prev; // inventory full
            const next = [...prev];
            next[idx] = { type: pickedItem.type };
            return next;
          });

          // Sync pickup only
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
          }
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
      // After player 2 move completes, trigger next AI step
      if (nextMove.playerId === 2) {
        aiStepRef.current?.();
      }
    }, moveDelay);
  }, [
    elapsedTime,
    gameStartTime,
    isConnected,
    isGenerating,
    send,
    getEffectiveMoveDelay,
    applyItemEffect,
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

      // In local mode, block player 2 keyboard input when it's an AI game
      if (modeRef.current === "local" && isAiGameRef.current && playerId === 2) {
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
      // Bomb mode: D-pad picks wall direction instead of moving
      if (bombMode?.active) {
        executeBomb(bombMode.playerId, direction);
        return;
      }

      if (mode === "remote") {
        if (myRemotePlayerIdRef.current) {
          queueMove(myRemotePlayerIdRef.current, direction);
        }
        return;
      }

      queueMove(1, direction);
    },
    [mode, queueMove, bombMode, executeBomb]
  );

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    isTouchRef.current = true;
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

      // 作弊键：分号触发 X-Ray（所有模式、任意玩家）
      // 用 e.code 兼容中文输入法（e.key 在中文模式下可能是 "；" 或 "Process"）
      if (e.code === "Semicolon" || e.key === ";" || e.key === "；") {
        e.preventDefault();
        const currentMaze = mazeRef.current;
        // remote 模式用自己的 playerId，其他模式默认 player1
        const myId = mode === "remote" ? myRemotePlayerIdRef.current : 1;
        const pos = myId === 2 ? player2PosRef.current : player1PosRef.current;
        if (currentMaze && pos && xrayPath.length === 0) {
          const path = bfsShortestPath(
            currentMaze,
            pos.row, pos.col,
            goalPosRef.current.row,
            goalPosRef.current.col
          );
          setXrayPath(path);
          setTimeout(() => setXrayPath([]), 4200);
        }
        return;
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
  }, [isGenerating, mode, queueMove, useItem, bombMode, executeBomb, xrayPath]);

  const startSingleGame = useCallback(() => {
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    setMyRemotePlayerId(null);
    isAiGameRef.current = false;
    runBuildAnimation(nextMaze, "single", false); // true solo — no player 2
  }, [runBuildAnimation]);

  const startAiGame = useCallback(() => {
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    setMyRemotePlayerId(null);
    isAiGameRef.current = true;
    runBuildAnimation(nextMaze, "local", true); // local mode with AI as player 2
  }, [runBuildAnimation]);

  // AI DFS — event-driven: aiStep() is called once after each move completes.
  // No interval, no timing conflicts with the move lock.
  const AI_MOVE_DELAY_MS = Math.round(MOVE_UNLOCK_MS * 0.8); // 40ms between moves

  const aiStep = useCallback(() => {
    if (!isAiGameRef.current || gameEndTimeRef.current) return;
    const currentMaze = mazeRef.current;
    const pos = player2PosRef.current;
    const goal = goalPosRef.current;
    if (!currentMaze || !pos) return;

    const posKey = `${pos.row},${pos.col}`;
    const visited = aiVisitedRef.current;
    const stack = aiStackRef.current;

    // Mark current cell visited (idempotent)
    if (!visited.has(posKey)) {
      visited.add(posKey);
      stack.push({ row: pos.row, col: pos.col });
    }

    const DIRS: [Direction, number, number][] = [
      ["up",    -1,  0],
      ["down",   1,  0],
      ["left",   0, -1],
      ["right",  0,  1],
    ];

    // Find unvisited walkable neighbors, prefer those closer to goal
    const candidates: { dir: Direction; dist: number }[] = [];
    for (const [dir, dr, dc] of DIRS) {
      if (!canMove(currentMaze, pos.row, pos.col, dir)) continue;
      const nr = pos.row + dr;
      const nc = pos.col + dc;
      if (visited.has(`${nr},${nc}`)) continue;
      const dist = Math.abs(nr - goal.row) + Math.abs(nc - goal.col);
      candidates.push({ dir, dist });
    }

    let chosenDir: Direction | null = null;

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      chosenDir = candidates[0].dir;
    } else {
      // Dead end — backtrack: pop current, move toward new top of stack
      stack.pop();
      if (stack.length > 0) {
        const prev = stack[stack.length - 1];
        const dr = prev.row - pos.row;
        const dc = prev.col - pos.col;
        if (dr === -1) chosenDir = "up";
        else if (dr === 1) chosenDir = "down";
        else if (dc === -1) chosenDir = "left";
        else if (dc === 1) chosenDir = "right";
      }
    }

    if (chosenDir) {
      inputQueueRef.current.push({ playerId: 2, direction: chosenDir, source: "local" });
      processNextMoveRef.current();
    }
  }, []);

  const aiStepTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Called after every player-2 move completes (injected into processNextMove below)
  const scheduleAiStep = useCallback(() => {
    if (!isAiGameRef.current) return;
    if (aiStepTimerRef.current) clearTimeout(aiStepTimerRef.current);
    aiStepTimerRef.current = setTimeout(() => {
      aiStep();
    }, AI_MOVE_DELAY_MS);
  }, [aiStep, AI_MOVE_DELAY_MS]);

  // Keep aiStepRef current so processNextMove can call it without stale closure
  useEffect(() => { aiStepRef.current = scheduleAiStep; }, [scheduleAiStep]);

  // Kick off AI when game starts (local + AI mode, not generating, no winner)
  useEffect(() => {
    if (mode === "local" && isAiGameRef.current && !isGenerating && !gameEndTime) {
      scheduleAiStep();
    }
    return () => {
      if (aiStepTimerRef.current) {
        clearTimeout(aiStepTimerRef.current);
        aiStepTimerRef.current = undefined;
      }
    };
  }, [mode, isGenerating, gameEndTime, scheduleAiStep]);

  const startLocalGame = useCallback(() => {
    const s = settingsRef.current;
    const nextMaze = generateMaze(s.rows, s.cols, s.difficulty);
    setMyRemotePlayerId(null);
    isAiGameRef.current = false;
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

  const displayRows = displayMaze?.length ?? mazeRows;
  const displayCols = displayMaze?.[0]?.length ?? mazeCols;

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
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
  }, [runBuildAnimation]);

  return {
    // Settings
    settings, setSettings, settingsOpen, setSettingsOpen, handleSettingsClose,

    // Maze display
    cellSize, displayMaze, displayRows, displayCols,
    generationRevealLookup, revealedCellCount, totalCells,
    isGenerating, mazeGenerationProgress,

    // Game state
    mode, setMode,
    player1Pos, player2Pos, goalPos,
    trail, winner, elapsedTime,

    // Remote P2P state
    myRemotePlayerId, remotePeerLabel, latencyMs, lastRemoteMessageAt,
    remoteStatusLabel, connectionDescription,

    // Item state
    fieldItems, p1Inventory, p2Inventory, activeEffects,
    xrayPath, xrayStars,
    bombMode, setBombMode, bombBlasts,

    // Visual effects
    foggedCells, isPlayerFrozen,

    // D-pad
    dpadVisible, setDpadVisible,

    // P2P connection
    phase, localPeerId, error, isConnected, connect,
    clearError, retryLastConnection, reinitialize,
    joinPeerId,

    // Handlers
    startSingleGame, startAiGame, startLocalGame, startRemoteRound,
    exitToMenu, handleSwipeStart, handleSwipeEnd, handleTouchMove,
    isAiGameRef,
  };
}
