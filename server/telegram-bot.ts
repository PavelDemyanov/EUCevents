import TelegramBot from 'node-telegram-bot-api';
import { IStorage } from './storage';
import { InsertUser } from '@shared/schema';

interface UserRegistrationState {
  step: 'event_selection' | 'full_name' | 'phone' | 'transport_type';
  eventId?: number;
  fullName?: string;
  phone?: string;
  telegramNickname?: string;
}

const userStates = new Map<string, UserRegistrationState>();

export async function startTelegramBot(token: string, storage: IStorage) {
  const bot = new TelegramBot(token, { polling: true });

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const telegramId = msg.from?.id.toString();
    const telegramNickname = msg.from?.username;

    if (!telegramId) {
      return bot.sendMessage(chatId, "Ошибка получения данных пользователя.");
    }

    try {
      // Check if user is already registered
      const existingUser = await storage.getUserByTelegramId(telegramId);
      if (existingUser && existingUser.isActive) {
        const event = await storage.getEvent(existingUser.eventId);
        return bot.sendMessage(
          chatId,
          `Вы уже зарегистрированы на мероприятие "${event?.name}"!\n\n` +
          `📋 Ваши данные:\n` +
          `👤 ФИО: ${existingUser.fullName}\n` +
          `📱 Телефон: ${existingUser.phone}\n` +
          `🚗 Транспорт: ${getTransportTypeLabel(existingUser.transportType)}\n` +
          `🏷️ Номер участника: ${existingUser.participantNumber}\n\n` +
          `Чтобы изменить тип транспорта или отказаться от участия, выберите действие:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Изменить тип транспорта", callback_data: "change_transport" }],
                [{ text: "Отказаться от участия", callback_data: "cancel_participation" }],
              ],
            },
          }
        );
      }

      // Get chat info and find linked events
      const chat = await storage.getChatByChatId(chatId);
      if (!chat) {
        return bot.sendMessage(
          chatId,
          "Этот чат не связан с системой управления мероприятиями. Обратитесь к администратору."
        );
      }

      const activeEvents = await storage.getActiveEventsByChatId(chat.id);
      if (activeEvents.length === 0) {
        return bot.sendMessage(
          chatId,
          "В данный момент нет активных мероприятий для регистрации."
        );
      }

      // Initialize registration state
      userStates.set(telegramId, {
        step: 'event_selection',
        telegramNickname,
      });

      if (activeEvents.length === 1) {
        // Auto-select single event
        userStates.set(telegramId, {
          step: 'full_name',
          eventId: activeEvents[0].id,
          telegramNickname,
        });

        return bot.sendMessage(
          chatId,
          `Добро пожаловать на регистрацию мероприятия!\n\n` +
          `📅 ${activeEvents[0].name}\n` +
          `📍 ${activeEvents[0].location}\n` +
          `🕐 ${formatDateTime(activeEvents[0].datetime)}\n\n` +
          `Для регистрации мне потребуется несколько данных.\n` +
          `Пожалуйста, введите ваши ФИО:`
        );
      } else {
        // Multiple events - show selection
        const keyboard = activeEvents.map(event => [{
          text: `${event.name} - ${formatDateTime(event.datetime)}`,
          callback_data: `select_event_${event.id}`,
        }]);

        return bot.sendMessage(
          chatId,
          "Добро пожаловать! Выберите мероприятие для регистрации:",
          {
            reply_markup: {
              inline_keyboard: keyboard,
            },
          }
        );
      }
    } catch (error) {
      console.error('Telegram bot error:', error);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    }
  });

  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id.toString();
    const telegramId = query.from.id.toString();
    const data = query.data;

    if (!chatId || !data) return;

    try {
      await bot.answerCallbackQuery(query.id);

      if (data.startsWith('select_event_')) {
        const eventId = parseInt(data.replace('select_event_', ''));
        const event = await storage.getEvent(eventId);
        
        if (!event) {
          return bot.sendMessage(chatId, "Мероприятие не найдено.");
        }

        userStates.set(telegramId, {
          step: 'full_name',
          eventId,
          telegramNickname: query.from.username,
        });

        return bot.sendMessage(
          chatId,
          `Вы выбрали: "${event.name}"\n\n` +
          `Пожалуйста, введите ваши ФИО:`
        );
      }

      if (data === 'change_transport') {
        const user = await storage.getUserByTelegramId(telegramId);
        if (!user) return;

        userStates.set(telegramId, {
          step: 'transport_type',
          eventId: user.eventId,
        });

        return bot.sendMessage(
          chatId,
          "Выберите новый тип транспорта:",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛞 Моноколесо", callback_data: "transport_monowheel" }],
                [{ text: "🛴 Самокат", callback_data: "transport_scooter" }],
                [{ text: "👀 Зритель", callback_data: "transport_spectator" }],
              ],
            },
          }
        );
      }

      if (data === 'cancel_participation') {
        const user = await storage.getUserByTelegramId(telegramId);
        if (user) {
          await storage.deactivateUser(user.id);
          return bot.sendMessage(
            chatId,
            "Вы отказались от участия в мероприятии. Ваши данные сохранены, но участие деактивировано."
          );
        }
      }

      if (data.startsWith('transport_')) {
        const transportType = data.replace('transport_', '') as 'monowheel' | 'scooter' | 'spectator';
        const state = userStates.get(telegramId);
        
        if (state?.step === 'transport_type' && state.eventId) {
          // Update existing user
          const user = await storage.getUserByTelegramId(telegramId);
          if (user) {
            await storage.updateUser(user.id, { transportType });
            bot.sendMessage(
              chatId,
              `Тип транспорта изменён на: ${getTransportTypeLabel(transportType)}`
            );
          }
        } else if (state?.eventId && state.fullName && state.phone) {
          // Complete new registration
          const userData: InsertUser = {
            telegramId,
            telegramNickname: state.telegramNickname || null,
            fullName: state.fullName,
            phone: state.phone,
            transportType,
            eventId: state.eventId,
            isActive: true,
          };

          const user = await storage.createUser(userData);
          const event = await storage.getEvent(state.eventId);

          bot.sendMessage(
            chatId,
            `🎉 Поздравляем! Вы успешно зарегистрированы!\n\n` +
            `📋 Ваши данные:\n` +
            `📅 Мероприятие: ${event?.name}\n` +
            `👤 ФИО: ${user.fullName}\n` +
            `📱 Телефон: ${user.phone}\n` +
            `🚗 Транспорт: ${getTransportTypeLabel(user.transportType)}\n` +
            `🏷️ Ваш номер участника: ${user.participantNumber}\n\n` +
            `Вы можете написать мне снова, чтобы изменить тип транспорта или отказаться от участия.`
          );
        }

        userStates.delete(telegramId);
      }
    } catch (error) {
      console.error('Callback query error:', error);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    }
  });

  // Handle text messages
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // Skip commands

    const chatId = msg.chat.id.toString();
    const telegramId = msg.from?.id.toString();
    const text = msg.text;

    if (!telegramId || !text) return;

    const state = userStates.get(telegramId);
    if (!state) return;

    try {
      if (state.step === 'full_name') {
        if (text.length < 2) {
          return bot.sendMessage(chatId, "ФИО должно содержать минимум 2 символа. Попробуйте ещё раз:");
        }

        userStates.set(telegramId, {
          ...state,
          step: 'phone',
          fullName: text,
        });

        return bot.sendMessage(
          chatId,
          "Спасибо! Теперь введите ваш номер телефона в формате:\n+7 (XXX) XXX-XX-XX"
        );
      }

      if (state.step === 'phone') {
        const phoneRegex = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
        if (!phoneRegex.test(text)) {
          return bot.sendMessage(
            chatId,
            "Неверный формат телефона. Используйте формат: +7 (XXX) XXX-XX-XX\nПопробуйте ещё раз:"
          );
        }

        userStates.set(telegramId, {
          ...state,
          step: 'transport_type',
          phone: text,
        });

        return bot.sendMessage(
          chatId,
          "Отлично! Последний шаг - выберите ваш тип транспорта:",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛞 Моноколесо", callback_data: "transport_monowheel" }],
                [{ text: "🛴 Самокат", callback_data: "transport_scooter" }],
                [{ text: "👀 Зритель", callback_data: "transport_spectator" }],
              ],
            },
          }
        );
      }
    } catch (error) {
      console.error('Message handling error:', error);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    }
  });

  console.log(`Telegram bot started with token: ${token.substring(0, 10)}...`);
}

function getTransportTypeLabel(type: string): string {
  switch (type) {
    case 'monowheel': return 'Моноколесо';
    case 'scooter': return 'Самокат';
    case 'spectator': return 'Зритель';
    default: return type;
  }
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
