import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { insertEventSchema, insertBotSchema, insertReservedNumberSchema, adminLoginSchema } from "@shared/schema";
// Import Telegram bot and PDF generator only if files exist
let startTelegramBot: any = null;
let generateParticipantsPDF: any = null;
try {
  const telegramBot = await import("./telegram-bot");
  startTelegramBot = telegramBot.startTelegramBot;
} catch (e) {
  console.warn("Telegram bot module not found");
}
try {
  const pdfGenerator = await import("./pdf-generator");
  generateParticipantsPDF = pdfGenerator.generateParticipantsPDF;
} catch (e) {
  console.warn("PDF generator module not found");
}

// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  if (req.session?.adminId) {
    return next();
  }
  return res.status(401).json({ message: "Требуется авторизация" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add JSON middleware first
  app.use(express.json());
  app.use(sessionMiddleware);

  // Initialize default admin if doesn't exist
  try {
    const existingAdmin = await storage.getAdminByUsername("admin");
    if (!existingAdmin) {
      await storage.createAdmin("admin", "admin123");
      console.log("Создан администратор по умолчанию: admin/admin123");
    }
  } catch (error) {
    console.error("Ошибка создания администратора:", error);
  }

  // Start Telegram bots (if module is available)
  if (startTelegramBot) {
    try {
      const bots = await storage.getBots();
      for (const bot of bots.filter(b => b.isActive)) {
        await startTelegramBot(bot.token, storage);
      }
    } catch (error) {
      console.error("Ошибка запуска Telegram ботов:", error);
    }
  }

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = adminLoginSchema.parse(req.body);
      
      const isValid = await storage.validateAdminPassword(username, password);
      if (!isValid) {
        return res.status(401).json({ message: "Неверный логин или пароль" });
      }

      const admin = await storage.getAdminByUsername(username);
      (req.session as any).adminId = admin!.id;
      
      res.json({ success: true, admin: { id: admin!.id, username: admin!.username } });
    } catch (error) {
      res.status(400).json({ message: "Ошибка валидации данных" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const admin = await storage.getAdminByUsername("admin"); // Simplified for demo
      res.json({ id: admin!.id, username: admin!.username });
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения данных пользователя" });
    }
  });

  // Events routes
  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения мероприятий" });
    }
  });

  app.get("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения мероприятия" });
    }
  });

  app.post("/api/events", requireAuth, async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания мероприятия" });
    }
  });

  app.put("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(id, updates);
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления мероприятия" });
    }
  });

  app.delete("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления мероприятия" });
    }
  });

  // Statistics endpoint
  app.get("/api/stats/today", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const todayParticipants = await storage.getTodayParticipants(todayStart, todayEnd);
      
      res.json({
        todayRegistrations: todayParticipants.length
      });
    } catch (error) {
      console.error("Error fetching today stats:", error);
      res.status(500).json({ message: "Ошибка получения статистики" });
    }
  });

  // Bots management
  app.get("/api/bots", requireAuth, async (req, res) => {
    try {
      const bots = await storage.getBots();
      res.json(bots);
    } catch (error) {
      console.error("Error fetching bots:", error);
      res.status(500).json({ message: "Не удалось загрузить ботов" });
    }
  });

  app.post("/api/bots", requireAuth, async (req, res) => {
    try {
      const { token, name, description } = req.body;
      const bot = await storage.createBot({ token, name, description, isActive: true });
      res.json(bot);
    } catch (error) {
      console.error("Error creating bot:", error);
      res.status(500).json({ message: "Не удалось создать бота" });
    }
  });

  app.delete("/api/bots/:botId", requireAuth, async (req, res) => {
    try {
      const botId = parseInt(req.params.botId);
      await storage.deleteBot(botId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bot:", error);
      res.status(500).json({ message: "Не удалось удалить бота" });
    }
  });

  app.post("/api/bots/:botId/start", requireAuth, async (req, res) => {
    try {
      const botId = parseInt(req.params.botId);
      const bot = await storage.getBot(botId);
      
      if (!bot) {
        return res.status(404).json({ message: "Бот не найден" });
      }

      if (startTelegramBot) {
        await startTelegramBot(bot.token, storage);
      }
      
      await storage.activateBot(botId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting bot:", error);
      res.status(500).json({ message: "Не удалось запустить бота" });
    }
  });

  app.post("/api/bots/:botId/stop", requireAuth, async (req, res) => {
    try {
      const botId = parseInt(req.params.botId);
      await storage.deactivateBot(botId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping bot:", error);
      res.status(500).json({ message: "Не удалось остановить бота" });
    }
  });

  // Chats management  
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const chats = await storage.getChats();
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Не удалось загрузить чаты" });
    }
  });

  app.post("/api/chats", requireAuth, async (req, res) => {
    try {
      const { chatId, title, botId } = req.body;
      const chat = await storage.createChat({ chatId, title, botId, isActive: true });
      res.json(chat);
    } catch (error) {
      console.error("Error creating chat:", error);
      res.status(500).json({ message: "Не удалось создать чат" });
    }
  });

  app.delete("/api/chats/:chatId", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      await storage.deleteChat(chatId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat:", error);
      res.status(500).json({ message: "Не удалось удалить чат" });
    }
  });

  // Participants routes
  app.get("/api/events/:id/participants", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const participants = await storage.getUsersByEventId(eventId);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения участников" });
    }
  });

  app.put("/api/participants/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const participant = await storage.updateUser(id, updates);
      res.json(participant);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления участника" });
    }
  });

  app.delete("/api/participants/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deactivateUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка деактивации участника" });
    }
  });

  // Reserved numbers routes
  app.get("/api/events/:id/reserved-numbers", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const reservedNumbers = await storage.getReservedNumbers(eventId);
      res.json(reservedNumbers);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения зарезервированных номеров" });
    }
  });

  app.post("/api/events/:id/reserved-numbers", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { numbers } = req.body;
      
      // Validate numbers
      const validNumbers = numbers.filter((n: number) => n >= 1 && n <= 99);
      
      await storage.addReservedNumbers(eventId, validNumbers);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка резервирования номеров" });
    }
  });

  app.delete("/api/events/:id/reserved-numbers", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { numbers } = req.body;
      
      await storage.removeReservedNumbers(eventId, numbers);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления зарезервированных номеров" });
    }
  });

  // PDF generation route
  app.get("/api/events/:eventId/pdf", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const pdfBuffer = await generateParticipantsPDF(eventId, storage);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-${eventId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Не удалось создать PDF" });
    }
  });

  // Group notification route
  app.post("/api/events/:eventId/notify-group", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      // Get event details with statistics
      const events = await storage.getEvents();
      const eventWithStats = events.find(e => e.id === eventId);
      
      if (!eventWithStats || !eventWithStats.chat) {
        return res.status(404).json({ message: "Мероприятие или чат не найдены" });
      }

      // Get bot instance - we need to pass it from somewhere
      // For now, get the first active bot from storage
      const bots = await storage.getBots();
      const activeBot = bots.find(b => b.id === eventWithStats.chat.botId && b.isActive);
      
      if (!activeBot) {
        return res.status(400).json({ message: "Бот не активен" });
      }

      // Create temporary bot instance for notification
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const tempBot = new TelegramBot(activeBot.token);

      // Send notification to group
      const { sendEventNotificationToGroup } = await import('./telegram-bot');
      await sendEventNotificationToGroup(tempBot, eventWithStats.chat.chatId, {
        name: eventWithStats.name,
        location: eventWithStats.location,
        datetime: eventWithStats.datetime,
        monowheelCount: eventWithStats.monowheelCount,
        scooterCount: eventWithStats.scooterCount,
        spectatorCount: eventWithStats.spectatorCount,
        totalCount: eventWithStats.participantCount,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Не удалось отправить уведомление" });
    }
  });

  // PDF generation route
  app.get("/api/events/:id/pdf", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      const participants = await storage.getUsersByEventId(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }

      if (!generateParticipantsPDF) {
        return res.status(500).json({ message: "PDF генератор недоступен" });
      }
      const pdfBuffer = await generateParticipantsPDF(event, participants);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-${event.id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: "Ошибка генерации PDF" });
    }
  });

  // Bots management routes
  app.get("/api/bots", requireAuth, async (req, res) => {
    try {
      const bots = await storage.getBots();
      res.json(bots);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения ботов" });
    }
  });

  app.post("/api/bots", requireAuth, async (req, res) => {
    try {
      const botData = insertBotSchema.parse(req.body);
      const bot = await storage.createBot(botData);
      
      // Start the bot (if module is available)
      if (bot.isActive && startTelegramBot) {
        await startTelegramBot(bot.token, storage);
      }
      
      res.json(bot);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания бота" });
    }
  });

  // Chats routes
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const chats = await storage.getChats();
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения чатов" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
