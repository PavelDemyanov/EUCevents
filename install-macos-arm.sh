#!/bin/bash

# Event Management System - macOS ARM Installation Script
# This script installs and configures the Event Management System on macOS with Apple Silicon (ARM)

set -e

echo "=================================================="
echo "Event Management System - macOS ARM Installation"
echo "=================================================="
echo

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS only"
    exit 1
fi

# Check if running on ARM (Apple Silicon)
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo "⚠️  Warning: This script is optimized for Apple Silicon (ARM). Detected architecture: $ARCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Homebrew if not present
if ! command_exists brew; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo "✅ Homebrew already installed"
fi

# Update Homebrew
echo "🔄 Updating Homebrew..."
brew update

# Install required packages
echo "📦 Installing required packages..."

# Install Node.js (LTS version)
if ! command_exists node; then
    brew install node@18
    # Link Node.js 18 as the default
    brew link node@18 --force
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PostgreSQL
if ! command_exists psql; then
    brew install postgresql@14
    # Start PostgreSQL service
    brew services start postgresql@14
    
    # Add PostgreSQL to PATH
    echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zprofile
    export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"
else
    echo "✅ PostgreSQL already installed"
    # Ensure PostgreSQL is running
    brew services start postgresql@14 2>/dev/null || true
fi

# Install Git if not present
if ! command_exists git; then
    brew install git
else
    echo "✅ Git already installed"
fi

# Install PM2 globally for process management
if ! command_exists pm2; then
    echo "📦 Installing PM2 process manager..."
    npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Create application directory
APP_DIR="$HOME/event-management"
echo "📁 Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"

# Setup PostgreSQL database
echo "🗄️  Setting up PostgreSQL database..."

# Wait for PostgreSQL to be ready
sleep 3

# Create database and user
createdb event_management 2>/dev/null || echo "Database event_management already exists"

# Create user with password
psql postgres -c "CREATE USER eventapp WITH PASSWORD 'eventapp123';" 2>/dev/null || echo "User eventapp already exists"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE event_management TO eventapp;" 2>/dev/null || true

# Give user permission to create tables
psql postgres -c "ALTER USER eventapp CREATEDB;" 2>/dev/null || true

echo "✅ Database setup completed"

# Create .env file template
echo "📝 Creating environment configuration..."
cat > "$APP_DIR/.env.example" << EOF
# Database configuration
DATABASE_URL=postgresql://eventapp:eventapp123@localhost:5432/event_management

# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Session secret (generate a random string)
SESSION_SECRET=$(openssl rand -hex 32)

# Application port
PORT=5000

# Environment
NODE_ENV=development
EOF

# Create PM2 ecosystem file
echo "⚙️  Creating PM2 configuration..."
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'event-management',
    script: 'server/index.ts',
    interpreter: 'tsx',
    cwd: '$APP_DIR',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    max_memory_restart: '200M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p "$APP_DIR/logs"

# Clone application files automatically
echo "📥 Cloning EUCevents application..."
if [ -d "$APP_DIR/.git" ] || [ -f "$APP_DIR/package.json" ]; then
    echo "⚠️  Application files already exist, skipping clone"
else
    # Clone into temporary directory and move files
    TEMP_DIR=$(mktemp -d)
    git clone https://github.com/PavelDemyanov/EUCevents.git "$TEMP_DIR"
    
    # Move all files from temp to app directory
    mv "$TEMP_DIR"/* "$APP_DIR/" 2>/dev/null || true
    mv "$TEMP_DIR"/.* "$APP_DIR/" 2>/dev/null || true
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    
    echo "✅ Application files cloned successfully"
    
    # Fix db.ts for local PostgreSQL support
    if [ -f "$APP_DIR/server/db.ts" ]; then
        echo "🔧 Fixing database configuration for local installation..."
        cat > "$APP_DIR/server/db.ts" << 'DB_FIX'
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
DB_FIX
        echo "✅ Database configuration fixed"
    fi
fi

# Create completion script
cat > "$APP_DIR/complete-setup.sh" << 'COMPLETION_SCRIPT'
#!/bin/bash

APP_DIR="$HOME/event-management"
cd "$APP_DIR"

echo "🚀 Completing Event Management System setup..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found."
    echo "📋 Application files missing. Please run the main installation script again."
    exit 1
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install tsx globally if not present
if ! command -v tsx >/dev/null 2>&1; then
    echo "📦 Installing TypeScript executor..."
    npm install -g tsx
fi

# Setup database schema
echo "🗄️  Setting up database schema..."
if [ -f "database_dump_clean.sql" ]; then
    echo "📥 Importing clean database dump..."
    PGPASSWORD=eventapp123 psql -U eventapp -d event_management -f database_dump_clean.sql
    echo "✅ Database schema imported successfully"
elif [ -f "database_dump.sql" ]; then
    echo "📥 Importing database dump..."
    # First, clean existing tables if any
    PGPASSWORD=eventapp123 psql -U eventapp -d event_management -c "
        DROP TABLE IF EXISTS event_chats CASCADE;
        DROP TABLE IF EXISTS fixed_number_bindings CASCADE;
        DROP TABLE IF EXISTS reserved_numbers CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS chats CASCADE;
        DROP TABLE IF EXISTS bots CASCADE;
        DROP TABLE IF EXISTS events CASCADE;
        DROP TABLE IF EXISTS admin_users CASCADE;
    " 2>/dev/null || true
    
    # Import the dump
    PGPASSWORD=eventapp123 psql -U eventapp -d event_management -f database_dump.sql 2>/dev/null || {
        echo "⚠️  Database dump import had issues, trying schema push..."
        npm run db:push 2>/dev/null || echo "Schema setup requires manual configuration"
    }
else
    echo "⚠️  No database dump found, using schema push..."
    npm run db:push 2>/dev/null || echo "Schema push not available, manual database setup required"
fi

# Create .env from local example if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env
        # Update with local PostgreSQL connection
        sed -i '' 's/postgresql:\/\/event_user:event_password@localhost:5432\/event_management/postgresql:\/\/eventapp:eventapp123@localhost:5432\/event_management/' .env
        sed -i '' 's/your_very_long_random_secret_key_here/euc-events-secret-key-'$(date +%s)'/' .env
        echo "📝 Created .env file from local template"
        echo "⚠️  Please edit .env and add your TELEGRAM_BOT_TOKEN"
    else
        cp .env.example .env
        echo "📝 Created .env file from template"
        echo "⚠️  Please edit .env and add your TELEGRAM_BOT_TOKEN"
    fi
fi

echo
echo "=================================================="
echo "✅ Setup completed successfully!"
echo "=================================================="
echo
echo "📂 Application directory: $APP_DIR"
echo "🌐 Application will run on: http://localhost:5000"
echo
echo "🚀 To start the application:"
echo "   cd $APP_DIR"
echo "   npm run dev"
echo
echo "🔧 Or using PM2 (recommended for production):"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo
echo "📝 Next steps:"
echo "1. Edit $APP_DIR/.env and add your Telegram bot token"
echo "2. Start the application with npm run dev or PM2"
echo "3. Visit http://localhost:5000 to access the web interface"
echo
echo "🗄️  Database connection:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: event_management"
echo "   User: eventapp"
echo "   Password: eventapp123"
echo
echo "🔍 Useful commands:"
echo "   - View PostgreSQL status: brew services list | grep postgresql"
echo "   - Restart PostgreSQL: brew services restart postgresql@14"
echo "   - View application logs: tail -f $APP_DIR/logs/combined.log"
echo "   - Stop PM2: pm2 stop event-management"
echo "=================================================="
COMPLETION_SCRIPT

chmod +x "$APP_DIR/complete-setup.sh"

# Create quick start script
cat > "$APP_DIR/start.sh" << 'START_SCRIPT'
#!/bin/bash

APP_DIR="$HOME/event-management"
cd "$APP_DIR"

echo "🚀 Starting Event Management System..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Run ./complete-setup.sh first"
    exit 1
fi

# Start with npm
echo "Starting with npm run dev..."
npm run dev
START_SCRIPT

chmod +x "$APP_DIR/start.sh"

# Create stop script for PM2
cat > "$APP_DIR/stop.sh" << 'STOP_SCRIPT'
#!/bin/bash

echo "🛑 Stopping Event Management System..."
pm2 stop event-management 2>/dev/null || echo "Application not running with PM2"
echo "✅ Stopped"
STOP_SCRIPT

chmod +x "$APP_DIR/stop.sh"

echo
echo "=================================================="
echo "✅ macOS ARM installation completed!"
echo "=================================================="
echo
echo "📂 Application directory created: $APP_DIR"
echo "🗄️  PostgreSQL database ready"
echo "⚙️  PM2 process manager installed"
echo
echo "🎯 Next steps:"
echo "1. Run the completion script: $APP_DIR/complete-setup.sh"
echo "2. Edit the configuration and add your Telegram bot token"
echo "3. Start the application: $APP_DIR/start.sh"
echo
echo "🔧 Useful scripts created:"
echo "   - $APP_DIR/complete-setup.sh (complete installation)"
echo "   - $APP_DIR/start.sh (start application)"
echo "   - $APP_DIR/stop.sh (stop PM2 application)"
echo
echo "🌐 Application will be available at: http://localhost:5000"
echo "=================================================="