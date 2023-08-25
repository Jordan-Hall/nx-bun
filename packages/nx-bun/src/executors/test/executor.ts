import { TestExecutorSchema } from './schema';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { assertBunAvailable, executeCliAsync, isBunSubprocess } from '../../utils/bun-cli';
import { parentPort, } from 'worker_threads';
import { Readable } from 'node:stream';
import { killCurrentProcess } from '../../utils/kill';
import { ExecutorContext } from '@nx/devkit';

interface TestExecutorNormalizedSchema extends TestExecutorSchema {
  testDir: string
}

export default async function* runExecutor(options: TestExecutorSchema, context: ExecutorContext) {
  assertBunAvailable();
  const opts = normalizeOptions(options, context);
  const args = createArgs(opts);
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

function createArgs(options: TestExecutorNormalizedSchema) {
  const args: string[] = [`--cwd ${options.testDir}`];

  if (options.smol) {
    args.push('--smol');
  }

  if (options.config) {
    args.push(`-c ${options.config}`)
  }

  args.push('test')

  if (typeof options.bail === 'boolean') {
    args.push('--bail')
  } else if (typeof options.bail === 'number') {
    args.push(`--bail ${options.bail}`)
  }
  if (options.preload) {
    args.push(`--preload ${options.preload}`)
  }
  if (options.timeout) {
    args.push(`--timeout ${options.timeout}`)
  }

  if (options.rerunEach) {
    args.push(`--rerun-each ${options.rerunEach}`)
  }
  if (options.watch) {
    args.push('--watch');
  }
  return args;
}

function normalizeOptions(options: TestExecutorSchema, context: ExecutorContext): TestExecutorNormalizedSchema {
  const projectConfig =
    context.projectGraph?.nodes?.[context.projectName]?.data;

  if (!projectConfig) {
    throw new Error(
      `Could not find project configuration for ${context.projectName} in executor context.`
    );
  }
  return {
    ...options,
    testDir: projectConfig.sourceRoot || projectConfig.root
  };
}

