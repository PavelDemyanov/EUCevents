# EUCevents - Установка на macOS

Быстрая инструкция для установки системы управления мероприятиями EUCevents на macOS.

## Автоматическая установка (всё в одном скрипте)

### 1. Полная установка одной командой
```bash
# Скачать и запустить скрипт установки (автоматически клонирует репозиторий)
curl -O https://raw.githubusercontent.com/PavelDemyanov/EUCevents/main/install-macos-arm.sh
chmod +x install-macos-arm.sh
./install-macos-arm.sh
```

### 2. Завершить настройку
```bash
# Перейти в директорию приложения и завершить установку
cd ~/event-management && ./complete-setup.sh
```

### 3. Настройка Telegram бота
```bash
# Отредактировать конфигурацию
nano .env

# В файле .env добавить токен вашего Telegram бота:
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 4. Запуск приложения
```bash
# Запуск в режиме разработки
./start.sh

# Или запуск через PM2 (рекомендуется)
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Проверка установки

После запуска приложение будет доступно по адресу:
- **Веб-интерфейс**: http://localhost:5000
- **Данные администратора**: admin/admin123

## Управление

### Остановка приложения:
```bash
./stop.sh
# или
pm2 stop event-management
```

### Просмотр логов:
```bash
tail -f logs/combined.log
# или
pm2 logs event-management
```

### Перезапуск:
```bash
pm2 restart event-management
```

## Обновление

```bash
cd ~/event-management
git pull origin main
npm install
pm2 restart event-management
```

## Возможные проблемы

### PostgreSQL не запускается:
```bash
brew services restart postgresql@14
```

### Порт 5000 занят:
```bash
lsof -i :5000
kill -9 <PID>
```

### Проблемы с правами:
```bash
sudo chown -R $(whoami) ~/event-management
```

## Что включает EUCevents

- ✅ Веб-интерфейс для управления мероприятиями
- ✅ Telegram бот для регистрации участников
- ✅ Поддержка различных типов транспорта (моноколесо, самокат, электро-борд, зритель)
- ✅ Генерация PDF отчетов
- ✅ Публичные страницы мероприятий
- ✅ Система администрирования

## Дополнительные ресурсы

- **Репозиторий**: https://github.com/PavelDemyanov/EUCevents
- **Подробная документация**: README-macOS.md
- **Быстрый старт**: QUICK_START_macOS.md