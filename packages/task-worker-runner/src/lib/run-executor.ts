import { appendFileSync, openSync, writeFileSync } from 'fs';
import { Target, run } from 'nx/src/command-line/run/run';
import { TaskGraph } from 'nx/src/config/task-graph';
import { parentPort, workerData, } from 'worker_threads';

if (workerData?.NX_TERMINAL_OUTPUT_PATH) {
  setUpOutputWatching(
    workerData.NX_TERMINAL_CAPTURE_STDERR === 'true',
    workerData.NX_STREAM_OUTPUT === 'true'
  );
}

if (!workerData?.NX_WORKSPACE_ROOT) {
  console.error('Invalid Nx command invocation');
  process.exit(1);
}

workerData.NX_CLI_SET = 'true';

/**
 * We need to collect all stdout and stderr and store it, so the caching mechanism
 * could store it.
 *
 * Writing stdout and stderr into different streams is too risky when using TTY.
 *
 * So we are simply monkey-patching the Javascript object. In this case the actual output will always be correct.
 * And the cached output should be correct unless the CLI bypasses process.stdout or console.log and uses some
 * C-binary to write to stdout.
 */
function setUpOutputWatching(captureStderr: boolean, streamOutput: boolean) {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;

  // The terminal output file gets out and err
  const outputPath = workerData?.NX_TERMINAL_OUTPUT_PATH;
  const stdoutAndStderrLogFileHandle = openSync(outputPath, 'w');

  const onlyStdout = [] as string[];
  process.stdout._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    onlyStdout.push(chunk);
    appendFileSync(stdoutAndStderrLogFileHandle, chunk);
    if (streamOutput) {
      if (stdoutWrite) {
        stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
      }
      if (parentPort) {
        parentPort.postMessage({
          type: 'stdout',
          message: chunk.toString()
        })
      }
    } else {
      callback();
    }
  };

  process.stderr._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    appendFileSync(stdoutAndStderrLogFileHandle, chunk);
    if (streamOutput) {
      if (stderrWrite) {
        stderrWrite.apply(process.stderr, [chunk, encoding, callback]);
      }
      if (parentPort) {
        parentPort.postMessage({
          type: 'stderr',
          message: chunk.toString()
        })
      }
    } else {
      callback();
    }
  };

  parentPort?.on('exit', (code) => {
    // when the process exits successfully, and we are not asked to capture stderr
    // override the file with only stdout
    if (code === 0 && !captureStderr) {
      writeFileSync(outputPath, onlyStdout.join(''));
    }
  });
}
if (parentPort) {
  parentPort.on(
    'message',
    async (message: {
      targetDescription: Target;
      overrides: Record<string, any>;
      taskGraph: TaskGraph;
      isVerbose: boolean;
    }) => {
      try {
        const statusCode = await run(
          process.cwd(),
          workerData.NX_WORKSPACE_ROOT,
          message.targetDescription,
          message.overrides,
          message.isVerbose,
          message.taskGraph
        );
        process.exit(statusCode);
      } catch (e) {
        console.error(`Could not find 'nx' module in this workspace.`, e);
        process.exit(1);
      }
    }
  );
}

