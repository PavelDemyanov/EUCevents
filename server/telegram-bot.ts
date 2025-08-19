import TelegramBot from 'node-telegram-bot-api';
import { IStorage } from './storage';
import { InsertUser } from '@shared/schema';

interface UserRegistrationState {
  step: 'event_selection' | 'full_name' | 'phone' | 'transport_type' | 'transport_model' | 'confirm_existing_data';
  eventId?: number;
  fullName?: string;
  phone?: string;
  transportType?: 'monowheel' | 'scooter' | 'spectator';
  telegramNickname?: string;
  existingData?: {
    fullName: string;
    phone: string;
  };
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

    // Only allow registration in private chats
    if (msg.chat.type !== 'private') {
      return bot.sendMessage(
        chatId,
        "Регистрация доступна только в личных сообщениях с ботом. Напишите мне в личку для регистрации на мероприятие!"
      );
    }

    try {
      // Check if user is already registered
      const existingUser = await storage.getUserByTelegramId(telegramId);
      if (existingUser && existingUser.isActive) {
        const event = await storage.getEvent(existingUser.eventId);
        const transportInfo = existingUser.transportModel 
          ? `${getTransportTypeLabel(existingUser.transportType)} (${existingUser.transportModel})`
          : getTransportTypeLabel(existingUser.transportType);

        return bot.sendMessage(
          chatId,
          `Вы уже зарегистрированы на мероприятие "${event?.name}"!\n\n` +
          `📋 Ваши данные:\n` +
          `👤 ФИО: ${existingUser.fullName}\n` +
          `📱 Телефон: ${existingUser.phone}\n` +
          `🚗 Транспорт: ${transportInfo}\n` +
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

      // Get all active events (not limited by chat)
      const activeEvents = await storage.getActiveEvents();
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
        // Auto-select single event, but check for existing data first
        const existingRegistrations = await storage.getUserRegistrationsByTelegramId(telegramId);
        
        if (existingRegistrations.length > 0) {
          // Show existing user data for confirmation
          const lastRegistration = existingRegistrations[existingRegistrations.length - 1];
          
          userStates.set(telegramId, {
            step: 'confirm_existing_data',
            eventId: activeEvents[0].id,
            telegramNickname,
            existingData: {
              fullName: lastRegistration.fullName,
              phone: lastRegistration.phone,
            }
          });

          return bot.sendMessage(
            chatId,
            `Добро пожаловать на регистрацию мероприятия!\n\n` +
            `📅 ${activeEvents[0].name}\n` +
            `📍 ${activeEvents[0].location}\n` +
            `🕐 ${formatDateTime(activeEvents[0].datetime)}\n\n` +
            `📋 Найдены ваши данные из предыдущих регистраций:\n` +
            `👤 ФИО: ${lastRegistration.fullName}\n` +
            `📱 Телефон: ${lastRegistration.phone}\n\n` +
            `Использовать эти данные для регистрации?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Да, использовать", callback_data: "use_existing_data" },
                    { text: "✏️ Изменить данные", callback_data: "change_data" }
                  ]
                ]
              }
            }
          );
        }

        // No existing data - proceed with normal registration
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

    console.log(`Received callback query: ${data} from user ${telegramId}`);

    if (!chatId || !data) return;

    try {
      await bot.answerCallbackQuery(query.id);

      if (data.startsWith('select_event_')) {
        const eventId = parseInt(data.replace('select_event_', ''));
        const event = await storage.getEvent(eventId);
        
        if (!event) {
          return bot.sendMessage(chatId, "Мероприятие не найдено.");
        }

        // Check if user already has existing registrations
        const existingRegistrations = await storage.getUserRegistrationsByTelegramId(telegramId);
        
        if (existingRegistrations.length > 0) {
          // Show existing user data for confirmation
          const lastRegistration = existingRegistrations[existingRegistrations.length - 1];
          
          userStates.set(telegramId, {
            step: 'confirm_existing_data',
            eventId,
            telegramNickname: query.from.username,
            existingData: {
              fullName: lastRegistration.fullName,
              phone: lastRegistration.phone,
            }
          });

          return bot.sendMessage(
            chatId,
            `Вы выбрали: "${event.name}"\n\n` +
            `📋 Найдены ваши данные из предыдущих регистраций:\n` +
            `👤 ФИО: ${lastRegistration.fullName}\n` +
            `📱 Телефон: ${lastRegistration.phone}\n\n` +
            `Использовать эти данные для регистрации?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Да, использовать", callback_data: "use_existing_data" },
                    { text: "✏️ Изменить данные", callback_data: "change_data" }
                  ]
                ]
              }
            }
          );
        }

        // No existing data - proceed with normal registration
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

      if (data === 'use_existing_data') {
        const state = userStates.get(telegramId);
        if (!state || !state.existingData || !state.eventId) {
          return bot.sendMessage(chatId, "Произошла ошибка. Попробуйте начать регистрацию заново.");
        }

        // Use existing data, go straight to transport type selection
        userStates.set(telegramId, {
          ...state,
          step: 'transport_type',
          fullName: state.existingData.fullName,
          phone: state.existingData.phone,
        });

        return bot.sendMessage(
          chatId,
          `Отлично! Используем ваши данные:\n` +
          `👤 ФИО: ${state.existingData.fullName}\n` +
          `📱 Телефон: ${state.existingData.phone}\n\n` +
          `Теперь выберите тип транспорта:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛴 Моноколесо", callback_data: "transport_monowheel" }],
                [{ text: "🛵 Самокат", callback_data: "transport_scooter" }],
                [{ text: "👀 Зритель", callback_data: "transport_spectator" }],
              ],
            },
          }
        );
      }

      if (data === 'change_data') {
        const state = userStates.get(telegramId);
        if (!state || !state.eventId) {
          return bot.sendMessage(chatId, "Произошла ошибка. Попробуйте начать регистрацию заново.");
        }

        // Start fresh registration process
        userStates.set(telegramId, {
          step: 'full_name',
          eventId: state.eventId,
          telegramNickname: state.telegramNickname,
        });

        return bot.sendMessage(
          chatId,
          `Хорошо, введём данные заново.\n\nПожалуйста, введите ваши ФИО:`
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
        
        console.log(`Transport selection: ${transportType}, user state:`, state);
        
        if (!state) {
          console.log(`No state found for user ${telegramId}`);
          return;
        }

        // Check if this is updating an existing user
        const existingUser = await storage.getUserByTelegramId(telegramId);
        if (existingUser && state.step === 'transport_type') {
          // For scooter and monowheel, ask for model before updating
          if (transportType === 'scooter' || transportType === 'monowheel') {
            userStates.set(telegramId, {
              ...state,
              step: 'transport_model',
              transportType,
            });
            
            return bot.sendMessage(
              chatId,
              `Вы выбрали ${getTransportTypeLabel(transportType)}. Теперь укажите модель:`
            );
          } else {
            // For spectator, update immediately
            await storage.updateUser(existingUser.id, { transportType, transportModel: null });
            userStates.delete(telegramId);
            return bot.sendMessage(
              chatId,
              `Тип транспорта изменён на: ${getTransportTypeLabel(transportType)}`
            );
          }
        }

        // For new registration, check if we need model
        if (transportType === 'scooter' || transportType === 'monowheel') {
          userStates.set(telegramId, {
            ...state,
            step: 'transport_model',
            transportType,
          });
          
          return bot.sendMessage(
            chatId,
            `Вы выбрали ${getTransportTypeLabel(transportType)}. Теперь укажите модель:`
          );
        }

        // Complete new registration for spectator
        if (state.eventId && state.fullName && state.phone && state.step === 'transport_type') {
          const userData: InsertUser = {
            telegramId,
            telegramNickname: state.telegramNickname || null,
            fullName: state.fullName,
            phone: state.phone,
            transportType,
            transportModel: null,
            eventId: state.eventId,
            isActive: true,
          };

          const user = await storage.createUser(userData);
          const event = await storage.getEvent(state.eventId);

          userStates.delete(telegramId);
          return bot.sendMessage(
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

      if (state.step === 'transport_model') {
        if (text.length < 2) {
          return bot.sendMessage(chatId, "Название модели должно содержать минимум 2 символа. Попробуйте ещё раз:");
        }

        // Check if this is updating an existing user
        const existingUser = await storage.getUserByTelegramId(telegramId);
        if (existingUser) {
          await storage.updateUser(existingUser.id, { 
            transportType: state.transportType!, 
            transportModel: text 
          });
          userStates.delete(telegramId);
          return bot.sendMessage(
            chatId,
            `Тип транспорта изменён на: ${getTransportTypeLabel(state.transportType!)} (${text})`
          );
        }

        // Complete new registration
        if (state.eventId && state.fullName && state.phone && state.transportType) {
          const userData: InsertUser = {
            telegramId,
            telegramNickname: state.telegramNickname || null,
            fullName: state.fullName,
            phone: state.phone,
            transportType: state.transportType!,
            transportModel: text,
            eventId: state.eventId,
            isActive: true,
          };

          const user = await storage.createUser(userData);
          const event = await storage.getEvent(state.eventId);

          userStates.delete(telegramId);
          return bot.sendMessage(
            chatId,
            `🎉 Поздравляем! Вы успешно зарегистрированы!\n\n` +
            `📋 Ваши данные:\n` +
            `📅 Мероприятие: ${event?.name}\n` +
            `👤 ФИО: ${user.fullName}\n` +
            `📱 Телефон: ${user.phone}\n` +
            `🚗 Транспорт: ${getTransportTypeLabel(user.transportType)} (${user.transportModel})\n` +
            `🏷️ Ваш номер участника: ${user.participantNumber}\n\n` +
            `Вы можете написать мне снова, чтобы изменить тип транспорта или отказаться от участия.`
          );
        }
      }
    } catch (error) {
      console.error('Message handling error:', error);
      bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
    }
  });

  console.log(`Telegram bot started with token: ${token.substring(0, 10)}...`);

  // Export bot instance for external use
  return bot;
}

export async function sendEventNotificationToGroup(
  bot: TelegramBot, 
  chatId: string, 
  eventData: {
    name: string;
    location: string;
    datetime: Date;
    monowheelCount: number;
    scooterCount: number;
    spectatorCount: number;
    totalCount: number;
  }
) {
  const message = `🏁 УВЕДОМЛЕНИЕ О МЕРОПРИЯТИИ 🏁\n\n` +
    `📅 ${eventData.name}\n` +
    `📍 ${eventData.location}\n` +
    `🕐 ${formatDateTime(eventData.datetime)}\n\n` +
    `📊 ТЕКУЩАЯ СТАТИСТИКА УЧАСТНИКОВ:\n` +
    `🛞 Моноколесо: ${eventData.monowheelCount} чел.\n` +
    `🛴 Самокат: ${eventData.scooterCount} чел.\n` +
    `👀 Зрители: ${eventData.spectatorCount} чел.\n` +
    `📋 Всего зарегистрировано: ${eventData.totalCount} чел.\n\n` +
    `🤖 Для регистрации напишите мне в личные сообщения и отправьте команду /start`;

  try {
    await bot.sendMessage(chatId, message);
    console.log(`Event notification sent to group ${chatId}`);
  } catch (error) {
    console.error(`Failed to send notification to group ${chatId}:`, error);
    throw error;
  }
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
