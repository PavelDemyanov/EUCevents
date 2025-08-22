#!/usr/bin/env node

// Простая проверка конфигурации для локального развертывания
// node check_config.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка локальной конфигурации...\n');

// Проверка безопасности - есть ли конфиденциальные файлы в Git
console.log('🔒 Проверка безопасности...');
const sensitiveFiles = [
    '.env', 
    'database_dump.sql', 
    'backup.sql',
    'config.json'
];

let foundSensitiveFiles = [];
for (const file of sensitiveFiles) {
    if (fs.existsSync(file)) {
        // Проверим, не отслеживается ли файл Git-ом
        try {
            const { execSync } = require('child_process');
            execSync(`git ls-files --error-unmatch ${file}`, {stdio: 'pipe'});
            foundSensitiveFiles.push(file);
        } catch (error) {
            // Файл не отслеживается Git-ом - это хорошо
        }
    }
}

if (foundSensitiveFiles.length > 0) {
    console.log('⚠️  ВНИМАНИЕ: Конфиденциальные файлы в Git:');
    foundSensitiveFiles.forEach(f => console.log(`   - ${f}`));
    console.log('   Удалите их из Git: git rm --cached filename');
} else {
    console.log('✅ Конфиденциальные файлы защищены от Git');
}

// Проверка .env файла
if (!fs.existsSync('.env')) {
    console.log('❌ Файл .env не найден');
    console.log('   Скопируйте .env.local.example в .env');
    process.exit(1);
} else {
    console.log('✅ Файл .env найден');
}

// Чтение .env
const dotenv = require('dotenv');
dotenv.config();

// Проверка переменных окружения
const requiredVars = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'SESSION_SECRET'
];

let missingVars = [];
for (const varName of requiredVars) {
    if (!process.env[varName]) {
        missingVars.push(varName);
    }
}

if (missingVars.length > 0) {
    console.log('❌ Отсутствуют переменные окружения:');
    missingVars.forEach(v => console.log(`   - ${v}`));
    console.log('\n   Добавьте их в файл .env');
    process.exit(1);
} else {
    console.log('✅ Все необходимые переменные окружения установлены');
}

// Проверка подключения к базе данных
console.log('\n🔌 Проверка подключения к базе данных...');

const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL
});

client.connect()
    .then(() => {
        console.log('✅ Подключение к базе данных успешно');
        return client.query('SELECT COUNT(*) FROM admin_users WHERE is_active = true');
    })
    .then((result) => {
        const adminCount = parseInt(result.rows[0].count);
        if (adminCount > 0) {
            console.log(`✅ Найдено ${adminCount} активных администраторов`);
            console.log('   Мастер настройки не запустится');
        } else {
            console.log('⚠️  Активные администраторы не найдены');
            console.log('   Мастер настройки запустится при первом запуске');
        }
    })
    .catch((error) => {
        console.log('❌ Ошибка подключения к базе данных:');
        console.log(`   ${error.message}`);
        console.log('\n   Проверьте:');
        console.log('   - PostgreSQL запущен');
        console.log('   - Правильность строки DATABASE_URL');
        console.log('   - База данных создана и импортирован дамп');
        process.exit(1);
    })
    .finally(() => {
        client.end();
        console.log('\n🎉 Конфигурация проверена! Можете запускать приложение: npm run dev');
    });