#!/bin/bash
#
# SuperChat Puppeteer Setup Script for Ubuntu
# This script sets up all required dependencies for running the Puppeteer PDF service on Ubuntu
# Compatible with Ubuntu 22.04+ and older versions
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

# Function to detect Ubuntu version
function detect_ubuntu_version() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    UBUNTU_VERSION=$VERSION_ID
    echo -e "${BLUE}Detected Ubuntu $UBUNTU_VERSION${RESET}"
    return 0
  else
    echo -e "${YELLOW}Could not detect Ubuntu version, assuming latest${RESET}"
    UBUNTU_VERSION="latest"
    return 1
  fi
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

# Detect Ubuntu version to handle package differences
detect_ubuntu_version

# Install Chrome dependencies
show_progress "Installing Chrome dependencies for Ubuntu $UBUNTU_VERSION..."

# Common packages for all Ubuntu versions
COMMON_PACKAGES="ca-certificates fonts-liberation libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils"

# For Ubuntu 22.04+ with t64 suffix
if [[ "$UBUNTU_VERSION" == "22.04" || "$UBUNTU_VERSION" == "23.04" || "$UBUNTU_VERSION" == "23.10" || "$UBUNTU_VERSION" == "24.04" || "$UBUNTU_VERSION" == "latest" ]]; then
  show_progress "Using package names for Ubuntu 22.04+ (with t64 suffix)..."
  
  # Try installing common packages first
  apt-get install -y $COMMON_PACKAGES || echo -e "${YELLOW}Warning: Some common packages could not be installed${RESET}"
  
  # Try to install libasound2 with proper suffix
  apt-get install -y libasound2t64 || {
    echo -e "${YELLOW}Warning: Could not install libasound2t64, trying alternative...${RESET}"
    apt-get install -y liboss4-salsa-asound2 || {
      echo -e "${YELLOW}Warning: Could not install audio libraries, continuing anyway...${RESET}"
    }
  }
  
  # Install t64 packages individually to continue on errors
  apt-get install -y libatk-bridge2.0-0t64 || echo -e "${YELLOW}Warning: Could not install libatk-bridge2.0-0t64${RESET}"
  apt-get install -y libatk1.0-0t64 || echo -e "${YELLOW}Warning: Could not install libatk1.0-0t64${RESET}"
  apt-get install -y libc6 || echo -e "${YELLOW}Warning: Could not install libc6${RESET}"
  apt-get install -y libcairo2 || echo -e "${YELLOW}Warning: Could not install libcairo2${RESET}"
  apt-get install -y libcups2t64 || echo -e "${YELLOW}Warning: Could not install libcups2t64${RESET}"
  apt-get install -y libgcc-s1 || echo -e "${YELLOW}Warning: Could not install libgcc-s1${RESET}"
  apt-get install -y libglib2.0-0t64 || echo -e "${YELLOW}Warning: Could not install libglib2.0-0t64${RESET}"
  apt-get install -y libgtk-3-0t64 || echo -e "${YELLOW}Warning: Could not install libgtk-3-0t64${RESET}"
  
else
  # For older Ubuntu versions (pre-22.04)
  show_progress "Using package names for older Ubuntu versions..."
  
  # Install packages for older Ubuntu
  apt-get install -y $COMMON_PACKAGES || echo -e "${YELLOW}Warning: Some common packages could not be installed${RESET}"
  
  apt-get install -y libappindicator3-1 || echo -e "${YELLOW}Warning: Could not install libappindicator3-1${RESET}"
  apt-get install -y libasound2 || echo -e "${YELLOW}Warning: Could not install libasound2${RESET}"
  apt-get install -y libatk-bridge2.0-0 || echo -e "${YELLOW}Warning: Could not install libatk-bridge2.0-0${RESET}"
  apt-get install -y libatk1.0-0 || echo -e "${YELLOW}Warning: Could not install libatk1.0-0${RESET}"
  apt-get install -y libc6 || echo -e "${YELLOW}Warning: Could not install libc6${RESET}"
  apt-get install -y libcairo2 || echo -e "${YELLOW}Warning: Could not install libcairo2${RESET}"
  apt-get install -y libcups2 || echo -e "${YELLOW}Warning: Could not install libcups2${RESET}"
  apt-get install -y libgcc1 || echo -e "${YELLOW}Warning: Could not install libgcc1${RESET}"
  apt-get install -y libglib2.0-0 || echo -e "${YELLOW}Warning: Could not install libglib2.0-0${RESET}"
  apt-get install -y libgtk-3-0 || echo -e "${YELLOW}Warning: Could not install libgtk-3-0${RESET}"
fi

echo -e "${GREEN}Chrome dependencies installation completed.${RESET}"
echo -e "${YELLOW}Note: Some packages may not have installed correctly depending on your Ubuntu version,${RESET}"
echo -e "${YELLOW}but we'll continue with the setup process.${RESET}"

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
apt-get install -y fonts-farsiweb || echo -e "${YELLOW}Warning: Could not install fonts-farsiweb${RESET}"
apt-get install -y fonts-noto-cjk || echo -e "${YELLOW}Warning: Could not install fonts-noto-cjk${RESET}"

# Try alternative fonts if primary fonts fail
apt-get install -y fonts-noto || echo -e "${YELLOW}Warning: Could not install fonts-noto${RESET}"

# Refresh font cache
show_progress "Updating font cache..."
fc-cache -fv || echo -e "${YELLOW}Warning: Failed to update font cache${RESET}"

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
if [ -n "$SUDO_USER" ]; then
  su -c "$CHROME_BIN --headless=new --disable-gpu --no-sandbox --dump-dom https://www.google.com > /dev/null 2>&1" - $SUDO_USER
  CHROME_TEST_RESULT=$?
else
  $CHROME_BIN --headless=new --disable-gpu --no-sandbox --dump-dom https://www.google.com > /dev/null 2>&1
  CHROME_TEST_RESULT=$?
fi

if [ $CHROME_TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}Chrome headless mode is working correctly.${RESET}"
else
  echo -e "${YELLOW}Warning: Chrome headless test failed. This may affect PDF generation.${RESET}"
  echo -e "${YELLOW}You may need to troubleshoot Chrome using the guidelines in the documentation.${RESET}"
  echo -e "${YELLOW}Continuing with setup despite this warning...${RESET}"
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
const path = require('path');

async function test() {
  console.log('Starting Puppeteer test...');
  
  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
  
  // Add executablePath if CHROME_BIN is set
  if (process.env.CHROME_BIN) {
    options.executablePath = process.env.CHROME_BIN;
    console.log(`Using Chrome binary: ${process.env.CHROME_BIN}`);
  }
  
  const browser = await puppeteer.launch(options);
  
  console.log('Browser launched successfully');
  
  const page = await browser.newPage();
  console.log('Page created successfully');
  
  await page.setContent(`<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>Puppeteer Test</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; }
    .persian { font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; }
  </style>
</head>
<body>
  <h1>Puppeteer Test</h1>
  <p class="persian">Persian: سلام دنیا</p>
</body>
</html>`);
  
  console.log('Content set successfully');
  
  // Try to take a screenshot to test rendering
  const screenshotPath = path.join('/tmp/puppeteer-test', 'test-screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
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
  show_progress "Puppeteer found, running test..."
  # Ensure CHROME_BIN is available in the environment for the test
  CHROME_BIN=$CHROME_BIN node /tmp/puppeteer-test/test.js || {
    echo -e "${YELLOW}Puppeteer test failed but we'll continue with setup.${RESET}"
    echo -e "${YELLOW}See /tmp/puppeteer-test/test.js for test details.${RESET}"
  }
else
  echo -e "${YELLOW}Puppeteer not found globally or in current directory.${RESET}"
  echo -e "${YELLOW}Test script created at /tmp/puppeteer-test/test.js${RESET}"
  echo -e "${YELLOW}You can run it after installing Puppeteer with: node /tmp/puppeteer-test/test.js${RESET}"
fi

# Summary
echo -e "\n${BOLD}${GREEN}Setup Complete!${RESET}"
echo -e "${BOLD}Summary:${RESET}"
echo -e "- ${GREEN}Chrome dependencies installed (with compatibility for Ubuntu $UBUNTU_VERSION)${RESET}"
echo -e "- ${GREEN}Persian fonts installed where available${RESET}"
echo -e "- ${GREEN}CHROME_BIN environment variable set to: $CHROME_BIN${RESET}"
echo -e "- ${GREEN}Node.js performance options configured${RESET}"

if [ $TOTAL_MEM -lt 4096 ] && [ -f /swapfile ]; then
  echo -e "- ${GREEN}2GB swap space created for better performance${RESET}"
fi

echo -e "\n${BOLD}Next Steps:${RESET}"
echo -e "1. ${BLUE}Source your environment variables:${RESET} source ~/.bashrc"
echo -e "2. ${BLUE}Restart your application to apply all changes${RESET}"
echo -e "3. ${BLUE}If you encounter any issues, refer to the troubleshooting guide:${RESET}"
echo -e "   ${BLUE}server/docs/ubuntu-puppeteer-guide.md${RESET}\n"

echo -e "${YELLOW}Note: If you encounter any package issues specific to your Ubuntu version,${RESET}"
echo -e "${YELLOW}you may need to manually install some packages or adapt the commands.${RESET}"
echo -e "${YELLOW}This script is designed to work with both newer (22.04+) and older Ubuntu versions.${RESET}"

echo -e "\n${BOLD}${BLUE}Thank you for using SuperChat!${RESET}"