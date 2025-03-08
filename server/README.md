# SuperChat Server - Modular Architecture

This directory contains the server-side code for SuperChat, restructured with a more modular architecture for better maintainability and cross-platform deployment.

## Key Improvements

1. **Modular Structure**: Code is now organized into smaller, focused modules
2. **PDF Export**: Fixed table export functionality to work reliably across platforms
3. **Cross-Platform Support**: Added specific optimizations for Windows, Linux, and ARM64 servers
4. **Lazy Loading**: Components like Puppeteer now load only when needed to improve startup time
5. **Error Recovery**: Added fallback mechanisms for critical operations like PDF generation

## Directory Structure

```
server/
│
├── app.js                 # Express application setup
├── index.js               # Server entry point
├── auth.js                # Authentication module
├── database.js            # Database connection and operations
│
├── config/                # Configuration files
│   └── puppeteer-config.js # Puppeteer settings for different platforms
│
├── routes/                # API route handlers
│   ├── chat-router.js     # Chat operations
│   ├── conversation-router.js # Conversation management
│   ├── export-router.js   # Data export operations
│   └── upload-router.js   # File upload operations
│
├── services/              # Service modules
│   └── pdf-service/       # PDF generation services
│       ├── index.js       # PDF service factory and unified interface
│       ├── puppeteer-pdf-service.js # Puppeteer-based PDF generation
│       ├── enhanced-pdf-service.js  # PDFKit-based PDF generation
│       ├── table-parser.js # HTML table parsing utilities
│       └── font-manager.js # Font handling for PDF generation
│
├── utils/                 # Utility modules
│   ├── file-utils.js      # File operations utilities
│   ├── logger.js          # Centralized logging utility
│   ├── server-diagnostics.js # Server diagnostics utility
│   └── time-utils.js      # Time handling utilities
│
├── deployment/            # Deployment utilities
│   ├── deploy.js          # Deployment script
│   └── templates/         # Deployment templates
│
├── docs/                  # Documentation
│   └── ubuntu-puppeteer-guide.md # Guide for Ubuntu setup
│
└── temp/                  # Temporary file storage
```

## Local Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=5050
   NODE_ENV=development
   LOG_LEVEL=DEBUG
   ANTHROPIC_API_KEY=your_api_key_here
   ```
4. Start the server:
   ```bash
   node index.js
   ```

## Deployment Instructions

### Windows/macOS Deployment

1. Run the deployment script:
   ```bash
   node server/deployment/deploy.js
   ```

2. Start the server:
   ```bash
   node server/index.js
   ```

### Linux (x86_64) Deployment

1. Install required dependencies:
   ```bash
   sudo apt update
   sudo apt install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
   ```

2. Install Google Chrome:
   ```bash
   wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
   sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
   sudo apt update
   sudo apt install -y google-chrome-stable
   ```

3. Run the deployment script:
   ```bash
   node server/deployment/deploy.js
   ```

4. Start the server using PM2:
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name superchat
   pm2 save
   ```

### ARM64 Ubuntu Server Deployment

1. Run the ARM64 setup script:
   ```bash
   chmod +x server/setup-arm64-server.sh
   sudo ./server/setup-arm64-server.sh
   ```

2. Start the server using systemd:
   ```bash
   sudo systemctl start superchat
   ```

## PDF Export Configuration

The PDF export functionality now supports multiple backends:

1. **Puppeteer PDF Service**: Uses Chrome/Chromium for better RTL support
2. **Enhanced PDF Service**: Fallback option using PDFKit

The system automatically selects the best option based on your environment, but you can force a specific service by setting the `PDF_SERVICE` environment variable to either `puppeteer` or `enhanced`.

## Troubleshooting

### Checking Service Health

Use the health check endpoint to verify the service status:
```
GET /api/export/health
```

### Testing PDF Generation

Test PDF generation directly with:
```
GET /api/export/test
```

### Common Issues

1. **502 Bad Gateway**: Check that Nginx is configured with proper timeouts:
   ```nginx
   proxy_connect_timeout 300s;
   proxy_send_timeout 300s;
   proxy_read_timeout 300s;
   ```

2. **Segmentation Fault**: Try using the following environment variables:
   ```
   DISABLE_PDF_SERVICE_ON_STARTUP=true
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

3. **Memory Issues**: Add swap space and increase Node.js memory limit:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile

   # Then set:
   NODE_OPTIONS=--max-old-space-size=2048
   ```

## Server Diagnostics

Use the diagnostics utility to get detailed information about your server:

```bash
node server/utils/server-diagnostics.js
```

This will show information about your system architecture, memory, and software configuration to help diagnose issues.