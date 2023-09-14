import { readFileSync, writeFileSync } from 'fs';
import { DotenvPopulateInput, config as loadDotEnvFile } from 'dotenv';
import { Serializable } from 'child_process';
import * as chalk from 'chalk';
import * as logTransformer from 'strong-log-transformer';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { output } from 'nx/src/utils/output';
import { getCliPath, getPrintableCommandArgsForTask } from './utils';
import { Batch } from './tasks-schedule';
import {
  BatchMessage,
  BatchMessageType,
  BatchResults,
} from './batch/batch-messages';
import { stripIndents } from 'nx/src/utils/strip-indents';
import { Task, TaskGraph } from 'nx/src/config/task-graph';
import { Transform } from 'stream';
import { Worker } from 'worker_threads';
const workerPath = require.resolve('./batch/run-batch');
const runExecutor = require.resolve('./run-executor');

export class ForkedProcessTaskRunner {
  workspaceRoot = workspaceRoot;
  cliPath = getCliPath();

  private readonly verbose = process.env.NX_VERBOSE_LOGGING === 'true';
  private processes = new Set<Worker>();

  constructor(private readonly options: DefaultTasksRunnerOptions) {
    this.setupProcessEventListeners();
  }

  // TODO: vsavkin delegate terminal output printing
  public forkProcessForBatch(
    { executorName, taskGraph: batchTaskGraph }: Batch,
    fullTaskGraph: TaskGraph
  ) {
    return new Promise<BatchResults>((res, rej) => {
      try {
        const count = Object.keys(batchTaskGraph.tasks).length;
        if (count > 1) {
          output.logSingleLine(
            `Running ${output.bold(count)} ${output.bold(
              'tasks'
            )} with ${output.bold(executorName)}`
          );
        } else {
          const args = getPrintableCommandArgsForTask(
            Object.values(batchTaskGraph.tasks)[0]
          );
          output.logCommand(args.join(' '));
          output.addNewline();
        }

        const p = new Worker(workerPath, {
          workerData: this.getEnvVariablesForProcess(), // <-- Pass environment variables using workerData
        });

        this.processes.add(p);

        p.once('exit', (code: number | null, signal: string) => {
          this.processes.delete(p);
          if (code === null) code = this.signalToCode(signal);
          if (code !== 0) {
            const results: BatchResults = {};
            for (const rootTaskId of batchTaskGraph.roots) {
              results[rootTaskId] = {
                success: false,
                terminalOutput: '',
              };
            }
            rej(
              new Error(
                `"${executorName}" exited unexpectedly with code: ${code}`
              )
            );
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.on('message', (message: BatchMessage | any) => {
          switch (message.type) {
            case BatchMessageType.CompleteBatchExecution: {
              res(message.results);
              break;
            }
            case BatchMessageType.RunTasks: {
              break;
            }
            default: {
              if (['stdin', 'stdout', 'stderr'].includes(message?.type)) {
                console.log(message?.message);
              } else if (process.send) {
                process.send(message);
              } else {
                p.postMessage(message);
              }
            }
          }
        });

        // Start the tasks
        p.postMessage({
          type: BatchMessageType.RunTasks,
          executorName,
          batchTaskGraph,
          fullTaskGraph,
        });
      } catch (e) {
        rej(e);
      }
    });
  }

  public forkProcessPipeOutputCapture(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
          output.addNewline();
        }

        const p = new Worker(runExecutor, {
          workerData: this.getEnvVariablesForTask(
            task,
            process.env['FORCE_COLOR'] === undefined
              ? 'true'
              : process.env['FORCE_COLOR'],
            null,
            null
          ),
        });

        this.processes.add(p);

        // Re-emit any messages from the task process
        p.on('message', (message) => {
          if (['stdin', 'stdout', 'stderr'].includes(message?.type)) {
            console.log(message.message);
          } else {
            p.postMessage(message);
          }
        });
        // Send message to run the executor
        p.postMessage({
          targetDescription: task.target,
          overrides: task.overrides,
          taskGraph,
          isVerbose: this.verbose,
        });

        if (streamOutput) {
          if (process.env.NX_PREFIX_OUTPUT === 'true') {
            const color = getColor(task.target.project);
            const prefixText = `${task.target.project}:`;
            if (p.stdout) {
              p.stdout
                .pipe(
                  logClearLineToPrefixTransformer(color.bold(prefixText) + ' ')
                )
                .pipe(logTransformer({ tag: color.bold(prefixText) }))
                .pipe(process.stdout);
            }
            if (p.stderr) {
              p.stderr
                .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
                .pipe(logTransformer({ tag: color(prefixText) }))
                .pipe(process.stderr);
            }
          } else {
            if (p.stdout) {
              p.stdout.pipe(logTransformer()).pipe(process.stdout);
            }
            if (p.stderr) {
              p.stderr.pipe(logTransformer()).pipe(process.stderr);
            }
          }
        }

        const outWithErr: unknown[] = [];
        if (p.stdout) {
          p.stdout.on('data', (chunk) => {
            outWithErr.push(chunk.toString());
          });
        }
        if (p.stderr) {
          p.stderr.on('data', (chunk) => {
            outWithErr.push(chunk.toString());
          });
        }

        p.on('exit', (code: number | null, signal: string) => {
          this.processes.delete(p);
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output|
          const terminalOutput = outWithErr.join('');

          if (!streamOutput && this.options.lifeCycle.printTaskTerminalOutput) {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              code === 0 ? 'success' : 'failure',
              terminalOutput
            );
          }
          this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
          res({ code, terminalOutput });
        });
      } catch (e) {
        console.error(e);
        rej(e);
      }
    });
  }

  public forkProcessDirectOutputCapture(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
          output.addNewline();
        }

        const p = new Worker(runExecutor, {
          workerData: this.getEnvVariablesForTask(
            task,
            undefined,
            temporaryOutputPath,
            streamOutput
          ),
        });
        this.processes.add(p);

        // Re-emit any messages from the task process
        p.on('message', (message) => {
          if (['stdin', 'stdout', 'stderr'].includes(message?.type)) {
            console.log(message.message);
          } else if (process.send) {
            process.send(message);
          } else {
            p.postMessage(message);
          }
        });
        // Send message to run the executor
        p.postMessage({
          targetDescription: task.target,
          overrides: task.overrides,
          taskGraph,
          isVerbose: this.verbose,
        });

        p.on('exit', (code: number | null, signal: string) => {
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output
          let terminalOutput = '';
          try {
            terminalOutput = this.readTerminalOutput(temporaryOutputPath);
            if (
              !streamOutput &&
              this.options.lifeCycle.printTaskTerminalOutput
            ) {
              this.options.lifeCycle.printTaskTerminalOutput(
                task,
                code === 0 ? 'success' : 'failure',
                terminalOutput
              );
            }
          } catch (e) {
            console.log(stripIndents`
              Unable to print terminal output for Task "${task.id}".
              Task failed with Exit Code ${code} and Signal "${signal}".

              Received error message:
              ${e.message}
            `);
          }
          res({
            code,
            terminalOutput,
          });
        });
      } catch (e) {
        console.error(e);
        rej(e);
      }
    });
  }

  private readTerminalOutput(outputPath: string) {
    return readFileSync(outputPath).toString();
  }

  private writeTerminalOutput(outputPath: string, content: string) {
    writeFileSync(outputPath, content);
  }

  // region Environment Variables
  private getEnvVariablesForProcess() {
    return {
      // User Process Env Variables override Dotenv Variables
      ...process.env,
      // Nx Env Variables overrides everything
      ...this.getNxEnvVariablesForForkedProcess(
        process.env.FORCE_COLOR === undefined ? 'true' : process.env.FORCE_COLOR
      ),
    };
  }

  private getEnvVariablesForTask(
    task: Task,
    forceColor: string,
    outputPath: string,
    streamOutput: boolean
  ) {
    // Unload any dot env files at the root of the workspace that were loaded on init of Nx.
    const taskEnv = this.unloadDotEnvFiles({ ...process.env });

    const res = {
      // Start With Dotenv Variables
      ...(process.env.NX_LOAD_DOT_ENV_FILES === 'true'
        ? this.loadDotEnvFilesForTask(task, taskEnv)
        : // If not loading dot env files, ensure env vars created by system are still loaded
          taskEnv),
      // Nx Env Variables overrides everything
      ...this.getNxEnvVariablesForTask(
        task,
        forceColor,
        outputPath,
        streamOutput
      ),
    };

    // we have to delete it because if we invoke Nx from within Nx, we need to reset those values
    if (!outputPath) {
      delete res.NX_TERMINAL_OUTPUT_PATH;
      delete res.NX_STREAM_OUTPUT;
      delete res.NX_PREFIX_OUTPUT;
    }
    delete res.NX_BASE;
    delete res.NX_HEAD;
    delete res.NX_SET_CLI;
    return res;
  }

  private getNxEnvVariablesForForkedProcess(
    forceColor: string,
    outputPath?: string,
    streamOutput?: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      FORCE_COLOR: forceColor,
      NX_WORKSPACE_ROOT: this.workspaceRoot,
      NX_SKIP_NX_CACHE: this.options.skipNxCache ? 'true' : undefined,
    };

    if (outputPath) {
      env.NX_TERMINAL_OUTPUT_PATH = outputPath;
      if (this.options.captureStderr) {
        env.NX_TERMINAL_CAPTURE_STDERR = 'true';
      }
      if (streamOutput) {
        env.NX_STREAM_OUTPUT = 'true';
      }
    }
    return env;
  }

  private getNxEnvVariablesForTask(
    task: Task,
    forceColor: string,
    outputPath: string,
    streamOutput: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      NX_TASK_TARGET_PROJECT: task.target.project,
      NX_TASK_TARGET_TARGET: task.target.target,
      NX_TASK_TARGET_CONFIGURATION: task.target.configuration ?? undefined,
      NX_TASK_HASH: task.hash,
      // used when Nx is invoked via Lerna
      LERNA_PACKAGE_NAME: task.target.project,
    };

    // TODO: remove this once we have a reasonable way to configure it
    if (task.target.target === 'test') {
      env.NX_TERMINAL_CAPTURE_STDERR = 'true';
    }

    return {
      ...this.getNxEnvVariablesForForkedProcess(
        forceColor,
        outputPath,
        streamOutput
      ),
      ...env,
    };
  }

  private loadDotEnvFilesForTask(
    task: Task,
    environmentVariables: NodeJS.ProcessEnv
  ) {
    // Collect dot env files that may pertain to a task
    const dotEnvFiles = [
      // Load DotEnv Files for a configuration in the project root
      ...(task.target.configuration
        ? [
            `${task.projectRoot}/.env.${task.target.target}.${task.target.configuration}`,
            `${task.projectRoot}/.env.${task.target.configuration}`,
            `${task.projectRoot}/.${task.target.target}.${task.target.configuration}.env`,
            `${task.projectRoot}/.${task.target.configuration}.env`,
          ]
        : []),

      // Load DotEnv Files for a target in the project root
      `${task.projectRoot}/.env.${task.target.target}`,
      `${task.projectRoot}/.${task.target.target}.env`,
      `${task.projectRoot}/.env.local`,
      `${task.projectRoot}/.local.env`,
      `${task.projectRoot}/.env`,

      // Load DotEnv Files for a configuration in the workspace root
      ...(task.target.configuration
        ? [
            `.env.${task.target.target}.${task.target.configuration}`,
            `.env.${task.target.configuration}`,
            `.${task.target.target}.${task.target.configuration}.env`,
            `.${task.target.configuration}.env`,
          ]
        : []),

      // Load DotEnv Files for a target in the workspace root
      `.env.${task.target.target}`,
      `.${task.target.target}.env`,

      // Load base DotEnv Files at workspace root
      `.env`,
      `.local.env`,
      `.env.local`,
    ];

    for (const file of dotEnvFiles) {
      loadDotEnvFile({
        path: file,
        processEnv: environmentVariables,
        // Do not override existing env variables as we load
        override: false,
      });
    }

    return environmentVariables;
  }

  private unloadDotEnvFiles(environmentVariables: NodeJS.ProcessEnv) {
    const unloadDotEnvFile = (filename: string) => {
      const parsedDotEnvFile: NodeJS.ProcessEnv = {};
      loadDotEnvFile({
        path: filename,
        processEnv: parsedDotEnvFile as DotenvPopulateInput,
      });
      Object.keys(parsedDotEnvFile).forEach((envVarKey) => {
        if (environmentVariables[envVarKey] === parsedDotEnvFile[envVarKey]) {
          delete environmentVariables[envVarKey];
        }
      });
    };

    for (const file of ['.env', '.local.env', '.env.local']) {
      unloadDotEnvFile(file);
    }
    return environmentVariables;
  }

  // endregion Environment Variables

  private signalToCode(signal: string) {
    if (signal === 'SIGHUP') return 128 + 1;
    if (signal === 'SIGINT') return 128 + 2;
    if (signal === 'SIGTERM') return 128 + 15;
    return 128;
  }

  private setupProcessEventListeners() {
    // When the nx process gets a message, it will be sent into the task's process
    process.on('message', (message: Serializable) => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.send(message);
        }
      });
    });

    process.on('exit', () => {
      this.processes.forEach((p) => {
        p.terminate(); // <-- Use terminate for Worker
      });
    });
    process.on('SIGINT', () => {
      this.processes.forEach((p) => {
        p.terminate(); // <-- Use terminate for Worker
      });
      process.exit();
    });
    process.on('SIGTERM', () => {
      this.processes.forEach((p) => {
        p.terminate(); // <-- Use terminate for Worker
      });
    });
    process.on('SIGHUP', () => {
      this.processes.forEach((p) => {
        p.terminate(); // <-- Use terminate for Worker
      });
    });
  }
}

const colors = [
  chalk.green,
  chalk.greenBright,
  chalk.red,
  chalk.redBright,
  chalk.cyan,
  chalk.cyanBright,
  chalk.yellow,
  chalk.yellowBright,
  chalk.magenta,
  chalk.magentaBright,
];

function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

/**
 * Prevents terminal escape sequence from clearing line prefix.
 */
function logClearLineToPrefixTransformer(prefix: string) {
  let prevChunk: { toString: () => string } | null = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (prevChunk && prevChunk.toString() === '\x1b[2K') {
        // eslint-disable-next-line no-control-regex
        chunk = chunk.toString().replace(/\x1b\[1G/g, (m: any) => m + prefix);
      }
      this.push(chunk);
      prevChunk = chunk;
      callback();
    },
  });
}
