"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateQuestionSet, type Operation, type Question } from "../mathEngine";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import { getBestSpeed, saveBestSpeed } from "../bestSpeed";
import type { GameMode, GameResult, MathPacket } from "../types";

export function useMathGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // ── Settings ──
  const [selectedOps, setSelectedOps] = useState<Operation[]>(["add", "sub"]);
  const [totalQuestions, setTotalQuestions] = useState(20);

  // ── Game state ──
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [shaking, setShaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestSpeed, setBestSpeed] = useState<number | null>(null);
  const [resultOps, setResultOps] = useState<Operation[]>([]);
  const [resultCount, setResultCount] = useState(0);

  // ── P2P state ──
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentFinished, setOpponentFinished] = useState<GameResult | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState(false);
  const [p2pSettingsReady, setP2pSettingsReady] = useState(false);

  // ── Refs ──
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const questionsRef = useRef(questions);
  const directionRef = useRef(direction);
  const exitingRef = useRef(false);

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  useEffect(() => { setBestSpeed(getBestSpeed(selectedOps, totalQuestions)); }, [selectedOps, totalQuestions]);

  // ── Timer ──
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const now = Date.now();
    startTimeRef.current = now;
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Speed ──
  const speed = useMemo(() => {
    if (currentIndex === 0 || elapsed === 0) return 0;
    return currentIndex / (elapsed / 60000);
  }, [currentIndex, elapsed]);

  // ── P2P incoming data ──
  const handleIncomingData = useCallback((payload: MathPacket) => {
    if (!payload?.type) return;
    switch (payload.type) {
      case "config": {
        setQuestions(payload.questions);
        setTotalQuestions(payload.totalQuestions);
        setSelectedOps(payload.operations);
        setCurrentIndex(0); setInputValue(""); setResult(null); setIsNewRecord(false);
        setOpponentProgress(0); setOpponentFinished(null);
        setWaitingForConfig(false); setP2pSettingsReady(false);
        setResultOps(payload.operations); setResultCount(payload.totalQuestions);
        const now = Date.now();
        startTimeRef.current = now; setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
        setTimeout(() => inputRef.current?.focus(), 100);
        break;
      }
      case "progress":
        setOpponentProgress(payload.completed);
        break;
      case "finished":
        setOpponentFinished({ totalTime: payload.totalTime, speed: 0, totalQuestions: questionsRef.current.length });
        break;
      case "rematch":
        setResult(null); setIsNewRecord(false);
        setOpponentProgress(0); setOpponentFinished(null);
        setCurrentIndex(0); setInputValue(""); setWaitingForConfig(false);
        if (directionRef.current === "outgoing") setP2pSettingsReady(false);
        else setWaitingForConfig(true);
        break;
    }
  }, []);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<MathPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "math" },
      onData: handleIncomingData,
      onChat,
      acceptIncomingConnections: true,
      onConnected: ({ direction: dir, reconnected }) => {
        if (reconnected) return;
        setDirection(dir);
        if (dir === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
        else { setWaitingForConfig(true); setP2pSettingsReady(false); }
      },
      onDisconnected: () => { setDirection(null); setWaitingForConfig(false); setP2pSettingsReady(false); stopTimer(); },
    });

  // ── Start games ──
  const startSolo = useCallback(() => {
    const qs = generateQuestionSet(selectedOps, totalQuestions);
    setQuestions(qs); setCurrentIndex(0); setInputValue("");
    setResult(null); setIsNewRecord(false);
    setResultOps([...selectedOps]); setResultCount(totalQuestions);
    setGameMode("solo");
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedOps, totalQuestions, startTimer]);

  const startP2pGame = useCallback(() => {
    const qs = generateQuestionSet(selectedOps, totalQuestions);
    setQuestions(qs); setCurrentIndex(0); setInputValue("");
    setResult(null); setIsNewRecord(false);
    setOpponentProgress(0); setOpponentFinished(null);
    setP2pSettingsReady(true);
    setResultOps([...selectedOps]); setResultCount(totalQuestions);
    send({ type: "config", operations: selectedOps, totalQuestions, questions: qs, timestamp: Date.now() });
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedOps, totalQuestions, send, startTimer]);

  // ── Input handler ──
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (currentIndex >= questions.length) return;
    const currentQ = questions[currentIndex];
    const answerStr = String(currentQ.answer);
    if (val === "-" && currentQ.answer < 0) return;
    if (val === answerStr) {
      if (exitingRef.current) return;
      exitingRef.current = true;
      setFlashColor("green");
      const nextIndex = currentIndex + 1;
      if (gameMode === "p2p") send({ type: "progress", completed: nextIndex, timestamp: Date.now() });
      setTimeout(() => {
        exitingRef.current = false;
        setFlashColor(null);
        setCurrentIndex(nextIndex);
        setInputValue("");
        if (nextIndex >= questions.length) {
          stopTimer();
          const totalTime = Date.now() - startTimeRef.current;
          const spd = questions.length / (totalTime / 60000);
          const nr = saveBestSpeed(resultOps, resultCount, spd);
          setResult({ totalTime, speed: spd, totalQuestions: questions.length });
          setIsNewRecord(nr);
          setBestSpeed(getBestSpeed(resultOps, resultCount));
          if (gameMode === "p2p") send({ type: "finished", totalTime, timestamp: Date.now() });
        } else {
          inputRef.current?.focus();
        }
      }, 220);
    } else if (val.length >= answerStr.length && val !== answerStr) {
      setShaking(true); setFlashColor("red"); setInputValue("");
      setTimeout(() => { setFlashColor(null); setShaking(false); }, 400);
    }
  }, [currentIndex, questions, gameMode, send, stopTimer, resultOps, resultCount]);

  // ── Exit & rematch ──
  const exitToMenu = useCallback(() => {
    stopTimer();
    setGameMode("menu"); setResult(null); setIsNewRecord(false); setQuestions([]);
    setCurrentIndex(0); setInputValue("");
    setOpponentProgress(0); setOpponentFinished(null);
    setWaitingForConfig(false); setP2pSettingsReady(false);
  }, [stopTimer]);

  const handleRematch = useCallback(() => {
    send({ type: "rematch", timestamp: Date.now() });
    setResult(null); setIsNewRecord(false);
    setOpponentProgress(0); setOpponentFinished(null);
    setCurrentIndex(0); setInputValue("");
    if (direction === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
    else setWaitingForConfig(true);
  }, [send, direction]);

  const toggleOp = useCallback((op: Operation) => {
    setSelectedOps(prev => {
      if (prev.includes(op)) return prev.length <= 1 ? prev : prev.filter(o => o !== op);
      return [...prev, op];
    });
  }, []);

  useRoomUrl(roomCode, phase);

  // ── Derived ──
  const isPlaying = questions.length > 0 && currentIndex < questions.length && !result;
  const showP2pSettings = gameMode === "p2p" && isConnected && !p2pSettingsReady && direction === "outgoing" && !result;
  const showP2pWaiting = gameMode === "p2p" && isConnected && waitingForConfig && !result;
  const showGame = (gameMode === "solo" || (gameMode === "p2p" && isConnected && !showP2pSettings && !showP2pWaiting)) && questions.length > 0;

  return {
    // Settings
    selectedOps, toggleOp, totalQuestions, setTotalQuestions, bestSpeed,
    // Game state
    gameMode, setGameMode, questions, currentIndex, inputValue,
    flashColor, shaking, elapsed, result, isNewRecord, resultOps, resultCount,
    // P2P state
    direction, opponentProgress, opponentFinished, waitingForConfig, p2pSettingsReady,
    // Connection
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId, inputRef,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    startSolo, startP2pGame, exitToMenu, handleRematch, handleInputChange,
    // Derived
    speed, isPlaying, showP2pSettings, showP2pWaiting, showGame,
  };
}
