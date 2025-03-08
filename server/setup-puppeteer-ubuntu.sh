#!/bin/bash
#
# SuperChat Puppeteer Setup Script for Ubuntu
# This script sets up all required dependencies for running the Puppeteer PDF service on Ubuntu
#

# Text formatting
BOLD="\e[1m"
RED="\e[31m"
GREEN="\e[32m"
YELLOW="\e[33m"
BLUE="\e[34m"
RESET="\e[0m"

# Print header
echo -e "${BOLD}${BLUE}"
echo "============================================================="
echo "  SuperChat Puppeteer Setup for Ubuntu"
echo "  This script will install all dependencies required for"
echo "  running the Puppeteer PDF service with Persian support"
echo "============================================================="
echo -e "${RESET}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}This script requires root privileges to install packages.${RESET}"
  echo -e "${YELLOW}Please run with: sudo ./setup-puppeteer-ubuntu.sh${RESET}"
  exit 1
fi

echo -e "${BOLD}Starting setup...${RESET}"

# Function to display progress
function show_progress() {
  echo -e "${BLUE}==>${RESET} ${BOLD}$1${RESET}"
}

# Function to handle errors
function handle_error() {
  echo -e "${RED}ERROR: $1${RESET}"
  echo "Setup failed. Please check the error message above."
  exit 1
}

# Update package list
show_progress "Updating package list..."
apt-get update || handle_error "Failed to update package list"

# Install Chromium/Chrome dependencies
show_progress "Installing Chrome dependencies..."
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils || handle_error "Failed to install Chrome dependencies"

# Install Chrome browser if not already installed
if ! which google-chrome &>/dev/null; then
  show_progress "Installing Google Chrome..."
  wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - || handle_error "Failed to add Google signing key"
  echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list || handle_error "Failed to add Google repository"
  apt-get update || handle_error "Failed to update package list after adding Google repository"
  apt-get install -y google-chrome-stable || handle_error "Failed to install Google Chrome"
  echo -e "${GREEN}Successfully installed Google Chrome.${RESET}"
else
  echo -e "${GREEN}Google Chrome is already installed.${RESET}"
fi

# Install Persian fonts
show_progress "Installing Persian fonts..."
apt-get install -y fonts-farsiweb fonts-noto-cjk || handle_error "Failed to install Persian fonts"

# Refresh font cache
show_progress "Updating font cache..."
fc-cache -fv || handle_error "Failed to update font cache"

# Set up environment variable
CHROME_BIN=$(which google-chrome)
if [ -z "$CHROME_BIN" ]; then
  handle_error "Could not find Google Chrome binary"
fi

show_progress "Setting up CHROME_BIN environment variable..."
echo "export CHROME_BIN=$CHROME_BIN" > /etc/profile.d/chrome-bin.sh
chmod +x /etc/profile.d/chrome-bin.sh

# Add to .bashrc for current user if not root
if [ -n "$SUDO_USER" ]; then
  USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
  if [ -f "$USER_HOME/.bashrc" ]; then
    if ! grep -q "CHROME_BIN" "$USER_HOME/.bashrc"; then
      echo "# Added by SuperChat Puppeteer setup" >> "$USER_HOME/.bashrc"
      echo "export CHROME_BIN=$CHROME_BIN" >> "$USER_HOME/.bashrc"
      chown $SUDO_USER:$SUDO_USER "$USER_HOME/.bashrc"
      echo -e "${GREEN}Added CHROME_BIN to $USER_HOME/.bashrc${RESET}"
    fi
  fi
fi

# Create swap space if needed
show_progress "Checking system memory..."
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')

if [ $TOTAL_MEM -lt 4096 ] && [ $TOTAL_SWAP -lt 2048 ]; then
  echo "System has less than 4GB RAM and insufficient swap space."
  read -p "Do you want to create a 2GB swap file? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    show_progress "Creating 2GB swap file..."
    if [ -f /swapfile ]; then
      echo "Swap file already exists. Skipping."
    else
      fallocate -l 2G /swapfile || handle_error "Failed to allocate swap file"
      chmod 600 /swapfile || handle_error "Failed to set permissions on swap file"
      mkswap /swapfile || handle_error "Failed to format swap file"
      swapon /swapfile || handle_error "Failed to enable swap file"
      echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab || handle_error "Failed to add swap to fstab"
      echo -e "${GREEN}Successfully created and enabled 2GB swap file.${RESET}"
    fi
  fi
fi

# Verify Chrome can run in headless mode
show_progress "Verifying Chrome headless functionality..."
su -c "$CHROME_BIN --headless --disable-gpu --no-sandbox --dump-dom https://www.google.com > /dev/null 2>&1" - $SUDO_USER
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Chrome headless mode is working correctly.${RESET}"
else
  echo -e "${YELLOW}Warning: Chrome headless test failed. This may affect PDF generation.${RESET}"
  echo -e "${YELLOW}You may need to troubleshoot Chrome using the guidelines in the documentation.${RESET}"
fi

# Set Node.js options for better performance
show_progress "Setting up Node.js performance options..."
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' > /etc/profile.d/node-options.sh
chmod +x /etc/profile.d/node-options.sh

# If not root, add to user's .bashrc
if [ -n "$SUDO_USER" ]; then
  if [ -f "$USER_HOME/.bashrc" ]; then
    if ! grep -q "NODE_OPTIONS" "$USER_HOME/.bashrc"; then
      echo "# Node.js performance options" >> "$USER_HOME/.bashrc"
      echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> "$USER_HOME/.bashrc"
      chown $SUDO_USER:$SUDO_USER "$USER_HOME/.bashrc"
      echo -e "${GREEN}Added NODE_OPTIONS to $USER_HOME/.bashrc${RESET}"
    fi
  fi
fi

# Final verification
show_progress "Performing final verification..."

# Create temporary directory if needed
if [ ! -d "/tmp/puppeteer-test" ]; then
  mkdir -p /tmp/puppeteer-test
fi

# Create simple test script
cat > /tmp/puppeteer-test/test.js << 'EOF'
const puppeteer = require('puppeteer');

async function test() {
  console.log('Starting Puppeteer test...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  console.log('Browser launched successfully');
  
  const page = await browser.newPage();
  console.log('Page created successfully');
  
  await page.setContent('<h1>Puppeteer Test</h1><p>Persian: سلام دنیا</p>');
  console.log('Content set successfully');
  
  await browser.close();
  console.log('Test completed successfully');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
EOF

# Run test if puppeteer is installed
if [ -d "/usr/local/lib/node_modules/puppeteer" ] || [ -d "node_modules/puppeteer" ]; then
  echo "Puppeteer found, running test..."
  node /tmp/puppeteer-test/test.js
else
  echo -e "${YELLOW}Puppeteer not found globally or in current directory.${RESET}"
  echo -e "${YELLOW}Test script created at /tmp/puppeteer-test/test.js${RESET}"
  echo -e "${YELLOW}You can run it after installing Puppeteer with: node /tmp/puppeteer-test/test.js${RESET}"
fi

# Summary
echo -e "\n${BOLD}${GREEN}Setup Complete!${RESET}"
echo -e "${BOLD}Summary:${RESET}"
echo -e "- ${GREEN}Chrome and dependencies installed${RESET}"
echo -e "- ${GREEN}Persian fonts installed and font cache updated${RESET}"
echo -e "- ${GREEN}CHROME_BIN environment variable set to: $CHROME_BIN${RESET}"
echo -e "- ${GREEN}Node.js performance options configured${RESET}"

if [ $TOTAL_MEM -lt 4096 ] && [ -f /swapfile ]; then
  echo -e "- ${GREEN}2GB swap space created for better performance${RESET}"
fi

echo -e "\n${BOLD}Next Steps:${RESET}"
echo -e "1. ${BLUE}Source your environment variables:${RESET} source ~/.bashrc"
echo -e "2. ${BLUE}Restart your application to apply all changes${RESET}"
echo -e "3. ${BLUE}If you encounter any issues, refer to the troubleshooting guide:${RESET}"
echo -e "   ${BLUE}server/docs/ubuntu-puppeteer-guide.md${RESET}"

echo -e "\n${BOLD}${BLUE}Thank you for using SuperChat!${RESET}"