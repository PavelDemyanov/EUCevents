# Event Management System с Telegram Bot

Система управления мероприятиями с интегрированным Telegram ботом для регистрации участников на русском языке.

## Возможности

- 🎯 **Управление мероприятиями** - создание и управление мероприятиями через веб-интерфейс
- 🤖 **Telegram бот** - автоматическая регистрация участников через бот
- 📱 **Мобильная адаптивность** - полностью адаптивный интерфейс для всех устройств  
- 👥 **Управление участниками** - просмотр, редактирование и управление регистрациями
- 📊 **PDF отчеты** - генерация отчетов участников с группировкой по транспорту
- 🔗 **Публичные ссылки** - возможность поделиться мероприятием без номеров телефонов
- 🔐 **Система администраторов** - управление доступом с ролями и правами
- 📞 **Умная обработка телефонов** - принимает форматы 8/+7/7, хранит как 7XXXXXXXXXX, отображает как +7 (XXX) XXX-XX-XX
- 🚲 **Типы транспорта** - поддержка моноколес, самокатов и зрителей с моделями транспорта

## Требования

- Node.js 18+ 
- PostgreSQL 14+
- npm или yarn

## Установка на локальный сервер

### 1. Клонирование и установка зависимостей

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd event-management-system

# Установите зависимости
npm install
```

### 2. Настройка базы данных

Создайте PostgreSQL базу данных:

```sql
CREATE DATABASE event_management;
CREATE USER event_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE event_management TO event_user;
```

### 3. Переменные окружения

Создайте файл `.env` в корневой папке:

```env
# Обязательные переменные
DATABASE_URL=postgresql://event_user:your_password@localhost:5432/event_management
SESSION_SECRET=your-super-secret-session-key-min-32-chars

# Для PostgreSQL подключения (дублируют DATABASE_URL)
PGHOST=localhost
PGPORT=5432
PGUSER=event_user
PGPASSWORD=your_password
PGDATABASE=event_management

# Опционально - для разработки
NODE_ENV=production
PORT=1414
```

**Важно**: Замените `your_password` и `your-super-secret-session-key-min-32-chars` на реальные значения!

### 4. Инициализация базы данных

```bash
# Применить схему базы данных
npm run db:push
```

### 5. Сборка приложения

```bash
# Соберите frontend
npm run build
```

### 6. Первый запуск

```bash
# Запустите приложение
npm start
```

После первого запуска откройте браузер и перейдите на `http://localhost:1414`.

**Примечание**: В среде разработки Replit порт может быть другим (например, 5000). Система автоматически использует правильный порт. 

**Система автоматически запустит мастер первоначальной настройки**, где вы сможете:
- Создать первого администратора
- Настроить Telegram бота (получите токен у @BotFather)
- Добавить чаты для уведомлений

## Настройка Telegram бота

### 1. Создание бота

1. Найдите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям и получите токен
4. Добавьте токен через мастер настройки или в веб-интерфейсе

### 2. Настройка прав бота

Отправьте @BotFather команды:

```
/setprivacy - Disabled (чтобы бот видел все сообщения)
/setjoingroups - Enable (чтобы бот мог быть добавлен в группы)
/setcommands - Настройте команды бота
```

Рекомендуемые команды для бота:
```
start - Начать регистрацию
help - Помощь по использованию
status - Проверить статус регистрации
```

### 3. Добавление бота в группы

1. Создайте группу/канал для уведомлений
2. Добавьте бота как администратора
3. Получите ID чата (можно через @userinfobot)
4. Добавьте чат в настройках системы

## Структура проекта

```
├── client/          # React фронтенд
├── server/          # Express бэкенд  
├── shared/          # Общие типы и схемы
├── setup/           # Скрипты первоначальной настройки
└── dist/            # Собранные файлы
```

## Команды разработки

```bash
npm run dev          # Запуск в режиме разработки
npm run build        # Сборка для продакшена  
npm start            # Запуск продакшен версии
npm run db:push      # Обновление схемы БД
npm run db:studio    # Веб-интерфейс для БД (опционально)
```

## Производственное развертывание

### С PM2 (рекомендуется)

```bash
# Установите PM2 глобально
npm install -g pm2

# Запустите приложение
pm2 start npm --name "event-management" -- start

# Настройте автозапуск
pm2 startup
pm2 save
```

### С systemd

Создайте файл `/etc/systemd/system/event-management.service`:

```ini
[Unit]
Description=Event Management System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable event-management
sudo systemctl start event-management
```

### Обновление приложения

```bash
# Остановите приложение
pm2 stop event-management

# Обновите код
git pull

# Установите зависимости
npm install

# Обновите БД (если нужно)
npm run db:push

# Соберите проект
npm run build

# Запустите снова
pm2 restart event-management
```

## Резервное копирование

### База данных
```bash
# Создание бэкапа
pg_dump -h localhost -U event_user -d event_management > backup.sql

# Восстановление
psql -h localhost -U event_user -d event_management < backup.sql
```

### Файлы приложения
Регулярно создавайте резервные копии:
- Исходного кода
- Файла `.env` 
- Логов приложения
- Сгенерированных PDF отчетов

## Мониторинг

### Логи
```bash
# PM2 логи
pm2 logs event-management

# Системные логи
journalctl -u event-management -f
```

### Производительность
```bash
# Статистика PM2
pm2 monit

# Использование ресурсов
pm2 info event-management
```

## Безопасность

1. **Регулярно обновляйте зависимости**:
   ```bash
   npm audit
   npm audit fix
   ```

2. **Используйте HTTPS в продакшене** с nginx или Apache

3. **Настройте файрвол**:
   ```bash
   ufw allow 22      # SSH
   ufw allow 80      # HTTP  
   ufw allow 443     # HTTPS
   ufw allow 5000    # Приложение (если нужно)
   ufw enable
   ```

4. **Регулярно меняйте SESSION_SECRET**

## Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Убедитесь, что PostgreSQL запущен
3. Проверьте переменные окружения
4. Убедитесь, что Telegram бот настроен правильно

## Лицензия

MIT License