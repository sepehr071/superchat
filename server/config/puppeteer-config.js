/**
 * Puppeteer configuration for ARM64 servers
 * Addresses common issues with Chromium on ARM architecture
 */

const os = require('os');

// Detect if running on ARM architecture
const isArmArchitecture = ['arm', 'arm64', 'aarch64'].includes(os.arch());

const baseConfig = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ]
};

const armConfig = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--use-gl=egl',
    '--single-process',
    '--disable-breakpad',
    '--no-zygote',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas'
  ]
};

// Export the appropriate configuration based on architecture
module.exports = isArmArchitecture ? armConfig : baseConfig;