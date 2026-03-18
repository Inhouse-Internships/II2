const { spawn } = require('child_process');
const fs = require('fs');

const log = fs.createWriteStream('boot_log.txt');
const child = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: process.env
});

child.stdout.pipe(log);
child.stderr.pipe(log);

setTimeout(() => {
    child.kill();
    process.exit(0);
}, 10000);
