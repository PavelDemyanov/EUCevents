# Event Management System - macOS Installation

Специальное руководство по установке системы управления мероприятиями на macOS с Apple Silicon (ARM).

## Системные требования

- macOS 10.15+ (рекомендуется macOS 12+)
- Apple Silicon (M1/M2/M3) или Intel Mac
- Минимум 4 GB RAM
- 2 GB свободного места на диске

## Автоматическая установка

### Шаг 1: Загрузка и запуск скрипта

```bash
# Скачать скрипт
curl -O https://your-domain.com/install-macos-arm.sh

# Сделать исполняемым
chmod +x install-macos-arm.sh

# Запустить установку
./install-macos-arm.sh
```

### Шаг 2: Размещение файлов приложения

```bash
# Перейти в директорию приложения
cd ~/event-management

# Скопировать файлы приложения или клонировать репозиторий
# git clone <your-repository-url> .

# Завершить настройку
./complete-setup.sh
```

### Шаг 3: Настройка Telegram бота

```bash
# Отредактировать конфигурацию
nano ~/event-management/.env

# Добавить токен бота:
# TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### Шаг 4: Запуск приложения

```bash
# Запуск для разработки
./start.sh

# Или запуск с PM2 (для продакшн)
pm2 start ecosystem.config.js
```

## Что устанавливает скрипт

### 📦 Пакеты и инструменты:
- **Homebrew** - пакетный менеджер для macOS
- **Node.js 18** - среда выполнения JavaScript
- **PostgreSQL 14** - база данных
- **PM2** - менеджер процессов
- **Git** - система контроля версий

### 📁 Структура директорий:
```
~/event-management/
├── .env.example          # Шаблон конфигурации
├── ecosystem.config.js   # Конфигурация PM2
├── complete-setup.sh     # Скрипт завершения установки
├── start.sh             # Скрипт запуска
├── stop.sh              # Скрипт остановки
└── logs/                # Директория для логов
```

### 🗄️ База данных:
- **База**: event_management
- **Пользователь**: eventapp  
- **Пароль**: eventapp123
- **Хост**: localhost
- **Порт**: 5432

## Особенности для Apple Silicon

### Homebrew пути:
- Apple Silicon: `/opt/homebrew/`
- Intel Mac: `/usr/local/homebrew/`

### Node.js установка:
Скрипт автоматически устанавливает Node.js 18 через Homebrew и настраивает пути для ARM архитектуры.

### PostgreSQL настройки:
PostgreSQL устанавливается версии 14 с оптимизацией для ARM процессоров.

## Ручная установка (если нужно)

### 1. Установка Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Установка зависимостей:
```bash
brew install node@18 postgresql@14 git
npm install -g pm2 tsx
```

### 3. Настройка PostgreSQL:
```bash
brew services start postgresql@14
createdb event_management
psql postgres -c "CREATE USER eventapp WITH PASSWORD 'eventapp123';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE event_management TO eventapp;"
```

## Управление сервисами

### PostgreSQL:
```bash
# Статус
brew services list | grep postgresql

# Старт
brew services start postgresql@14

# Стоп
brew services stop postgresql@14

# Перезапуск
brew services restart postgresql@14
```

### Приложение с PM2:
```bash
# Запуск
pm2 start ecosystem.config.js

# Статус
pm2 status

# Логи
pm2 logs event-management

# Перезапуск
pm2 restart event-management

# Остановка
pm2 stop event-management

# Автозапуск при загрузке системы
pm2 save
pm2 startup
```

## Устранение проблем

### Проблема с правами доступа:
```bash
sudo chown -R $(whoami) ~/event-management
```

### PostgreSQL не запускается:
```bash
brew services restart postgresql@14
ps aux | grep postgres
```

### Node.js не найден:
```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

### Проблемы с портами:
```bash
# Проверить какой процесс использует порт 5000
lsof -i :5000

# Убить процесс
kill -9 <PID>
```

## Рекомендации по безопасности

### 1. Изменить пароли базы данных:
```sql
ALTER USER eventapp WITH PASSWORD 'новый_сложный_пароль';
```

### 2. Обновить .env файл:
```bash
# Сгенерировать новый SESSION_SECRET
openssl rand -hex 32
```

### 3. Настроить файрвол:
```bash
# Включить встроенный файрвол macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

## Обновление системы

### Обновление зависимостей:
```bash
brew update && brew upgrade
npm update -g
```

### Обновление приложения:
```bash
cd ~/event-management
git pull  # если используется git
npm install  # обновить зависимости
pm2 restart event-management
```

## Поддержка

При возникновении проблем проверьте:

1. **Логи приложения**: `tail -f ~/event-management/logs/combined.log`
2. **Логи PM2**: `pm2 logs event-management`
3. **Статус PostgreSQL**: `brew services list | grep postgresql`
4. **Доступность порта**: `lsof -i :5000`

### Полная переустановка:
```bash
# Остановить все сервисы
pm2 stop event-management
brew services stop postgresql@14

# Удалить данные
rm -rf ~/event-management
dropdb event_management

# Запустить установку заново
./install-macos-arm.sh
```

---

**Примечание**: Этот скрипт оптимизирован для macOS с Apple Silicon. Для Intel Mac большинство команд будут работать, но пути к Homebrew могут отличаться.