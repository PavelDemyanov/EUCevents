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

## Что должно быть в результате

После выполнения команды `ls -la` вы должны видеть:
```
drizzle.config.ts
package.json
server/
client/
shared/
.env.example
complete-setup.sh
start.sh
stop.sh
ecosystem.config.js
logs/
```

Если видите эти файлы - можете запускать `./complete-setup.sh`