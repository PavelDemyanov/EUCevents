# Быстрое исправление для клонирования EUCevents

Если вы уже клонировали репозиторий в подпапку, выполните:

## Вариант 1: Переместить файлы из подпапки

```bash
cd ~/event-management

# Переместить все файлы из подпапки EUCevents в текущую директорию
mv EUCevents/* .
mv EUCevents/.* . 2>/dev/null || true
rmdir EUCevents

# Проверить что файлы на месте
ls -la

# Завершить настройку
./complete-setup.sh
```

## Вариант 2: Начать заново с правильным клонированием

```bash
# Удалить подпапку
rm -rf EUCevents

# Клонировать правильно (с точкой в конце)
git clone https://github.com/PavelDemyanov/EUCevents.git .

# Завершить настройку
./complete-setup.sh
```

## Исправление проблем с базой данных

Если у вас были ошибки с базой данных, выполните:

```bash
cd ~/event-management

# Очистить базу данных
PGPASSWORD=eventapp123 psql -U eventapp -d event_management -c "
    DROP TABLE IF EXISTS event_chats CASCADE;
    DROP TABLE IF EXISTS fixed_number_bindings CASCADE;
    DROP TABLE IF EXISTS reserved_numbers CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS chats CASCADE;
    DROP TABLE IF EXISTS bots CASCADE;
    DROP TABLE IF EXISTS events CASCADE;
    DROP TABLE IF EXISTS admin_users CASCADE;
"

# Импортировать чистую версию схемы
PGPASSWORD=eventapp123 psql -U eventapp -d event_management -f database_dump_clean.sql

# Обновить .env файл для локальной базы
cat > .env << 'EOF'
# База данных PostgreSQL
DATABASE_URL=postgresql://eventapp:eventapp123@localhost:5432/event_management

# Telegram Bot Token (получить у @BotFather в Telegram)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Секретный ключ для сессий
SESSION_SECRET=euc-events-secret-key-$(date +%s)

# Порт приложения
PORT=5000

# Режим работы
NODE_ENV=development

# Настройки сессий
SESSION_MAX_AGE=86400000
SESSION_SECURE=false

# Лог уровень
LOG_LEVEL=info
EOF

echo "✅ База данных и конфигурация исправлены!"
echo "📝 Отредактируйте .env и добавьте токен Telegram бота"
echo "🚀 Запустите: npm run dev"
```

## Что должно быть в результате

После выполнения команды `ls -la` вы должны видеть:
```
drizzle.config.ts
package.json
server/
client/
shared/
.env
database_dump_clean.sql
complete-setup.sh
start.sh
stop.sh
ecosystem.config.js
logs/
```

## Проверка работы

```bash
# Запуск приложения
npm run dev

# В другом терминале проверить доступность
curl http://localhost:5000

# Должны увидеть HTML страницу
```

Если видите эти файлы и приложение запускается на порту 5000 - всё работает правильно!