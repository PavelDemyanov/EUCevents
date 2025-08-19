import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { insertEventSchema, insertBotSchema, insertReservedNumberSchema, adminLoginSchema } from "@shared/schema";
import { startTelegramBot } from "./telegram-bot";
import { generateParticipantsPDF } from "./pdf-generator";

// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
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

  // Start Telegram bots
  try {
    const bots = await storage.getBots();
    for (const bot of bots.filter(b => b.isActive)) {
      await startTelegramBot(bot.token, storage);
    }
  } catch (error) {
    console.error("Ошибка запуска Telegram ботов:", error);
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
  app.get("/api/events/:id/pdf", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      const participants = await storage.getUsersByEventId(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
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
      
      // Start the bot
      if (bot.isActive) {
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
