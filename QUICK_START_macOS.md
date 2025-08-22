# Быстрый старт на macOS

## Что у вас уже есть:
```
~/event-management/
├── complete-setup.sh     ✅ Готов
├── ecosystem.config.js   ✅ Готов
├── start.sh             ✅ Готов
├── stop.sh              ✅ Готов
└── logs/                ✅ Готов
```

## Что нужно добавить:

### 1. Файлы приложения (обязательно):
```
~/event-management/
├── package.json          ❌ Нужен!
├── server/               ❌ Нужен!
├── client/               ❌ Нужен!
├── shared/               ❌ Нужен!
├── database_dump.sql     ⚠️  Желательно
├── .env                  ⚠️  Создастся автоматически
└── node_modules/         ⚠️  Установится автоматически
```

### 2. Варианты размещения файлов:

**Вариант A: Из Git репозитория**
```bash
cd ~/event-management
git clone https://github.com/PavelDemyanov/EUCevents.git temp
mv temp/* .
mv temp/.* . 2>/dev/null || true
rm -rf temp
```

**Вариант B: Из архива**
```bash
cd ~/event-management
# Распакуйте архив в эту папку
unzip /path/to/archive.zip
# или
tar -xzf /path/to/archive.tar.gz
```

**Вариант C: Копирование файлов**
```bash
cd ~/event-management
cp -r /path/to/source/* .
```

### 3. После размещения файлов:
```bash
cd ~/event-management

# Проверить что всё на месте
ls -la
# Должны видеть: package.json, server/, client/, shared/

# Завершить настройку
./complete-setup.sh

# Настроить Telegram бота
nano .env
# Добавить: TELEGRAM_BOT_TOKEN=ваш_токен

# Запустить
./start.sh
```

## Проверка готовности:
```bash
cd ~/event-management

# Эта команда должна показать файлы приложения:
ls -la

# Должно быть примерно так:
# -rw-r--r--  1 user  staff    1234 Jan  1 12:00 package.json
# drwxr-xr-x  5 user  staff     160 Jan  1 12:00 server/
# drwxr-xr-x  3 user  staff      96 Jan  1 12:00 client/
# drwxr-xr-x  2 user  staff      64 Jan  1 12:00 shared/
```

## Если что-то пошло не так:

**Ошибка "package.json not found":**
- Файлы приложения не размещены в ~/event-management
- Нужно скопировать/клонировать файлы приложения

**PostgreSQL не работает:**
```bash
brew services restart postgresql@14
```

**Node.js не найден:**
```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

## Быстрая проверка системы:
```bash
# PostgreSQL
brew services list | grep postgresql

# Node.js
node --version

# PM2
pm2 --version

# База данных
psql -U eventapp -d event_management -c "SELECT 1;"
```