# Ubuntu Puppeteer Compatibility Guide

## Overview 

This guide provides instructions for running the Puppeteer PDF service on Ubuntu systems across different architectures. While the service works out-of-the-box on Windows, Ubuntu requires additional configuration to ensure proper operation.

## Automated Setup (Recommended)

The easiest way to set up your Ubuntu environment is to use our automated setup script:

```bash
sudo chmod +x server/setup-puppeteer-ubuntu.sh
sudo ./server/setup-puppeteer-ubuntu.sh
```

This script automatically:
- Detects your Ubuntu version and architecture (AMD64 or ARM)
- Installs the appropriate packages for your system
- Sets up environment variables
- Configures Persian font support
- Verifies the installation

After running the script, source your environment variables:
```bash
source ~/.bashrc
```

## Architecture-Specific Considerations

### AMD64 (x86_64) Architecture

On AMD64 systems (standard Intel/AMD processors), the setup uses Google Chrome by default and generally has the best compatibility.

### ARM64 Architecture

On ARM systems (like Raspberry Pi, some cloud VMs, Apple M1/M2), the setup uses Chromium instead of Chrome. ARM systems have some specific considerations:

- Always set the `PUPPETEER_EXECUTABLE_PATH` environment variable to point to your Chromium binary
- Some advanced Chrome features may have limited support on ARM
- Performance may be slower than on equivalent AMD64 systems
- Ensure ARM-specific graphics libraries are installed

## Manual Installation Instructions

### AMD64 Architecture Dependencies

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

### ARM Architecture Dependencies

For ARM systems, use these packages:

```bash
sudo apt-get update
sudo apt-get install -y \
    chromium-browser \
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
    libglib2.0-0 \
    libgtk-3-0 \
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
    libxtst6
```

### Font Configuration for Persian

Persian text rendering requires proper font support:

```bash
# Install Persian fonts
sudo apt-get install fonts-farsiweb fonts-noto-cjk

# Alternative fonts if the above are not available
sudo apt-get install fonts-noto

# Refresh font cache
fc-cache -fv
```

### Environment Variable Configuration

For AMD64 architecture:

```bash
# Find Chrome path
which google-chrome

# Add to environment variables (add to your .bashrc or .profile)
export CHROME_BIN=$(which google-chrome)
```

For ARM architecture:

```bash
# Find Chromium path
which chromium-browser

# Add to environment variables (add to your .bashrc or .profile)
export CHROME_BIN=$(which chromium-browser)
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)  # Important for ARM!
```

## Docker Deployment

### AMD64 Docker Deployment

For AMD64 architectures:

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

### ARM Docker Deployment

For ARM architectures:

```Dockerfile
FROM node:16

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget ca-certificates \
    fonts-liberation fonts-noto-cjk fonts-farsiweb \
    chromium-browser \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxtst6 xdg-utils

# Set environment variable for Puppeteer
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

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

## Performance Optimization

### Memory Allocation

For AMD64 systems:

```bash
# Add 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

For ARM systems (need more swap):

```bash
# Add 4GB swap file for ARM
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Node.js Memory Settings

For AMD64 systems:
```bash
NODE_OPTIONS="--max-old-space-size=4096" node index.js
```

For ARM systems (use lower value):
```bash
NODE_OPTIONS="--max-old-space-size=2048" node index.js
```

### ARM-specific Browser Flags

For best performance on ARM systems, add these flags when launching Puppeteer:

```javascript
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--use-gl=egl'  // Better for ARM GPUs
  ]
});
```

## Troubleshooting

### Common Issues and Solutions

1. **Browser crashes with "killed" message**
   - Increase available memory or add swap space
   - Use `--disable-dev-shm-usage` flag (already added in our configuration)

2. **Missing shared libraries**
   - For AMD64: Run `ldd $(which google-chrome)` to identify missing dependencies
   - For ARM: Run `ldd $(which chromium-browser)` to identify missing dependencies
   - Install the missing packages with `apt-get install`

3. **Font rendering issues**
   - Ensure Persian fonts are installed: `apt-get install fonts-farsiweb`
   - Alternative: `apt-get install fonts-noto`
   - Check font cache is updated: `fc-cache -fv`

4. **"No usable sandbox" error**
   - We already use `--no-sandbox` flag in our configuration
   - For production, consider configuring proper sandboxing

### ARM-Specific Troubleshooting

If you encounter issues on ARM systems:

1. **Chromium crashes**
   - Increase swap space to at least 4GB
   - Reduce the PDF size/complexity
   - Try with `--disable-gpu-sandbox --use-gl=egl` flags

2. **Slow performance**
   - ARM systems are typically slower for PDF generation
   - Consider using simple table styles
   - Limit concurrent PDF generations

3. **Missing browser binary**
   - Ensure the PUPPETEER_EXECUTABLE_PATH is set correctly
   - Try installing with: `sudo apt-get install chromium-browser`
   - If that fails, try: `sudo apt-get install chromium`

4. **Package installation errors with t64 suffix**
   - Some newer Ubuntu ARM64 versions use the t64 suffix for packages
   - Try installing without the suffix if you get errors

## Comparing Platforms

- **Windows advantages**: Native Chrome integration, better font support out-of-the-box
- **Ubuntu advantages**: Lower resource usage, better containerization support

Within Ubuntu systems:
- **AMD64 advantages**: Better performance, full feature support
- **ARM advantages**: Lower power consumption, potentially lower cost

## Additional Resources

- [Puppeteer Troubleshooting Guide](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md)
- [Running Puppeteer in Docker](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker)
- [ARM-specific Chrome Issues](https://github.com/puppeteer/puppeteer/issues?q=is%3Aissue+arm)

## Conclusion

Our Puppeteer PDF service now provides cross-platform compatibility for both AMD64 and ARM architectures, ensuring that SuperChat can be deployed across a wide range of hardware configurations. The automated setup script handles the complexities of different Ubuntu versions and architectures, making deployment simple regardless of your environment.