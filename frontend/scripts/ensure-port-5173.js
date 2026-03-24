import { execSync } from 'child_process';

const PORT = 5173;

function killProcessOnPort(port) {
    try {
        // 1. Find process ID using netstat (CMD version for compatibility)
        // -a: all connections, -n: numeric, -o: owning PID
        const output = execSync(`netstat -ano | findstr :${port}`).toString().trim();

        if (!output) {
            console.log(`Port ${port} is clear.`);
            return;
        }

        // 2. Extract PID from the lines
        const lines = output.split('\n');
        const pids = new Set();

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1]; // PID is the last column
            if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
                pids.add(pid);
            }
        }

        if (pids.size === 0) {
            console.log(`No active PID found for port ${port}.`);
            return;
        }

        // 3. Kill each PID
        console.log(`Found processes on port ${port}: ${Array.from(pids).join(', ')}. Killing...`);
        for (const pid of pids) {
            try {
                // Skip current process if somehow matched
                if (pid == process.pid) continue;

                execSync(`taskkill /F /PID ${pid}`);
                console.log(`Successfully killed PID ${pid}.`);
            } catch (err) {
                console.warn(`Could not kill PID ${pid}: It might have closed already or requires more permissions.`);
            }
        }
    } catch (error) {
        // findstr exits with code 1 if no matches are found, which triggers an error in execSync
        if (error.status === 1) {
            console.log(`No processes running on port ${port}.`);
        } else {
            console.error(`Error checking/killing process on port ${port}:`, error.message);
        }
    }
}

killProcessOnPort(PORT);
