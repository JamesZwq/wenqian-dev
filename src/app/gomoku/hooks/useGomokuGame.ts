"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import { getAIMove } from "../gomokuAI";
import {
  BOARD_SIZE, BOARD_PADDING, createEmptyBoard,
  type AIDifficulty, type CellState, type GameMode, type GamePacket, type GameState, type Player, type Stats,
} from "../types";

export function useGomokuGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);
  const [previewPos, setPreviewPos] = useState<{ row: number; col: number } | null>(null);
  const [cellSize, setCellSize] = useState(30);
  const [stats, setStats] = useState<Stats>({ blackWins: 0, whiteWins: 0, draws: 0 });
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    currentPlayer: "black",
    status: "waiting",
    winner: null,
    winningLine: [],
  });
  const [showExplosion, setShowExplosion] = useState(false);
  const [explosionPieces, setExplosionPieces] = useState<Array<{ x: number; y: number; color: "black" | "white" }>>([]);

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);

  const aiTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const sendRef = useRef<(p: GamePacket) => boolean>(() => false);
  const gameStateRef = useRef(gameState);
  const gameModeRef = useRef(gameMode);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  // Responsive cell size
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 768;
      const hPad = isMobile ? 32 : 96;
      const vReserved = isMobile ? 260 : 300;
      const maxW = vw - hPad;
      const maxH = vh - vReserved;
      const totalBoardPad = BOARD_PADDING * 2;
      const maxCellFromW = (maxW - totalBoardPad) / BOARD_SIZE;
      const maxCellFromH = (maxH - totalBoardPad) / BOARD_SIZE;
      setCellSize(Math.max(18, Math.min(30, Math.floor(Math.min(maxCellFromW, maxCellFromH)))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); }, []);

  // ── Win detection ──
  const checkWin = useCallback((board: CellState[][], row: number, col: number, player: Player): number[][] => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
      const line: number[][] = [[row, col]];
      for (let i = 1; i < 5; i++) {
        const nr = row + dx * i, nc = col + dy * i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
        line.push([nr, nc]);
      }
      for (let i = 1; i < 5; i++) {
        const nr = row - dx * i, nc = col - dy * i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr][nc] !== player) break;
        line.unshift([nr, nc]);
      }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return [];
  }, []);

  // ── Apply a move to a game state ──
  const applyMove = useCallback((prev: GameState, row: number, col: number, isLocal: boolean): GameState => {
    if (prev.status !== "playing" || prev.board[row][col] !== null) return prev;
    const newBoard = prev.board.map(r => [...r]);
    const player = prev.currentPlayer;
    newBoard[row][col] = player;
    const winningLine = checkWin(newBoard, row, col, player);
    if (winningLine.length > 0) {
      if (isLocal) setStats(s => ({ ...s, blackWins: s.blackWins + (player === "black" ? 1 : 0), whiteWins: s.whiteWins + (player === "white" ? 1 : 0) }));
      return { board: newBoard, currentPlayer: player, status: "won", winner: player, winningLine };
    }
    if (newBoard.every(r => r.every(c => c !== null))) {
      if (isLocal) setStats(s => ({ ...s, draws: s.draws + 1 }));
      return { board: newBoard, currentPlayer: player, status: "draw", winner: null, winningLine: [] };
    }
    return { board: newBoard, currentPlayer: player === "black" ? "white" : "black", status: "playing", winner: null, winningLine: [] };
  }, [checkWin]);

  // ── AI move ──
  const triggerAIMove = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const gs = gameStateRef.current;
      if (gameModeRef.current !== "ai" || gs.status !== "playing" || gs.currentPlayer !== "white") return;
      const move = getAIMove(gs.board.map(r => [...r]), "white", aiDifficulty);
      setLastMove({ row: move.row, col: move.col });
      setGameState(prev => applyMove(prev, move.row, move.col, true));
    }, 300 + Math.random() * 300);
  }, [aiDifficulty, applyMove]);

  useEffect(() => {
    if (gameMode === "ai" && gameState.status === "playing" && gameState.currentPlayer === "white") {
      triggerAIMove();
    }
  }, [gameMode, gameState.status, gameState.currentPlayer, triggerAIMove]);

  // ── P2P incoming data ──
  const handleIncomingData = useCallback((payload: GamePacket) => {
    if (!payload?.type) return;
    setLastRemoteMessageAt(Date.now());
    if (payload.type === "ping") {
      sendRef.current({ type: "pong", sentAt: payload.sentAt });
      return;
    }
    if (payload.type === "pong") {
      setLatencyMs(Math.max(0, Date.now() - payload.sentAt));
      return;
    }
    if (payload.type === "move") {
      setGameState(prev => {
        if (prev.status !== "playing" || prev.board[payload.row][payload.col] !== null) return prev;
        const newBoard = prev.board.map(r => [...r]);
        const player = prev.currentPlayer;
        newBoard[payload.row][payload.col] = player;
        const winningLine = checkWin(newBoard, payload.row, payload.col, player);
        setLastMove({ row: payload.row, col: payload.col });
        if (winningLine.length > 0) return { board: newBoard, currentPlayer: player, status: "won", winner: player, winningLine };
        if (newBoard.every(r => r.every(c => c !== null))) return { board: newBoard, currentPlayer: player, status: "draw", winner: null, winningLine: [] };
        return { board: newBoard, currentPlayer: player === "black" ? "white" : "black", status: "playing", winner: null, winningLine: [] };
      });
    } else if (payload.type === "reset") {
      setMyColor(prev => prev === "black" ? "white" : "black");
      setGameState({ board: createEmptyBoard(), currentPlayer: "black", status: "playing", winner: null, winningLine: [] });
      setLastMove(null); setPreviewPos(null);
    }
  }, [checkWin]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode } =
    usePeerConnection<GamePacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "gomoku" },
      onData: handleIncomingData,
      onChat,
      acceptIncomingConnections: true,
      onConnected: ({ direction, reconnected }) => {
        if (reconnected) return;
        setMyColor(direction === "outgoing" ? "black" : "white");
        setGameState(prev => ({ ...prev, status: "playing" }));
      },
      onDisconnected: () => {
        setMyColor(null);
        setGameState(prev => ({ ...prev, status: "waiting" }));
        setLatencyMs(null);
        setLastRemoteMessageAt(null);
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  useEffect(() => {
    if (!isConnected) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
      setLatencyMs(null);
      return;
    }
    pingIntervalRef.current = setInterval(() => {
      sendRef.current({ type: "ping", sentAt: Date.now() });
    }, 2000);
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    };
  }, [isConnected]);

  // ── Make a move ──
  const makeMove = useCallback((row: number, col: number) => {
    if (gameMode === "ai") {
      if (gameState.status !== "playing" || gameState.board[row][col] !== null || gameState.currentPlayer !== "black") return;
      setLastMove({ row, col }); setPreviewPos(null);
      setGameState(prev => applyMove(prev, row, col, true));
      return;
    }
    // P2P
    if (gameState.status !== "playing" || gameState.board[row][col] !== null || myColor !== gameState.currentPlayer) return;
    setGameState(prev => {
      const newBoard = prev.board.map(r => [...r]);
      const player = prev.currentPlayer;
      newBoard[row][col] = player;
      const winningLine = checkWin(newBoard, row, col, player);
      setLastMove({ row, col }); setPreviewPos(null);
      send({ type: "move", row, col, timestamp: Date.now() });
      if (winningLine.length > 0) {
        setStats(s => ({ ...s, blackWins: s.blackWins + (player === "black" ? 1 : 0), whiteWins: s.whiteWins + (player === "white" ? 1 : 0) }));
        return { board: newBoard, currentPlayer: player, status: "won", winner: player, winningLine };
      }
      if (newBoard.every(r => r.every(c => c !== null))) {
        setStats(s => ({ ...s, draws: s.draws + 1 }));
        return { board: newBoard, currentPlayer: player, status: "draw", winner: null, winningLine: [] };
      }
      return { board: newBoard, currentPlayer: player === "black" ? "white" : "black", status: "playing", winner: null, winningLine: [] };
    });
  }, [applyMove, checkWin, gameMode, gameState.status, gameState.board, gameState.currentPlayer, myColor, send]);

  const handleBoardClick = useCallback((row: number, col: number) => {
    if (gameState.board[row][col] !== null) return;
    if (window.innerWidth < 768) {
      if (previewPos?.row === row && previewPos?.col === col) { makeMove(row, col); return; }
      setPreviewPos({ row, col });
      return;
    }
    makeMove(row, col);
  }, [gameState.board, makeMove, previewPos]);

  const resetGame = useCallback(() => {
    const hasPieces = gameState.board.some(r => r.some(c => c !== null));
    if (hasPieces) {
      const pieces: Array<{ x: number; y: number; color: "black" | "white" }> = [];
      gameState.board.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (cell) pieces.push({ x: BOARD_PADDING + cellSize / 2 + ci * cellSize, y: BOARD_PADDING + cellSize / 2 + ri * cellSize, color: cell });
        });
      });
      setExplosionPieces(pieces); setShowExplosion(true);
      setTimeout(() => doReset(), 300);
    } else {
      doReset();
    }

    function doReset() {
      if (gameMode === "ai") {
        setGameState({ board: createEmptyBoard(), currentPlayer: "black", status: "playing", winner: null, winningLine: [] });
      } else {
        const newColor: Player = myColor === "black" ? "white" : "black";
        setMyColor(newColor);
        setGameState({ board: createEmptyBoard(), currentPlayer: "black", status: "playing", winner: null, winningLine: [] });
        send({ type: "reset", timestamp: Date.now() });
      }
      setLastMove(null); setPreviewPos(null);
    }
  }, [cellSize, gameMode, gameState.board, myColor, send]);

  const startAIGame = useCallback((diff: AIDifficulty) => {
    setAiDifficulty(diff); setGameMode("ai"); setMyColor("black");
    setGameState({ board: createEmptyBoard(), currentPlayer: "black", status: "playing", winner: null, winningLine: [] });
    setLastMove(null); setPreviewPos(null);
    setStats({ blackWins: 0, whiteWins: 0, draws: 0 });
  }, []);

  const exitToMenu = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setGameMode("menu");
    setGameState({ board: createEmptyBoard(), currentPlayer: "black", status: "waiting", winner: null, winningLine: [] });
    setMyColor(null); setLastMove(null); setPreviewPos(null);
  }, []);

  useRoomUrl(roomCode, phase);

  // ── Derived ──
  const myPlayerId = myColor === "black" ? "P1" : myColor === "white" ? "P2" : null;
  const isMyTurn = gameMode === "ai" ? gameState.currentPlayer === "black" : gameState.currentPlayer === myColor;
  const opponentLabel = gameMode === "ai" ? "AI" : "Opponent";
  const boardPixels = useMemo(() => BOARD_SIZE * cellSize + BOARD_PADDING * 2, [cellSize]);
  const stoneRadius = cellSize / 2 - 2;

  return {
    gameMode, setGameMode, aiDifficulty,
    myColor, lastMove, previewPos, setPreviewPos,
    cellSize, stats, gameState,
    showExplosion, setShowExplosion, explosionPieces,
    // Connection
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode,
    joinPeerId, latencyMs, lastRemoteMessageAt,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    startAIGame, exitToMenu, handleBoardClick, makeMove, resetGame,
    // Derived
    myPlayerId, isMyTurn, opponentLabel, boardPixels, stoneRadius,
  };
}
