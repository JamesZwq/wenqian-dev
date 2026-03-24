"use client";

import { useEffect } from "react";

export default function AnimatedFavicon() {
  useEffect(() => {
    const SIZE = 32;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;

    const CHARS = "wq";          // typed after prompt
    const BG = "#0d0d1a";
    const PROMPT_COLOR = "#4a9eff";  // blue >
    const TEXT_COLOR = "#00e5ff";    // cyan wq
    const CURSOR_COLOR = "#00e5ff";

    const CHAR_DELAY = 180;      // ms per character
    const BLINK_MS = 500;
    const PAUSE_MS = 1400;       // hold when fully typed
    const RESET_MS = 350;        // blank gap before restart

    let typed = 0;
    let cursorOn = true;
    let phase: "typing" | "pausing" | "resetting" = "typing";
    let lastChar = Date.now();
    let lastBlink = Date.now();
    let rafId: number;

    function draw() {
      // Background with slight rounded feel (canvas is square, rounding is visual illusion via bg)
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Thin border
      ctx.strokeStyle = "#1e2a3a";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);

      const visibleText = CHARS.slice(0, typed);

      // Layout: "> wq" centered
      // Font sizes chosen so "> wq" fits comfortably at 32px
      const FONT_SIZE = 17;
      ctx.font = `bold ${FONT_SIZE}px monospace`;
      ctx.textBaseline = "middle";

      const promptW = ctx.measureText(">").width;
      const spaceW = ctx.measureText(" ").width;
      const textW = ctx.measureText(visibleText).width;
      const cursorW = 7;

      // Total width of "> " + typed chars + cursor
      const totalW = promptW + spaceW + textW + (cursorOn && phase !== "resetting" ? cursorW : 0);
      const startX = (SIZE - totalW) / 2;
      const midY = SIZE / 2 + 1;

      // Draw ">"
      ctx.fillStyle = PROMPT_COLOR;
      ctx.fillText(">", startX, midY);

      // Draw typed chars
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(visibleText, startX + promptW + spaceW, midY);

      // Draw cursor block
      if (cursorOn && phase !== "resetting") {
        const cursorX = startX + promptW + spaceW + textW + 2;
        ctx.fillStyle = CURSOR_COLOR;
        ctx.fillRect(cursorX, midY - FONT_SIZE / 2 + 1, 5, FONT_SIZE - 1);
      }
    }

    function tick() {
      const now = Date.now();

      // Blink
      if (now - lastBlink > BLINK_MS) {
        cursorOn = !cursorOn;
        lastBlink = now;
      }

      if (phase === "typing") {
        if (now - lastChar > CHAR_DELAY) {
          typed = Math.min(typed + 1, CHARS.length);
          lastChar = now;
          if (typed === CHARS.length) {
            phase = "pausing";
            lastChar = now;
          }
        }
      } else if (phase === "pausing") {
        if (now - lastChar > PAUSE_MS) {
          phase = "resetting";
          typed = 0;
          cursorOn = false;
          lastChar = now;
        }
      } else if (phase === "resetting") {
        if (now - lastChar > RESET_MS) {
          phase = "typing";
          cursorOn = true;
          lastChar = now;
        }
      }

      draw();

      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = canvas.toDataURL("image/png");

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return null;
}
