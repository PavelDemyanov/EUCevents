#!/bin/bash

# Скрипт автоматической настройки локальной базы данных PostgreSQL
# Для системы управления мероприятиями

echo "🚀 Настройка локальной базы данных PostgreSQL..."

# Переменные
DB_NAME="event_management"
DB_USER="event_user"
DB_PASSWORD="event_password"
DUMP_FILE="database_dump.sql"

# Проверка наличия PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL не установлен. Установите PostgreSQL и запустите скрипт заново."
    echo "Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    echo "macOS: brew install postgresql"
    exit 1
fi

# Проверка наличия дампа
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Файл дампа базы данных ($DUMP_FILE) не найден!"
    exit 1
fi

echo "✅ PostgreSQL найден"

# Проверка запуска PostgreSQL
if ! sudo systemctl is-active --quiet postgresql 2>/dev/null && ! brew services list | grep postgresql | grep started >/dev/null 2>&1; then
    echo "🔧 Запуск PostgreSQL..."
    if command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql
    elif command -v brew &> /dev/null; then
        brew services start postgresql
    fi
fi

echo "🔧 Создание базы данных и пользователя..."

# Создание пользователя и базы данных
sudo -u postgres psql <<EOF
-- Удаление существующих объектов если они есть
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Создание нового пользователя и базы данных
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Выход
\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ База данных $DB_NAME и пользователь $DB_USER созданы"
else
    echo "❌ Ошибка при создании базы данных"
    exit 1
fi

echo "📥 Импорт дампа базы данных..."

# Импорт дампа
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -f $DUMP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Дамп базы данных успешно импортирован"
else
    echo "❌ Ошибка при импорте дампа"
    exit 1
fi

echo "🎉 Настройка завершена!"
echo ""
echo "📋 Информация для подключения:"
echo "   База данных: $DB_NAME"
echo "   Пользователь: $DB_USER"
echo "   Пароль: $DB_PASSWORD"
echo "   Хост: localhost"
echo "   Порт: 5432"
echo ""
echo "🔗 Строка подключения для .env:"
echo "   DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "👤 Данные для входа в админ панель:"
echo "   Логин: admin"
echo "   Пароль: admin123"
echo ""
echo "📖 Следующие шаги:"
echo "   1. Скопируйте .env.local.example в .env"
echo "   2. Заполните TELEGRAM_BOT_TOKEN в .env"
echo "   3. Запустите приложение: npm run dev"