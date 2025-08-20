#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Event Management System...');

try {
  // Build the frontend
  console.log('Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Create production package.json
  const packageJson = {
    "name": "event-management-system",
    "version": "1.0.0",
    "description": "Event Management System with Telegram Bot",
    "main": "server/index.js",
    "scripts": {
      "start": "node server/index.js",
      "db:push": "drizzle-kit push"
    },
    "dependencies": {
      "@neondatabase/serverless": "^0.9.0",
      "bcryptjs": "^2.4.3",
      "drizzle-orm": "^0.29.0",
      "express": "^4.18.0",
      "express-session": "^1.17.0",
      "node-telegram-bot-api": "^0.63.0",
      "pdfkit": "^0.14.0",
      "tsx": "^4.6.0",
      "zod": "^3.22.0",
      "ws": "^8.16.0"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };
  
  fs.writeFileSync('dist/package.json', JSON.stringify(packageJson, null, 2));
  
  // Copy necessary files
  const filesToCopy = [
    'drizzle.config.ts',
    '.env.example'
  ];
  
  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join('dist', file));
    }
  });
  
  // Create .env.example for production
  const envExample = `# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/event_management

# Session Configuration  
SESSION_SECRET=your-super-secret-session-key-at-least-32-characters-long

# PostgreSQL Configuration (optional, mirrors DATABASE_URL)
PGHOST=localhost
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=event_management

# Environment
NODE_ENV=production
PORT=5000
`;

  fs.writeFileSync('dist/.env.example', envExample);
  
  console.log('✓ Build completed successfully!');
  console.log('✓ Production files created in ./dist/');
  console.log('');
  console.log('Next steps:');
  console.log('1. Copy the dist/ folder to your production server');
  console.log('2. Run: cd dist && npm install');
  console.log('3. Create .env file based on .env.example');
  console.log('4. Run: npm run db:push');
  console.log('5. Start the application: npm start');
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}