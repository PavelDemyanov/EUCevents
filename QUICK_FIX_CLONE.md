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
# Удалить все файлы из папки (кроме системных)
rm -rf EUCevents
find . -mindepth 1 -maxdepth 1 -not -name ".*" -exec rm -rf {} \;

# Клонировать во временную папку и переместить файлы
git clone https://github.com/PavelDemyanov/EUCevents.git temp_clone
mv temp_clone/* . 2>/dev/null || true
mv temp_clone/.* . 2>/dev/null || true
rm -rf temp_clone

# Завершить настройку
./complete-setup.sh
```

## Исправление ошибки "require is not defined"

Если видите ошибку `ReferenceError: require is not defined in ES module scope`:

```bash
cd ~/event-management

# Исправить server/db.ts
cat > server/db.ts << 'EOF'
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if we're using Neon (serverless) or regular PostgreSQL
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('pooler.supabase');

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Use Neon serverless configuration
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool, schema });
} else {
  // Use regular PostgreSQL configuration  
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle({ client: pool, schema });
}

export { pool, db };
EOF

echo "✅ server/db.ts исправлен"

# Исправить порт и хост в server/index.ts
sed -i '' 's/host: "0.0.0.0",/host: "127.0.0.1",/' server/index.ts
sed -i '' 's/reusePort: true,/\/\/ reusePort: true,/' server/index.ts
echo "✅ server/index.ts исправлен"
```

## Быстрая установка базы данных

Создайте правильную схему базы данных:

```bash
cd ~/event-management

# Создать скрипт установки базы данных
cat > database_setup_script.sql << 'EOF'
BEGIN;
DROP TABLE IF EXISTS event_chats CASCADE;
DROP TABLE IF EXISTS fixed_number_bindings CASCADE;
DROP TABLE IF EXISTS reserved_numbers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS bots CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username character varying(50) NOT NULL UNIQUE,
    password character varying(255) NOT NULL,
    full_name character varying(100),
    email character varying(100),
    is_active boolean DEFAULT true,
    is_super_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name character varying(255) NOT NULL,
    date character varying(20) NOT NULL,
    time character varying(10) NOT NULL,
    location character varying(255) NOT NULL,
    description text DEFAULT '',
    allowed_transport_types text[] DEFAULT ARRAY['monowheel'::text, 'scooter'::text, 'eboard'::text, 'spectator'::text],
    share_code character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bots (
    id SERIAL PRIMARY KEY,
    token character varying(255) NOT NULL,
    name character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    chat_id bigint NOT NULL UNIQUE,
    chat_type character varying(20) DEFAULT 'private',
    title character varying(255),
    username character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_nickname character varying(255),
    full_name character varying(255) NOT NULL,
    phone_number character varying(20) NOT NULL,
    transport_type character varying(20) NOT NULL,
    transport_model character varying(255),
    participant_number integer,
    event_id integer NOT NULL,
    chat_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) ON DELETE SET NULL
);

CREATE TABLE reserved_numbers (
    id SERIAL PRIMARY KEY,
    number integer NOT NULL,
    event_id integer NOT NULL,
    chat_id bigint,
    reserved_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) ON DELETE SET NULL,
    UNIQUE(number, event_id)
);

CREATE TABLE fixed_number_bindings (
    id SERIAL PRIMARY KEY,
    chat_id bigint NOT NULL,
    number integer NOT NULL,
    event_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE,
    UNIQUE(chat_id, event_id)
);

CREATE TABLE event_chats (
    id SERIAL PRIMARY KEY,
    event_id integer NOT NULL,
    chat_id bigint NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE,
    UNIQUE(event_id, chat_id)
);

INSERT INTO admin_users (username, password, full_name, is_super_admin) 
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Администратор системы', true);

COMMIT;
EOF

# Установить схему базы данных
PGPASSWORD=eventapp123 psql -U eventapp -d event_management -f database_setup_script.sql
echo "✅ База данных настроена"
```

## Исправление проблем с базой данных (старый способ)

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