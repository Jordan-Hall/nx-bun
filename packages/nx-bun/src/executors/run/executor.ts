import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { RunExecutorSchema } from './schema';
import { executeCliAsync, UnifiedChildProcess, isBunSubprocess } from '../../utils/bun-cli';
import { parentPort, workerData, } from 'worker_threads';
import { Readable } from 'node:stream';
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
    const runningBun = await executeCliAsync(args, { stdio: 'pipe', stderr: 'pipe', stdin: 'pipe', stdout: 'pipe' });

    if (runningBun.stdout) {
      if (parentPort) {
        const text = await new Response(runningBun.stdout as  ReadableStream).text();
        parentPort.postMessage({type: 'stdout', message: text})
      } else {
        (runningBun.stdout as Readable).on('data', (data) => {
          if (parentPort) {
            parentPort.postMessage({type: 'stdout', message: data})
          } else {
            console.log(`stdout: ${data}`);
          }
        });
      }
    }

    if (runningBun.stderr) {
      if (parentPort) {
        const text = await new Response(runningBun.stderr as  ReadableStream).text();
        parentPort.postMessage({type: 'stderr', message: text})
      } else {
        (runningBun.stderr as Readable).on('data', (data) => {
          if (parentPort) {
            parentPort.postMessage({type: 'stderr', message: data})
          } else {
            console.log(`stderr: ${data}`);
          }
        });
      }
    }

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
