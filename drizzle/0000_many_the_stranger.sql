CREATE TABLE `tickets` (
	`number` integer PRIMARY KEY NOT NULL,
	`reservation_id` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL
);
