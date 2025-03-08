#!/bin/bash
# Script to install dependencies for Puppeteer on Ubuntu server
# Run with: sudo bash install-puppeteer-deps.sh

echo "Installing Puppeteer dependencies for Ubuntu..."
apt-get update
apt-get install -y \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libatk1.0-0 \
  libgtk-3-0 \
  libgbm-dev

# Install fonts for proper multilingual support
echo "Installing fonts for multilingual support..."
apt-get install -y fonts-liberation fonts-noto fonts-noto-cjk

echo "All dependencies installed successfully!"
echo "Please restart your Node.js server to apply the changes."