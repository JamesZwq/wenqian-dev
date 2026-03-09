"use client";

import { PICKUP_COLORS, PICKUP_LABELS } from "../config";
import type { BuffInstance, PickupKind, PlayerId, TankState } from "../types";

type GameHUDProps = {
  mode: "single" | "remote";
  elapsedMs: number;
  localTank?: TankState | null;
  opponentTank?: TankState | null;
  enemyCount?: number;
  winner: PlayerId | null;
  isHost?: boolean;
};

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const centis = Math.floor((ms % 1000) / 10);
  return `${seconds}.${centis.toString().padStart(2, "0")}s`;
}

function HeartBar({ hp, maxHp, color }: { hp: number; maxHp: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxHp }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-8 border border-[var(--pixel-border)]"
          style={{
            background: i < hp ? color : "rgba(255,255,255,0.06)",
            boxShadow: i < hp ? `0 0 12px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function BuffChip({ buff }: { buff: BuffInstance }) {
  const remaining = Math.max(0, buff.expiresAt - Date.now());
  const seconds = (remaining / 1000).toFixed(1);
  return (
    <div
      className="rounded border px-2 py-1 text-[10px]"
      style={{ borderColor: PICKUP_COLORS[buff.kind], color: PICKUP_COLORS[buff.kind] }}
    >
      {PICKUP_LABELS[buff.kind]} · {seconds}s
    </div>
  );
}

export function GameHUD({ mode, elapsedMs, localTank, opponentTank, enemyCount, winner, isHost }: GameHUDProps) {
  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
        <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-press-start)] text-xs text-[var(--pixel-accent)] md:text-sm">
          {formatTime(elapsedMs)}
        </div>
        <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-[10px] uppercase text-[var(--pixel-muted)]">
          {mode === "single" ? `bots ${enemyCount ?? 0}` : isHost ? "host" : "guest"}
        </div>
        {winner && (
          <div className="border-2 border-[var(--pixel-accent-2)] bg-[var(--pixel-card-bg)] px-3 py-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent-2)]">
            {winner === localTank?.playerId ? "VICTORY" : "DEFEAT"}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent)]">PLAYER</div>
            <div className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[var(--pixel-muted)]">cooldown {Math.max(0, Math.ceil((localTank?.fireCooldownRemaining ?? 0) / 10) * 10)}ms</div>
          </div>
          <HeartBar hp={localTank?.hp ?? 0} maxHp={localTank?.maxHp ?? 3} color="var(--pixel-accent)" />
          <div className="mt-2 flex flex-wrap gap-2 font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--pixel-text)]">
            <div>DMG {(localTank?.bulletDamage ?? 0).toFixed(1)}</div>
            <div>SPD {(localTank?.bulletSpeed ?? 0).toFixed(0)}</div>
            <div>MOVE {(((localTank?.baseMoveSpeed ?? 0) * (localTank?.speedMultiplier ?? 1)) / 10).toFixed(0)}</div>
            <div>BOOST SHOTS {localTank?.damageBoostShotsLeft ?? 0}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {localTank?.activeBuffs.length ? localTank.activeBuffs.map((buff, idx) => <BuffChip key={`${buff.kind}-${idx}`} buff={buff} />) : <div className="text-[10px] text-[var(--pixel-muted)]">no active buffs</div>}
          </div>
        </div>

        <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
          <div className="mb-2 font-[family-name:var(--font-press-start)] text-[10px] text-[var(--pixel-accent-2)]">
            {mode === "single" ? "ENEMY COMMAND" : "RIVAL"}
          </div>
          {opponentTank ? (
            <>
              <HeartBar hp={opponentTank.hp} maxHp={opponentTank.maxHp} color="var(--pixel-accent-2)" />
              <div className="mt-2 flex flex-wrap gap-2 font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--pixel-text)]">
                <div>HP {opponentTank.hp}/{opponentTank.maxHp}</div>
                <div>COOLDOWN {Math.max(0, Math.ceil(opponentTank.fireCooldownRemaining / 10) * 10)}ms</div>
                <div>BUFFS {opponentTank.activeBuffs.length}</div>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[var(--pixel-muted)]">
              {mode === "single" ? "multiple hostiles on field" : "waiting for remote state"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
