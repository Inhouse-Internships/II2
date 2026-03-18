const os = require('os');

/**
 * Automatically finds the local IPv4 address of the machine.
 * Falls back to 'localhost' if no external IPv4 is found.
 */
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  
  for (const name in interfaces) {
    for (const info of interfaces[name]) {
      // Look for IPv4 that is not internal (loopback)
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  
  return 'localhost';
}

module.exports = getNetworkIp;
