CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`winner_id` text,
	`loser_id` text,
	`was_tie` integer DEFAULT false NOT NULL,
	`winner_elo_delta` integer NOT NULL,
	`loser_elo_delta` integer NOT NULL,
	`played_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`winner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`loser_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `matches_game_playedAt_idx` ON `matches` (`game`,`played_at`);--> statement-breakpoint
CREATE INDEX `matches_winnerId_game_idx` ON `matches` (`winner_id`,`game`);--> statement-breakpoint
CREATE INDEX `matches_loserId_game_idx` ON `matches` (`loser_id`,`game`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`elo` integer DEFAULT 1200 NOT NULL,
	`matches_played` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`ties` integer DEFAULT 0 NOT NULL,
	`last_match_at` integer,
	PRIMARY KEY(`user_id`, `game`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ratings_game_elo_idx` ON `ratings` (`game`,`elo`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`game` text NOT NULL,
	`mode` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer NOT NULL,
	`played_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scores_game_mode_metric_value_idx` ON `scores` (`game`,`mode`,`metric`,`value`);--> statement-breakpoint
CREATE INDEX `scores_game_mode_playedAt_idx` ON `scores` (`game`,`mode`,`played_at`);--> statement-breakpoint
CREATE INDEX `scores_userId_game_idx` ON `scores` (`user_id`,`game`);--> statement-breakpoint
CREATE INDEX `scores_playedAt_idx` ON `scores` (`played_at`);