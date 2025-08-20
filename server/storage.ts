import {
  users,
  events,
  bots,
  chats,
  reservedNumbers,
  fixedNumberBindings,
  adminUsers,
  type User,
  type InsertUser,
  type Event,
  type InsertEvent,
  type Bot,
  type InsertBot,
  type Chat,
  type InsertChat,
  type ReservedNumber,
  type InsertReservedNumber,
  type FixedNumberBinding,
  type InsertFixedNumberBinding,
  type AdminUser,
  type EventWithStats,
  type UserWithEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserRegistrationsByTelegramId(telegramId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  getUsersByEventId(eventId: number): Promise<UserWithEvent[]>;
  deactivateUser(id: number): Promise<void>;
  getAvailableParticipantNumber(eventId: number): Promise<number>;

  // Event operations
  getEvents(): Promise<EventWithStats[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getActiveEvents(): Promise<Event[]>;
  getActiveEventsByChatId(chatId: number): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;

  // Bot operations
  getBots(): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  getBotByToken(token: string): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBot(id: number, updates: Partial<InsertBot>): Promise<Bot>;
  deleteBot(id: number): Promise<void>;
  activateBot(id: number): Promise<void>;
  deactivateBot(id: number): Promise<void>;

  // Chat operations
  getChats(): Promise<Chat[]>;
  getChat(id: number): Promise<Chat | undefined>;
  getChatByChatId(chatId: string): Promise<Chat | undefined>;
  createChat(chat: Omit<Chat, 'id' | 'createdAt'>): Promise<Chat>;
  updateChat(id: number, updates: Partial<Chat>): Promise<Chat>;
  deleteChat(id: number): Promise<void>;

  // Reserved numbers operations
  getReservedNumbers(eventId: number): Promise<ReservedNumber[]>;
  addReservedNumbers(eventId: number, numbers: number[]): Promise<void>;
  removeReservedNumbers(eventId: number, numbers: number[]): Promise<void>;

  // Fixed number bindings operations
  getFixedNumberBindings(): Promise<FixedNumberBinding[]>;
  createFixedNumberBinding(binding: InsertFixedNumberBinding): Promise<FixedNumberBinding>;
  deleteFixedNumberBinding(id: number): Promise<void>;
  getFixedNumberByTelegramNickname(nickname: string): Promise<FixedNumberBinding | undefined>;

  // Admin operations
  getAdminByUsername(username: string): Promise<AdminUser | undefined>;
  validateAdminPassword(username: string, password: string): Promise<boolean>;
  createAdmin(username: string, password: string): Promise<AdminUser>;

  // Statistics operations
  getTodayParticipants(startDate: Date, endDate: Date): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUserRegistrationsByTelegramId(telegramId: string): Promise<User[]> {
    const userRegistrations = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return userRegistrations;
  }

  async createUser(user: InsertUser): Promise<User> {
    // Get available participant number with fixed binding support
    const participantNumber = await this.getAvailableParticipantNumber(user.eventId, user.telegramNickname);
    
    const [createdUser] = await db
      .insert(users)
      .values({
        ...user,
        participantNumber,
        updatedAt: new Date(),
      })
      .returning();
    return createdUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getUsersByEventId(eventId: number): Promise<UserWithEvent[]> {
    const result = await db
      .select({
        user: users,
        event: events,
      })
      .from(users)
      .innerJoin(events, eq(users.eventId, events.id))
      .where(eq(users.eventId, eventId))
      .orderBy(users.participantNumber);

    return result.map(row => ({
      ...row.user,
      event: row.event,
    }));
  }

  async deactivateUser(id: number): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async getAvailableParticipantNumber(eventId: number, telegramNickname?: string | null): Promise<number> {
    // Check if user has a fixed number binding
    if (telegramNickname) {
      const fixedBinding = await this.getFixedNumberByTelegramNickname(telegramNickname);
      if (fixedBinding) {
        // Check if this number is already taken by someone else for this event
        const existingUser = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.eventId, eventId),
              eq(users.participantNumber, fixedBinding.participantNumber),
              eq(users.isActive, true)
            )
          );
        
        if (existingUser.length === 0) {
          return fixedBinding.participantNumber;
        }
      }
    }

    // Get existing participant numbers
    const existingNumbers = await db
      .select({ participantNumber: users.participantNumber })
      .from(users)
      .where(eq(users.eventId, eventId));

    // Get reserved numbers
    const reservedNumbersResult = await db
      .select({ number: reservedNumbers.number })
      .from(reservedNumbers)
      .where(eq(reservedNumbers.eventId, eventId));

    // Get all fixed bindings (these numbers should be avoided for dynamic assignment)
    const fixedBindingsData = await this.getFixedNumberBindings();

    const usedNumbers = new Set([
      ...existingNumbers.map(u => u.participantNumber).filter(n => n !== null),
      ...reservedNumbersResult.map((r: { number: number }) => r.number),
      ...fixedBindingsData.map(b => b.participantNumber) // Reserve fixed numbers
    ]);

    // Find first available number from 1 to 99
    for (let i = 1; i <= 99; i++) {
      if (!usedNumbers.has(i)) {
        return i;
      }
    }

    throw new Error("Все номера участников заняты");
  }

  // Event operations
  async getEvents(): Promise<EventWithStats[]> {
    const result = await db
      .select({
        event: events,
        chat: chats,
        bot: bots,
        participantCount: sql<number>`COUNT(CASE WHEN ${users.isActive} = true THEN 1 END)`,
        monowheelCount: sql<number>`COUNT(CASE WHEN ${users.transportType} = 'monowheel' AND ${users.isActive} = true THEN 1 END)`,
        scooterCount: sql<number>`COUNT(CASE WHEN ${users.transportType} = 'scooter' AND ${users.isActive} = true THEN 1 END)`,
        spectatorCount: sql<number>`COUNT(CASE WHEN ${users.transportType} = 'spectator' AND ${users.isActive} = true THEN 1 END)`,
      })
      .from(events)
      .leftJoin(chats, eq(events.chatId, chats.id))
      .leftJoin(bots, eq(chats.botId, bots.id))
      .leftJoin(users, eq(events.id, users.eventId))
      .groupBy(events.id, chats.id, bots.id)
      .orderBy(desc(events.createdAt));

    return result.map(row => ({
      ...row.event,
      participantCount: Number(row.participantCount),
      monowheelCount: Number(row.monowheelCount),
      scooterCount: Number(row.scooterCount),
      spectatorCount: Number(row.spectatorCount),
      chat: {
        ...row.chat!,
        bot: row.bot!,
      },
    }));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getActiveEvents(): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.isActive, true))
      .orderBy(desc(events.datetime));
  }

  async getActiveEventsByChatId(chatId: number): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(and(eq(events.chatId, chatId), eq(events.isActive, true)))
      .orderBy(events.datetime);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [createdEvent] = await db
      .insert(events)
      .values({
        ...event,
        updatedAt: new Date(),
      })
      .returning();
    return createdEvent;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Bot operations
  async getBots(): Promise<Bot[]> {
    return await db.select().from(bots).orderBy(bots.name);
  }



  async getBot(id: number): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.id, id));
    return bot;
  }

  async getBotByToken(token: string): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.token, token));
    return bot;
  }

  async createBot(bot: InsertBot): Promise<Bot> {
    const [createdBot] = await db.insert(bots).values(bot).returning();
    return createdBot;
  }

  async updateBot(id: number, updates: Partial<InsertBot>): Promise<Bot> {
    const [updatedBot] = await db
      .update(bots)
      .set(updates)
      .where(eq(bots.id, id))
      .returning();
    return updatedBot;
  }

  async deleteBot(id: number): Promise<void> {
    await db.delete(bots).where(eq(bots.id, id));
  }

  async activateBot(id: number): Promise<void> {
    await db.update(bots).set({ isActive: true }).where(eq(bots.id, id));
  }

  async deactivateBot(id: number): Promise<void> {
    await db.update(bots).set({ isActive: false }).where(eq(bots.id, id));
  }

  // Chat operations
  async getChats(): Promise<Chat[]> {
    return await db.select().from(chats).orderBy(chats.title);
  }



  async getChat(id: number): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id));
    return chat;
  }

  async getChatByChatId(chatId: string): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.chatId, chatId));
    return chat;
  }

  async createChat(chat: Omit<Chat, 'id' | 'createdAt'>): Promise<Chat> {
    const [createdChat] = await db.insert(chats).values(chat).returning();
    return createdChat;
  }

  async updateChat(id: number, updates: Partial<Chat>): Promise<Chat> {
    const [updatedChat] = await db
      .update(chats)
      .set(updates)
      .where(eq(chats.id, id))
      .returning();
    return updatedChat;
  }

  async deleteChat(id: number): Promise<void> {
    await db.delete(chats).where(eq(chats.id, id));
  }

  // Reserved numbers operations
  async getReservedNumbers(eventId: number): Promise<ReservedNumber[]> {
    return await db
      .select()
      .from(reservedNumbers)
      .where(eq(reservedNumbers.eventId, eventId))
      .orderBy(reservedNumbers.number);
  }

  async addReservedNumbers(eventId: number, numbers: number[]): Promise<void> {
    if (numbers.length === 0) return;

    const values = numbers.map(number => ({
      eventId,
      number,
    }));

    await db.insert(reservedNumbers).values(values);
  }

  async removeReservedNumbers(eventId: number, numbers: number[]): Promise<void> {
    if (numbers.length === 0) return;

    await db
      .delete(reservedNumbers)
      .where(
        and(
          eq(reservedNumbers.eventId, eventId),
          inArray(reservedNumbers.number, numbers)
        )
      );
  }

  // Fixed number bindings operations
  async getFixedNumberBindings(): Promise<FixedNumberBinding[]> {
    return await db.select().from(fixedNumberBindings);
  }

  async createFixedNumberBinding(binding: InsertFixedNumberBinding): Promise<FixedNumberBinding> {
    const [created] = await db
      .insert(fixedNumberBindings)
      .values(binding)
      .returning();
    return created;
  }

  async deleteFixedNumberBinding(id: number): Promise<void> {
    await db.delete(fixedNumberBindings).where(eq(fixedNumberBindings.id, id));
  }

  async getFixedNumberByTelegramNickname(nickname: string): Promise<FixedNumberBinding | undefined> {
    const [binding] = await db
      .select()
      .from(fixedNumberBindings)
      .where(eq(fixedNumberBindings.telegramNickname, nickname));
    return binding;
  }

  // Admin operations
  async getAdminByUsername(username: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username));
    return admin;
  }

  async validateAdminPassword(username: string, password: string): Promise<boolean> {
    const admin = await this.getAdminByUsername(username);
    if (!admin) return false;

    return await bcrypt.compare(password, admin.password);
  }

  async createAdmin(username: string, password: string): Promise<AdminUser> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [admin] = await db
      .insert(adminUsers)
      .values({
        username,
        password: hashedPassword,
      })
      .returning();
    return admin;
  }

  // Statistics operations
  async getTodayParticipants(startDate: Date, endDate: Date): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          sql`${users.createdAt} >= ${startDate}`,
          sql`${users.createdAt} < ${endDate}`,
          eq(users.isActive, true)
        )
      );
  }
}

export const storage = new DatabaseStorage();
