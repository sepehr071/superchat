#!/bin/bash
# Script to install wkhtmltopdf on ARM-based Ubuntu server
# Run with: sudo bash install-wkhtmltopdf.sh

echo "Installing wkhtmltopdf for PDF generation on ARM architecture..."

# Update package lists
apt-get update

# Install dependencies
apt-get install -y \
  fontconfig \
  libfontconfig1 \
  libjpeg-turbo8 \
  libxrender1 \
  xfonts-75dpi \
  xfonts-base \
  fonts-liberation \
  fonts-noto \
  fonts-noto-cjk

# For ARM architecture, we need to install the appropriate version
ARCH=$(uname -m)
echo "Detected architecture: $ARCH"

if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  # ARM64 version
  echo "Installing wkhtmltopdf for ARM64..."
  apt-get install -y wkhtmltopdf
elif [[ "$ARCH" == "armv7l" || "$ARCH" == "armhf" ]]; then
  # ARMv7 version
  echo "Installing wkhtmltopdf for ARMv7..."
  apt-get install -y wkhtmltopdf
else
  echo "Unsupported ARM architecture: $ARCH"
  echo "Attempting to install generic version..."
  apt-get install -y wkhtmltopdf
fi

# Verify installation
WKHTMLTOPDF_VERSION=$(wkhtmltopdf --version)
if [ $? -eq 0 ]; then
  echo "wkhtmltopdf installed successfully: $WKHTMLTOPDF_VERSION"
else
  echo "Error: wkhtmltopdf installation failed."
  exit 1
fi

echo "Installation complete! The server is now ready to generate PDFs using wkhtmltopdf."
echo "Please restart your Node.js server to apply the changes."