#!/bin/bash

# Event Management System - Installation Script
# This script installs and configures the Event Management System on Ubuntu/Debian

set -e

echo "=================================================="
echo "Event Management System - Installation Script"
echo "=================================================="
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script as root (use sudo)"
    exit 1
fi

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "Installing required packages..."
apt install -y curl git postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Install Node.js 18.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 globally
echo "Installing PM2 process manager..."
npm install -g pm2

# Create application user
echo "Creating application user..."
useradd -m -s /bin/bash eventapp || true

# Create application directory
APP_DIR="/home/eventapp/event-management"
echo "Creating application directory: $APP_DIR"
mkdir -p $APP_DIR
chown eventapp:eventapp $APP_DIR

# Get application files
echo "Please place your application files in: $APP_DIR"
echo "Or clone from repository:"
echo "sudo -u eventapp git clone <repository-url> $APP_DIR"
echo

# Create database and user
echo "Setting up PostgreSQL..."
sudo -u postgres createdb event_management || true
sudo -u postgres createuser eventapp || true
sudo -u postgres psql -c "ALTER USER eventapp WITH PASSWORD 'eventapp123';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE event_management TO eventapp;" || true

# Configure PostgreSQL for local connections
echo "Configuring PostgreSQL..."
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
PG_CONFIG="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Add local connection for eventapp user
if ! grep -q "local.*eventapp" $PG_CONFIG; then
    echo "local   event_management   eventapp                  md5" >> $PG_CONFIG
fi

systemctl restart postgresql

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/event-management.service << EOF
[Unit]
Description=Event Management System
After=network.target postgresql.service

[Service]
Type=simple
User=eventapp
Group=eventapp
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://eventapp:eventapp123@localhost:5432/event_management
Environment=SESSION_SECRET=$(openssl rand -hex 32)
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create nginx configuration
echo "Creating nginx configuration..."
cat > /etc/nginx/sites-available/event-management << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:1414;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/event-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Configure firewall
echo "Configuring firewall..."
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw --force enable

# Create installation completion script
cat > $APP_DIR/complete-setup.sh << 'EOF'
#!/bin/bash

APP_DIR="/home/eventapp/event-management"
cd $APP_DIR

echo "Completing Event Management System setup..."

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Run database migrations
echo "Setting up database..."
npm run db:push

# Build application
echo "Building application..."
npm run build 2>/dev/null || echo "Build command not available, using source directly"

# Enable and start services
echo "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable event-management
sudo systemctl start event-management
sudo systemctl restart nginx

echo
echo "=================================================="
echo "Installation completed successfully!"
echo "=================================================="
echo
echo "Next steps:"
echo "1. Edit /etc/nginx/sites-available/event-management to set your domain name"
echo "2. Restart nginx: sudo systemctl restart nginx"
echo "3. Set up SSL certificate: sudo certbot --nginx -d your-domain.com"
echo "4. Visit http://your-domain.com to complete initial setup"
echo
echo "Service management:"
echo "- Check status: sudo systemctl status event-management"
echo "- View logs: sudo journalctl -u event-management -f"
echo "- Restart: sudo systemctl restart event-management"
echo
echo "Database credentials:"
echo "- User: eventapp"
echo "- Password: eventapp123"
echo "- Database: event_management"
echo
echo "Application directory: $APP_DIR"
echo "=================================================="
EOF

chmod +x $APP_DIR/complete-setup.sh
chown eventapp:eventapp $APP_DIR/complete-setup.sh

echo
echo "=================================================="
echo "System installation completed!"
echo "=================================================="
echo
echo "Next steps:"
echo "1. Place your application files in: $APP_DIR"
echo "2. Run as eventapp user: sudo -u eventapp $APP_DIR/complete-setup.sh"
echo
echo "Or if you have the application files ready:"
echo "1. Copy files to $APP_DIR"
echo "2. Change ownership: chown -R eventapp:eventapp $APP_DIR"
echo "3. Run: sudo -u eventapp $APP_DIR/complete-setup.sh"
echo
echo "Application will be available at: http://your-server-ip"
echo "=================================================="