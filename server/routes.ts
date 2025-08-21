import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { insertEventSchema, insertBotSchema, insertReservedNumberSchema, insertFixedNumberBindingSchema, adminLoginSchema } from "@shared/schema";
import { setupManager } from "./setup";
// Import Telegram bot and PDF generator only if files exist
let startTelegramBot: any = null;
let generateParticipantsPDF: any = null;

// Load modules asynchronously
(async () => {
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
})();

// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for development
    httpOnly: true,
    maxAge: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
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

  // Setup routes - must come before auth check
  app.get("/api/setup/status", async (req, res) => {
    try {
      const status = await setupManager.getSetupStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Ошибка проверки настройки" });
    }
  });

  app.post("/api/setup/complete", async (req, res) => {
    try {
      const isComplete = await setupManager.isSetupComplete();
      if (isComplete) {
        return res.status(400).json({ message: "Настройка уже завершена" });
      }

      await setupManager.completeSetup(req.body);
      res.json({ success: true, message: "Настройка завершена успешно" });
    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка настройки" });
    }
  });

  // Initialize default admin if doesn't exist (fallback for existing installations)
  try {
    const isSetupComplete = await setupManager.isSetupComplete();
    if (!isSetupComplete) {
      const existingAdmin = await storage.getAdminByUsername("admin");
      if (!existingAdmin) {
        await storage.createAdmin({
          username: "admin",
          password: "admin123",
          fullName: "Administrator",
          email: null,
          isActive: true,
          isSuperAdmin: true
        });
        console.log("Создан администратор по умолчанию: admin/admin123");
      }
    }
  } catch (error) {
    console.error("Ошибка создания администратора:", error);
  }

  // Start Telegram bots (if module is available)
  if (startTelegramBot) {
    try {
      const bots = await storage.getBots();
      const activeBot = bots.find(b => b.isActive);
      if (activeBot) {
        console.log(`Starting initial bot for: ${activeBot.username}`);
        await startTelegramBot(activeBot.token, storage);
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

  // Get unique locations for event creation (MUST be before /api/events/:id route)
  app.get("/api/events/locations", requireAuth, async (req, res) => {
    try {
      console.log("=== FETCHING UNIQUE LOCATIONS ===");
      const locations = await storage.getUniqueLocations();
      console.log("=== FOUND LOCATIONS ===", locations);
      console.log("=== LOCATIONS COUNT ===", locations.length);
      res.json(locations);
    } catch (error) {
      console.error("=== ERROR FETCHING LOCATIONS ===", error);
      res.status(500).json({ message: "Ошибка получения мест проведения" });
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
      const { chatIds, ...eventData } = req.body;
      if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
        return res.status(400).json({ message: "Выберите хотя бы один чат" });
      }
      
      // Convert datetime string to proper Date object if needed
      if (eventData.datetime && typeof eventData.datetime === 'string') {
        eventData.datetime = new Date(eventData.datetime);
      }
      
      const event = await storage.createEvent(eventData, chatIds.map(id => parseInt(id)));
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания мероприятия" });
    }
  });

  app.put("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { chatIds, ...eventUpdates } = req.body;
      
      // Convert datetime string to proper Date object if needed
      if (eventUpdates.datetime && typeof eventUpdates.datetime === 'string') {
        eventUpdates.datetime = new Date(eventUpdates.datetime);
      }
      
      // Update event data
      if (Object.keys(eventUpdates).length > 0) {
        await storage.updateEvent(id, eventUpdates);
      }
      
      // Update chat associations if provided
      if (chatIds && Array.isArray(chatIds)) {
        await storage.updateEventChats(id, chatIds.map(chatId => parseInt(chatId)));
      }
      
      const event = await storage.getEvent(id);
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
      const { token, name } = req.body;
      const bot = await storage.createBot({ token, name, isActive: true });
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
        console.log(`Starting bot for: ${bot.username}`);
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

  app.get("/api/users/all", requireAuth, async (req, res) => {
    try {
      const participants = await storage.getAllUsers();
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения всех участников" });
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

  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления участника" });
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
      const { generateParticipantsPDF } = await import('./pdf-generator');
      const event = await storage.getEvent(eventId);
      const participants = await storage.getUsersByEventId(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }
      const pdfBuffer = await generateParticipantsPDF(eventId, storage);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-${eventId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Не удалось создать PDF" });
    }
  });

  app.get("/api/events/:eventId/pdf-transport", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const { generateTransportGroupedPDF } = await import('./pdf-generator');
      const pdfBuffer = await generateTransportGroupedPDF(eventId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-transport-${eventId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating transport PDF:", error);
      res.status(500).json({ message: "Не удалось создать PDF по транспорту" });
    }
  });

  // Public PDF generation routes (with masked phone numbers)
  app.get("/api/public/events/:eventId/pdf", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const { generateParticipantsPDF } = await import('./pdf-generator');
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }
      
      // Generate PDF with masked phone numbers
      const pdfBuffer = await generateParticipantsPDF(eventId, storage, true);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-${eventId}-public.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating public PDF:", error);
      res.status(500).json({ message: "Не удалось создать PDF" });
    }
  });

  app.get("/api/public/events/:eventId/pdf-transport", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const { generateTransportGroupedPDF } = await import('./pdf-generator');
      
      // Generate PDF with masked phone numbers
      const pdfBuffer = await generateTransportGroupedPDF(eventId, true);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="participants-transport-${eventId}-public.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating public transport PDF:", error);
      res.status(500).json({ message: "Не удалось создать PDF по транспорту" });
    }
  });



  // Group notification route
  app.post("/api/events/:eventId/notify-group", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      // Get event details with statistics
      const events = await storage.getEvents();
      const eventWithStats = events.find(e => e.id === eventId);
      
      if (!eventWithStats || !eventWithStats.chats || eventWithStats.chats.length === 0) {
        return res.status(404).json({ message: "Мероприятие или чаты не найдены" });
      }

      // Send to all chats associated with event
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const { sendEventNotificationToGroup } = await import('./telegram-bot');
      
      for (const chat of eventWithStats.chats) {
        const bot = chat.bot;
        if (!bot.isActive) continue;
        
        const tempBot = new TelegramBot(bot.token);
        
        // Get bot username from Telegram API
        let botUsername;
        try {
          const botInfo = await tempBot.getMe();
          botUsername = botInfo.username;
        } catch (error) {
          console.error('Failed to get bot info:', error);
          botUsername = null;
        }
        
        await sendEventNotificationToGroup(tempBot, chat.chatId, {
        name: eventWithStats.name,
        location: eventWithStats.location,
        datetime: eventWithStats.datetime,
        monowheelCount: eventWithStats.monowheelCount,
        scooterCount: eventWithStats.scooterCount,
        spectatorCount: eventWithStats.spectatorCount,
        totalCount: eventWithStats.participantCount,
        }, botUsername || undefined);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Не удалось отправить уведомление" });
    }
  });

  // Fixed number bindings routes
  app.get("/api/fixed-bindings", requireAuth, async (req, res) => {
    try {
      const bindings = await storage.getFixedNumberBindings();
      res.json(bindings);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения привязок номеров" });
    }
  });

  // Check conflicts for fixed number
  app.get("/api/fixed-bindings/check-conflicts/:number", requireAuth, async (req, res) => {
    try {
      const participantNumber = parseInt(req.params.number);
      if (isNaN(participantNumber) || participantNumber < 1 || participantNumber > 999) {
        return res.status(400).json({ message: "Неверный номер участника" });
      }
      
      const conflicts = await storage.checkFixedNumberConflicts(participantNumber);
      res.json({ conflicts });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Ошибка проверки конфликтов" });
    }
  });

  app.post("/api/fixed-bindings", requireAuth, async (req, res) => {
    try {
      const bindingData = insertFixedNumberBindingSchema.parse(req.body);
      
      // Count existing users that will be updated
      const existingUsers = await storage.getUsersByTelegramNickname(bindingData.telegramNickname);
      
      // Check conflicts
      const conflicts = await storage.checkFixedNumberConflicts(bindingData.participantNumber);
      
      // Check if this telegram nickname already has a binding
      const existingUserBinding = await storage.getFixedNumberByTelegramNickname(bindingData.telegramNickname);
      if (existingUserBinding) {
        return res.status(400).json({ 
          message: `У пользователя @${bindingData.telegramNickname} уже есть постоянный номер ${existingUserBinding.participantNumber}. Один пользователь может иметь только один постоянный номер.`,
          existingNumber: existingUserBinding.participantNumber
        });
      }

      // Check if this number is already bound to another user
      const existingBinding = await storage.getFixedNumberByParticipantNumber(bindingData.participantNumber);
      if (existingBinding && existingBinding.telegramNickname !== bindingData.telegramNickname) {
        return res.status(400).json({ 
          message: `Номер ${bindingData.participantNumber} уже закреплён за пользователем @${existingBinding.telegramNickname}. Выберите другой номер или удалите существующую привязку.`,
          conflictWith: existingBinding.telegramNickname
        });
      }
      
      const binding = await storage.createFixedNumberBinding(bindingData);
      
      // Update existing users with the new binding
      await storage.updateUsersWithFixedNumber(bindingData.telegramNickname, bindingData.participantNumber);
      
      res.json({ 
        binding, 
        updatedUsersCount: existingUsers.length,
        conflicts: conflicts.length,
        reassignedFrom: existingBinding?.telegramNickname || null,
        message: existingBinding 
          ? `Привязка создана. Номер ${bindingData.participantNumber} переназначен с @${existingBinding.telegramNickname} на @${bindingData.telegramNickname}.${existingUsers.length > 0 ? ` Обновлено ${existingUsers.length} пользователей.` : ''}`
          : existingUsers.length > 0 
            ? `Привязка создана. Обновлено ${existingUsers.length} существующих пользователей.`
            : "Привязка создана."
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания привязки номера" });
    }
  });

  app.delete("/api/fixed-bindings/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFixedNumberBinding(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления привязки номера" });
    }
  });

  // PDF generation route


  // Public event route
  app.get("/api/public/events/:shareCode", async (req, res) => {
    try {
      const shareCode = req.params.shareCode;
      const event = await storage.getEventByShareCode(shareCode);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }

      const participants = await storage.getUsersByEventId(event.id);
      const activeParticipants = participants.filter(p => p.isActive);

      // Remove phone numbers for public view
      const publicParticipants = activeParticipants.map(p => ({
        id: p.id,
        fullName: p.fullName,
        telegramNickname: p.telegramNickname,
        transportType: p.transportType,
        transportModel: p.transportModel,
        participantNumber: p.participantNumber,
        isActive: p.isActive
      }));

      res.json({
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          location: event.location,
          datetime: event.datetime
        },
        participants: publicParticipants
      });
    } catch (error) {
      console.error("Error fetching public event:", error);
      res.status(500).json({ message: "Ошибка получения данных мероприятия" });
    }
  });

  // Generate/get share code for event
  app.post("/api/events/:id/share", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Мероприятие не найдено" });
      }

      let shareCode = event.shareCode;
      if (!shareCode) {
        shareCode = await storage.generateShareCode(eventId);
      }

      res.json({ shareCode });
    } catch (error) {
      console.error("Error generating share code:", error);
      res.status(500).json({ message: "Ошибка генерации ссылки" });
    }
  });

  // Telegram nicknames route
  app.get("/api/telegram-nicknames", requireAuth, async (req, res) => {
    try {
      const nicknames = await storage.getExistingTelegramNicknames();
      res.json(nicknames);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения telegram-ников" });
    }
  });

  // Get users for binding options (includes users without telegram nicknames)
  app.get("/api/users-for-binding", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsersForBindingOptions();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения пользователей" });
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
        console.log(`Starting bot for: ${bot.username}`);
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
  // Admin management routes
  app.get('/api/admins', requireAuth, async (req, res) => {
    try {
      const admins = await storage.getAdmins();
      // Don't return passwords
      const safeAdmins = admins.map(admin => ({
        ...admin,
        password: undefined
      }));
      res.json(safeAdmins);
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Не удалось загрузить список администраторов" });
    }
  });

  app.post('/api/admins', requireAuth, async (req, res) => {
    try {
      const adminData = req.body;
      const newAdmin = await storage.createAdmin(adminData);
      // Don't return password
      const { password, ...safeAdmin } = newAdmin;
      res.status(201).json(safeAdmin);
    } catch (error: any) {
      console.error("Error creating admin:", error);
      if (error.message?.includes('unique')) {
        res.status(400).json({ message: "Администратор с таким именем пользователя уже существует" });
      } else {
        res.status(500).json({ message: "Не удалось создать администратора" });
      }
    }
  });

  app.put('/api/admins/:id', requireAuth, async (req, res) => {
    try {
      const adminId = parseInt(req.params.id);
      const updateData = req.body;
      const updatedAdmin = await storage.updateAdmin(adminId, updateData);
      // Don't return password
      const { password, ...safeAdmin } = updatedAdmin;
      res.json(safeAdmin);
    } catch (error: any) {
      console.error("Error updating admin:", error);
      if (error.message?.includes('unique')) {
        res.status(400).json({ message: "Администратор с таким именем пользователя уже существует" });
      } else {
        res.status(500).json({ message: "Не удалось обновить данные администратора" });
      }
    }
  });

  app.delete('/api/admins/:id', requireAuth, async (req, res) => {
    try {
      const adminId = parseInt(req.params.id);
      const currentUserId = (req.session as any).userId;
      
      // Prevent self-deletion
      if (adminId === currentUserId) {
        return res.status(400).json({ message: "Нельзя удалить собственную учётную запись" });
      }
      
      await storage.deleteAdmin(adminId);
      res.json({ message: "Администратор удалён" });
    } catch (error) {
      console.error("Error deleting admin:", error);
      res.status(500).json({ message: "Не удалось удалить администратора" });
    }
  });

  return httpServer;
}
