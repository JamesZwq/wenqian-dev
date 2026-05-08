import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const GAME_IDS = [
  "schulte",
  "reaction",
  "math",
  "flash-count",
  "trail",
  "pattern",
  "sudoku",
  "maze",
  "poker",
  "halli-galli",
  "gomoku",
  "pulse-duel",
] as const;
export type GameId = (typeof GAME_IDS)[number];

export const SCORE_MODES = ["solo", "p2p"] as const;
export type ScoreMode = (typeof SCORE_MODES)[number];

export const SCORE_METRICS = ["time_ms", "score"] as const;
export type ScoreMetric = (typeof SCORE_METRICS)[number];

export const scores = sqliteTable(
  "scores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    game: text("game").notNull(),
    mode: text("mode").notNull(),
    metric: text("metric").notNull(),
    value: integer("value").notNull(),
    playedAt: integer("played_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [
    index("scores_game_mode_metric_value_idx").on(t.game, t.mode, t.metric, t.value),
    index("scores_game_mode_playedAt_idx").on(t.game, t.mode, t.playedAt),
    index("scores_userId_game_idx").on(t.userId, t.game),
    index("scores_playedAt_idx").on(t.playedAt),
  ],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    game: text("game").notNull(),
    winnerId: text("winner_id").references(() => user.id, { onDelete: "set null" }),
    loserId: text("loser_id").references(() => user.id, { onDelete: "set null" }),
    wasTie: integer("was_tie", { mode: "boolean" }).default(false).notNull(),
    winnerEloDelta: integer("winner_elo_delta").notNull(),
    loserEloDelta: integer("loser_elo_delta").notNull(),
    playedAt: integer("played_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [
    index("matches_game_playedAt_idx").on(t.game, t.playedAt),
    index("matches_winnerId_game_idx").on(t.winnerId, t.game),
    index("matches_loserId_game_idx").on(t.loserId, t.game),
  ],
);

export const ratings = sqliteTable(
  "ratings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    game: text("game").notNull(),
    elo: integer("elo").default(1200).notNull(),
    matchesPlayed: integer("matches_played").default(0).notNull(),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    ties: integer("ties").default(0).notNull(),
    lastMatchAt: integer("last_match_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.game] }),
    index("ratings_game_elo_idx").on(t.game, t.elo),
  ],
);
