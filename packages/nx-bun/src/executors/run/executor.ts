import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { RunExecutorSchema } from './schema';
import { assertBunAvailable, executeCliAsync, isBunSubprocess } from '../../utils/bun-cli';
import { parentPort, } from 'worker_threads';
import { Readable } from 'node:stream';
import { killCurrentProcess } from '../../utils/kill';


export default async function* runExecutor(options: RunExecutorSchema) {
  assertBunAvailable();
  const args = createArgs(options);
  yield* createAsyncIterable(async ({ next, done }) => {
    const runningBun = await executeCliAsync(args, { stdio: 'pipe', stderr: 'pipe', stdin: 'pipe', stdout: 'pipe' });

    if (runningBun.stdout) {
      if (parentPort) {
        const writableStream = new WritableStream({
          write(chunk) {
            const text = new TextDecoder().decode(chunk);
            if (parentPort) {
              parentPort.postMessage({ type: 'stdout', message: text });
            } else {
              console.log(text);
            }
          },
          close() {
            console.log('Stream closed');
          },
          abort(err) {
            console.error('Stream aborted', err);
          }
        });
        (runningBun.stdout as ReadableStream<Buffer>).pipeTo(writableStream);
      } else {
        (runningBun.stdout as Readable).on('data', (data) => {
          if (parentPort) {
            parentPort.postMessage({ type: 'stdout', message: data })
          } else {
            console.log(`stdout: ${data}`);
          }
        });
      }
    }

    if (runningBun.stderr) {
      if (parentPort) {
        const text = await new Response(runningBun.stderr as ReadableStream).text();
        parentPort.postMessage({ type: 'stderr', message: text })
      } else {
        (runningBun.stderr as Readable).on('data', (data) => {
          if (parentPort) {
            parentPort.postMessage({ type: 'stderr', message: data })
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
  const args: string[] = [];
  if (options.bun) {
    args.push('--bun')
  }
  if (options.smol) {
    args.push('--smol');
  }
  if (options.watch) {
    args.push('--watch');
  }

  if (options.config) {
    args.push(`-c ${options.config}`)
  }

  args.push('run')
  // make sure file is always last option
  args.push(options.main);
  return args;
}
