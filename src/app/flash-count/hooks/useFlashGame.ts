"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePuzzleSet, type BlockPuzzle, type Difficulty } from "../flashCountEngine";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import { getBestSpeed, saveBestSpeed } from "../bestSpeed";
import type { FlashPacket, GameMode, GamePhase, GameResult, QuestionResult, SoloResult } from "../types";

/** All game state and logic for Flash Count, extracted from the page component. */
export function useFlashGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // ── Settings ──
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [totalQuestions, setTotalQuestions] = useState(20);

  // ── Core game state ──
  const [puzzles, setPuzzles] = useState<BlockPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>("flash");
  const [inputValue, setInputValue] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [revealPuzzle, setRevealPuzzle] = useState<BlockPuzzle | null>(null);

  // ── Solo result ──
  const [soloResult, setSoloResult] = useState<SoloResult | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestSpeed, setBestSpeed] = useState<number | null>(null);
  const [resultDiff, setResultDiff] = useState<Difficulty>("easy");
  const [resultCount, setResultCount] = useState(0);

  // ── P2P session state ──
  const [direction, setDirection] = useState<"outgoing" | "incoming" | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState(false);
  const [p2pSettingsReady, setP2pSettingsReady] = useState(false);
  const [hostPreview, setHostPreview] = useState<{ difficulty: Difficulty; totalQuestions: number } | null>(null);

  // ── P2P game state ──
  const [myP2pAnswer, setMyP2pAnswer] = useState<number | null>(null);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [questionResult, setQuestionResult] = useState<QuestionResult | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [p2pGameResult, setP2pGameResult] = useState<GameResult | null>(null);

  // ── Refs for stale-closure avoidance ──
  const puzzlesRef = useRef(puzzles);
  const myP2pAnswerRef = useRef<number | null>(null);
  const opponentAnswerRef = useRef<number | null>(null);
  const myScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);
  const directionRef = useRef<"outgoing" | "incoming" | null>(null);
  const sendRef = useRef<((p: FlashPacket) => void) | null>(null);
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { puzzlesRef.current = puzzles; }, [puzzles]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  // ── Load best speed when settings change ──
  useEffect(() => { setBestSpeed(getBestSpeed(difficulty, totalQuestions)); }, [difficulty, totalQuestions]);

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

  // Cleanup on unmount
  useEffect(() => () => {
    stopTimer();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, [stopTimer]);

  // ── Flash (show blocks, then switch to answer phase) ──
  const startFlash = useCallback((puzzle: BlockPuzzle) => {
    setGamePhase("flash");
    setInputValue("");
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setGamePhase("answer");
      setTimeout(() => inputRef.current?.focus(), 50);
    }, puzzle.flashDuration);
  }, []);

  // ── P2P helpers ──
  const resetP2pQuestion = useCallback(() => {
    setMyP2pAnswer(null);
    setOpponentSubmitted(false);
    setQuestionResult(null);
    myP2pAnswerRef.current = null;
    opponentAnswerRef.current = null;
  }, []);

  /**
   * Apply a completed question result for both players.
   * Uses refs for score to avoid stale closures inside the auto-advance timeout.
   */
  const processQuestionResult = useCallback((
    qIdx: number,
    myAns: number,
    oppAns: number,
    correct: number,
  ) => {
    const myCorrect = myAns === correct;
    const oppCorrect = oppAns === correct;
    setQuestionResult({ myAnswer: myAns, opponentAnswer: oppAns, correct, myCorrect, opponentCorrect: oppCorrect });

    const newMyScore = myScoreRef.current + (myCorrect ? 1 : 0);
    const newOppScore = opponentScoreRef.current + (oppCorrect ? 1 : 0);
    myScoreRef.current = newMyScore;
    opponentScoreRef.current = newOppScore;
    setMyScore(newMyScore);
    setOpponentScore(newOppScore);

    setTimeout(() => {
      const pz = puzzlesRef.current;
      const nextIdx = qIdx + 1;
      setCurrentIndex(nextIdx);
      resetP2pQuestion();
      if (nextIdx >= pz.length) {
        stopTimer();
        setGamePhase("done");
        setP2pGameResult({
          myScore: myScoreRef.current,
          opponentScore: opponentScoreRef.current,
          totalQuestions: pz.length,
        });
      } else {
        startFlash(pz[nextIdx]);
      }
    }, 4000);
  }, [resetP2pQuestion, stopTimer, startFlash]);

  /** Host computes correct answer, broadcasts to guest, then processes locally. */
  const broadcastResult = useCallback((
    qIdx: number,
    myAns: number,
    oppAns: number,
    send: (p: FlashPacket) => void,
  ) => {
    const pz = puzzlesRef.current[qIdx];
    if (!pz) return;
    send({
      type: "question_result",
      questionIndex: qIdx,
      p1Answer: myAns,
      p2Answer: oppAns,
      correct: pz.answer,
      timestamp: Date.now(),
    });
    processQuestionResult(qIdx, myAns, oppAns, pz.answer);
  }, [processQuestionResult]);

  // ── P2P incoming data ──
  const handleIncomingData = useCallback((payload: FlashPacket) => {
    if (!payload?.type) return;
    switch (payload.type) {
      case "config": {
        const { puzzles: pz, difficulty: diff, totalQuestions: tq } = payload;
        setPuzzles(pz);
        setTotalQuestions(tq);
        setDifficulty(diff);
        setCurrentIndex(0); setInputValue(""); setSoloResult(null); setIsNewRecord(false);
        setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
        myScoreRef.current = 0; opponentScoreRef.current = 0;
        setWaitingForConfig(false); setP2pSettingsReady(false);
        setResultDiff(diff); setResultCount(tq);
        resetP2pQuestion();
        const now = Date.now();
        startTimeRef.current = now;
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(Date.now() - now), 200);
        setGamePhase("flash");
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          setGamePhase("answer");
          setTimeout(() => inputRef.current?.focus(), 50);
        }, pz[0].flashDuration);
        break;
      }
      case "answer": {
        opponentAnswerRef.current = payload.value;
        setOpponentSubmitted(true);
        if (directionRef.current === "outgoing" && myP2pAnswerRef.current !== null && sendRef.current) {
          broadcastResult(payload.questionIndex, myP2pAnswerRef.current, payload.value, sendRef.current);
        }
        break;
      }
      case "question_result": {
        // Guest perspective: p2 = me, p1 = opponent
        processQuestionResult(payload.questionIndex, payload.p2Answer, payload.p1Answer, payload.correct);
        break;
      }
      case "rematch": {
        setSoloResult(null); setIsNewRecord(false);
        setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
        myScoreRef.current = 0; opponentScoreRef.current = 0;
        setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
        resetP2pQuestion(); setWaitingForConfig(false);
        if (directionRef.current === "outgoing") setP2pSettingsReady(false);
        else { setWaitingForConfig(true); setHostPreview(null); }
        break;
      }
      case "settings_preview": {
        setHostPreview({ difficulty: payload.difficulty, totalQuestions: payload.totalQuestions });
        break;
      }
    }
  }, [broadcastResult, resetP2pQuestion, processQuestionResult]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  // ── P2P connection ──
  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<FlashPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "flash-count" },
      onData: handleIncomingData,
      onChat,
      acceptIncomingConnections: true,
      onConnected: ({ direction: dir, reconnected }) => {
        if (reconnected) return;
        setDirection(dir);
        if (dir === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
        else { setWaitingForConfig(true); setP2pSettingsReady(false); }
      },
      onDisconnected: () => {
        setDirection(null); setWaitingForConfig(false); setP2pSettingsReady(false);
        stopTimer(); setRevealPuzzle(null); resetP2pQuestion();
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  // Send settings preview when host changes config before game starts
  useEffect(() => {
    if (gameMode === "p2p" && isConnected && direction === "outgoing" && !p2pSettingsReady) {
      send({ type: "settings_preview", difficulty, totalQuestions, timestamp: Date.now() });
    }
  }, [gameMode, isConnected, direction, p2pSettingsReady, difficulty, totalQuestions, send]);

  // ── Start games ──
  const startSolo = useCallback(() => {
    const pz = generatePuzzleSet(difficulty, totalQuestions);
    setPuzzles(pz); setCurrentIndex(0); setInputValue("");
    setSoloResult(null); setIsNewRecord(false);
    setResultDiff(difficulty); setResultCount(totalQuestions);
    setGameMode("solo");
    startTimer();
    startFlash(pz[0]);
  }, [difficulty, totalQuestions, startTimer, startFlash]);

  const startP2pGame = useCallback(() => {
    const pz = generatePuzzleSet(difficulty, totalQuestions);
    setPuzzles(pz); setCurrentIndex(0); setInputValue("");
    setSoloResult(null); setIsNewRecord(false);
    setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
    myScoreRef.current = 0; opponentScoreRef.current = 0;
    setP2pSettingsReady(true);
    setResultDiff(difficulty); setResultCount(totalQuestions);
    resetP2pQuestion();
    send({ type: "config", difficulty, totalQuestions, puzzles: pz, timestamp: Date.now() });
    startTimer();
    startFlash(pz[0]);
  }, [difficulty, totalQuestions, send, startTimer, startFlash, resetP2pQuestion]);

  // ── Input handlers ──
  const handleSoloInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (gamePhase !== "answer" || currentIndex >= puzzles.length) return;
    const currentP = puzzles[currentIndex];
    const answerStr = String(currentP.answer);
    if (val === answerStr) {
      setFlashColor("green");
      setTimeout(() => setFlashColor(null), 350);
      setRevealPuzzle(currentP);
      setGamePhase("reveal");
      setInputValue("");
    } else if (val.length >= answerStr.length) {
      setShakeKey(k => k + 1);
      setFlashColor("red");
      setTimeout(() => { setFlashColor(null); setInputValue(""); inputRef.current?.focus(); }, 350);
    }
  }, [gamePhase, currentIndex, puzzles]);

  const handleP2pInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (gamePhase !== "answer" || myP2pAnswer !== null || currentIndex >= puzzlesRef.current.length) return;
    const currentP = puzzlesRef.current[currentIndex];
    if (val.length >= String(currentP.answer).length) {
      const numVal = parseInt(val, 10);
      if (isNaN(numVal)) { setInputValue(""); return; }
      setMyP2pAnswer(numVal);
      myP2pAnswerRef.current = numVal;
      setInputValue(String(numVal));
      send({ type: "answer", questionIndex: currentIndex, value: numVal, timestamp: Date.now() });
      if (direction === "outgoing" && opponentAnswerRef.current !== null) {
        broadcastResult(currentIndex, numVal, opponentAnswerRef.current, send);
      }
    }
  }, [gamePhase, myP2pAnswer, currentIndex, send, direction, broadcastResult]);

  const onRevealComplete = useCallback(() => {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setRevealPuzzle(null);
    if (nextIndex >= puzzles.length) {
      stopTimer();
      const totalTime = Date.now() - startTimeRef.current;
      setGamePhase("done");
      const spd = puzzles.length / (totalTime / 60000);
      const nr = saveBestSpeed(resultDiff, resultCount, spd);
      setSoloResult({ totalTime, speed: spd, totalQuestions: puzzles.length });
      setIsNewRecord(nr);
      setBestSpeed(getBestSpeed(resultDiff, resultCount));
    } else {
      startFlash(puzzles[nextIndex]);
    }
  }, [currentIndex, puzzles, stopTimer, resultDiff, resultCount, startFlash]);

  // ── Exit & rematch ──
  const exitToMenu = useCallback(() => {
    stopTimer();
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    setGameMode("menu"); setSoloResult(null); setIsNewRecord(false); setPuzzles([]);
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
    myScoreRef.current = 0; opponentScoreRef.current = 0;
    setWaitingForConfig(false); setP2pSettingsReady(false);
    resetP2pQuestion();
  }, [stopTimer, resetP2pQuestion]);

  const handleRematch = useCallback(() => {
    send({ type: "rematch", timestamp: Date.now() });
    setSoloResult(null); setIsNewRecord(false);
    setMyScore(0); setOpponentScore(0); setP2pGameResult(null);
    myScoreRef.current = 0; opponentScoreRef.current = 0;
    setCurrentIndex(0); setInputValue(""); setGamePhase("flash");
    resetP2pQuestion();
    if (direction === "outgoing") { setP2pSettingsReady(false); setWaitingForConfig(false); }
    else setWaitingForConfig(true);
  }, [send, direction, resetP2pQuestion]);

  useRoomUrl(roomCode, phase);

  // ── Derived values ──
  const speed = useMemo(() => {
    if (currentIndex === 0 || elapsed === 0) return 0;
    return currentIndex / (elapsed / 60000);
  }, [currentIndex, elapsed]);

  const isPlaying = puzzles.length > 0 && currentIndex < puzzles.length && !soloResult && !p2pGameResult;
  const showP2pSettings = gameMode === "p2p" && isConnected && !p2pSettingsReady && direction === "outgoing" && !p2pGameResult;
  const showP2pWaiting = gameMode === "p2p" && isConnected && waitingForConfig && !p2pGameResult;
  const showGame = (gameMode === "solo" || (gameMode === "p2p" && isConnected && !showP2pSettings && !showP2pWaiting)) && puzzles.length > 0;
  const isP2pWaitingForOpponent = gameMode === "p2p" && myP2pAnswer !== null && !opponentSubmitted && !questionResult;
  const isP2pWaitingForMe = gameMode === "p2p" && opponentSubmitted && myP2pAnswer === null && !questionResult;

  return {
    // Settings
    difficulty, setDifficulty,
    totalQuestions, setTotalQuestions,
    bestSpeed,
    // Game state
    gameMode, setGameMode,
    gamePhase,
    puzzles,
    currentIndex,
    inputValue,
    shakeKey,
    flashColor,
    elapsed,
    revealPuzzle,
    // Solo result
    soloResult, isNewRecord, resultDiff, resultCount,
    // P2P session
    direction, waitingForConfig, p2pSettingsReady, hostPreview,
    // P2P game
    myP2pAnswer, opponentSubmitted, questionResult,
    myScore, opponentScore, p2pGameResult,
    // P2P connection
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId,
    // Chat
    chatMessages, addMyMessage,
    // Refs
    inputRef,
    // Handlers
    startSolo, startP2pGame, exitToMenu, handleRematch,
    handleSoloInputChange, handleP2pInputChange, onRevealComplete,
    // Derived
    speed, isPlaying, showP2pSettings, showP2pWaiting, showGame,
    isP2pWaitingForOpponent, isP2pWaitingForMe,
  };
}
