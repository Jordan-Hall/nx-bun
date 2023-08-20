import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { RunExecutorSchema } from './schema';
import { executeCliAsync, UnifiedChildProcess, isBunSubprocess } from '../../utils/bun-cli';
type Signal = 'SIGTERM' | 'SIGINT' | 'SIGHUP' | 'SIGKILL';  // Define more signals as needed

async function killCurrentProcess(childProcess: UnifiedChildProcess, signal: Signal) {
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
    // Handle or log the error.
  }
}

export default async function* runExecutor(options: RunExecutorSchema) {
  const args = createArgs(options);
  yield* createAsyncIterable(async ({ next, done }) => {
    const runningBun = await executeCliAsync(args, { stdio: 'inherit' });

    process.on('SIGTERM', async () => {
      await killCurrentProcess(runningBun, 'SIGTERM');
      process.exit(128 + 15);
    });

    process.on('SIGINT', async () => {
      await killCurrentProcess(runningBun, 'SIGINT');
      process.exit(128 + 2);
    });

    process.on('SIGHUP', async () => {
      await killCurrentProcess(runningBun, 'SIGHUP');
      process.exit(128 + 1);
    });

    process.on('uncaughtException', async (err) => {
      console.error('Caught exception:', err);
      await killCurrentProcess(runningBun, 'SIGTERM');
      process.exit(1);
    });

    if (options.watch) {
      next({ success: true });
    }

    if (isBunSubprocess(runningBun)) {
      runningBun.exited.then((code) => {
        next({ success: code === 0 });
        if (!options.watch) {
          done();
        }
      });
    } else {
      runningBun.on('exit', (code) => {
        next({ success: code === 0 });
        if (!options.watch) {
          done();
        }
      });
    }
  });
}

function createArgs(options: RunExecutorSchema) {
  const args: string[] = ["run"];
  if (options.smol) {
    args.push('--smol');
  }
  if (options.watch) {
    args.push('--watch');
  }
  // make sure file is always last option
  args.push(options.main);
  return args;
}
