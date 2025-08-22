# Локальная установка системы управления мероприятиями

## Требования

- Node.js 18+ 
- PostgreSQL 14+
- Git

## Установка PostgreSQL

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### CentOS/RHEL:
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS:
```bash
brew install postgresql
brew services start postgresql
```

### Windows:
Скачать и установить с официального сайта: https://www.postgresql.org/download/windows/

## Настройка базы данных

1. **Создание пользователя и базы данных:**
```bash
# Вход в PostgreSQL как суперпользователь
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE event_management;
CREATE USER event_user WITH PASSWORD 'event_password';
GRANT ALL PRIVILEGES ON DATABASE event_management TO event_user;
\q
```

2. **Импорт дампа базы данных:**
```bash
# Импорт структуры и данных
psql -U event_user -d event_management -f database_dump.sql
```

## Установка приложения

1. **Клонирование и настройка:**
```bash
# Создать директорию проекта
mkdir ~/event-management
cd ~/event-management

# Клонировать репозиторий и переместить файлы в текущую директорию
git clone https://github.com/PavelDemyanov/EUCevents.git
mv EUCevents/* EUCevents/.* . 2>/dev/null || true
rmdir EUCevents

# Установить зависимости
npm install

# Установка dotenv (если не установлено автоматически)
npm install dotenv
```

2. **Настройка переменных окружения:**
Создайте файл `.env` со следующим содержимым:
```env
# База данных
DATABASE_URL=postgresql://event_user:event_password@localhost:5432/event_management

# Telegram Bot (получить у @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Настройки сессий
SESSION_SECRET=your_session_secret_here

# Порт (по умолчанию 5000)
PORT=5000
```

3. **Получение Telegram Bot Token:**
- Откройте Telegram и найдите @BotFather
- Отправьте команду `/newbot`
- Следуйте инструкциям для создания бота
- Скопируйте полученный токен в `.env`

## Запуск приложения

```bash
# Разработка
npm run dev

# Продакшн
npm run build
npm start
```

## Доступ к приложению

- Веб-интерфейс: http://localhost:5000
- Логин администратора: `admin`
- Пароль администратора: `admin123`

## Настройка Telegram бота

1. Войдите в админ панель
2. Перейдите в "Настройки" → "Боты"
3. Добавьте ваш бот с полученным токеном
4. Настройте чаты для мероприятий

## Полезные команды

```bash
# Просмотр логов PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log

# Перезапуск PostgreSQL
sudo systemctl restart postgresql

# Резервное копирование базы данных
pg_dump -U event_user event_management > backup.sql

# Восстановление из резервной копии
psql -U event_user -d event_management -f backup.sql
```

## Системная служба (Linux)

Создайте файл `/etc/systemd/system/event-management.service`:
```ini
[Unit]
Description=Event Management System
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl enable event-management
sudo systemctl start event-management
```

## Troubleshooting

### Проблема с подключением к базе данных:
- Проверьте, что PostgreSQL запущен: `sudo systemctl status postgresql`
- Проверьте строку подключения в `.env`
- Убедитесь, что пользователь имеет права доступа

### Telegram бот не отвечает:
- Проверьте токен в настройках
- Убедитесь, что бот не используется в другом приложении
- Проверьте логи приложения

### Ошибки при импорте дампа:
- Убедитесь, что база данных пустая
- Проверьте права пользователя PostgreSQL
- Используйте флаг `--clean` для очистки: `psql -U event_user -d event_management -f database_dump.sql --clean`