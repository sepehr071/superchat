#!/bin/bash
#
# SuperChat ARM64 Server Configuration Script
# This script fixes common issues with ARM64 servers for SuperChat
#

set -e
echo "============================================="
echo "SuperChat ARM64 Server Configuration Utility"
echo "============================================="
echo ""

# Function to print section headers
print_section() {
  echo ""
  echo "→ $1"
  echo "---------------------------------------------"
}

# Detect if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Check architecture
print_section "Checking system architecture"
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  echo "✓ ARM64 architecture detected: $ARCH"
else
  echo "⚠️ This script is optimized for ARM64 architecture, but detected: $ARCH"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Exiting."
    exit 1
  fi
fi

# Collect system information
print_section "Collecting system information"
OS_INFO=$(cat /etc/os-release)
echo "$OS_INFO" | grep "PRETTY_NAME" | cut -d '"' -f 2
MEMORY_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEMORY_FREE=$(free -m | awk '/^Mem:/{print $4}')
echo "Memory: $MEMORY_FREE MB free / $MEMORY_TOTAL MB total"

# Update package lists
print_section "Updating package lists"
apt-get update

# Install ARM64-specific required packages
print_section "Installing required ARM64 packages"
apt-get install -y \
  ca-certificates \
  fonts-liberation \
  chromium-browser \
  libasound2t64 \
  libatk-bridge2.0-0t64 \
  libatk1.0-0t64 \
  libc6 \
  libcairo2 \
  libcups2t64 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc-s1 \
  libglib2.0-0t64 \
  libgtk-3-0t64 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxtst6 \
  fonts-noto \
  fonts-noto-cjk \
  wget \
  xdg-utils

# Check if Chromium is properly installed
print_section "Verifying Chromium installation"
if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_PATH=$(which chromium-browser)
  echo "✓ Chromium browser is installed at: $CHROMIUM_PATH"
  CHROMIUM_VERSION=$(chromium-browser --version 2>/dev/null || echo "Version check failed")
  echo "  Version: $CHROMIUM_VERSION"
else
  echo "❌ Chromium browser is not installed or not found in PATH"
  echo "Attempting to install Chromium..."
  apt-get install -y chromium-browser
  
  if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_PATH=$(which chromium-browser)
    echo "✓ Chromium browser is now installed at: $CHROMIUM_PATH"
  else
    echo "❌ Failed to install Chromium browser"
    # Try alternate package name on some ARM systems
    echo "Trying alternate package name..."
    apt-get install -y chromium
    if command -v chromium >/dev/null 2>&1; then
      CHROMIUM_PATH=$(which chromium)
      ln -sf "$CHROMIUM_PATH" /usr/bin/chromium-browser
      echo "✓ Chromium found at $CHROMIUM_PATH and linked to /usr/bin/chromium-browser"
    else
      echo "❌ Could not install Chromium. PDF export will not work."
      echo "   Please manually install Chromium and set the path in .env"
    fi
  fi
fi

# Configure swap space
print_section "Configuring swap space for ARM64"
SWAP_SIZE="4G"
echo "Creating $SWAP_SIZE swap file..."

# Remove old swap if it exists
swapoff /swapfile 2>/dev/null || true
rm -f /swapfile

# Create new swap file
fallocate -l "$SWAP_SIZE" /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Add to fstab if not already there
if ! grep -q "/swapfile" /etc/fstab; then
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "✓ Added swap to /etc/fstab"
else
  echo "✓ Swap already configured in /etc/fstab"
fi

# Report swap status
echo "Current swap status:"
swapon --show

# Set up environment variables
print_section "Setting up environment variables"
ENV_FILE="$(pwd)/.env"
ENV_BACKUP="$(pwd)/.env.backup.$(date +%Y%m%d%H%M%S)"

if [ -f "$ENV_FILE" ]; then
  echo "Backing up existing .env to $ENV_BACKUP"
  cp "$ENV_FILE" "$ENV_BACKUP"
fi

# Check if .env.new exists and copy it
if [ -f "$(pwd)/.env.new" ]; then
  echo "Using prepared .env.new file"
  cp "$(pwd)/.env.new" "$ENV_FILE"
else
  # Create new .env file with ARM64 settings
  echo "Creating new .env file with ARM64 settings"
  cat > "$ENV_FILE" << EOL
# Server Configuration
PORT=5050
NODE_ENV=production

# Memory Management - Critical for ARM64 stability
NODE_OPTIONS=--max-old-space-size=2048

# Puppeteer Configuration for ARM64
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH
CHROME_BIN=$CHROMIUM_PATH

# PDF Service Configuration
DISABLE_PDF_SERVICE_ON_STARTUP=true
EOL

  # If API key exists in backup, copy it
  if [ -f "$ENV_BACKUP" ]; then
    API_KEY=$(grep "ANTHROPIC_API_KEY" "$ENV_BACKUP" || echo "")
    if [ ! -z "$API_KEY" ]; then
      echo "$API_KEY" >> "$ENV_FILE"
      echo "✓ API key copied from backup"
    fi
  fi
fi

echo "✓ Environment variables configured"

# Set up systemd service for better process management
print_section "Setting up systemd service"
SERVICE_FILE="/etc/systemd/system/superchat.service"

cat > "$SERVICE_FILE" << EOL
[Unit]
Description=SuperChat AI Application
After=network.target

[Service]
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
Environment=NODE_OPTIONS=--max-old-space-size=2048
Environment=PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
Environment=PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH
Environment=CHROME_BIN=$CHROMIUM_PATH
Environment=DISABLE_PDF_SERVICE_ON_STARTUP=true
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=superchat

[Install]
WantedBy=multi-user.target
EOL

echo "✓ Created systemd service file: $SERVICE_FILE"

# Reload systemd, enable and restart service
systemctl daemon-reload
systemctl enable superchat
echo "✓ SuperChat service enabled to start on boot"

# Configure application directory permissions
print_section "Setting up directory permissions"
mkdir -p "$(pwd)/server/temp"
chmod 755 "$(pwd)/server/temp"
echo "✓ Created and configured temp directory"

# Run diagnostics
print_section "Running server diagnostics"
if [ -f "$(pwd)/server/utils/server-diagnostics.js" ]; then
  DIAGNOSTICS_FILE="$(pwd)/server-diagnostics.json"
  node "$(pwd)/server/utils/server-diagnostics.js" > "$DIAGNOSTICS_FILE"
  echo "✓ Diagnostics written to: $DIAGNOSTICS_FILE"
else
  echo "⚠️ Diagnostics script not found"
fi

# Final instructions
print_section "Setup Complete!"
echo "Your ARM64 server has been configured for SuperChat."
echo ""
echo "To start the service:"
echo "  sudo systemctl start superchat"
echo ""
echo "To check service status:"
echo "  sudo systemctl status superchat"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u superchat -f"
echo ""
echo "If you still experience issues, review the diagnostics file"
echo "or modify the ARM64 configuration in server/config/puppeteer-config.js"