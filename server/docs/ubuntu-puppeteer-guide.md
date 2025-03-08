# Ubuntu Server Deployment Guide for SuperChat

This guide provides detailed instructions for deploying SuperChat on Ubuntu Server, including specific configurations to prevent the 502 Bad Gateway errors and segmentation faults that can occur with Puppeteer/Chrome.

## System Requirements

- Ubuntu Server 20.04 LTS or newer
- At least 2GB RAM (4GB recommended)
- At least 10GB free disk space
- Node.js 16+ installed

## 1. Required Dependencies

Install the necessary dependencies for Chrome/Puppeteer:

### For x86_64 Architecture

```bash
# Update package lists
sudo apt update

# Install required dependencies
sudo apt install -y \
    ca-certificates \
    fonts-liberation \
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

# Install Google Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install -y google-chrome-stable
```

### For ARM64 Architecture

```bash
# Install ARM64-specific packages
sudo apt update
sudo apt install -y \
    ca-certificates \
    fonts-liberation \
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
    wget \
    xdg-utils \
    chromium-browser
```

## 2. Memory Configuration

The PDF generation process requires more memory than typical Node.js operations. Set up additional swap space:

```bash
# Create 4GB swap file
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Add to fstab for persistence
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is enabled
free -h
```

## 3. Environment Configuration

Create an environment file with proper settings:

```bash
# Navigate to your SuperChat directory
cd /path/to/superchat

# Create a new environment file
cat > server/.env << 'EOL'
# Server Configuration
PORT=5050
NODE_ENV=production
LOG_LEVEL=INFO

# Memory Management
NODE_OPTIONS=--max-old-space-size=2048

# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
CHROME_BIN=/usr/bin/google-chrome

# For ARM64, use Chromium instead:
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# CHROME_BIN=/usr/bin/chromium-browser

# PDF Service Configuration
# Uncomment to delay PDF service initialization
# DISABLE_PDF_SERVICE_ON_STARTUP=true

# Add your API key here
ANTHROPIC_API_KEY=your_api_key_here
EOL
```

## 4. Nginx Configuration

To prevent 502 Bad Gateway errors, configure Nginx with proper timeouts:

```bash
# Create or edit your Nginx configuration
sudo nano /etc/nginx/sites-available/superchat

# Add the following configuration
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Set longer timeouts for PDF processing
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # Increase buffer sizes
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    
    location / {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/superchat /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## 5. Process Management with PM2

Install and configure PM2 for reliable process management:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Navigate to your SuperChat directory
cd /path/to/superchat

# Start with PM2
pm2 start server/index.js --name superchat --max-memory-restart 2G

# Save the process list
pm2 save

# Configure PM2 to start on boot
pm2 startup
```

## 6. Systemd Service (Alternative to PM2)

As an alternative to PM2, you can use systemd:

```bash
# Create a systemd service file
sudo nano /etc/systemd/system/superchat.service
```

Add the following content:

```ini
[Unit]
Description=SuperChat Application
After=network.target

[Service]
WorkingDirectory=/path/to/superchat
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=superchat
User=your-user  # Replace with your user
Environment=NODE_ENV=production
Environment=PORT=5050
Environment=NODE_OPTIONS=--max-old-space-size=2048

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable superchat
sudo systemctl start superchat
```

## 7. Logs and Monitoring

### Checking Logs

```bash
# PM2 logs
pm2 logs superchat

# Or systemd logs
sudo journalctl -u superchat -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Monitoring

Run diagnostics to check system health:

```bash
# Navigate to your SuperChat directory
cd /path/to/superchat

# Run diagnostics
node server/utils/server-diagnostics.js
```

## 8. Troubleshooting

### Puppeteer Crashes / Segmentation Faults

If you experience segmentation faults (SIGSEGV) or browser crashes:

1. Verify Chrome is installed and can be run:
   ```bash
   google-chrome --version
   # Or for ARM64:
   chromium-browser --version
   ```

2. Test basic headless operation:
   ```bash
   google-chrome --headless --disable-gpu https://example.com
   # Or for ARM64:
   chromium-browser --headless --disable-gpu https://example.com
   ```

3. Try the test script:
   ```bash
   node server/utils/test-puppeteer-arm.js
   ```

### 502 Bad Gateway

If you continue to see 502 Bad Gateway errors:

1. Check if the application is running:
   ```bash
   pm2 status
   # Or
   sudo systemctl status superchat
   ```

2. Verify Nginx can connect to the app:
   ```bash
   sudo nginx -t
   sudo netstat -tuln | grep 5050
   ```

3. Test the application directly without Nginx:
   ```bash
   curl http://localhost:5050/health
   ```

4. Increase log level for more information:
   ```bash
   # Edit .env file
   nano server/.env
   
   # Change log level
   LOG_LEVEL=DEBUG
   
   # Restart the application
   pm2 restart superchat
   ```

## 9. Optimizations

For production environments, consider these optimizations:

1. Configure browser cache cleanup:
   ```bash
   # Add to your crontab
   crontab -e
   
   # Add this line to run daily cleanup
   0 3 * * * find /tmp -name 'puppeteer_*' -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null || true
   ```

2. Set up application monitoring:
   ```bash
   # Install monitoring
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

3. Configure Chrome to use less memory:
   ```bash
   # Edit your .env file to add:
   PUPPETEER_ARGS=--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--single-process
   ```

## 10. Security Considerations

1. Run the application as a non-root user
2. Set up a firewall:
   ```bash
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
   
3. Restrict permissions on environment files:
   ```bash
   chmod 600 server/.env
   ```

4. Use HTTPS with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Testing the Deployment

After setting up, test the application:

1. Check if the server is running:
   ```bash
   curl http://localhost:5050/health
   ```

2. Test PDF generation:
   ```bash
   curl http://localhost:5050/api/export/test -o test.pdf
   ```

3. Open the website in a browser and confirm everything works properly.