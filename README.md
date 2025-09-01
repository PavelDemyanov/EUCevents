# EUCevents - Система управления мероприятиями с Telegram-ботом

Простая и понятная система для организации мероприятий с автоматической регистрацией участников через Telegram-бота.

## 🚀 Быстрый запуск на macOS ARM

### 1. Установка необходимых программ

Откройте **Терминал** (найти через Spotlight: Cmd+Space, введите "Terminal")

#### Установите Homebrew (менеджер пакетов для macOS):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Установите Node.js 20:
```bash
brew install node@20
```

#### Установите PostgreSQL:
```bash
brew install postgresql@16
brew services start postgresql@16
```

### 2. Настройка базы данных

#### Создайте базу данных:
```bash
createdb eucevents
```

#### Создайте пользователя (замените YOUR_PASSWORD на свой пароль):
```bash
psql postgres -c "CREATE USER eucevents WITH PASSWORD 'YOUR_PASSWORD';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE eucevents TO eucevents;"
```

### 3. Загрузка и настройка проекта

#### Клонируйте проект:
```bash
git clone https://github.com/PavelDemyanov/EUCevents.git
cd EUCevents
```

#### Установите зависимости:
```bash
npm install
```

#### Настройте переменные окружения:
```bash
cp .env.example .env
```

Откройте файл `.env` в любом текстовом редакторе и укажите:
```
DATABASE_URL=postgresql://eucevents:YOUR_PASSWORD@localhost:5432/eucevents
```

### 4. Инициализация базы данных

#### Создайте структуру таблиц:
```bash
npm run db:push
```

#### Создайте администратора (логин: admin, пароль: admin123):
```bash
psql eucevents -c "INSERT INTO admin_users (username, password, is_super_admin) VALUES ('admin', '\$2b\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true);"
```

### 5. Запуск приложения

```bash
npm run dev
```

Приложение будет доступно по адресу: **http://localhost:5000**

## 📱 Настройка Telegram-бота

1. Найдите в Telegram бота [@BotFather](https://t.me/botfather)
2. Отправьте команду `/newbot` и следуйте инструкциям
3. Скопируйте токен бота (выглядит как `123456789:ABCDEF...`)
4. В веб-интерфейсе зайдите в **"Настройки" → "Telegram-боты"**
5. Нажмите **"Добавить бота"** и вставьте токен

## 🎯 Первое использование

1. Откройте http://localhost:5000
2. Войдите с логином **admin** и паролем **admin123**
3. Создайте первое мероприятие
4. Настройте Telegram-бота
5. Добавьте чаты для регистрации участников

## 🛠 Полезные команды

```bash
# Запуск в режиме разработки
npm run dev

# Обновление схемы базы данных
npm run db:push

# Остановка приложения
Ctrl+C в терминале
```

## 🆘 Решение проблем

### База данных не подключается:
- Убедитесь, что PostgreSQL запущен: `brew services start postgresql@16`
- Проверьте правильность пароля в файле `.env`

### Порт 5000 занят:
- Найдите и остановите процесс: `lsof -ti:5000 | xargs kill`

### Telegram-бот не отвечает:
- Проверьте правильность токена
- Убедитесь, что бот запущен в настройках

## 📞 Поддержка

При возникновении проблем создайте issue в GitHub репозитории или обратитесь к разработчику.