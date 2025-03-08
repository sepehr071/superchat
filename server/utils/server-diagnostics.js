/**
 * Server Diagnostics Tool
 * 
 * This utility provides detailed information about the server environment,
 * especially useful for diagnosing issues with Puppeteer on different architectures.
 */

const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Gather comprehensive system information
 * @returns {Object} System information
 */
function getSystemInfo() {
  const info = {
    hardware: {
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus(),
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      loadAverage: os.loadavg()
    },
    os: {
      type: os.type(),
      release: os.release(),
      version: os.version(),
      uptime: formatUptime(os.uptime())
    },
    nodejs: {
      version: process.version,
      versions: process.versions,
      execPath: process.execPath,
      memoryUsage: formatMemoryUsage(process.memoryUsage())
    },
    network: {
      hostname: os.hostname(),
      interfaces: getNetworkInterfaces()
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'not set',
      chromeBin: process.env.CHROME_BIN || 'not set'
    }
  };

  // Get additional Linux-specific information
  if (os.platform() === 'linux') {
    info.linux = getLinuxDetails();
  }

  return info;
}

/**
 * Get Linux-specific system details
 * @returns {Object} Linux system information
 */
function getLinuxDetails() {
  const linux = {};
  
  try {
    // Get Linux distribution info
    if (fs.existsSync('/etc/os-release')) {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      linux.distribution = parseOsRelease(osRelease);
    }
    
    // Get installed packages related to Puppeteer
    linux.packages = {};
    
    try {
      // Check for Chrome/Chromium
      const chromeVersion = execSync('google-chrome --version 2>/dev/null || chromium-browser --version 2>/dev/null').toString().trim();
      linux.packages.chrome = chromeVersion;
    } catch (e) {
      linux.packages.chrome = 'Not installed or not found';
    }
    
    // Check for key dependencies
    const dependencyChecks = [
      'libasound2t64',
      'libatk-bridge2.0-0t64',
      'libatk1.0-0t64',
      'libgbm1',
      'fonts-liberation'
    ];
    
    linux.packages.dependencies = {};
    
    dependencyChecks.forEach(pkg => {
      try {
        const output = execSync(`dpkg-query -W -f='\${Status} \${Version}' ${pkg} 2>/dev/null`).toString().trim();
        linux.packages.dependencies[pkg] = output.includes('install ok') ? output.split(' ').pop() : 'Not installed';
      } catch (e) {
        linux.packages.dependencies[pkg] = 'Not installed or not found';
      }
    });
    
    // Check swap space
    try {
      const swapInfo = execSync('free -m').toString().trim();
      linux.swapSpace = swapInfo;
    } catch (e) {
      linux.swapSpace = 'Error getting swap info';
    }
    
    // Get process limits
    try {
      const limits = execSync('ulimit -a').toString().trim();
      linux.processLimits = limits;
    } catch (e) {
      linux.processLimits = 'Error getting process limits';
    }
  } catch (error) {
    linux.error = `Error gathering Linux details: ${error.message}`;
  }
  
  return linux;
}

/**
 * Parse the /etc/os-release file content
 * @param {string} content - Content of os-release file
 * @returns {Object} Parsed distribution info
 */
function parseOsRelease(content) {
  const lines = content.split('\n');
  const result = {};
  
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      const key = parts[0];
      let value = parts[1].replace(/"/g, '');
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Format uptime to human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

/**
 * Format memory usage to human-readable format
 * @param {Object} memoryUsage - Memory usage object
 * @returns {Object} Formatted memory usage
 */
function formatMemoryUsage(memoryUsage) {
  const formatted = {};
  
  for (const [key, value] of Object.entries(memoryUsage)) {
    formatted[key] = formatBytes(value);
  }
  
  return formatted;
}

/**
 * Get network interfaces info
 * @returns {Object} Network interfaces
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = {};
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    result[name] = addrs.map(addr => ({
      address: addr.address,
      netmask: addr.netmask,
      family: addr.family,
      mac: addr.mac,
      internal: addr.internal
    }));
  }
  
  return result;
}

/**
 * Run diagnostics and print to console
 */
function runDiagnostics() {
  console.log('\n========== SERVER DIAGNOSTICS ==========\n');
  const info = getSystemInfo();
  console.log(JSON.stringify(info, null, 2));
  console.log('\n========== END DIAGNOSTICS ==========\n');
  return info;
}

/**
 * Write diagnostics to file
 * @param {string} outputPath - Path to write diagnostics info
 */
function writeDiagnosticsToFile(outputPath = 'server-diagnostics.json') {
  const info = getSystemInfo();
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  
  fs.writeFileSync(resolvedPath, JSON.stringify(info, null, 2));
  console.log(`Server diagnostics written to: ${resolvedPath}`);
  
  return resolvedPath;
}

// Export functions
module.exports = {
  getSystemInfo,
  runDiagnostics,
  writeDiagnosticsToFile
};

// If script is executed directly, run diagnostics
if (require.main === module) {
  runDiagnostics();
}