import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { RunExecutorSchema } from './schema';
import { assertBunAvailable, executeCliAsync, isBunSubprocess } from '../../utils/bun-cli';
import { parentPort, } from 'worker_threads';
import { killCurrentProcess } from '../../utils/kill';
import { ExecutorContext } from '@nx/devkit';


export default async function* runExecutor(options: RunExecutorSchema, context: ExecutorContext) {
  await assertBunAvailable();
  const args = createArgs(options, context);
  yield* createAsyncIterable(async ({ next, done }) => {
    const runningBun = await executeCliAsync(args, { stdio: 'pipe', stderr: 'inherit', stdin: 'pipe', stdout: 'inherit' });

    if (isBunSubprocess(runningBun)) {
      const writableStream = (type: 'stdout' | 'stderr') => {
        const textDecoder = new TextDecoder();
        return new WritableStream({
          write(chunk) {
            const text = textDecoder.decode(chunk);
            if (parentPort) {
              parentPort.postMessage({ type, message: text });
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
      }
      (runningBun.stdout as ReadableStream<Buffer>).pipeTo(writableStream('stdout'));
      (runningBun.stderr as ReadableStream<Buffer>).pipeTo(writableStream('stderr'));
    } else {
      const textDecoder = new TextDecoder();
      runningBun.stdout.on('data', (data) => {
        const textData = textDecoder.decode(data);
        if (parentPort) {
          parentPort.postMessage({ type: 'stdout', message: textData })
        } else {
          console.log(textData);
        }
      });
      runningBun.stderr.on('data', (data) => {
        const textData = textDecoder.decode(data);
        if (parentPort) {
          parentPort.postMessage({ type: 'stderr', message: textData })
        } else {
          console.log(textData);
        }
      });

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

function createArgs(options: RunExecutorSchema, context: ExecutorContext) {

  const args: string[] = ['run'];
  args.push(options.main);
  if (options.bun) {
    args.push('--bun')
  }
  if (options.tsconfig) {
    args.push(`--tsconfig-override=${options.tsconfig}`)
  }
  if (options.smol) {
    args.push('--smol');
  }
  if (options.watch) {
    args.push('--watch');
  }
  if (options.hot) {
    args.push('--hot');
  }


  if (options.config) {
    args.push(`-c ${options.config}`)
  }
  return args;
}
