const childProcess = require('child_process');

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function runCommands (commands) {
    for (const command of commands) {
        const commandExitCode = await new Promise((resolve, reject) => {
            const child = childProcess.spawn(command, { shell: true, stdio: 'inherit' });

            child.on('error', reject);
            child.on('close', (code) => {
                resolve(code ?? 1);
            });
        });

        if (commandExitCode !== 0)
            throw new Error(`Command "${command}" exited with code ${commandExitCode}`);
    }
}
exports.runCommands = runCommands;
