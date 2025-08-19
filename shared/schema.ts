import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  timestamp, 
  boolean,
  serial
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for participant registration
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramNickname: varchar("telegram_nickname", { length: 100 }),
  fullName: text("full_name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  transportType: varchar("transport_type", { length: 20 }).notNull(), // monowheel, scooter, spectator
  transportModel: varchar("transport_model", { length: 100 }), // model name for monowheel/scooter
  participantNumber: integer("participant_number"),
  isActive: boolean("is_active").default(true).notNull(),
  eventId: integer("event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Bots table for Telegram bot management
export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chats table for linking bots to specific chats
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 50 }).notNull(),
  botId: integer("bot_id").notNull(),
  title: varchar("title", { length: 200 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Events table for managing events
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  datetime: timestamp("datetime").notNull(),
  chatId: integer("chat_id").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reserved numbers table for excluding specific numbers from auto-assignment
export const reservedNumbers = pgTable("reserved_numbers", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  number: integer("number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin users table for web panel access
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  event: one(events, {
    fields: [users.eventId],
    references: [events.id],
  }),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  participants: many(users),
  reservedNumbers: many(reservedNumbers),
  chat: one(chats, {
    fields: [events.chatId],
    references: [chats.id],
  }),
}));

export const chatsRelations = relations(chats, ({ many, one }) => ({
  events: many(events),
  bot: one(bots, {
    fields: [chats.botId],
    references: [bots.id],
  }),
}));

export const botsRelations = relations(bots, ({ many }) => ({
  chats: many(chats),
}));

export const reservedNumbersRelations = relations(reservedNumbers, ({ one }) => ({
  event: one(events, {
    fields: [reservedNumbers.eventId],
    references: [events.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  phone: z.string().regex(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, "Неверный формат телефона. Используйте: +7 (XXX) XXX-XX-XX"),
  transportType: z.enum(["monowheel", "scooter", "spectator"], {
    errorMap: () => ({ message: "Выберите тип транспорта: моноколесо, самокат или зритель" })
  }),
  fullName: z.string().min(2, "ФИО должно содержать минимум 2 символа"),
}).omit({
  id: true,
  participantNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events, {
  name: z.string().min(2, "Название мероприятия обязательно"),
  location: z.string().min(2, "Место проведения обязательно"),
  datetime: z.string().transform((str) => new Date(str)),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBotSchema = createInsertSchema(bots, {
  token: z.string().min(10, "Токен бота обязателен"),
  name: z.string().min(2, "Название бота обязательно"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertReservedNumberSchema = createInsertSchema(reservedNumbers, {
  number: z.number().min(1).max(99, "Номер должен быть от 1 до 99"),
}).omit({
  id: true,
  createdAt: true,
});

export const adminLoginSchema = z.object({
  username: z.string().min(2, "Логин обязателен"),
  password: z.string().min(4, "Пароль должен содержать минимум 4 символа"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Bot = typeof bots.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Chat = typeof chats.$inferSelect;
export type ReservedNumber = typeof reservedNumbers.$inferSelect;
export type InsertReservedNumber = z.infer<typeof insertReservedNumberSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminLogin = z.infer<typeof adminLoginSchema>;

// Event with related data type
export type EventWithStats = Event & {
  participantCount: number;
  monowheelCount: number;
  scooterCount: number;
  spectatorCount: number;
  chat: Chat & { bot: Bot };
};

// User with event data type
export type UserWithEvent = User & {
  event: Event;
};
