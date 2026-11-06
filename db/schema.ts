import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
export const tickets = sqliteTable('tickets', { number: integer('number').primaryKey(), reservationId:text('reservation_id').notNull(), status:text('status').notNull(), expiresAt:integer('expires_at').notNull() });
export const reservations = sqliteTable('reservations', {
 id:text('id').primaryKey(), buyerName:text('buyer_name').notNull(), buyerPhone:text('buyer_phone').notNull(),
 numbers:text('numbers').notNull(), amountCents:integer('amount_cents').notNull(),
 status:text('status').notNull(), createdAt:integer('created_at').notNull(), expiresAt:integer('expires_at').notNull(),
 source:text('source').notNull(), confirmedAt:integer('confirmed_at')
});
export const loginAttempts=sqliteTable('login_attempts',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
