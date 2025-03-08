# Ubuntu Puppeteer Compatibility Guide

## Overview

This guide provides instructions for running the Puppeteer PDF service on Ubuntu systems. While the service works out-of-the-box on Windows, Ubuntu requires additional configuration to ensure proper operation.

## Required Dependencies

On Ubuntu, Puppeteer requires several system dependencies to run Chrome headless properly:

```bash
sudo apt-get update
sudo apt-get install -y \
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
    xdg-utils
```

## Font Configuration for Persian

Persian text rendering requires proper font support:

```bash
# Install Persian fonts
sudo apt-get install fonts-farsiweb fonts-noto-cjk

# Refresh font cache
fc-cache -fv
```

## Environment Variable Configuration

Set the `CHROME_BIN` environment variable to your Chrome installation path:

```bash
# Find Chrome path
which google-chrome

# Add to environment variables (add to your .bashrc or .profile)
export CHROME_BIN=$(which google-chrome)
```

## Docker Deployment

For Docker deployments, use this Dockerfile example that includes all dependencies:

```Dockerfile
FROM node:16

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    fonts-liberation fonts-noto-cjk fonts-farsiweb \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 xdg-utils

# Install Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set environment variable for Puppeteer
ENV CHROME_BIN=/usr/bin/google-chrome

# Create app directory and set as working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN npm install

# Expose port
EXPOSE 5050

# Start server
CMD ["node", "index.js"]
```

## Performance Optimization for Ubuntu

1. **Memory Allocation**: Ubuntu systems might need increased swap space:

```bash
# Add 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

2. **Node.js Flags**: Add these to your start command:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node index.js
```

## Troubleshooting

### Common Issues and Solutions

1. **Chrome crashes with "killed" message**
   - Increase available memory or add swap space
   - Use `--disable-dev-shm-usage` flag (already added in our configuration)

2. **Missing shared libraries**
   - Run `ldd $(which google-chrome)` to identify missing dependencies
   - Install the missing packages with `apt-get install`

3. **Font rendering issues**
   - Ensure Persian fonts are installed: `apt-get install fonts-farsiweb`
   - Check font cache is updated: `fc-cache -fv`

4. **"No usable sandbox" error**
   - We already use `--no-sandbox` flag in our configuration
   - For production, consider configuring proper sandboxing

## Comparing Windows vs Ubuntu Performance

- **Windows advantages**: Native Chrome integration, better font support out-of-the-box
- **Ubuntu advantages**: Lower resource usage, better containerization support

Typically, Windows will provide slightly better performance for PDF generation with Puppeteer due to better native integration, but an optimized Ubuntu deployment can achieve similar or better performance with proper configuration.

## Additional Resources

- [Puppeteer Troubleshooting Guide](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md)
- [Running Puppeteer in Docker](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker)