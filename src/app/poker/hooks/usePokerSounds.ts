"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerView } from "../types";

const STORAGE_KEY = "poker-sound-muted";

type EnvelopeOpts = {
  freq: number;
  type?: OscillatorType;
  duration: number;
  gain?: number;
  attack?: number;
  release?: number;
  startAt?: number;
  freqEnd?: number;
};

export function usePokerSounds(view: PlayerView | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") {
        setMuted(true);
        mutedRef.current = true;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* ignore */ }
        audioCtxRef.current = null;
      }
    };
  }, []);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (mutedRef.current) return null;
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { /* ignore */ });
    return ctx;
  }, []);

  const tone = useCallback((opts: EnvelopeOpts) => {
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + (opts.startAt ?? 0);
      const dur = opts.duration;
      const peak = opts.gain ?? 0.18;
      const attack = opts.attack ?? 0.005;
      const release = opts.release ?? Math.min(0.06, dur * 0.5);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type ?? "sine";
      osc.frequency.setValueAtTime(opts.freq, t0);
      if (opts.freqEnd != null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + dur);
      }

      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + attack);
      gain.gain.setValueAtTime(peak, t0 + Math.max(attack, dur - release));
      gain.gain.linearRampToValueAtTime(0, t0 + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  }, [ensureCtx]);

  const playDeal = useCallback(() => {
    tone({ freq: 1400, freqEnd: 700, type: "triangle", duration: 0.07, gain: 0.12 });
    tone({ freq: 1400, freqEnd: 700, type: "triangle", duration: 0.07, gain: 0.12, startAt: 0.12 });
  }, [tone]);

  const playFlip = useCallback((count: number) => {
    for (let i = 0; i < count; i++) {
      tone({
        freq: 900 + i * 60,
        freqEnd: 500,
        type: "triangle",
        duration: 0.08,
        gain: 0.14,
        startAt: i * 0.13,
      });
    }
  }, [tone]);

  const playCheck = useCallback(() => {
    tone({ freq: 180, type: "sine", duration: 0.06, gain: 0.22 });
  }, [tone]);

  const playChip = useCallback((raise = false) => {
    const base = raise ? 1500 : 1200;
    tone({ freq: base, type: "sine", duration: 0.05, gain: 0.14 });
    tone({ freq: base + 600, type: "sine", duration: 0.05, gain: 0.10, startAt: 0.04 });
  }, [tone]);

  const playFold = useCallback(() => {
    tone({ freq: 800, freqEnd: 200, type: "sawtooth", duration: 0.18, gain: 0.10 });
  }, [tone]);

  const playAllIn = useCallback(() => {
    tone({ freq: 440, type: "square", duration: 0.13, gain: 0.14 });
    tone({ freq: 660, type: "square", duration: 0.16, gain: 0.16, startAt: 0.13 });
  }, [tone]);

  const playWin = useCallback(() => {
    tone({ freq: 523.25, type: "triangle", duration: 0.14, gain: 0.18 });
    tone({ freq: 659.25, type: "triangle", duration: 0.14, gain: 0.18, startAt: 0.13 });
    tone({ freq: 783.99, type: "triangle", duration: 0.22, gain: 0.20, startAt: 0.26 });
  }, [tone]);

  const playLose = useCallback(() => {
    tone({ freq: 392, type: "sine", duration: 0.18, gain: 0.16 });
    tone({ freq: 261.63, type: "sine", duration: 0.30, gain: 0.18, startAt: 0.16 });
  }, [tone]);

  const playTie = useCallback(() => {
    tone({ freq: 440, type: "sine", duration: 0.22, gain: 0.16 });
  }, [tone]);

  // ── Event detection ──

  const isFirstRenderRef = useRef(true);
  const prevPhaseRef = useRef<string | null>(null);
  const prevHandRef = useRef<number | null>(null);
  const prevActionSigRef = useRef<string | null>(null);
  const prevResultSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!view) {
      isFirstRenderRef.current = true;
      prevPhaseRef.current = null;
      prevHandRef.current = null;
      prevActionSigRef.current = null;
      prevResultSigRef.current = null;
      return;
    }

    const prevPhase = prevPhaseRef.current;
    const prevHand = prevHandRef.current;
    const wasFirst = isFirstRenderRef.current;

    prevPhaseRef.current = view.phase;
    prevHandRef.current = view.handNumber;
    isFirstRenderRef.current = false;

    if (wasFirst) {
      // Skip mount-time triggers but seed action/result signatures so
      // a stale lastAction on a reconnect snapshot doesn't replay.
      if (view.lastAction) {
        prevActionSigRef.current = `${view.handNumber}:${view.phase}:${view.lastAction.isMe ? 1 : 0}:${view.lastAction.action}:${view.lastAction.amount}`;
      }
      if (view.result) {
        prevResultSigRef.current = `${view.handNumber}:${view.result.iWon}:${view.result.winnerHand}`;
      }
      return;
    }

    // Phase / new-hand: deal & flip sounds
    if (view.handNumber !== prevHand) {
      if (view.phase === "preflop") playDeal();
    } else if (view.phase !== prevPhase) {
      if (view.phase === "flop") playFlip(3);
      else if (view.phase === "turn") playFlip(1);
      else if (view.phase === "river") playFlip(1);
    }

    // Action sounds
    if (view.lastAction) {
      const sig = `${view.handNumber}:${view.phase}:${view.lastAction.isMe ? 1 : 0}:${view.lastAction.action}:${view.lastAction.amount}`;
      if (sig !== prevActionSigRef.current) {
        prevActionSigRef.current = sig;
        switch (view.lastAction.action) {
          case "fold":  playFold(); break;
          case "check": playCheck(); break;
          case "call":  playChip(false); break;
          case "raise": playChip(true); break;
          case "allin": playAllIn(); break;
        }
      }
    }

    // Result sounds (showdown)
    if (view.result) {
      const sig = `${view.handNumber}:${view.result.iWon}:${view.result.winnerHand}`;
      if (sig !== prevResultSigRef.current) {
        prevResultSigRef.current = sig;
        // Slight delay so it doesn't collide with the last action sound
        const t = setTimeout(() => {
          if (view.result!.iWon === true) playWin();
          else if (view.result!.iWon === false) playLose();
          else playTie();
        }, 350);
        return () => clearTimeout(t);
      }
    }
  }, [view, playDeal, playFlip, playCheck, playChip, playFold, playAllIn, playWin, playLose, playTie]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      if (next && audioCtxRef.current) {
        try { audioCtxRef.current.suspend(); } catch { /* ignore */ }
      } else if (!next && audioCtxRef.current) {
        try { audioCtxRef.current.resume(); } catch { /* ignore */ }
      }
      return next;
    });
  }, []);

  return { muted, toggleMute };
}
