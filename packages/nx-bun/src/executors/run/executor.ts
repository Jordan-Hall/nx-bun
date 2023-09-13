import { parentPort } from 'node:worker_threads';
import * as path from 'node:path';
import { ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import {
  ExecutorContext,
  parseTargetString,
  ProjectGraphProjectNode,
  readTargetOptions,
  logger,
  runExecutor,
} from '@nx/devkit';
import { getRelativeDirectoryToProjectRoot } from '@nx/js/src/utils/get-main-file-dir';

import {
  assertBunAvailable,
  executeCliAsync,
  isBunSubprocess,
  UnifiedChildProcess,
} from '../../utils/bun-cli';
import { killCurrentProcess, Signal } from '../../utils/kill';
import { RunExecutorSchema } from './schema';
import { debounce } from '../../utils/debounce';

interface ActiveTask {
  id: string;
  killed: boolean;
  promise: Promise<void> | null;
  childProcess: UnifiedChildProcess | null;
  start: () => Promise<void>;
  stop: (signal: Signal) => Promise<void>;
}
function getFileToRun(
  context: ExecutorContext,
  project: ProjectGraphProjectNode,
  buildOptions: Record<string, any>,
  buildTargetExecutor: string
): string {
  // If using run-commands or another custom executor, then user should set
  // outputFileName, but we can try the default value that we use.
  if (!buildOptions?.outputPath && !buildOptions?.outputFileName) {
    const fallbackFile = path.join('dist', project.data.root, 'main.js');
    logger.warn(
      `Build option outputFileName not set for ${project.name}. Using fallback value of ${fallbackFile}.`
    );
    return path.join(context.root, fallbackFile);
  }

  let outputFileName = buildOptions.outputFileName;

  if (!outputFileName) {
    if (
      buildTargetExecutor === '@nx/js:tsc' ||
      buildTargetExecutor === '@nx/js:swc'
    ) {
      const fileName = `${path.parse(buildOptions.main).name}.js`;
      outputFileName = path.join(
        getRelativeDirectoryToProjectRoot(buildOptions.main, project.data.root),
        fileName
      );
    } else if (
      buildTargetExecutor === '@nx-bun/nx:build' ||
      buildTargetExecutor.includes('../dist/packages/nx-bun:build')
    ) {
      return path.join(context.root, buildOptions.entrypoints[0]);
    } else {
      outputFileName = `${path.parse(buildOptions.main).name}.js`;
    }
  }

  return path.join(context.root, buildOptions.outputPath, outputFileName);
}

export default async function* bunRunExecutor(
  options: RunExecutorSchema,
  context: ExecutorContext
) {
  await assertBunAvailable();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const project = context.projectGraph?.nodes[context.projectName!];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph!
  );
  const projectBuildTargetConfig = project.data.targets?.[buildTarget.target];
  if (!projectBuildTargetConfig) {
    throw new Error(
      `Cannot find build target ${options.buildTarget} for project ${context.projectName}`
    );
  }

  const buildTargetExecutor = projectBuildTargetConfig?.executor;
  if (!buildTargetExecutor) {
    throw new Error(
      `Missing executor in build target ${options.buildTarget} for project ${context.projectName}`
    );
  }

  const isBunBuildTargetExecutor =
    buildTargetExecutor === '@nx-bun/nx:build' ||
    buildTargetExecutor.includes('../dist/packages/nx-bun:build');

  const buildOptions: Record<string, unknown> = {
    ...readTargetOptions(buildTarget, context),
    ...options.buildTargetOptions,
  };

  const fileToRun = getFileToRun(
    context,
    project,
    buildOptions,
    buildTargetExecutor
  );
  const args = getArgs(options, context);

  let currentTask: ActiveTask | undefined;
  const tasks: ActiveTask[] = [];

  yield* createAsyncIterable(async ({ next, done }) => {
    const processQueue = async () => {
      if (tasks.length === 0) return;

      const previousTask = currentTask;
      const task = tasks.shift();
      currentTask = task;
      await previousTask?.stop('SIGTERM');
      await task?.start();
    };

    const debouncedProcessQueue = debounce(
      { delay: options.debounce ?? 1_000 },
      processQueue
    );

    const addToQueue = async (
      childProcess: null | ChildProcess,
      buildResult: Promise<{ success: boolean }>
    ) => {
      const task: ActiveTask = {
        id: randomUUID(),
        killed: false,
        childProcess,
        promise: null,
        start: async () => {
          // Wait for build to finish.
          const result = await buildResult;

          if (!result.success) {
            // If in watch-mode, don't throw or else the process exits.
            if (options.watch) {
              if (!task.killed) {
                // Only log build error if task was not killed by a new change.
                logger.error(`Build failed, waiting for changes to restart...`);
              }
              return;
            } else {
              throw new Error(`Build failed. See above for errors.`);
            }
          }

          // Before running the program, check if the task has been killed (by a new change during watch).
          if (task.killed) return;

          // Run the program
          // eslint-disable-next-line no-async-promise-executor
          task.promise = new Promise<void>(async (resolve, reject) => {
            const runningBun = await executeCliAsync(
              ['run', ...args, fileToRun],
              {
                stdio: 'pipe',
                stderr: 'inherit',
                stdin: 'pipe',
                stdout: 'inherit',
              }
            );

            task.childProcess = runningBun;

            if (isBunSubprocess(runningBun)) {
              const writableStream = (type: 'stdout' | 'stderr') => {
                const textDecoder = new TextDecoder();
                return new WritableStream({
                  write(chunk) {
                    const text = textDecoder.decode(chunk);
                    if (parentPort) {
                      parentPort.postMessage({ type, message: text });
                    } else {
                      logger.log(text);
                    }
                  },
                  close() {
                    if (!options.watch) done();
                    resolve();
                  },
                  abort(err) {
                    logger.error(err);
                    if (!options.watch) done();
                    reject(err);
                  },
                });
              };
              (runningBun.stdout as ReadableStream<Buffer>).pipeTo(
                writableStream('stdout')
              );
              (runningBun.stderr as ReadableStream<Buffer>).pipeTo(
                writableStream('stderr')
              );
            } else {
              const textDecoder = new TextDecoder();
              runningBun.stdout.on('data', (data) => {
                const textData = textDecoder.decode(data);
                if (parentPort) {
                  parentPort.postMessage({ type: 'stdout', message: textData });
                } else {
                  logger.log(textData);
                }
              });
              const handleStdErr = (data) => {
                if (!options.watch || !task.killed) {
                  const textData = textDecoder.decode(data);

                  if (parentPort) {
                    parentPort.postMessage({
                      type: 'stderr',
                      message: textData,
                    });
                  } else {
                    logger.log(textData);
                  }
                }
              };
              runningBun.stderr.on('data', handleStdErr);
              runningBun.once('exit', (code) => {
                runningBun?.off('data', handleStdErr);
                if (options.watch && !task.killed) {
                  logger.info(
                    `NX Process exited with code ${code}, waiting for changes to restart...`
                  );
                }
                if (!options.watch) done();
                resolve();
              });
            }

            next({ success: true, options: buildOptions });
          });
        },
        stop: async (signal: Signal = 'SIGTERM') => {
          task.killed = true;
          // Request termination and wait for process to finish gracefully.
          // NOTE: `childProcess` may not have been set yet if the task did not have a chance to start.
          // e.g. multiple file change events in a short time (like git checkout).
          if (task.childProcess) {
            await killCurrentProcess(task.childProcess, signal);
          }
          try {
            await task.promise;
          } catch {
            // Doesn't matter if task fails, we just need to wait until it finishes.
          }
        },
      };

      tasks.push(task);
    };

    if (!isBunBuildTargetExecutor) {
      // TODO: custom run executor
      const output = await runExecutor(
        buildTarget,
        {
          ...options.buildTargetOptions,
          watch: options.watch,
        },
        context
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const event = await output.next();
        await addToQueue(null, Promise.resolve(event.value));
        await debouncedProcessQueue();
        if (event.done || !options.watch) {
          break;
        }
      }
    } else {
      await addToQueue(null, Promise.resolve({ success: true }));
      await processQueue();
    }

    const stopAllTasks = (signal: Signal = 'SIGTERM') => {
      for (const task of tasks) {
        task.stop(signal);
      }
    };

    process.on('SIGTERM', async () => {
      stopAllTasks('SIGTERM');
      process.exit(128 + 15);
    });

    process.on('SIGINT', async () => {
      stopAllTasks('SIGINT');
      process.exit(128 + 2);
    });

    process.on('SIGHUP', async () => {
      stopAllTasks('SIGHUP');
      process.exit(128 + 1);
    });
  });
}

function getArgs(
  options: RunExecutorSchema,
  context: ExecutorContext
): string[] {
  const args: string[] = [];

  if (options.bun) {
    args.push('--bun');
  }
  if (options.tsconfig) {
    args.push(`--tsconfig-override=${options.tsconfig}`);
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
    args.push(`-c ${options.config}`);
  }
  return args;
}
