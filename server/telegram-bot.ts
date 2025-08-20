import TelegramBot from 'node-telegram-bot-api';
import { IStorage } from './storage';
import { InsertUser } from '@shared/schema';

interface UserRegistrationState {
  step: 'event_selection' | 'full_name' | 'phone' | 'transport_type' | 'transport_model' | 'confirm_existing_data' | 
        'edit_full_name' | 'edit_phone' | 'edit_transport_type' | 'edit_transport_model';
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
      // Get all active events and user registrations
      const activeEvents = await storage.getActiveEvents();
      if (activeEvents.length === 0) {
        return bot.sendMessage(
          chatId,
          "В данный момент нет активных мероприятий для регистрации."
        );
      }

      // Check user's registrations for all active events
      const existingRegistrations = await storage.getUserRegistrationsByTelegramId(telegramId);
      const activeRegistrations = existingRegistrations.filter(reg => 
        reg.isActive && activeEvents.some(event => event.id === reg.eventId)
      );

      if (activeRegistrations.length > 0) {
        // User has active registrations, show status and options
        let statusMessage = "📋 Ваши текущие регистрации:\n\n";
        
        for (const registration of activeRegistrations) {
          const event = await storage.getEvent(registration.eventId);
          const transportInfo = registration.transportModel 
            ? `${getTransportTypeLabel(registration.transportType)} (${registration.transportModel})`
            : getTransportTypeLabel(registration.transportType);
          
          statusMessage += `🎯 **${event?.name}**\n` +
            `📍 ${event?.location}\n` +
            `🕐 ${formatDateTime(event?.datetime!)}\n` +
            `🚗 Транспорт: ${transportInfo}\n` +
            `🏷️ Номер: ${registration.participantNumber}\n\n`;
        }

        // Check if there are events user is not registered for
        const unregisteredEvents = activeEvents.filter(event => 
          !activeRegistrations.some(reg => reg.eventId === event.id)
        );

        if (unregisteredEvents.length > 0) {
          statusMessage += "📝 Доступны для регистрации:\n";
          unregisteredEvents.forEach(event => {
            statusMessage += `• ${event.name} (${formatDateTime(event.datetime)})\n`;
          });
          statusMessage += "\n";
        }

        const keyboard: any[] = [];
        
        // Add buttons for events user can register for
        unregisteredEvents.forEach(event => {
          keyboard.push([{
            text: `➕ Регистрация на "${event.name}"`,
            callback_data: `select_event_${event.id}`
          }]);
        });

        // Add management buttons for existing registrations
        activeRegistrations.forEach(registration => {
          const event = activeEvents.find(e => e.id === registration.eventId);
          keyboard.push([{
            text: `⚙️ Управление "${event?.name}"`,
            callback_data: `manage_event_${registration.eventId}`
          }]);
        });

        return bot.sendMessage(chatId, statusMessage, {
          reply_markup: { inline_keyboard: keyboard },
          parse_mode: 'Markdown'
        });
      }

      // If no active registrations, show event selection
      
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
              transportType: lastRegistration.transportType,
              transportModel: lastRegistration.transportModel,
            }
          });

          let transportInfo = '';
          if (lastRegistration.transportType && lastRegistration.transportType !== 'spectator') {
            transportInfo = `🚗 Транспорт: ${getTransportTypeLabel(lastRegistration.transportType)}${lastRegistration.transportModel ? ` (${lastRegistration.transportModel})` : ''}\n`;
          }

          return bot.sendMessage(
            chatId,
            `Добро пожаловать на регистрацию мероприятия!\n\n` +
            `📅 ${activeEvents[0].name}\n` +
            `📍 ${activeEvents[0].location}\n` +
            `🕐 ${formatDateTime(activeEvents[0].datetime)}\n\n` +
            `📋 Найдены ваши данные из предыдущих регистраций:\n` +
            `👤 ФИО: ${lastRegistration.fullName}\n` +
            `📱 Телефон: ${formatPhoneNumber(lastRegistration.phone)}\n` +
            transportInfo + 
            `\nИспользовать эти данные для регистрации?`,
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
              transportType: lastRegistration.transportType,
              transportModel: lastRegistration.transportModel,
            }
          });

          let transportInfo = '';
          if (lastRegistration.transportType && lastRegistration.transportType !== 'spectator') {
            transportInfo = `🚗 Транспорт: ${getTransportTypeLabel(lastRegistration.transportType)}${lastRegistration.transportModel ? ` (${lastRegistration.transportModel})` : ''}\n`;
          }

          return bot.sendMessage(
            chatId,
            `Вы выбрали: "${event.name}"\n\n` +
            `📋 Найдены ваши данные из предыдущих регистраций:\n` +
            `👤 ФИО: ${lastRegistration.fullName}\n` +
            `📱 Телефон: ${formatPhoneNumber(lastRegistration.phone)}\n` +
            transportInfo + 
            `\nИспользовать эти данные для регистрации?`,
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

        try {
          // Check if user is already registered for this event (active or inactive)
          const existingRegistration = await storage.getUserRegistration(telegramId, state.eventId);
          if (existingRegistration) {
            if (existingRegistration.isActive) {
              userStates.delete(telegramId);
              return bot.sendMessage(
                chatId,
                `⚠️ Вы уже зарегистрированы на это мероприятие!\n\n` +
                `📋 Ваши данные:\n` +
                `👤 ФИО: ${existingRegistration.fullName}\n` +
                `📱 Телефон: ${formatPhoneNumber(existingRegistration.phone)}\n` +
                `🚗 Транспорт: ${getTransportTypeLabel(existingRegistration.transportType)}${existingRegistration.transportModel ? ` (${existingRegistration.transportModel})` : ''}\n` +
                `🏷️ Номер участника: ${existingRegistration.participantNumber}\n\n` +
                `Если хотите изменить данные, напишите мне снова.`
              );
            } else {
              // Reactivate existing registration instead of creating new one
              const updatedUser = await storage.updateUser(existingRegistration.id, {
                fullName: state.existingData.fullName,
                phone: state.existingData.phone,
                transportType: state.existingData.transportType,
                transportModel: state.existingData.transportModel || null,
                isActive: true,
                telegramNickname: state.telegramNickname
              });

              const event = await storage.getEvent(state.eventId);
              userStates.delete(telegramId);
              return bot.sendMessage(
                chatId,
                `🎉 Поздравляем! Вы успешно зарегистрированы!\n\n` +
                `📋 Ваши данные:\n` +
                `📅 Мероприятие: ${event?.name}\n` +
                `👤 ФИО: ${updatedUser.fullName}\n` +
                `📱 Телефон: ${formatPhoneNumber(updatedUser.phone)}\n` +
                `🚗 Транспорт: ${getTransportTypeLabel(updatedUser.transportType)}${updatedUser.transportModel ? ` (${updatedUser.transportModel})` : ''}\n` +
                `🏷️ Ваш номер участника: ${updatedUser.participantNumber}\n\n` +
                `Вы можете написать мне снова, чтобы изменить тип транспорта или отказаться от участия.`
              );
            }
          }
        } catch (error) {
          console.error('Error checking existing registration:', error);
          // Continue with registration if check fails
        }

        // Check if we have transport data from previous registration
        if (state.existingData.transportType && state.existingData.transportType !== 'spectator') {
          // Complete registration with existing data including transport
          const userData = {
            telegramId,
            telegramNickname: state.telegramNickname,
            fullName: state.existingData.fullName,
            phone: state.existingData.phone,
            transportType: state.existingData.transportType,
            transportModel: state.existingData.transportModel || null,
            eventId: state.eventId,
          };

          try {
            const user = await storage.createUser(userData);
            const event = await storage.getEvent(state.eventId);

            userStates.delete(telegramId);
            return bot.sendMessage(
              chatId,
              `🎉 Поздравляем! Вы успешно зарегистрированы!\n\n` +
              `📋 Ваши данные:\n` +
              `📅 Мероприятие: ${event?.name}\n` +
              `👤 ФИО: ${user.fullName}\n` +
              `📱 Телефон: ${formatPhoneNumber(user.phone)}\n` +
              `🚗 Транспорт: ${getTransportTypeLabel(user.transportType)}${user.transportModel ? ` (${user.transportModel})` : ''}\n` +
              `🏷️ Ваш номер участника: ${user.participantNumber}\n\n` +
              `Вы можете написать мне снова, чтобы изменить тип транспорта или отказаться от участия.`
            );
          } catch (error: any) {
            if (error.code === '23505') {
              userStates.delete(telegramId);
              return bot.sendMessage(
                chatId,
                `⚠️ Вы уже зарегистрированы на это мероприятие!\n\n` +
                `Если хотите изменить данные, напишите мне снова.`
              );
            } else {
              console.error('Error creating user:', error);
              userStates.delete(telegramId);
              return bot.sendMessage(chatId, "Произошла ошибка при регистрации. Попробуйте позже.");
            }
          }
        }

        // Use existing data, go straight to transport type selection (for spectators or missing transport data)
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

        return bot.sendMessage(
          chatId,
          "Что вы хотите изменить?",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "👤 ФИО", callback_data: "change_fullname" },
                  { text: "📱 Телефон", callback_data: "change_phone" }
                ],
                [
                  { text: "⚙️ Изменить транспорт/стать зрителем", callback_data: "change_transport_direct" },
                  { text: "🏷️ Модель", callback_data: "change_model" }
                ],
                [
                  { text: "🔄 Всё заново", callback_data: "change_all" }
                ]
              ]
            }
          }
        );
      }

      if (data === 'change_fullname') {
        const state = userStates.get(telegramId);
        if (state) {
          userStates.set(telegramId, {
            ...state,
            step: 'full_name',
          });
          return bot.sendMessage(chatId, "Введите новые ФИО:");
        }
      }

      if (data === 'change_phone') {
        const state = userStates.get(telegramId);
        if (state) {
          userStates.set(telegramId, {
            ...state,
            step: 'phone',
            fullName: state.existingData?.fullName || '',
          });
          return bot.sendMessage(chatId, "Введите новый номер телефона в формате +7 (XXX) XXX-XX-XX:");
        }
      }

      if (data === 'change_transport_direct') {
        const state = userStates.get(telegramId);
        if (state) {
          userStates.set(telegramId, {
            ...state,
            step: 'transport_type',
            fullName: state.existingData?.fullName || '',
            phone: state.existingData?.phone || '',
          });
          return bot.sendMessage(
            chatId,
            "Выберите тип транспорта:",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🛴 Моноколесо", callback_data: "transport_monowheel" },
                    { text: "🛵 Самокат", callback_data: "transport_scooter" }
                  ],
                  [
                    { text: "👁️ Зритель", callback_data: "transport_spectator" }
                  ]
                ]
              }
            }
          );
        }
      }

      if (data === 'change_model') {
        const state = userStates.get(telegramId);
        if (state && state.existingData) {
          userStates.set(telegramId, {
            ...state,
            step: 'transport_model',
            fullName: state.existingData.fullName,
            phone: state.existingData.phone,
            transportType: state.existingData.transportType || 'monowheel',
          });
          return bot.sendMessage(chatId, "Введите модель транспорта (или пропустите, написав '-'):");
        }
      }

      if (data === 'change_all') {
        const state = userStates.get(telegramId);
        if (state) {
          userStates.set(telegramId, {
            step: 'full_name',
            eventId: state.eventId,
            telegramNickname: state.telegramNickname,
          });
          return bot.sendMessage(chatId, "Начинаем регистрацию заново. Введите ваши ФИО:");
        }
      }

      if (data.startsWith('manage_event_')) {
        const eventId = parseInt(data.replace('manage_event_', ''));
        const event = await storage.getEvent(eventId);
        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const userRegistration = existingUsers.find(u => u.eventId === eventId && u.isActive);
        
        if (!event || !userRegistration) {
          return bot.sendMessage(chatId, "Мероприятие или регистрация не найдены.");
        }

        const transportInfo = userRegistration.transportModel 
          ? `${getTransportTypeLabel(userRegistration.transportType)} (${userRegistration.transportModel})`
          : getTransportTypeLabel(userRegistration.transportType);

        return bot.sendMessage(
          chatId,
          `🎯 Управление регистрацией на "${event.name}"\n\n` +
          `📋 Текущие данные:\n` +
          `👤 ФИО: ${userRegistration.fullName}\n` +
          `📱 Телефон: ${userRegistration.phone}\n` +
          `🚗 Транспорт: ${transportInfo}\n` +
          `🏷️ Номер участника: ${userRegistration.participantNumber}\n\n` +
          `Что хотите изменить?`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "👤 Изменить ФИО", callback_data: `edit_name_${eventId}` }],
                [{ text: "📱 Изменить телефон", callback_data: `edit_phone_${eventId}` }],
                [{ text: "⚙️ Изменить транспорт/стать зрителем", callback_data: `edit_transport_${eventId}` }],
                [{ text: "❌ Отказаться от участия", callback_data: `cancel_event_${eventId}` }],
                [{ text: "🔙 Назад", callback_data: "back_to_main" }]
              ]
            }
          }
        );
      }

      if (data.startsWith('edit_name_')) {
        const eventId = parseInt(data.replace('edit_name_', ''));
        userStates.set(telegramId, {
          step: 'edit_full_name',
          eventId,
          telegramNickname: query.from?.username || undefined,
        });
        
        return bot.sendMessage(chatId, "Введите новые ФИО:");
      }

      if (data.startsWith('edit_phone_')) {
        const eventId = parseInt(data.replace('edit_phone_', ''));
        userStates.set(telegramId, {
          step: 'edit_phone',
          eventId,
          telegramNickname: query.from?.username || undefined,
        });
        
        return bot.sendMessage(chatId, "Введите новый номер телефона в формате +7 (XXX) XXX-XX-XX:");
      }

      if (data.startsWith('edit_transport_')) {
        const eventId = parseInt(data.replace('edit_transport_', ''));
        userStates.set(telegramId, {
          step: 'edit_transport_type',
          eventId,
          telegramNickname: query.from?.username || undefined,
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

      if (data.startsWith('cancel_event_')) {
        const eventId = parseInt(data.replace('cancel_event_', ''));
        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const userRegistration = existingUsers.find(u => u.eventId === eventId && u.isActive);
        
        if (userRegistration) {
          await storage.deactivateUser(userRegistration.id);
          const event = await storage.getEvent(eventId);
          return bot.sendMessage(
            chatId,
            `Вы отказались от участия в мероприятии "${event?.name}". Ваши данные сохранены, но участие деактивировано.`
          );
        }
      }

      if (data === 'back_to_main') {
        // Restart the /start command logic
        return bot.sendMessage(chatId, "Используйте команду /start для возврата в главное меню.");
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

        // Check if this is editing existing user data
        if (state.step === 'edit_transport_type') {
          const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
          const existingUserForEvent = existingUsers.find(u => u.eventId === state.eventId && u.isActive);
          
          if (existingUserForEvent) {
            // For scooter and monowheel, ask for model before updating
            if (transportType === 'scooter' || transportType === 'monowheel') {
              userStates.set(telegramId, {
                ...state,
                step: 'edit_transport_model',
                transportType,
              });
              
              return bot.sendMessage(
                chatId,
                `Вы выбрали ${getTransportTypeLabel(transportType)}. Теперь укажите модель:`
              );
            } else {
              // For spectator, update immediately
              await storage.updateUser(existingUserForEvent.id, { transportType, transportModel: null });
              userStates.delete(telegramId);
              return bot.sendMessage(
                chatId,
                `Тип транспорта изменён на: ${getTransportTypeLabel(transportType)}`
              );
            }
          }
        }

        // Check if this is updating an existing user (legacy logic) - for all users
        if (state.step === 'transport_type') {
          const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
          const existingUserForEvent = existingUsers.find(u => u.eventId === state.eventId);
          
          if (existingUserForEvent && existingUserForEvent.isActive) {
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
              await storage.updateUser(existingUserForEvent.id, { transportType, transportModel: null });
              userStates.delete(telegramId);
              return bot.sendMessage(
                chatId,
                `Тип транспорта изменён на: ${getTransportTypeLabel(transportType)}`
              );
            }
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
          // Check if user is already registered for this event (active OR inactive)
          const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
          const existingUserForEvent = existingUsers.find(u => u.eventId === state.eventId);
          
          if (existingUserForEvent) {
            // Update existing registration and reactivate
            await storage.updateUser(existingUserForEvent.id, { 
              transportType,
              transportModel: null,
              fullName: state.fullName,
              phone: state.phone,
              isActive: true
            });
            userStates.delete(telegramId);
            return bot.sendMessage(
              chatId,
              `🎉 Регистрация успешна!\n\n` +
              `📋 Ваши данные обновлены:\n` +
              `👤 ФИО: ${state.fullName}\n` +
              `📱 Телефон: ${state.phone}\n` +
              `👀 Статус: Зритель\n` +
              `🏷️ Номер участника: ${existingUserForEvent.participantNumber}`
            );
          }

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
            `📱 Телефон: ${formatPhoneNumber(user.phone)}\n` +
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
          "Спасибо! Теперь введите ваш номер телефона:\nМожно в любом формате: 8XXXXXXXXXX, +7XXXXXXXXXX или 7XXXXXXXXXX"
        );
      }

      if (state.step === 'phone') {
        const normalizedPhone = normalizePhoneNumber(text);
        if (!normalizedPhone) {
          return bot.sendMessage(
            chatId,
            "Неверный формат телефона. Введите российский номер:\n8XXXXXXXXXX, +7XXXXXXXXXX или 7XXXXXXXXXX\nПопробуйте ещё раз:"
          );
        }

        userStates.set(telegramId, {
          ...state,
          step: 'transport_type',
          phone: normalizedPhone,
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

        // Check if this is updating an existing user for the current event
        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const existingUserForEvent = existingUsers.find(u => u.eventId === state.eventId);
        
        if (existingUserForEvent && existingUserForEvent.isActive) {
          await storage.updateUser(existingUserForEvent.id, { 
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
          // Check if user is already registered for this event (active OR inactive)
          const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
          const existingUserForEvent = existingUsers.find(u => u.eventId === state.eventId);
          
          if (existingUserForEvent) {
            // Update existing registration and reactivate
            await storage.updateUser(existingUserForEvent.id, { 
              transportType: state.transportType!,
              transportModel: text,
              fullName: state.fullName,
              phone: state.phone,
              isActive: true
            });
            userStates.delete(telegramId);
            return bot.sendMessage(
              chatId,
              `🎉 Регистрация успешна!\n\n` +
              `📋 Ваши данные обновлены:\n` +
              `👤 ФИО: ${state.fullName}\n` +
              `📱 Телефон: ${formatPhoneNumber(state.phone)}\n` +
              `🚗 Транспорт: ${getTransportTypeLabel(state.transportType!)} (${text})\n` +
              `🏷️ Номер участника: ${existingUserForEvent.participantNumber}`
            );
          }

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
            `📱 Телефон: ${formatPhoneNumber(user.phone)}\n` +
            `🚗 Транспорт: ${getTransportTypeLabel(user.transportType)} (${user.transportModel})\n` +
            `🏷️ Ваш номер участника: ${user.participantNumber}\n\n` +
            `Вы можете написать мне снова, чтобы изменить тип транспорта или отказаться от участия.`
          );
        }
      }

      // Handle editing existing data
      if (state.step === 'edit_full_name') {
        if (text.length < 2) {
          return bot.sendMessage(chatId, "ФИО должно содержать минимум 2 символа. Попробуйте ещё раз:");
        }

        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const userRegistration = existingUsers.find(u => u.eventId === state.eventId && u.isActive);
        
        if (userRegistration) {
          await storage.updateUser(userRegistration.id, { fullName: text });
          userStates.delete(telegramId);
          return bot.sendMessage(chatId, `ФИО успешно изменены на: ${text}`);
        }
      }

      if (state.step === 'edit_phone') {
        const normalizedPhone = normalizePhoneNumber(text);
        if (!normalizedPhone) {
          return bot.sendMessage(
            chatId,
            "Неверный формат телефона. Введите российский номер:\n8XXXXXXXXXX, +7XXXXXXXXXX или 7XXXXXXXXXX\nПопробуйте ещё раз:"
          );
        }

        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const userRegistration = existingUsers.find(u => u.eventId === state.eventId && u.isActive);
        
        if (userRegistration) {
          await storage.updateUser(userRegistration.id, { phone: normalizedPhone });
          userStates.delete(telegramId);
          return bot.sendMessage(chatId, `Телефон успешно изменён на: ${formatPhoneNumber(normalizedPhone)}`);
        }
      }

      if (state.step === 'edit_transport_model') {
        if (text.length < 2) {
          return bot.sendMessage(chatId, "Название модели должно содержать минимум 2 символа. Попробуйте ещё раз:");
        }

        const existingUsers = await storage.getUserRegistrationsByTelegramId(telegramId);
        const userRegistration = existingUsers.find(u => u.eventId === state.eventId && u.isActive);
        
        if (userRegistration && state.transportType) {
          await storage.updateUser(userRegistration.id, { 
            transportType: state.transportType, 
            transportModel: text 
          });
          userStates.delete(telegramId);
          return bot.sendMessage(
            chatId,
            `Транспорт успешно изменён на: ${getTransportTypeLabel(state.transportType)} (${text})`
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

// Normalize phone number to format 7XXXXXXXXXX
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid Russian number
  if (digits.length === 11) {
    if (digits.startsWith('8')) {
      // 8XXXXXXXXXX -> 7XXXXXXXXXX
      return '7' + digits.substring(1);
    } else if (digits.startsWith('7')) {
      // 7XXXXXXXXXX -> 7XXXXXXXXXX
      return digits;
    }
  } else if (digits.length === 10) {
    // XXXXXXXXXX -> 7XXXXXXXXXX (assume it's without country code)
    return '7' + digits;
  }
  
  return null;
}

// Format phone number for display: 7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
function formatPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // If already formatted, return as is
  if (phone.includes('(') && phone.includes(')')) {
    return phone;
  }
  
  // Normalize first
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;
  
  // Format: 7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
  const match = normalized.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (match) {
    return `+7 (${match[1]}) ${match[2]}-${match[3]}-${match[4]}`;
  }
  
  return phone;
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
