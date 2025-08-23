import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  timestamp, 
  boolean,
  serial,
  unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for participant registration
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).notNull(),
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
}, (table) => ({
  // One user can register for multiple events, but only once per event
  telegramEventUnique: unique().on(table.telegramId, table.eventId)
}));

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
  description: varchar("description", { length: 900 }),
  location: text("location").notNull(),
  datetime: timestamp("datetime").notNull(),
  allowedTransportTypes: text("allowed_transport_types").array().default(sql`ARRAY['monowheel', 'scooter', 'eboard', 'spectator']`),
  disableLinkPreviews: boolean("disable_link_previews").default(false).notNull(),
  shareCode: varchar("share_code", { length: 50 }).unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Event chats relation table (many-to-many)
export const eventChats = pgTable("event_chats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  chatId: integer("chat_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate event-chat pairs
  eventChatUnique: unique().on(table.eventId, table.chatId)
}));

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
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Fixed number bindings table for telegram nickname to participant number mapping
export const fixedNumberBindings = pgTable("fixed_number_bindings", {
  id: serial("id").primaryKey(),
  telegramNickname: varchar("telegram_nickname", { length: 100 }).notNull().unique(),
  participantNumber: integer("participant_number").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System settings table for global application settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  event: one(events, {
    fields: [users.eventId],
    references: [events.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  participants: many(users),
  reservedNumbers: many(reservedNumbers),
  eventChats: many(eventChats),
}));

export const eventChatsRelations = relations(eventChats, ({ one }) => ({
  event: one(events, {
    fields: [eventChats.eventId],
    references: [events.id],
  }),
  chat: one(chats, {
    fields: [eventChats.chatId],
    references: [chats.id],
  }),
}));

export const chatsRelations = relations(chats, ({ many, one }) => ({
  eventChats: many(eventChats),
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

export const fixedNumberBindingsRelations = relations(fixedNumberBindings, ({ }) => ({}));

export const systemSettingsRelations = relations(systemSettings, ({ }) => ({}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  phone: z.string().regex(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, "Неверный формат телефона. Используйте: +7 (XXX) XXX-XX-XX"),
  transportType: z.enum(["monowheel", "scooter", "eboard", "spectator"], {
    errorMap: () => ({ message: "Выберите тип транспорта: моноколесо, самокат, электро-борд или зритель" })
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
  description: z.string().max(900, "Описание не должно превышать 900 символов").optional(),
  location: z.string().min(2, "Место проведения обязательно"),
  datetime: z.string().transform((str) => new Date(str)),
  allowedTransportTypes: z.array(z.enum(["monowheel", "scooter", "eboard", "spectator"])).min(1, "Выберите хотя бы один тип транспорта").optional(),
  disableLinkPreviews: z.boolean().default(false).optional(),
}).omit({
  id: true,
  shareCode: true,
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

export const insertChatSchema = createInsertSchema(chats, {
  chatId: z.string().min(1, "ID чата обязателен"),
  title: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertEventChatSchema = createInsertSchema(eventChats, {
  eventId: z.number(),
  chatId: z.number(),
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

export const insertFixedNumberBindingSchema = createInsertSchema(fixedNumberBindings, {
  telegramNickname: z.string().min(1, "Telegram-ник обязателен"),
  participantNumber: z.number().min(1, "Номер участника должен быть больше 0"),
}).omit({ id: true, createdAt: true });

export const insertSystemSettingSchema = createInsertSchema(systemSettings, {
  key: z.string().min(1, "Ключ настройки обязателен"),
  value: z.string().min(0, "Значение настройки обязательно"),
  description: z.string().optional(),
}).omit({ id: true, updatedAt: true });

export const adminLoginSchema = z.object({
  username: z.string().min(2, "Логин обязателен"),
  password: z.string().min(4, "Пароль должен содержать минимум 4 символа"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventChat = typeof eventChats.$inferSelect;
export type InsertEventChat = z.infer<typeof insertEventChatSchema>;
export type Bot = typeof bots.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type ReservedNumber = typeof reservedNumbers.$inferSelect;
export type InsertReservedNumber = z.infer<typeof insertReservedNumberSchema>;
export type FixedNumberBinding = typeof fixedNumberBindings.$inferSelect;
export type InsertFixedNumberBinding = z.infer<typeof insertFixedNumberBindingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type AdminLogin = z.infer<typeof adminLoginSchema>;

// Admin user schema for validation
export const insertAdminUserSchema = createInsertSchema(adminUsers, {
  username: z.string().min(3, "Имя пользователя должно содержать минимум 3 символа").max(50),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов").max(255),
  fullName: z.string().min(1, "ФИО обязательно").max(255).optional(),
  email: z.string().email("Неверный формат email").optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminUserWithValidation = z.infer<typeof insertAdminUserSchema>;

// Event with related data type
export type EventWithStats = Event & {
  participantCount: number;
  monowheelCount: number;
  scooterCount: number;
  eboardCount: number;
  spectatorCount: number;
  chats: Array<Chat & { bot: Bot }>;
};

// User with event data type
export type UserWithEvent = User & {
  event: Event | null;
};
