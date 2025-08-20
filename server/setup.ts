import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { adminUsers } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface SetupData {
  admin: {
    username: string;
    password: string;
    fullName?: string;
    email?: string;
  };
  bot?: {
    token: string;
    name: string;
  };
  chat?: {
    chatId: string;
    title: string;
    botId: number;
  };
}

export class SetupManager {
  async isSetupComplete(): Promise<boolean> {
    try {
      // Проверяем, есть ли хотя бы один активный администратор
      const admins = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.isActive, true))
        .limit(1);
      
      return admins.length > 0;
    } catch (error) {
      console.error("Error checking setup status:", error);
      return false;
    }
  }

  async completeSetup(setupData: SetupData): Promise<void> {
    try {
      // Создаем первого администратора
      const hashedPassword = await bcrypt.hash(setupData.admin.password, 10);
      await db.insert(adminUsers).values({
        username: setupData.admin.username,
        password: hashedPassword,
        fullName: setupData.admin.fullName || null,
        email: setupData.admin.email || null,
        isActive: true,
        isSuperAdmin: true, // Первый админ всегда супер-админ
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Создаем бота если указан
      if (setupData.bot) {
        const bot = await storage.createBot({
          token: setupData.bot.token,
          name: setupData.bot.name,
          isActive: true,
        });

        // Создаем чат если указан
        if (setupData.chat) {
          await storage.createChat({
            chatId: setupData.chat.chatId,
            title: setupData.chat.title,
            botId: bot.id,
            isActive: true,
            createdAt: new Date(),
          });
        }
      }

      console.log("Setup completed successfully!");
    } catch (error) {
      console.error("Error during setup:", error);
      throw new Error("Ошибка при первоначальной настройке");
    }
  }

  async getSetupStatus(): Promise<{
    isComplete: boolean;
    hasAdmins: boolean;
    hasBots: boolean;
    hasChats: boolean;
  }> {
    try {
      const [admins, bots, chats] = await Promise.all([
        db.select().from(adminUsers).where(eq(adminUsers.isActive, true)).limit(1),
        storage.getBots(),
        storage.getChats(),
      ]);

      return {
        isComplete: admins.length > 0,
        hasAdmins: admins.length > 0,
        hasBots: bots.length > 0,
        hasChats: chats.length > 0,
      };
    } catch (error) {
      console.error("Error getting setup status:", error);
      return {
        isComplete: false,
        hasAdmins: false,
        hasBots: false,
        hasChats: false,
      };
    }
  }
}

export const setupManager = new SetupManager();