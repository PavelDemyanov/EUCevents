import {
  users,
  events,
  eventChats,
  bots,
  chats,
  reservedNumbers,
  fixedNumberBindings,
  adminUsers,
  type User,
  type InsertUser,
  type Event,
  type InsertEvent,
  type EventChat,
  type InsertEventChat,
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
import { eq, and, desc, sql, inArray, isNotNull, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserRegistrationsByTelegramId(telegramId: string): Promise<User[]>;
  getUserRegistration(telegramId: string, eventId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  getUsersByEventId(eventId: number): Promise<UserWithEvent[]>;
  deactivateUser(id: number): Promise<void>;
  getAvailableParticipantNumber(eventId: number): Promise<number>;

  // Event operations
  getEvents(): Promise<EventWithStats[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventByShareCode(shareCode: string): Promise<Event | undefined>;
  getActiveEvents(): Promise<Event[]>;
  getActiveEventsByChatId(chatId: number): Promise<Event[]>;
  createEvent(event: InsertEvent, chatIds: number[]): Promise<Event>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event>;
  updateEventChats(eventId: number, chatIds: number[]): Promise<void>;
  deleteEvent(id: number): Promise<void>;
  generateShareCode(eventId: number): Promise<string>;
  
  // Event-Chat operations
  getEventChats(eventId: number): Promise<Chat[]>;
  addEventChat(eventId: number, chatId: number): Promise<EventChat>;
  removeEventChat(eventId: number, chatId: number): Promise<void>;

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
  createAdmin(adminData: InsertAdminUser): Promise<AdminUser>;

  // Admin management operations
  getAdmins(): Promise<AdminUser[]>;
  getAdmin(id: number): Promise<AdminUser | undefined>;
  updateAdmin(id: number, updates: Partial<InsertAdminUser>): Promise<AdminUser>;
  deleteAdmin(id: number): Promise<void>;

  // Statistics operations
  getTodayParticipants(startDate: Date, endDate: Date): Promise<User[]>;
  
  // Telegram nicknames operations
  getExistingTelegramNicknames(): Promise<string[]>;
  getUsersByTelegramNickname(telegramNickname: string): Promise<User[]>;
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
    // Get the user to check their current details
    const [existingUser] = await db.select().from(users).where(eq(users.id, id));
    
    let finalUpdates = { ...updates, updatedAt: new Date() };
    
    // If reactivating user (isActive: true) or telegramNickname is being updated, 
    // check for fixed number assignment
    if ((updates.isActive === true || updates.telegramNickname) && existingUser) {
      const telegramNickname = updates.telegramNickname || existingUser.telegramNickname;
      if (telegramNickname) {
        const fixedBinding = await this.getFixedNumberByTelegramNickname(telegramNickname);
        if (fixedBinding) {
          // Check if this number is available for this event
          const existingUserWithNumber = await db
            .select()
            .from(users)
            .where(
              and(
                eq(users.eventId, existingUser.eventId),
                eq(users.participantNumber, fixedBinding.participantNumber),
                eq(users.isActive, true),
                ne(users.id, id) // Exclude current user
              )
            );
          
          if (existingUserWithNumber.length === 0) {
            (finalUpdates as any).participantNumber = fixedBinding.participantNumber;
          }
        }
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(finalUpdates)
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
    const eventsData = await db
      .select({
        id: events.id,
        name: events.name,
        location: events.location,
        datetime: events.datetime,
        shareCode: events.shareCode,
        isActive: events.isActive,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        participantCount: sql<number>`CAST(COUNT(CASE WHEN ${users.isActive} = true THEN 1 END) AS INTEGER)`,
        monowheelCount: sql<number>`CAST(COUNT(CASE WHEN ${users.transportType} = 'monowheel' AND ${users.isActive} = true THEN 1 END) AS INTEGER)`,
        scooterCount: sql<number>`CAST(COUNT(CASE WHEN ${users.transportType} = 'scooter' AND ${users.isActive} = true THEN 1 END) AS INTEGER)`,
        spectatorCount: sql<number>`CAST(COUNT(CASE WHEN ${users.transportType} = 'spectator' AND ${users.isActive} = true THEN 1 END) AS INTEGER)`
      })
      .from(events)
      .leftJoin(users, eq(users.eventId, events.id))
      .groupBy(events.id)
      .orderBy(desc(events.createdAt));

    // Get chats for each event separately
    const eventsWithChats = await Promise.all(
      eventsData.map(async (event) => {
        const eventChatsData = await db
          .select({
            chat: {
              id: chats.id,
              chatId: chats.chatId,
              botId: chats.botId,
              title: chats.title,
              isActive: chats.isActive,
              createdAt: chats.createdAt
            },
            bot: {
              id: bots.id,
              token: bots.token,
              name: bots.name,
              isActive: bots.isActive,
              createdAt: bots.createdAt
            }
          })
          .from(eventChats)
          .innerJoin(chats, eq(chats.id, eventChats.chatId))
          .innerJoin(bots, eq(bots.id, chats.botId))
          .where(eq(eventChats.eventId, event.id));

        return {
          ...event,
          chats: eventChatsData.map(item => ({
            ...item.chat,
            bot: item.bot
          }))
        };
      })
    );

    return eventsWithChats as EventWithStats[];
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventByShareCode(shareCode: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.shareCode, shareCode));
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
    const result = await db
      .select({
        id: events.id,
        name: events.name,
        location: events.location,
        datetime: events.datetime,
        shareCode: events.shareCode,
        isActive: events.isActive,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt
      })
      .from(events)
      .innerJoin(eventChats, eq(eventChats.eventId, events.id))
      .where(and(eq(eventChats.chatId, chatId), eq(events.isActive, true)))
      .orderBy(events.datetime);
    
    return result;
  }

  async createEvent(event: InsertEvent, chatIds: number[] = []): Promise<Event> {
    const shareCode = this.generateRandomShareCode();
    const [createdEvent] = await db
      .insert(events)
      .values({
        ...event,
        shareCode,
        updatedAt: new Date(),
      })
      .returning();
    
    // Add chat associations
    if (chatIds.length > 0) {
      await this.updateEventChats(createdEvent.id, chatIds);
    }
    
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

  async generateShareCode(eventId: number): Promise<string> {
    // Generate or update share code for existing event
    const shareCode = this.generateRandomShareCode();
    await db
      .update(events)
      .set({ shareCode, updatedAt: new Date() })
      .where(eq(events.id, eventId));
    return shareCode;
  }

  private generateRandomShareCode(): string {
    // Generate format: XXX-YYYY-ZZZ
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part1}-${part2}-${part3}`;
  }

  // Event-Chat operations
  async getEventChats(eventId: number): Promise<Chat[]> {
    const eventChatsData = await db
      .select({
        id: chats.id,
        chatId: chats.chatId,
        botId: chats.botId,
        title: chats.title,
        isActive: chats.isActive,
        createdAt: chats.createdAt
      })
      .from(eventChats)
      .innerJoin(chats, eq(chats.id, eventChats.chatId))
      .where(eq(eventChats.eventId, eventId));
    
    return eventChatsData;
  }

  async addEventChat(eventId: number, chatId: number): Promise<EventChat> {
    const [eventChat] = await db
      .insert(eventChats)
      .values({ eventId, chatId })
      .returning();
    return eventChat;
  }

  async removeEventChat(eventId: number, chatId: number): Promise<void> {
    await db
      .delete(eventChats)
      .where(and(eq(eventChats.eventId, eventId), eq(eventChats.chatId, chatId)));
  }

  async updateEventChats(eventId: number, chatIds: number[]): Promise<void> {
    // Remove all existing event-chat associations
    await db.delete(eventChats).where(eq(eventChats.eventId, eventId));
    
    // Add new associations
    if (chatIds.length > 0) {
      await db.insert(eventChats).values(
        chatIds.map(chatId => ({ eventId, chatId }))
      );
    }
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
    
    // Update all existing users with this telegram nickname to use the fixed number
    await this.updateUsersWithFixedNumber(binding.telegramNickname, binding.participantNumber);
    
    return created;
  }

  async updateUsersWithFixedNumber(telegramNickname: string, participantNumber: number): Promise<void> {
    // Find all users with this telegram nickname
    const usersToUpdate = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.telegramNickname, telegramNickname),
          eq(users.isActive, true)
        )
      );

    // Update each user's participant number
    for (const user of usersToUpdate) {
      // Check if the target number is already taken by someone else in the same event
      const conflictingUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.eventId, user.eventId),
            eq(users.participantNumber, participantNumber),
            ne(users.id, user.id),
            eq(users.isActive, true)
          )
        );

      if (conflictingUsers.length === 0) {
        // Safe to update - no conflicts
        await db
          .update(users)
          .set({
            participantNumber,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
      // If there's a conflict, we skip this user - they'll get the fixed number on next registration
    }
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

  async createAdmin(adminData: InsertAdminUser): Promise<AdminUser> {
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    const [admin] = await db
      .insert(adminUsers)
      .values({
        ...adminData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return admin;
  }

  // Admin management operations
  async getAdmins(): Promise<AdminUser[]> {
    return await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.isActive, true))
      .orderBy(adminUsers.createdAt);
  }

  async getAdmin(id: number): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id));
    return admin;
  }

  async updateAdmin(id: number, updates: Partial<InsertAdminUser>): Promise<AdminUser> {
    let finalUpdates = { ...updates, updatedAt: new Date() };
    
    // Hash password if it's being updated
    if (updates.password) {
      finalUpdates.password = await bcrypt.hash(updates.password, 10);
    }

    const [admin] = await db
      .update(adminUsers)
      .set(finalUpdates)
      .where(eq(adminUsers.id, id))
      .returning();
    return admin;
  }

  async deleteAdmin(id: number): Promise<void> {
    await db
      .update(adminUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(adminUsers.id, id));
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

  async getExistingTelegramNicknames(): Promise<string[]> {
    const result = await db
      .selectDistinct({ telegramNickname: users.telegramNickname })
      .from(users)
      .where(
        and(
          isNotNull(users.telegramNickname),
          ne(users.telegramNickname, "")
        )
      );
    
    return result
      .map(row => row.telegramNickname)
      .filter(nickname => nickname !== null) as string[];
  }

  async getUsersByTelegramNickname(telegramNickname: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.telegramNickname, telegramNickname),
          eq(users.isActive, true)
        )
      );
  }

  async getUserRegistration(telegramId: string, eventId: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.telegramId, telegramId),
          eq(users.eventId, eventId)
        )
      );
    return user;
  }
}

export const storage = new DatabaseStorage();
