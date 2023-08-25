import { UnifiedChildProcess, isBunSubprocess } from "./bun-cli";

type Signal = 'SIGTERM' | 'SIGINT' | 'SIGHUP' | 'SIGKILL';  // Define more signals as needed

export async function killCurrentProcess(childProcess: UnifiedChildProcess, signal: Signal) {
  try {
    if (!childProcess.killed) {
      if (isBunSubprocess(childProcess)) {
        childProcess.kill();
      } else {
        childProcess.kill(signal);
      }
    }
  } catch (error) {
    console.error('Error killing the process:', error);
  }
}
